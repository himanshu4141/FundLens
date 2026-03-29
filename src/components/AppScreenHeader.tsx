import { useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Logo from '@/src/components/Logo';
import { useThemeVariant } from '@/src/hooks/useThemeVariant';

interface HeaderMenuItem {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
}

interface AppScreenHeaderProps {
  title?: string;
  subtitle?: string;
  showLogo?: boolean;
  showSettings?: boolean;
  menuItems?: HeaderMenuItem[];
}

export function AppScreenHeader({
  title,
  subtitle,
  showLogo = false,
  showSettings = true,
  menuItems,
}: AppScreenHeaderProps) {
  const router = useRouter();
  const theme = useThemeVariant();
  const [menuOpen, setMenuOpen] = useState(false);
  const resolvedMenuItems = useMemo<HeaderMenuItem[]>(
    () =>
      menuItems?.length
        ? menuItems
        : showSettings
          ? [
              {
                label: 'Settings',
                icon: 'settings-outline',
                onPress: () => router.push('/settings'),
              },
            ]
          : [],
    [menuItems, router, showSettings],
  );

  function handleMenuItemPress(item: HeaderMenuItem) {
    setMenuOpen(false);
    item.onPress();
  }

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

      <View style={styles.right}>
        {resolvedMenuItems.length ? (
          <>
            <TouchableOpacity
              accessibilityLabel="Open menu"
              activeOpacity={0.75}
              onPress={() => setMenuOpen((value) => !value)}
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
                name="ellipsis-horizontal"
                size={18}
                color={theme.isEditorial ? theme.colors.textPrimary : '#ffffff'}
              />
            </TouchableOpacity>

            {menuOpen ? (
              <Modal
                animationType="fade"
                onRequestClose={() => setMenuOpen(false)}
                transparent
                visible={menuOpen}
              >
                <Pressable style={styles.menuBackdrop} onPress={() => setMenuOpen(false)} />
                <View
                  style={[
                    styles.menu,
                    {
                      backgroundColor: theme.colors.surface,
                      borderColor: theme.colors.borderLight,
                    },
                  ]}
                >
                  {resolvedMenuItems.map((item) => (
                    <TouchableOpacity
                      key={item.label}
                      activeOpacity={0.8}
                      onPress={() => handleMenuItemPress(item)}
                      style={styles.menuItem}
                    >
                      <Ionicons name={item.icon} size={16} color={theme.colors.textPrimary} />
                      <Text style={[styles.menuItemText, { color: theme.colors.textPrimary }]}>
                        {item.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </Modal>
            ) : null}
          </>
        ) : null}
      </View>
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
  right: {
    alignItems: 'flex-end',
    justifyContent: 'center',
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
  menuBackdrop: {
    backgroundColor: 'rgba(0,0,0,0.08)',
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  menu: {
    borderRadius: 18,
    borderWidth: 1,
    elevation: 12,
    gap: 2,
    minWidth: 176,
    padding: 6,
    position: 'absolute',
    right: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.16,
    shadowRadius: 24,
    top: 68,
  },
  menuItem: {
    alignItems: 'center',
    borderRadius: 12,
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  menuItemText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
