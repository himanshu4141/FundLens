import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
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
import * as ImagePicker from 'expo-image-picker';
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
const ATTACHMENT_BUCKET = 'user-feedback-attachments';
const ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024; // 10 MB — matches storage policy

type PickedAttachment = {
  uri: string;
  mime: string;
  ext: string;
  size: number | null;
};

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
  const [attachment, setAttachment] = useState<PickedAttachment | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!visible) {
      // Defer state reset so the closing animation finishes cleanly.
      const timer = setTimeout(() => {
        setTitle('');
        setBody('');
        setAttachment(null);
        setError(null);
        setSubmitting(false);
        setSubmitted(false);
      }, 220);
      return () => clearTimeout(timer);
    }
  }, [visible]);

  async function handlePickImage() {
    if (Platform.OS !== 'web') {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          'Photos access needed',
          'We use this only to attach the screenshot you pick. You can revoke it in Settings.',
        );
        return;
      }
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      allowsMultipleSelection: false,
      exif: false,
    });

    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    if (asset.fileSize && asset.fileSize > ATTACHMENT_MAX_BYTES) {
      setError('That image is over 10 MB. Please pick a smaller one.');
      return;
    }

    const mime = asset.mimeType ?? 'image/jpeg';
    const ext = mime.includes('/') ? mime.split('/')[1].toLowerCase() : 'jpg';
    setAttachment({
      uri: asset.uri,
      mime,
      ext: ext === 'jpeg' ? 'jpg' : ext,
      size: asset.fileSize ?? null,
    });
    setError(null);
  }

  async function uploadAttachment(userId: string): Promise<string | null> {
    if (!attachment) return null;

    // Read the local file as a binary blob — Supabase storage expects a
    // Blob/ArrayBuffer for raw uploads. fetch() handles file:// uris on
    // both iOS and Android.
    const response = await fetch(attachment.uri);
    const blob = await response.blob();

    const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${attachment.ext}`;
    const { error: uploadError } = await supabase.storage
      .from(ATTACHMENT_BUCKET)
      .upload(path, blob, {
        contentType: attachment.mime,
        upsert: false,
      });

    if (uploadError) {
      throw new Error(uploadError.message || 'Upload failed.');
    }
    return path;
  }

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

    let attachmentPath: string | null = null;
    try {
      attachmentPath = await uploadAttachment(userResult.user.id);
    } catch (uploadError) {
      setSubmitting(false);
      setError(
        uploadError instanceof Error
          ? `Could not upload attachment: ${uploadError.message}`
          : 'Could not upload attachment. Please try again.',
      );
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
      attachment_path: attachmentPath,
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
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
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

                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>Screenshot (optional)</Text>
                  {attachment ? (
                    <View style={styles.attachmentPreview}>
                      <Image source={{ uri: attachment.uri }} style={styles.attachmentThumb} />
                      <View style={styles.attachmentInfo}>
                        <Text style={styles.attachmentName} numberOfLines={1}>
                          {attachment.mime}
                        </Text>
                        {attachment.size != null ? (
                          <Text style={styles.attachmentMeta}>
                            {(attachment.size / 1024).toFixed(0)} KB
                          </Text>
                        ) : null}
                      </View>
                      <TouchableOpacity
                        style={styles.attachmentRemove}
                        onPress={() => setAttachment(null)}
                        accessibilityLabel="Remove attachment"
                        activeOpacity={0.76}
                      >
                        <Ionicons name="close" size={18} color={ClearLensColors.navy} />
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <TouchableOpacity style={styles.attachButton} onPress={handlePickImage} activeOpacity={0.76}>
                      <Ionicons name="image-outline" size={18} color={ClearLensColors.emeraldDeep} />
                      <Text style={styles.attachButtonText}>Attach a screenshot</Text>
                    </TouchableOpacity>
                  )}
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
  attachButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: ClearLensSpacing.sm,
    minHeight: 46,
    borderRadius: ClearLensRadii.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: ClearLensColors.border,
    backgroundColor: ClearLensColors.surfaceSoft,
  },
  attachButtonText: {
    ...ClearLensTypography.bodySmall,
    color: ClearLensColors.emeraldDeep,
    fontFamily: ClearLensFonts.bold,
  },
  attachmentPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ClearLensSpacing.sm,
    padding: ClearLensSpacing.sm,
    borderRadius: ClearLensRadii.md,
    borderWidth: 1,
    borderColor: ClearLensColors.border,
    backgroundColor: ClearLensColors.surfaceSoft,
  },
  attachmentThumb: {
    width: 52,
    height: 52,
    borderRadius: ClearLensRadii.sm,
    backgroundColor: ClearLensColors.surface,
  },
  attachmentInfo: {
    flex: 1,
    gap: 2,
  },
  attachmentName: {
    ...ClearLensTypography.bodySmall,
    color: ClearLensColors.navy,
    fontFamily: ClearLensFonts.semiBold,
  },
  attachmentMeta: {
    ...ClearLensTypography.caption,
    color: ClearLensColors.textTertiary,
  },
  attachmentRemove: {
    width: 30,
    height: 30,
    borderRadius: ClearLensRadii.full,
    alignItems: 'center',
    justifyContent: 'center',
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
