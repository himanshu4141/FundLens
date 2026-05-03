import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Updates from 'expo-updates';
import ExpoConstants from 'expo-constants';
import { supabase } from '@/src/lib/supabase';
import {
  ClearLensColors,
  ClearLensFonts,
  ClearLensRadii,
  ClearLensSemanticColors,
  ClearLensShadow,
  ClearLensSpacing,
  ClearLensTypography,
} from '@/src/constants/clearLensTheme';

export type FeedbackKind = 'feature_request' | 'bug_report';

const KIND_COPY: Record<FeedbackKind, { title: string; subtitle: string; titlePlaceholder: string; bodyPlaceholder: string; submit: string }> = {
  feature_request: {
    title: 'Request a feature',
    subtitle: 'Tell us what would make FolioLens more useful for you.',
    titlePlaceholder: 'In one line — what do you want?',
    bodyPlaceholder: 'Why does this matter to you? What would the ideal flow look like?',
    submit: 'Send request',
  },
  bug_report: {
    title: 'Report an issue',
    subtitle: 'Help us fix what is broken. Detail beats speed.',
    titlePlaceholder: 'In one line — what went wrong?',
    bodyPlaceholder: 'Steps to reproduce, what you expected, what actually happened. Mention any fund or screen.',
    submit: 'Send report',
  },
};

const TITLE_MAX = 200;
const BODY_MAX = 4000;

export function FeedbackSheet({
  visible,
  kind,
  onClose,
}: {
  visible: boolean;
  kind: FeedbackKind | null;
  onClose: () => void;
}) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!visible) {
      // Defer state reset so the closing animation finishes cleanly.
      const timer = setTimeout(() => {
        setTitle('');
        setBody('');
        setError(null);
        setSubmitting(false);
        setSubmitted(false);
      }, 220);
      return () => clearTimeout(timer);
    }
  }, [visible]);

  async function handleSubmit() {
    if (!kind) return;
    const trimmedTitle = title.trim();
    const trimmedBody = body.trim();
    if (trimmedTitle.length === 0 || trimmedBody.length === 0) {
      setError('Please fill in both fields before submitting.');
      return;
    }

    setSubmitting(true);
    setError(null);

    const { data: userResult, error: userError } = await supabase.auth.getUser();
    if (userError || !userResult.user) {
      setSubmitting(false);
      setError('You need to be signed in to send feedback.');
      return;
    }

    const appVersion = ExpoConstants.expoConfig?.version ?? null;
    const updateId = Updates.isEmbeddedLaunch ? null : Updates.updateId;

    const { error: insertError } = await supabase.from('user_feedback').insert({
      user_id: userResult.user.id,
      type: kind,
      title: trimmedTitle.slice(0, TITLE_MAX),
      body: trimmedBody.slice(0, BODY_MAX),
      app_version: appVersion,
      update_id: updateId,
    });

    setSubmitting(false);

    if (insertError) {
      setError(insertError.message || 'Could not send feedback. Please try again.');
      return;
    }

    setSubmitted(true);
  }

  const copy = kind ? KIND_COPY[kind] : null;

  return (
    <Modal visible={visible && copy != null} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.kbAvoid}
          pointerEvents="box-none"
        >
          <Pressable style={styles.sheet} onPress={(event) => event.stopPropagation()}>
            <View style={styles.handle} />

            {submitted ? (
              <SuccessState onClose={onClose} kind={kind!} />
            ) : copy ? (
              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                <View style={styles.header}>
                  <Text style={styles.title}>{copy.title}</Text>
                  <TouchableOpacity onPress={onClose} style={styles.closeButton} activeOpacity={0.76}>
                    <Ionicons name="close" size={20} color={ClearLensColors.navy} />
                  </TouchableOpacity>
                </View>
                <Text style={styles.subtitle}>{copy.subtitle}</Text>

                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>Title</Text>
                  <TextInput
                    value={title}
                    onChangeText={setTitle}
                    placeholder={copy.titlePlaceholder}
                    placeholderTextColor={ClearLensColors.textTertiary}
                    style={styles.titleInput}
                    maxLength={TITLE_MAX}
                  />
                </View>

                <View style={styles.field}>
                  <View style={styles.fieldHeader}>
                    <Text style={styles.fieldLabel}>Details</Text>
                    <Text style={styles.charCount}>{body.length}/{BODY_MAX}</Text>
                  </View>
                  <TextInput
                    value={body}
                    onChangeText={setBody}
                    placeholder={copy.bodyPlaceholder}
                    placeholderTextColor={ClearLensColors.textTertiary}
                    style={styles.bodyInput}
                    multiline
                    textAlignVertical="top"
                    maxLength={BODY_MAX}
                  />
                </View>

                {error ? (
                  <View style={styles.errorBox}>
                    <Ionicons name="warning-outline" size={16} color={ClearLensSemanticColors.sentiment.negativeText} />
                    <Text style={styles.errorText}>{error}</Text>
                  </View>
                ) : null}

                <Text style={styles.footnote}>
                  We attach your account, app version, and OTA update so we can reproduce issues. We never share or sell this data.
                </Text>

                <TouchableOpacity
                  style={[styles.submit, submitting && styles.submitDisabled]}
                  onPress={handleSubmit}
                  disabled={submitting}
                  activeOpacity={0.82}
                >
                  {submitting ? (
                    <ActivityIndicator size="small" color={ClearLensColors.textOnDark} />
                  ) : (
                    <Text style={styles.submitText}>{copy.submit}</Text>
                  )}
                </TouchableOpacity>
              </ScrollView>
            ) : null}
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}

