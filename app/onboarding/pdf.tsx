import { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Platform,
  TextInput,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as DocumentPicker from 'expo-document-picker';
import {
  FileSystemUploadType,
  getInfoAsync,
  uploadAsync,
} from 'expo-file-system/legacy';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/src/lib/supabase';
import { useSession } from '@/src/hooks/useSession';
import Logo from '@/src/components/Logo';
import { FundLensLogo } from '@/src/components/clearLens/FundLensLogo';
import { Radii, Spacing, Typography } from '@/src/constants/theme';
import { useTheme, type AppColors } from '@/src/context/ThemeContext';
import { useAppDesignMode } from '@/src/hooks/useAppDesignMode';
import {
  ClearLensRadii,
  ClearLensShadow,
  ClearLensSpacing,
  ClearLensTypography,
} from '@/src/constants/clearLensTheme';

type UploadState = 'idle' | 'picking' | 'uploading' | 'success' | 'error';
type UploadResult = { funds: number; transactions: number };
type UploadResponse = { funds?: number; transactions?: number; error?: string };

function getParseCasPdfUrl() {
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) throw new Error('Supabase URL is not configured.');
  return `${supabaseUrl}/functions/v1/parse-cas-pdf`;
}

function getUploadHeaders(
  token: string,
  fileName: string,
  customPassword?: string,
): Record<string, string> {
  const publishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!publishableKey) throw new Error('Supabase publishable key is not configured.');

  return {
    Authorization: `Bearer ${token}`,
    apikey: publishableKey,
    'Content-Type': 'application/octet-stream',
    'x-file-name': fileName,
    ...(customPassword ? { 'x-password-override': customPassword } : {}),
  };
}

function parseUploadResponse(status: number, bodyText: string): UploadResult {
  let body: UploadResponse = {};
  try {
    body = bodyText ? JSON.parse(bodyText) as UploadResponse : {};
  } catch {
    throw new Error(`Import failed (${status})`);
  }

  if (status >= 200 && status < 300) {
    return { funds: body.funds ?? 0, transactions: body.transactions ?? 0 };
  }

  throw new Error(body.error ?? `Import failed (${status})`);
}

async function readWebPdfBytes(asset: DocumentPicker.DocumentPickerAsset) {
  if (asset.file && typeof asset.file.arrayBuffer === 'function') {
    return asset.file.arrayBuffer();
  }

  try {
    const res = await fetch(asset.uri);
    if (!res.ok) {
      throw new Error(`Fetch read failed (status ${res.status})`);
    }
    return res.arrayBuffer();
  } catch (err) {
    throw new Error(`File read failed: ${err instanceof Error ? err.message : err}`);
  }
}

async function uploadWebPdf(
  asset: DocumentPicker.DocumentPickerAsset,
  url: string,
  headers: Record<string, string>,
) {
  const pdfBytes = await readWebPdfBytes(asset);
  if (pdfBytes.byteLength === 0) {
    throw new Error('Selected PDF file is empty');
  }

  return new Promise<UploadResult>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url);
    Object.entries(headers).forEach(([key, value]) => xhr.setRequestHeader(key, value));
    xhr.responseType = 'text';
    xhr.onload = () => {
      try {
        resolve(parseUploadResponse(xhr.status, xhr.responseText));
      } catch (err) {
        reject(err);
      }
    };
    xhr.onerror = () => reject(new Error('Upload failed - could not reach server'));
    xhr.send(pdfBytes);
  });
}

async function uploadNativePdf(
  asset: DocumentPicker.DocumentPickerAsset,
  url: string,
  headers: Record<string, string>,
) {
  const info = await getInfoAsync(asset.uri);
  if (!info.exists || info.isDirectory) {
    throw new Error('File read failed: selected PDF is not available');
  }
  if (info.size === 0) {
    throw new Error('Selected PDF file is empty');
  }

  const response = await uploadAsync(url, asset.uri, {
    httpMethod: 'POST',
    uploadType: FileSystemUploadType.BINARY_CONTENT,
    headers,
  });

  return parseUploadResponse(response.status, response.body);
}

