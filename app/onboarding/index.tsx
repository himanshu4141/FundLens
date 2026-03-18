import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';
import { supabase } from '@/src/lib/supabase';
import { useInboundSession } from '@/src/hooks/useInboundSession';
import { useSession } from '@/src/hooks/useSession';

const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

function CopyBox({ label, value }: { label: string; value: string }) {
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
        <Text style={[styles.copyValue, styles.mono]} numberOfLines={2} selectable>
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
  const { inboundEmail, isLoading, createSession } = useInboundSession(session?.user.id);

  const [pan, setPan] = useState('');
  const [panSaved, setPanSaved] = useState(false);
  const [panSaving, setPanSaving] = useState(false);
  const [panError, setPanError] = useState<string | null>(null);

  async function handleSavePAN() {
    const upper = pan.trim().toUpperCase();
    if (!PAN_REGEX.test(upper)) {
      setPanError('Enter a valid PAN (e.g. ABCDE1234F)');
      return;
    }
    setPanError(null);
    setPanSaving(true);
    const { error } = await supabase.from('user_profile').upsert(
      { user_id: session!.user.id, pan: upper },
      { onConflict: 'user_id' },
    );
    setPanSaving(false);
    if (error) {
      Alert.alert('Error', error.message);
    } else {
      setPan(upper);
      setPanSaved(true);
    }
  }

  async function handleGenerateAddress() {
    try {
      await createSession.mutateAsync();
    } catch (e) {
      Alert.alert('Error', (e as Error).message);
    }
  }

  function handleRegenerate() {
    Alert.alert(
      'Generate new address?',
      'A new forwarding address will be created. Old one continues to work until it expires.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Generate', onPress: handleGenerateAddress },
      ],
    );
  }

  const step2Enabled = panSaved;
  const step3Enabled = !!inboundEmail;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Import your CAS</Text>
      <Text style={styles.subtitle}>
        Set up automatic import of your mutual fund transactions. Takes about 2 minutes.
      </Text>

      {/* ── Step 1 — PAN ──────────────────────────────────────── */}
      <View style={styles.step}>
        <View style={styles.stepHeader}>
          <View style={[styles.stepNum, panSaved && styles.stepNumDone]}>
            <Text style={styles.stepNumText}>{panSaved ? '✓' : '1'}</Text>
          </View>
          <Text style={styles.stepTitle}>Enter your PAN</Text>
        </View>
        <View style={styles.stepBody}>
          <Text style={styles.stepDesc}>
            Your PAN is used to decrypt the CAS PDF sent by CAMS / KFintech. It is stored securely
            and never shared.
          </Text>
          {panSaved ? (
            <View style={styles.savedRow}>
              <Text style={styles.savedText}>PAN saved: {pan}</Text>
              <TouchableOpacity onPress={() => setPanSaved(false)}>
                <Text style={styles.changeLink}>Change</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <TextInput
                style={styles.panInput}
                placeholder="ABCDE1234F"
                placeholderTextColor="#999"
                value={pan}
                onChangeText={(t) => {
                  setPan(t.toUpperCase());
                  setPanError(null);
                }}
                autoCapitalize="characters"
                maxLength={10}
                editable={!panSaving}
              />
              {panError && <Text style={styles.errorText}>{panError}</Text>}
              <TouchableOpacity
                style={[styles.primaryBtn, panSaving && styles.btnDisabled]}
                onPress={handleSavePAN}
                disabled={panSaving}
              >
                {panSaving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.primaryBtnText}>Save PAN</Text>
                )}
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>

      {/* ── Step 2 — Generate address ──────────────────────────── */}
      <View style={[styles.step, !step2Enabled && styles.stepDisabled]}>
        <View style={styles.stepHeader}>
          <View style={[styles.stepNum, !step2Enabled && styles.stepNumGray, !!inboundEmail && styles.stepNumDone]}>
            <Text style={styles.stepNumText}>{inboundEmail ? '✓' : '2'}</Text>
          </View>
          <Text style={[styles.stepTitle, !step2Enabled && styles.stepTitleGray]}>
            Get your import address
          </Text>
        </View>
        <View style={styles.stepBody}>
          <Text style={[styles.stepDesc, !step2Enabled && styles.stepDescGray]}>
            We&apos;ll generate a unique email address for you. Forward your CAS email to it and
            your transactions will import automatically.
          </Text>
          {isLoading ? (
            <ActivityIndicator style={{ marginTop: 8 }} />
          ) : inboundEmail ? (
            <>
              <CopyBox label="Forward your CAS to" value={inboundEmail} />
              <TouchableOpacity
                style={styles.regenBtn}
                onPress={handleRegenerate}
                disabled={createSession.isPending}
              >
                <Text style={styles.regenBtnText}>Generate new address</Text>
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity
              style={[styles.primaryBtn, (!step2Enabled || createSession.isPending) && styles.btnDisabled]}
              onPress={handleGenerateAddress}
              disabled={!step2Enabled || createSession.isPending}
            >
              {createSession.isPending ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.primaryBtnText}>Generate address</Text>
              )}
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* ── Step 3 — Forward instructions ─────────────────────── */}
      <View style={[styles.step, !step3Enabled && styles.stepDisabled]}>
        <View style={styles.stepHeader}>
          <View style={[styles.stepNum, !step3Enabled && styles.stepNumGray]}>
            <Text style={styles.stepNumText}>3</Text>
          </View>
          <Text style={[styles.stepTitle, !step3Enabled && styles.stepTitleGray]}>
            Forward your CAS email
          </Text>
        </View>
        <View style={styles.stepBody}>
          <Text style={[styles.stepDesc, !step3Enabled && styles.stepDescGray]}>
            Request a CAS from CAMS or KFintech, then forward the email to the address above.
            Your transactions will appear in the app automatically.
          </Text>
          {step3Enabled && (
            <View style={styles.hintCard}>
              <Text style={styles.hintTitle}>How to request a CAS</Text>
              <Text style={styles.hintItem}>
                <Text style={styles.bold}>CAMS: </Text>
                camsonline.com → Statements → CAS → Detailed → email to yourself
              </Text>
              <Text style={styles.hintItem}>
                <Text style={styles.bold}>KFintech: </Text>
                kfintech.com → MF → CAS → Request → email to yourself
              </Text>
              <Text style={styles.hintItem}>
                <Text style={styles.bold}>MFcentral: </Text>
                mfcentral.com → CAS → Detailed → email to yourself
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* ── Alternative: PDF upload ────────────────────────────── */}
      <Text style={styles.altTitle}>Or import manually</Text>
      <View style={styles.altRow}>
        <TouchableOpacity style={styles.altCard} onPress={() => router.push('/onboarding/qr')}>
          <Text style={styles.altCardTitle}>MFcentral QR</Text>
          <Text style={styles.altCardSub}>Scan QR code</Text>
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
    borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12,
    padding: 16, marginBottom: 12,
  },
  stepDisabled: { borderColor: '#f3f4f6', backgroundColor: '#fafafa' },
  stepHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  stepNum: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: '#1a56db', alignItems: 'center', justifyContent: 'center',
  },
  stepNumDone: { backgroundColor: '#16a34a' },
  stepNumGray: { backgroundColor: '#d1d5db' },
  stepNumText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  stepTitle: { fontSize: 15, fontWeight: '600', color: '#111' },
  stepTitleGray: { color: '#9ca3af' },
  stepBody: { gap: 10 },
  stepDesc: { fontSize: 14, color: '#555', lineHeight: 22 },
  stepDescGray: { color: '#c0c0c0' },

  panInput: {
    height: 48, borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8,
    paddingHorizontal: 14, fontSize: 16, color: '#111', backgroundColor: '#fafafa',
    letterSpacing: 2,
  },
  errorText: { color: '#e53e3e', fontSize: 13 },

  savedRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  savedText: { fontSize: 14, color: '#16a34a', fontWeight: '600', flex: 1 },
  changeLink: { fontSize: 13, color: '#1a56db' },

  copyBox: {
    backgroundColor: '#f8fafc', borderRadius: 8,
    borderWidth: 1, borderColor: '#e2e8f0', padding: 12, gap: 6,
  },
  copyLabel: { fontSize: 11, color: '#94a3b8', fontWeight: '600', textTransform: 'uppercase' },
  copyRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  copyValue: { flex: 1, fontSize: 12, color: '#334155' },
  mono: { fontFamily: 'Courier' },
  copyBtn: {
    backgroundColor: '#e2e8f0', borderRadius: 6,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  copyBtnText: { fontSize: 12, fontWeight: '600', color: '#475569' },

  primaryBtn: {
    backgroundColor: '#1a56db', borderRadius: 8, paddingVertical: 12, alignItems: 'center',
  },
  btnDisabled: { opacity: 0.4 },
  primaryBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },

  regenBtn: { alignSelf: 'flex-start' },
  regenBtnText: { color: '#1a56db', fontSize: 13 },

  hintCard: {
    backgroundColor: '#f0fdf4', borderWidth: 1, borderColor: '#bbf7d0',
    borderRadius: 10, padding: 14, gap: 8,
  },
  hintTitle: { fontSize: 13, fontWeight: '700', color: '#166534' },
  hintItem: { fontSize: 13, color: '#15803d', lineHeight: 20 },
  bold: { fontWeight: '700' },

  altTitle: { fontSize: 14, fontWeight: '600', color: '#888', marginTop: 8, marginBottom: 10 },
  altRow: { flexDirection: 'row', gap: 10 },
  altCard: {
    flex: 1, borderWidth: 1, borderColor: '#e5e7eb',
    borderRadius: 10, padding: 14, gap: 4,
  },
  altCardTitle: { fontSize: 14, fontWeight: '600', color: '#111' },
  altCardSub: { fontSize: 12, color: '#888' },
});
