import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Logo from '@/src/components/Logo';
import { useThemeVariant } from '@/src/hooks/useThemeVariant';

interface AppScreenHeaderProps {
  title?: string;
  subtitle?: string;
  showLogo?: boolean;
  showSettings?: boolean;
}

export function AppScreenHeader({
  title,
  subtitle,
  showLogo = false,
  showSettings = true,
}: AppScreenHeaderProps) {
  const router = useRouter();
  const theme = useThemeVariant();

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.isEditorial ? theme.colors.background : '#0b1d18',
          borderBottomColor: theme.isEditorial ? theme.colors.borderLight : 'transparent',
          borderBottomWidth: theme.isEditorial ? StyleSheet.hairlineWidth : 0,
        },
      ]}
    >
      <View style={styles.left}>
        {showLogo ? (
          <Logo
            size={28}
            showWordmark
            light={!theme.isEditorial}
            color={theme.isEditorial ? theme.colors.primary : undefined}
          />
        ) : (
          <>
            <Text
              style={[
                styles.title,
                { color: theme.isEditorial ? theme.colors.textPrimary : '#ffffff' },
              ]}
            >
              {title}
            </Text>
            {subtitle ? (
              <Text
                style={[
                  styles.subtitle,
                  {
                    color: theme.isEditorial
                      ? theme.colors.textSecondary
                      : 'rgba(255,255,255,0.72)',
                  },
                ]}
              >
                {subtitle}
              </Text>
            ) : null}
          </>
        )}
      </View>

      {showSettings ? (
        <TouchableOpacity
          accessibilityLabel="Open settings"
          activeOpacity={0.75}
          onPress={() => router.push('/settings')}
          style={[
            styles.iconButton,
            {
              backgroundColor: theme.isEditorial
                ? theme.colors.surfaceAlt
                : 'rgba(255,255,255,0.12)',
            },
          ]}
        >
          <Ionicons
            name="settings-outline"
            size={18}
            color={theme.isEditorial ? theme.colors.textPrimary : '#ffffff'}
          />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
  },
  left: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  subtitle: {
    fontSize: 13,
    fontWeight: '500',
  },
  iconButton: {
    alignItems: 'center',
    borderRadius: 999,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
});
