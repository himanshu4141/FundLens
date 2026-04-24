/**
 * FundLens logo mark.
 *
 * V1/V2: filled lens circle enclosing an upward sparkline.
 * V3 (Clear Lens): broken arc (gap at bottom-left) + 3-segment sparkline
 *   inside the arc + filled dot at the sparkline peak — matching the brand guide.
 *
 * Usage:
 *   <Logo size={48} />                   // icon only
 *   <Logo size={48} showWordmark />       // icon + "FundLens" wordmark
 *   <Logo size={48} showWordmark light /> // white elements for dark backgrounds
 */

import Svg, { Circle, Path, G, Polyline } from 'react-native-svg';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@/src/context/ThemeContext';

interface LogoProps {
  size?: number;
  showWordmark?: boolean;
  /** Use white stroke/text — for dark/gradient backgrounds */
  light?: boolean;
  /** Override icon colour (defaults to brand primary) */
  color?: string;
}

export default function Logo({ size = 40, showWordmark = false, light = false, color }: LogoProps) {
  const { colors, variant } = useTheme();
  const textColor = light ? '#ffffff' : colors.textPrimary;

  return (
    <View style={[styles.row, showWordmark && styles.withWordmark]}>
      {variant === 'v3'
        ? <ClearLensIcon size={size} light={light} color={color} />
        : <ClassicIcon size={size} light={light} color={color} />
      }
      {showWordmark && (
        <View style={styles.wordmark}>
          <Text style={[styles.fund, { color: textColor, fontSize: size * 0.45 }]}>Fund</Text>
          <Text style={[styles.lens, { color: light ? '#ffffff' : colors.primary, fontSize: size * 0.45 }]}>Lens</Text>
        </View>
      )}
    </View>
  );
}

/**
 * V3 "Clear Lens" mark: broken circle arc with gap at bottom-left,
 * 3-segment upward sparkline inside, filled dot at the sparkline peak.
 *
 * SVG geometry (viewBox 0 0 40 40, circle centre (20,20), radius 16):
 *   Arc start: 8-o'clock ≈ (6, 28)   [on the circle]
 *   Arc end  : 7-o'clock ≈ (12, 34)  [on the circle]
 *   Large clockwise arc (330°) → gap of ~30° at bottom-left.
 */
function ClearLensIcon({ size, light, color }: { size: number; light: boolean; color?: string }) {
  const { colors } = useTheme();
  const arcColor = color ?? (light ? '#ffffff' : colors.textPrimary);
  const sparkColor = light ? '#12B886' : colors.primary;

  return (
    <Svg width={size} height={size} viewBox="0 0 40 40">
      {/* Broken arc — 330° clockwise, gap at bottom-left (7→8 o'clock) */}
      <Path
        d="M 6 28 A 16 16 0 1 1 12 34"
        fill="none"
        stroke={arcColor}
        strokeWidth={2.5}
        strokeLinecap="round"
      />
      {/* 3-segment upward sparkline */}
      <Polyline
        points="10,27 17,21 23,24 30,14"
        fill="none"
        stroke={sparkColor}
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Dot at sparkline peak */}
      <Circle cx={30} cy={14} r={2.5} fill={sparkColor} />
    </Svg>
  );
}

/**
 * V1/V2 mark: filled lens ring enclosing a baseline and trend line.
 */
function ClassicIcon({ size, light, color }: { size: number; light: boolean; color?: string }) {
  const { colors } = useTheme();
  const iconColor = color ?? (light ? '#ffffff' : colors.primary);
  const accentColor = light ? 'rgba(255,255,255,0.45)' : colors.primaryLight;

  return (
    <Svg width={size} height={size} viewBox="0 0 40 40">
      <Circle cx="20" cy="20" r="18" fill={accentColor} />
      <Circle cx="20" cy="20" r="18" fill="none" stroke={iconColor} strokeWidth="2.5" />
      <G>
        <Path d="M8 26 L32 26" stroke={iconColor} strokeWidth="1.2" strokeOpacity="0.35" />
        <Path
          d="M8 23 L14 20 L20 22 L26 15 L32 12"
          fill="none"
          stroke={iconColor}
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Circle cx="32" cy="12" r="2.5" fill={iconColor} />
      </G>
    </Svg>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  withWordmark: { gap: 10 },
  wordmark: { flexDirection: 'row', alignItems: 'baseline' },
  fund: { fontWeight: '700', letterSpacing: -0.5 },
  lens: { fontWeight: '800', letterSpacing: -0.5 },
});
