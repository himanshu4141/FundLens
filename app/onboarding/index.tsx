import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';
import { useWebhookToken } from '@/src/hooks/useWebhookToken';
import { useSession } from '@/src/hooks/useSession';

function CopyBox({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await Clipboard.setStringAsync(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <View style={styles.copyBox}>
      <Text style={styles.copyLabel}>{label}</Text>
      <View style={styles.copyRow}>
        <Text style={[styles.copyValue, mono && styles.mono]} numberOfLines={2} selectable>
          {value}
        </Text>
        <TouchableOpacity style={styles.copyBtn} onPress={handleCopy}>
          <Text style={styles.copyBtnText}>{copied ? 'Copied!' : 'Copy'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function OnboardingScreen() {
  const router = useRouter();
  const { session } = useSession();
  const { token, webhookUrl, loading, createToken, regenerateToken } = useWebhookToken(
    session?.user.id,
  );

  async function handleGetToken() {
    try {
      await createToken.mutateAsync();
    } catch (e) {
      Alert.alert('Error', (e as Error).message);
    }
  }

  async function handleRegenerate() {
    Alert.alert(
      'Regenerate token?',
      'Your current webhook URL will stop working. You will need to update CASParser.in with the new URL.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Regenerate',
          style: 'destructive',
          onPress: async () => {
            try {
              await regenerateToken.mutateAsync();
            } catch (e) {
              Alert.alert('Error', (e as Error).message);
            }
          },
        },
      ],
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Import your CAS</Text>
      <Text style={styles.subtitle}>
        Connect CASParser.in to automatically import your transactions whenever you forward a CAS
        email.
      </Text>

      {/* Step 1 */}
      <View style={styles.step}>
        <View style={styles.stepHeader}>
          <View style={styles.stepNum}>
            <Text style={styles.stepNumText}>1</Text>
          </View>
          <Text style={styles.stepTitle}>Get your webhook URL</Text>
        </View>

        {loading ? (
          <ActivityIndicator style={{ marginTop: 12 }} />
        ) : token ? (
          <View style={styles.stepBody}>
            <CopyBox label="Webhook URL" value={webhookUrl!} mono />
            <TouchableOpacity
              style={styles.regenBtn}
              onPress={handleRegenerate}
              disabled={regenerateToken.isPending}
            >
              <Text style={styles.regenBtnText}>Regenerate URL</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.stepBody}>
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={handleGetToken}
              disabled={createToken.isPending}
            >
              {createToken.isPending ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.primaryBtnText}>Generate webhook URL</Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Step 2 */}
      <View style={styles.step}>
        <View style={styles.stepHeader}>
          <View style={[styles.stepNum, !token && styles.stepNumDisabled]}>
            <Text style={styles.stepNumText}>2</Text>
          </View>
          <Text style={[styles.stepTitle, !token && styles.stepTitleDisabled]}>
            Set up CASParser.in
          </Text>
        </View>
        <View style={styles.stepBody}>
          <Text style={styles.stepDesc}>
            1. Visit{' '}
            <Text style={styles.link}>casparser.in</Text>
            {'\n'}
            2. Sign up / log in{'\n'}
            3. Go to <Text style={styles.bold}>Webhook Settings</Text>
            {'\n'}
            4. Paste your webhook URL above{'\n'}
            5. Set the email format to <Text style={styles.bold}>JSON</Text>
          </Text>
        </View>
      </View>

      {/* Step 3 */}
      <View style={styles.step}>
        <View style={styles.stepHeader}>
          <View style={[styles.stepNum, !token && styles.stepNumDisabled]}>
            <Text style={styles.stepNumText}>3</Text>
          </View>
          <Text style={[styles.stepTitle, !token && styles.stepTitleDisabled]}>
            Set up email forwarding
          </Text>
        </View>
        <View style={styles.stepBody}>
          <Text style={styles.stepDesc}>
            Forward your CAS email (from CAMS / Karvy / MFcentral) to CASParser.in&apos;s forwarding
            address (shown in their dashboard). CASParser.in will parse it and send the data to your
            webhook automatically.
          </Text>
        </View>
      </View>

      {/* Alternative methods */}
      <Text style={styles.altTitle}>Or import manually</Text>
      <View style={styles.altRow}>
        <TouchableOpacity style={styles.altCard} onPress={() => router.push('/onboarding/qr')}>
          <Text style={styles.altCardTitle}>MFcentral QR</Text>
          <Text style={styles.altCardSub}>Scan your QR code</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.altCard} onPress={() => router.push('/onboarding/pdf')}>
          <Text style={styles.altCardTitle}>Upload PDF</Text>
          <Text style={styles.altCardSub}>Upload CAS PDF directly</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 20, gap: 4, paddingBottom: 40 },
  title: { fontSize: 22, fontWeight: '700', color: '#111', marginBottom: 6 },
  subtitle: { fontSize: 14, color: '#666', lineHeight: 21, marginBottom: 16 },

  step: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  stepHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  stepNum: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#1a56db',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumDisabled: { backgroundColor: '#d1d5db' },
  stepNumText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  stepTitle: { fontSize: 15, fontWeight: '600', color: '#111' },
  stepTitleDisabled: { color: '#9ca3af' },
  stepBody: { gap: 10 },
  stepDesc: { fontSize: 14, color: '#555', lineHeight: 22 },

  copyBox: {
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 12,
    gap: 6,
  },
  copyLabel: { fontSize: 11, color: '#94a3b8', fontWeight: '600', textTransform: 'uppercase' },
  copyRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  copyValue: { flex: 1, fontSize: 13, color: '#334155' },
  mono: { fontFamily: 'Courier', fontSize: 12 },
  copyBtn: {
    backgroundColor: '#e2e8f0',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  copyBtnText: { fontSize: 12, fontWeight: '600', color: '#475569' },

  primaryBtn: {
    backgroundColor: '#1a56db',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },

  regenBtn: { alignSelf: 'flex-start' },
  regenBtnText: { color: '#e53e3e', fontSize: 13 },

  link: { color: '#1a56db' },
  bold: { fontWeight: '700' },

  altTitle: { fontSize: 14, fontWeight: '600', color: '#888', marginTop: 8, marginBottom: 10 },
  altRow: { flexDirection: 'row', gap: 10 },
  altCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    padding: 14,
    gap: 4,
  },
  altCardTitle: { fontSize: 14, fontWeight: '600', color: '#111' },
  altCardSub: { fontSize: 12, color: '#888' },
});
