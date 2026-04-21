import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Logo from '@/src/components/Logo';
import { useTheme } from '@/src/context/ThemeContext';
import { Radii, Spacing } from '@/src/constants/theme';

interface PrimaryShellHeaderProps {
  onPressLogo?: () => void;
  onPressMenu: () => void;
}

export function PrimaryShellHeader({ onPressLogo, onPressMenu }: PrimaryShellHeaderProps) {
  const { colors } = useTheme();

  return (
    <View style={[styles.header, { backgroundColor: colors.gradientHeader[0] }]}>
      <TouchableOpacity
        onPress={onPressLogo}
        hitSlop={8}
        activeOpacity={onPressLogo ? 0.75 : 1}
        disabled={!onPressLogo}
        style={styles.logoTouch}
      >
        <Logo size={28} showWordmark light />
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.menuButton}
        hitSlop={8}
        activeOpacity={0.75}
        onPress={onPressMenu}
      >
        <Ionicons name="ellipsis-horizontal" size={22} color="rgba(255,255,255,0.9)" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: 14,
  },
  logoTouch: {
    minHeight: 32,
    justifyContent: 'center',
  },
  menuButton: {
    minWidth: 36,
    minHeight: 36,
    borderRadius: Radii.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
