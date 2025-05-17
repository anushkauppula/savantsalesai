import { MaterialIcons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

export default function App() {
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [recordedURI, setRecordedURI] = useState<string | null>(null);
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [transcription, setTranscription] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<string | null>(null); // New state

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

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );

      setRecording(recording);
      setTranscription(null);
      setAnalysis(null); // Clear previous analysis
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

  const sendAudioForTranscription = async () => {
    if (!recordedURI) return;

    try {
      setIsSending(true);
      setTranscription(null);
      setAnalysis(null);

      const fileInfo = await FileSystem.getInfoAsync(recordedURI);
      if (!fileInfo.exists) throw new Error("File does not exist");

      const formData = new FormData();
      formData.append('file', {
        uri: recordedURI,
        name: 'recording.m4a',
        type: 'audio/x-m4a',
      } as any);

      const backendURL = 'http://192.168.1.159:8000/analyze_sales_call';

      const res = await fetch(backendURL, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Server error: ${res.status} - ${errText}`);
      }

      const data = await res.json();
      setTranscription(data.transcription);
      setAnalysis(data.analysis); // Set coaching summary
    } catch (error: any) {
      console.log(JSON.stringify(error, Object.getOwnPropertyNames(error)));
      Alert.alert(
        'Error Sending Audio',
        error.message || 'Unknown error occurred. See logs for more info.'
      );
    } finally {
      setIsSending(false);
    }
  };

  return (
  <ScrollView contentContainerStyle={styles.scrollContainer}>
    <View style={styles.container}>
      <Text style={styles.title}>Savant Sales AI</Text>

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

          <Pressable
            style={[styles.sendButton, isSending ? styles.sending : null]}
            onPress={sendAudioForTranscription}
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
        </View>
      )}

      {/* {transcription && (
        <View style={styles.transcriptionCard}>
          <Text style={styles.transcriptionTitle}>Transcription</Text>
          <ScrollView style={styles.scrollArea}>
            <Text style={styles.transcriptionText}>{transcription}</Text>
          </ScrollView>
        </View>
      )} */}

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
});
