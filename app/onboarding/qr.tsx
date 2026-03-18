import { View, Text, StyleSheet, TouchableOpacity, Linking, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';

const STEPS = [
  {
    num: 1,
    title: 'Open MFcentral app',
    desc: 'Download the MFcentral app from Play Store / App Store and log in with your PAN.',
  },
  {
    num: 2,
    title: 'Go to CAS section',
    desc: 'In the app, tap on "CAS" or "Consolidated Account Statement" from the home screen or menu.',
  },
  {
    num: 3,
    title: 'Generate QR code',
    desc: 'Select the date range for your statement and tap "Generate QR". A QR code with your portfolio data will appear.',
  },
  {
    num: 4,
    title: 'Come back here and scan',
    desc: 'Once you have the QR code on screen, use the scanner below to import your transactions automatically.',
  },
];

export default function QRScreen() {
  const router = useRouter();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>MFcentral QR Import</Text>
      <Text style={styles.subtitle}>
        Import your mutual fund transactions directly from MFcentral using their QR-based CAS
        export.
      </Text>

      <View style={styles.stepsCard}>
        {STEPS.map((step) => (
          <View key={step.num} style={styles.step}>
            <View style={styles.stepNum}>
              <Text style={styles.stepNumText}>{step.num}</Text>
            </View>
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>{step.title}</Text>
              <Text style={styles.stepDesc}>{step.desc}</Text>
            </View>
          </View>
        ))}
      </View>

      <View style={styles.noteCard}>
        <Text style={styles.noteTitle}>Coming soon</Text>
        <Text style={styles.noteDesc}>
          In-app QR scanning is not yet available. Once released, a camera scanner will appear here
          to read your MFcentral QR code directly.
        </Text>
      </View>

      <TouchableOpacity
        style={styles.altBtn}
        onPress={() => Linking.openURL('https://mfcentral.com')}
      >
        <Text style={styles.altBtnText}>Open MFcentral website</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.backLink} onPress={() => router.back()}>
        <Text style={styles.backLinkText}>← Back to import options</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 20, gap: 16, paddingBottom: 40 },
  title: { fontSize: 22, fontWeight: '700', color: '#111', marginBottom: 6 },
  subtitle: { fontSize: 14, color: '#666', lineHeight: 21 },

  stepsCard: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 16,
    gap: 16,
  },
  step: { flexDirection: 'row', gap: 12 },
  stepNum: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#1a56db',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginTop: 2,
  },
  stepNumText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  stepContent: { flex: 1, gap: 4 },
  stepTitle: { fontSize: 14, fontWeight: '600', color: '#111' },
  stepDesc: { fontSize: 13, color: '#555', lineHeight: 20 },

  noteCard: {
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fcd34d',
    borderRadius: 10,
    padding: 14,
    gap: 6,
  },
  noteTitle: { fontSize: 13, fontWeight: '700', color: '#92400e' },
  noteDesc: { fontSize: 13, color: '#78350f', lineHeight: 20 },

  altBtn: {
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  altBtnText: { fontSize: 14, fontWeight: '600', color: '#334155' },

  backLink: { alignItems: 'center', paddingVertical: 4 },
  backLinkText: { fontSize: 14, color: '#1a56db' },
});
