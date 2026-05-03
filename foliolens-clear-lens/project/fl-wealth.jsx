// fl-wealth.jsx — Wealth Journey screens (home, adjust, results, edit-SIP modal)
// Reuses FLCard, FLSegment, FLPill, FLLineChart, FLBottomNav for full system fidelity.

const WJ_DATA = {
  portfolioToday: { corpus: 7974000, monthlySip: 150300, xirr: 14.84 },
  detected: {
    monthlySip: 150300,
    months: 6,
    funds: [
      { name: 'DSP Large & Mid Cap Fund', amount: 60000 },
      { name: 'DSP Aggressive Hybrid Fund', amount: 40000 },
      { name: 'DSP Small Cap Fund', amount: 25300 },
      { name: 'HDFC Flexi Cap Fund', amount: 25000 },
    ],
    extraCount: 2,
  },
  defaults: {
    monthlySip: 150000,
    topup: 0,
    years: 15,
    expectedReturn: 'Balanced',
    withdrawalRate: 4,
    postReturn: 7,
  },
  // Projection results (illustrative)
  growth: {
    corpus15Y: 97800000, // ₹9.78Cr
    pct: 10,
    label: 'Balanced — 10% p.a.',
    milestones: [
      { y: 5, value: 24800000 },   // ₹2.48Cr
      { y: 10, value: 52400000 },  // ₹5.24Cr
      { y: 15, value: 97800000 },  // ₹9.78Cr
    ],
    // 16-point series years 0..15
    adjusted: [80, 110, 145, 188, 240, 305, 385, 480, 595, 730, 890, 1070, 1280, 1525, 1810, 2148].map(v => v / 220 * 9.78),
    current:  [80, 105, 135, 170, 210, 258, 313, 376, 448, 530, 622, 727, 845, 977, 1126, 1290].map(v => v / 220 * 5.86),
  },
  withdrawal: {
    monthly: 326000,        // ₹3.26L/mo
    rate: 4,
    years: 25,
    rateAtRetire: 7,
    corpusStart: 97800000,  // ₹9.78Cr
    residual: 28340000,     // ₹28.34L  (after 25 years)
    // 26 points years 0..25
    drawdown: [978, 1020, 1050, 1070, 1075, 1065, 1042, 1012, 970, 920, 860, 790, 712, 625, 530, 432, 350, 290, 250, 220, 195, 175, 150, 125, 100, 28.34].map(v => v / 100),
  },
};

// ─── Stepper / chevron / labels reused from fl-components ───

// Slider with chips below — used for Monthly SIP, Top-up, Withdrawal rate, etc.
function WJStepperInput({ label, value, onChange, prefix = '₹', chips, helper, valueDisplay }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span style={{ fontSize: 12, color: FL.muted, fontWeight: 500 }}>{label}</span>
        {helper && <span style={{ fontSize: 11, color: FL.subtle }}>{helper}</span>}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#fff', border: `1px solid ${FL.grey}`, borderRadius: 12, padding: '12px 14px', minHeight: 48 }}>
        <span style={{ fontSize: 16, fontWeight: 600, color: FL.navy, fontVariantNumeric: 'tabular-nums' }}>
          {valueDisplay || `${prefix}${value.toLocaleString('en-IN')}`}
        </span>
        <FLIcon name="pencil" size={16} color={FL.muted} />
      </div>
      {chips && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {chips.map(c => (
            <button key={c.label} onClick={() => onChange(c.value)} style={{
              padding: '8px 14px', borderRadius: 9999,
              border: c.value === value ? `1px solid ${FL.emerald}` : `1px solid ${FL.grey}`,
              background: c.value === value ? FL.emerald : '#fff',
              color: c.value === value ? '#fff' : FL.muted,
              fontSize: 12, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer',
              minHeight: 36, flex: '1 1 auto',
            }}>{c.label}</button>
          ))}
        </div>
      )}
    </div>
  );
}

