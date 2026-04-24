import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
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
    <LinearGradient
      colors={colors.gradientHeader}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 0 }}
      style={styles.header}
    >
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
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: 12,
  },
  logoTouch: {
    minHeight: 32,
    justifyContent: 'center',
  },
  menuButton: {
    minWidth: 38,
    minHeight: 38,
    borderRadius: Radii.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
