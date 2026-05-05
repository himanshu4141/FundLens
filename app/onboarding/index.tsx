import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  type AppStateStatus,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import * as WebBrowser from 'expo-web-browser';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/src/lib/supabase';
import { useSession } from '@/src/hooks/useSession';
import { FolioLensLogo } from '@/src/components/clearLens/FolioLensLogo';
import { DesktopFormFrame } from '@/src/components/responsive';
import { useClearLensTokens } from '@/src/context/ThemeContext';
import {
  ClearLensFonts,
  ClearLensRadii,
  ClearLensShadow,
  ClearLensSpacing,
  ClearLensTypography,
  type ClearLensTokens,
} from '@/src/constants/clearLensTheme';
import {
  EMPTY_DRAFT,
  type OnboardingDraft,
  type OnboardingStep,
  clearOnboardingDraft,
  isValidDob,
  isValidPan,
  loadOnboardingDraft,
  reduceOnboarding,
  saveOnboardingDraft,
} from '@/src/utils/onboardingDraft';
import { uploadCasPdf } from '@/src/utils/casPdfUpload';

type WizardStyles = ReturnType<typeof makeStyles>;
type Cl = ClearLensTokens['colors'];

const STEP_ORDER: OnboardingStep[] = ['welcome', 'identity', 'import', 'done'];

// Both CAMS and KFintech issue a combined Consolidated Account Statement
// covering every AMC (regardless of which RTA serviced the AMC). CAMS Online
// is the recommended path because the form is a single page and asks for no
// login — just PAN + email + DOB. KFintech also works but the flow is more
// involved. MFCentral was the previous recommendation but offers no
// advantage over CAMS for the CAS request itself and forces an account login.
const PORTAL_OPTIONS: {
  id: string;
  name: string;
  url: string;
  description: string;
  recommended?: boolean;
}[] = [
  {
    id: 'cams',
    name: 'CAMS Online',
    url: 'https://www.camsonline.com/Investors/Statements/Consolidated-Account-Statement',
    description: 'Recommended — no login. Just PAN + email; the CAS arrives in 1–2 minutes.',
    recommended: true,
  },
  {
    id: 'kfintech',
    name: 'KFintech',
    url: 'https://mfs.kfintech.com/investor/General/ConsolidatedAccountStatement',
    description: 'Also works — the CAS is combined and covers every AMC. Mutual Funds → CAS → Email request.',
  },
];

export default function OnboardingScreen() {
  return (
    <DesktopFormFrame>
      <OnboardingWizard />
    </DesktopFormFrame>
  );
}

// DOB display format is DD-MM-YYYY (Indian convention); storage is ISO
// YYYY-MM-DD on user_profile.dob. Parse / format helpers keep the boundary
// thin.
const DOB_DISPLAY_RE = /^(\d{2})-(\d{2})-(\d{4})$/;

function parseDobDisplay(value: string): string | null {
  const m = DOB_DISPLAY_RE.exec(value);
  if (!m) return null;
  const [, dd, mm, yyyy] = m;
  return `${yyyy}-${mm}-${dd}`;
}

function formatDobDisplay(iso: string): string {
  const parts = iso.split('-');
  if (parts.length !== 3) return iso;
  const [yyyy, mm, dd] = parts;
  return `${dd}-${mm}-${yyyy}`;
}