// Three-up segmented for Cautious / Balanced / Growth
function WJReturnPicker({ value, onChange }) {
  const opts = [
    { id: 'Cautious', sub: '7%' },
    { id: 'Balanced', sub: '10%' },
    { id: 'Growth', sub: '13%' },
  ];
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
      {opts.map(o => {
        const active = o.id === value;
        return (
          <button key={o.id} onClick={() => onChange(o.id)} style={{
            border: active ? `1.5px solid ${FL.emerald}` : `1px solid ${FL.grey}`,
            background: active ? FL.emerald : '#fff',
            color: active ? '#fff' : FL.navy,
            borderRadius: 12, padding: '12px 8px', cursor: 'pointer',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
            fontFamily: 'inherit', minHeight: 56,
          }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>{o.id}</span>
            <span style={{ fontSize: 11, opacity: active ? 0.85 : 0.7 }}>{o.sub}</span>
          </button>
        );
      })}
    </div>
  );
}

// Wealth-growth chart (adjusted vs current)
function WJGrowthChart({ adjusted, current, milestones, width = 326, height = 180 }) {
  const padding = { t: 16, r: 18, b: 28, l: 8 };
  const all = [...adjusted, ...current];
  const lo = 0, hi = Math.max(...all) * 1.05;
  const W = width - padding.l - padding.r;
  const H = height - padding.t - padding.b;
  const x = (i) => padding.l + (i / (adjusted.length - 1)) * W;
  const y = (v) => padding.t + (1 - (v - lo) / (hi - lo)) * H;
  const adjPath = adjusted.map((v, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ');
  const curPath = current.map((v, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ');
  const areaPath = `${adjPath} L ${x(adjusted.length - 1)} ${padding.t + H} L ${padding.l} ${padding.t + H} Z`;
  const gid = `wjg-${Math.random().toString(36).slice(2, 8)}`;
  return (
    <svg width={width} height={height} style={{ display: 'block' }}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={FL.emerald} stopOpacity="0.18" />
          <stop offset="100%" stopColor={FL.emerald} stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0, 0.33, 0.66, 1].map((p, i) => (
        <line key={i} x1={padding.l} x2={padding.l + W} y1={padding.t + H * p} y2={padding.t + H * p} stroke={FL.grey} strokeWidth="1" strokeDasharray={p === 1 ? '0' : '2 4'} />
      ))}
      {[0, 0.33, 0.66, 1].map((p, i) => (
        <text key={`yl${i}`} x={padding.l + W + 4} y={padding.t + H * p + 3} fontSize="9" fill={FL.subtle} textAnchor="start">{(hi * (1 - p)).toFixed(0)}</text>
      ))}
      <path d={areaPath} fill={`url(#${gid})`} />
      <path d={curPath} fill="none" stroke={FL.subtle} strokeWidth="1.6" strokeDasharray="3 3" />
      <path d={adjPath} fill="none" stroke={FL.emerald} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      {milestones && milestones.map((m, i) => {
        const xi = (m.y / (adjusted.length - 1)) * adjusted.length;
        const cx = x(m.y);
        const cy = y(adjusted[m.y]);
        return (
          <g key={i}>
            <circle cx={cx} cy={cy} r="3" fill={FL.emerald} stroke="#fff" strokeWidth="1.5" />
          </g>
        );
      })}
      {[0, 5, 10, 15].map(yr => (
        <text key={yr} x={x(yr)} y={padding.t + H + 14} fontSize="9" fill={FL.subtle} textAnchor="middle">{yr}Y</text>
      ))}
    </svg>
  );
}

// Drawdown chart
function WJDrawdownChart({ data, width = 326, height = 160 }) {
  const padding = { t: 16, r: 18, b: 28, l: 8 };
  const lo = 0, hi = Math.max(...data) * 1.05;
  const W = width - padding.l - padding.r;
  const H = height - padding.t - padding.b;
  const x = (i) => padding.l + (i / (data.length - 1)) * W;
  const y = (v) => padding.t + (1 - (v - lo) / (hi - lo)) * H;
  const path = data.map((v, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ');
  const areaPath = `${path} L ${x(data.length - 1)} ${padding.t + H} L ${padding.l} ${padding.t + H} Z`;
  const gid = `wjd-${Math.random().toString(36).slice(2, 8)}`;
  return (
    <svg width={width} height={height} style={{ display: 'block' }}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={FL.emerald} stopOpacity="0.18" />
          <stop offset="100%" stopColor={FL.emerald} stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0, 0.33, 0.66, 1].map((p, i) => (
        <line key={i} x1={padding.l} x2={padding.l + W} y1={padding.t + H * p} y2={padding.t + H * p} stroke={FL.grey} strokeWidth="1" strokeDasharray={p === 1 ? '0' : '2 4'} />
      ))}
      {[0, 0.33, 0.66, 1].map((p, i) => (
        <text key={`yl${i}`} x={padding.l + W + 4} y={padding.t + H * p + 3} fontSize="9" fill={FL.subtle} textAnchor="start">{(hi * (1 - p)).toFixed(1)}</text>
      ))}
      <path d={areaPath} fill={`url(#${gid})`} />
      <path d={path} fill="none" stroke={FL.emerald} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      {[0, 5, 10, 15, 20, 25].map(yr => (
        <text key={yr} x={x(yr)} y={padding.t + H + 14} fontSize="9" fill={FL.subtle} textAnchor="middle">{yr}Y</text>
      ))}
    </svg>
  );
}

// ───────── Wealth Journey home ─────────
function ScreenWealthJourney({ onAdjust, onResults, onEditSip, onSwitchTab, plan }) {
  const [tab, setTab] = React.useState('Wealth growth');
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <FLTopBar />
      <div className="fl-noscroll" style={{ flex: 1, overflowY: 'auto', padding: '4px 16px 96px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Header */}
        <div>
          <div style={{ fontSize: 26, fontWeight: 700, color: FL.navy, letterSpacing: -0.4 }}>Wealth Journey</div>
          <div style={{ fontSize: 13, color: FL.muted, marginTop: 4 }}>Plan today. See your future with clarity.</div>
        </div>

        {/* Portfolio today snapshot */}
        <FLCard>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: FL.navy }}>Your portfolio today</div>
            <button onClick={onEditSip} style={{ background: 'transparent', border: 'none', color: FL.emeraldDeep, fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, padding: 4, fontFamily: 'inherit' }}>
              <FLIcon name="pencil" size={13} color={FL.emeraldDeep} /> Edit
            </button>
          </div>
          <div style={{ fontSize: 11, color: FL.muted, marginBottom: 12, lineHeight: 1.5 }}>Started from your current portfolio. You can edit assumptions anytime.</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, paddingTop: 10, borderTop: `1px solid ${FL.grey50}` }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: FL.navy, fontVariantNumeric: 'tabular-nums' }}>{inr(WJ_DATA.portfolioToday.corpus)}</div>
              <div style={{ fontSize: 10, color: FL.muted, marginTop: 2 }}>Corpus</div>
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: FL.navy, fontVariantNumeric: 'tabular-nums' }}>₹1.50L/mo</div>
              <div style={{ fontSize: 10, color: FL.muted, marginTop: 2 }}>Monthly SIP used</div>
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: FL.emeraldDeep }}>{WJ_DATA.portfolioToday.xirr}%</div>
              <div style={{ fontSize: 10, color: FL.muted, marginTop: 2 }}>XIRR</div>
            </div>
          </div>
          <div style={{ marginTop: 12, padding: '10px 12px', background: FL.mint50, borderRadius: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
            <FLIcon name="check" size={14} color={FL.emeraldDeep} />
            <span style={{ fontSize: 11, color: FL.muted, flex: 1, lineHeight: 1.4 }}>Detected from recurring buys in the last 6 months.</span>
            <button onClick={onEditSip} style={{ background: 'transparent', border: 'none', color: FL.emeraldDeep, fontSize: 11, fontWeight: 600, cursor: 'pointer', textDecoration: 'underline', padding: 0, fontFamily: 'inherit' }}>Review / edit</button>
          </div>
        </FLCard>

        {/* Plan at a glance */}
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: FL.navy, marginBottom: 10 }}>Your plan at a glance</div>
          <FLSegment options={['Wealth growth', 'Withdrawal income']} value={tab} onChange={setTab} fullWidth />
        </div>

        {tab === 'Wealth growth' ? (
          <FLCard>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ fontSize: 11, color: FL.muted }}>Projected corpus</span>
                  <span style={{ fontSize: 10, color: FL.subtle }}>(not adjusted for inflation)</span>
                </div>
                <div style={{ fontSize: 32, fontWeight: 700, color: FL.navy, letterSpacing: -0.6, marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>{inr(WJ_DATA.growth.corpus15Y)}</div>
                <div style={{ fontSize: 11, color: FL.muted, marginTop: 2 }}>in 15 years</div>
              </div>
              <FLPill tone="mint" size="xs"><FLDot color={FL.emerald} size={6} /> Balanced · 10% p.a.</FLPill>
            </div>
            <div style={{ marginTop: 14 }}>
              <WJGrowthChart adjusted={WJ_DATA.growth.adjusted} current={WJ_DATA.growth.current} milestones={[{ y: 5 }, { y: 10 }, { y: 15 }]} />
            </div>
            <div style={{ display: 'flex', gap: 14, marginTop: 4, justifyContent: 'center' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: FL.muted }}>
                <FLDot color={FL.emerald} /> Adjusted plan
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: FL.muted }}>
                <span style={{ width: 12, height: 1.5, background: FL.subtle, borderRadius: 1 }} /> Current plan
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 14, paddingTop: 14, borderTop: `1px solid ${FL.grey50}` }}>
              {WJ_DATA.growth.milestones.map((m, i) => (
                <div key={i}>
                  <div style={{ fontSize: 10, color: FL.muted }}>{m.y}Y</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: FL.navy, fontVariantNumeric: 'tabular-nums', marginTop: 2 }}>{inr(m.value)}</div>
                </div>
              ))}
            </div>
          </FLCard>
        ) : (
          <FLCard>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: 11, color: FL.muted }}>Monthly income</div>
                <div style={{ fontSize: 32, fontWeight: 700, color: FL.navy, letterSpacing: -0.6, marginTop: 4 }}>₹3.26L/mo</div>
                <div style={{ fontSize: 11, color: FL.muted, marginTop: 2 }}>4% withdrawal rate</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 11, color: FL.muted }}>Lasts for</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: FL.navy, marginTop: 4 }}>25 years</div>
                <div style={{ fontSize: 11, color: FL.muted, marginTop: 2 }}>at 7% p.a. post-return</div>
              </div>
            </div>
            <div style={{ marginTop: 14 }}>
              <WJDrawdownChart data={WJ_DATA.withdrawal.drawdown} />
            </div>
            <div style={{ marginTop: 12, padding: '10px 12px', background: FL.mint50, borderRadius: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
              <FLIcon name="lightbulb" size={14} color={FL.emeraldDeep} />
              <span style={{ fontSize: 11, color: FL.muted }}>This path leaves <span style={{ fontWeight: 600, color: FL.navy }}>{inr(WJ_DATA.withdrawal.residual)}</span> after 25 years.</span>
            </div>
          </FLCard>
        )}

        <button onClick={onAdjust} style={{
          background: FL.emerald, color: '#fff', border: 'none', borderRadius: 12,
          padding: '14px', fontSize: 14, fontWeight: 600, fontFamily: 'inherit',
          cursor: 'pointer', minHeight: 48, boxShadow: '0 4px 16px rgba(16,185,129,0.25)',
        }}>Adjust your plan</button>
        <button onClick={onResults} style={{
          background: 'transparent', border: 'none', color: FL.muted,
          fontSize: 12, fontWeight: 500, fontFamily: 'inherit', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, padding: 8,
        }}>View assumptions <FLChevron dir="down" size={14} /></button>
      </div>
    </div>
  );
}

