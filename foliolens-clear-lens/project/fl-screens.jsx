// fl-screens.jsx — Four phone screens. Self-contained inside a 390x844 frame.

const PhoneFrame = ({ children, screenLabel }) => (
  <div data-screen-label={screenLabel} style={{
    width: 390, height: 844, background: FL.bg,
    borderRadius: 44, position: 'relative', overflow: 'hidden',
    border: `10px solid ${FL.navy}`,
    boxShadow: '0 30px 80px rgba(10,20,48,0.18), 0 8px 24px rgba(10,20,48,0.10)',
    fontFamily: "'Inter', sans-serif",
    color: FL.text,
  }}>
    {/* Notch */}
    <div style={{
      position: 'absolute', top: 8, left: '50%', transform: 'translateX(-50%)',
      width: 110, height: 28, background: FL.navy, borderRadius: 18, zIndex: 50,
    }} />
    {/* Status bar */}
    <div style={{
      height: 44, paddingTop: 14, paddingLeft: 28, paddingRight: 28,
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      fontSize: 14, fontWeight: 600, color: FL.navy,
    }}>
      <span>9:41</span>
      <span style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
        <svg width="16" height="10" viewBox="0 0 16 10"><path d="M1 9V7M5 9V5M9 9V3M13 9V1" stroke={FL.navy} strokeWidth="1.5" strokeLinecap="round" /></svg>
        <svg width="14" height="10" viewBox="0 0 14 10"><path d="M7 9c-2 0-3.5-1-5-2.5M7 9c2 0 3.5-1 5-2.5M7 5c-1 0-2 .5-3 1.5M7 5c1 0 2 .5 3 1.5M2 4c1.5-1.5 3-2 5-2s3.5.5 5 2" stroke={FL.navy} strokeWidth="1.4" strokeLinecap="round" fill="none"/></svg>
        <svg width="22" height="10" viewBox="0 0 22 10"><rect x="0.5" y="0.5" width="18" height="9" rx="2" stroke={FL.navy} strokeWidth="1" fill="none"/><rect x="2" y="2" width="14" height="6" rx="1" fill={FL.navy}/><rect x="19" y="3" width="2" height="4" rx="0.5" fill={FL.navy}/></svg>
      </span>
    </div>
    {children}
  </div>
);

