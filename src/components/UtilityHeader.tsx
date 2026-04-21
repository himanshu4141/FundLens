import { Text, TouchableOpacity, View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '@/src/context/ThemeContext';
import { Radii, Spacing, Typography } from '@/src/constants/theme';

interface UtilityHeaderProps {
  title: string;
  onBackPress?: () => void;
}

export function UtilityHeader({ title, onBackPress }: UtilityHeaderProps) {
  const router = useRouter();
  const { colors } = useTheme();

  return (
    <View
      style={[
        styles.header,
        { backgroundColor: colors.surface, borderBottomColor: colors.borderLight },
      ]}
    >
      <TouchableOpacity
        onPress={onBackPress ?? (() => router.back())}
        style={[styles.backBtn, { backgroundColor: colors.primaryLight }]}
        activeOpacity={0.7}
      >
        <Ionicons name="chevron-back" size={22} color={colors.primary} />
      </TouchableOpacity>
      <Text style={[styles.title, { color: colors.textPrimary }]} numberOfLines={1}>
        {title}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: Radii.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    ...Typography.h2,
    flex: 1,
  },
});
