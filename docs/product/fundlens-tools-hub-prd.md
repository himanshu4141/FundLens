# FolioLens Tools Hub PRD

## 1. Feature name

**Tools Hub**

Tools Hub is a new section/layer in FolioLens that groups practical investor tools under the Clear Lens design system.

The goal is to help novice mutual fund investors plan, compare, explore, and understand cost impact without turning FolioLens into an advisory product or a finance terminal.

---

## 2. Product context

FolioLens currently helps users understand:

- Current portfolio value
- Portfolio return / XIRR
- Benchmark comparison
- Asset allocation
- Sector exposure
- Market-cap mix
- Fund-level performance
- Wealth Journey projections
- Money Trail / transaction history, planned separately

The Tools Hub extends this by giving users simple "do something useful" flows:

- Plan a goal
- Compare funds
- Check historical SIP outcomes
- Understand direct vs regular plan cost impact
- Use Wealth Journey as the flagship planning tool

---

## 3. Navigation strategy

Current bottom navigation is:

```text
Portfolio | Your Funds | Wealth Journey
```

Do **not** replace Wealth Journey immediately.

Near-term Tools entry points:

- Wealth Journey screen: `Explore more tools`
- Portfolio quick actions: `Tools`
- Your Funds expanded row: contextual tool actions
- Fund Detail screen: contextual tool actions

Later, once Tools has enough meaningful tools live, bottom nav may become:

```text
Portfolio | Your Funds | Tools
```

In that future state, Wealth Journey becomes the featured/top tool inside Tools.

---

## 4. User problem

Novice mutual fund investors often ask practical questions that are not fully answered by portfolio dashboards:

- How much should I invest monthly to reach a goal?
- What if I had invested monthly in this fund earlier?
- How do two or three funds compare objectively?
- Am I paying extra because I hold regular plans?
- What could my portfolio become under different assumptions?
- Which tool should I use for a specific decision?

Current app screens explain portfolio state. Tools Hub helps users explore scenarios and decisions objectively.

---

## 5. Goals

Tools Hub should:

1. Create a clear home for investor tools.
2. Make Wealth Journey part of a broader planning/tooling layer.
3. Start with user-held fund data where broader all-fund data is not available.
4. Avoid advisory recommendations.
5. Use objective calculations, transparent assumptions, and beginner-friendly copy.
6. Follow the Clear Lens / Focus Ring design system exactly.
7. Allow individual tools to be built and released incrementally.

---

## 6. Non-goals

Tools Hub will not:

- Recommend funds to buy/sell.
- Rank funds as best/worst.
- Provide regulated financial advice.
- Depend on Morningstar ratings or star ratings.
- Require all-mutual-fund data for initial launch.
- Replace Wealth Journey in bottom nav until the toolset is mature.
- Build tax reports or capital gains calculations.
- Build broker sync or bank reconciliation.
- Build manual portfolio entry as part of this feature.

---

## 7. Design principles

Use the existing **Clear Lens / Focus Ring** design system.

Core style:

- App name: FolioLens
- Palette:
  - Navy: `#0A1430`
  - Slate: `#263248`
  - Emerald: `#10B981`
  - Mint: `#A7F3D0`
  - Light Grey: `#E6EBF1`
  - Background: `#FAFBFD`
- Typography: Inter
- Rounded cards
- Soft shadows
- Calm whitespace
- Beginner-friendly copy
- Insight-first layout
- No dense financial tables unless genuinely needed
- No product renaming to Clear Lens

---

## 8. Tools Hub IA

```text
Tools

Featured
- Wealth Journey
  See what your portfolio could become.

Plan
- Goal Planner
  Find the monthly investment needed for a goal.

Compare
- Compare Funds
  Compare up to 3 funds side by side.

Explore
- Past SIP Check
  See how a monthly SIP would have performed.

Cost & Fees
- Direct vs Regular Impact
  See how plan costs can affect long-term returns.
```

---

## 9. Tool: Wealth Journey

### Role

