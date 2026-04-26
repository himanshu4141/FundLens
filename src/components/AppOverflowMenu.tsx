import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/src/context/ThemeContext';
import { Radii, Spacing } from '@/src/constants/theme';
import { useAppDesignMode } from '@/src/hooks/useAppDesignMode';
import {
  ClearLensColors,
  ClearLensFonts,
  ClearLensRadii,
  ClearLensShadow,
  ClearLensSpacing,
  ClearLensTypography,
} from '@/src/constants/clearLensTheme';

type SyncState = 'idle' | 'syncing' | 'requested' | 'error';

interface AppOverflowMenuProps {
  visible: boolean;
  syncState: SyncState;
  onClose: () => void;
  onSync: () => void;
  onImport: () => void;
  onSettings: () => void;
}

export function AppOverflowMenu({
  visible,
  syncState,
  onClose,
  onSync,
  onImport,
  onSettings,
}: AppOverflowMenuProps) {
  const { colors } = useTheme();
  const { isClearLens } = useAppDesignMode();
  const activeColors = isClearLens ? ClearLensColors : colors;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={[styles.backdrop, isClearLens && styles.clearBackdrop]} onPress={onClose}>
        <Pressable
          style={[
            styles.sheet,
            isClearLens && styles.clearSheet,
            { backgroundColor: activeColors.surface, borderColor: activeColors.border },
          ]}
          onPress={(event) => event.stopPropagation()}
        >
          <View style={[styles.sheetHandle, { backgroundColor: activeColors.border }]} />
          <Text style={[styles.sheetTitle, isClearLens && styles.clearSheetTitle, { color: activeColors.textPrimary }]}>
            Quick actions
          </Text>

          <TouchableOpacity
            style={[styles.item, isClearLens && styles.clearItem]}
            onPress={() => {
              onClose();
              onSync();
            }}
            disabled={syncState === 'syncing'}
          >
            {syncState === 'syncing' ? (
              <ActivityIndicator size="small" color={isClearLens ? ClearLensColors.emerald : colors.primary} />
            ) : (
              <Ionicons name="sync-outline" size={18} color={activeColors.textPrimary} />
            )}
            <Text style={[styles.itemText, isClearLens && styles.clearItemText, { color: activeColors.textPrimary }]}>Sync Portfolio</Text>
          </TouchableOpacity>

          <View style={[styles.divider, { backgroundColor: activeColors.border }]} />

          <TouchableOpacity
            style={[styles.item, isClearLens && styles.clearItem]}
            onPress={() => {
              onClose();
              onImport();
            }}
          >
            <Ionicons name="cloud-upload-outline" size={18} color={activeColors.textPrimary} />
            <Text style={[styles.itemText, isClearLens && styles.clearItemText, { color: activeColors.textPrimary }]}>Import CAS</Text>
          </TouchableOpacity>

          <View style={[styles.divider, { backgroundColor: activeColors.border }]} />

          <TouchableOpacity
            style={[styles.item, isClearLens && styles.clearItem]}
            onPress={() => {
              onClose();
              onSettings();
            }}
          >
            <Ionicons name="settings-outline" size={18} color={activeColors.textPrimary} />
            <Text style={[styles.itemText, isClearLens && styles.clearItemText, { color: activeColors.textPrimary }]}>Settings</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(15, 23, 42, 0.28)',
  },
  clearBackdrop: {
    backgroundColor: 'rgba(10, 20, 48, 0.28)',
  },
  sheet: {
    borderWidth: 1,
    borderTopLeftRadius: Radii.xl,
    borderTopRightRadius: Radii.xl,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.lg,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 8,
  },
  clearSheet: {
    borderTopLeftRadius: ClearLensRadii.xl,
    borderTopRightRadius: ClearLensRadii.xl,
    paddingTop: ClearLensSpacing.sm,
    paddingBottom: ClearLensSpacing.lg,
    ...ClearLensShadow,
  },
  sheetHandle: {
    width: 44,
    height: 4,
    borderRadius: 999,
    alignSelf: 'center',
    marginBottom: Spacing.sm,
  },
  sheetTitle: {
    fontSize: 20,
    fontWeight: '700',
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  clearSheetTitle: {
    ...ClearLensTypography.h2,
    fontFamily: ClearLensFonts.bold,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
  },
  clearItem: {
    paddingHorizontal: ClearLensSpacing.md,
    paddingVertical: ClearLensSpacing.md,
  },
  itemText: {
    fontSize: 15,
    fontWeight: '500',
  },
  clearItemText: {
    ...ClearLensTypography.body,
    fontFamily: ClearLensFonts.medium,
  },
  divider: {
    height: 1,
    marginHorizontal: Spacing.sm,
  },
});
