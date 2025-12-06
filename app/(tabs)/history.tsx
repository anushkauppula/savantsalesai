import { MaterialIcons } from '@expo/vector-icons';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { FlatList } from 'react-native-gesture-handler';
import { RecordingItem } from '../components/RecordingItem';
import { useRecordings } from '../context/RecordingContext';

export default function HistoryScreen() {
  const { recordings } = useRecordings();

  return (
    <View style={styles.container}>
      {/* Fixed Header */}
      <View style={styles.fixedHeader}>
        <View style={styles.headerContent}>
          <View style={styles.headerIcon}>
            <MaterialIcons name="history" size={32} color="#fff" />
          </View>
          <View style={styles.headerTextContainer}>
            <Text style={styles.headerTitle}>Recording History</Text>
            <Text style={styles.headerSubtitle}>{recordings.length} recordings saved</Text>
          </View>
        </View>
      </View>

      {/* Scrollable Body */}
      <ScrollView 
        style={styles.scrollableBody}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {recordings.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconContainer}>
              <MaterialIcons name="mic-off" size={64} color="#006848" />
            </View>
            <Text style={styles.emptyTitle}>No Recordings Yet</Text>
            <Text style={styles.emptyDescription}>
              Start recording your academic calls to see them appear here. Your recordings will be saved automatically.
            </Text>
          </View>
        ) : (
          <View style={styles.recordingsContainer}>
            <FlatList
              data={recordings}
              keyExtractor={(item) => item.id}
              renderItem={({ item, index }) => <RecordingItem recording={item} index={index} />}
              scrollEnabled={false}
              showsVerticalScrollIndicator={false}
            />
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  // Fixed Header Styles
  fixedHeader: {
    backgroundColor: '#006848',
    paddingTop: 60,
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
  headerSubtitle: {
    fontSize: 14,
    color: '#E8F5F0',
    lineHeight: 18,
  },
  headerIcon: {
    marginRight: 16,
  },
  // Scrollable Body Styles
  scrollableBody: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 100, // Extra space for tab bar
  },
  // Empty State
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#E8F5F0',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
    textAlign: 'center',
  },
  emptyDescription: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 20,
  },
  // Recordings Container
  recordingsContainer: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
});
