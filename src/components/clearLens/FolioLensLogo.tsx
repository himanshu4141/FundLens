import Svg, { Circle, Path } from 'react-native-svg';
import { View, Text, StyleSheet } from 'react-native';
import {
  ClearLensFonts,
  ClearLensSpacing,
} from '@/src/constants/clearLensTheme';
import { useClearLensTokens } from '@/src/context/ThemeContext';

interface FocusRingLogoMarkProps {
  size?: number;
  light?: boolean;
}

interface FolioLensLogoProps extends FocusRingLogoMarkProps {
  showWordmark?: boolean;
  showTagline?: boolean;
}

export function FocusRingLogoMark({ size = 32, light = false }: FocusRingLogoMarkProps) {
  const { colors } = useClearLensTokens();
  const ring = light ? colors.textOnDark : colors.navy;

  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      accessibilityLabel="FolioLens"
      accessibilityRole="image"
    >
      <Path d="M18 52 A24 24 0 0 1 12 22" stroke={ring} strokeWidth="6" strokeLinecap="round" fill="none" />
      <Path d="M19 12 A24 24 0 0 1 42 10" stroke={ring} strokeWidth="6" strokeLinecap="round" fill="none" />
      <Path d="M52 25 A24 24 0 0 1 47 49" stroke={ring} strokeWidth="6" strokeLinecap="round" fill="none" />
      <Path d="M37 55 A24 24 0 0 1 27 56" stroke={ring} strokeWidth="6" strokeLinecap="round" fill="none" />
      <Path
        d="M16 39 L27 28 L35 35 L49 20"
        stroke={colors.emerald}
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <Circle cx="52" cy="16" r="4" fill={colors.emerald} />
    </Svg>
  );
}

export function FolioLensLogo({
  size = 32,
  light = false,
  showWordmark = true,
  showTagline = false,
}: FolioLensLogoProps) {
  const { colors } = useClearLensTokens();
  const wordmarkColor = light ? colors.textOnDark : colors.navy;
  const taglineColor = light ? colors.lightGrey : colors.slate;

  return (
    <View style={styles.lockup}>
      <FocusRingLogoMark size={size} light={light} />
      {showWordmark && (
        <View style={styles.wordBlock}>
          <Text
            style={[
              styles.wordmark,
              { color: wordmarkColor, fontSize: Math.max(20, size * 0.52), lineHeight: Math.max(24, size * 0.62) },
            ]}
          >
            FolioLens
          </Text>
          {showTagline && (
            <Text style={[styles.tagline, { color: taglineColor }]}>
              FOCUS. COMPARE. GROW.
            </Text>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  lockup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ClearLensSpacing.sm,
  },
  wordBlock: {
    justifyContent: 'center',
  },
  wordmark: {
    fontFamily: ClearLensFonts.bold,
    fontWeight: '700',
    letterSpacing: 0,
  },
  tagline: {
    fontFamily: ClearLensFonts.medium,
    fontSize: 10,
    lineHeight: 14,
    letterSpacing: 3,
    marginTop: 1,
  },
});
