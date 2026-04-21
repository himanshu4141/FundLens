import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/src/context/ThemeContext';
import { Radii, Spacing } from '@/src/constants/theme';

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

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[styles.sheet, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={(event) => event.stopPropagation()}
        >
          <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />
          <Text style={[styles.sheetTitle, { color: colors.textPrimary }]}>Quick actions</Text>

          <TouchableOpacity
            style={styles.item}
            onPress={() => {
              onClose();
              onSync();
            }}
            disabled={syncState === 'syncing'}
          >
            {syncState === 'syncing' ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Ionicons name="sync-outline" size={18} color={colors.textPrimary} />
            )}
            <Text style={[styles.itemText, { color: colors.textPrimary }]}>Sync Portfolio</Text>
          </TouchableOpacity>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          <TouchableOpacity
            style={styles.item}
            onPress={() => {
              onClose();
              onImport();
            }}
          >
            <Ionicons name="cloud-upload-outline" size={18} color={colors.textPrimary} />
            <Text style={[styles.itemText, { color: colors.textPrimary }]}>Import CAS</Text>
          </TouchableOpacity>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          <TouchableOpacity
            style={styles.item}
            onPress={() => {
              onClose();
              onSettings();
            }}
          >
            <Ionicons name="settings-outline" size={18} color={colors.textPrimary} />
            <Text style={[styles.itemText, { color: colors.textPrimary }]}>Settings</Text>
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
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
  },
  itemText: {
    fontSize: 15,
    fontWeight: '500',
  },
  divider: {
    height: 1,
    marginHorizontal: Spacing.sm,
  },
});
