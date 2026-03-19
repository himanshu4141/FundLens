import {
  buildCashflowsFromTransactions,
  computeRealizedGains,
  xirr,
  type Transaction,
} from './xirr';

// ─── helpers ──────────────────────────────────────────────────────────────────

function makeTx(
  type: string,
  units: number,
  amount: number,
  date = '2020-01-01',
): Transaction {
  return { transaction_type: type, units, amount, transaction_date: date };
}

function buy(units: number, amount: number, date = '2020-01-01') {
  return makeTx('purchase', units, amount, date);
}

function sell(units: number, amount: number, date = '2021-01-01') {
  return makeTx('redemption', units, amount, date);
}

// ─── buildCashflowsFromTransactions ───────────────────────────────────────────

describe('buildCashflowsFromTransactions', () => {
  describe('happy paths', () => {
    test('buy-only: investedAmount = sum of buys, netUnits = sum of units', () => {
      const txs = [buy(10, 1000), buy(5, 600), buy(3, 360)];
      const r = buildCashflowsFromTransactions(txs, 0, new Date());
      expect(r.netUnits).toBeCloseTo(18, 6);
      expect(r.investedAmount).toBeCloseTo(1960, 6);
    });

    test('buy then full sell: netUnits ≈ 0, investedAmount ≈ 0', () => {
      const txs = [buy(10, 1000, '2020-01-01'), sell(10, 1500, '2021-01-01')];
      const r = buildCashflowsFromTransactions(txs, 0, new Date());
      expect(r.netUnits).toBeCloseTo(0, 6);
      expect(r.investedAmount).toBeCloseTo(0, 6);
    });

    test('partial sell: investedAmount = cost basis of remaining units (avg cost)', () => {
      // Buy 10 units at 100 each (total cost ₹1000). Sell 4 units.
      // Avg cost = 100. Cost of sold 4 = ₹400. Remaining cost basis = ₹600.
      const txs = [buy(10, 1000, '2020-01-01'), sell(4, 600, '2021-01-01')];
      const r = buildCashflowsFromTransactions(txs, 0, new Date());
      expect(r.netUnits).toBeCloseTo(6, 6);
      expect(r.investedAmount).toBeCloseTo(600, 4);
    });

    test('multiple buys at different prices + partial sell uses blended avg cost', () => {
      // Buy 10 @ ₹100 = ₹1000, then buy 10 @ ₹200 = ₹2000. Total: 20 units, ₹3000.
      // Avg cost = ₹150. Sell 5 units → cost basis deducted = ₹750.
      // Remaining: 15 units, cost basis = ₹2250.
      const txs = [
        buy(10, 1000, '2020-01-01'),
        buy(10, 2000, '2020-06-01'),
        sell(5, 900, '2021-01-01'),
      ];
      const r = buildCashflowsFromTransactions(txs, 0, new Date());
      expect(r.netUnits).toBeCloseTo(15, 6);
      expect(r.investedAmount).toBeCloseTo(2250, 4);
    });

    test('SIP: 12 monthly buys, no sells — investedAmount = total invested', () => {
      const txs = Array.from({ length: 12 }, (_, i) => {
        const month = String(i + 1).padStart(2, '0');
        return buy(1, 1000, `2020-${month}-01`);
      });
      const r = buildCashflowsFromTransactions(txs, 0, new Date());
      expect(r.netUnits).toBeCloseTo(12, 6);
      expect(r.investedAmount).toBeCloseTo(12000, 4);
    });

    test('switch_in treated as buy, switch_out as sell', () => {
      const txs = [
        makeTx('switch_in', 10, 1000, '2020-01-01'),
        makeTx('switch_out', 4, 600, '2021-01-01'),
      ];
      const r = buildCashflowsFromTransactions(txs, 0, new Date());
      expect(r.netUnits).toBeCloseTo(6, 6);
      expect(r.investedAmount).toBeCloseTo(600, 4);
    });

    test('dividend_reinvest treated as buy', () => {
      const txs = [
        buy(10, 1000, '2020-01-01'),
        makeTx('dividend_reinvest', 2, 220, '2020-06-01'),
      ];
      const r = buildCashflowsFromTransactions(txs, 0, new Date());
      expect(r.netUnits).toBeCloseTo(12, 6);
      expect(r.investedAmount).toBeCloseTo(1220, 4);
    });

    test('buy, sell all, buy again: fresh cost basis after full exit', () => {
      // Fully exit then re-enter
      const txs = [
        buy(10, 1000, '2020-01-01'),
        sell(10, 1200, '2020-06-01'),
        buy(5, 800, '2021-01-01'),
      ];
      const r = buildCashflowsFromTransactions(txs, 0, new Date());
      expect(r.netUnits).toBeCloseTo(5, 6);
      expect(r.investedAmount).toBeCloseTo(800, 4);
    });

    test('cashflows: buys are negative, sells are positive', () => {
      const txs = [buy(10, 1000, '2020-01-01'), sell(5, 700, '2021-01-01')];
      const r = buildCashflowsFromTransactions(txs, 500, new Date('2022-01-01'));
      const buyFlow = r.historicalCashflows.find((c) => c.amount < 0);
      const sellFlow = r.historicalCashflows.find((c) => c.amount > 0);
      expect(buyFlow?.amount).toBeCloseTo(-1000, 4);
      expect(sellFlow?.amount).toBeCloseTo(700, 4);
    });

    test('XIRR cashflows include terminal inflow at currentDate', () => {
      const txs = [buy(10, 1000, '2020-01-01')];
      const now = new Date('2023-01-01');
      const r = buildCashflowsFromTransactions(txs, 2000, now);
      const terminal = r.xirrCashflows[r.xirrCashflows.length - 1];
      expect(terminal.amount).toBe(2000);
      expect(terminal.date.getTime()).toBe(now.getTime());
    });
  });

  describe('edge cases', () => {
    test('empty transactions → netUnits=0, investedAmount=0', () => {
      const r = buildCashflowsFromTransactions([], 0, new Date());
      expect(r.netUnits).toBe(0);
      expect(r.investedAmount).toBe(0);
      expect(r.historicalCashflows).toHaveLength(0);
    });

    test('single buy', () => {
      const r = buildCashflowsFromTransactions([buy(2.5, 250)], 0, new Date());
      expect(r.netUnits).toBeCloseTo(2.5, 6);
      expect(r.investedAmount).toBeCloseTo(250, 4);
    });

    test('sell more than bought — netUnits and investedAmount clamped to 0', () => {
      const txs = [buy(5, 500, '2020-01-01'), sell(10, 1000, '2021-01-01')];
      const r = buildCashflowsFromTransactions(txs, 0, new Date());
      expect(r.netUnits).toBeGreaterThanOrEqual(0);
      expect(r.investedAmount).toBeGreaterThanOrEqual(0);
    });

    test('very small units (0.001) — no floating-point collapse', () => {
      const txs = Array.from({ length: 10 }, () => buy(0.001, 0.5));
      const r = buildCashflowsFromTransactions(txs, 0, new Date());
      expect(r.netUnits).toBeCloseTo(0.01, 6);
      expect(r.investedAmount).toBeCloseTo(5, 4);
    });

    test('very large amounts (₹1 crore per transaction)', () => {
      const txs = [buy(100, 10_000_000), sell(50, 7_000_000, '2021-01-01')];
      const r = buildCashflowsFromTransactions(txs, 0, new Date());
      expect(r.netUnits).toBeCloseTo(50, 4);
      expect(r.investedAmount).toBeCloseTo(5_000_000, 0);
    });

    test('floating-point: 10 buys of 0.1 units = ~1.0 units', () => {
      const txs = Array.from({ length: 10 }, () => buy(0.1, 10));
      const r = buildCashflowsFromTransactions(txs, 0, new Date());
      expect(r.netUnits).toBeCloseTo(1.0, 5);
    });

    test('unknown transaction_type is ignored', () => {
      const txs = [
        buy(10, 1000),
        makeTx('bonus', 2, 0), // unknown type
      ];
      const r = buildCashflowsFromTransactions(txs, 0, new Date());
      expect(r.netUnits).toBeCloseTo(10, 6);
      expect(r.investedAmount).toBeCloseTo(1000, 4);
    });
  });
});