export default function PDFScreen() {
  const router = useRouter();
  const { session } = useSession();
  const { colors: Colors } = useTheme();
  const { isClearLens } = useAppDesignMode();
  const styles = useMemo(() => makeStyles(Colors, isClearLens), [Colors, isClearLens]);
  const [state, setState] = useState<UploadState>('idle');
  const [result, setResult] = useState<{ funds: number; transactions: number } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [customPassword, setCustomPassword] = useState('');

  const { data: profile } = useQuery({
    queryKey: ['user-profile', session?.user.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('user_profile')
        .select('dob')
        .eq('user_id', session!.user.id)
        .maybeSingle();
      return data ?? null;
    },
    enabled: !!session?.user.id,
  });

  const dobMissing = !profile?.dob;

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
        base64: false,
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
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) throw new Error('Session expired. Please sign in again.');

      const fnUrl = getParseCasPdfUrl();
      const headers = getUploadHeaders(token, asset.name ?? 'cas.pdf', customPassword.trim() || undefined);
      const uploadResult = Platform.OS === 'web'
        ? await uploadWebPdf(asset, fnUrl, headers)
        : await uploadNativePdf(asset, fnUrl, headers);

      setResult({ funds: uploadResult.funds, transactions: uploadResult.transactions });
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
      {isClearLens ? (
        <View style={[styles.hero, styles.heroClearLens]}>
          <FundLensLogo size={44} showWordmark showTagline />
          <View style={styles.heroCopy}>
            <Text style={styles.title}>Upload a CAS PDF</Text>
            <Text style={styles.subtitle}>
              Use this when you already downloaded your statement and want to import it directly.
            </Text>
          </View>
        </View>
      ) : (
        <LinearGradient colors={Colors.gradientHeader} style={styles.hero}>
          <Logo size={44} showWordmark light />
          <View style={styles.heroCopy}>
            <Text style={styles.title}>Upload a CAS PDF</Text>
            <Text style={styles.subtitle}>
              Use this when you already downloaded your statement and want to import it directly.
            </Text>
          </View>
        </LinearGradient>
      )}

      <View style={styles.panel}>
        <Text style={styles.sectionLabel}>Supported PDFs</Text>
        <Text style={styles.infoTitle}>Detailed CAS statements we can import</Text>
        <Text style={styles.infoItem}>• CAMS CAS (password = your PAN)</Text>
        <Text style={styles.infoItem}>• KFintech / Karvy CAS (password = your PAN)</Text>
        <Text style={styles.infoItem}>• MFcentral CAS (password = your PAN)</Text>
        <Text style={styles.infoItem}>• CDSL CAS (password = PAN + date of birth, e.g. ABCDE1234F01011990)</Text>
        <Text style={styles.infoItem}>• NSDL CAS (password = PAN + date of birth, e.g. ABCDE1234F01011990)</Text>
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
        <Text style={styles.howStep}>
          <Text style={styles.bold}>CDSL: </Text>
          cvlkra.com → CAS → Request → Download PDF
        </Text>
        <Text style={styles.howStep}>
          <Text style={styles.bold}>NSDL: </Text>
          eservices.nsdl.com → CAS → Request → Download PDF
        </Text>
      </View>

      <View style={styles.panNote}>
        <Text style={styles.panNoteText}>
          For CAMS/KFintech/MFCentral: PDF password = your PAN.{'\n'}
          For CDSL/NSDL: PDF password = PAN + date of birth (set both in Settings → Account).
        </Text>
      </View>

      <View style={styles.panel}>
        <Text style={styles.sectionLabel}>Custom password</Text>
        <Text style={styles.infoTitle}>Different PDF password?</Text>
        <Text style={styles.infoItem}>
          Leave this blank — your PAN (and date of birth for CDSL/NSDL) are used automatically.
          Only fill this in if your PDF was sent with a different password.
        </Text>
        <TextInput
          style={styles.passwordInput}
          placeholder="Enter PDF password"
          placeholderTextColor={Colors.textSecondary}
          value={customPassword}
          onChangeText={setCustomPassword}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          editable={state !== 'uploading'}
        />
      </View>

      {dobMissing && (
        <View style={styles.dobWarning}>
          <Text style={styles.dobWarningTitle}>Date of birth not set</Text>
          <Text style={styles.dobWarningText}>
            CDSL/NSDL imports require your date of birth. Add it in Settings → Account.
          </Text>
          <TouchableOpacity
            style={styles.dobWarningBtn}
            onPress={() => router.push('/(tabs)/settings/account')}
          >
            <Text style={styles.dobWarningBtnText}>Go to Account Settings</Text>
          </TouchableOpacity>
        </View>
      )}

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

