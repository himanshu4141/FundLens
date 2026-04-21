import { useQuery } from '@tanstack/react-query';
import { fetchCompositions } from '@/src/hooks/usePortfolioInsights';
import type { FundPortfolioComposition } from '@/src/types/app';

export function useFundComposition(schemeCode: number | null) {
  const { data, isLoading } = useQuery({
    queryKey: ['portfolio-composition', schemeCode !== null ? [schemeCode] : []],
    queryFn: () => fetchCompositions([schemeCode!]),
    enabled: schemeCode !== null,
    staleTime: 1000 * 60 * 60,
    gcTime: 1000 * 60 * 60 * 24,
  });

  const composition: FundPortfolioComposition | null = data?.[0] ?? null;
  return { composition, isLoading };
}
