import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function CompareScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Compare</Text>
      </View>
      <View style={styles.placeholder}>
        <Text style={styles.placeholderText}>Side-by-side fund comparison</Text>
        <Text style={styles.placeholderSub}>Coming in Milestone 6.</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  title: { fontSize: 24, fontWeight: '700', color: '#111' },
  placeholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  placeholderText: { fontSize: 18, fontWeight: '600', color: '#333' },
  placeholderSub: { fontSize: 14, color: '#999' },
});