// ───────── Adjust your plan ─────────
function ScreenAdjustPlan({ onBack, onApply }) {
  const [sip, setSip] = React.useState(150000);
  const [topup, setTopup] = React.useState(0);
  const [years, setYears] = React.useState(15);
  const [returnTier, setReturnTier] = React.useState('Balanced');
  const [withdrawal, setWithdrawal] = React.useState(4);
  const [postReturn, setPostReturn] = React.useState(7);

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <FLTopBar title="Adjust your plan" onBack={onBack} />
      <div style={{ padding: '0 16px 8px', textAlign: 'center', fontSize: 12, color: FL.muted }}>Build your plan using simple inputs.</div>
      <div className="fl-noscroll" style={{ flex: 1, overflowY: 'auto', padding: '12px 16px 110px', display: 'flex', flexDirection: 'column', gap: 18 }}>
        {/* Section 1 */}
        <div>
          <div style={{ fontSize: 11, color: FL.muted, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 12 }}>1 · Investment plan</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <WJStepperInput
              label="Monthly SIP (going forward)"
              value={sip} onChange={setSip}
              valueDisplay={`₹${sip.toLocaleString('en-IN')}`}
              chips={[
                { label: 'Stop', value: 0 }, { label: '₹1.25L', value: 125000 },
                { label: '₹1.5L', value: 150000 }, { label: '₹1.75L', value: 175000 },
              ]}
            />
            <WJStepperInput
              label="Additional top-up (one-time or periodic)"
              value={topup} onChange={setTopup}
              valueDisplay={`₹${topup.toLocaleString('en-IN')}`}
              chips={[
                { label: '₹0', value: 0 }, { label: '₹5L', value: 500000 },
                { label: '₹10L', value: 1000000 }, { label: '₹25L', value: 2500000 },
              ]}
            />
            <WJStepperInput
              label="Saving period"
              helper="How long you'll keep investing before withdrawals begin"
              value={years} onChange={setYears}
              valueDisplay={`${years} years`}
              chips={[
                { label: '10Y', value: 10 }, { label: '15Y', value: 15 },
                { label: '20Y', value: 20 }, { label: '25Y', value: 25 },
              ]}
            />
            <div>
              <div style={{ fontSize: 12, color: FL.muted, fontWeight: 500, marginBottom: 8 }}>Expected return (p.a.)</div>
              <div style={{ background: '#fff', border: `1px solid ${FL.grey}`, borderRadius: 12, padding: '12px 14px', minHeight: 48, display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: FL.navy }}>{returnTier} · 10% p.a.</span>
                <FLChevron dir="down" />
              </div>
              <WJReturnPicker value={returnTier} onChange={setReturnTier} />
            </div>
          </div>
        </div>

        {/* Section 2 */}
        <div>
          <div style={{ fontSize: 11, color: FL.muted, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 12 }}>2 · Withdrawal plan (future)</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <WJStepperInput
              label="Withdrawal rate (p.a.)"
              value={withdrawal} onChange={setWithdrawal}
              valueDisplay={`${withdrawal}%`}
              chips={[
                { label: '3%', value: 3 }, { label: '4%', value: 4 },
                { label: '5%', value: 5 }, { label: '6%', value: 6 },
              ]}
            />
            <WJStepperInput
              label="Post-withdrawal return (p.a.)"
              value={postReturn} onChange={setPostReturn}
              valueDisplay={`${postReturn}%`}
              chips={[
                { label: '5%', value: 5 }, { label: '6%', value: 6 },
                { label: '7%', value: 7 }, { label: '8%', value: 8 },
              ]}
            />
          </div>
        </div>
      </div>
      {/* sticky CTA */}
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 76, padding: '12px 16px', background: 'linear-gradient(to bottom, rgba(250,251,253,0), rgba(250,251,253,0.95) 30%, rgba(250,251,253,1))' }}>
        <button onClick={onApply} style={{
          width: '100%', background: FL.emerald, color: '#fff', border: 'none', borderRadius: 12,
          padding: '14px', fontSize: 14, fontWeight: 600, fontFamily: 'inherit',
          cursor: 'pointer', minHeight: 48, boxShadow: '0 4px 16px rgba(16,185,129,0.25)',
        }}>See your results</button>
      </div>
    </div>
  );
}