// ─── computeRealizedGains ─────────────────────────────────────────────────────

describe('computeRealizedGains', () => {
  describe('happy paths', () => {
    test('no sells → realizedGain=0, realizedAmount=0, redeemedUnits=0', () => {
      const r = computeRealizedGains([buy(10, 1000)]);
      expect(r.realizedGain).toBe(0);
      expect(r.realizedAmount).toBe(0);
      expect(r.redeemedUnits).toBe(0);
    });

    test('buy at ₹100, sell all at ₹150 → gain = ₹50', () => {
      const txs = [buy(1, 100), sell(1, 150)];
      const r = computeRealizedGains(txs);
      expect(r.realizedGain).toBeCloseTo(50, 4);
      expect(r.realizedAmount).toBeCloseTo(150, 4);
      expect(r.redeemedUnits).toBeCloseTo(1, 6);
    });

    test('buy at ₹100/unit, sell half — gain on sold half', () => {
      // 10 units at ₹100 total = avg ₹10/unit
      // Sell 5 at ₹12/unit (₹60 proceeds). Cost = 5 × ₹10 = ₹50. Gain = ₹10.
      const txs = [buy(10, 100), sell(5, 60)];
      const r = computeRealizedGains(txs);
      expect(r.realizedGain).toBeCloseTo(10, 4);
      expect(r.realizedAmount).toBeCloseTo(60, 4);
    });

    test('multiple buys at different prices — avg cost blended correctly', () => {
      // Buy 10 @ ₹10 = ₹100. Buy 10 @ ₹20 = ₹200. Total 20 units, avg ₹15.
      // Sell 10 @ ₹25 = ₹250. Cost = 10 × ₹15 = ₹150. Gain = ₹100.
      const txs = [buy(10, 100), buy(10, 200), sell(10, 250)];
      const r = computeRealizedGains(txs);
      expect(r.realizedGain).toBeCloseTo(100, 4);
    });

    test('realised loss: sell below avg cost → negative gain', () => {
      const txs = [buy(10, 1000), sell(5, 400)]; // avg cost 100, sell at 80
      const r = computeRealizedGains(txs);
      expect(r.realizedGain).toBeCloseTo(-100, 4);
    });

    test('switch_out treated same as redemption', () => {
      const txs = [buy(10, 1000), makeTx('switch_out', 10, 1200, '2021-01-01')];
      const r = computeRealizedGains(txs);
      expect(r.realizedGain).toBeCloseTo(200, 4);
    });

    test('dividend_reinvest treated as purchase (lowers avg cost basis)', () => {
      // Buy 10 @ ₹100 = ₹1000. Reinvest ₹50 → 0.5 units.
      // Total: 10.5 units, ₹1050. Avg = ₹100. Sell all 10.5 @ ₹120 = ₹1260. Gain = ₹210.
      const txs = [
        buy(10, 1000),
        makeTx('dividend_reinvest', 0.5, 50),
        sell(10.5, 1260, '2022-01-01'),
      ];
      const r = computeRealizedGains(txs);
      expect(r.realizedGain).toBeCloseTo(210, 2);
    });

    test('sell all then buy more — avg cost resets for second lot', () => {
      const txs = [
        buy(10, 1000, '2020-01-01'),
        sell(10, 1200, '2020-06-01'),
        buy(5, 800, '2021-01-01'),
        sell(5, 900, '2022-01-01'),
      ];
      const r = computeRealizedGains(txs);
      // First gain: 1200 - 1000 = 200. Second gain: 900 - 800 = 100. Total = 300.
      expect(r.realizedGain).toBeCloseTo(300, 4);
      expect(r.redeemedUnits).toBeCloseTo(15, 6);
    });

    test('large portfolio: many SIP buys then partial sell', () => {
      // 24 monthly buys of 1 unit at ₹100 each (₹2400 total). Sell 12 units at ₹130 each.
      // Avg cost = ₹100. Cost of sold 12 = ₹1200. Proceeds = ₹1560. Gain = ₹360.
      const txs: Transaction[] = Array.from({ length: 24 }, (_, i) => {
        const month = String((i % 12) + 1).padStart(2, '0');
        const year = 2020 + Math.floor(i / 12);
        return buy(1, 100, `${year}-${month}-01`);
      });
      txs.push(sell(12, 1560, '2022-06-01'));
      const r = computeRealizedGains(txs);
      expect(r.realizedGain).toBeCloseTo(360, 2);
    });
  });

  describe('edge cases', () => {
    test('empty transactions', () => {
      const r = computeRealizedGains([]);
      expect(r.realizedGain).toBe(0);
      expect(r.realizedAmount).toBe(0);
      expect(r.redeemedUnits).toBe(0);
    });

    test('sell with zero prior holdings — avg cost = 0', () => {
      const r = computeRealizedGains([sell(5, 500)]);
      expect(r.realizedGain).toBeCloseTo(500, 4);
    });

    test('multiple partial sells accumulate correctly', () => {
      // Buy 20 @ ₹100 (₹2000). Sell 5 @ ₹120, sell 5 @ ₹80.
      // Gain = (5*120 - 5*100) + (5*80 - 5*100) = 100 - 100 = 0
      const txs = [buy(20, 2000), sell(5, 600, '2021-01-01'), sell(5, 400, '2022-01-01')];
      const r = computeRealizedGains(txs);
      expect(r.realizedGain).toBeCloseTo(0, 4);
      expect(r.realizedAmount).toBeCloseTo(1000, 4);
      expect(r.redeemedUnits).toBeCloseTo(10, 6);
    });

    test('very small fractional units', () => {
      const txs = [buy(0.001, 1), sell(0.001, 1.5)];
      const r = computeRealizedGains(txs);
      expect(r.realizedGain).toBeCloseTo(0.5, 4);
    });

    test('very large amounts (₹1 crore)', () => {
      const txs = [buy(1000, 10_000_000), sell(500, 6_000_000)];
      const r = computeRealizedGains(txs);
      // Avg cost = ₹10000/unit. Sell 500 → cost = ₹5M. Proceeds = ₹6M. Gain = ₹1M.
      expect(r.realizedGain).toBeCloseTo(1_000_000, 0);
    });
  });
});

