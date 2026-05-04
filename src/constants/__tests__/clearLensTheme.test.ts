import { ClearLensColors, ClearLensSemanticColors } from '../clearLensTheme';

describe('Clear Lens theme tokens', () => {
  it('uses the handoff danger red for negative values', () => {
    expect(ClearLensColors.negative).toBe('#E5484D');
    expect(ClearLensSemanticColors.sentiment.negative).toBe('#E5484D');
  });

  it('keeps semantic chart and allocation colors centralized', () => {
    expect(ClearLensSemanticColors.asset.equity).toBe(ClearLensColors.emerald);
    expect(ClearLensSemanticColors.asset.debt).toBe(ClearLensColors.amber);
    expect(ClearLensSemanticColors.asset.cash).toBe(ClearLensColors.mint);
    expect(ClearLensSemanticColors.marketCap.small).toBe(ClearLensColors.amber);
    expect(ClearLensSemanticColors.marketCap.large).toBe(ClearLensColors.emerald);
    expect(ClearLensSemanticColors.marketCap.mid).toBe(ClearLensColors.mint);
    expect(ClearLensSemanticColors.fundAllocation[0]).toBe(ClearLensColors.emerald);
    expect(ClearLensSemanticColors.fundAllocation[1]).toBe(ClearLensColors.amber);
    expect(ClearLensSemanticColors.chart.fund).toBe(ClearLensColors.emerald);
    expect(ClearLensSemanticColors.chart.benchmark).toBe(ClearLensColors.slate);
  });
});