Existing screen/tool. It remains a primary bottom-nav destination for now and later becomes the featured tool inside Tools Hub.

### Enhancements from this programme

- Entry point to Tools Hub: `Explore more tools`
- Later: Step-up SIP scenario support
- Later: Direct vs Regular scenario impact

### Copy

```text
Wealth Journey
See what your portfolio could become.
```

---

## 10. Tool: Goal Planner MVP

### Purpose

Help the user understand the monthly investment needed to reach a financial goal.

### Scope

Independent goal calculations only.

### Inputs

- Goal name
- Target amount
- Target date or years from now
- Existing lump sum / amount already saved
- Current monthly investment
- Return assumption:
  - Cautious
  - Balanced
  - Growth

### Outputs

- Required monthly investment
- Gap vs current monthly investment
- Projected journey path
- "Try changing" controls:
  - Timeline
  - Monthly investment
  - Lump sum
  - Return assumption

### Out of scope

- Assigning current portfolio to goals
- Goal-based asset allocation
- Goal-based fund recommendations
- Rebalancing advice
- Multi-goal optimisation

### Recommended copy

```text
You need ₹34K/month to reach this goal.
Your current plan is short by ₹9K/month.
```

---

## 11. Tool: Past SIP Check

### Purpose

Show what would have happened if the user had invested monthly in a selected fund over a past period.

### Initial data scope

User-held funds only.

### Inputs

- Fund from user portfolio
- Monthly SIP amount
- Duration
- Investment day, default: 1st of month
- Benchmark:
  - Nifty 50
  - Nifty 100
  - BSE Sensex

### Outputs

- Total invested
- Current value
- Gain/loss
- XIRR
- Fund vs benchmark comparison
- Growth chart

### Edge case

If selected duration exceeds fund NAV history:

```text
This fund has history from Aug 2021, so we calculated from then.
```

### Out of scope

- All mutual funds
- Fund recommendation
- Tax-adjusted result
- Perfect real-world execution modelling

---

## 12. Tool: Compare Funds MVP

### Purpose

Let users objectively compare up to 3 funds they already hold.

### Initial data scope

User-held funds only.

### Inputs

- Select 2–3 funds from current portfolio

### Sections

- Basic details
- Category
- Fund age
- AUM, if available
- Expense ratio
- Benchmark
- Trailing returns
- Risk ratios, if available
- Asset allocation
- Market-cap mix
- Sector exposure
- Top holdings
- Holding overlap

### Explicitly excluded

- Morningstar rating
- Star ratings
- Buy/sell/hold suggestions
- "Best fund" recommendation
- Advisory conclusions

### Safe copy examples

```text
These funds share 42% of their top holdings.
```

```text
Fund A had lower volatility over this period.
```

Avoid:

```text
Fund A is better.
```

```text
You should exit Fund B.
```

---

## 13. Tool: Direct vs Regular Impact

### Purpose

Show the potential long-term cost difference between direct and regular mutual fund plans.

This is cost transparency, not advice.

### Why it matters

Regular plans usually have higher expense ratios. Over time, the cost drag may become meaningful. FolioLens should show this objectively at portfolio, fund, and tool level.

### Initial data scope

User-held funds where direct/regular mapping and expense-ratio data is available.

### Inputs

- Current holding value
- Current plan type
- Current expense ratio
- Comparable direct/regular plan expense ratio
- Horizon:
  - 5Y
  - 10Y
  - 15Y
  - 20Y
- SIP assumption:
  - Detected SIP
  - Manual override
- Return assumption

### Outputs

- Portfolio-level estimated cost impact
- Fund-level breakdown
- Direct vs regular split
- Weighted expense ratio
- Funds with highest estimated cost impact
- Clear assumptions

### Copy

```text
Estimated cost difference

Regular plans usually have higher expense ratios.
Based on your current value and SIP, this could reduce future value by around ₹2.4L over 10 years.
```

### Avoid

```text
Switch now to Direct.
```

Prefer:

```text
You may want to review this with your advisor or platform.
```

---

