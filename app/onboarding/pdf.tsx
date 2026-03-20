import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { useRouter } from 'expo-router';
import { supabase } from '@/src/lib/supabase';
import { Colors, Spacing, Radii, Typography } from '@/src/constants/theme';

type UploadState = 'idle' | 'picking' | 'uploading' | 'success' | 'error';

export default function PDFScreen() {
  const router = useRouter();
  const [state, setState] = useState<UploadState>('idle');
  const [result, setResult] = useState<{ funds: number; transactions: number } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

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
      // Get session explicitly — supabase.functions.invoke + FormData can silently
      // drop the Authorization header on some platforms.
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('You are not signed in. Please sign in and try again.');
      }

      const form = new FormData();
      form.append('file', {
        uri: asset.uri,
        name: asset.name ?? 'cas.pdf',
        type: 'application/pdf',
      } as unknown as Blob);

      const fnUrl = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/parse-cas-pdf`;
      const resp = await fetch(fnUrl, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: form,
      });

      type FnResponse = { ok?: boolean; funds?: number; transactions?: number; error?: string };
      const json = await resp.json() as FnResponse;

      if (!resp.ok) {
        throw new Error(json?.error ?? 'Failed to import PDF. Please try again.');
      }

      setResult({ funds: json.funds ?? 0, transactions: json.transactions ?? 0 });
      setState('success');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to import PDF. Please try again.';
      setErrorMsg(msg);
      setState('error');
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Upload CAS PDF</Text>
      <Text style={styles.subtitle}>
        Upload your Consolidated Account Statement PDF to import all your mutual fund transactions
        at once.
      </Text>

      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>Supported PDFs</Text>
        <Text style={styles.infoItem}>• CAMS CAS (password = your PAN)</Text>
        <Text style={styles.infoItem}>• KFintech / Karvy CAS (password = your PAN)</Text>
        <Text style={styles.infoItem}>• MFcentral CAS (password = your PAN)</Text>
      </View>

      <View style={styles.howCard}>
        <Text style={styles.howTitle}>How to get your CAS PDF</Text>
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
          Make sure your PAN is saved in the import settings (step 1 on the previous screen) —
          it is used as the PDF password.
        </Text>
      </View>

      {state === 'success' && result && (
        <View style={styles.successCard}>
          <Text style={styles.successTitle}>Import complete</Text>
          <Text style={styles.successText}>
            {result.funds} fund{result.funds !== 1 ? 's' : ''} ·{' '}
            {result.transactions} transaction{result.transactions !== 1 ? 's' : ''} imported
          </Text>
          <TouchableOpacity style={styles.doneBtn} onPress={() => router.back()}>
            <Text style={styles.doneBtnText}>Go to Home</Text>
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
              <Text style={styles.uploadBtnText}>Parsing PDF…</Text>
            </>
          ) : (
            <Text style={styles.uploadBtnText}>
              {state === 'error' ? 'Try again' : 'Select PDF'}
            </Text>
          )}
        </TouchableOpacity>
      )}

      <TouchableOpacity style={styles.backLink} onPress={() => router.back()}>
        <Text style={styles.backLinkText}>← Back to import options</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.lg, gap: Spacing.md, paddingBottom: 40 },
  title: { ...Typography.h1, color: Colors.textPrimary, marginBottom: 2 },
  subtitle: { ...Typography.body, color: Colors.textSecondary, lineHeight: 21 },

  infoCard: {
    borderWidth: 1, borderColor: Colors.border, borderRadius: Radii.md, padding: Spacing.md, gap: 6,
  },
  infoTitle: { ...Typography.bodySmall, fontWeight: '700', color: Colors.textPrimary, marginBottom: 4 },
  infoItem: { ...Typography.bodySmall, color: Colors.textSecondary, lineHeight: 20 },

  howCard: { backgroundColor: Colors.surfaceAlt, borderRadius: Radii.md, padding: Spacing.md, gap: 8 },
  howTitle: { ...Typography.bodySmall, fontWeight: '700', color: Colors.textPrimary },
  howStep: { ...Typography.bodySmall, color: Colors.textSecondary, lineHeight: 20 },
  bold: { fontWeight: '700' },

  panNote: {
    backgroundColor: Colors.primaryLight,
    borderWidth: 1,
    borderColor: Colors.primary + '33',
    borderRadius: Radii.sm,
    padding: Spacing.md,
  },
  panNoteText: { ...Typography.bodySmall, color: Colors.primaryDark, lineHeight: 20 },

  successCard: {
    backgroundColor: '#f0fdf4', borderWidth: 1, borderColor: '#bbf7d0',
    borderRadius: Radii.md, padding: Spacing.md, gap: 8, alignItems: 'center',
  },
  successTitle: { fontSize: 16, fontWeight: '700', color: '#166534' },
  successText: { ...Typography.body, color: Colors.positive },
  doneBtn: {
    backgroundColor: Colors.positive, borderRadius: Radii.sm,
    paddingVertical: 10, paddingHorizontal: 24, marginTop: 4,
  },
  doneBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },

  errorCard: {
    backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fecaca',
    borderRadius: Radii.sm, padding: Spacing.md, gap: 6,
  },
  errorTitle: { fontSize: 14, fontWeight: '700', color: '#991b1b' },
  errorText: { ...Typography.bodySmall, color: '#b91c1c', lineHeight: 20 },

  uploadBtn: {
    backgroundColor: Colors.primary, borderRadius: Radii.md, paddingVertical: 14,
    alignItems: 'center', flexDirection: 'row', justifyContent: 'center',
  },
  uploadBtnDisabled: { opacity: 0.6 },
  uploadBtnText: { color: Colors.textOnDark, fontWeight: '600', fontSize: 15 },

  backLink: { alignItems: 'center', paddingVertical: 4 },
  backLinkText: { ...Typography.bodySmall, color: Colors.primary },
});
