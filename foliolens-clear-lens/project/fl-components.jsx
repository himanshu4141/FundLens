// fl-components.jsx — FundLens shared UI primitives, charts, and screens
// All components scoped with FL prefix to avoid collisions.

const FL = {
  navy: '#0A1430',
  slate: '#263248',
  emerald: '#10B981',
  emeraldDeep: '#0EA372',
  mint: '#A7F3D0',
  mint50: '#ECFDF5',
  grey: '#E6EBF1',
  grey50: '#F2F4F8',
  bg: '#FAFBFD',
  text: '#0A1430',
  muted: '#5B677D',
  subtle: '#8C97AB',
  positive: '#10B981',
  negative: '#E5484D',
  positiveBg: '#E7FAF2',
  negativeBg: '#FEEDEE',
  amber: '#F59E0B',
};

// ───────── Helpers ─────────
const inr = (n) => {
  // n in rupees; format with ₹ and L (lakhs) when >= 100000
  if (n === 0) return '₹0';
  const sign = n < 0 ? '−' : '';
  const abs = Math.abs(n);
  if (abs >= 10000000) return `${sign}₹${(abs / 10000000).toFixed(2).replace(/\.?0+$/, '')}Cr`;
  if (abs >= 100000) return `${sign}₹${(abs / 100000).toFixed(2).replace(/\.?0+$/, '')}L`;
  if (abs >= 1000) return `${sign}₹${(abs / 1000).toFixed(1).replace(/\.0$/, '')}K`;
  return `${sign}₹${abs.toLocaleString('en-IN')}`;
};

const pct = (n, places = 2) => `${n >= 0 ? '+' : '−'}${Math.abs(n).toFixed(places)}%`;

// ───────── Atoms ─────────
function FLPill({ children, tone = 'neutral', size = 'sm', style = {} }) {
  const tones = {
    neutral: { bg: FL.grey50, color: FL.muted, border: FL.grey },
    positive: { bg: FL.positiveBg, color: FL.emeraldDeep, border: 'transparent' },
    negative: { bg: FL.negativeBg, color: FL.negative, border: 'transparent' },
    navy: { bg: FL.navy, color: '#fff', border: 'transparent' },
    mint: { bg: FL.mint50, color: FL.emeraldDeep, border: FL.mint },
  };
  const t = tones[tone];
  const pad = size === 'xs' ? '2px 8px' : size === 'sm' ? '4px 10px' : '6px 14px';
  const fs = size === 'xs' ? 11 : size === 'sm' ? 12 : 13;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: pad, borderRadius: 9999,
      background: t.bg, color: t.color, border: `1px solid ${t.border}`,
      fontSize: fs, fontWeight: 500, lineHeight: 1.2,
      whiteSpace: 'nowrap', ...style,
    }}>{children}</span>
  );
}

function FLDot({ color, size = 8 }) {
  return <span style={{ display: 'inline-block', width: size, height: size, borderRadius: 999, background: color, flexShrink: 0 }} />;
}