function makeStyles(Colors: AppColors, isClearLens: boolean) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: {
    paddingBottom: isClearLens ? ClearLensSpacing.xxl : Spacing.xxl,
    paddingTop: isClearLens ? ClearLensSpacing.md : 0,
    gap: isClearLens ? ClearLensSpacing.md : Spacing.md,
  },
  hero: {
    paddingTop: isClearLens ? ClearLensSpacing.lg : 56,
    paddingHorizontal: isClearLens ? ClearLensSpacing.lg : Spacing.lg,
    paddingBottom: isClearLens ? ClearLensSpacing.lg : Spacing.xl + Spacing.sm,
    gap: isClearLens ? ClearLensSpacing.md : Spacing.lg,
  },
  heroClearLens: {
    margin: ClearLensSpacing.md,
    marginBottom: 0,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: ClearLensRadii.lg,
    ...ClearLensShadow,
  },
  heroCopy: { gap: Spacing.sm },
  title: {
    ...(isClearLens ? ClearLensTypography.h1 : Typography.h1),
    color: isClearLens ? Colors.textPrimary : Colors.textOnDark,
    fontWeight: '700',
  },
  subtitle: {
    ...(isClearLens ? ClearLensTypography.body : Typography.body),
    color: isClearLens ? Colors.textSecondary : 'rgba(255,255,255,0.8)',
  },

  panel: {
    marginHorizontal: isClearLens ? ClearLensSpacing.md : Spacing.lg,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: isClearLens ? ClearLensRadii.lg : Radii.lg,
    padding: isClearLens ? ClearLensSpacing.lg : Spacing.lg,
    gap: Spacing.sm,
    ...(isClearLens ? ClearLensShadow : {}),
  },
  sectionLabel: {
    ...(isClearLens ? ClearLensTypography.label : Typography.label),
    color: Colors.primary,
    textTransform: 'uppercase',
  },
  infoTitle: { ...(isClearLens ? ClearLensTypography.h3 : Typography.h3), color: Colors.textPrimary, fontWeight: '700' },
  infoItem: { ...(isClearLens ? ClearLensTypography.bodySmall : Typography.bodySmall), color: Colors.textSecondary },

  howTitle: { ...(isClearLens ? ClearLensTypography.h3 : Typography.h3), color: Colors.textPrimary, fontWeight: '700' },
  howStep: { ...(isClearLens ? ClearLensTypography.bodySmall : Typography.bodySmall), color: Colors.textSecondary },
  bold: { fontWeight: '700' },

  passwordInput: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: isClearLens ? ClearLensRadii.md : Radii.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: Colors.textPrimary,
    backgroundColor: Colors.background,
    marginTop: 4,
  },
  panNote: {
    marginHorizontal: isClearLens ? ClearLensSpacing.md : Spacing.lg,
    backgroundColor: Colors.primaryLight, borderWidth: 1, borderColor: '#c7eadf',
    borderRadius: isClearLens ? ClearLensRadii.lg : Radii.lg,
    padding: 14,
  },
  panNoteText: { ...(isClearLens ? ClearLensTypography.bodySmall : Typography.bodySmall), color: Colors.primaryDark },

  successCard: {
    marginHorizontal: isClearLens ? ClearLensSpacing.md : Spacing.lg,
    backgroundColor: Colors.primaryLight, borderWidth: 1, borderColor: '#c7eadf',
    borderRadius: isClearLens ? ClearLensRadii.lg : Radii.lg,
    padding: isClearLens ? ClearLensSpacing.lg : Spacing.lg,
    gap: Spacing.sm,
    alignItems: 'center',
  },
  successTitle: { ...(isClearLens ? ClearLensTypography.h3 : Typography.h3), color: Colors.primaryDark },
  successText: { ...(isClearLens ? ClearLensTypography.body : Typography.body), color: Colors.primaryDark, textAlign: 'center' },
  doneBtn: {
    backgroundColor: Colors.primary,
    borderRadius: isClearLens ? ClearLensRadii.full : Radii.lg,
    paddingVertical: 10, paddingHorizontal: 24, marginTop: 4,
  },
  doneBtnText: { color: Colors.textOnDark, fontWeight: '700', fontSize: 14 },

  errorCard: {
    marginHorizontal: isClearLens ? ClearLensSpacing.md : Spacing.lg,
    backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fecaca',
    borderRadius: isClearLens ? ClearLensRadii.lg : Radii.lg,
    padding: 14,
    gap: 6,
  },
  errorTitle: { fontSize: 14, fontWeight: '700', color: '#991b1b' },
  errorText: { ...Typography.bodySmall, color: '#b91c1c' },

  uploadBtn: {
    marginHorizontal: isClearLens ? ClearLensSpacing.md : Spacing.lg,
    backgroundColor: Colors.primary,
    borderRadius: isClearLens ? ClearLensRadii.full : Radii.lg,
    paddingVertical: 14,
    alignItems: 'center', flexDirection: 'row', justifyContent: 'center',
  },
  uploadBtnDisabled: { opacity: 0.6 },
  uploadBtnText: { color: Colors.textOnDark, fontWeight: '700', fontSize: 15 },

  backLink: { alignItems: 'center', paddingVertical: 4 },
  backLinkText: { fontSize: 14, color: Colors.primary, fontWeight: '600' },

  dobWarning: {
    marginHorizontal: isClearLens ? ClearLensSpacing.md : Spacing.lg,
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fcd34d',
    borderRadius: isClearLens ? ClearLensRadii.lg : Radii.lg,
    padding: isClearLens ? ClearLensSpacing.md : Spacing.md,
    gap: 8,
  },
  dobWarningTitle: { fontSize: 14, fontWeight: '700', color: '#92400e' },
  dobWarningText: { ...(isClearLens ? ClearLensTypography.bodySmall : Typography.bodySmall), color: '#78350f' },
  dobWarningBtn: {
    backgroundColor: '#f59e0b',
    borderRadius: isClearLens ? ClearLensRadii.full : Radii.md,
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignSelf: 'flex-start' as const,
  },
  dobWarningBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },
  });
}
