import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';

export default function PDFScreen() {
  const router = useRouter();
  const [picking, setPicking] = useState(false);

  async function handlePickPDF() {
    setPicking(true);
    try {
      // PDF upload will be fully implemented in a future milestone.
      // For now, show an informational alert.
      Alert.alert(
        'PDF Upload',
        'PDF-based CAS import is coming soon. For now, use the email forwarding method to import your transactions automatically.',
        [{ text: 'Got it' }],
      );
    } finally {
      setPicking(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Upload CAS PDF</Text>
      <Text style={styles.subtitle}>
        Upload your Consolidated Account Statement (CAS) PDF directly from CAMS, Karvy, or
        MFcentral.
      </Text>

      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>Supported formats</Text>
        <View style={styles.infoList}>
          <Text style={styles.infoItem}>• CAMS CAS PDF (password-protected)</Text>
          <Text style={styles.infoItem}>• Karvy / KFintech CAS PDF</Text>
          <Text style={styles.infoItem}>• MFcentral CAS PDF</Text>
        </View>
      </View>

      <View style={styles.howCard}>
        <Text style={styles.howTitle}>How to get your CAS</Text>
        <Text style={styles.howStep}>
          <Text style={styles.bold}>CAMS: </Text>
          Visit camsonline.com → My Reports → CAS → choose date range → Download PDF
        </Text>
        <Text style={styles.howStep}>
          <Text style={styles.bold}>Karvy: </Text>
          Visit kfintech.com → MF → CAS → Request → Download PDF
        </Text>
        <Text style={styles.howStep}>
          <Text style={styles.bold}>MFcentral: </Text>
          Visit mfcentral.com → CAS → Download PDF
        </Text>
      </View>

      <TouchableOpacity
        style={[styles.uploadBtn, picking && styles.uploadBtnDisabled]}
        onPress={handlePickPDF}
        disabled={picking}
      >
        {picking ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.uploadBtnText}>Select PDF</Text>
        )}
      </TouchableOpacity>

      <View style={styles.comingSoonCard}>
        <Text style={styles.comingSoonText}>
          PDF parsing is not yet available. Use the{' '}
          <Text style={styles.link} onPress={() => router.back()}>
            email forwarding
          </Text>{' '}
          method for automatic imports.
        </Text>
      </View>

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

  infoCard: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 16,
    gap: 10,
  },
  infoTitle: { fontSize: 14, fontWeight: '700', color: '#111' },
  infoList: { gap: 6 },
  infoItem: { fontSize: 13, color: '#555', lineHeight: 20 },

  howCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 16,
    gap: 10,
  },
  howTitle: { fontSize: 14, fontWeight: '700', color: '#111' },
  howStep: { fontSize: 13, color: '#555', lineHeight: 20 },
  bold: { fontWeight: '700' },

  uploadBtn: {
    backgroundColor: '#1a56db',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
  },
  uploadBtnDisabled: { opacity: 0.6 },
  uploadBtnText: { color: '#fff', fontWeight: '600', fontSize: 15 },

  comingSoonCard: {
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fcd34d',
    borderRadius: 10,
    padding: 14,
  },
  comingSoonText: { fontSize: 13, color: '#78350f', lineHeight: 20 },
  link: { color: '#1a56db', fontWeight: '600' },

  backLink: { alignItems: 'center', paddingVertical: 4 },
  backLinkText: { fontSize: 14, color: '#1a56db' },
});
