import { ActivityIndicator, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
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
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose}>
        <View style={[styles.menu, { backgroundColor: colors.surface, borderColor: colors.border }]}>
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
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
  },
  menu: {
    position: 'absolute',
    top: 60,
    right: 16,
    minWidth: 180,
    borderRadius: Radii.md,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 8,
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
