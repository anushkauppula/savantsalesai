import { MaterialIcons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';

interface Message {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: Date;
  audioUri?: string;
}

// Helper function to generate unique message IDs
const generateMessageId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
};

export default function RealtimeAnalysisScreen() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  
  const wsRef = useRef<WebSocket | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    // Scroll to bottom when new messages are added
    if (messages.length > 0) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages]);

  useEffect(() => {
    // Connect to WebSocket when component mounts
    if (user?.id) {
      connectWebSocket();
    }

    // Cleanup on unmount
    return () => {
      disconnectWebSocket();
      // Clear messages when component unmounts
      setMessages([]);
    };
  }, [user?.id]);

  // Cleanup audio resources
  useEffect(() => {
    return () => {
      if (sound) {
        sound.unloadAsync().catch(console.error);
      }
    };
  }, [sound]);

  useEffect(() => {
    const currentRecording = recording;
    return () => {
      if (currentRecording) {
        currentRecording.getStatusAsync()
          .then((status) => {
            // Only unload if recording is still active
            if (status.isRecording || (status.canRecord && !status.isDoneRecording)) {
              return currentRecording.stopAndUnloadAsync();
            }
          })
          .catch((error) => {
            // Ignore errors if recording is already unloaded
            if (error.message && !error.message.includes('already been unloaded')) {
              console.error('Error cleaning up recording:', error);
            }
          });
      }
    };
  }, [recording]);

  const connectWebSocket = () => {
    if (!user?.id) {
      console.log('No user ID, cannot connect to WebSocket');
      return;
    }

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      console.log('WebSocket already connected');
      return;
    }

    const backendUrl = Platform.OS === 'web' 
      ? 'http://localhost:8000' 
      : 'http://192.168.1.146:8000';
    
    // Note: /test_pinecone is a POST endpoint, not WebSocket
    // For WebSocket, we should use /ws/realtime or similar
    // For now, we'll keep WebSocket connection but use it for voice communication
    const wsBackendUrl = Platform.OS === 'web' 
      ? 'ws://localhost:8000' 
      : 'ws://192.168.1.146:8000';
    
    const wsUrl = `${wsBackendUrl}/ws/realtime?user_id=${user.id}`;
    console.log('Connecting to WebSocket:', wsUrl);

    setConnectionStatus('connecting');

    try {
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log('WebSocket connected');
        setIsConnected(true);
        setConnectionStatus('connected');
        
        // Send initial connection message
        ws.send(JSON.stringify({
          type: 'connection',
          user_id: user.id,
          message: 'Connected to real-time analysis',
        }));
      };

      ws.onmessage = async (event) => {
        try {
          console.log('WebSocket message received:', typeof event.data, event.data);
          
          // Check if it's binary audio data or JSON
          if (Platform.OS === 'web' && event.data instanceof Blob) {
            // Handle audio response on web
            const audioUrl = URL.createObjectURL(event.data);
            await playAudioResponse(audioUrl);
            
            // Remove "Sending..." and "Processing..." messages without adding audio message
            setMessages((prev) => {
              return prev.filter(
                (msg) => msg.text !== '📤 Sending audio...' && msg.text !== '⏳ Processing audio...'
              );
            });
          } else if (typeof event.data === 'string') {
            // Handle JSON messages
            let data;
            try {
              data = JSON.parse(event.data);
              console.log('Parsed WebSocket data:', data);
            } catch (parseError) {
              console.error('Error parsing JSON:', parseError, 'Raw data:', event.data);
              return;
            }
            
            // Handle different message types
            if (data.type === 'connection') {
              // Connection messages - don't display these, they're just status updates
              console.log('Connection status:', data.message);
              return;
            }
            
            if (data.type === 'audio' && data.status === 'ready') {
              // Audio ready message - don't display, just log
              console.log('Audio ready:', data.message);
              // Don't return, continue processing in case there's more data
            }
            
            if (data.type === 'processing') {
              // Processing message - update loading state
              console.log('Processing:', data.message);
              setIsLoading(true);
              setMessages((prev) => {
                const filtered = prev.filter((msg) => msg.text !== '📤 Sending audio...');
                const processingMessage: Message = {
                  id: generateMessageId(),
                  text: '⏳ Processing audio...',
                  isUser: false,
                  timestamp: new Date(),
                };
                return [...filtered, processingMessage];
              });
              return;
            }
            
            // Remove "Sending..." message and stop loading when we get any response
            let hasResponse = false;
            
            // Handle audio responses (type: "audio_response")
            if (data.type === 'audio_response' || (data.type === 'audio' && data.status !== 'ready' && data.status !== 'received')) {
              hasResponse = true;
              setIsLoading(false);
              
              // Audio response with base64 or URL
              if (data.audio_url) {
                await playAudioResponse(data.audio_url);
              } else if (data.audio_base64) {
                // Convert base64 to file and play
                await playAudioFromBase64(data.audio_base64);
              }
              
              // Remove "Sending..." and "Processing..." messages without adding audio message
              setMessages((prev) => {
                return prev.filter(
                  (msg) => msg.text !== '📤 Sending audio...' && msg.text !== '⏳ Processing audio...'
                );
              });
            }
            
            // Handle transcription (type: "transcription")
            if (data.type === 'transcription' || data.transcription) {
              hasResponse = true;
              setIsLoading(false);
              
              const transcriptionText = data.transcription || data.message || '';
              
              setMessages((prev) => {
                // Remove "Sending..." and "Processing..." messages
                const filtered = prev.filter(
                  (msg) => msg.text !== '📤 Sending audio...' && msg.text !== '⏳ Processing audio...'
                );
                const transcriptionMessage: Message = {
                  id: generateMessageId(),
                  text: transcriptionText,
                  isUser: false,
                  timestamp: new Date(),
                };
                return [...filtered, transcriptionMessage];
              });
              
            }
            
            // Handle text answers/responses (type: "answer")
            if (data.type === 'answer' || data.answer || data.response) {
              hasResponse = true;
              setIsLoading(false);
              
              setMessages((prev) => {
                // Remove "Sending..." and "Processing..." messages
                const filtered = prev.filter(
                  (msg) => msg.text !== '📤 Sending audio...' && msg.text !== '⏳ Processing audio...'
                );
                const answerText = data.answer || data.response || data.message || '';
                const answerMessage: Message = {
                  id: generateMessageId(),
                  text: answerText,
                  isUser: false,
                  timestamp: new Date(),
                };
                return [...filtered, answerMessage];
              });
            }
            
            // Handle error messages
            if (data.type === 'error') {
              hasResponse = true;
              setIsLoading(false);
              
              setMessages((prev) => {
                const filtered = prev.filter((msg) => msg.text !== '📤 Sending audio...');
                const errorMessage: Message = {
                  id: generateMessageId(),
                  text: `Error: ${data.message || 'Unknown error'}`,
                  isUser: false,
                  timestamp: new Date(),
                };
                return [...filtered, errorMessage];
              });
            }
            
            // Handle generic messages (but skip connection and ready messages)
            if (data.message && data.type !== 'connection' && !(data.type === 'audio' && data.status === 'ready')) {
              // Only display if it's not a status message
              if (data.type !== 'audio' || (data.status !== 'ready' && data.status !== 'received')) {
                hasResponse = true;
                setIsLoading(false);
                
                setMessages((prev) => {
                  // Don't add duplicate messages
                  const lastMessage = prev[prev.length - 1];
                  if (lastMessage && lastMessage.text === data.message) {
                    return prev;
                  }
                  
                  // Remove "Sending..." if present
                  const filtered = prev.filter((msg) => msg.text !== '📤 Sending audio...');
                  
                  const genericMessage: Message = {
                    id: generateMessageId(),
                    text: data.message,
                    isUser: false,
                    timestamp: new Date(),
                  };
                  return [...filtered, genericMessage];
                });
              }
            }
            
            // If we got any response but didn't add a message, add a fallback
            if (!hasResponse && data.type && data.type !== 'connection' && !(data.type === 'audio' && data.status === 'ready') && data.type !== 'processing') {
              setIsLoading(false);
              setMessages((prev) => {
                const filtered = prev.filter(
                  (msg) => msg.text !== '📤 Sending audio...' && msg.text !== '⏳ Processing audio...'
                );
                // Try to extract meaningful message
                const messageText = data.message || data.text || JSON.stringify(data);
                const fallbackMessage: Message = {
                  id: generateMessageId(),
                  text: messageText,
                  isUser: false,
                  timestamp: new Date(),
                };
                return [...filtered, fallbackMessage];
              });
            }
          } else if (Platform.OS !== 'web' && event.data) {
            // Handle binary data on React Native
            // For React Native, we expect base64 encoded audio in JSON
            console.log('Received binary data on mobile, expecting base64 in JSON format');
          }
        } catch (error) {
          console.error('Error processing WebSocket message:', error);
          const errorMessage: Message = {
            id: generateMessageId(),
            text: `Error processing message: ${error instanceof Error ? error.message : 'Unknown error'}`,
            isUser: false,
            timestamp: new Date(),
          };
          setMessages((prev) => [...prev, errorMessage]);
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        setConnectionStatus('disconnected');
        setIsConnected(false);
        
        // Show error message to user
        setMessages((prev) => {
          const errorMessage: Message = {
            id: generateMessageId(),
            text: `Connection error: Unable to connect to test_pinecone endpoint. Please check if the server is running.`,
            isUser: false,
            timestamp: new Date(),
          };
          return [...prev, errorMessage];
        });
      };

      ws.onclose = (event) => {
        console.log('WebSocket closed:', event.code, event.reason);
        setConnectionStatus('disconnected');
        setIsConnected(false);
        
        // Only attempt to reconnect if it wasn't a normal closure
        if (event.code !== 1000 && event.code !== 1001) {
          console.log('Attempting to reconnect in 3 seconds...');
          setTimeout(() => {
            if (user?.id && wsRef.current?.readyState !== WebSocket.OPEN) {
              connectWebSocket();
            }
          }, 3000);
        } else {
          console.log('WebSocket closed normally, not reconnecting');
        }
      };

      wsRef.current = ws;
    } catch (error) {
      console.error('Error creating WebSocket:', error);
      setConnectionStatus('disconnected');
      setIsConnected(false);
      
      // Show error message to user
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setMessages((prev) => {
        const msg: Message = {
          id: generateMessageId(),
          text: `Failed to connect: ${errorMessage}. Please check if the server is running at ${backendUrl}/test_pinecone`,
          isUser: false,
          timestamp: new Date(),
        };
        return [...prev, msg];
      });
      
      // Attempt to reconnect after 5 seconds
      setTimeout(() => {
        if (user?.id) {
          console.log('Retrying WebSocket connection...');
          connectWebSocket();
        }
      }, 5000);
    }
  };

  const disconnectWebSocket = () => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsConnected(false);
    setConnectionStatus('disconnected');
  };


  const playAudioFromBase64 = async (base64: string) => {
    try {
      // Remove data URL prefix if present
      const base64Data = base64.includes(',') ? base64.split(',')[1] : base64;
      
      if (Platform.OS === 'web') {
        // For web, convert to blob URL
        const byteCharacters = atob(base64Data);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: 'audio/mpeg' });
        const audioUrl = URL.createObjectURL(blob);
        await playAudioResponse(audioUrl);
      } else {
        // For mobile, save to file system and play
        const fileUri = `${FileSystem.cacheDirectory}audio_${Date.now()}.mp3`;
        await FileSystem.writeAsStringAsync(fileUri, base64Data, {
          encoding: FileSystem.EncodingType.Base64,
        });
        await playAudioResponse(fileUri);
      }
    } catch (error) {
      console.error('Error playing audio from base64:', error);
      setIsPlaying(false);
    }
  };

  const playAudioResponse = async (audioUrl: string) => {
    try {
      // Stop any currently playing audio
      if (sound) {
        try {
          await sound.unloadAsync();
        } catch (e) {
          console.log('Error unloading previous sound:', e);
        }
        setSound(null);
      }

      setIsPlaying(true);

      // Set audio mode for playback
      if (Platform.OS !== 'web') {
        try {
          await Audio.setAudioModeAsync({
            allowsRecordingIOS: false,
            playsInSilentModeIOS: true,
            staysActiveInBackground: false,
            shouldDuckAndroid: true,
            playThroughEarpieceAndroid: false,
          });
        } catch (e) {
          console.log('Error setting audio mode:', e);
        }
      }

      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: audioUrl },
        { shouldPlay: true }
      );

      setSound(newSound);

      newSound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded) {
          if (status.didJustFinish) {
            setIsPlaying(false);
            newSound.unloadAsync().catch(console.error);
            setSound(null);
          }
        } else if ('error' in status) {
          console.error('Playback error:', status.error);
          setIsPlaying(false);
          setSound(null);
        }
      });
    } catch (error) {
      console.error('Error playing audio response:', error);
      setIsPlaying(false);
      setSound(null);
    }
  };

  const startRecording = async () => {
    if (!isConnected) {
      Alert.alert('Not Connected', 'Please wait for connection to be established');
      return;
    }

    try {
      const permission = await Audio.requestPermissionsAsync();
      if (permission.status !== 'granted') {
        Alert.alert('Permission to access microphone is required!');
        return;
      }

      // Set audio mode for recording
      if (Platform.OS !== 'web') {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
        });
      }

      const { recording: newRecording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );

      setRecording(newRecording);
      setIsRecording(true);
      audioChunksRef.current = [];

      // Add user message indicating recording started
      const recordingMessage: Message = {
        id: generateMessageId(),
        text: '🎤 Recording...',
        isUser: true,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, recordingMessage]);
    } catch (error) {
      console.error('Failed to start recording:', error);
      Alert.alert('Error', 'Failed to start recording');
    }
  };

  const stopRecording = async () => {
    if (!recording) return;

    let recordingUri: string | null = null;
    const currentRecording = recording; // Store reference before clearing state

    try {
      // Get URI before stopping (some platforms require this)
      try {
        recordingUri = currentRecording.getURI();
      } catch (e) {
        // If getURI fails, try after stopping
      }

      // Stop and unload the recording
      await currentRecording.stopAndUnloadAsync();
      
      // Get URI after stopping if we didn't get it before
      if (!recordingUri) {
        recordingUri = currentRecording.getURI();
      }
      
      // Clear recording state immediately to prevent cleanup from trying to unload again
      setRecording(null);
      setIsRecording(false);

      if (!recordingUri) {
        console.error('No recording URI available');
        setMessages((prev) => prev.filter((msg) => msg.text !== '🎤 Recording...'));
        Alert.alert('Error', 'No recording data available');
        return;
      }

      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        console.error('WebSocket not connected');
        setMessages((prev) => prev.filter((msg) => msg.text !== '🎤 Recording...'));
        Alert.alert('Error', 'Cannot send audio. Connection not available.');
        return;
      }

      // Remove "Recording..." message and add "Sending..." message
      setMessages((prev) => {
        const filtered = prev.filter((msg) => msg.text !== '🎤 Recording...');
        const sendingMessage: Message = {
          id: generateMessageId(),
          text: '📤 Sending audio...',
          isUser: true,
          timestamp: new Date(),
        };
        return [...filtered, sendingMessage];
      });

      setIsLoading(true);

      // Read audio file and send via WebSocket
      try {
        // Step 1: Send audio start message
        wsRef.current.send(JSON.stringify({
          type: 'audio',
          user_id: user?.id,
        }));
        
        console.log('Sent audio start message, waiting for ready...');
        
        // Wait a bit for the backend to respond with "ready"
        await new Promise(resolve => setTimeout(resolve, 100));
        
        if (Platform.OS === 'web') {
          // For web, fetch as blob and send as binary chunks
          const response = await fetch(recordingUri);
          if (!response.ok) {
            throw new Error(`Failed to fetch audio: ${response.status}`);
          }
          const blob = await response.blob();
          
          if (!blob || blob.size === 0) {
            throw new Error('Audio blob is empty');
          }
          
          // Convert blob to array buffer and send in chunks
          const arrayBuffer = await blob.arrayBuffer();
          const chunkSize = 8192; // 8KB chunks
          const chunks = [];
          
          for (let i = 0; i < arrayBuffer.byteLength; i += chunkSize) {
            chunks.push(arrayBuffer.slice(i, i + chunkSize));
          }
          
          // Send chunks as binary
          for (const chunk of chunks) {
            wsRef.current.send(chunk);
          }
        } else {
          // For mobile, read file and send as binary chunks
          try {
            const fileInfo = await FileSystem.getInfoAsync(recordingUri);
            if (!fileInfo.exists) {
              throw new Error('Audio file does not exist');
            }
          } catch (fileCheckError: any) {
            console.log('File check warning:', fileCheckError?.message);
          }

          // Read file as base64, convert to binary, and send in chunks
          const base64 = await FileSystem.readAsStringAsync(recordingUri, {
            encoding: FileSystem.EncodingType.Base64,
          });
          
          if (!base64 || base64.length === 0) {
            throw new Error('Audio file is empty');
          }
          
          // Convert base64 to binary
          const binaryString = atob(base64);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          
          // Send in chunks
          const chunkSize = 8192; // 8KB chunks
          for (let i = 0; i < bytes.length; i += chunkSize) {
            const chunk = bytes.slice(i, i + chunkSize);
            wsRef.current.send(chunk.buffer);
          }
        }
        
        // Step 2: Send audio end message
        wsRef.current.send(JSON.stringify({
          type: 'audio_end',
          user_id: user?.id,
        }));
        
        console.log('Sent audio end message');
        
        // After sending audio, also test Pinecone with the transcription
        // This will be done when we receive the transcription from the backend

        // Don't remove "Sending..." message here - let the response handler do it
        // This ensures we keep the message until we get a response
      } catch (error: any) {
        console.error('Error reading audio file:', error);
        setMessages((prev) => {
          const filtered = prev.filter((msg) => msg.text !== '📤 Sending audio...');
          const errorMessage: Message = {
            id: generateMessageId(),
            text: `Error: ${error?.message || 'Failed to send audio'}`,
            isUser: false,
            timestamp: new Date(),
          };
          return [...filtered, errorMessage];
        });
        setIsLoading(false);
        Alert.alert('Error', error?.message || 'Failed to send audio');
      }
    } catch (error: any) {
      console.error('Failed to stop recording:', error);
      setIsRecording(false);
      setIsLoading(false);
      setMessages((prev) => prev.filter((msg) => msg.text !== '🎤 Recording...'));
      Alert.alert('Error', error?.message || 'Failed to process recording');
    }
  };

  const stopPlaying = async () => {
    if (sound) {
      await sound.stopAsync();
      await sound.unloadAsync();
      setSound(null);
      setIsPlaying(false);
    }
  };

  const clearChat = () => {
    if (Platform.OS === 'web') {
      // On web, clear directly without confirmation for better UX
      setMessages([]);
      // Scroll to top after clearing
      setTimeout(() => {
        scrollViewRef.current?.scrollTo({ y: 0, animated: true });
      }, 100);
    } else {
      // On mobile, show confirmation dialog
      Alert.alert(
        'Clear Chat',
        'Are you sure you want to clear all messages?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Clear',
            style: 'destructive',
            onPress: () => {
              setMessages([]);
              // Scroll to top after clearing
              setTimeout(() => {
                scrollViewRef.current?.scrollTo({ y: 0, animated: true });
              }, 100);
            },
          },
        ]
      );
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getConnectionStatusColor = () => {
    switch (connectionStatus) {
      case 'connected':
        return '#4caf50';
      case 'connecting':
        return '#ff9800';
      default:
        return '#f44336';
    }
  };

  const getConnectionStatusText = () => {
    switch (connectionStatus) {
      case 'connected':
        return 'Connected';
      case 'connecting':
        return 'Connecting...';
      default:
        return 'Disconnected';
    }
  };

  return (
    <View style={styles.container}>
      {/* Fixed Header */}
      <SafeAreaView style={styles.safeAreaTop} edges={['top']}>
        <View style={styles.fixedHeader}>
          <View style={styles.headerContent}>
            <View style={styles.headerIcon}>
              <MaterialIcons name="help" size={32} color="#fff" />
            </View>
            <View style={styles.headerTextContainer}>
              <Text style={styles.headerTitle}>Ask Questions to AI</Text>
              <View style={styles.headerSubtitleContainer}>
                <View style={[styles.statusDot, { backgroundColor: getConnectionStatusColor() }]} />
                <Text style={styles.headerSubtitle}>{getConnectionStatusText()}</Text>
              </View>
            </View>
          </View>
        </View>
      </SafeAreaView>

      {/* Scrollable Body */}
      <ScrollView
        ref={scrollViewRef}
        style={styles.scrollableBody}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        {messages.length === 0 ? (
          <View style={styles.emptyStateCard}>
            <MaterialIcons name="mic" size={64} color="#006848" />
            <Text style={styles.emptyStateTitle}>Voice-to-Voice</Text>
            <Text style={styles.emptyStateText}>
              Press and hold the microphone button to ask your academic questions. Get instant voice responses in real-time.
            </Text>
            {!isConnected && (
              <View style={styles.connectionWarning}>
                <MaterialIcons name="warning" size={20} color="#ff9800" />
                <Text style={styles.connectionWarningText}>
                  Waiting for connection...
                </Text>
              </View>
            )}
          </View>
        ) : (
          <>
            <View style={styles.messagesHeaderCard}>
              <View style={styles.messagesHeaderContent}>
                <MaterialIcons name="chat" size={20} color="#006848" />
                <Text style={styles.messagesHeaderText}>Conversation</Text>
              </View>
              <TouchableOpacity onPress={clearChat} style={styles.clearButton}>
                <MaterialIcons name="clear-all" size={20} color="#666" />
                <Text style={styles.clearButtonText}>Clear</Text>
              </TouchableOpacity>
            </View>
            {messages.map((message) => (
              <View
                key={message.id}
                style={[
                  styles.messageCard,
                  message.isUser ? styles.userMessageCard : styles.aiMessageCard,
                ]}>
                <View style={styles.messageHeader}>
                  <MaterialIcons
                    name={message.isUser ? "person" : "smart-toy"}
                    size={18}
                    color={message.isUser ? "#006848" : "#4caf50"}
                  />
                  <Text style={styles.messageHeaderText}>
                    {message.isUser ? "You" : "AI Assistant"}
                  </Text>
                  <Text style={styles.messageTime}>{formatTime(message.timestamp)}</Text>
                </View>
                <Text
                  style={[
                    styles.messageText,
                    message.isUser ? styles.userMessageText : styles.aiMessageText,
                  ]}>
                  {message.text}
                </Text>
              </View>
            ))}
            {isLoading && (
              <View style={[styles.messageCard, styles.aiMessageCard]}>
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="small" color="#006848" />
                  <Text style={[styles.messageText, styles.aiMessageText, { marginLeft: 10 }]}>
                    Processing...
                  </Text>
                </View>
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* Fixed Controls */}
      <SafeAreaView style={styles.safeAreaBottom} edges={['bottom']}>
        <View style={styles.controlsContainer}>
        {isPlaying ? (
          <TouchableOpacity style={styles.stopButton} onPress={stopPlaying}>
            <MaterialIcons name="stop" size={24} color="#fff" />
            <Text style={styles.stopButtonText}>Stop Playback</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[
              styles.recordButton,
              isRecording && styles.recordButtonActive,
              (!isConnected || isLoading) && styles.recordButtonDisabled,
            ]}
            onPressIn={startRecording}
            onPressOut={stopRecording}
            disabled={!isConnected || isLoading}
            activeOpacity={0.8}>
            {isRecording ? (
              <>
                <MaterialIcons name="stop" size={28} color="#fff" />
                <Text style={styles.recordButtonText}>Release to Send</Text>
              </>
            ) : (
              <>
                <MaterialIcons name="mic" size={28} color="#fff" />
                <Text style={styles.recordButtonText}>
                  {!isConnected ? 'Connecting...' : 'Hold to Speak'}
                </Text>
              </>
            )}
          </TouchableOpacity>
        )}
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  safeAreaTop: {
    backgroundColor: '#006848',
  },
  safeAreaBottom: {
    backgroundColor: '#fff',
  },
  // Fixed Header Styles
  fixedHeader: {
    backgroundColor: '#006848',
    paddingTop: Platform.OS === 'ios' ? 10 : 20,
    paddingBottom: 20,
    paddingHorizontal: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  headerTextContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  headerSubtitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#E8F5F0',
    lineHeight: 18,
  },
  headerIcon: {
    marginRight: 16,
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Scrollable Body Styles
  scrollableBody: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 180 : 150, // Extra padding for fixed controls + tab bar
  },
  // Empty State Card
  emptyStateCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 30,
    marginTop: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  emptyStateTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 20,
    marginBottom: 12,
    textAlign: 'center',
  },
  emptyStateText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
  },
  connectionWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 20,
    padding: 12,
    backgroundColor: '#fff3cd',
    borderRadius: 8,
    width: '100%',
  },
  connectionWarningText: {
    color: '#856404',
    fontSize: 14,
    fontWeight: '500',
  },
  // Messages Header
  messagesHeaderCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  messagesHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  messagesHeaderText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    padding: 8,
  },
  clearButtonText: {
    fontSize: 14,
    color: '#666',
  },
  // Message Cards
  messageCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  userMessageCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#006848',
  },
  aiMessageCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#4caf50',
  },
  messageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  messageHeaderText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  messageTime: {
    fontSize: 12,
    color: '#999',
  },
  messageText: {
    fontSize: 16,
    lineHeight: 24,
  },
  userMessageText: {
    color: '#333',
  },
  aiMessageText: {
    color: '#333',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  // Fixed Controls
  controlsContainer: {
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: Platform.OS === 'ios' ? 10 : 10,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  recordButton: {
    backgroundColor: '#006848',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    paddingHorizontal: 32,
    borderRadius: 50,
    width: '100%',
    gap: 12,
    minHeight: 56,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  recordButtonActive: {
    backgroundColor: '#f44336',
  },
  recordButtonDisabled: {
    backgroundColor: '#9e9e9e',
    opacity: 0.7,
  },
  recordButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  stopButton: {
    backgroundColor: '#f44336',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 50,
    width: '100%',
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  stopButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