// ───────── Your results (with internal Wealth/Withdrawal switcher) ─────────
function ScreenWealthResults({ onBack, initialTab = 'Wealth growth' }) {
  const [tab, setTab] = React.useState(initialTab);
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <FLTopBar title="Your results" onBack={onBack} />
      <div className="fl-noscroll" style={{ flex: 1, overflowY: 'auto', padding: '12px 16px 96px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <FLSegment options={['Wealth growth', 'Withdrawal income']} value={tab} onChange={setTab} fullWidth />

        {tab === 'Wealth growth' ? (
          <>
            <FLCard>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                <div>
                  <div style={{ fontSize: 11, color: FL.muted }}>Projected corpus</div>
                  <div style={{ fontSize: 10, color: FL.subtle, marginTop: 2 }}>At 10% p.a. (return + inflation not adjusted)</div>
                </div>
                <FLPill tone="mint" size="xs"><FLDot color={FL.emerald} size={6} /> Balanced · 10% p.a.</FLPill>
              </div>
              <div style={{ fontSize: 36, fontWeight: 700, color: FL.navy, letterSpacing: -0.8, marginTop: 6, fontVariantNumeric: 'tabular-nums' }}>{inr(WJ_DATA.growth.corpus15Y)}</div>
              <div style={{ fontSize: 12, color: FL.muted, marginTop: 2 }}>in 15 years</div>
              <div style={{ marginTop: 16 }}>
                <WJGrowthChart adjusted={WJ_DATA.growth.adjusted} current={WJ_DATA.growth.current} milestones={[{ y: 5 }, { y: 10 }, { y: 15 }]} />
              </div>
              <div style={{ display: 'flex', gap: 14, marginTop: 4, justifyContent: 'center' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: FL.muted }}>
                  <FLDot color={FL.emerald} /> Adjusted plan
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: FL.muted }}>
                  <span style={{ width: 12, height: 1.5, background: FL.subtle, borderRadius: 1 }} /> Current plan
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 14, paddingTop: 14, borderTop: `1px solid ${FL.grey50}` }}>
                {WJ_DATA.growth.milestones.map((m, i) => (
                  <div key={i}>
                    <div style={{ fontSize: 10, color: FL.muted }}>{m.y}Y</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: FL.navy, fontVariantNumeric: 'tabular-nums', marginTop: 2 }}>{inr(m.value)}</div>
                  </div>
                ))}
              </div>
            </FLCard>

            <FLCard>
              <div style={{ fontSize: 14, fontWeight: 600, color: FL.navy, marginBottom: 10 }}>Withdrawal snapshot</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div style={{ padding: 12, background: FL.mint50, borderRadius: 10 }}>
                  <div style={{ fontSize: 10, color: FL.muted }}>Monthly income</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: FL.emeraldDeep, marginTop: 4 }}>₹3.26L/mo</div>
                  <div style={{ fontSize: 10, color: FL.muted, marginTop: 2 }}>4% withdrawal rate</div>
                </div>
                <div style={{ padding: 12, background: FL.grey50, borderRadius: 10 }}>
                  <div style={{ fontSize: 10, color: FL.muted }}>Lasts for</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: FL.navy, marginTop: 4 }}>25 years</div>
                  <div style={{ fontSize: 10, color: FL.muted, marginTop: 2 }}>at 7% p.a. post-return</div>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12, paddingTop: 12, borderTop: `1px solid ${FL.grey50}` }}>
                <div>
                  <div style={{ fontSize: 10, color: FL.muted }}>Corpus at start</div>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{inr(WJ_DATA.withdrawal.corpusStart)}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 10, color: FL.muted }}>Residual corpus</div>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{inr(WJ_DATA.withdrawal.residual)}</div>
                </div>
              </div>
            </FLCard>
          </>
        ) : (
          <>
            <FLCard>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: 11, color: FL.muted }}>Monthly income</div>
                  <div style={{ fontSize: 32, fontWeight: 700, color: FL.navy, letterSpacing: -0.6, marginTop: 4 }}>₹3.26L/mo</div>
                  <div style={{ fontSize: 11, color: FL.muted, marginTop: 2 }}>4% withdrawal rate</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 11, color: FL.muted }}>Lasts for</div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: FL.navy, marginTop: 4 }}>25 years</div>
                  <div style={{ fontSize: 11, color: FL.muted, marginTop: 2 }}>at 7% p.a. post-return</div>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 14, paddingTop: 14, borderTop: `1px solid ${FL.grey50}` }}>
                <div>
                  <div style={{ fontSize: 10, color: FL.muted }}>Corpus at start</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: FL.navy }}>{inr(WJ_DATA.withdrawal.corpusStart)}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 10, color: FL.muted }}>Residual corpus</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: FL.navy }}>{inr(WJ_DATA.withdrawal.residual)}</div>
                </div>
              </div>
            </FLCard>

            <FLCard>
              <div style={{ fontSize: 14, fontWeight: 600, color: FL.navy, marginBottom: 12 }}>Drawdown path</div>
              <WJDrawdownChart data={WJ_DATA.withdrawal.drawdown} />
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 14, paddingTop: 14, borderTop: `1px solid ${FL.grey50}` }}>
                <div>
                  <div style={{ fontSize: 10, color: FL.muted }}>Post-ret. return</div>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>7% p.a.</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 10, color: FL.muted }}>Withdrawal rate</div>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>4% p.a.</div>
                </div>
              </div>
            </FLCard>

            <div style={{ padding: '14px 16px', background: FL.mint50, borderRadius: 12, display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <FLIcon name="lightbulb" size={16} color={FL.emeraldDeep} />
              <span style={{ fontSize: 12, color: FL.muted, lineHeight: 1.5 }}>This path leaves <span style={{ fontWeight: 600, color: FL.navy }}>{inr(WJ_DATA.withdrawal.residual)}</span> after 25 years.</span>
            </div>
          </>
        )}

        {/* Disclaimer */}
        <div style={{ display: 'flex', gap: 8, padding: '12px 4px', alignItems: 'flex-start' }}>
          <FLInfo size={14} />
          <div style={{ fontSize: 10, color: FL.muted, lineHeight: 1.5 }}>
            This is a projection, not a promise. Markets go up and down. Results can be higher or lower than shown. Returns are nominal, pre-tax. Inflation is not adjusted unless stated.
          </div>
        </div>
      </div>
    </div>
  );
}