// Topbar (logo + bell)
function FLTopBar({ title, onBack }) {
  return (
    <div style={{
      padding: '10px 20px 12px', display: 'flex', alignItems: 'center',
      justifyContent: 'space-between', background: FL.bg, position: 'sticky', top: 0, zIndex: 4,
    }}>
      {onBack ? (
        <button onClick={onBack} style={{ background: 'transparent', border: 'none', padding: 6, cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
          <FLIcon name="back" size={22} color={FL.navy} />
        </button>
      ) : (
        <FLWordmark size={16} />
      )}
      {title && (
        <div style={{ fontSize: 15, fontWeight: 600, color: FL.navy, position: 'absolute', left: '50%', transform: 'translateX(-50%)' }}>{title}</div>
      )}
      <button style={{ background: FL.grey50, border: 'none', width: 36, height: 36, borderRadius: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
        <FLIcon name="bell" size={18} color={FL.navy} />
      </button>
    </div>
  );
}

// ───────── Screen 1: Main Portfolio ─────────
function ScreenPortfolio({ onOpenInsights, onOpenFunds, onOpenFund }) {
  const [range, setRange] = React.useState('1Y');
  const d = FL_DATA;
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <FLTopBar />
      <div className="fl-noscroll" style={{ flex: 1, overflowY: 'auto', padding: '4px 16px 96px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <FLPortfolioHero
          value={d.portfolio.value}
          todayChange={d.portfolio.todayChange}
          todayPct={d.portfolio.todayPct}
          totalGain={d.portfolio.totalGain}
          totalPct={d.portfolio.totalPct}
          xirr={d.portfolio.xirr}
        />

        {/* Benchmark chip */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <FLBenchmarkChip value={d.portfolio.aheadByPa} isPositive={true} />
          <span style={{ fontSize: 11, color: FL.muted }}>Nifty 50: <span style={{ fontWeight: 600, color: FL.navy }}>+{d.portfolio.nifty1y}%</span></span>
        </div>

        {/* Investments over time */}
        <FLCard padding={16}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: FL.navy }}>Your investments over time</div>
              <div style={{ fontSize: 11, color: FL.muted, marginTop: 2 }}>See how your investments have grown.</div>
            </div>
          </div>
          <FLLineChart
            data={d.portfolioSeries}
            benchmark={d.niftySeries}
            width={326} height={150}
            primary={FL.emerald}
            secondary={FL.subtle}
          />
          <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginTop: 8 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: FL.muted }}>
              <FLDot color={FL.emerald} /> Your portfolio
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: FL.muted }}>
              <span style={{ width: 12, height: 1.5, background: FL.subtle, borderRadius: 1 }} /> Nifty 50
            </span>
          </div>
          <div style={{ marginTop: 12 }}>
            <FLSegment options={['1M', '3M', '6M', '1Y', '3Y', 'All']} value={range} onChange={setRange} fullWidth />
          </div>
        </FLCard>

        {/* Today's best / worst */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <FLCard padding={14}>
            <div style={{ fontSize: 11, color: FL.emeraldDeep, fontWeight: 600, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.4 }}>Today's best</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: FL.navy, lineHeight: 1.3, minHeight: 32 }}>{d.todaysBest.name}</div>
            <div style={{ fontSize: 10, color: FL.muted, marginTop: 4 }}>{d.todaysBest.tags.join(' · ')}</div>
            <div style={{ marginTop: 8, display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <FLChange value={d.todaysBest.todayPct} size={14} />
              <span style={{ fontSize: 11, color: FL.emeraldDeep, fontWeight: 500 }}>+{inr(d.todaysBest.todayGain).replace('₹','₹')}</span>
            </div>
          </FLCard>
          <FLCard padding={14}>
            <div style={{ fontSize: 11, color: FL.negative, fontWeight: 600, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.4 }}>Today's worst</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: FL.navy, lineHeight: 1.3, minHeight: 32 }}>{d.todaysWorst.name}</div>
            <div style={{ fontSize: 10, color: FL.muted, marginTop: 4 }}>{d.todaysWorst.tags.join(' · ')}</div>
            <div style={{ marginTop: 8, display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <FLChange value={d.todaysWorst.todayPct} size={14} />
              <span style={{ fontSize: 11, color: FL.negative, fontWeight: 500 }}>−{inr(Math.abs(d.todaysWorst.todayGain)).replace('₹','₹')}</span>
            </div>
          </FLCard>
        </div>

        {/* Asset allocation */}
        <FLCard padding={16}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: FL.navy }}>Asset allocation</div>
            <div style={{ fontSize: 11, color: FL.muted }}>as on Mar 2026</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
            <FLDonut segments={d.allocation} size={110} thickness={16} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
              {d.allocation.map((seg, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <FLDot color={seg.color} size={9} />
                    <span style={{ fontSize: 12, color: FL.text }}>{seg.label}</span>
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 600, color: FL.navy, fontVariantNumeric: 'tabular-nums' }}>{seg.value.toFixed(1)}%</span>
                </div>
              ))}
            </div>
          </div>
        </FLCard>

        {/* Nav cards */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <FLCard padding={14} onClick={onOpenInsights}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ width: 32, height: 32, background: FL.mint50, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <FLIcon name="grid" size={16} color={FL.emeraldDeep} />
              </div>
              <FLChevron dir="right" size={16} />
            </div>
            <div style={{ fontSize: 14, fontWeight: 600, color: FL.navy, marginTop: 10 }}>Portfolio Insights</div>
            <div style={{ fontSize: 11, color: FL.muted, marginTop: 2 }}>Deeper analysis of your portfolio</div>
          </FLCard>
          <FLCard padding={14} onClick={onOpenFunds}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ width: 32, height: 32, background: FL.mint50, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <FLIcon name="spark" size={16} color={FL.emeraldDeep} />
              </div>
              <FLChevron dir="right" size={16} />
            </div>
            <div style={{ fontSize: 14, fontWeight: 600, color: FL.navy, marginTop: 10 }}>Your Funds</div>
            <div style={{ fontSize: 11, color: FL.muted, marginTop: 2 }}>14 active funds in your portfolio</div>
          </FLCard>
        </div>
      </div>
    </div>
  );
}

// ───────── Screen 2: Portfolio Insights ─────────
function ScreenInsights({ onBack }) {
  const d = FL_DATA;
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <FLTopBar title="Portfolio Insights" onBack={onBack} />
      <div className="fl-noscroll" style={{ flex: 1, overflowY: 'auto', padding: '4px 16px 96px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Asset allocation */}
        <FLCard>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: FL.navy }}>Asset allocation</div>
            <div style={{ fontSize: 11, color: FL.muted }}>as on Mar 2026</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <FLDonut segments={d.allocation} size={108} thickness={16} />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {d.allocation.map((s, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <FLDot color={s.color} size={9} />
                    <span style={{ fontSize: 12 }}>{s.label}</span>
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{s.value.toFixed(1)}%</span>
                </div>
              ))}
            </div>
          </div>
        </FLCard>

        {/* Market cap mix */}
        <FLCard>
          <div style={{ fontSize: 14, fontWeight: 600, color: FL.navy, marginBottom: 12 }}>Market cap mix</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <FLDonut segments={d.marketCap} size={108} thickness={16} />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {d.marketCap.map((s, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <FLDot color={s.color} size={9} />
                    <span style={{ fontSize: 12 }}>{s.label} Cap</span>
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{s.value.toFixed(1)}%</span>
                </div>
              ))}
            </div>
          </div>
        </FLCard>

        {/* Sectors */}
        <FLCard>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: FL.navy }}>Sector exposure</div>
            <FLInfo />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {d.sectors.map((s, i) => (
              <div key={i}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                  <span style={{ fontSize: 12, color: FL.text }}>{s.name}</span>
                  <span style={{ fontSize: 11, color: FL.muted, fontVariantNumeric: 'tabular-nums' }}>
                    <span style={{ fontWeight: 600, color: FL.navy }}>{s.pct.toFixed(1)}%</span> · {inr(s.value)}
                  </span>
                </div>
                <div style={{ height: 6, background: FL.grey50, borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${(s.pct / 30) * 100}%`, background: FL.emerald, borderRadius: 3 }} />
                </div>
              </div>
            ))}
          </div>
        </FLCard>

        {/* Top holdings */}
        <FLCard>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: FL.navy }}>Top holdings</div>
              <div style={{ fontSize: 11, color: FL.muted, marginTop: 2 }}>Aggregated across 14 funds</div>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {d.topHoldings.map((h, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', padding: '10px 0', borderBottom: i < d.topHoldings.length - 1 ? `1px solid ${FL.grey50}` : 'none', gap: 12 }}>
                <div style={{ width: 24, height: 24, background: FL.grey50, color: FL.muted, borderRadius: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600 }}>{i + 1}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: FL.navy }}>{h.name}</div>
                  <div style={{ fontSize: 10, color: FL.muted, marginTop: 2 }}>{h.sector}</div>
                </div>
                <span style={{ fontSize: 13, fontWeight: 600, color: FL.navy, fontVariantNumeric: 'tabular-nums' }}>{h.pct.toFixed(1)}%</span>
              </div>
            ))}
          </div>
        </FLCard>

        {/* AMFI */}
        <div style={{ display: 'flex', gap: 8, padding: 12, alignItems: 'flex-start' }}>
          <FLIcon name="shield" size={14} color={FL.muted} />
          <div style={{ fontSize: 10, color: FL.muted, lineHeight: 1.5 }}>
            Holdings & sector data sourced from AMFI disclosures, Mar 2026. NAVs and allocations may shift between disclosure cycles.
          </div>
        </div>
      </div>
    </div>
  );
}

// ───────── Screen 3: Your Funds ─────────
function ScreenFunds({ onBack, onOpenFund }) {
  const d = FL_DATA;
  const [sort, setSort] = React.useState('Current value');
  const top3Pct = d.funds.slice(0, 3).reduce((s, f) => s + f.alloc, 0);
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <FLTopBar title="Your Funds" onBack={onBack} />
      <div className="fl-noscroll" style={{ flex: 1, overflowY: 'auto', padding: '4px 16px 96px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Allocation overview */}
        <FLCard>
          <div style={{ fontSize: 12, color: FL.muted, fontWeight: 500, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.4 }}>Allocation overview</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'auto auto 1fr', gap: 14, alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 22, fontWeight: 700, color: FL.navy, fontVariantNumeric: 'tabular-nums' }}>{d.funds.length}</div>
              <div style={{ fontSize: 10, color: FL.muted, marginTop: 2 }}>Active funds</div>
            </div>
            <div style={{ width: 1, alignSelf: 'stretch', background: FL.grey }} />
            <div>
              <div style={{ fontSize: 22, fontWeight: 700, color: FL.navy, fontVariantNumeric: 'tabular-nums' }}>{top3Pct.toFixed(1)}%</div>
              <div style={{ fontSize: 10, color: FL.muted, marginTop: 2 }}>In top 3 funds</div>
            </div>
          </div>
          <div style={{ marginTop: 12, padding: '10px 12px', background: FL.mint50, borderRadius: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
            <FLDot color={FL.emerald} />
            <span style={{ fontSize: 11, color: FL.muted }}>Largest:</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: FL.navy, flex: 1 }}>DSP Large & Mid Cap</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: FL.emeraldDeep, fontVariantNumeric: 'tabular-nums' }}>34.8%</span>
          </div>
        </FLCard>

        {/* Search + sort */}
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, background: '#fff', borderRadius: 12, padding: '10px 12px', boxShadow: '0 4px 16px rgba(10,20,48,0.06)', minHeight: 44 }}>
            <FLIcon name="search" size={16} color={FL.muted} />
            <span style={{ fontSize: 13, color: FL.subtle }}>Search funds</span>
          </div>
          <button style={{ background: '#fff', border: 'none', borderRadius: 12, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 6, boxShadow: '0 4px 16px rgba(10,20,48,0.06)', cursor: 'pointer', minHeight: 44 }}>
            <FLIcon name="sort" size={16} color={FL.muted} />
            <span style={{ fontSize: 12, fontWeight: 500, color: FL.navy }}>{sort}</span>
            <FLChevron dir="down" size={14} />
          </button>
        </div>

        {/* Fund list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {d.funds.map((f, i) => (
            <FLFundCard key={i}
              name={f.name} tags={f.tags}
              value={f.value} allocation={f.alloc}
              todayPct={f.todayPct} xirr={f.xirr}
              onClick={i === 0 ? onOpenFund : undefined}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ───────── Screen 4: Fund Detail ─────────
function ScreenFundDetail({ onBack }) {
  const f = FL_DATA.dspDetail;
  const [tab, setTab] = React.useState('Performance');
  const [range, setRange] = React.useState('1Y');
  const [bench, setBench] = React.useState('Nifty 50');
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <FLTopBar title="Fund detail" onBack={onBack} />
      <div className="fl-noscroll" style={{ flex: 1, overflowY: 'auto', padding: '4px 16px 96px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Header */}
        <FLCard>
          <div style={{ fontSize: 16, fontWeight: 700, color: FL.navy, lineHeight: 1.3 }}>{f.name}</div>
          <div style={{ fontSize: 11, color: FL.muted, marginTop: 6 }}>{f.tags.join(' · ')}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginTop: 14, paddingTop: 14, borderTop: `1px solid ${FL.grey50}` }}>
            <div>
              <div style={{ fontSize: 10, color: FL.muted, marginBottom: 2 }}>Current value</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: FL.navy, fontVariantNumeric: 'tabular-nums' }}>{inr(f.currentValue)}</div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: FL.muted, marginBottom: 2 }}>Invested</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: FL.navy, fontVariantNumeric: 'tabular-nums' }}>{inr(f.invested)}</div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: FL.muted, marginBottom: 2 }}>Units</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: FL.navy, fontVariantNumeric: 'tabular-nums' }}>{f.units.toFixed(2)}</div>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, padding: '10px 12px', background: FL.mint50, borderRadius: 12 }}>
            <div>
              <div style={{ fontSize: 10, color: FL.muted }}>Gain</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: FL.emeraldDeep }}>+{inr(f.gain)} <span style={{ fontSize: 11, fontWeight: 500 }}>(+{f.gainPct.toFixed(1)}%)</span></div>
            </div>
            <div style={{ width: 1, height: 32, background: FL.mint }} />
            <div>
              <div style={{ fontSize: 10, color: FL.muted, display: 'flex', alignItems: 'center', gap: 4 }}>XIRR <FLInfo size={11} /></div>
              <div style={{ fontSize: 14, fontWeight: 700, color: FL.emeraldDeep }}>{f.xirr.toFixed(2)}% <span style={{ fontSize: 10, fontWeight: 500 }}>p.a.</span></div>
            </div>
          </div>
        </FLCard>

        {/* Tabs */}
        <FLCard padding={0}>
          <FLTabBar tabs={['Performance', 'NAV History', 'Composition']} value={tab} onChange={setTab} />

          {tab === 'Performance' && (
            <div style={{ padding: 16 }}>
              <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 10, color: FL.muted }}>Your fund (1Y)</div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: FL.emeraldDeep }}>+{f.yourFund1Y.toFixed(1)}%</div>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 10, color: FL.muted }}>{bench} (1Y)</div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: FL.negative }}>−{Math.abs(f.nifty1Y).toFixed(1)}%</div>
                </div>
              </div>
              <div style={{ background: FL.mint50, borderRadius: 10, padding: '8px 12px', fontSize: 12, color: FL.emeraldDeep, fontWeight: 600, marginBottom: 12 }}>
                ✓ Outperforming by {f.outperformance.toFixed(1)}% vs {bench}
              </div>
              <div style={{ marginBottom: 12 }}>
                <FLSegment options={['1M', '3M', '6M', '1Y', '3Y', 'All']} value={range} onChange={setRange} fullWidth />
              </div>
              <div style={{ marginBottom: 10, display: 'flex', gap: 6 }}>
                <FLPill tone="navy" size="xs"><FLDot color={FL.emerald} size={6} /> {bench}</FLPill>
                <FLPill tone="neutral" size="xs">BSE Sensex</FLPill>
              </div>
              <FLLineChart
                data={f.fundSeries} benchmark={f.niftyDetail}
                width={326} height={150}
                primary={FL.emerald} secondary={FL.subtle}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, padding: '10px 0', borderTop: `1px solid ${FL.grey50}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <FLDot color={FL.emerald} /><span style={{ fontSize: 12 }}>Fund</span>
                </div>
                <span style={{ fontSize: 12, fontWeight: 600, color: FL.emeraldDeep }}>+7.95%</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 12, height: 1.5, background: FL.subtle, borderRadius: 1 }} />
                  <span style={{ fontSize: 12 }}>{bench}</span>
                </div>
                <span style={{ fontSize: 12, fontWeight: 600, color: FL.emeraldDeep }}>+3.32%</span>
              </div>
            </div>
          )}

          {tab === 'NAV History' && (
            <div style={{ padding: 16 }}>
              <div style={{ marginBottom: 12 }}>
                <FLSegment options={['1M', '3M', '6M', '1Y', '3Y', 'All']} value={range} onChange={setRange} fullWidth />
              </div>
              <FLLineChart data={f.navSeries} width={326} height={170} primary={FL.emerald} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: FL.subtle, marginTop: -4, padding: '0 4px' }}>
                <span>Apr '25</span><span>Jul '25</span><span>Oct '25</span><span>Jan '26</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginTop: 16, paddingTop: 14, borderTop: `1px solid ${FL.grey50}` }}>
                <div>
                  <div style={{ fontSize: 9, color: FL.muted, textTransform: 'uppercase', letterSpacing: 0.3 }}>Current NAV</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: FL.navy, fontVariantNumeric: 'tabular-nums', marginTop: 4 }}>₹{f.nav.toFixed(4)}</div>
                </div>
                <div>
                  <div style={{ fontSize: 9, color: FL.muted, textTransform: 'uppercase', letterSpacing: 0.3 }}>Period start</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: FL.navy, fontVariantNumeric: 'tabular-nums', marginTop: 4 }}>₹{f.periodStart.toFixed(4)}</div>
                </div>
                <div>
                  <div style={{ fontSize: 9, color: FL.muted, textTransform: 'uppercase', letterSpacing: 0.3 }}>Change</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: FL.emeraldDeep, marginTop: 4 }}>+{f.navChange.toFixed(2)}%</div>
                </div>
              </div>
              <div style={{ marginTop: 14 }}>
                <div style={{ fontSize: 11, color: FL.muted, fontWeight: 600, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.3 }}>Technical details</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: `1px solid ${FL.grey50}` }}>
                  <span style={{ fontSize: 12, color: FL.muted }}>Expense ratio</span>
                  <span style={{ fontSize: 12, fontWeight: 600 }}>{f.expenseRatio}%</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: `1px solid ${FL.grey50}` }}>
                  <span style={{ fontSize: 12, color: FL.muted }}>AUM</span>
                  <span style={{ fontSize: 12, fontWeight: 600 }}>{f.aum}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0' }}>
                  <span style={{ fontSize: 12, color: FL.muted }}>Min SIP</span>
                  <span style={{ fontSize: 12, fontWeight: 600 }}>₹{f.minSip}</span>
                </div>
              </div>
              <div style={{ marginTop: 12, padding: '10px 12px', background: FL.grey50, borderRadius: 10, display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                <FLInfo size={14} />
                <div style={{ fontSize: 11, color: FL.muted, lineHeight: 1.5 }}>NAV history shows how the fund's price moves over time — it doesn't include your SIP timing.</div>
              </div>
            </div>
          )}

          {tab === 'Composition' && (
            <div style={{ padding: 16 }}>
              <div style={{ fontSize: 11, color: FL.muted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 8 }}>Asset mix</div>
              <FLStackedBar segments={f.composition.assetMix} />
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 12 }}>
                {f.composition.assetMix.map((s, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <FLDot color={s.color} />
                    <span>{s.label} <span style={{ fontWeight: 600 }}>{s.value}%</span></span>
                  </div>
                ))}
              </div>

              <div style={{ fontSize: 11, color: FL.muted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4, marginTop: 18, marginBottom: 8 }}>Market cap mix</div>
              <FLStackedBar segments={f.composition.capMix} />
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 12 }}>
                {f.composition.capMix.map((s, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <FLDot color={s.color} />
                    <span>{s.label} <span style={{ fontWeight: 600 }}>{s.value}%</span></span>
                  </div>
                ))}
              </div>

              <div style={{ fontSize: 11, color: FL.muted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4, marginTop: 20, marginBottom: 8 }}>Sector exposure</div>
              {f.composition.sectors.map((s, i) => (
                <div key={i}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '6px 0' }}>
                    <span style={{ fontSize: 12 }}>{s.name}</span>
                    <span style={{ fontSize: 12, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{s.pct.toFixed(1)}%</span>
                  </div>
                  <div style={{ height: 4, background: FL.grey50, borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${(s.pct / 40) * 100}%`, background: FL.emerald }} />
                  </div>
                </div>
              ))}

              <div style={{ fontSize: 11, color: FL.muted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4, marginTop: 20, marginBottom: 8 }}>Top 5 holdings</div>
              {f.composition.holdings.map((h, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', padding: '10px 0', borderBottom: i < f.composition.holdings.length - 1 ? `1px solid ${FL.grey50}` : 'none', gap: 10 }}>
                  <div style={{ width: 22, height: 22, background: FL.grey50, color: FL.muted, borderRadius: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 600 }}>{i + 1}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 500 }}>{h.name}</div>
                    <div style={{ fontSize: 10, color: FL.muted }}>{h.sector}</div>
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{h.pct.toFixed(1)}%</span>
                </div>
              ))}
            </div>
          )}
        </FLCard>

        {/* Growth consistency */}
        <FLCard>
          <div style={{ fontSize: 14, fontWeight: 600, color: FL.navy, marginBottom: 4 }}>Growth consistency</div>
          <div style={{ fontSize: 11, color: FL.muted, marginBottom: 10 }}>Quarterly returns (%)</div>
          <FLBarChart data={f.quarterly} width={326} height={150} />
          <div style={{ display: 'flex', gap: 16, marginTop: 8 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: FL.muted }}>
              <FLDot color={FL.emerald} /> Positive quarter
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: FL.muted }}>
              <FLDot color={FL.negative} /> Negative quarter
            </span>
          </div>
        </FLCard>

        {/* Portfolio weight */}
        <FLCard>
          <div style={{ fontSize: 14, fontWeight: 600, color: FL.navy, marginBottom: 12 }}>Portfolio weight</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <FLDonut
              segments={[{ value: f.portfolioWeight, color: FL.emerald }, { value: 100 - f.portfolioWeight, color: FL.grey }]}
              size={120} thickness={18}
              centerLabel={`${f.portfolioWeight}%`}
            />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 24, fontWeight: 700, color: FL.navy }}>{f.portfolioWeight}%</div>
              <div style={{ fontSize: 11, color: FL.muted, marginTop: 2 }}>of portfolio</div>
              <div style={{ fontSize: 12, color: FL.navy, marginTop: 8, fontWeight: 500 }}>Largest position</div>
              <div style={{ fontSize: 11, color: FL.muted }}>{inr(f.currentValue)}</div>
              <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: FL.muted }}>
                  <FLDot color={FL.emerald} /> This fund
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: FL.muted }}>
                  <FLDot color={FL.grey} /> Rest of portfolio
                </span>
              </div>
            </div>
          </div>
        </FLCard>
      </div>
    </div>
  );
}

// ───────── App shell that ties screens + bottom nav ─────────
function FLApp({ initialScreen = 'portfolio' }) {
  const [stack, setStack] = React.useState([initialScreen]);
  const [navTab, setNavTab] = React.useState('portfolio');
  const cur = stack[stack.length - 1];
  const push = (s) => setStack([...stack, s]);
  const back = () => setStack(stack.length > 1 ? stack.slice(0, -1) : stack);

  // bottom nav switches root
  const onNav = (id) => {
    setNavTab(id);
    if (id === 'portfolio') setStack(['portfolio']);
    else if (id === 'leaderboard') setStack(['leaderboard']);
    else if (id === 'wealth') setStack(['wealth']);
  };

  let screenLabel = '01 Portfolio';
  let content;
  if (cur === 'portfolio') {
    screenLabel = '01 Main Portfolio';
    content = <ScreenPortfolio onOpenInsights={() => push('insights')} onOpenFunds={() => push('funds')} onOpenFund={() => push('fundDetail')} />;
  } else if (cur === 'insights') {
    screenLabel = '02 Portfolio Insights';
    content = <ScreenInsights onBack={back} />;
  } else if (cur === 'funds') {
    screenLabel = '03 Your Funds';
    content = <ScreenFunds onBack={back} onOpenFund={() => push('fundDetail')} />;
  } else if (cur === 'fundDetail') {
    screenLabel = '04 Fund Detail';
    content = <ScreenFundDetail onBack={back} />;
  } else if (cur === 'leaderboard') {
    screenLabel = '05 Leaderboard';
    content = <ScreenStub title="Leaderboard" message="Compare your fund picks against category peers — coming soon." />;
  } else if (cur === 'wealth') {
    screenLabel = '06 Wealth Journey';
    content = <ScreenWealthJourney onAdjust={() => push('wealthAdjust')} onResults={() => push('wealthResults')} onEditSip={() => push('wealthEditSip')} />;
  } else if (cur === 'wealthAdjust') {
    screenLabel = '07 Adjust Plan';
    content = <ScreenAdjustPlan onBack={back} onApply={() => { setStack(['wealth', 'wealthResults']); }} />;
  } else if (cur === 'wealthResults') {
    screenLabel = '08 Wealth Results';
    content = <ScreenWealthResults onBack={back} />;
  } else if (cur === 'wealthResultsWithdrawal') {
    screenLabel = '09 Withdrawal Results';
    content = <ScreenWealthResults onBack={back} initialTab="Withdrawal income" />;
  } else if (cur === 'wealthEditSip') {
    screenLabel = '10 Edit Detected SIP';
    content = <ScreenEditSip onClose={back} onDone={back} />;
  }

  return (
    <PhoneFrame screenLabel={screenLabel}>
      {content}
      <FLBottomNav active={navTab} onChange={onNav} />
    </PhoneFrame>
  );
}

function ScreenStub({ title, message }) {
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <FLTopBar title={title} />
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', padding: 32, textAlign: 'center', gap: 12 }}>
        <div style={{ width: 64, height: 64, borderRadius: 999, background: FL.mint50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <FLLogo size={36} />
        </div>
        <div style={{ fontSize: 18, fontWeight: 700, color: FL.navy }}>{title}</div>
        <div style={{ fontSize: 13, color: FL.muted, lineHeight: 1.5, maxWidth: 280 }}>{message}</div>
      </div>
    </div>
  );
}

Object.assign(window, { PhoneFrame, FLTopBar, ScreenPortfolio, ScreenInsights, ScreenFunds, ScreenFundDetail, FLApp });
