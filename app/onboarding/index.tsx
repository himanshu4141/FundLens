import { useState, useEffect } from 'react';
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
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { supabase } from '@/src/lib/supabase';
import { useInboundSession } from '@/src/hooks/useInboundSession';
import { useSession } from '@/src/hooks/useSession';

const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

// ── Data fetching ────────────────────────────────────────────────────────────

async function fetchProfile(userId: string) {
  const { data } = await supabase
    .from('user_profile')
    .select('pan, kfintech_email')
    .eq('user_id', userId)
    .maybeSingle();
  return data ?? null;
}

async function requestCAS(email: string): Promise<void> {
  const { error } = await supabase.functions.invoke('request-cas', {
    method: 'POST',
    body: { email },
  });
  if (error) throw new Error(error.message);
}

// ── Sub-components ───────────────────────────────────────────────────────────

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

// ── Already-set-up view ───────────────────────────────────────────────────────

function SetupComplete({
  inboundEmail,
  kftechEmail,
  onRefresh,
  onReset,
  onGoToPortfolio,
}: {
  inboundEmail: string;
  kftechEmail: string;
  onRefresh: () => Promise<void>;
  onReset: () => void;
  onGoToPortfolio: () => void;
}) {
  const [requesting, setRequesting] = useState(false);
  const [requested, setRequested] = useState(false);
  const [showAutoForward, setShowAutoForward] = useState(false);

  async function handleRefresh() {
    setRequesting(true);
    setRequested(false);
    try {
      await onRefresh();
      setRequested(true);
    } catch (e) {
      Alert.alert('Error', (e as Error).message);
    } finally {
      setRequesting(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Import CAS</Text>
      <Text style={styles.subtitle}>
        Setup is complete. Tap refresh to pull your latest transactions.
      </Text>

      <View style={styles.refreshCard}>
        <TouchableOpacity
          style={[styles.refreshBtn, requesting && styles.btnDisabled]}
          onPress={handleRefresh}
          disabled={requesting}
        >
          {requesting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.refreshBtnText}>↻  Refresh portfolio</Text>
          )}
        </TouchableOpacity>

        {requested && (
          <View style={styles.requestedBanner}>
            <Text style={styles.requestedText}>
              CAS requested! KFintech will email <Text style={styles.bold}>{kftechEmail}</Text>.
              {'\n'}
              {showAutoForward
                ? 'Your auto-forward filter will handle the rest.'
                : 'Forward that email to your import address below.'}
            </Text>
          </View>
        )}
      </View>

      <CopyBox label="Your import address" value={inboundEmail} />

      {/* Auto-forward tip */}
      <TouchableOpacity
        style={styles.tipToggle}
        onPress={() => setShowAutoForward((v) => !v)}
      >
        <Text style={styles.tipToggleText}>
          {showAutoForward ? '▾' : '▸'} Set up auto-forward (skip the manual step forever)
        </Text>
      </TouchableOpacity>

      {showAutoForward && (
        <View style={styles.tipCard}>
          <Text style={styles.tipTitle}>Auto-forward filter (Gmail)</Text>
          <Text style={styles.tipStep}>
            1. Open Gmail → Settings → Filters → Create new filter
          </Text>
          <Text style={styles.tipStep}>
            2. In <Text style={styles.bold}>From</Text>, enter:{' '}
            <Text style={styles.mono}>donotreply@kfintech.com</Text>
          </Text>
          <Text style={styles.tipStep}>
            3. Click <Text style={styles.bold}>Create filter</Text> →{' '}
            tick <Text style={styles.bold}>Forward to</Text> → add your import address above
          </Text>
          <Text style={styles.tipStep}>
            4. Save. From now on, hitting <Text style={styles.bold}>Refresh</Text> is all you need.
          </Text>
          <Text style={styles.tipNote}>
            Outlook: Settings → Rules → New rule → From address → Forward to import address.
          </Text>
        </View>
      )}

      <TouchableOpacity style={styles.portfolioBtn} onPress={onGoToPortfolio}>
        <Text style={styles.portfolioBtnText}>Go to portfolio →</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.resetLink} onPress={onReset}>
        <Text style={styles.resetLinkText}>Change PAN or email</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

// ── First-time setup view ─────────────────────────────────────────────────────

export default function OnboardingScreen() {
  const router = useRouter();
  const { session } = useSession();
  const queryClient = useQueryClient();
  const { inboundEmail, isLoading: sessionLoading, createSession } = useInboundSession(
    session?.user.id,
  );

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ['user-profile', session?.user.id],
    queryFn: () => fetchProfile(session!.user.id),
    enabled: !!session?.user.id,
  });

  // ── PAN step ────────────────────────────────────────────────────────────────
  const [pan, setPan] = useState('');
  const [panState, setPanState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [panError, setPanError] = useState<string | null>(null);

  // ── CAS request step ────────────────────────────────────────────────────────
  const [casEmail, setCasEmail] = useState(session?.user.email ?? '');

  // Pre-populate inputs from saved profile when it loads
  useEffect(() => {
    if (profile?.pan && !pan) setPan(profile.pan);
  }, [profile?.pan]);
  useEffect(() => {
    if (profile?.kfintech_email) setCasEmail(profile.kfintech_email);
  }, [profile?.kfintech_email]);
  const [casState, setCasState] = useState<'idle' | 'requesting' | 'requested' | 'error'>('idle');

  const isLoading = profileLoading || sessionLoading;

  // Once profile + inbound address both exist → show the "already set up" view
  const isSetupComplete =
    !isLoading && !!profile?.pan && !!profile?.kfintech_email && !!inboundEmail;

  async function handleSavePAN() {
    const upper = pan.trim().toUpperCase();
    if (!PAN_REGEX.test(upper)) {
      setPanError('Enter a valid PAN (e.g. ABCDE1234F)');
      return;
    }
    setPanError(null);
    setPanState('saving');
    const { error } = await supabase.from('user_profile').upsert(
      { user_id: session!.user.id, pan: upper },
      { onConflict: 'user_id' },
    );
    if (error) {
      setPanState('error');
      Alert.alert('Error', error.message);
    } else {
      setPan(upper);
      setPanState('saved');
      queryClient.invalidateQueries({ queryKey: ['user-profile', session?.user.id] });
    }
  }

  async function handleGenerateAddress() {
    try {
      await createSession.mutateAsync();
    } catch (e) {
      Alert.alert('Error', (e as Error).message);
    }
  }

  async function handleRequestCAS(email: string) {
    await requestCAS(email);
    queryClient.invalidateQueries({ queryKey: ['user-profile', session?.user.id] });
  }

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1a56db" />
      </View>
    );
  }

  // ── Already set up ──────────────────────────────────────────────────────────
  if (isSetupComplete) {
    return (
      <SetupComplete
        inboundEmail={inboundEmail!}
        kftechEmail={profile!.kfintech_email!}
        onRefresh={() => handleRequestCAS(profile!.kfintech_email!)}
        onReset={() => {
          setPanState('idle');
          queryClient.setQueryData(['user-profile', session?.user.id], null);
        }}
        onGoToPortfolio={() => router.replace('/')}
      />
    );
  }

  // ── First-time setup ────────────────────────────────────────────────────────
  const panDone = panState === 'saved' || !!profile?.pan;
  const step2Enabled = panDone;
  const step3Enabled = !!inboundEmail;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Import your CAS</Text>
      <Text style={styles.subtitle}>
        One-time setup — takes about 2 minutes. After this, syncing is a single tap.
      </Text>

      {/* ── Step 1 — PAN ──────────────────────────────────────── */}
      <View style={styles.step}>
        <View style={styles.stepHeader}>
          <View style={[styles.stepNum, panDone && styles.stepNumDone]}>
            <Text style={styles.stepNumText}>{panDone ? '✓' : '1'}</Text>
          </View>
          <Text style={styles.stepTitle}>Enter your PAN</Text>
        </View>
        <View style={styles.stepBody}>
          <Text style={styles.stepDesc}>
            Used to decrypt your CAS PDF. Stored securely, never shared, never asked again.
          </Text>
          {panDone ? (
            <View style={styles.savedRow}>
              <Text style={styles.savedText}>PAN saved: {profile?.pan ?? pan}</Text>
              <TouchableOpacity onPress={() => setPanState('idle')}>
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
                onChangeText={(t) => { setPan(t.toUpperCase()); setPanError(null); }}
                autoCapitalize="characters"
                maxLength={10}
                editable={panState !== 'saving'}
              />
              {panError && <Text style={styles.errorText}>{panError}</Text>}
              <TouchableOpacity
                style={[styles.primaryBtn, panState === 'saving' && styles.btnDisabled]}
                onPress={handleSavePAN}
                disabled={panState === 'saving'}
              >
                {panState === 'saving' ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Save PAN</Text>}
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>

      {/* ── Step 2 — Inbound address ───────────────────────────── */}
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
            A permanent address unique to you. Forward any CAS email to it and transactions
            import automatically. You only generate this once.
          </Text>
          {sessionLoading ? (
            <ActivityIndicator style={{ marginTop: 8 }} />
          ) : inboundEmail ? (
            <CopyBox label="Your import address" value={inboundEmail} />
          ) : (
            <TouchableOpacity
              style={[styles.primaryBtn, (!step2Enabled || createSession.isPending) && styles.btnDisabled]}
              onPress={handleGenerateAddress}
              disabled={!step2Enabled || createSession.isPending}
            >
              {createSession.isPending
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.primaryBtnText}>Generate address</Text>}
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* ── Step 3 — Request CAS ───────────────────────────────── */}
      <View style={[styles.step, !step3Enabled && styles.stepDisabled]}>
        <View style={styles.stepHeader}>
          <View style={[styles.stepNum, !step3Enabled && styles.stepNumGray, casState === 'requested' && styles.stepNumDone]}>
            <Text style={styles.stepNumText}>{casState === 'requested' ? '✓' : '3'}</Text>
          </View>
          <Text style={[styles.stepTitle, !step3Enabled && styles.stepTitleGray]}>
            Request your CAS
          </Text>
        </View>
        <View style={styles.stepBody}>
          {casState === 'requested' ? (
            <View style={styles.hintCard}>
              <Text style={styles.hintTitle}>CAS requested!</Text>
              <Text style={styles.hintItem}>
                KFintech will email your CAS to <Text style={styles.bold}>{casEmail}</Text> within
                1–2 minutes. Forward that email to your import address above.{'\n\n'}
                <Text style={styles.bold}>Tip:</Text> Set up an auto-forward filter so future
                syncs need only one tap. You can see the instructions from the import screen
                after setup.
              </Text>
              <TouchableOpacity onPress={() => setCasState('idle')}>
                <Text style={[styles.changeLink, { marginTop: 6 }]}>Request again</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <Text style={[styles.stepDesc, !step3Enabled && styles.stepDescGray]}>
                Enter the email registered with KFintech. We&apos;ll request your CAS — it
                arrives in 1–2 minutes. This email is saved so future refreshes need no input.
              </Text>
              <TextInput
                style={[styles.emailInput, !step3Enabled && styles.inputDisabled]}
                placeholder="your@email.com"
                placeholderTextColor="#999"
                value={casEmail}
                onChangeText={setCasEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                editable={step3Enabled && casState !== 'requesting'}
              />
              <TouchableOpacity
                style={[styles.primaryBtn, (!step3Enabled || casState === 'requesting') && styles.btnDisabled]}
                onPress={async () => {
                  if (!casEmail.trim()) return;
                  setCasState('requesting');
                  try {
                    await handleRequestCAS(casEmail.trim());
                    setCasState('requested');
                  } catch (e) {
                    setCasState('error');
                    Alert.alert('Error', (e as Error).message);
                  }
                }}
                disabled={!step3Enabled || casState === 'requesting'}
              >
                {casState === 'requesting'
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.primaryBtnText}>Request CAS</Text>}
              </TouchableOpacity>
            </>
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
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 22, fontWeight: '700', color: '#111', marginBottom: 6 },
  subtitle: { fontSize: 14, color: '#666', lineHeight: 21, marginBottom: 16 },

  // Setup-complete view
  refreshCard: { gap: 12 },
  refreshBtn: {
    backgroundColor: '#1a56db', borderRadius: 10, paddingVertical: 16,
    alignItems: 'center',
  },
  refreshBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  requestedBanner: {
    backgroundColor: '#f0fdf4', borderWidth: 1, borderColor: '#bbf7d0',
    borderRadius: 10, padding: 14,
  },
  requestedText: { fontSize: 14, color: '#166534', lineHeight: 22 },

  tipToggle: { paddingVertical: 4 },
  tipToggleText: { fontSize: 13, color: '#1a56db', fontWeight: '600' },
  tipCard: {
    backgroundColor: '#eff6ff', borderWidth: 1, borderColor: '#bfdbfe',
    borderRadius: 10, padding: 14, gap: 8,
  },
  tipTitle: { fontSize: 13, fontWeight: '700', color: '#1e40af' },
  tipStep: { fontSize: 13, color: '#1e40af', lineHeight: 20 },
  tipNote: { fontSize: 12, color: '#3730a3', fontStyle: 'italic', marginTop: 4 },

  portfolioBtn: {
    backgroundColor: '#1a56db', borderRadius: 10,
    paddingVertical: 14, alignItems: 'center',
  },
  portfolioBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  resetLink: { alignItems: 'center', paddingVertical: 8 },
  resetLinkText: { fontSize: 13, color: '#94a3b8' },

  // First-time setup
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
  emailInput: {
    height: 48, borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8,
    paddingHorizontal: 14, fontSize: 15, color: '#111', backgroundColor: '#fafafa',
  },
  inputDisabled: { opacity: 0.4 },
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
