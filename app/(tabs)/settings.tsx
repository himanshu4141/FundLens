import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/src/lib/supabase';
import { useSession } from '@/src/hooks/useSession';
import { useInboundSession } from '@/src/hooks/useInboundSession';

async function fetchProfile(userId: string) {
  const { data } = await supabase
    .from('user_profile')
    .select('pan, kfintech_email')
    .eq('user_id', userId)
    .maybeSingle();
  return data ?? null;
}

function CopyRow({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  async function handleCopy() {
    await Clipboard.setStringAsync(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <View style={styles.profileRow}>
      <View style={styles.profileRowLeft}>
        <Text style={styles.profileLabel}>{label}</Text>
        <Text style={styles.profileValue} numberOfLines={1} selectable>
          {value}
        </Text>
      </View>
      <TouchableOpacity onPress={handleCopy} style={styles.copyBtn}>
        <Text style={styles.copyBtnText}>{copied ? 'Copied' : 'Copy'}</Text>
      </TouchableOpacity>
    </View>
  );
}

function maskPan(pan: string): string {
  if (pan.length !== 10) return pan;
  return pan.slice(0, 2) + '•'.repeat(6) + pan.slice(8);
}

export default function SettingsScreen() {
  const router = useRouter();
  const { session } = useSession();
  const userId = session?.user.id;

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ['user-profile', userId],
    queryFn: () => fetchProfile(userId!),
    enabled: !!userId,
  });

  const { inboundEmail, isLoading: sessionLoading } = useInboundSession(userId);

  const isLoading = profileLoading || sessionLoading;

  async function handleSignOut() {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.auth.signOut();
          if (error) Alert.alert('Error', error.message);
        },
      },
    ]);
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Settings</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Account section */}
        <Text style={styles.sectionLabel}>Account</Text>
        <View style={styles.card}>
          <View style={styles.profileRow}>
            <View style={styles.profileRowLeft}>
              <Text style={styles.profileLabel}>Email</Text>
              <Text style={styles.profileValue} numberOfLines={1}>
                {session?.user.email ?? '—'}
              </Text>
            </View>
          </View>

          {isLoading ? (
            <View style={styles.profileRow}>
              <ActivityIndicator size="small" color="#94a3b8" />
            </View>
          ) : (
            <>
              {profile?.pan && (
                <View style={[styles.profileRow, styles.borderTop]}>
                  <View style={styles.profileRowLeft}>
                    <Text style={styles.profileLabel}>PAN</Text>
                    <Text style={styles.profileValue}>{maskPan(profile.pan)}</Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => router.push('/onboarding')}
                    style={styles.editBtn}
                  >
                    <Text style={styles.editBtnText}>Edit</Text>
                  </TouchableOpacity>
                </View>
              )}

              {profile?.kfintech_email && (
                <View style={[styles.profileRow, styles.borderTop]}>
                  <View style={styles.profileRowLeft}>
                    <Text style={styles.profileLabel}>KFintech email</Text>
                    <Text style={styles.profileValue} numberOfLines={1}>
                      {profile.kfintech_email}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => router.push('/onboarding')}
                    style={styles.editBtn}
                  >
                    <Text style={styles.editBtnText}>Edit</Text>
                  </TouchableOpacity>
                </View>
              )}
            </>
          )}
        </View>

        {/* Import section */}
        {inboundEmail && (
          <>
            <Text style={styles.sectionLabel}>Import</Text>
            <View style={styles.card}>
              <CopyRow label="Your import address" value={inboundEmail} />
              <View style={[styles.profileRow, styles.borderTop]}>
                <View style={styles.profileRowLeft}>
                  <Text style={styles.profileLabel}>Upload a CAS PDF</Text>
                  <Text style={styles.profileSubLabel}>Import manually from a downloaded PDF</Text>
                </View>
                <TouchableOpacity
                  onPress={() => router.push('/onboarding/pdf')}
                  style={styles.editBtn}
                >
                  <Text style={styles.editBtnText}>Upload</Text>
                </TouchableOpacity>
              </View>
            </View>
          </>
        )}

        {/* Danger zone */}
        <Text style={styles.sectionLabel}>Account actions</Text>
        <View style={styles.card}>
          <TouchableOpacity style={styles.signOutRow} onPress={handleSignOut}>
            <Text style={styles.signOutText}>Sign out</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.bottomPad} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 14,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  title: { fontSize: 22, fontWeight: '700', color: '#111' },

  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 24,
    marginBottom: 8,
    marginHorizontal: 20,
  },

  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    marginHorizontal: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },

  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  borderTop: {
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  profileRowLeft: { flex: 1, gap: 2 },
  profileLabel: { fontSize: 11, fontWeight: '600', color: '#94a3b8', textTransform: 'uppercase' },
  profileValue: { fontSize: 14, fontWeight: '500', color: '#111' },
  profileSubLabel: { fontSize: 12, color: '#94a3b8', marginTop: 1 },

  copyBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#f1f5f9',
    borderRadius: 6,
  },
  copyBtnText: { fontSize: 12, fontWeight: '600', color: '#1a56db' },

  editBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#f1f5f9',
    borderRadius: 6,
  },
  editBtnText: { fontSize: 12, fontWeight: '600', color: '#1a56db' },

  signOutRow: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    alignItems: 'center',
  },
  signOutText: { color: '#e53e3e', fontSize: 15, fontWeight: '600' },

  bottomPad: { height: 32 },
});
