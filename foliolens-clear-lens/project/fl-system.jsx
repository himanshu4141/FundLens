// fl-system.jsx — Design system reference card + component library

function FLSwatch({ name, hex, light = false }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{
        width: '100%', aspectRatio: '1', background: hex, borderRadius: 12,
        border: light ? `1px solid ${FL.grey}` : 'none',
      }} />
      <div>
        <div style={{ fontSize: 11, fontWeight: 600, color: FL.navy }}>{name}</div>
        <div style={{ fontSize: 10, color: FL.muted, fontVariantNumeric: 'tabular-nums' }}>{hex}</div>
      </div>
    </div>
  );
}

function SectionTitle({ children, sub }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: FL.muted, fontWeight: 600, letterSpacing: 0.6, textTransform: 'uppercase' }}>{children}</div>
      {sub && <div style={{ fontSize: 12, color: FL.subtle, marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function DesignSystemCard() {
  return (
    <div style={{
      width: 880, padding: 36, background: FL.bg, fontFamily: "'Inter', sans-serif",
      color: FL.navy,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: `1px solid ${FL.grey}`, paddingBottom: 24, marginBottom: 28 }}>
        <div>
          <FLWordmark size={22} />
          <div style={{ fontSize: 14, color: FL.muted, marginTop: 8, maxWidth: 460, lineHeight: 1.5 }}>
            Clear-lens design system. A calm, clarity-first kit for novice investors. Signal over noise.
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 10, color: FL.subtle, letterSpacing: 0.4, textTransform: 'uppercase' }}>Tokens · v1.0</div>
          <div style={{ fontSize: 11, color: FL.muted, marginTop: 4 }}>Focus. Compare. Grow.</div>
        </div>
      </div>

      {/* Colour palette */}
      <SectionTitle sub="Use Emerald for positive values and primary action; Navy/Slate for hierarchy and structure; Mint as a soft positive surface; Danger Red only for negative values.">Colour palette</SectionTitle>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 14, marginTop: 14 }}>
        <FLSwatch name="Navy" hex="#0A1430" />
        <FLSwatch name="Slate" hex="#263248" />
        <FLSwatch name="Emerald · Primary" hex="#10B981" />
        <FLSwatch name="Mint" hex="#A7F3D0" />
        <FLSwatch name="Light Grey" hex="#E6EBF1" light />
        <FLSwatch name="Background" hex="#FAFBFD" light />
        <FLSwatch name="Danger" hex="#E5484D" />
        <FLSwatch name="Amber" hex="#F59E0B" />
      </div>

      {/* Typography */}
      <div style={{ marginTop: 36 }}>
        <SectionTitle sub="Inter — five weights. Tabular numerals on every numeric value.">Typography</SectionTitle>
        <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16 }}>
          {[['Light', 300], ['Regular', 400], ['Medium', 500], ['Semibold', 600], ['Bold', 700]].map(([n, w]) => (
            <div key={n} style={{ background: '#fff', border: `1px solid ${FL.grey}`, borderRadius: 12, padding: 14 }}>
              <div style={{ fontSize: 32, fontWeight: w, lineHeight: 1, color: FL.navy }}>Aa</div>
              <div style={{ fontSize: 11, color: FL.muted, marginTop: 8 }}>Inter {n}</div>
              <div style={{ fontSize: 10, color: FL.subtle }}>Weight {w}</div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div style={{ background: '#fff', border: `1px solid ${FL.grey}`, borderRadius: 12, padding: 16 }}>
            <div style={{ fontSize: 32, fontWeight: 700, letterSpacing: -0.6, color: FL.navy }}>Clarity for every decision.</div>
            <div style={{ fontSize: 13, color: FL.muted, marginTop: 6 }}>Display — Bold, 32 / -0.6 tracking</div>
          </div>
          <div style={{ background: '#fff', border: `1px solid ${FL.grey}`, borderRadius: 12, padding: 16 }}>
            <div style={{ fontSize: 13, color: FL.text, lineHeight: 1.55 }}>FundLens helps first-time investors filter noise, compare against the right benchmark, and see SIP-aware returns — so you can invest with confidence.</div>
            <div style={{ fontSize: 13, color: FL.muted, marginTop: 6 }}>Body — Regular, 13 / 1.55</div>
          </div>
        </div>
      </div>

      {/* Spacing + radius + shadow */}
      <div style={{ marginTop: 36, display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: 18 }}>
        <div>
          <SectionTitle sub="8 pt grid, 4 pt base unit. Generous whitespace.">Spacing</SectionTitle>
          <div style={{ display: 'flex', gap: 12, marginTop: 14, alignItems: 'flex-end' }}>
            {[4, 8, 12, 16, 24, 32, 48].map(n => (
              <div key={n} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                <div style={{ width: n, height: n, background: FL.emerald, borderRadius: 2 }} />
                <span style={{ fontSize: 10, color: FL.muted }}>{n}</span>
              </div>
            ))}
          </div>
        </div>
        <div>
          <SectionTitle sub="Card radius 16 px. Pills 9999.">Radius</SectionTitle>
          <div style={{ display: 'flex', gap: 10, marginTop: 14, alignItems: 'center' }}>
            {[8, 12, 16, 9999].map(r => (
              <div key={r} style={{ width: 56, height: 56, background: FL.grey50, border: `1.5px solid ${FL.grey}`, borderRadius: r, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', paddingBottom: 4 }}>
                <span style={{ fontSize: 9, color: FL.muted, fontWeight: 600 }}>{r === 9999 ? '∞' : r}</span>
              </div>
            ))}
          </div>
        </div>
        <div>
          <SectionTitle sub="0 4px 16px rgba(10,20,48,0.06)">Shadow</SectionTitle>
          <div style={{ marginTop: 14, height: 56, background: '#fff', borderRadius: 16, boxShadow: '0 4px 16px rgba(10,20,48,0.06)', display: 'flex', alignItems: 'center', padding: '0 14px' }}>
            <span style={{ fontSize: 12, color: FL.muted, fontWeight: 500 }}>Card surface · 16 r · subtle lift</span>
          </div>
        </div>
      </div>

      {/* Iconography + principles */}
      <div style={{ marginTop: 36, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        <div>
          <SectionTitle sub="2 px stroke, rounded caps and joins. Keep glyphs minimal — never decorative.">Icon style</SectionTitle>
          <div style={{ display: 'flex', gap: 14, marginTop: 14, padding: 16, background: '#fff', border: `1px solid ${FL.grey}`, borderRadius: 12 }}>
            {['home', 'trophy', 'beaker', 'bell', 'search', 'sort', 'shield', 'spark'].map(n => (
              <FLIcon key={n} name={n} size={20} color={FL.navy} />
            ))}
          </div>
        </div>
        <div>
          <SectionTitle>Brand voice · principles</SectionTitle>
          <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              ['Clarity over clutter', 'No jargon. No unexplained acronyms.'],
              ['Beginner-friendly language', 'Every metric earns its tooltip.'],
              ['Comparison that matters', 'Always benchmark against the right reference.'],
              ['Signal over noise', 'Hide what doesn\u2019t change the decision.'],
              ['Trust through transparency', 'Show our sources. Show our maths.'],
            ].map(([h, b]) => (
              <div key={h} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <div style={{ marginTop: 5, width: 6, height: 6, borderRadius: 999, background: FL.emerald, flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: FL.navy }}>{h}</div>
                  <div style={{ fontSize: 12, color: FL.muted }}>{b}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ───────── Component library ─────────
function ComponentLibrary() {
  const d = FL_DATA;
  const Block = ({ title, w = 1, children }) => (
    <div style={{ background: '#fff', border: `1px solid ${FL.grey}`, borderRadius: 12, padding: 16, gridColumn: `span ${w}` }}>
      <div style={{ fontSize: 10, color: FL.muted, fontWeight: 600, letterSpacing: 0.4, textTransform: 'uppercase', marginBottom: 12 }}>{title}</div>
      {children}
    </div>
  );
  return (
    <div style={{ width: 1100, padding: 36, background: FL.bg, fontFamily: "'Inter', sans-serif", color: FL.navy }}>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 11, color: FL.muted, fontWeight: 600, letterSpacing: 0.6, textTransform: 'uppercase' }}>Component library</div>
        <div style={{ fontSize: 28, fontWeight: 700, marginTop: 6 }}>Every brick we used to build FundLens.</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
        <Block title="Hero · Portfolio Value" w={2}>
          <FLPortfolioHero value={7974000} todayChange={-69800} todayPct={-0.87} totalGain={2471000} totalPct={44.9} xirr={14.84} />
          <div style={{ fontSize: 11, color: FL.muted, marginTop: 8, lineHeight: 1.5 }}>Props: value, todayChange, todayPct, totalGain, totalPct, xirr. States: positive / negative today; XIRR tooltip always visible.</div>
        </Block>
        <Block title="Benchmark Comparison Chip" w={2}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <FLBenchmarkChip value={1.86} isPositive={true} />
            <FLBenchmarkChip value={2.34} isPositive={false} label="vs Nifty 50" />
          </div>
          <div style={{ fontSize: 11, color: FL.muted, marginTop: 12, lineHeight: 1.5 }}>Pill that always tells the user which side of the benchmark they are on, and by how much p.a.</div>
        </Block>

        <Block title="Fund Card" w={2}>
          <FLFundCard {...d.funds[0]} todayPct={d.funds[0].todayPct} />
          <div style={{ height: 8 }} />
          <FLFundCard {...d.funds[4]} todayPct={d.funds[4].todayPct} />
          <div style={{ fontSize: 11, color: FL.muted, marginTop: 8, lineHeight: 1.5 }}>Reusable across Your Funds, Insights, Detail. Variants: <b>full</b> (today + XIRR row), <b>compact</b> (header only).</div>
        </Block>
        <Block title="KPI Card">
          <div style={{ background: FL.mint50, borderRadius: 12, padding: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: FL.muted }}>XIRR (SIP-aware) <FLInfo size={12} /></div>
            <div style={{ fontSize: 26, fontWeight: 700, color: FL.emeraldDeep, marginTop: 6 }}>14.84%</div>
            <div style={{ fontSize: 10, color: FL.muted, marginTop: 2 }}>per annum</div>
          </div>
        </Block>
        <Block title="Pills · States">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            <FLPill tone="neutral">Equity</FLPill>
            <FLPill tone="mint">Direct</FLPill>
            <FLPill tone="positive">+3.2%</FLPill>
            <FLPill tone="negative">−1.59%</FLPill>
            <FLPill tone="navy">Active</FLPill>
          </div>
        </Block>

        <Block title="Asset Allocation Donut">
          <FLDonut segments={d.allocation} size={150} thickness={22} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 8 }}>
            {d.allocation.map((s, i) => (
              <div key={i} style={{ fontSize: 11, color: FL.muted, display: 'flex', alignItems: 'center', gap: 6 }}>
                <FLDot color={s.color} /> {s.label} · {s.value}%
              </div>
            ))}
          </div>
        </Block>
        <Block title="Market Cap Donut">
          <FLDonut segments={d.marketCap} size={150} thickness={22} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 8 }}>
            {d.marketCap.map((s, i) => (
              <div key={i} style={{ fontSize: 11, color: FL.muted, display: 'flex', alignItems: 'center', gap: 6 }}>
                <FLDot color={s.color} /> {s.label} · {s.value}%
              </div>
            ))}
          </div>
        </Block>
        <Block title="Asset Mix Bar" w={2}>
          <FLStackedBar segments={[{ label: 'Equity', value: 97.1, color: FL.emerald }, { label: 'Cash', value: 2.9, color: FL.mint }]} />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 12 }}>
            <span><FLDot color={FL.emerald} /> Equity 97.1%</span>
            <span><FLDot color={FL.mint} /> Cash 2.9%</span>
          </div>
        </Block>

        <Block title="Performance Chart" w={2}>
          <FLLineChart data={d.portfolioSeries} benchmark={d.niftySeries} width={400} height={150} />
        </Block>
        <Block title="Growth Consistency" w={2}>
          <FLBarChart data={d.dspDetail.quarterly} width={400} height={150} />
        </Block>

        <Block title="Time Range Tabs" w={2}>
          <FLSegment options={['1M', '3M', '6M', '1Y', '3Y', 'All']} value="1Y" onChange={() => {}} fullWidth />
        </Block>
        <Block title="Tab Bar">
          <FLTabBar tabs={['Performance', 'NAV History', 'Composition']} value="Performance" onChange={() => {}} />
        </Block>
        <Block title="Sort Dropdown">
          <button style={{ width: '100%', background: '#fff', border: `1px solid ${FL.grey}`, borderRadius: 12, padding: '10px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: 44, cursor: 'pointer' }}>
            <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <FLIcon name="sort" size={16} color={FL.muted} />
              <span style={{ fontSize: 13 }}>Current value</span>
            </span>
            <FLChevron dir="down" />
          </button>
        </Block>

        <Block title="Best / Worst Today" w={2}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <FLCard padding={12}>
              <div style={{ fontSize: 10, color: FL.emeraldDeep, fontWeight: 600, textTransform: 'uppercase' }}>Today's best</div>
              <div style={{ fontSize: 12, fontWeight: 600, marginTop: 4 }}>DSP US Specific Equity Omni FoF</div>
              <FLChange value={0.96} size={13} />
            </FLCard>
            <FLCard padding={12}>
              <div style={{ fontSize: 10, color: FL.negative, fontWeight: 600, textTransform: 'uppercase' }}>Today's worst</div>
              <div style={{ fontSize: 12, fontWeight: 600, marginTop: 4 }}>ICICI Prudential Value Discovery</div>
              <FLChange value={-1.59} size={13} />
            </FLCard>
          </div>
        </Block>
        <Block title="Top Holdings Row" w={2}>
          <div style={{ display: 'flex', alignItems: 'center', padding: '8px 0', gap: 10 }}>
            <div style={{ width: 22, height: 22, background: FL.grey50, color: FL.muted, borderRadius: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 600 }}>1</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 500 }}>HDFC Bank Ltd</div>
              <div style={{ fontSize: 10, color: FL.muted }}>Financial Services</div>
            </div>
            <span style={{ fontSize: 13, fontWeight: 600 }}>6.6%</span>
          </div>
        </Block>

        <Block title="Bottom Navigation" w={2}>
          <div style={{ position: 'relative', height: 70, background: FL.grey50, borderRadius: 12, overflow: 'hidden' }}>
            <FLBottomNav active="portfolio" onChange={() => {}} />
          </div>
        </Block>
        <Block title="Search bar" w={2}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#fff', borderRadius: 12, padding: '12px 14px', border: `1px solid ${FL.grey}`, minHeight: 44 }}>
            <FLIcon name="search" size={16} color={FL.muted} />
            <span style={{ fontSize: 13, color: FL.subtle }}>Search funds</span>
          </div>
        </Block>
      </div>
    </div>
  );
}