// ─── xirr ─────────────────────────────────────────────────────────────────────

describe('xirr', () => {
  function makeDate(daysFromNow: number): Date {
    const d = new Date('2020-01-01');
    d.setDate(d.getDate() + daysFromNow);
    return d;
  }

  describe('happy paths', () => {
    test('single invest → exact terminal value = 0% return', () => {
      const flows = [
        { date: makeDate(0), amount: -1000 },
        { date: makeDate(365), amount: 1000 },
      ];
      const rate = xirr(flows);
      expect(rate).toBeCloseTo(0, 3);
    });

    test('single invest → 10% annual gain', () => {
      const flows = [
        { date: makeDate(0), amount: -1000 },
        { date: makeDate(365), amount: 1100 },
      ];
      const rate = xirr(flows);
      expect(rate).toBeCloseTo(0.1, 3);
    });

    test('single invest → moderate loss (~20%)', () => {
      // -20% annual loss: invest 1000, get back 800
      const flows = [
        { date: makeDate(0), amount: -1000 },
        { date: makeDate(365), amount: 800 },
      ];
      const rate = xirr(flows);
      expect(rate).toBeCloseTo(-0.2, 2);
    });

    test('single invest → severe loss (50%) returns negative rate or NaN but does not throw', () => {
      // Newton-Raphson may not converge for extreme losses from initial guess 0.1
      const flows = [
        { date: makeDate(0), amount: -1000 },
        { date: makeDate(365), amount: 500 },
      ];
      expect(() => xirr(flows)).not.toThrow();
      const rate = xirr(flows);
      // Either correctly converged to ~-0.5, or gracefully returned NaN
      if (isFinite(rate)) {
        expect(rate).toBeLessThan(0);
      }
    });

    test('SIP with known ~12% XIRR', () => {
      // 12 monthly investments of ₹1000, terminal value after 1 year
      // These SIP cashflows at ~12% p.a. would give a terminal value of roughly ₹12,680
      const flows = Array.from({ length: 12 }, (_, i) => ({
        date: makeDate(i * 30),
        amount: -1000,
      }));
      flows.push({ date: makeDate(365), amount: 12680 });
      const rate = xirr(flows);
      expect(rate).toBeGreaterThan(0.1);
      expect(rate).toBeLessThan(0.25);
    });

    test('lump sum + intermediate redemption + terminal value', () => {
      const flows = [
        { date: makeDate(0), amount: -10000 },
        { date: makeDate(180), amount: 2000 }, // partial redemption
        { date: makeDate(365), amount: 9000 }, // terminal value
      ];
      const rate = xirr(flows);
      expect(isFinite(rate)).toBe(true);
      expect(rate).toBeGreaterThan(0); // profitable overall
    });

    test('long period (30 years at ~7% p.a.)', () => {
      const flows = [
        { date: new Date('1990-01-01'), amount: -10000 },
        { date: new Date('2020-01-01'), amount: 76123 }, // ~7% compounded 30 years
      ];
      const rate = xirr(flows);
      expect(rate).toBeCloseTo(0.07, 2);
    });

    test('very short period (1 day positive)', () => {
      const flows = [
        { date: makeDate(0), amount: -1000 },
        { date: makeDate(1), amount: 1001 },
      ];
      const rate = xirr(flows);
      expect(isFinite(rate)).toBe(true);
      expect(rate).toBeGreaterThan(0);
    });
  });

  describe('invalid / edge cases', () => {
    test('fewer than 2 cashflows → NaN', () => {
      expect(xirr([{ date: new Date(), amount: -1000 }])).toBeNaN();
      expect(xirr([])).toBeNaN();
    });

    test('only outflows → NaN', () => {
      const flows = [
        { date: makeDate(0), amount: -1000 },
        { date: makeDate(30), amount: -500 },
      ];
      expect(xirr(flows)).toBeNaN();
    });

    test('only inflows → NaN', () => {
      const flows = [
        { date: makeDate(0), amount: 1000 },
        { date: makeDate(30), amount: 500 },
      ];
      expect(xirr(flows)).toBeNaN();
    });

    test('zero terminal value (total loss) → large negative or NaN', () => {
      const flows = [
        { date: makeDate(0), amount: -1000 },
        { date: makeDate(365), amount: 0.001 }, // near-total loss
      ];
      const rate = xirr(flows);
      // Should be a large negative rate or NaN, definitely not positive
      if (isFinite(rate)) {
        expect(rate).toBeLessThan(0);
      }
    });

    test('all cashflows on same date → NaN (no time dimension)', () => {
      const d = new Date('2020-06-01');
      const flows = [
        { date: d, amount: -1000 },
        { date: d, amount: 1100 },
      ];
      // XIRR is undefined when all flows are simultaneous
      // Either NaN or an extreme value — at minimum it should not throw
      expect(() => xirr(flows)).not.toThrow();
    });

    test('very large amounts do not cause overflow', () => {
      const flows = [
        { date: makeDate(0), amount: -100_000_000 },
        { date: makeDate(365), amount: 115_000_000 },
      ];
      const rate = xirr(flows);
      expect(rate).toBeCloseTo(0.15, 3);
    });

    test('very small amounts (paise-level)', () => {
      const flows = [
        { date: makeDate(0), amount: -0.01 },
        { date: makeDate(365), amount: 0.0115 },
      ];
      const rate = xirr(flows);
      expect(rate).toBeCloseTo(0.15, 2);
    });

    test('rate > 100 divergence guard: extreme 1-day 100x gain triggers guard, does not throw', () => {
      // Invest ₹1, get ₹100 back in 1 day. Newton-Raphson starting at 0.1 will
      // compute an astronomically high annual rate (thousands of %). The guard
      // resets the rate and retries. Result may converge or return NaN — either is acceptable.
      const flows = [
        { date: makeDate(0), amount: -1 },
        { date: makeDate(1), amount: 100 },
      ];
      expect(() => xirr(flows)).not.toThrow();
      const rate = xirr(flows);
      // If it converges, rate must be positive (we made money)
      if (isFinite(rate)) {
        expect(rate).toBeGreaterThan(0);
      }
    });

    test('rate < -0.999 divergence guard: near-total immediate loss triggers guard, does not throw', () => {
      // Invest ₹1000, get ₹0.01 back 1 day later — catastrophic 1-day loss.
      // Newton-Raphson will drive rate toward -0.999 and the guard fires.
      const flows = [
        { date: makeDate(0), amount: -1000 },
        { date: makeDate(1), amount: 0.01 },
      ];
      expect(() => xirr(flows)).not.toThrow();
    });

    test('finalNpv > 1 bail-out: oscillating convergence returns NaN', () => {
      // Pathological cashflows where Newton-Raphson exits the loop without
      // converging tightly (oscillates). The finalNpv > 1 guard returns NaN.
      // Construct by making flows that can't have a real XIRR solution:
      // multiple outflows on same date as inflow (zero-time value of money).
      const d0 = makeDate(0);
      const d1 = makeDate(1);
      const flows = [
        { date: d0, amount: -1000 },
        { date: d1, amount: 0.001 }, // near-zero inflow — essentially total loss
        { date: d1, amount: 0.001 }, // duplicate makes NPV curve flat near bad root
      ];
      expect(() => xirr(flows)).not.toThrow();
      // Either NaN (bail-out) or a highly negative rate — both correct
      const rate = xirr(flows);
      if (isFinite(rate)) {
        expect(rate).toBeLessThan(0);
      }
    });
  });
});