function FLChange({ value, suffix = '%', tone, size = 13, weight = 600 }) {
  const positive = value >= 0;
  const t = tone || (positive ? 'positive' : 'negative');
  const c = t === 'positive' ? FL.positive : t === 'negative' ? FL.negative : FL.muted;
  const arrow = positive ? '▲' : '▼';
  return (
    <span style={{ color: c, fontSize: size, fontWeight: weight, fontVariantNumeric: 'tabular-nums', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <span style={{ fontSize: size - 4 }}>{arrow}</span>
      {Math.abs(value).toFixed(2)}{suffix}
    </span>
  );
}

function FLInfo({ size = 14, color = FL.subtle }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
      <circle cx="8" cy="8" r="6.5" stroke={color} strokeWidth="1.4" />
      <circle cx="8" cy="5.2" r="0.9" fill={color} />
      <path d="M8 7.5v4" stroke={color} strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function FLChevron({ dir = 'right', size = 16, color = FL.muted }) {
  const r = { right: 0, down: 90, left: 180, up: 270 }[dir];
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" style={{ transform: `rotate(${r}deg)`, flexShrink: 0 }}>
      <path d="M6 3l5 5-5 5" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function FLCard({ children, style = {}, padding = 16, onClick }) {
  return (
    <div onClick={onClick} style={{
      background: '#fff', borderRadius: 16,
      boxShadow: '0 4px 16px rgba(10,20,48,0.06)',
      padding,
      cursor: onClick ? 'pointer' : 'default',
      ...style,
    }}>{children}</div>
  );
}

// ───────── Logo (original mark — concentric ring + arrow line) ─────────
function FLLogo({ size = 28, color = FL.navy, accent = FL.emerald }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <circle cx="16" cy="16" r="13.5" stroke={color} strokeWidth="2.5" strokeDasharray="50 8" strokeLinecap="round" transform="rotate(-30 16 16)" />
      <path d="M9 19.5L13.5 14.5L17 17.5L23 11" stroke={accent} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="23" cy="11" r="1.6" fill={accent} />
    </svg>
  );
}

function FLWordmark({ size = 18 }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <FLLogo size={size + 10} />
      <span style={{ fontSize: size, fontWeight: 700, letterSpacing: -0.3, color: FL.navy }}>
        FundLens
      </span>
    </div>
  );
}

// ───────── Icons (2px stroke, rounded) ─────────
function FLIcon({ name, size = 20, color = 'currentColor' }) {
  const stroke = { stroke: color, strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', fill: 'none' };
  switch (name) {
    case 'home': return <svg width={size} height={size} viewBox="0 0 24 24"><path d="M3 11l9-7 9 7v9a2 2 0 01-2 2h-4v-7h-6v7H5a2 2 0 01-2-2v-9z" {...stroke} /></svg>;
    case 'trophy': return <svg width={size} height={size} viewBox="0 0 24 24"><path d="M7 4h10v4a5 5 0 01-10 0V4zM7 6H4v2a3 3 0 003 3M17 6h3v2a3 3 0 01-3 3M9 15h6l-1 4h-4l-1-4zM8 21h8" {...stroke} /></svg>;
    case 'beaker': return <svg width={size} height={size} viewBox="0 0 24 24"><path d="M9 3h6M10 3v7l-5 8a2 2 0 002 3h10a2 2 0 002-3l-5-8V3M7 14h10" {...stroke} /></svg>;
    case 'bell': return <svg width={size} height={size} viewBox="0 0 24 24"><path d="M6 17h12l-1.5-2V11a4.5 4.5 0 00-9 0v4L6 17zM10 20a2 2 0 004 0" {...stroke} /></svg>;
    case 'search': return <svg width={size} height={size} viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5" {...stroke} /><path d="M16 16l4 4" {...stroke} /></svg>;
    case 'sort': return <svg width={size} height={size} viewBox="0 0 24 24"><path d="M7 4v16M3 8l4-4 4 4M17 20V4M13 16l4 4 4-4" {...stroke} /></svg>;
    case 'back': return <svg width={size} height={size} viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7" {...stroke} /></svg>;
    case 'expand': return <svg width={size} height={size} viewBox="0 0 24 24"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" {...stroke} /></svg>;
    case 'shield': return <svg width={size} height={size} viewBox="0 0 24 24"><path d="M12 3l8 3v6c0 5-3.5 8.5-8 9-4.5-.5-8-4-8-9V6l8-3z" {...stroke} /><path d="M9 12l2 2 4-4" {...stroke} /></svg>;
    case 'spark': return <svg width={size} height={size} viewBox="0 0 24 24"><path d="M3 17l6-6 4 4 8-8" {...stroke} /><path d="M14 7h7v7" {...stroke} /></svg>;
    case 'grid': return <svg width={size} height={size} viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1.5" {...stroke} /><rect x="14" y="3" width="7" height="7" rx="1.5" {...stroke} /><rect x="3" y="14" width="7" height="7" rx="1.5" {...stroke} /><rect x="14" y="14" width="7" height="7" rx="1.5" {...stroke} /></svg>;
    case 'compass': return <svg width={size} height={size} viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" {...stroke} /><path d="M15.5 8.5L13.5 13.5L8.5 15.5L10.5 10.5L15.5 8.5z" {...stroke} /></svg>;
    case 'pencil': return <svg width={size} height={size} viewBox="0 0 24 24"><path d="M14 4l6 6-11 11H3v-6L14 4z" {...stroke} /><path d="M13 5l6 6" {...stroke} /></svg>;
    case 'plus': return <svg width={size} height={size} viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" {...stroke} /></svg>;
    case 'check': return <svg width={size} height={size} viewBox="0 0 24 24"><path d="M5 12l5 5L20 7" {...stroke} /></svg>;
    case 'close': return <svg width={size} height={size} viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18" {...stroke} /></svg>;
    case 'lightbulb': return <svg width={size} height={size} viewBox="0 0 24 24"><path d="M9 18h6M10 21h4M12 3a6 6 0 00-4 10.5c1 1 1.5 1.8 1.5 3.5h5c0-1.7.5-2.5 1.5-3.5A6 6 0 0012 3z" {...stroke} /></svg>;
    case 'swap': return <svg width={size} height={size} viewBox="0 0 24 24"><path d="M7 4v16M4 7l3-3 3 3M17 20V4M14 17l3 3 3-3" {...stroke} /></svg>;
    default: return null;
  }
}

// ───────── Tab bars / segments ─────────
function FLSegment({ options, value, onChange, fullWidth = false }) {
  return (
    <div style={{
      display: 'flex', gap: 4, padding: 4,
      background: FL.grey50, borderRadius: 9999,
      width: fullWidth ? '100%' : 'auto',
    }}>
      {options.map(opt => {
        const active = opt === value;
        return (
          <button key={opt} onClick={() => onChange(opt)} style={{
            flex: fullWidth ? 1 : '0 0 auto',
            border: 'none',
            padding: '8px 14px',
            borderRadius: 9999,
            background: active ? FL.navy : 'transparent',
            color: active ? '#fff' : FL.muted,
            fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
            cursor: 'pointer', whiteSpace: 'nowrap',
            transition: 'all .15s',
          }}>{opt}</button>
        );
      })}
    </div>
  );
}

function FLTabBar({ tabs, value, onChange }) {
  return (
    <div style={{ display: 'flex', borderBottom: `1px solid ${FL.grey}`, gap: 0 }}>
      {tabs.map(tab => {
        const active = tab === value;
        return (
          <button key={tab} onClick={() => onChange(tab)} style={{
            flex: 1, border: 'none', background: 'transparent',
            padding: '12px 8px',
            color: active ? FL.navy : FL.muted,
            fontWeight: active ? 600 : 500, fontSize: 14, fontFamily: 'inherit',
            cursor: 'pointer', position: 'relative',
            borderBottom: active ? `2px solid ${FL.emerald}` : '2px solid transparent',
            marginBottom: -1,
          }}>{tab}</button>
        );
      })}
    </div>
  );
}

// ───────── Charts (SVG, illustrative) ─────────
// Simple area + line chart with optional benchmark
function FLLineChart({
  data, benchmark, width = 320, height = 160,
  primary = FL.emerald, secondary = FL.subtle,
  showAxis = true, showFill = true, padding = { t: 16, r: 12, b: 24, l: 8 },
  endLabels = null,
}) {
  const xs = data.map((_, i) => i);
  const all = benchmark ? [...data, ...benchmark] : data;
  const minY = Math.min(...all);
  const maxY = Math.max(...all);
  const yPad = (maxY - minY) * 0.1 || 1;
  const lo = minY - yPad, hi = maxY + yPad;
  const W = width - padding.l - padding.r;
  const H = height - padding.t - padding.b;
  const x = (i) => padding.l + (i / (data.length - 1)) * W;
  const y = (v) => padding.t + (1 - (v - lo) / (hi - lo)) * H;

  const path = data.map((v, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ');
  const areaPath = `${path} L ${x(data.length - 1)} ${padding.t + H} L ${padding.l} ${padding.t + H} Z`;
  const benchPath = benchmark ? benchmark.map((v, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ') : null;

  const gradientId = `flgrad-${Math.random().toString(36).slice(2, 8)}`;

  return (
    <svg width={width} height={height} style={{ display: 'block' }}>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={primary} stopOpacity="0.18" />
          <stop offset="100%" stopColor={primary} stopOpacity="0" />
        </linearGradient>
      </defs>
      {showAxis && (
        <>
          {[0, 0.33, 0.66, 1].map((p, i) => (
            <line key={i} x1={padding.l} x2={padding.l + W} y1={padding.t + H * p} y2={padding.t + H * p} stroke={FL.grey} strokeWidth="1" strokeDasharray={p === 1 ? '0' : '2 4'} />
          ))}
        </>
      )}
      {showFill && <path d={areaPath} fill={`url(#${gradientId})`} />}
      {benchPath && <path d={benchPath} fill="none" stroke={secondary} strokeWidth="1.6" strokeLinecap="round" strokeDasharray="3 3" />}
      <path d={path} fill="none" stroke={primary} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      {/* End dot */}
      <circle cx={x(data.length - 1)} cy={y(data[data.length - 1])} r="3.5" fill={primary} />
      <circle cx={x(data.length - 1)} cy={y(data[data.length - 1])} r="6" fill={primary} fillOpacity="0.18" />
      {endLabels && endLabels.map((lab, i) => {
        const yv = i === 0 ? data[data.length - 1] : benchmark[benchmark.length - 1];
        const c = i === 0 ? primary : secondary;
        return (
          <g key={i}>
            <text x={x(data.length - 1) + 4} y={y(yv) - 8} fill={c} fontSize="11" fontWeight="600" textAnchor="end">{lab}</text>
          </g>
        );
      })}
    </svg>
  );
}

// Donut chart
function FLDonut({ segments, size = 120, thickness = 16, centerLabel, centerSubLabel }) {
  const r = size / 2 - thickness / 2;
  const c = size / 2;
  const circ = 2 * Math.PI * r;
  const total = segments.reduce((s, x) => s + x.value, 0);
  let offset = 0;
  return (
    <svg width={size} height={size}>
      <circle cx={c} cy={c} r={r} fill="none" stroke={FL.grey50} strokeWidth={thickness} />
      {segments.map((seg, i) => {
        const len = (seg.value / total) * circ;
        const dasharray = `${len} ${circ - len}`;
        const dashoffset = -offset;
        offset += len;
        return (
          <circle key={i} cx={c} cy={c} r={r} fill="none"
            stroke={seg.color} strokeWidth={thickness}
            strokeDasharray={dasharray} strokeDashoffset={dashoffset}
            transform={`rotate(-90 ${c} ${c})`}
            strokeLinecap="butt"
          />
        );
      })}
      {centerLabel && (
        <text x={c} y={c} textAnchor="middle" dominantBaseline="middle" fontSize={size * 0.18} fontWeight="700" fill={FL.navy}>{centerLabel}</text>
      )}
      {centerSubLabel && (
        <text x={c} y={c + size * 0.13} textAnchor="middle" fontSize={size * 0.08} fill={FL.muted}>{centerSubLabel}</text>
      )}
    </svg>
  );
}

// Stacked horizontal bar
function FLStackedBar({ segments, height = 14 }) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  return (
    <div style={{ display: 'flex', height, borderRadius: 999, overflow: 'hidden', background: FL.grey50, gap: 2 }}>
      {segments.map((s, i) => (
        <div key={i} style={{ flex: s.value / total, background: s.color }} />
      ))}
    </div>
  );
}

// Quarterly bar chart
function FLBarChart({ data, width = 320, height = 140, padding = { t: 8, r: 8, b: 24, l: 8 } }) {
  const W = width - padding.l - padding.r;
  const H = height - padding.t - padding.b;
  const max = Math.max(...data.map(d => Math.abs(d.value)));
  const zeroY = padding.t + H / 2;
  const barW = W / data.length - 6;
  return (
    <svg width={width} height={height}>
      <line x1={padding.l} x2={padding.l + W} y1={zeroY} y2={zeroY} stroke={FL.grey} strokeWidth="1" />
      {data.map((d, i) => {
        const h = Math.abs(d.value) / max * (H / 2 - 4);
        const positive = d.value >= 0;
        const x = padding.l + i * (W / data.length) + 3;
        const y = positive ? zeroY - h : zeroY;
        const color = positive ? FL.emerald : FL.negative;
        return (
          <g key={i}>
            <rect x={x} y={y} width={barW} height={h} rx="2" fill={color} />
            <text x={x + barW / 2} y={positive ? y - 4 : y + h + 11} textAnchor="middle" fontSize="9" fill={positive ? FL.emeraldDeep : FL.negative} fontWeight="600">
              {(d.value >= 0 ? '+' : '−') + Math.abs(d.value).toFixed(1)}
            </text>
            <text x={x + barW / 2} y={padding.t + H + 14} textAnchor="middle" fontSize="9" fill={FL.subtle}>{d.label}</text>
          </g>
        );
      })}
    </svg>
  );
}

// ───────── Composite components ─────────
function FLPortfolioHero({ value, todayChange, todayPct, totalGain, totalPct, xirr }) {
  const todayPositive = todayChange >= 0;
  return (
    <div style={{
      background: `linear-gradient(160deg, ${FL.navy} 0%, ${FL.slate} 100%)`,
      borderRadius: 16, padding: 20, color: '#fff',
      position: 'relative', overflow: 'hidden',
    }}>
      {/* faint focus-ring decoration */}
      <svg width="220" height="220" style={{ position: 'absolute', right: -60, top: -60, opacity: 0.08 }} viewBox="0 0 32 32" fill="none">
        <circle cx="16" cy="16" r="13.5" stroke="#fff" strokeWidth="1" strokeDasharray="50 8" />
      </svg>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 12, fontWeight: 500, color: '#A7B0C2', letterSpacing: 0.3, textTransform: 'uppercase' }}>Your portfolio value</span>
        <FLPill tone="mint" size="xs" style={{ background: 'rgba(167,243,208,0.15)', color: FL.mint, border: 'none' }}>
          <FLDot color={FL.mint} size={6} /> Live
        </FLPill>
      </div>
      <div style={{ fontSize: 36, fontWeight: 700, letterSpacing: -1, marginTop: 6, fontVariantNumeric: 'tabular-nums' }}>
        {inr(value)}
      </div>
      <div style={{ height: 1, background: 'rgba(255,255,255,0.08)', margin: '14px 0' }} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <div style={{ fontSize: 11, color: '#A7B0C2', marginBottom: 4 }}>Today</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <span style={{ color: todayPositive ? FL.mint : '#FF8A8E', fontWeight: 600, fontSize: 15, fontVariantNumeric: 'tabular-nums' }}>
              {todayPositive ? '+' : '−'}{inr(Math.abs(todayChange)).replace('₹', '₹')}
            </span>
            <span style={{ color: todayPositive ? FL.mint : '#FF8A8E', fontSize: 12 }}>
              ({pct(todayPct)})
            </span>
          </div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: '#A7B0C2', marginBottom: 4 }}>Total gain</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <span style={{ color: FL.mint, fontWeight: 600, fontSize: 15, fontVariantNumeric: 'tabular-nums' }}>
              +{inr(totalGain).replace('₹', '₹')}
            </span>
            <span style={{ color: FL.mint, fontSize: 12 }}>({pct(totalPct)})</span>
          </div>
        </div>
      </div>
      <div style={{ height: 1, background: 'rgba(255,255,255,0.08)', margin: '14px 0' }} />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ color: '#A7B0C2', fontSize: 12 }}>XIRR</span>
          <span style={{ color: '#A7B0C2', fontSize: 11, fontStyle: 'italic' }}>(SIP-aware)</span>
          <FLInfo size={13} color="#A7B0C2" />
        </div>
        <span style={{ color: FL.mint, fontWeight: 700, fontSize: 18, fontVariantNumeric: 'tabular-nums' }}>{xirr.toFixed(2)}% p.a.</span>
      </div>
    </div>
  );
}

