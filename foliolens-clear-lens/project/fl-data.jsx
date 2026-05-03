// fl-data.jsx — illustrative data for FundLens prototype

const FL_DATA = {
  portfolio: {
    value: 7974000,         // ₹79.74L
    todayChange: -69800,    // −₹69.8K
    todayPct: -0.87,
    totalGain: 2471000,     // +₹24.71L
    totalPct: 44.9,
    xirr: 14.84,
    nifty1y: 12.90,
    aheadByPa: 1.86,
  },
  // 13-point series for chart (1Y view)
  portfolioSeries: [55, 56, 58, 57, 60, 63, 65, 68, 71, 73, 76, 79, 79.74],
  niftySeries:    [55, 56, 57, 58, 59, 60, 62, 63, 64, 65, 66, 67, 67],
  todaysBest: { name: 'DSP US Specific Equity Omni FoF', tags: ['Equity', 'Direct', 'Growth'], todayPct: 0.96, todayGain: 5700 },
  todaysWorst: { name: 'ICICI Prudential Value Discovery', tags: ['Equity', 'Direct', 'Growth'], todayPct: -1.59, todayGain: -8600 },
  allocation: [
    { label: 'Equity', value: 81.8, color: '#10B981' },
    { label: 'Debt', value: 6.8, color: '#0A1430' },
    { label: 'Cash & Others', value: 11.4, color: '#A7F3D0' },
  ],
  marketCap: [
    { label: 'Large', value: 38, color: '#0A1430' },
    { label: 'Mid', value: 33, color: '#10B981' },
    { label: 'Small', value: 29, color: '#F59E0B' },
  ],
  sectors: [
    { name: 'Financial Services', pct: 29.7, value: 2370000 },
    { name: 'Consumer Cyclical', pct: 12.4, value: 989000 },
    { name: 'Healthcare', pct: 8.3, value: 662000 },
    { name: 'Basic Materials', pct: 7.1, value: 566000 },
    { name: 'Technology', pct: 5.7, value: 455000 },
    { name: 'Industrials', pct: 4.3, value: 343000 },
    { name: 'Energy', pct: 3.2, value: 255000 },
    { name: 'Others', pct: 31.8, value: 2538000 },
  ],
  topHoldings: [
    { name: 'HDFC Bank Ltd', sector: 'Financial Services', pct: 6.6 },
    { name: 'ICICI Bank Ltd', sector: 'Financial Services', pct: 6.4 },
    { name: 'Axis Bank Ltd', sector: 'Financial Services', pct: 4.7 },
    { name: 'Kotak Mahindra Bank', sector: 'Financial Services', pct: 3.7 },
    { name: 'Infosys Ltd', sector: 'Information Technology', pct: 2.5 },
  ],
  funds: [
    { name: 'DSP Large & Mid Cap Fund', tags: ['Equity', 'Direct', 'Growth'], value: 2778000, alloc: 34.8, todayPct: -0.45, xirr: 16.65, isLargest: true },
    { name: 'DSP Aggressive Hybrid Fund', tags: ['Hybrid', 'Direct', 'Growth'], value: 1566000, alloc: 19.6, todayPct: -0.23, xirr: 13.42 },
    { name: 'DSP Small Cap Fund', tags: ['Equity', 'Direct', 'Growth'], value: 703000, alloc: 8.8, todayPct: -1.42, xirr: 19.18 },
    { name: 'HDFC Flexi Cap Fund', tags: ['Equity', 'Direct', 'Growth'], value: 647000, alloc: 8.1, todayPct: -0.61, xirr: 15.32 },
    { name: 'DSP US Specific Equity Omni FoF', tags: ['Equity', 'Direct', 'Growth'], value: 604000, alloc: 7.6, todayPct: 0.96, xirr: 19.85 },
    { name: 'ICICI Prudential Value Discovery', tags: ['Equity', 'Direct', 'Growth'], value: 542000, alloc: 6.8, todayPct: -1.59, xirr: 12.04 },
    { name: 'Axis Bluechip Fund', tags: ['Equity', 'Direct', 'Growth'], value: 461000, alloc: 5.8, todayPct: -0.74, xirr: 11.60 },
    { name: 'Mirae Asset Large Cap', tags: ['Equity', 'Direct', 'Growth'], value: 312000, alloc: 3.9, todayPct: -0.52, xirr: 13.10 },
    { name: 'Parag Parikh Flexi Cap', tags: ['Equity', 'Direct', 'Growth'], value: 178000, alloc: 2.2, todayPct: 0.31, xirr: 17.92 },
    { name: 'Kotak Emerging Equity', tags: ['Equity', 'Direct', 'Growth'], value: 96000, alloc: 1.2, todayPct: -1.05, xirr: 14.50 },
    { name: 'SBI Magnum Gilt Fund', tags: ['Debt', 'Direct', 'Growth'], value: 54000, alloc: 0.7, todayPct: 0.08, xirr: 7.20 },
    { name: 'HDFC Liquid Fund', tags: ['Debt', 'Direct', 'Growth'], value: 22000, alloc: 0.3, todayPct: 0.02, xirr: 6.85 },
    { name: 'Aditya Birla SL Floating Rate', tags: ['Debt', 'Direct', 'Growth'], value: 7000, alloc: 0.1, todayPct: 0.01, xirr: 6.40 },
    { name: 'ICICI Pru Equity Arbitrage', tags: ['Hybrid', 'Direct', 'Growth'], value: 4000, alloc: 0.1, todayPct: 0.04, xirr: 6.95 },
  ],
  // DSP Large & Mid Cap fund detail
  dspDetail: {
    name: 'DSP Large & Mid Cap Fund - Direct Plan - Growth',
    tags: ['Equity', 'Direct', 'Growth'],
    currentValue: 2778000,
    invested: 1573000,
    units: 4053.20,
    gain: 1205000,
    gainPct: 76.6,
    xirr: 16.65,
    yourFund1Y: 3.0,
    nifty1Y: -1.3,
    outperformance: 4.3,
    nav: 685.3290,
    periodStart: 665.4300,
    navChange: 2.99,
    expenseRatio: 0.74,
    aum: '₹14,200 Cr',
    minSip: 100,
    portfolioWeight: 34.8,
    fundSeries: [62, 64, 63, 65, 68, 70, 69, 72, 75, 73, 76, 78, 79.5],
    niftyDetail: [62, 63, 64, 63, 65, 66, 65, 67, 68, 67, 68, 67.5, 67],
    navSeries: [598, 612, 625, 631, 645, 638, 651, 665, 671, 666, 678, 685.3],
    quarterly: [
      { label: "Q1'24", value: 5.2 }, { label: "Q2'24", value: 7.9 },
      { label: "Q3'24", value: -3.04 }, { label: "Q4'24", value: 4.3 },
      { label: "Q1'25", value: 6.18 }, { label: "Q2'25", value: 5.47 },
      { label: "Q3'25", value: -4.43 }, { label: "Q4'25", value: -2.57 },
      { label: "Q1'26", value: -11.3 }, { label: "Q2'26", value: 3.2 },
    ],
    composition: {
      assetMix: [
        { label: 'Equity', value: 97.1, color: '#10B981' },
        { label: 'Cash', value: 2.9, color: '#A7F3D0' },
      ],
      capMix: [
        { label: 'Large', value: 38.0, color: '#0A1430' },
        { label: 'Mid', value: 33.0, color: '#10B981' },
        { label: 'Small', value: 29.0, color: '#F59E0B' },
      ],
      sectors: [
        { name: 'Financial Services', pct: 38.4 },
        { name: 'Consumer Cyclical', pct: 12.0 },
        { name: 'Healthcare', pct: 8.8 },
        { name: 'Basic Materials', pct: 8.0 },
        { name: 'Technology', pct: 7.2 },
      ],
      holdings: [
        { name: 'ICICI Bank Ltd', sector: 'Financial Services', pct: 6.6 },
        { name: 'HDFC Bank Ltd', sector: 'Financial Services', pct: 6.4 },
        { name: 'Axis Bank Ltd', sector: 'Financial Services', pct: 4.7 },
        { name: 'State Bank of India', sector: 'Financial Services', pct: 3.2 },
        { name: 'Infosys Ltd', sector: 'Information Technology', pct: 2.5 },
      ],
    },
  },
};

window.FL_DATA = FL_DATA;