// Auto-insert dashes as the user types, so they don't have to remember the
// hyphens (cap to DD-MM-YYYY).
function maskDobInput(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}-${digits.slice(2)}`;
  return `${digits.slice(0, 2)}-${digits.slice(2, 4)}-${digits.slice(4)}`;
}

async function fetchSavedProfile(userId: string): Promise<SavedProfile | null> {
  const { data } = await supabase
    .from('user_profile')
    .select('pan, dob, kfintech_email')
    .eq('user_id', userId)
    .maybeSingle();
  return data ?? null;
}

interface SavedProfile {
  pan: string | null;
  dob: string | null;
  kfintech_email: string | null;
}

function OnboardingWizard() {
  const router = useRouter();
  const { session } = useSession();
  const tokens = useClearLensTokens();
  const cl = tokens.colors;
  const styles = useMemo(() => makeStyles(tokens), [tokens]);
  const [draft, dispatch] = useReducer(reduceOnboarding, EMPTY_DRAFT);
  const [hydrated, setHydrated] = useState(false);

  // Pull saved PAN / DOB / email from `user_profile` so the wizard can
  // skip Welcome (when PAN saved) and Identity (when both PAN + DOB saved),
  // and lock any field already set so a returning user can't accidentally
  // overwrite it.
  const { data: profile, isLoading: profileLoading } = useQuery<SavedProfile | null>({
    queryKey: ['user-profile', session?.user.id],
    queryFn: () => fetchSavedProfile(session!.user.id),
    enabled: !!session?.user.id,
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const saved = await loadOnboardingDraft();
      if (cancelled) return;
      const initialEmail = session?.user.email ?? '';
      const seed: OnboardingDraft = saved
        ? { ...saved, email: saved.email || initialEmail }
        : { ...EMPTY_DRAFT, email: initialEmail };

      // If user_profile has saved values, hydrate the draft with them so the
      // form reflects the DB state and the saved-locked rendering kicks in.
      const merged: OnboardingDraft = {
        ...seed,
        pan: (profile?.pan ?? seed.pan) || '',
        dob: profile?.dob ?? seed.dob,
        email: profile?.kfintech_email || seed.email,
      };

      // Decide initial step based on what's already saved on user_profile.
      // PAN saved → skip Welcome. PAN + DOB saved → skip Identity too.
      let initialStep: OnboardingStep = merged.step;
      if (initialStep === 'welcome' && profile?.pan) {
        initialStep = profile.dob ? 'import' : 'identity';
      } else if (initialStep === 'identity' && profile?.pan && profile.dob) {
        initialStep = 'import';
      }

      dispatch({
        type: 'hydrate',
        draft: { ...merged, step: initialStep },
      });
      setHydrated(true);
    })();
    return () => {
      cancelled = true;
    };
    // We deliberately wait until the user_profile query resolves before
    // hydrating — `profile` is part of the deps so a late-arriving DB row
    // still drives the right initial step.
  }, [session?.user.email, profile]);

  useEffect(() => {
    if (!hydrated) return;
    void saveOnboardingDraft(draft);
  }, [draft, hydrated]);

  const currentIndex = STEP_ORDER.indexOf(draft.step);

  function handleAdvance() {
    if (draft.step === 'welcome') {
      // Skip Identity entirely if both fields already saved.
      if (profile?.pan && profile.dob) {
        return dispatch({ type: 'goto', step: 'import' });
      }
      return dispatch({ type: 'goto', step: 'identity' });
    }
    if (draft.step === 'identity') return dispatch({ type: 'goto', step: 'import' });
  }

  function handleBack() {
    if (draft.step === 'identity') return dispatch({ type: 'goto', step: 'welcome' });
    if (draft.step === 'import') {
      if (profile?.pan && profile.dob) {
        return dispatch({ type: 'goto', step: 'welcome' });
      }
      return dispatch({ type: 'goto', step: 'identity' });
    }
  }

  async function handleFinish() {
    await clearOnboardingDraft();
    router.replace('/(tabs)');
  }

  if (!hydrated || profileLoading) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={cl.emerald} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.topBar}>
        {draft.step !== 'welcome' && draft.step !== 'done' ? (
          <TouchableOpacity
            onPress={handleBack}
            hitSlop={8}
            style={styles.iconButton}
            activeOpacity={0.76}
          >
            <Ionicons name="chevron-back" size={22} color={cl.navy} />
          </TouchableOpacity>
        ) : (
          <View style={styles.iconButton} />
        )}
        <ProgressPills currentIndex={currentIndex} styles={styles} />
        <View style={styles.iconButton} />
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {draft.step === 'welcome' && (
          <WelcomeStep onContinue={handleAdvance} styles={styles} cl={cl} />
        )}
        {draft.step === 'identity' && (
          <IdentityStep
            draft={draft}
            dispatch={dispatch}
            session={session}
            onContinue={handleAdvance}
            lockedPan={profile?.pan ?? null}
            lockedDob={profile?.dob ?? null}
            styles={styles}
            cl={cl}
            tokens={tokens}
          />
        )}
        {draft.step === 'import' && (
          <ImportStep
            draft={draft}
            dispatch={dispatch}
            onSkip={() => dispatch({ type: 'goto', step: 'done' })}
            styles={styles}
            cl={cl}
            tokens={tokens}
          />
        )}
        {draft.step === 'done' && (
          <DoneStep
            draft={draft}
            onFinish={handleFinish}
            styles={styles}
            cl={cl}
          />
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function ProgressPills({
  currentIndex,
  styles,
}: {
  currentIndex: number;
  styles: WizardStyles;
}) {
  return (
    <View style={styles.pillsRow}>
      {STEP_ORDER.map((step, idx) => (
        <View
          key={step}
          style={[
            styles.pill,
            idx <= currentIndex ? styles.pillActive : styles.pillInactive,
          ]}
        />
      ))}
    </View>
  );
}

function WelcomeStep({
  onContinue,
  styles,
  cl,
}: {
  onContinue: () => void;
  styles: WizardStyles;
  cl: Cl;
}) {
  return (
    <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
      <LinearGradient colors={[cl.heroSurface, cl.slate]} style={styles.hero}>
        <FolioLensLogo size={36} light showWordmark />
        <Text style={styles.heroHeadline}>Let&apos;s pull in your portfolio.</Text>
        <Text style={styles.heroSubhead}>
          We need your Consolidated Account Statement (CAS) — a free statement
          from CAMS or KFintech that lists every mutual fund you own.
        </Text>
      </LinearGradient>

      <View style={styles.bullets}>
        <Bullet icon="trending-up-outline" text="See your real return (XIRR) instantly" styles={styles} cl={cl} />
        <Bullet icon="pie-chart-outline" text="Sector + asset exposure across AMCs" styles={styles} cl={cl} />
        <Bullet icon="git-branch-outline" text="Money trail of every transaction" styles={styles} cl={cl} />
      </View>

      <View style={styles.privacyCard}>
        <Ionicons name="shield-checkmark-outline" size={18} color={cl.emeraldDeep} />
        <Text style={styles.privacyText}>
          Read-only. Stored encrypted. Never shared with third parties.
        </Text>
      </View>

      <View style={styles.footerSpace} />

      <PrimaryButton label="Get started" onPress={onContinue} styles={styles} cl={cl} />
    </ScrollView>
  );
}

function IdentityStep({
  draft,
  dispatch,
  session,
  onContinue,
  lockedPan,
  lockedDob,
  styles,
  cl,
  tokens,
}: {
  draft: OnboardingDraft;
  dispatch: React.Dispatch<
    | { type: 'set_pan'; pan: string }
    | { type: 'set_dob'; dob: string | null }
    | { type: 'set_email'; email: string }
    | { type: 'goto'; step: OnboardingStep }
  >;
  session: ReturnType<typeof useSession>['session'];
  onContinue: () => void;
  /** PAN already saved on user_profile — when set, the field renders read-only. */
  lockedPan: string | null;
  /** DOB already saved on user_profile — when set, the field renders read-only. */
  lockedDob: string | null;
  styles: WizardStyles;
  cl: Cl;
  tokens: ClearLensTokens;
}) {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // dobText is the on-screen DD-MM-YYYY string; draft.dob (and the DB) are ISO.
  const [dobText, setDobText] = useState(draft.dob ? formatDobDisplay(draft.dob) : '');

  const panLocked = !!lockedPan;
  const dobLocked = !!lockedDob;

  const dobIso = useMemo(
    () => (dobText.length > 0 ? parseDobDisplay(dobText) : null),
    [dobText],
  );

  const panValid = panLocked || isValidPan(draft.pan);
  const dobValid =
    dobLocked || dobText.length === 0 || (dobIso !== null && isValidDob(dobIso));
  const emailValid = /\S+@\S+\.\S+/.test(draft.email);
  const canContinue = panValid && dobValid && emailValid && !saving;

  async function handleContinue() {
    if (!canContinue || !session?.user.id) return;
    setSaving(true);
    setError(null);

    const dobValue = dobLocked
      ? lockedDob
      : dobText.length > 0
        ? dobIso
        : null;
    if (!dobLocked && dobText.length > 0 && dobValue) {
      dispatch({ type: 'set_dob', dob: dobValue });
    }

    // Build the upsert payload, but never overwrite a saved-locked PAN.
    // We send the locked value back so the row's NOT-NULL constraint stays
    // happy and the upsert doesn't accidentally null out a stored value.
    const upsertPayload: {
      user_id: string;
      pan: string;
      dob: string | null;
      kfintech_email: string;
    } = {
      user_id: session.user.id,
      pan: panLocked ? lockedPan! : draft.pan,
      dob: dobValue,
      kfintech_email: draft.email,
    };

    const { error: upsertError } = await supabase
      .from('user_profile')
      .upsert(upsertPayload, { onConflict: 'user_id' });

    setSaving(false);
    if (upsertError) {
      setError(upsertError.message || 'Could not save your details. Try again.');
      return;
    }
    queryClient.invalidateQueries({ queryKey: ['user-profile', session.user.id] });
    onContinue();
  }

  return (
    <ScrollView
      contentContainerStyle={styles.scroll}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.stepHeader}>
        <Text style={styles.stepTitle}>Tell us who you are</Text>
        <Text style={styles.stepBody}>
          {panLocked
            ? 'These details unlock your CAS PDF and are saved permanently.'
            : 'Your PAN unlocks the CAS PDF. Date of birth is only needed if you import a CDSL or NSDL statement.'}
        </Text>
      </View>

      <View style={styles.field}>
        <View style={styles.fieldLabelRow}>
          <Text style={styles.fieldLabel}>PAN</Text>
          {panLocked ? (
            <View style={styles.savedBadge}>
              <Ionicons name="lock-closed" size={11} color={cl.emeraldDeep} />
              <Text style={styles.savedBadgeText}>Saved</Text>
            </View>
          ) : null}
        </View>
        {panLocked ? (
          <View style={styles.lockedField}>
            <Text style={styles.lockedFieldText}>{lockedPan}</Text>
          </View>
        ) : (
          <TextInput
            value={draft.pan}
            onChangeText={(value) => dispatch({ type: 'set_pan', pan: value })}
            placeholder="ABCDE1234F"
            placeholderTextColor={cl.textTertiary}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={10}
            style={styles.input}
          />
        )}
        {panLocked ? (
          <Text style={styles.fieldHint}>PAN is saved and cannot be changed in-app.</Text>
        ) : draft.pan.length > 0 && !panValid ? (
          <Text style={styles.fieldError}>
            PAN should look like ABCDE1234F (5 letters, 4 digits, 1 letter).
          </Text>
        ) : (
          <Text style={styles.fieldHint}>
            10 characters. We use this to unlock CAMS / KFintech / MFCentral PDFs.
          </Text>
        )}
      </View>

      <View style={styles.field}>
        <View style={styles.fieldLabelRow}>
          <Text style={styles.fieldLabel}>Date of birth (optional)</Text>
          {dobLocked ? (
            <View style={styles.savedBadge}>
              <Ionicons name="lock-closed" size={11} color={cl.emeraldDeep} />
              <Text style={styles.savedBadgeText}>Saved</Text>
            </View>
          ) : null}
        </View>
        {dobLocked ? (
          <View style={styles.lockedField}>
            <Text style={styles.lockedFieldText}>{formatDobDisplay(lockedDob!)}</Text>
          </View>
        ) : (
          <TextInput
            value={dobText}
            onChangeText={(value) => {
              const masked = maskDobInput(value);
              setDobText(masked);
              if (masked.length === 0) {
                dispatch({ type: 'set_dob', dob: null });
              } else {
                const iso = parseDobDisplay(masked);
                if (iso && isValidDob(iso)) {
                  dispatch({ type: 'set_dob', dob: iso });
                }
              }
            }}
            placeholder="DD-MM-YYYY"
            placeholderTextColor={cl.textTertiary}
            keyboardType="number-pad"
            inputMode="numeric"
            maxLength={10}
            autoCorrect={false}
            autoCapitalize="none"
            style={styles.input}
          />
        )}
        {dobLocked ? (
          <Text style={styles.fieldHint}>Date of birth is saved and cannot be changed in-app.</Text>
        ) : dobText.length > 0 && !dobValid ? (
          <Text style={styles.fieldError}>Use DD-MM-YYYY format, e.g. 12-05-1990.</Text>
        ) : (
          <Text style={styles.fieldHint}>Required only for CDSL / NSDL CAS PDFs.</Text>
        )}
      </View>

      <View style={styles.field}>
        <Text style={styles.fieldLabel}>Email</Text>
        <TextInput
          value={draft.email}
          onChangeText={(value) => dispatch({ type: 'set_email', email: value })}
          placeholder="you@example.com"
          placeholderTextColor={cl.textTertiary}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          style={styles.input}
        />
        <Text style={styles.fieldHint}>
          We&apos;ll send your CAS reminders here. Pre-filled from your sign-in.
        </Text>
      </View>

      {error ? (
        <View style={styles.errorBox}>
          <Ionicons
            name="warning-outline"
            size={16}
            color={tokens.semantic.sentiment.negativeText}
          />
          <Text style={styles.errorBoxText}>{error}</Text>
        </View>
      ) : null}

      <View style={styles.footerSpace} />
      <PrimaryButton
        label={saving ? 'Saving…' : 'Continue'}
        onPress={handleContinue}
        disabled={!canContinue}
        loading={saving}
        styles={styles}
        cl={cl}
      />
    </ScrollView>
  );
}

type ImportSubScreen = 'choose' | 'request';

function ImportStep({
  draft,
  dispatch,
  onSkip,
  styles,
  cl,
  tokens,
}: {
  draft: OnboardingDraft;
  dispatch: React.Dispatch<
    | { type: 'import_complete'; funds: number; transactions: number }
    | { type: 'goto'; step: OnboardingStep }
  >;
  onSkip: () => void;
  styles: WizardStyles;
  cl: Cl;
  tokens: ClearLensTokens;
}) {
  const [sub, setSub] = useState<ImportSubScreen>('choose');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [browserVisited, setBrowserVisited] = useState(false);
  const appState = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next) => {
      if (appState.current === 'background' && next === 'active' && browserVisited) {
        // No state change needed — banner condition is already true.
      }
      appState.current = next;
    });
    return () => subscription.remove();
  }, [browserVisited]);

  async function handleUpload() {
    setError(null);
    let picked: DocumentPicker.DocumentPickerResult;
    try {
      picked = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
        base64: false,
      });
    } catch {
      return;
    }
    if (picked.canceled || !picked.assets?.[0]) return;

    setUploading(true);
    try {
      const result = await uploadCasPdf(picked.assets[0]);
      dispatch({
        type: 'import_complete',
        funds: result.funds,
        transactions: result.transactions,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Upload failed.';
      setError(
        /read/i.test(msg)
          ? 'Could not read the PDF file. Re-download and try again.'
          : msg,
      );
    } finally {
      setUploading(false);
    }
  }

  async function handleOpenPortal(url: string) {
    try {
      setBrowserVisited(true);
      if (Platform.OS === 'web') {
        await Linking.openURL(url);
      } else {
        await WebBrowser.openBrowserAsync(url, {
          presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
        });
      }
    } catch (err) {
      Alert.alert('Could not open portal', err instanceof Error ? err.message : 'Try again.');
    }
  }

  if (sub === 'request') {
    return (
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.stepHeader}>
          <Pressable onPress={() => setSub('choose')} style={styles.miniBack} hitSlop={6}>
            <Ionicons name="chevron-back" size={18} color={cl.emeraldDeep} />
            <Text style={styles.miniBackText}>Import options</Text>
          </Pressable>
          <Text style={styles.stepTitle}>Get a fresh CAS</Text>
          <Text style={styles.stepBody}>
            Pick a portal, log in, and request your statement. It lands in
            your registered email in 1–2 minutes.
          </Text>
        </View>

        {PORTAL_OPTIONS.map((portal) => (
          <Pressable
            key={portal.id}
            onPress={() => handleOpenPortal(portal.url)}
            style={({ pressed }) => [styles.portalCard, pressed && styles.portalCardPressed]}
          >
            <View style={styles.portalIcon}>
              <Ionicons name="open-outline" size={22} color={cl.emeraldDeep} />
            </View>
            <View style={styles.portalCopy}>
              <View style={styles.portalNameRow}>
                <Text style={styles.portalName}>{portal.name}</Text>
                {portal.recommended ? (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>RECOMMENDED</Text>
                  </View>
                ) : null}
              </View>
              <Text style={styles.portalDescription}>{portal.description}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={cl.textTertiary} />
          </Pressable>
        ))}

        <View style={styles.tipsCard}>
          <Text style={styles.tipsHeading}>Once you have the email</Text>
          <Text style={styles.tipsLine}>1. Open the email on this device.</Text>
          <Text style={styles.tipsLine}>2. Save the PDF (long-press → Save to Files / Downloads).</Text>
          <Text style={styles.tipsLine}>3. Come back to FolioLens and tap Upload below.</Text>
        </View>

        {(browserVisited || Platform.OS === 'web') ? (
          <View style={styles.banner}>
            <Ionicons name="checkmark-circle" size={18} color={cl.emeraldDeep} />
            <Text style={styles.bannerText}>Got the email? Upload your CAS now.</Text>
          </View>
        ) : null}

        {error ? (
          <View style={styles.errorBox}>
            <Ionicons
              name="warning-outline"
              size={16}
              color={tokens.semantic.sentiment.negativeText}
            />
            <Text style={styles.errorBoxText}>{error}</Text>
          </View>
        ) : null}

        <View style={styles.footerSpace} />

        <PrimaryButton
          label={uploading ? 'Importing…' : 'Upload the PDF'}
          onPress={handleUpload}
          loading={uploading}
          disabled={uploading}
          styles={styles}
          cl={cl}
        />
        <SecondaryButton label="I'll do this later" onPress={onSkip} styles={styles} />
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
      <View style={styles.stepHeader}>
        <Text style={styles.stepTitle}>How would you like to start?</Text>
        <Text style={styles.stepBody}>You can always change this later in Settings.</Text>
      </View>

      <ChoiceCard
        title="Upload a CAS PDF"
        description="Got one already? Upload it now and we'll do the rest."
        icon="cloud-upload-outline"
        recommended
        onPress={handleUpload}
        styles={styles}
        cl={cl}
      />
      <ChoiceCard
        title="Get a fresh CAS"
        description="We'll show you exactly what to do. Takes about 2 minutes."
        icon="paper-plane-outline"
        onPress={() => setSub('request')}
        styles={styles}
        cl={cl}
      />

      {uploading ? (
        <View style={styles.uploadingRow}>
          <ActivityIndicator color={cl.emeraldDeep} />
          <Text style={styles.uploadingText}>Importing your CAS…</Text>
        </View>
      ) : null}

      {error ? (
        <View style={styles.errorBox}>
          <Ionicons
            name="warning-outline"
            size={16}
            color={tokens.semantic.sentiment.negativeText}
          />
          <Text style={styles.errorBoxText}>{error}</Text>
        </View>
      ) : null}

      <View style={styles.footerSpace} />
      <SecondaryButton label="I'll do this later" onPress={onSkip} styles={styles} />
      {/* Reference draft to keep the prop in the API for future steps. */}
      <View style={{ display: 'none' }}>{draft.pan ? null : null}</View>
    </ScrollView>
  );
}

function DoneStep({
  draft,
  onFinish,
  styles,
  cl,
}: {
  draft: OnboardingDraft;
  onFinish: () => void;
  styles: WizardStyles;
  cl: Cl;
}) {
  const result = draft.importResult;

  return (
    <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
      <View style={styles.successHero}>
        <View style={styles.successIcon}>
          <Ionicons name="checkmark-circle" size={56} color={cl.emeraldDeep} />
        </View>
        <Text style={styles.stepTitle}>Your portfolio is ready</Text>
        {result ? (
          <Text style={styles.stepBody}>
            Imported{' '}
            <Text style={styles.bold}>
              {result.funds} fund{result.funds === 1 ? '' : 's'}
            </Text>{' '}
            and{' '}
            <Text style={styles.bold}>
              {result.transactions} transaction{result.transactions === 1 ? '' : 's'}
            </Text>
            . XIRR, sector exposure, and Money Trail are calculating now.
          </Text>
        ) : (
          <Text style={styles.stepBody}>
            You can import your CAS anytime from Settings → Restart import.
          </Text>
        )}
      </View>

      <View style={styles.tipsCard}>
        <Text style={styles.tipsHeading}>What&apos;s next</Text>
        <Text style={styles.tipsLine}>• Glance at the home screen for your XIRR vs Nifty 50.</Text>
        <Text style={styles.tipsLine}>• Open Money Trail to inspect every transaction.</Text>
        <Text style={styles.tipsLine}>• Set up auto-refresh later to never re-upload.</Text>
      </View>

      <View style={styles.footerSpace} />
      <PrimaryButton label="Open my portfolio" onPress={onFinish} styles={styles} cl={cl} />
    </ScrollView>
  );
}

function Bullet({
  icon,
  text,
  styles,
  cl,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  text: string;
  styles: WizardStyles;
  cl: Cl;
}) {
  return (
    <View style={styles.bulletRow}>
      <View style={styles.bulletIconWrap}>
        <Ionicons name={icon} size={16} color={cl.emeraldDeep} />
      </View>
      <Text style={styles.bulletText}>{text}</Text>
    </View>
  );
}

function ChoiceCard({
  title,
  description,
  icon,
  recommended,
  onPress,
  styles,
  cl,
}: {
  title: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  recommended?: boolean;
  onPress: () => void;
  styles: WizardStyles;
  cl: Cl;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.choiceCard, pressed && styles.choiceCardPressed]}
    >
      <View style={styles.choiceIconWrap}>
        <Ionicons name={icon} size={24} color={cl.emeraldDeep} />
      </View>
      <View style={styles.choiceCopy}>
        <View style={styles.portalNameRow}>
          <Text style={styles.choiceTitle}>{title}</Text>
          {recommended ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>RECOMMENDED</Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.choiceDescription}>{description}</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={cl.textTertiary} />
    </Pressable>
  );
}

function PrimaryButton({
  label,
  onPress,
  disabled,
  loading,
  styles,
  cl,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  styles: WizardStyles;
  cl: Cl;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      style={[styles.primaryButton, disabled && styles.primaryButtonDisabled]}
      activeOpacity={0.82}
    >
      {loading ? (
        <ActivityIndicator color={cl.textOnDark} />
      ) : (
        <Text style={styles.primaryButtonText}>{label}</Text>
      )}
    </TouchableOpacity>
  );
}

function SecondaryButton({
  label,
  onPress,
  styles,
}: {
  label: string;
  onPress: () => void;
  styles: WizardStyles;
}) {
  return (
    <TouchableOpacity onPress={onPress} style={styles.secondaryButton} activeOpacity={0.76}>
      <Text style={styles.secondaryButtonText}>{label}</Text>
    </TouchableOpacity>
  );
}

function makeStyles(tokens: ClearLensTokens) {
  const cl = tokens.colors;
  return StyleSheet.create({
    flex: { flex: 1 },
    screen: {
      flex: 1,
      backgroundColor: cl.background,
    },
    centered: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: ClearLensSpacing.md,
      paddingVertical: ClearLensSpacing.sm,
    },
    iconButton: {
      width: 36,
      height: 36,
      alignItems: 'center',
      justifyContent: 'center',
    },
    pillsRow: {
      flex: 1,
      flexDirection: 'row',
      gap: 6,
      paddingHorizontal: ClearLensSpacing.md,
    },
    pill: {
      flex: 1,
      height: 4,
      borderRadius: 2,
    },
    pillActive: {
      backgroundColor: cl.emeraldDeep,
    },
    pillInactive: {
      backgroundColor: cl.borderLight,
    },
    scroll: {
      paddingHorizontal: ClearLensSpacing.md,
      paddingBottom: ClearLensSpacing.xxl,
      gap: ClearLensSpacing.md,
    },
    hero: {
      borderRadius: ClearLensRadii.lg,
      padding: ClearLensSpacing.lg,
      gap: ClearLensSpacing.md,
      overflow: 'hidden',
    },
    heroHeadline: {
      ...ClearLensTypography.h1,
      color: cl.textOnDark,
      lineHeight: 32,
    },
    heroSubhead: {
      ...ClearLensTypography.body,
      color: cl.textOnDark,
      opacity: 0.84,
    },
    bullets: {
      gap: ClearLensSpacing.sm,
    },
    bulletRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: ClearLensSpacing.sm,
      paddingHorizontal: ClearLensSpacing.sm,
    },
    bulletIconWrap: {
      width: 32,
      height: 32,
      borderRadius: ClearLensRadii.full,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: cl.mint50,
    },
    bulletText: {
      ...ClearLensTypography.bodySmall,
      flex: 1,
      color: cl.navy,
      fontFamily: ClearLensFonts.semiBold,
    },
    privacyCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: ClearLensSpacing.sm,
      padding: ClearLensSpacing.md,
      borderRadius: ClearLensRadii.md,
      backgroundColor: cl.mint50,
    },
    privacyText: {
      ...ClearLensTypography.caption,
      flex: 1,
      color: cl.emeraldDeep,
      fontFamily: ClearLensFonts.semiBold,
    },
    stepHeader: {
      gap: 6,
      paddingTop: ClearLensSpacing.sm,
    },
    miniBack: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      marginBottom: 4,
    },
    miniBackText: {
      ...ClearLensTypography.caption,
      color: cl.emeraldDeep,
      fontFamily: ClearLensFonts.bold,
    },
    stepTitle: {
      ...ClearLensTypography.h1,
      color: cl.navy,
    },
    stepBody: {
      ...ClearLensTypography.bodySmall,
      color: cl.textSecondary,
    },
    field: {
      gap: 6,
    },
    fieldLabelRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: ClearLensSpacing.sm,
    },
    fieldLabel: {
      ...ClearLensTypography.caption,
      color: cl.textTertiary,
      fontFamily: ClearLensFonts.bold,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
    },
    fieldHint: {
      ...ClearLensTypography.caption,
      color: cl.textTertiary,
    },
    savedBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: ClearLensRadii.sm,
      backgroundColor: cl.mint50,
    },
    savedBadgeText: {
      ...ClearLensTypography.caption,
      fontSize: 9,
      color: cl.emeraldDeep,
      fontFamily: ClearLensFonts.bold,
      letterSpacing: 0.4,
      textTransform: 'uppercase',
    },
    lockedField: {
      minHeight: 50,
      paddingHorizontal: ClearLensSpacing.md,
      borderRadius: ClearLensRadii.md,
      borderWidth: 1,
      borderColor: cl.border,
      backgroundColor: cl.surfaceSoft,
      justifyContent: 'center',
    },
    lockedFieldText: {
      ...ClearLensTypography.body,
      color: cl.navy,
      fontFamily: ClearLensFonts.semiBold,
      letterSpacing: 1,
    },
    fieldError: {
      ...ClearLensTypography.caption,
      color: tokens.semantic.sentiment.negativeText,
    },
    input: {
      ...ClearLensTypography.body,
      minHeight: 50,
      paddingHorizontal: ClearLensSpacing.md,
      borderRadius: ClearLensRadii.md,
      borderWidth: 1,
      borderColor: cl.border,
      backgroundColor: cl.surface,
      color: cl.navy,
    },
    errorBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: ClearLensSpacing.sm,
      padding: ClearLensSpacing.sm,
      borderRadius: ClearLensRadii.md,
      backgroundColor: cl.negativeBg,
    },
    errorBoxText: {
      ...ClearLensTypography.caption,
      flex: 1,
      color: tokens.semantic.sentiment.negativeText,
    },
    choiceCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: ClearLensSpacing.md,
      padding: ClearLensSpacing.md,
      borderRadius: ClearLensRadii.lg,
      backgroundColor: cl.surface,
      borderWidth: 1,
      borderColor: cl.border,
      ...ClearLensShadow,
    },
    choiceCardPressed: {
      backgroundColor: cl.surfaceSoft,
    },
    choiceIconWrap: {
      width: 44,
      height: 44,
      borderRadius: ClearLensRadii.md,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: cl.mint50,
    },
    choiceCopy: {
      flex: 1,
      gap: 4,
    },
    choiceTitle: {
      ...ClearLensTypography.body,
      color: cl.navy,
      fontFamily: ClearLensFonts.bold,
    },
    choiceDescription: {
      ...ClearLensTypography.caption,
      color: cl.textSecondary,
    },
    portalNameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: ClearLensSpacing.sm,
    },
    portalCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: ClearLensSpacing.md,
      padding: ClearLensSpacing.md,
      borderRadius: ClearLensRadii.md,
      backgroundColor: cl.surface,
      borderWidth: 1,
      borderColor: cl.border,
    },
    portalCardPressed: {
      backgroundColor: cl.surfaceSoft,
    },
    portalIcon: {
      width: 40,
      height: 40,
      borderRadius: ClearLensRadii.md,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: cl.mint50,
    },
    portalCopy: {
      flex: 1,
      gap: 2,
    },
    portalName: {
      ...ClearLensTypography.body,
      color: cl.navy,
      fontFamily: ClearLensFonts.bold,
    },
    portalDescription: {
      ...ClearLensTypography.caption,
      color: cl.textSecondary,
    },
    badge: {
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: ClearLensRadii.sm,
      backgroundColor: cl.mint50,
    },
    badgeText: {
      ...ClearLensTypography.caption,
      fontSize: 9,
      color: cl.emeraldDeep,
      fontFamily: ClearLensFonts.bold,
      letterSpacing: 0.4,
    },
    tipsCard: {
      padding: ClearLensSpacing.md,
      borderRadius: ClearLensRadii.md,
      backgroundColor: cl.surfaceSoft,
      gap: 4,
    },
    tipsHeading: {
      ...ClearLensTypography.caption,
      color: cl.textTertiary,
      fontFamily: ClearLensFonts.bold,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
    },
    tipsLine: {
      ...ClearLensTypography.bodySmall,
      color: cl.navy,
    },
    banner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: ClearLensSpacing.sm,
      padding: ClearLensSpacing.md,
      borderRadius: ClearLensRadii.md,
      backgroundColor: cl.mint50,
    },
    bannerText: {
      ...ClearLensTypography.bodySmall,
      flex: 1,
      color: cl.emeraldDeep,
      fontFamily: ClearLensFonts.bold,
    },
    uploadingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: ClearLensSpacing.sm,
      padding: ClearLensSpacing.md,
      borderRadius: ClearLensRadii.md,
      backgroundColor: cl.surfaceSoft,
    },
    uploadingText: {
      ...ClearLensTypography.bodySmall,
      color: cl.navy,
      fontFamily: ClearLensFonts.semiBold,
    },
    successHero: {
      alignItems: 'center',
      gap: ClearLensSpacing.sm,
      paddingTop: ClearLensSpacing.lg,
    },
    successIcon: {
      width: 84,
      height: 84,
      borderRadius: ClearLensRadii.full,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: cl.mint50,
    },
    bold: {
      fontFamily: ClearLensFonts.bold,
      color: cl.navy,
    },
    footerSpace: {
      height: ClearLensSpacing.md,
    },
    primaryButton: {
      minHeight: 52,
      borderRadius: ClearLensRadii.md,
      backgroundColor: cl.emeraldDeep,
      alignItems: 'center',
      justifyContent: 'center',
    },
    primaryButtonDisabled: {
      opacity: 0.5,
    },
    primaryButtonText: {
      ...ClearLensTypography.body,
      color: cl.textOnDark,
      fontFamily: ClearLensFonts.bold,
    },
    secondaryButton: {
      minHeight: 44,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: ClearLensSpacing.sm,
    },
    secondaryButtonText: {
      ...ClearLensTypography.bodySmall,
      color: cl.textTertiary,
      fontFamily: ClearLensFonts.semiBold,
    },
  });
}
