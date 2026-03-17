import { View, Text, StyleSheet } from 'react-native';

export default function QRScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>MFcentral QR Import</Text>
      <Text style={styles.body}>Coming in Milestone 3.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 24, gap: 12 },
  title: { fontSize: 20, fontWeight: '700', color: '#111' },
  body: { fontSize: 15, color: '#666' },
});