// ───────── Edit detected SIP modal flow ─────────
function ScreenEditSip({ onClose, onDone }) {
  const [step, setStep] = React.useState(1);
  const [useDetected, setUseDetected] = React.useState(true);
  const [manualSip, setManualSip] = React.useState(150300);

  const Header = ({ title }) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: `1px solid ${FL.grey}` }}>
      <span style={{ fontSize: 15, fontWeight: 700, color: FL.navy }}>{title}</span>
      <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 4, display: 'flex' }}>
        <FLIcon name="close" size={18} color={FL.muted} />
      </button>
    </div>
  );

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: FL.bg }}>
      <FLTopBar />

      {step === 1 && (
        <div style={{ flex: 1, padding: '0 16px', display: 'flex', flexDirection: 'column' }}>
          <FLCard padding={0} style={{ overflow: 'hidden' }}>
            <Header title="Review detected SIP" />
            <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ fontSize: 12, color: FL.muted, lineHeight: 1.5 }}>
                We estimated this from recurring investments in the last 6 months.
              </div>
              <div>
                <div style={{ fontSize: 11, color: FL.muted, marginBottom: 4 }}>Detected SIP</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: FL.navy, fontVariantNumeric: 'tabular-nums' }}>₹{WJ_DATA.detected.monthlySip.toLocaleString('en-IN')}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', background: FL.grey50, borderRadius: 12 }}>
                <span style={{ fontSize: 13, fontWeight: 500, color: FL.navy }}>Use this for projections</span>
                <button onClick={() => setUseDetected(!useDetected)} style={{
                  width: 44, height: 26, borderRadius: 999,
                  background: useDetected ? FL.emerald : FL.grey,
                  border: 'none', position: 'relative', cursor: 'pointer', padding: 0,
                }}>
                  <span style={{
                    position: 'absolute', top: 3, left: useDetected ? 21 : 3,
                    width: 20, height: 20, borderRadius: 999, background: '#fff',
                    transition: 'left .15s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                  }} />
                </button>
              </div>
              <div>
                <div style={{ fontSize: 11, color: FL.muted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 8 }}>Recent recurring investments</div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {WJ_DATA.detected.funds.map((f, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: i < WJ_DATA.detected.funds.length - 1 ? `1px solid ${FL.grey50}` : 'none' }}>
                      <span style={{ fontSize: 13, color: FL.navy }}>{f.name}</span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: FL.navy, fontVariantNumeric: 'tabular-nums' }}>₹{f.amount.toLocaleString('en-IN')}</span>
                    </div>
                  ))}
                  <div style={{ fontSize: 11, color: FL.subtle, marginTop: 8 }}>+{WJ_DATA.detected.extraCount} more funds</div>
                </div>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, padding: 16, borderTop: `1px solid ${FL.grey}` }}>
              <button onClick={() => { setUseDetected(true); setStep(3); }} style={{
                background: FL.emerald, color: '#fff', border: 'none', borderRadius: 12,
                padding: 12, fontSize: 13, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer', minHeight: 44,
              }}>Use detected SIP</button>
              <button onClick={() => setStep(2)} style={{
                background: '#fff', color: FL.navy, border: `1px solid ${FL.grey}`, borderRadius: 12,
                padding: 12, fontSize: 13, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer', minHeight: 44,
              }}>Enter manually</button>
            </div>
          </FLCard>
        </div>
      )}

      {step === 2 && (
        <div style={{ flex: 1, padding: '0 16px', display: 'flex', flexDirection: 'column' }}>
          <FLCard padding={0} style={{ overflow: 'hidden' }}>
            <Header title="Enter monthly SIP" />
            <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ fontSize: 12, color: FL.muted, lineHeight: 1.5 }}>Set the monthly SIP you want to use for projections.</div>
              <div>
                <div style={{ fontSize: 11, color: FL.muted, marginBottom: 6 }}>Monthly SIP for projections</div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#fff', border: `1.5px solid ${FL.emerald}`, borderRadius: 12, padding: '12px 14px', minHeight: 48 }}>
                  <span style={{ fontSize: 18, fontWeight: 700, color: FL.navy, fontVariantNumeric: 'tabular-nums' }}>₹{manualSip.toLocaleString('en-IN')}</span>
                  <FLIcon name="pencil" size={16} color={FL.emerald} />
                </div>
              </div>
              <div style={{ fontSize: 11, color: FL.muted, lineHeight: 1.5 }}>This only changes your Wealth Journey estimate. It does not change your portfolio data.</div>
              <div>
                <div style={{ fontSize: 11, color: FL.muted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 8 }}>Quick choices</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
                  {[{ l: 'Stop', v: 0 }, { l: '₹1.25L', v: 125000 }, { l: '₹1.5L', v: 150000 }, { l: '₹1.75L', v: 175000 }].map(c => (
                    <button key={c.l} onClick={() => setManualSip(c.v)} style={{
                      padding: '10px 4px', borderRadius: 9999,
                      border: c.v === manualSip ? `1.5px solid ${FL.emerald}` : `1px solid ${FL.grey}`,
                      background: c.v === manualSip ? FL.emerald : '#fff',
                      color: c.v === manualSip ? '#fff' : FL.muted,
                      fontSize: 12, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer', minHeight: 36,
                    }}>{c.l}</button>
                  ))}
                </div>
              </div>
            </div>
            <div style={{ padding: 16, borderTop: `1px solid ${FL.grey}` }}>
              <button onClick={() => setStep(3)} style={{
                width: '100%', background: FL.emerald, color: '#fff', border: 'none', borderRadius: 12,
                padding: 12, fontSize: 14, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer', minHeight: 48,
              }}>Save</button>
            </div>
          </FLCard>
        </div>
      )}

      {step === 3 && (
        <div style={{ flex: 1, padding: '0 16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <FLCard padding={28} style={{ width: '100%', textAlign: 'center' }}>
            <div style={{ width: 72, height: 72, borderRadius: 999, background: FL.mint50, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto', border: `2px solid ${FL.mint}` }}>
              <FLIcon name="check" size={32} color={FL.emerald} />
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, color: FL.navy, marginTop: 18 }}>SIP updated</div>
            <div style={{ fontSize: 13, color: FL.muted, marginTop: 6, lineHeight: 1.5 }}>
              We'll use ₹{(useDetected ? WJ_DATA.detected.monthlySip : manualSip).toLocaleString('en-IN')}/month for your projections.
            </div>
            <button onClick={onDone} style={{
              marginTop: 22, width: '100%', background: FL.navy, color: '#fff', border: 'none', borderRadius: 12,
              padding: 12, fontSize: 14, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer', minHeight: 48,
            }}>Done</button>
          </FLCard>
        </div>
      )}
    </div>
  );
}

Object.assign(window, { ScreenWealthJourney, ScreenAdjustPlan, ScreenWealthResults, ScreenEditSip, WJ_DATA });