// ───────── Usability critique card ─────────
function CritiqueCard() {
  const Sev = ({ level, color, items }) => (
    <div style={{ marginTop: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={{ width: 8, height: 8, borderRadius: 999, background: color }} />
        <span style={{ fontSize: 11, fontWeight: 700, color, letterSpacing: 0.6, textTransform: 'uppercase' }}>{level}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {items.map((it, i) => (
          <div key={i} style={{ background: '#fff', border: `1px solid ${FL.grey}`, borderRadius: 12, padding: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: FL.navy }}>{it.title}</div>
            <div style={{ fontSize: 12, color: FL.muted, marginTop: 4, lineHeight: 1.5 }}>{it.body}</div>
          </div>
        ))}
      </div>
    </div>
  );
  return (
    <div style={{ width: 880, padding: 36, background: FL.bg, fontFamily: "'Inter', sans-serif", color: FL.navy }}>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 11, color: FL.muted, fontWeight: 600, letterSpacing: 0.6, textTransform: 'uppercase' }}>Usability critique</div>
        <div style={{ fontSize: 28, fontWeight: 700, marginTop: 6, letterSpacing: -0.4 }}>Honest review for the novice Indian investor.</div>
      </div>

      {/* What works well */}
      <div style={{ background: FL.mint50, border: `1px solid ${FL.mint}`, borderRadius: 14, padding: 18 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: FL.emeraldDeep, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 10 }}>✓ What works well</div>
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: FL.text, lineHeight: 1.7 }}>
          <li><b>Hero card answers the Tuesday question.</b> Total value, today, total gain, XIRR — all in one glance.</li>
          <li><b>Benchmark chip on the home screen</b> directly tells you whether you're ahead of Nifty 50, p.a.</li>
          <li><b>XIRR is labelled "SIP-aware"</b> next to it every time — a small, calm act of dejargonification.</li>
          <li><b>Visual restraint.</b> Two surface tones, one accent, no gradients screaming for attention.</li>
        </ul>
      </div>

      <Sev level="Critical · blocks understanding or trust" color={FL.negative} items={[
        { title: 'XIRR explanation is a hover/info icon, not a sentence.', body: 'A novice tapping ⓘ may still not understand "SIP-aware return." Replace the tooltip with one inline plain-English caption: "How fast your money has grown each year, accounting for your SIP timing."' },
        { title: 'No empty / no-internet / loading states designed.', body: 'A first-run user with zero funds, or someone in a tunnel, will see broken charts and unexplained zeros. Design at least empty (no-funds), error (offline), and skeleton-loading variants for the hero, chart, and list.' },
        { title: 'Color-only encoding for positive / negative.', body: 'Today\'s change uses only green / red. Pair every coloured number with an arrow (▲/▼) AND a sign (+ / −) — already partially done, but enforce it everywhere (especially the quarterly bars and "outperforming" badge).' },
        { title: 'Largest-position warning is missing.', body: '34.8% of the portfolio in one fund is concentration risk. Beginners need a calm flag, e.g. "Concentrated position — most novice portfolios spread top fund under 25%." Today the screen celebrates it.' },
      ]} />

      <Sev level="Moderate · friction or confusion" color={FL.amber} items={[
        { title: 'Bottom nav labels assume the user knows what each tab does.', body: '"Leaderboard" and "Simulator" are abstract. Consider "Compare" and "Project" — verbs that describe the user\'s job.' },
        { title: 'Category tags ("Equity · Direct · Growth") are jargon.', body: 'Make at least one tap reveal a one-line explainer the first three times the user sees them. Or replace "Direct" with a small ⓘ chip that links to a glossary.' },
        { title: 'Today\'s change is overweighted on the hero.', body: 'For a long-term SIP investor, the daily blip is the noisiest signal. Visually demote it (smaller, secondary colour) and make XIRR the headline number — that\'s the one the brand promises.' },
        { title: 'Insights screen is dense.', body: '4 charts + sectors + holdings + footnote on one screen. Group with collapsible sections, or split into "Composition" and "Holdings" tabs.' },
        { title: 'Sector bars are normalised to 30%, not 100%.', body: 'A sector that takes 31.8% (Others) overflows visually. Either normalise to the largest segment, or add a tick at 100%.' },
      ]} />

      <Sev level="Minor · polish" color={FL.muted} items={[
        { title: 'Two info-icon styles.', body: 'Sometimes ⓘ, sometimes "(SIP-aware)" inline. Pick one.' },
        { title: 'Touch target audit.', body: 'Sort dropdown and time-range pills are at the 44 px floor — verify on a 5.5″ Android. Also bottom-nav icons need ≥ 48 px touch area, not visual size.' },
        { title: '₹ vs L vs Cr inconsistency.', body: 'The hero uses L; some cards use full ₹. Lock to "L if ≥ 1L, Cr if ≥ 1 Cr, otherwise full ₹" and document it.' },
        { title: 'Chart end-labels overlap on small phones.', body: 'When portfolio and Nifty converge at the right edge, the +44.9% / +12.9% labels collide. Add automatic offset or a small legend below.' },
      ]} />

      {/* One thing to prioritise */}
      <div style={{ marginTop: 24, background: FL.navy, color: '#fff', borderRadius: 16, padding: 22 }}>
        <div style={{ fontSize: 11, color: FL.mint, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8 }}>★ Prioritise this one</div>
        <div style={{ fontSize: 18, fontWeight: 600, lineHeight: 1.4 }}>Replace every <span style={{ color: FL.mint }}>ⓘ</span> on a key metric with a one-line caption that defines it in plain English.</div>
        <div style={{ fontSize: 13, color: '#A7B0C2', marginTop: 8, lineHeight: 1.6 }}>FundLens promises radical clarity for novices. Today we still ask the user to tap to learn what XIRR / SIP-aware / Direct / Growth mean. That single change — captions over tooltips — does more for the brand than any visual polish elsewhere.</div>
      </div>

      <div style={{ marginTop: 18, fontSize: 11, color: FL.subtle, lineHeight: 1.6 }}>
        Audited against FundLens design principles: signal over noise · single-shot answers · dejargonify everything.
      </div>
    </div>
  );
}

Object.assign(window, { DesignSystemCard, ComponentLibrary, CritiqueCard });
