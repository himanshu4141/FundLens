import { ActivityIndicator, Alert, Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/src/context/ThemeContext';
import { Radii, Spacing } from '@/src/constants/theme';
import { useAppDesignMode } from '@/src/hooks/useAppDesignMode';
import { supabase } from '@/src/lib/supabase';
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
  onMoneyTrail?: () => void;
  onSettings: () => void;
  onTools?: () => void;
}

type RowConfig = {
  key: string;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  danger?: boolean;
};

export function AppOverflowMenu({
  visible,
  syncState,
  onClose,
  onSync,
  onImport,
  onMoneyTrail,
  onSettings,
  onTools,
}: AppOverflowMenuProps) {
  const { colors } = useTheme();
  const { isClearLens } = useAppDesignMode();
  const activeColors = isClearLens ? ClearLensColors : colors;
  const dangerColor = isClearLens ? ClearLensColors.negative : colors.negative;

  function dismissAnd(action: () => void) {
    return () => {
      onClose();
      action();
    };
  }

  async function handleSignOut() {
    onClose();
    const { error } = await supabase.auth.signOut();
    if (error) {
      Alert.alert('Sign out failed', error.message);
    }
  }

  // Grouped, semantically ordered: data actions first (sync/import),
  // navigation in the middle (trail/tools/settings), destructive at the bottom.
  const dataActions: RowConfig[] = [
    {
      key: 'sync',
      icon: 'sync-outline',
      label: 'Sync portfolio',
      onPress: dismissAnd(onSync),
      loading: syncState === 'syncing',
      disabled: syncState === 'syncing',
    },
    {
      key: 'import',
      icon: 'cloud-upload-outline',
      label: 'Import CAS',
      onPress: dismissAnd(onImport),
    },
  ];

  const navActions: RowConfig[] = [
    ...(onMoneyTrail
      ? [{ key: 'trail', icon: 'trail-sign-outline', label: 'Money Trail', onPress: dismissAnd(onMoneyTrail) } as RowConfig]
      : []),
    ...(onTools
      ? [{ key: 'tools', icon: 'construct-outline', label: 'Tools', onPress: dismissAnd(onTools) } as RowConfig]
      : []),
    {
      key: 'settings',
      icon: 'settings-outline',
      label: 'Settings',
      onPress: dismissAnd(onSettings),
    },
  ];

  const destructiveActions: RowConfig[] = [
    {
      key: 'signout',
      icon: 'log-out-outline',
      label: 'Log out',
      onPress: handleSignOut,
      danger: true,
    },
  ];

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

          <RowGroup
            rows={dataActions}
            isClearLens={isClearLens}
            activeColors={activeColors}
            primaryColor={isClearLens ? ClearLensColors.emerald : colors.primary}
            dangerColor={dangerColor}
          />
          <View style={[styles.groupDivider, { backgroundColor: activeColors.border }]} />
          <RowGroup
            rows={navActions}
            isClearLens={isClearLens}
            activeColors={activeColors}
            primaryColor={isClearLens ? ClearLensColors.emerald : colors.primary}
            dangerColor={dangerColor}
          />
          <View style={[styles.groupDivider, { backgroundColor: activeColors.border }]} />
          <RowGroup
            rows={destructiveActions}
            isClearLens={isClearLens}
            activeColors={activeColors}
            primaryColor={isClearLens ? ClearLensColors.emerald : colors.primary}
            dangerColor={dangerColor}
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function RowGroup({
  rows,
  isClearLens,
  activeColors,
  primaryColor,
  dangerColor,
}: {
  rows: RowConfig[];
  isClearLens: boolean;
  activeColors: { textPrimary: string };
  primaryColor: string;
  dangerColor: string;
}) {
  return (
    <View>
      {rows.map((row) => {
        const labelColor = row.danger ? dangerColor : activeColors.textPrimary;
        return (
          <TouchableOpacity
            key={row.key}
            style={[styles.item, isClearLens && styles.clearItem]}
            onPress={row.onPress}
            disabled={row.disabled}
            activeOpacity={0.76}
          >
            <View style={styles.itemIcon}>
              {row.loading ? (
                <ActivityIndicator size="small" color={primaryColor} />
              ) : (
                <Ionicons name={row.icon} size={20} color={labelColor} />
              )}
            </View>
            <Text
              style={[
                styles.itemText,
                isClearLens && styles.clearItemText,
                { color: labelColor },
              ]}
            >
              {row.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
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
    paddingVertical: 10,
  },
  clearItem: {
    paddingHorizontal: ClearLensSpacing.md,
    paddingVertical: 12,
  },
  itemIcon: {
    width: 24,
    alignItems: 'center',
  },
  itemText: {
    fontSize: 15,
    fontWeight: '500',
    flex: 1,
  },
  clearItemText: {
    ...ClearLensTypography.body,
    fontFamily: ClearLensFonts.medium,
  },
  groupDivider: {
    height: 1,
    marginHorizontal: Spacing.md,
    marginVertical: 6,
  },
});
