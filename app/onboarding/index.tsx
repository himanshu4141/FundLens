import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';

export default function OnboardingScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Import your CAS</Text>
      <Text style={styles.body}>
        Choose how you want to import your Consolidated Account Statement.
      </Text>

      <TouchableOpacity style={styles.option} onPress={() => router.push('/onboarding/qr')}>
        <Text style={styles.optionTitle}>MFcentral QR</Text>
        <Text style={styles.optionSub}>Scan your QR from MFcentral</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.option} onPress={() => router.push('/onboarding/pdf')}>
        <Text style={styles.optionTitle}>Upload PDF</Text>
        <Text style={styles.optionSub}>Upload your CAS PDF directly</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 24, gap: 16 },
  title: { fontSize: 22, fontWeight: '700', color: '#111' },
  body: { fontSize: 15, color: '#666', lineHeight: 22 },
  option: {
    padding: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    gap: 4,
  },
  optionTitle: { fontSize: 16, fontWeight: '600', color: '#111' },
  optionSub: { fontSize: 13, color: '#888' },
});
