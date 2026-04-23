import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as DocumentPicker from 'expo-document-picker';
import { useRouter } from 'expo-router';
import { supabase } from '@/src/lib/supabase';
import Logo from '@/src/components/Logo';
import { Colors, Radii, Spacing, Typography } from '@/src/constants/theme';

type UploadState = 'idle' | 'picking' | 'uploading' | 'success' | 'error';

export default function PDFScreen() {
  const router = useRouter();
  const [state, setState] = useState<UploadState>('idle');
  const [result, setResult] = useState<{ funds: number; transactions: number } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  function goBackToImportOptions() {
    router.replace('/onboarding');
  }

  async function handlePickAndUpload() {
    setState('picking');
    setErrorMsg(null);
    setResult(null);

    let picked: DocumentPicker.DocumentPickerResult;
    try {
      picked = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
      });
    } catch {
      setState('idle');
      return;
    }

    if (picked.canceled || !picked.assets?.[0]) {
      setState('idle');
      return;
    }

    const asset = picked.assets[0];
    setState('uploading');

    try {
      const readViaXHR = async () =>
        new Promise<ArrayBuffer>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open('GET', asset.uri);
          xhr.responseType = 'arraybuffer';
          xhr.onload = () => {
            // XHR status is 0 for local file:// reads (no HTTP status)
            if (xhr.status === 0 || (xhr.status >= 200 && xhr.status < 300)) {
              resolve(xhr.response as ArrayBuffer);
            } else {
              reject(new Error(`Failed to read file (status ${xhr.status})`));
            }
          };
          xhr.onerror = () => reject(new Error('XHR read failed'));
          xhr.send();
        });

      const readViaFetch = async () => {
        const res = await fetch(asset.uri);
        if (!res.ok) {
          throw new Error(`Fetch read failed (status ${res.status})`);
        }
        return res.arrayBuffer();
      };

      const pdfBytes = await (async () => {
        if (asset.file && typeof asset.file.arrayBuffer === 'function') {
          return asset.file.arrayBuffer();
        }

        try {
          return await readViaXHR();
        } catch {
          return readViaFetch();
        }
      })();

      if (pdfBytes.byteLength === 0) {
        throw new Error('Selected PDF file is empty');
      }

      const { data, error } = await supabase.functions.invoke('parse-cas-pdf', {
        method: 'POST',
        body: pdfBytes,
        headers: {
          'Content-Type': 'application/octet-stream',
          'x-file-name': asset.name ?? 'cas.pdf',
        },
      });

      if (error) throw new Error(error.message);

      setResult({ funds: data.funds, transactions: data.transactions });
      setState('success');
    } catch (err) {
      const raw = err instanceof Error ? err.message : 'Unknown error';
      const msg = /read/i.test(raw)
        ? 'Could not read the PDF file. Please re-download it and try again.'
        : raw;
      setErrorMsg(msg);
      setState('error');
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <LinearGradient colors={Colors.gradientHeader} style={styles.hero}>
        <Logo size={44} showWordmark light />
        <View style={styles.heroCopy}>
          <Text style={styles.title}>Upload a CAS PDF</Text>
          <Text style={styles.subtitle}>
            Use this when you already downloaded your statement and want to import it directly.
          </Text>
        </View>
      </LinearGradient>

      <View style={styles.panel}>
        <Text style={styles.sectionLabel}>Supported PDFs</Text>
        <Text style={styles.infoTitle}>Detailed CAS statements we can import</Text>
        <Text style={styles.infoItem}>• CAMS CAS (password = your PAN)</Text>
        <Text style={styles.infoItem}>• KFintech / Karvy CAS (password = your PAN)</Text>
        <Text style={styles.infoItem}>• MFcentral CAS (password = your PAN)</Text>
      </View>

      <View style={styles.panel}>
        <Text style={styles.sectionLabel}>Get the file</Text>
        <Text style={styles.howTitle}>Download your CAS from the source</Text>
        <Text style={styles.howStep}>
          <Text style={styles.bold}>CAMS: </Text>
          camsonline.com → Statements → CAS → Detailed → Download PDF
        </Text>
        <Text style={styles.howStep}>
          <Text style={styles.bold}>KFintech: </Text>
          kfintech.com → MF → CAS → Request → Download PDF
        </Text>
        <Text style={styles.howStep}>
          <Text style={styles.bold}>MFcentral: </Text>
          mfcentral.com → CAS → Detailed → Download PDF
        </Text>
      </View>

      <View style={styles.panNote}>
        <Text style={styles.panNoteText}>
          Make sure your PAN is saved in import settings first. We use it as the PDF password.
        </Text>
      </View>

      {state === 'success' && result && (
        <View style={styles.successCard}>
          <Text style={styles.successTitle}>Import complete</Text>
          <Text style={styles.successText}>
            {result.funds} fund{result.funds !== 1 ? 's' : ''} ·{' '}
            {result.transactions} transaction{result.transactions !== 1 ? 's' : ''} imported
          </Text>
          <TouchableOpacity style={styles.doneBtn} onPress={goBackToImportOptions}>
            <Text style={styles.doneBtnText}>Back to import setup</Text>
          </TouchableOpacity>
        </View>
      )}

      {state === 'error' && errorMsg && (
        <View style={styles.errorCard}>
          <Text style={styles.errorTitle}>Import failed</Text>
          <Text style={styles.errorText}>{errorMsg}</Text>
        </View>
      )}

      {state !== 'success' && (
        <TouchableOpacity
          style={[
            styles.uploadBtn,
            (state === 'picking' || state === 'uploading') && styles.uploadBtnDisabled,
          ]}
          onPress={handlePickAndUpload}
          disabled={state === 'picking' || state === 'uploading'}
        >
          {state === 'uploading' ? (
            <>
              <ActivityIndicator color="#fff" style={{ marginRight: 8 }} />
              <Text style={styles.uploadBtnText}>Importing PDF…</Text>
            </>
          ) : (
            <Text style={styles.uploadBtnText}>
              {state === 'error' ? 'Try again' : 'Choose PDF'}
            </Text>
          )}
        </TouchableOpacity>
      )}

      <TouchableOpacity style={styles.backLink} onPress={goBackToImportOptions}>
        <Text style={styles.backLinkText}>Back to import options</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { paddingBottom: Spacing.xxl, gap: Spacing.md },
  hero: {
    paddingTop: 56,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xl + Spacing.sm,
    gap: Spacing.lg,
  },
  heroCopy: { gap: Spacing.sm },
  title: { ...Typography.h1, color: Colors.textOnDark, fontWeight: '700' },
  subtitle: { ...Typography.body, color: 'rgba(255,255,255,0.8)' },

  panel: {
    marginHorizontal: Spacing.lg,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radii.lg,
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  sectionLabel: {
    ...Typography.label,
    color: Colors.primary,
    textTransform: 'uppercase',
  },
  infoTitle: { ...Typography.h3, color: Colors.textPrimary, fontWeight: '700' },
  infoItem: { ...Typography.bodySmall, color: Colors.textSecondary },

  howTitle: { ...Typography.h3, color: Colors.textPrimary, fontWeight: '700' },
  howStep: { ...Typography.bodySmall, color: Colors.textSecondary },
  bold: { fontWeight: '700' },

  panNote: {
    marginHorizontal: Spacing.lg,
    backgroundColor: Colors.primaryLight, borderWidth: 1, borderColor: '#c7eadf',
    borderRadius: Radii.lg, padding: 14,
  },
  panNoteText: { ...Typography.bodySmall, color: Colors.primaryDark },

  successCard: {
    marginHorizontal: Spacing.lg,
    backgroundColor: Colors.primaryLight, borderWidth: 1, borderColor: '#c7eadf',
    borderRadius: Radii.lg, padding: Spacing.lg, gap: Spacing.sm, alignItems: 'center',
  },
  successTitle: { ...Typography.h3, color: Colors.primaryDark },
  successText: { ...Typography.body, color: Colors.primaryDark, textAlign: 'center' },
  doneBtn: {
    backgroundColor: Colors.primary, borderRadius: Radii.lg,
    paddingVertical: 10, paddingHorizontal: 24, marginTop: 4,
  },
  doneBtnText: { color: Colors.textOnDark, fontWeight: '700', fontSize: 14 },

  errorCard: {
    marginHorizontal: Spacing.lg,
    backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fecaca',
    borderRadius: Radii.lg, padding: 14, gap: 6,
  },
  errorTitle: { fontSize: 14, fontWeight: '700', color: '#991b1b' },
  errorText: { ...Typography.bodySmall, color: '#b91c1c' },

  uploadBtn: {
    marginHorizontal: Spacing.lg,
    backgroundColor: Colors.primary, borderRadius: Radii.lg, paddingVertical: 14,
    alignItems: 'center', flexDirection: 'row', justifyContent: 'center',
  },
  uploadBtnDisabled: { opacity: 0.6 },
  uploadBtnText: { color: Colors.textOnDark, fontWeight: '700', fontSize: 15 },

  backLink: { alignItems: 'center', paddingVertical: 4 },
  backLinkText: { fontSize: 14, color: Colors.primary, fontWeight: '600' },
});