function SuccessState({ kind, onClose }: { kind: FeedbackKind; onClose: () => void }) {
  return (
    <View style={styles.successBlock}>
      <View style={styles.successIcon}>
        <Ionicons name="checkmark-circle" size={48} color={ClearLensColors.emeraldDeep} />
      </View>
      <Text style={styles.successTitle}>
        {kind === 'feature_request' ? 'Request received' : 'Report received'}
      </Text>
      <Text style={styles.successBody}>
        Thanks — we read every entry. We will follow up by email if we need more detail.
      </Text>
      <TouchableOpacity style={styles.submit} onPress={onClose} activeOpacity={0.82}>
        <Text style={styles.submitText}>Done</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(10, 20, 48, 0.32)',
  },
  kbAvoid: {
    width: '100%',
  },
  sheet: {
    maxHeight: '90%',
    paddingHorizontal: ClearLensSpacing.md,
    paddingTop: ClearLensSpacing.sm,
    paddingBottom: ClearLensSpacing.lg,
    backgroundColor: ClearLensColors.surface,
    borderTopLeftRadius: ClearLensRadii.xl,
    borderTopRightRadius: ClearLensRadii.xl,
    borderWidth: 1,
    borderColor: ClearLensColors.border,
    ...ClearLensShadow,
  },
  handle: {
    width: 44,
    height: 4,
    borderRadius: 999,
    backgroundColor: ClearLensColors.border,
    alignSelf: 'center',
    marginBottom: ClearLensSpacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    ...ClearLensTypography.h2,
    color: ClearLensColors.navy,
  },
  closeButton: {
    width: 34,
    height: 34,
    borderRadius: ClearLensRadii.full,
    backgroundColor: ClearLensColors.surfaceSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subtitle: {
    ...ClearLensTypography.bodySmall,
    color: ClearLensColors.textSecondary,
    marginTop: 4,
    marginBottom: ClearLensSpacing.md,
  },
  field: {
    marginBottom: ClearLensSpacing.md,
    gap: 6,
  },
  fieldHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  fieldLabel: {
    ...ClearLensTypography.caption,
    color: ClearLensColors.textTertiary,
    fontFamily: ClearLensFonts.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  charCount: {
    ...ClearLensTypography.caption,
    color: ClearLensColors.textTertiary,
  },
  titleInput: {
    ...ClearLensTypography.body,
    minHeight: 46,
    borderRadius: ClearLensRadii.md,
    borderWidth: 1,
    borderColor: ClearLensColors.border,
    paddingHorizontal: ClearLensSpacing.md,
    color: ClearLensColors.navy,
    backgroundColor: ClearLensColors.surface,
  },
  bodyInput: {
    ...ClearLensTypography.body,
    minHeight: 130,
    borderRadius: ClearLensRadii.md,
    borderWidth: 1,
    borderColor: ClearLensColors.border,
    padding: ClearLensSpacing.md,
    color: ClearLensColors.navy,
    backgroundColor: ClearLensColors.surface,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ClearLensSpacing.sm,
    padding: ClearLensSpacing.sm,
    borderRadius: ClearLensRadii.md,
    backgroundColor: ClearLensColors.negativeBg,
    marginBottom: ClearLensSpacing.sm,
  },
  errorText: {
    ...ClearLensTypography.caption,
    flex: 1,
    color: ClearLensSemanticColors.sentiment.negativeText,
  },
  footnote: {
    ...ClearLensTypography.caption,
    color: ClearLensColors.textTertiary,
    marginBottom: ClearLensSpacing.md,
  },
  submit: {
    minHeight: 48,
    borderRadius: ClearLensRadii.md,
    backgroundColor: ClearLensColors.emeraldDeep,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitDisabled: {
    opacity: 0.6,
  },
  submitText: {
    ...ClearLensTypography.body,
    color: ClearLensColors.textOnDark,
    fontFamily: ClearLensFonts.bold,
  },
  successBlock: {
    paddingVertical: ClearLensSpacing.md,
    alignItems: 'center',
    gap: ClearLensSpacing.sm,
  },
  successIcon: {
    marginTop: ClearLensSpacing.sm,
  },
  successTitle: {
    ...ClearLensTypography.h2,
    color: ClearLensColors.navy,
  },
  successBody: {
    ...ClearLensTypography.bodySmall,
    color: ClearLensColors.textSecondary,
    textAlign: 'center',
    marginBottom: ClearLensSpacing.md,
  },
});
