export function formatCurrency(value: number): string {
  if (value >= 1_00_00_000) return `₹${(value / 1_00_00_000).toFixed(2)}Cr`;
  if (value >= 1_00_000) return `₹${(value / 1_00_000).toFixed(2)}L`;
  if (value >= 1_000) return `₹${(value / 1_000).toFixed(1)}K`;
  return `₹${value.toFixed(0)}`;
}

export function formatChange(amount: number, pct: number): string {
  const amtSign = amount >= 0 ? '+' : '-';
  const pctSign = pct >= 0 ? '+' : '';
  return `${amtSign}${formatCurrency(Math.abs(amount))} (${pctSign}${pct.toFixed(2)}%)`;
}
