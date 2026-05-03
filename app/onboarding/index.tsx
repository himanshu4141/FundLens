import { useMemo, useState, useEffect } from 'react';
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
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { supabase } from '@/src/lib/supabase';
import { useInboundSession } from '@/src/hooks/useInboundSession';
import { useSession } from '@/src/hooks/useSession';
import Logo from '@/src/components/Logo';
import { FolioLensLogo } from '@/src/components/clearLens/FolioLensLogo';
import { useTheme, type AppColors } from '@/src/context/ThemeContext';
import { useAppDesignMode } from '@/src/hooks/useAppDesignMode';
import { Colors as ClassicColors, Radii, Spacing, Typography } from '@/src/constants/theme';
import {
  ClearLensColors,
  ClearLensRadii,
  ClearLensShadow,
  ClearLensSpacing,
  ClearLensTypography,
} from '@/src/constants/clearLensTheme';

const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const ONBOARDING_POINTS = [
  'Save your PAN once so PDF imports can unlock automatically.',
  'Get a permanent import address for forwarded CAS emails.',
  'Use one-tap refresh later instead of repeating setup.',
];

type OnboardingStyles = ReturnType<typeof makeStyles>;

// ── Data fetching ────────────────────────────────────────────────────────────

async function fetchProfile(userId: string) {
  const { data } = await supabase
    .from('user_profile')
    .select('pan, kfintech_email, dob')
    .eq('user_id', userId)
    .maybeSingle();
  return data ?? null;
}

const DOB_REGEX = /^(\d{2})\/(\d{2})\/(\d{4})$/;

function parseDobInput(value: string): string | null {
  const m = DOB_REGEX.exec(value);
  if (!m) return null;
  const [, dd, mm, yyyy] = m;
  const d = new Date(`${yyyy}-${mm}-${dd}`);
  if (isNaN(d.getTime())) return null;
  // Must be ≥ 18 years old
  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - 18);
  if (d > cutoff) return null;
  return `${yyyy}-${mm}-${dd}`;
}

function formatDobForDisplay(iso: string): string {
  const [yyyy, mm, dd] = iso.split('-');
  return `${dd}/${mm}/${yyyy}`;
}

async function requestCAS(email: string): Promise<void> {
  const { error } = await supabase.functions.invoke('request-cas', {
    method: 'POST',
    body: { email },
  });
  if (error) throw new Error(error.message);
}

// ── Sub-components ───────────────────────────────────────────────────────────

