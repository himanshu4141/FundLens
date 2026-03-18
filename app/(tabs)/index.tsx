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
import { usePortfolio, type FundCardData } from '@/src/hooks/usePortfolio';
import { formatXirr } from '@/src/utils/xirr';

function formatCurrency(value: number): string {
  if (value >= 1_00_00_000) return `₹${(value / 1_00_00_000).toFixed(2)}Cr`;
  if (value >= 1_00_000) return `₹${(value / 1_00_000).toFixed(2)}L`;
  if (value >= 1_000) return `₹${(value / 1_000).toFixed(1)}K`;
  return `₹${value.toFixed(0)}`;
}

function formatChange(amount: number, pct: number): string {
  const sign = amount >= 0 ? '+' : '';
  return `${sign}${formatCurrency(Math.abs(amount))} (${sign}${pct.toFixed(2)}%)`;
}

function PortfolioHeader({
  totalValue,
  dailyChangeAmount,
  dailyChangePct,
  xirr: xirrRate,
  marketXirr,
}: {
  totalValue: number;
  dailyChangeAmount: number;
  dailyChangePct: number;
  xirr: number;
  marketXirr: number;
}) {
  const isPositiveDay = dailyChangeAmount >= 0;
  const dayColor = isPositiveDay ? '#16a34a' : '#dc2626';
  const isAheadOfMarket =
    isFinite(xirrRate) && isFinite(marketXirr) ? xirrRate >= marketXirr : null;

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
          <Text style={styles.xirrLabel}>Nifty 50</Text>
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
    </View>
  );
}

function FundCard({ fund, onPress }: { fund: FundCardData; onPress: () => void }) {
  const isPositiveDay = fund.dailyChangeAmount >= 0;
  const dayColor = isPositiveDay ? '#16a34a' : '#dc2626';
  const xirrPositive = fund.returnXirr >= 0;

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

export default function HomeScreen() {
  const router = useRouter();
  const { data, isLoading, isError, refetch, isRefetching } = usePortfolio();

  const fundCards = data?.fundCards ?? [];
  const summary = data?.summary ?? null;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Portfolio</Text>
        <TouchableOpacity onPress={() => router.push('/onboarding')}>
          <Text style={styles.importLink}>Import CAS</Text>
        </TouchableOpacity>
      </View>

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
  importLink: { color: '#1a56db', fontSize: 14, fontWeight: '600' },

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
