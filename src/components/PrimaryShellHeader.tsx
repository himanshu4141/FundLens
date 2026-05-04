import { useMemo } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useClearLensTokens } from '@/src/context/ThemeContext';
import { FolioLensLogo } from '@/src/components/clearLens/FolioLensLogo';
import {
  ClearLensRadii,
  ClearLensSpacing,
  type ClearLensTokens,
} from '@/src/constants/clearLensTheme';

interface PrimaryShellHeaderProps {
  onPressLogo?: () => void;
  onPressMenu: () => void;
}

export function PrimaryShellHeader({ onPressLogo, onPressMenu }: PrimaryShellHeaderProps) {
  const tokens = useClearLensTokens();
  const styles = useMemo(() => makeStyles(tokens), [tokens]);

  return (
    <View style={styles.header}>
      <TouchableOpacity
        onPress={onPressLogo}
        hitSlop={8}
        activeOpacity={onPressLogo ? 0.75 : 1}
        disabled={!onPressLogo}
        style={styles.logoTouch}
      >
        <FolioLensLogo size={32} showWordmark />
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.menuButton}
        hitSlop={8}
        activeOpacity={0.75}
        onPress={onPressMenu}
      >
        <Ionicons name="ellipsis-horizontal" size={22} color={tokens.colors.navy} />
      </TouchableOpacity>
    </View>
  );
}

function makeStyles(tokens: ClearLensTokens) {
  const cl = tokens.colors;
  return StyleSheet.create({
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: ClearLensSpacing.md,
      paddingTop: ClearLensSpacing.xs,
      paddingBottom: ClearLensSpacing.sm,
      backgroundColor: cl.background,
    },
    logoTouch: {
      minHeight: 32,
      justifyContent: 'center',
    },
    menuButton: {
      minWidth: 38,
      minHeight: 38,
      borderRadius: ClearLensRadii.full,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
}
