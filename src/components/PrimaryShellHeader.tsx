import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Logo from '@/src/components/Logo';
import { useTheme } from '@/src/context/ThemeContext';
import { useAppDesignMode } from '@/src/hooks/useAppDesignMode';
import { FundLensLogo } from '@/src/components/clearLens/FundLensLogo';
import { ClearLensColors, ClearLensSpacing } from '@/src/constants/clearLensTheme';
import { Radii, Spacing } from '@/src/constants/theme';

interface PrimaryShellHeaderProps {
  onPressLogo?: () => void;
  onPressMenu: () => void;
}

export function PrimaryShellHeader({ onPressLogo, onPressMenu }: PrimaryShellHeaderProps) {
  const { colors } = useTheme();
  const { isClearLens } = useAppDesignMode();

  return (
    <View
      style={[
        styles.header,
        isClearLens && styles.clearHeader,
        { backgroundColor: isClearLens ? ClearLensColors.background : colors.gradientHeader[0] },
      ]}
    >
      <TouchableOpacity
        onPress={onPressLogo}
        hitSlop={8}
        activeOpacity={onPressLogo ? 0.75 : 1}
        disabled={!onPressLogo}
        style={styles.logoTouch}
      >
        {isClearLens ? (
          <FundLensLogo size={32} showWordmark />
        ) : (
          <Logo size={28} showWordmark light />
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.menuButton}
        hitSlop={8}
        activeOpacity={0.75}
        onPress={onPressMenu}
      >
        <Ionicons
          name="ellipsis-horizontal"
          size={22}
          color={isClearLens ? ClearLensColors.navy : 'rgba(255,255,255,0.9)'}
        />
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
    paddingBottom: 12,
  },
  clearHeader: {
    paddingHorizontal: ClearLensSpacing.md,
    paddingTop: ClearLensSpacing.xs,
    paddingBottom: ClearLensSpacing.sm,
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
