import { MaterialIcons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import { useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRecordings } from '../context/RecordingContext';

export default function App() {
  const params = useLocalSearchParams();
  const { updateRecording, addRecording } = useRecordings();
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [recordedURI, setRecordedURI] = useState<string | null>(null);
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [transcription, setTranscription] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [currentRecordingTitle, setCurrentRecordingTitle] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (params.recordingUri) {
      setRecordedURI(params.recordingUri as string);
      setCurrentRecordingTitle(params.recordingTitle as string);
      sendAudioForTranscription(params.recordingUri as string);
    }
  }, [params.recordingUri, params.recordingTitle]);

  useEffect(() => {
    return () => {
      if (sound) {
        sound.unloadAsync();
      }
    };
  }, [sound]);

  const startRecording = async () => {
    try {
      const permission = await Audio.requestPermissionsAsync();
      if (permission.status !== 'granted') {
        Alert.alert('Permission to access microphone is required!');
        return;
      }

      // Clear previous recording states
      setCurrentRecordingTitle(null);
      setTranscription(null);
      setAnalysis(null);
      setRecordedURI(null);
      if (sound) {
        await sound.unloadAsync();
        setSound(null);
      }
      setIsPlaying(false);

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );

      setRecording(recording);
    } catch (error) {
      console.error('Failed to start recording:', error);
    }
  };

  const stopRecording = async () => {
    try {
      if (!recording) return;

      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setRecordedURI(uri ?? null);
      setRecording(null);

      // Get recording duration
      const status = await recording.getStatusAsync();
      const duration = status.durationMillis ? status.durationMillis / 1000 : 0;

      // Save recording to storage
      if (uri) {
        const recordingId = `rec_${Date.now()}`;
        await addRecording({
          id: recordingId,
          uri,
          duration,
          timestamp: Date.now(),
          title: `Recording ${new Date().toLocaleString()}`,
        });
      }
    } catch (error) {
      console.error('Failed to stop recording:', error);
    }
  };

  const playPauseRecording = async () => {
    if (!sound) {
      if (!recordedURI) return;

      try {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
          shouldDuckAndroid: true,
          playThroughEarpieceAndroid: false,
          interruptionModeAndroid: 1,
          interruptionModeIOS: 1,
        });

        const { sound: newSound } = await Audio.Sound.createAsync(
          { uri: recordedURI },
          { shouldPlay: false }
        );

        setSound(newSound);

        newSound.setOnPlaybackStatusUpdate((status) => {
          if (!status.isLoaded) return;
          setIsPlaying(status.isPlaying);

          if (status.didJustFinish) {
            newSound.unloadAsync();
            setSound(null);
            setIsPlaying(false);
          }
        });

        await newSound.playAsync();
        setIsPlaying(true);
      } catch (error) {
        console.error('Playback failed:', error);
        setIsPlaying(false);
      }
    } else {
      const status = await sound.getStatusAsync();
      if (!status.isLoaded) return;

      if (status.isPlaying) {
        await sound.pauseAsync();
        setIsPlaying(false);
      } else {
        await sound.playAsync();
        setIsPlaying(true);
      }
    }
  };

  const sendAudioForTranscription = async (uri: string) => {
    if (isLoading) return;
    
    try {
      setIsLoading(true);
      setIsSending(true);
      setTranscription(null);
      setAnalysis(null);

      const formData = new FormData();
      formData.append('file', {
        uri: uri,
        type: 'audio/x-m4a',
        name: 'recording.m4a',
      } as any);

      console.log('Sending request to analyze recording...');
      const response = await fetch('http://10.10.117.2:8000/analyze_sales_call', {
        method: 'POST',
        body: formData,
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'multipart/form-data',
        },
      });

      console.log('Response status:', response.status);
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Server error:', errorText);
        throw new Error(`Server error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log('Received analysis data');
      
      if (!data.transcription || !data.analysis) {
        throw new Error('Invalid response format from server');
      }

      setTranscription(data.transcription);
      setAnalysis(data.analysis);
    } catch (error) {
      console.error('Error sending audio:', error);
      Alert.alert(
        'Error',
        'Failed to analyze recording. Please try again.'
      );
    } finally {
      setIsLoading(false);
      setIsSending(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.scrollContainer}>
      <View style={styles.container}>
        <Text style={styles.title}>Savant Sales AI</Text>
        {currentRecordingTitle && (
          <Text style={styles.recordingTitle}>{currentRecordingTitle}</Text>
        )}

        <Pressable
          style={[styles.recordButton, recording ? styles.recording : styles.notRecording]}
          onPress={recording ? stopRecording : startRecording}
        >
          <MaterialIcons name={recording ? 'stop' : 'fiber-manual-record'} size={28} color="#fff" />
          <Text style={styles.buttonText}>{recording ? 'Stop' : 'Record'}</Text>
        </Pressable>

        {recordedURI && (
          <View style={styles.playback}>
            <Pressable style={styles.playButton} onPress={playPauseRecording}>
              <MaterialIcons name={isPlaying ? 'pause' : 'play-arrow'} size={30} color="#fff" />
              <Text style={styles.buttonText}>{isPlaying ? 'Playing...' : 'Play'}</Text>
            </Pressable>

            {!params.recordingUri && (
              <Pressable
                style={[styles.sendButton, isSending ? styles.sending : null]}
                onPress={() => sendAudioForTranscription(recordedURI)}
                disabled={isSending}
              >
                {isSending ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <MaterialIcons name="send" size={24} color="#fff" />
                    <Text style={styles.buttonText}>Send</Text>
                  </>
                )}
              </Pressable>
            )}
          </View>
        )}

        {isLoading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#007AFF" />
            <Text style={styles.loadingText}>Analyzing recording...</Text>
          </View>
        )}

        {analysis && (
          <View style={styles.transcriptionCard}>
            <Text style={styles.summaryTitle}>Summary and Tips</Text>
            <ScrollView style={styles.scrollArea}>
              <Text style={styles.transcriptionText}>{analysis}</Text>
            </ScrollView>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 40,
  },
  recordButton: {
    flexDirection: 'row',
    padding: 14,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    width: 180,
  },
  notRecording: {
    backgroundColor: '#4caf50',
  },
  recording: {
    backgroundColor: '#f44336',
  },
  playButton: {
    flexDirection: 'row',
    backgroundColor: '#2196f3',
    padding: 12,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    width: 180,
    alignSelf: 'center',
  },
  sendButton: {
    flexDirection: 'row',
    backgroundColor: '#673ab7',
    padding: 12,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 15,
    width: 180,
    alignSelf: 'center',
  },
  sending: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    marginLeft: 10,
  },
  playback: {
    marginTop: 30,
    alignItems: 'center',
  },
  transcriptionCard: {
    marginTop: 40,
    backgroundColor: '#f0f4ff',
    padding: 20,
    borderRadius: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
    borderWidth: 1,
    borderColor: '#c0c7ff',
  },
  transcriptionTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 12,
    color: '#3b4cca',
    textAlign: 'center',
  },
  summaryTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 12,
    color: '#009688',
    textAlign: 'center',
  },
  transcriptionText: {
    fontSize: 16,
    color: '#333',
    lineHeight: 24,
    textAlign: 'left',
  },
  scrollContainer: {
    flexGrow: 1,
    paddingBottom: 30,
  },

  scrollArea: {
    maxHeight: 200,
  },
  recordingTitle: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 20,
    color: '#673ab7',
  },
  loadingContainer: {
    marginTop: 20,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#673ab7',
  },
});
