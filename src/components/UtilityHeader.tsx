import { Text, TouchableOpacity, View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '@/src/context/ThemeContext';
import { Radii, Spacing, Typography } from '@/src/constants/theme';
import { useAppDesignMode } from '@/src/hooks/useAppDesignMode';
import {
  ClearLensColors,
  ClearLensFonts,
  ClearLensRadii,
  ClearLensSpacing,
  ClearLensTypography,
} from '@/src/constants/clearLensTheme';

interface UtilityHeaderProps {
  title: string;
  onBackPress?: () => void;
}

export function UtilityHeader({ title, onBackPress }: UtilityHeaderProps) {
  const router = useRouter();
  const { colors } = useTheme();
  const { isClearLens } = useAppDesignMode();

  return (
    <View
      style={[
        styles.header,
        isClearLens && styles.clearHeader,
        {
          backgroundColor: isClearLens ? ClearLensColors.background : colors.surface,
          borderBottomColor: isClearLens ? ClearLensColors.borderLight : colors.borderLight,
        },
      ]}
    >
      <TouchableOpacity
        onPress={onBackPress ?? (() => router.back())}
        style={[
          styles.backBtn,
          isClearLens && styles.clearBackBtn,
          { backgroundColor: isClearLens ? ClearLensColors.surface : colors.primaryLight },
        ]}
        activeOpacity={0.7}
      >
        <Ionicons name="chevron-back" size={22} color={isClearLens ? ClearLensColors.navy : colors.primary} />
      </TouchableOpacity>
      <Text
        style={[
          styles.title,
          isClearLens && styles.clearTitle,
          { color: isClearLens ? ClearLensColors.navy : colors.textPrimary },
        ]}
        numberOfLines={1}
      >
        {title}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  clearHeader: {
    paddingHorizontal: ClearLensSpacing.md,
    paddingTop: ClearLensSpacing.sm,
    paddingBottom: ClearLensSpacing.sm,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: Radii.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearBackBtn: {
    borderRadius: ClearLensRadii.full,
    borderWidth: 1,
    borderColor: ClearLensColors.border,
  },
  title: {
    ...Typography.h3,
    fontWeight: '700',
    flex: 1,
  },
  clearTitle: {
    ...ClearLensTypography.h3,
    fontFamily: ClearLensFonts.bold,
  },
});
