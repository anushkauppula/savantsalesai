import { Audio } from 'expo-av';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, Modal, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { ThemedText } from '../../components/ThemedText';
import { ThemedView } from '../../components/ThemedView';
import { IconSymbol } from '../../components/ui/IconSymbol';
import { useRecordings } from '../context/RecordingContext';
import { Recording } from '../types/recording';

interface RecordingItemProps {
  recording: Recording;
}

export function RecordingItem({ recording }: RecordingItemProps) {
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [newTitle, setNewTitle] = useState(recording.title);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const { deleteRecording, updateRecording } = useRecordings();

  useEffect(() => {
    return sound
      ? () => {
          sound.unloadAsync();
        }
      : undefined;
  }, [sound]);

  const playRecording = async () => {
    try {
      if (sound) {
        if (isPlaying) {
          await sound.pauseAsync();
          setIsPlaying(false);
        } else {
          await sound.playAsync();
          setIsPlaying(true);
        }
      } else {
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
          { uri: recording.uri },
          { shouldPlay: true }
        );
        setSound(newSound);
        setIsPlaying(true);

        newSound.setOnPlaybackStatusUpdate((status) => {
          if (!status.isLoaded) return;
          setIsPlaying(status.isPlaying);

          if (status.didJustFinish) {
            newSound.unloadAsync();
            setSound(null);
            setIsPlaying(false);
          }
        });
      }
    } catch (error) {
      console.error('Error playing recording:', error);
      Alert.alert('Error', 'Failed to play recording');
    }
  };

  const handleDelete = async () => {
    try {
      if (sound) {
        await sound.unloadAsync();
      }
      await deleteRecording(recording.id);
    } catch (error) {
      console.error('Error deleting recording:', error);
    }
  };

  const handleAnalyze = async () => {
    if (isAnalyzing) return;
    
    try {
      setIsAnalyzing(true);
      // Navigate to index page with recording info
      router.push({
        pathname: '/',
        params: { 
          recordingId: recording.id,
          recordingTitle: recording.title,
          recordingUri: recording.uri
        }
      });
    } catch (error) {
      console.error('Error analyzing recording:', error);
      Alert.alert('Error', 'Failed to analyze recording');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleRename = async () => {
    if (!newTitle.trim()) {
      Alert.alert('Error', 'Title cannot be empty');
      return;
    }
    try {
      await updateRecording(recording.id, { title: newTitle.trim() });
      setIsEditing(false);
    } catch (error) {
      console.error('Error renaming recording:', error);
      Alert.alert('Error', 'Failed to rename recording');
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString();
  };

  return (
    <>
      <ThemedView style={styles.container}>
        <TouchableOpacity 
          style={styles.infoContainer} 
          onPress={handleAnalyze}
          disabled={isAnalyzing}
        >
          <ThemedText type="defaultSemiBold" style={styles.titleText}>{recording.title}</ThemedText>
          <ThemedText style={styles.dateText}>{formatDate(recording.timestamp)}</ThemedText>
        </TouchableOpacity>
        <View style={styles.controlsContainer}>
          <TouchableOpacity onPress={playRecording} style={styles.button}>
            <IconSymbol
              name={isPlaying ? 'pause.fill' : 'play.fill'}
              size={24}
              color="#fff"
            />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setIsEditing(true)} style={styles.button}>
            <IconSymbol name="pencil" size={24} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleDelete} style={styles.button}>
            <IconSymbol name="trash.fill" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      </ThemedView>

      <Modal
        visible={isEditing}
        transparent
        animationType="fade"
        onRequestClose={() => setIsEditing(false)}
      >
        <View style={styles.modalOverlay}>
          <ThemedView style={styles.modalContent}>
            <ThemedText type="defaultSemiBold" style={styles.modalTitle}>Rename Recording</ThemedText>
            <TextInput
              style={styles.input}
              value={newTitle}
              onChangeText={setNewTitle}
              placeholder="Enter new title"
              placeholderTextColor="#666"
              autoFocus
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={[styles.modalButton, styles.cancelButton]} 
                onPress={() => {
                  setNewTitle(recording.title);
                  setIsEditing(false);
                }}
              >
                <ThemedText style={styles.buttonText}>Cancel</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalButton, styles.saveButton]} 
                onPress={handleRename}
              >
                <ThemedText style={styles.buttonText}>Save</ThemedText>
              </TouchableOpacity>
            </View>
          </ThemedView>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    padding: 16,
    marginVertical: 8,
    borderRadius: 12,
    justifyContent: 'space-between',
    backgroundColor: '#009688',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  infoContainer: {
    flex: 1,
    marginRight: 16,
  },
  titleText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  dateText: {
    color: '#fff',
    opacity: 0.9,
    fontSize: 14,
    marginBottom: 2,
  },
  controlsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  button: {
    padding: 8,
    marginLeft: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '85%',
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  modalTitle: {
    fontSize: 20,
    marginBottom: 20,
    color: '#000',
    fontWeight: '700',
    textAlign: 'center',
  },
  input: {
    width: '100%',
    height: 44,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 10,
    paddingHorizontal: 16,
    marginBottom: 24,
    color: '#000',
    backgroundColor: '#fff',
    fontSize: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: '#FF3B30',
  },
  saveButton: {
    backgroundColor: '#34C759',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
}); 