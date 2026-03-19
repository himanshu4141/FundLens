import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { usePortfolio, type FundCardData } from '@/src/hooks/usePortfolio';
import { formatXirr } from '@/src/utils/xirr';
import { formatCurrency, formatChange } from '@/src/utils/formatting';
import { supabase } from '@/src/lib/supabase';
import { useSession } from '@/src/hooks/useSession';
import { useAppStore, BENCHMARK_OPTIONS } from '@/src/store/appStore';

function BenchmarkSelector({
  selected,
  onChange,
}: {
  selected: string;
  onChange: (symbol: string) => void;
}) {
  return (
    <View style={styles.benchmarkRow}>
      <Text style={styles.benchmarkRowLabel}>vs</Text>
      {BENCHMARK_OPTIONS.map((opt) => (
        <TouchableOpacity
          key={opt.symbol}
          style={[styles.benchmarkPill, selected === opt.symbol && styles.benchmarkPillActive]}
          onPress={() => onChange(opt.symbol)}
        >
          <Text
            style={[
              styles.benchmarkPillText,
              selected === opt.symbol && styles.benchmarkPillTextActive,
            ]}
          >
            {opt.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function PortfolioHeader({
  totalValue,
  dailyChangeAmount,
  dailyChangePct,
  xirr: xirrRate,
  marketXirr,
  benchmarkSymbol,
  onBenchmarkChange,
}: {
  totalValue: number;
  dailyChangeAmount: number;
  dailyChangePct: number;
  xirr: number;
  marketXirr: number;
  benchmarkSymbol: string;
  onBenchmarkChange: (symbol: string) => void;
}) {
  const isPositiveDay = dailyChangeAmount >= 0;
  const dayColor = isPositiveDay ? '#16a34a' : '#dc2626';
  const isAheadOfMarket =
    isFinite(xirrRate) && isFinite(marketXirr) ? xirrRate >= marketXirr : null;

  const benchmarkLabel =
    BENCHMARK_OPTIONS.find((b) => b.symbol === benchmarkSymbol)?.label ?? benchmarkSymbol;

  return (
    <View style={styles.portfolioHeader}>
      <Text style={styles.totalLabel}>Portfolio Value</Text>
      <Text style={styles.totalValue}>{formatCurrency(totalValue)}</Text>

      <Text style={[styles.dailyChange, { color: dayColor }]}>
        {formatChange(dailyChangeAmount, dailyChangePct)} today
      </Text>

      <View style={styles.xirrRow}>
        <View style={styles.xirrItem}>
          <Text style={styles.xirrLabel}>Your XIRR</Text>
          <Text style={styles.xirrValue}>{formatXirr(xirrRate)}</Text>
        </View>
        <View style={styles.xirrDivider} />
        <View style={styles.xirrItem}>
          <Text style={styles.xirrLabel}>{benchmarkLabel}</Text>
          <Text style={styles.xirrValue}>{formatXirr(marketXirr)}</Text>
        </View>
        {isAheadOfMarket !== null && (
          <>
            <View style={styles.xirrDivider} />
            <View style={styles.xirrItem}>
              <Text style={styles.xirrLabel}>vs Market</Text>
              <Text
                style={[
                  styles.xirrValue,
                  { color: isAheadOfMarket ? '#16a34a' : '#dc2626' },
                ]}
              >
                {isAheadOfMarket ? 'Beating' : 'Lagging'}
              </Text>
            </View>
          </>
        )}
      </View>

      <BenchmarkSelector selected={benchmarkSymbol} onChange={onBenchmarkChange} />
    </View>
  );
}

function FundCard({ fund, onPress }: { fund: FundCardData; onPress: () => void }) {
  const isPositiveDay = fund.dailyChangeAmount >= 0;
  const dayColor = isPositiveDay ? '#16a34a' : '#dc2626';
  const xirrPositive = fund.returnXirr >= 0;
  const hasRealizedGains = fund.redeemedUnits > 0;
  const realizedPositive = fund.realizedGain >= 0;

  return (
    <TouchableOpacity style={styles.fundCard} onPress={onPress} activeOpacity={0.75}>
      <View style={styles.fundCardTop}>
        <View style={styles.fundNameBlock}>
          <Text style={styles.fundName} numberOfLines={2}>
            {fund.schemeName}
          </Text>
          <Text style={styles.fundCategory}>{fund.schemeCategory}</Text>
        </View>
        <View style={styles.fundValueBlock}>
          <Text style={styles.fundValue}>{formatCurrency(fund.currentValue)}</Text>
          <Text style={[styles.fundDailyChange, { color: dayColor }]}>
            {fund.dailyChangePct >= 0 ? '+' : ''}
            {fund.dailyChangePct.toFixed(2)}% today
          </Text>
        </View>
      </View>

      <View style={styles.fundCardBottom}>
        <View style={styles.fundMeta}>
          <Text style={styles.fundMetaLabel}>Invested</Text>
          <Text style={styles.fundMetaValue}>{formatCurrency(fund.investedAmount)}</Text>
        </View>
        <View style={styles.fundMeta}>
          <Text style={styles.fundMetaLabel}>NAV</Text>
          <Text style={styles.fundMetaValue}>₹{fund.currentNav.toFixed(3)}</Text>
        </View>
        <View style={styles.fundMeta}>
          <Text style={styles.fundMetaLabel}>XIRR</Text>
          <Text style={[styles.fundMetaValue, { color: xirrPositive ? '#16a34a' : '#dc2626' }]}>
            {formatXirr(fund.returnXirr)}
          </Text>
        </View>
      </View>

      {hasRealizedGains && (
        <View style={styles.realizedRow}>
          <Text style={styles.realizedLabel}>Realized P&amp;L</Text>
          <Text style={[styles.realizedValue, { color: realizedPositive ? '#16a34a' : '#dc2626' }]}>
            {realizedPositive ? '+' : ''}{formatCurrency(Math.abs(fund.realizedGain))}
            {!realizedPositive && fund.realizedGain < 0 ? ' loss' : ''}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

function EmptyState({ onImport }: { onImport: () => void }) {
  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptyTitle}>No portfolio data</Text>
      <Text style={styles.emptySub}>Import your CAS statement to see your mutual fund portfolio here.</Text>
      <TouchableOpacity style={styles.emptyBtn} onPress={onImport}>
        <Text style={styles.emptyBtnText}>Import CAS</Text>
      </TouchableOpacity>
    </View>
  );
}

type SyncState = 'idle' | 'syncing' | 'requested' | 'error';

export default function HomeScreen() {
  const router = useRouter();
  const { session } = useSession();
  const userId = session?.user.id;

  const { defaultBenchmarkSymbol, setDefaultBenchmarkSymbol } = useAppStore();

  const { data: profile } = useQuery({
    queryKey: ['user-profile', userId],
    queryFn: async () => {
      const { data } = await supabase
        .from('user_profile')
        .select('kfintech_email')
        .eq('user_id', userId!)
        .maybeSingle();
      return data;
    },
    enabled: !!userId,
  });

  const [syncState, setSyncState] = useState<SyncState>('idle');

  async function handleSync() {
    if (!profile?.kfintech_email) {
      router.push('/onboarding');
      return;
    }
    setSyncState('syncing');
    const { error } = await supabase.functions.invoke('request-cas', {
      method: 'POST',
      body: { email: profile.kfintech_email },
    });
    setSyncState(error ? 'error' : 'requested');
    setTimeout(() => setSyncState('idle'), 4000);
  }

  const { data, isLoading, isError, refetch, isRefetching } = usePortfolio(defaultBenchmarkSymbol);

  const fundCards = data?.fundCards ?? [];
  const summary = data?.summary ?? null;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Portfolio</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={[styles.syncBtn, syncState === 'syncing' && styles.syncBtnDisabled]}
            onPress={handleSync}
            disabled={syncState === 'syncing'}
          >
            {syncState === 'syncing' ? (
              <ActivityIndicator size="small" color="#1a56db" />
            ) : (
              <Text style={styles.syncBtnText}>↻ Sync</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() =>
              router.push(profile?.kfintech_email ? '/onboarding/pdf' : '/onboarding')
            }
          >
            <Text style={styles.importLink}>Import</Text>
          </TouchableOpacity>
        </View>
      </View>

      {syncState === 'requested' && (
        <View style={styles.syncBanner}>
          <Text style={styles.syncBannerText}>
            CAS requested! Check your email — forward it to your inbound address.
          </Text>
        </View>
      )}
      {syncState === 'error' && (
        <View style={[styles.syncBanner, styles.syncBannerError]}>
          <Text style={styles.syncBannerText}>Sync failed. Please try again.</Text>
        </View>
      )}

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#1a56db" />
        </View>
      ) : isError ? (
        <View style={styles.centered}>
          <Text style={styles.errorText}>Failed to load portfolio.</Text>
          <TouchableOpacity onPress={() => refetch()}>
            <Text style={styles.retryLink}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : !summary || fundCards.length === 0 ? (
        <EmptyState onImport={() => router.push('/onboarding')} />
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#1a56db" />
          }
        >
          <PortfolioHeader
            totalValue={summary.totalValue}
            dailyChangeAmount={summary.dailyChangeAmount}
            dailyChangePct={summary.dailyChangePct}
            xirr={summary.xirr}
            marketXirr={summary.marketXirr}
            benchmarkSymbol={defaultBenchmarkSymbol}
            onBenchmarkChange={setDefaultBenchmarkSymbol}
          />

          <View style={styles.fundListHeader}>
            <Text style={styles.fundListTitle}>Your Funds</Text>
            <Text style={styles.fundCount}>{fundCards.length} fund{fundCards.length !== 1 ? 's' : ''}</Text>
          </View>

          {fundCards.map((fund) => (
            <FundCard
              key={fund.id}
              fund={fund}
              onPress={() => router.push(`/fund/${fund.id}`)}
            />
          ))}

          <View style={styles.bottomPad} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 14,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  title: { fontSize: 22, fontWeight: '700', color: '#111' },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  syncBtn: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderColor: '#c7d7f5', borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 6, minWidth: 64, justifyContent: 'center',
  },
  syncBtnDisabled: { opacity: 0.6 },
  syncBtnText: { color: '#1a56db', fontSize: 13, fontWeight: '600' },
  importLink: { color: '#1a56db', fontSize: 14, fontWeight: '600' },

  syncBanner: {
    backgroundColor: '#eff6ff', borderBottomWidth: 1, borderBottomColor: '#bfdbfe',
    paddingHorizontal: 20, paddingVertical: 10,
  },
  syncBannerError: { backgroundColor: '#fef2f2', borderBottomColor: '#fecaca' },
  syncBannerText: { fontSize: 13, color: '#1e40af', lineHeight: 18 },

  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  errorText: { fontSize: 15, color: '#555' },
  retryLink: { fontSize: 14, color: '#1a56db', fontWeight: '600' },

  portfolioHeader: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
    padding: 20,
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  totalLabel: { fontSize: 12, color: '#94a3b8', fontWeight: '600', textTransform: 'uppercase' },
  totalValue: { fontSize: 32, fontWeight: '700', color: '#111', letterSpacing: -0.5 },
  dailyChange: { fontSize: 14, fontWeight: '500', marginBottom: 4 },
  xirrRow: {
    flexDirection: 'row',
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  xirrItem: { flex: 1, alignItems: 'center', gap: 2 },
  xirrDivider: { width: 1, backgroundColor: '#e2e8f0' },
  xirrLabel: { fontSize: 11, color: '#94a3b8', fontWeight: '600', textTransform: 'uppercase' },
  xirrValue: { fontSize: 15, fontWeight: '700', color: '#111' },

  benchmarkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  benchmarkRowLabel: { fontSize: 11, color: '#94a3b8', fontWeight: '600', textTransform: 'uppercase', marginRight: 2 },
  benchmarkPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
  },
  benchmarkPillActive: { backgroundColor: '#1a56db' },
  benchmarkPillText: { fontSize: 12, fontWeight: '600', color: '#64748b' },
  benchmarkPillTextActive: { color: '#fff' },

  fundListHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginTop: 20,
    marginBottom: 8,
  },
  fundListTitle: { fontSize: 16, fontWeight: '700', color: '#111' },
  fundCount: { fontSize: 13, color: '#94a3b8' },

  fundCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 10,
    borderRadius: 12,
    padding: 16,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  fundCardTop: { flexDirection: 'row', gap: 12 },
  fundNameBlock: { flex: 1, gap: 3 },
  fundName: { fontSize: 14, fontWeight: '600', color: '#111', lineHeight: 20 },
  fundCategory: { fontSize: 12, color: '#94a3b8' },
  fundValueBlock: { alignItems: 'flex-end', gap: 3 },
  fundValue: { fontSize: 16, fontWeight: '700', color: '#111' },
  fundDailyChange: { fontSize: 12, fontWeight: '500' },

  fundCardBottom: {
    flexDirection: 'row',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  fundMeta: { flex: 1, alignItems: 'center', gap: 2 },
  fundMetaLabel: { fontSize: 10, color: '#94a3b8', fontWeight: '600', textTransform: 'uppercase' },
  fundMetaValue: { fontSize: 13, fontWeight: '600', color: '#334155' },

  realizedRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  realizedLabel: { fontSize: 11, color: '#94a3b8', fontWeight: '600', textTransform: 'uppercase' },
  realizedValue: { fontSize: 13, fontWeight: '700' },

  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 12,
  },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#111' },
  emptySub: { fontSize: 14, color: '#666', textAlign: 'center', lineHeight: 22 },
  emptyBtn: {
    backgroundColor: '#1a56db',
    borderRadius: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
    marginTop: 8,
  },
  emptyBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },

  bottomPad: { height: 32 },
});