function CopyBox({
  label,
  value,
  styles,
  embedded = false,
}: {
  label: string;
  value: string;
  styles: OnboardingStyles;
  embedded?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  async function handleCopy() {
    await Clipboard.setStringAsync(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <View style={[styles.copyBox, embedded && styles.copyBoxEmbedded]}>
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

function OnboardingHero({
  title,
  subtitle,
  styles,
  isClearLens,
}: {
  title: string;
  subtitle: string;
  styles: OnboardingStyles;
  isClearLens: boolean;
}) {
  if (isClearLens) {
    return (
      <View style={styles.hero}>
        <FolioLensLogo size={42} showWordmark showTagline />
        <View style={styles.heroCopy}>
          <Text style={styles.heroTitle}>{title}</Text>
          <Text style={styles.heroSubtitle}>{subtitle}</Text>
        </View>
        <View style={styles.heroPoints}>
          {ONBOARDING_POINTS.map((point) => (
            <View key={point} style={styles.heroPointRow}>
              <View style={styles.heroCheckIcon}>
                <Ionicons name="checkmark" size={13} color={ClearLensColors.textOnDark} />
              </View>
              <Text style={styles.heroPointText}>{point}</Text>
            </View>
          ))}
        </View>
      </View>
    );
  }

  return (
    <LinearGradient colors={ClassicColors.gradientHeader} style={styles.hero}>
      <Logo size={46} showWordmark light />
      <View style={styles.heroCopy}>
        <Text style={styles.heroTitle}>{title}</Text>
        <Text style={styles.heroSubtitle}>{subtitle}</Text>
      </View>
      <View style={styles.heroPoints}>
        {ONBOARDING_POINTS.map((point) => (
          <View key={point} style={styles.heroPointRow}>
            <Text style={styles.heroPointIcon}>•</Text>
            <Text style={styles.heroPointText}>{point}</Text>
          </View>
        ))}
      </View>
    </LinearGradient>
  );
}

// ── Already-set-up view ───────────────────────────────────────────────────────

function SetupComplete({
  inboundEmail,
  kftechEmail,
  onRefresh,
  onReset,
  onGoToPortfolio,
  styles,
  isClearLens,
}: {
  inboundEmail: string;
  kftechEmail: string;
  onRefresh: () => Promise<void>;
  onReset: () => void;
  onGoToPortfolio: () => void;
  styles: OnboardingStyles;
  isClearLens: boolean;
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
      <OnboardingHero
        title="Your import setup is ready"
        subtitle="Refresh your latest transactions in one tap, or keep auto-forward on and let the inbox do the work."
        styles={styles}
        isClearLens={isClearLens}
      />

      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionEyebrow}>Refresh</Text>
          <Text style={styles.sectionTitle}>Pull your latest CAS</Text>
        </View>
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

      <CopyBox label="Your import address" value={inboundEmail} styles={styles} />

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
          <Text style={styles.tipTitle}>Auto-forward filter</Text>
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
        <Text style={styles.portfolioBtnText}>Go to portfolio</Text>
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
  const { colors: Colors } = useTheme();
  const { isClearLens } = useAppDesignMode();
  const styles = useMemo(() => makeStyles(Colors, isClearLens), [Colors, isClearLens]);
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

  // ── DOB step (optional, for CDSL/NSDL CAS) ──────────────────────────────────
  const [dob, setDob] = useState('');
  const [dobError, setDobError] = useState<string | null>(null);
  const [dobSaving, setDobSaving] = useState(false);
  const [dobSaved, setDobSaved] = useState(false);

  // ── CAS request step ────────────────────────────────────────────────────────
  const [casEmail, setCasEmail] = useState(session?.user.email ?? '');

  // Pre-populate inputs from saved profile when it loads
  useEffect(() => {
    if (profile?.pan && !pan) setPan(profile.pan);
  }, [profile?.pan, pan]);
  useEffect(() => {
    if (profile?.dob && !dob) setDob(formatDobForDisplay(profile.dob));
  }, [profile?.dob, dob]);
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

  async function handleSaveDOB() {
    const iso = parseDobInput(dob.trim());
    if (!iso) {
      setDobError('Enter a valid date of birth (DD/MM/YYYY) — must be 18+');
      return;
    }
    setDobError(null);
    setDobSaving(true);
    const { error } = await supabase.from('user_profile').upsert(
      { user_id: session!.user.id, pan: pan.trim().toUpperCase() || (profile?.pan ?? ''), dob: iso },
      { onConflict: 'user_id' },
    );
    setDobSaving(false);
    if (error) {
      Alert.alert('Error', error.message);
    } else {
      setDobSaved(true);
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
        <ActivityIndicator size="large" color={Colors.primary} />
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
        styles={styles}
        isClearLens={isClearLens}
      />
    );
  }

  // ── First-time setup ────────────────────────────────────────────────────────
  const panDone = panState === 'saved' || !!profile?.pan;
  const step2Enabled = panDone;
  const step3Enabled = !!inboundEmail;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <OnboardingHero
        title="Import your portfolio"
        subtitle="Set this up once and future refreshes become a single tap. Email forwarding is the fastest path, PDF upload stays available as fallback."
        styles={styles}
        isClearLens={isClearLens}
      />

      {/* ── Step 1 — PAN ──────────────────────────────────────── */}
      <View style={styles.step}>
        <View style={styles.stepHeader}>
          <View style={[styles.stepNum, panDone && styles.stepNumDone]}>
            <Text style={styles.stepNumText}>{panDone ? '✓' : '1'}</Text>
          </View>
          <View style={styles.stepTitleWrap}>
            <Text style={styles.stepLabel}>Step 1</Text>
            <Text style={styles.stepTitle}>Save your PAN</Text>
          </View>
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

          {/* DOB — optional, used for CDSL/NSDL CAS */}
          <View style={styles.dobSection}>
            <Text style={styles.dobLabel}>Date of Birth (optional)</Text>
            <Text style={styles.dobHint}>
              Required to unlock CDSL/NSDL CAS PDFs. Not shared with anyone.
            </Text>
            {dobSaved || !!profile?.dob ? (
              <View style={styles.savedRow}>
                <Text style={styles.savedText}>
                  DOB saved: {profile?.dob ? formatDobForDisplay(profile.dob) : dob}
                </Text>
                <TouchableOpacity onPress={() => setDobSaved(false)}>
                  <Text style={styles.changeLink}>Change</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <TextInput
                  style={styles.panInput}
                  placeholder="DD/MM/YYYY"
                  placeholderTextColor="#999"
                  value={dob}
                  onChangeText={(t) => { setDob(t); setDobError(null); }}
                  keyboardType="numeric"
                  maxLength={10}
                  editable={!dobSaving}
                />
                {dobError && <Text style={styles.errorText}>{dobError}</Text>}
                <TouchableOpacity
                  style={[styles.secondaryBtn, dobSaving && styles.btnDisabled]}
                  onPress={handleSaveDOB}
                  disabled={dobSaving}
                >
                  {dobSaving
                    ? <ActivityIndicator color="#fff" />
                    : <Text style={styles.primaryBtnText}>Save Date of Birth</Text>}
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </View>

      {/* ── Step 2 — Inbound address ───────────────────────────── */}
      <View style={[styles.step, !step2Enabled && styles.stepDisabled]}>
        <View style={styles.stepHeader}>
          <View style={[styles.stepNum, !step2Enabled && styles.stepNumGray, !!inboundEmail && styles.stepNumDone]}>
            <Text style={styles.stepNumText}>{inboundEmail ? '✓' : '2'}</Text>
          </View>
          <View style={styles.stepTitleWrap}>
            <Text style={[styles.stepLabel, !step2Enabled && styles.stepTitleGray]}>Step 2</Text>
            <Text style={[styles.stepTitle, !step2Enabled && styles.stepTitleGray]}>
              Get your import address
            </Text>
          </View>
        </View>
        <View style={styles.stepBody}>
          <Text style={[styles.stepDesc, !step2Enabled && styles.stepDescGray]}>
            A permanent address unique to you. Forward any CAS email to it and transactions
            import automatically. You only generate this once.
          </Text>
          {sessionLoading ? (
            <ActivityIndicator style={{ marginTop: 8 }} />
          ) : inboundEmail ? (
            <CopyBox label="Your import address" value={inboundEmail} styles={styles} embedded />
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
          <View style={styles.stepTitleWrap}>
            <Text style={[styles.stepLabel, !step3Enabled && styles.stepTitleGray]}>Step 3</Text>
            <Text style={[styles.stepTitle, !step3Enabled && styles.stepTitleGray]}>
              Request your CAS
            </Text>
          </View>
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
      <Text style={styles.altTitle}>Prefer manual upload?</Text>
      <TouchableOpacity style={styles.altCard} onPress={() => router.push('/onboarding/pdf')}>
        <Text style={styles.altCardTitle}>Upload a CAS PDF</Text>
        <Text style={styles.altCardSub}>Use this if you already downloaded the statement.</Text>
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
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  hero: {
    marginHorizontal: isClearLens ? ClearLensSpacing.md : 0,
    marginTop: isClearLens ? ClearLensSpacing.sm : 0,
    paddingTop: isClearLens ? ClearLensSpacing.lg : 56,
    paddingHorizontal: isClearLens ? ClearLensSpacing.lg : Spacing.lg,
    paddingBottom: isClearLens ? ClearLensSpacing.lg : Spacing.xl + Spacing.sm,
    gap: isClearLens ? ClearLensSpacing.md : Spacing.lg,
    backgroundColor: isClearLens ? Colors.surface : undefined,
    borderWidth: isClearLens ? 1 : 0,
    borderColor: isClearLens ? Colors.border : undefined,
    borderRadius: isClearLens ? ClearLensRadii.lg : 0,
    ...(isClearLens ? ClearLensShadow : {}),
  },
  heroCopy: { gap: Spacing.sm },
  heroTitle: {
    ...(isClearLens ? ClearLensTypography.h1 : Typography.h1),
    color: isClearLens ? Colors.textPrimary : Colors.textOnDark,
    fontWeight: '700',
  },
  heroSubtitle: {
    ...(isClearLens ? ClearLensTypography.body : Typography.body),
    color: isClearLens ? Colors.textSecondary : 'rgba(255,255,255,0.8)',
  },
  heroPoints: { gap: Spacing.sm },
  heroPointRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
  heroPointIcon: { color: '#9fe6d2', fontSize: 16, lineHeight: 20 },
  heroCheckIcon: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ClearLensColors.emerald,
  },
  heroPointText: {
    ...(isClearLens ? ClearLensTypography.bodySmall : Typography.bodySmall),
    color: isClearLens ? Colors.textSecondary : 'rgba(255,255,255,0.75)',
    flex: 1,
  },

  sectionCard: {
    marginHorizontal: isClearLens ? ClearLensSpacing.md : Spacing.lg,
    marginTop: isClearLens ? 0 : -Radii.xl,
    backgroundColor: Colors.surface,
    borderRadius: isClearLens ? ClearLensRadii.lg : Radii.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: isClearLens ? ClearLensSpacing.lg : Spacing.lg,
    gap: isClearLens ? ClearLensSpacing.md : Spacing.md,
    ...(isClearLens ? ClearLensShadow : {}),
  },
  sectionHeader: { gap: Spacing.xs },
  sectionEyebrow: {
    ...(isClearLens ? ClearLensTypography.label : Typography.label),
    color: Colors.primary,
    textTransform: 'uppercase',
  },
  sectionTitle: {
    ...(isClearLens ? ClearLensTypography.h3 : Typography.h3),
    color: Colors.textPrimary,
    fontWeight: '700',
  },

  // Setup-complete view
  refreshBtn: {
    backgroundColor: Colors.primary,
    borderRadius: isClearLens ? ClearLensRadii.full : Radii.md,
    paddingVertical: 16,
    alignItems: 'center',
  },
  refreshBtnText: { color: Colors.textOnDark, fontWeight: '700', fontSize: 16 },
  requestedBanner: {
    backgroundColor: Colors.primaryLight, borderWidth: 1, borderColor: '#c7eadf',
    borderRadius: isClearLens ? ClearLensRadii.md : Radii.md,
    padding: 14,
  },
  requestedText: { ...Typography.bodySmall, color: Colors.primaryDark },

  tipToggle: { paddingVertical: 4 },
  tipToggleText: { fontSize: 13, color: Colors.primary, fontWeight: '600' },
  tipCard: {
    marginHorizontal: isClearLens ? ClearLensSpacing.md : Spacing.lg,
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    borderRadius: isClearLens ? ClearLensRadii.lg : Radii.lg,
    padding: isClearLens ? ClearLensSpacing.lg : Spacing.lg,
    gap: Spacing.sm,
    ...(isClearLens ? ClearLensShadow : {}),
  },
  tipTitle: { ...Typography.label, color: Colors.primary, textTransform: 'uppercase' },
  tipStep: { ...Typography.bodySmall, color: Colors.textSecondary },
  tipNote: { fontSize: 12, color: Colors.textTertiary, fontStyle: 'italic', marginTop: 4 },

  portfolioBtn: {
    marginHorizontal: isClearLens ? ClearLensSpacing.md : Spacing.lg,
    backgroundColor: Colors.primary,
    borderRadius: isClearLens ? ClearLensRadii.full : Radii.md,
    paddingVertical: 14, alignItems: 'center',
  },
  portfolioBtnText: { color: Colors.textOnDark, fontWeight: '700', fontSize: 15 },
  resetLink: { alignItems: 'center', paddingVertical: 8 },
  resetLinkText: { fontSize: 13, color: Colors.textTertiary },

  // First-time setup
  step: {
    marginHorizontal: isClearLens ? ClearLensSpacing.md : Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: isClearLens ? ClearLensRadii.lg : Radii.lg,
    backgroundColor: Colors.surface,
    padding: isClearLens ? ClearLensSpacing.lg : Spacing.lg,
    ...(isClearLens ? ClearLensShadow : {}),
  },
  stepDisabled: { borderColor: Colors.borderLight, backgroundColor: Colors.surfaceAlt },
  stepHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  stepNum: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center',
  },
  stepNumDone: { backgroundColor: Colors.positive },
  stepNumGray: { backgroundColor: '#cbd5e1' },
  stepNumText: { color: Colors.textOnDark, fontSize: 13, fontWeight: '700' },
  stepTitleWrap: { gap: 2 },
  stepLabel: { ...(isClearLens ? ClearLensTypography.label : Typography.label), color: Colors.primary, textTransform: 'uppercase' },
  stepTitle: { ...(isClearLens ? ClearLensTypography.h3 : Typography.h3), color: Colors.textPrimary, fontWeight: '700' },
  stepTitleGray: { color: Colors.textTertiary },
  stepBody: { gap: 10 },
  stepDesc: { ...(isClearLens ? ClearLensTypography.body : Typography.body), color: Colors.textSecondary },
  stepDescGray: { color: Colors.textTertiary },

  panInput: {
    height: 52,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: isClearLens ? ClearLensRadii.md : Radii.md,
    paddingHorizontal: 14, fontSize: 16, color: Colors.textPrimary, backgroundColor: Colors.surfaceAlt,
    letterSpacing: 2,
  },
  emailInput: {
    height: 52,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: isClearLens ? ClearLensRadii.md : Radii.md,
    paddingHorizontal: 14, fontSize: 15, color: Colors.textPrimary, backgroundColor: Colors.surfaceAlt,
  },
  inputDisabled: { opacity: 0.4 },
  errorText: { color: Colors.negative, fontSize: 13 },

  savedRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  savedText: { fontSize: 14, color: Colors.positive, fontWeight: '600', flex: 1 },
  changeLink: { fontSize: 13, color: Colors.primary, fontWeight: '600' },

  dobSection: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: 12,
    gap: 6,
    marginTop: 4,
  },
  dobLabel: { ...(isClearLens ? ClearLensTypography.label : Typography.label), color: Colors.textSecondary, textTransform: 'uppercase' },
  dobHint: { ...(isClearLens ? ClearLensTypography.bodySmall : Typography.bodySmall), color: Colors.textTertiary },
  secondaryBtn: {
    backgroundColor: Colors.primaryDark,
    borderRadius: isClearLens ? ClearLensRadii.full : Radii.md,
    paddingVertical: 12,
    alignItems: 'center' as const,
  },

  copyBox: {
    marginHorizontal: isClearLens ? ClearLensSpacing.md : Spacing.lg,
    backgroundColor: Colors.surface,
    borderRadius: isClearLens ? ClearLensRadii.lg : Radii.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: isClearLens ? ClearLensSpacing.md : Spacing.md,
    gap: 8,
    ...(isClearLens ? ClearLensShadow : {}),
  },
  copyBoxEmbedded: {
    marginHorizontal: 0,
    backgroundColor: Colors.surfaceAlt,
    shadowOpacity: 0,
    elevation: 0,
  },
  copyLabel: { ...(isClearLens ? ClearLensTypography.label : Typography.label), color: Colors.textTertiary, textTransform: 'uppercase' },
  copyRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  copyValue: { flex: 1, fontSize: 12, color: Colors.textSecondary },
  mono: { fontFamily: 'Courier' },
  copyBtn: {
    backgroundColor: Colors.primaryLight,
    borderRadius: isClearLens ? ClearLensRadii.full : Radii.sm,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  copyBtnText: { fontSize: 12, fontWeight: '600', color: Colors.primaryDark },

  primaryBtn: {
    backgroundColor: Colors.primary,
    borderRadius: isClearLens ? ClearLensRadii.full : Radii.md,
    paddingVertical: 14,
    alignItems: 'center',
  },
  btnDisabled: { opacity: 0.5 },
  primaryBtnText: { color: Colors.textOnDark, fontWeight: '700', fontSize: 14 },

  hintCard: {
    backgroundColor: Colors.primaryLight, borderWidth: 1, borderColor: '#c7eadf',
    borderRadius: isClearLens ? ClearLensRadii.md : Radii.md,
    padding: 14,
    gap: 8,
  },
  hintTitle: { fontSize: 13, fontWeight: '700', color: Colors.primaryDark },
  hintItem: { fontSize: 13, color: Colors.primaryDark, lineHeight: 20 },
  bold: { fontWeight: '700' },

  altTitle: {
    marginHorizontal: isClearLens ? ClearLensSpacing.md : Spacing.lg,
    marginTop: 8,
    ...(isClearLens ? ClearLensTypography.label : Typography.label),
    color: Colors.textTertiary,
    textTransform: 'uppercase',
  },
  altCard: {
    marginHorizontal: isClearLens ? ClearLensSpacing.md : Spacing.lg,
    borderWidth: 1, borderColor: Colors.border,
    borderRadius: isClearLens ? ClearLensRadii.lg : Radii.lg,
    padding: isClearLens ? ClearLensSpacing.lg : Spacing.lg,
    gap: 6,
    backgroundColor: Colors.surface,
    ...(isClearLens ? ClearLensShadow : {}),
  },
  altCardTitle: { ...(isClearLens ? ClearLensTypography.h3 : Typography.h3), color: Colors.textPrimary, fontWeight: '700' },
  altCardSub: { ...(isClearLens ? ClearLensTypography.bodySmall : Typography.bodySmall), color: Colors.textSecondary },
  });
}
