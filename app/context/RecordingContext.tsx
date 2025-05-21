import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { Recording, RecordingContextType } from '../types/recording';

const RecordingContext = createContext<RecordingContextType | undefined>(undefined);

const STORAGE_KEY = '@recordings';

export function RecordingProvider({ children }: { children: React.ReactNode }) {
  const [recordings, setRecordings] = useState<Recording[]>([]);

  useEffect(() => {
    loadRecordings();
  }, []);

  const loadRecordings = async () => {
    try {
      const storedRecordings = await AsyncStorage.getItem(STORAGE_KEY);
      if (storedRecordings) {
        setRecordings(JSON.parse(storedRecordings));
      }
    } catch (error) {
      console.error('Error loading recordings:', error);
    }
  };

  const addRecording = async (recording: Recording) => {
    try {
      const updatedRecordings = [...recordings, recording];
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updatedRecordings));
      setRecordings(updatedRecordings);
    } catch (error) {
      console.error('Error adding recording:', error);
    }
  };

  const deleteRecording = async (id: string) => {
    try {
      const updatedRecordings = recordings.filter(recording => recording.id !== id);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updatedRecordings));
      setRecordings(updatedRecordings);
    } catch (error) {
      console.error('Error deleting recording:', error);
    }
  };

  const updateRecording = async (id: string, updates: Partial<Recording>) => {
    try {
      const updatedRecordings = recordings.map(recording =>
        recording.id === id ? { ...recording, ...updates } : recording
      );
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updatedRecordings));
      setRecordings(updatedRecordings);
    } catch (error) {
      console.error('Error updating recording:', error);
    }
  };

  const getRecording = (id: string) => {
    return recordings.find(recording => recording.id === id);
  };

  return (
    <RecordingContext.Provider
      value={{
        recordings,
        addRecording,
        deleteRecording,
        updateRecording,
        getRecording,
      }}>
      {children}
    </RecordingContext.Provider>
  );
}

export function useRecordings() {
  const context = useContext(RecordingContext);
  if (context === undefined) {
    throw new Error('useRecordings must be used within a RecordingProvider');
  }
  return context;
} 