## 14. Cross-app impact: Direct vs Regular

### Portfolio screen

Show cost insight only if relevant.

If regular funds exist:

```text
Cost insight

You hold 3 regular-plan funds.
Estimated long-term cost difference: ₹2.4L over 10 years.

Review impact →
```

If all funds are direct:

```text
Cost insight

All detected funds are direct plans.
No regular-plan cost drag found.
```

### Portfolio Insights

Add Cost & Fees section:

- Direct vs regular split
- Weighted expense ratio
- Regular-plan exposure
- Estimated 10-year cost impact
- Funds with highest cost impact

### Your Funds

Add plan-type chip to fund rows:

```text
Direct
```

or:

```text
Regular
```

For regular funds, expanded row includes:

```text
Regular plan

This fund has a higher expense ratio than its direct variant.
Estimated impact: ₹42K over 10 years.

View cost impact →
```

### Fund Detail

Add Plan Cost card.

For direct plan:

```text
Plan cost

You hold the direct plan.
Expense ratio: 0.72%

Direct plans usually have lower costs than regular plans.
```

For regular plan:

```text
Plan cost

You hold the regular plan.
Expense ratio: 1.48%
Direct variant: 0.72%

Estimated impact: ₹42K over 10 years
```

### Compare Funds

Include objective cost comparison:

- Plan type
- Expense ratio
- Direct/regular equivalent, if available
- Estimated cost drag over selected horizon

---

## 15. Step-up SIP support

Step-up SIP should not be a standalone tool initially.

It should be added as a scenario input inside:

- Wealth Journey
- Goal Planner

Input:

```text
Annual SIP increase
0% | 5% | 10% | Custom
```

Example output:

```text
Flat SIP
₹42K/month

Step-up SIP
Start ₹30K/month
Increase 10% yearly
```

---

## 16. All-fund data platform

This is a later milestone.

Needed for:

- Compare any fund
- Past SIP Check for any fund
- Fund discovery/search
- Category averages
- Benchmark mapping
- Direct/regular mapping for all funds
- Expense ratios for all funds
- AUM/factsheet data
- Portfolio disclosures
- NAV history across universe

No Morningstar dependency.

---

## 17. Data dependencies

### Current available data

- User portfolio funds
- NAV history for user-held funds
- Benchmarks:
  - Nifty 50
  - Nifty 100
  - BSE Sensex
- Portfolio value / XIRR calculation logic
- Fund detail data currently shown in app
- Portfolio insights data currently shown in app

### Later required data

- Fund master across all AMCs
- All-fund NAV history
- Direct/regular mapping
- Expense ratios for direct and regular variants
- AUM/factsheet data
- Portfolio disclosures for broader fund universe
- Risk ratios
- Category averages

---

## 18. Advisory boundary

FolioLens should provide objective insight, not advice.

Allowed language:

- "This fund has higher expense ratio."
- "These funds have overlapping holdings."
- "This projection is based on your assumptions."
- "This could cost around ₹X over 10 years."
- "Fund A had lower volatility over this period."

Avoid:

- "You should buy"
- "You should sell"
- "Best fund"
- "Switch now"
- "Recommended fund"
- "Ideal portfolio"
- "Guaranteed"

---

## 19. Success metrics

Potential metrics:

- Tools Hub visits
- Goal Planner completions
- Past SIP Check completions
- Compare Funds completions
- Direct vs Regular detail views
- Wealth Journey → Tools click-through
- Your Funds contextual tool usage
- Fund Detail contextual tool usage
- Repeat usage
- Export/share usage if added later
- Reduced confusion/support questions around "what does this mean?"

---

## 20. Open questions

- Which screen owns the Tools entry point before Tools becomes bottom nav?
- Should Tools Hub be behind the Clear Lens feature flag initially?
- How much direct/regular mapping exists today?
- Do current fund identifiers reliably map direct and regular variants?
- Which return assumptions should Goal Planner use by default?
- Should Goal Planner support INR-only initially?
- Should Past SIP Check include lumpsum mode later?
