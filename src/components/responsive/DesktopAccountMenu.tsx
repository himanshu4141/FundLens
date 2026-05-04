import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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

interface Props {
  visible: boolean;
  syncState: SyncState;
  accountLabel?: string | null;
  onClose: () => void;
  onSync: () => void;
  onImport: () => void;
  onMoneyTrail: () => void;
  onTools: () => void;
  onSettings: () => void;
}

type RowConfig = {
  key: string;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  loading?: boolean;
  danger?: boolean;
};

export function DesktopAccountMenu({
  visible,
  syncState,
  accountLabel,
  onClose,
  onSync,
  onImport,
  onMoneyTrail,
  onTools,
  onSettings,
}: Props) {
  function dismissAnd(action: () => void) {
    return () => {
      onClose();
      action();
    };
  }

  async function handleSignOut() {
    onClose();
    const { error } = await supabase.auth.signOut();
    if (error) Alert.alert('Sign out failed', error.message);
  }

  const dataActions: RowConfig[] = [
    {
      key: 'sync',
      icon: 'sync-outline',
      label: 'Sync portfolio',
      onPress: dismissAnd(onSync),
      loading: syncState === 'syncing',
    },
    {
      key: 'import',
      icon: 'cloud-upload-outline',
      label: 'Import CAS',
      onPress: dismissAnd(onImport),
    },
  ];

  const navActions: RowConfig[] = [
    { key: 'trail', icon: 'trail-sign-outline', label: 'Money Trail', onPress: dismissAnd(onMoneyTrail) },
    { key: 'tools', icon: 'construct-outline', label: 'Tools', onPress: dismissAnd(onTools) },
    { key: 'settings', icon: 'settings-outline', label: 'Settings', onPress: dismissAnd(onSettings) },
  ];

  const destructiveActions: RowConfig[] = [
    { key: 'signout', icon: 'log-out-outline', label: 'Log out', onPress: handleSignOut, danger: true },
  ];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={styles.menu}
          onPress={(event) => event.stopPropagation()}
        >
          {accountLabel ? (
            <View style={styles.header}>
              <Text style={styles.headerTitle} numberOfLines={1}>{accountLabel}</Text>
              <Text style={styles.headerSub}>Quick actions</Text>
            </View>
          ) : null}

          <RowGroup rows={dataActions} />
          <View style={styles.divider} />
          <RowGroup rows={navActions} />
          <View style={styles.divider} />
          <RowGroup rows={destructiveActions} />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function RowGroup({ rows }: { rows: RowConfig[] }) {
  return (
    <View>
      {rows.map((row) => {
        const labelColor = row.danger ? ClearLensColors.negative : ClearLensColors.textPrimary;
        return (
          <TouchableOpacity
            key={row.key}
            style={styles.item}
            onPress={row.onPress}
            activeOpacity={0.76}
          >
            <View style={styles.itemIcon}>
              {row.loading ? (
                <ActivityIndicator size="small" color={ClearLensColors.emerald} />
              ) : (
                <Ionicons name={row.icon} size={18} color={labelColor} />
              )}
            </View>
            <Text style={[styles.itemText, { color: labelColor }]}>{row.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(10, 20, 48, 0.18)',
    alignItems: 'flex-start',
    justifyContent: 'flex-end',
    padding: ClearLensSpacing.md,
  },
  menu: {
    width: 260,
    marginLeft: 14,
    marginBottom: 70,
    backgroundColor: ClearLensColors.surface,
    borderRadius: ClearLensRadii.lg,
    borderWidth: 1,
    borderColor: ClearLensColors.border,
    paddingVertical: ClearLensSpacing.sm,
    ...ClearLensShadow,
    shadowOpacity: 0.12,
    elevation: 8,
  },
  header: {
    paddingHorizontal: ClearLensSpacing.md,
    paddingTop: 4,
    paddingBottom: ClearLensSpacing.sm,
    gap: 2,
  },
  headerTitle: {
    ...ClearLensTypography.bodySmall,
    color: ClearLensColors.navy,
    fontFamily: ClearLensFonts.bold,
  },
  headerSub: {
    ...ClearLensTypography.caption,
    color: ClearLensColors.textTertiary,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ClearLensSpacing.sm,
    paddingHorizontal: ClearLensSpacing.md,
    paddingVertical: 10,
  },
  itemIcon: {
    width: 22,
    alignItems: 'center',
  },
  itemText: {
    ...ClearLensTypography.bodySmall,
    fontFamily: ClearLensFonts.medium,
    flex: 1,
  },
  divider: {
    height: 1,
    backgroundColor: ClearLensColors.borderLight,
    marginVertical: 4,
    marginHorizontal: ClearLensSpacing.md,
  },
});