function FLBenchmarkChip({ label = 'vs Nifty 50', value, isPositive }) {
  const tone = isPositive ? 'positive' : 'negative';
  const verb = isPositive ? 'Ahead by' : 'Behind by';
  return (
    <FLPill tone={tone} size="sm">
      <FLDot color={isPositive ? FL.emerald : FL.negative} size={6} />
      <span style={{ color: FL.muted, fontWeight: 500 }}>{label}</span>
      <span style={{ opacity: 0.5 }}>·</span>
      <span style={{ fontWeight: 600 }}>{verb} {value.toFixed(2)}% p.a.</span>
    </FLPill>
  );
}

function FLFundCard({ name, tags, value, allocation, todayPct, xirr, onClick, compact = false }) {
  const positive = todayPct >= 0;
  return (
    <div onClick={onClick} style={{
      background: '#fff', borderRadius: 16, padding: 14,
      boxShadow: '0 4px 16px rgba(10,20,48,0.06)',
      cursor: onClick ? 'pointer' : 'default',
      display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: FL.navy, lineHeight: 1.3 }}>{name}</div>
          <div style={{ fontSize: 11, color: FL.muted, marginTop: 4, display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>
            {tags.map((t, i) => (
              <React.Fragment key={i}>
                {i > 0 && <span style={{ color: FL.subtle }}>·</span>}
                <span>{t}</span>
              </React.Fragment>
            ))}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: FL.navy, fontVariantNumeric: 'tabular-nums' }}>{inr(value)}</div>
          {allocation != null && <div style={{ fontSize: 11, color: FL.muted, marginTop: 2 }}>{allocation.toFixed(1)}% of portfolio</div>}
        </div>
      </div>
      {!compact && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: `1px solid ${FL.grey50}`, paddingTop: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 11, color: FL.muted }}>Today</span>
            <FLChange value={todayPct} size={12} />
          </div>
          {xirr != null && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 11, color: FL.muted }}>XIRR</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: FL.navy, fontVariantNumeric: 'tabular-nums' }}>{xirr.toFixed(2)}% p.a.</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function FLBottomNav({ active, onChange }) {
  const items = [
    { id: 'portfolio', label: 'Portfolio', icon: 'home' },
    { id: 'leaderboard', label: 'Leaderboard', icon: 'trophy' },
    { id: 'wealth', label: 'Wealth Journey', icon: 'compass' },
  ];
  return (
    <div style={{
      position: 'absolute', left: 0, right: 0, bottom: 0,
      background: '#fff',
      borderTop: `1px solid ${FL.grey}`,
      padding: '10px 8px 22px',
      display: 'flex', justifyContent: 'space-around',
      zIndex: 5,
    }}>
      {items.map(item => {
        const isActive = item.id === active;
        return (
          <button key={item.id} onClick={() => onChange(item.id)} style={{
            background: 'transparent', border: 'none',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
            padding: '6px 10px', cursor: 'pointer',
            color: isActive ? FL.navy : FL.subtle,
            fontFamily: 'inherit',
            minHeight: 48, minWidth: 56, flex: 1,
          }}>
            <FLIcon name={item.icon} size={22} color={isActive ? FL.emerald : FL.subtle} />
            <span style={{ fontSize: 11, fontWeight: isActive ? 600 : 500 }}>{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// ───────── Export ─────────
Object.assign(window, {
  FL, inr, pct,
  FLPill, FLDot, FLChange, FLInfo, FLChevron, FLCard,
  FLLogo, FLWordmark, FLIcon,
  FLSegment, FLTabBar,
  FLLineChart, FLDonut, FLStackedBar, FLBarChart,
  FLPortfolioHero, FLBenchmarkChip, FLFundCard, FLBottomNav,
});
