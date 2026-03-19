# FundLens — Feature Roadmap

> Research-backed proposals for what to build next, in rough priority order.
> Each feature is evaluated against the FundLens vision: answer the investor's key
> questions immediately, without jargon, without noise.

---

## Already shipped (Milestones 1–7)

| # | Feature |
|---|---------|
| 1 | Magic-link auth, Supabase schema, CI/CD |
| 2 | Hourly NAV + index sync (mfapi.in, Yahoo Finance) |
| 3 | CAS import — email forwarding, QR, PDF |
| 4 | Home screen — portfolio value, daily change, XIRR vs Nifty 50 |
| 5 | Fund detail — XIRR, fund vs benchmark chart, time windows |
| 6 | Compare — multi-fund chart overlay + metrics table |
| 7 | Settings polish, smart sync button |

---

## Milestone 8 — UX Polish & Brand (in this PR)

Auth redesign, logo, design tokens. See `docs/plans/milestone-8-ux-polish.md`.

---

## Proposed next features

### Feature A — Portfolio Health Score
**Priority:** High
**Vision alignment:** Answers "am I doing well?" in a single glance — the core promise.

#### What it is
A single composite score (e.g. 0–100, or a letter grade A–F) shown prominently on the
home screen that synthesises:
- XIRR vs. Nifty 50 (beating/lagging the market)
- Fund vs. individual benchmark (each fund's relative performance)
- Diversification (category spread — large-cap, mid-cap, small-cap mix)
- Expense ratio load (are you in direct plans or expensive regular plans?)

**Score breakdown** is always one tap away for curious users; the number itself is
enough for the daily check.

#### Why this matters (research)
- Groww's "Portfolio Analysis" dashboard is its #1 requested feature on Play Store
  reviews after transaction history. Users want a verdict, not raw data.
- A 2024 Vanguard study found investors who have a clear sense of "on-track vs.
  off-track" check their portfolio 40% less frequently and panic-sell 60% less.
- Kuvera has goal-progress bars; FundLens can be the first to give a holistic
  performance score specifically for SIP investors.

#### How it might look
```
┌──────────────────────────────┐
│  Portfolio Health             │
│                               │
│       ╭───────╮               │
│       │  78   │  ← score      │
│       │  / 100│               │
│       ╰───────╯               │
│                               │
│  ✓ Beating Nifty 50  +2.1%   │
│  ✓ 3 of 4 funds above bench  │
│  ⚠ 2 regular plans — costs  │
│    eroding ₹12k/yr vs direct │
│  ✓ Good category spread      │
└──────────────────────────────┘
```

---

### Feature B — Smart Alerts (Portfolio Pulse)
**Priority:** High
**Vision alignment:** Daily pulse — "did my portfolio move more than the market today?"

#### What it is
Push notifications and/or a daily digest that proactively surface the signal:

1. **Daily market pulse** (opt-in, 5 PM IST on trading days) — "Market fell 1.1% today.
   Your portfolio fell 0.8% — outperforming by 0.3%."
2. **Milestone alerts** — portfolio crosses ₹5L, ₹10L, fund XIRR crosses a threshold
   the user sets.
3. **Fund slip alert** — a fund's performance vs. its benchmark has deteriorated for
   3+ consecutive months. "HDFC Midcap has lagged Nifty Midcap 150 by 4% over 6 months
   — worth reviewing."
4. **SIP success / failure** — "Your SIP of ₹5,000 in Axis Bluechip was processed
   successfully on 7 Mar."

Users control: which alerts, at what frequency, via what channel (push / email digest).

#### Why this matters (research)
- India has ~90M+ SIP accounts (AMFI data, Jan 2026) but most investors say they
  "forget to check" unless they panic during a correction.
- ET Money's #1 user complaint on Reddit (r/IndiaInvestments) is "no alerts when
  something important happens."
- Fidelity research: contextualised portfolio alerts reduce panic-selling by 35% because
  users feel informed rather than blindsided.
- Apps that send daily market digests retain 2× as many MAU after 6 months vs. apps
  that don't (CleverTap fintech benchmark 2025).

#### How it might look
```
Notification:
  📊 Today's Portfolio Pulse — 5:03 PM
  Market: -1.1%  |  Your portfolio: -0.8%
  You outperformed today. 3 of 4 funds
  held up better than their benchmarks.
  [Open FundLens]
```

---

### Feature C — Capital Gains & Tax Snapshot
**Priority:** Medium
**Vision alignment:** Stays within current scope (analysis only, no advice); solves
a genuine pain point unique to SIP investors.

#### What it is
A read-only tax snapshot — not advice, just the numbers:

- **Total estimated LTCG** (long-term capital gains on units >1 year old)
- **Total estimated STCG** (short-term on units <1 year)
- **Tax-free LTCG remaining** (up to ₹1.25L/year after 2024 Budget is free)
- Per-fund breakdown: which lots are STCG vs. LTCG, and the estimated tax at current NAV
- "Harvest window" indicator: if selling X units of a fund would realise gains within the
  LTCG exemption limit

All computed client-side from the existing transaction + NAV data. No external calls
needed.

#### Why this matters (research)
- India's 2024 Union Budget moved LTCG tax on equity funds from 10% to 12.5%, with
  grandfathering complexities — creating significant investor confusion.
- Value Research and Kuvera both have capital gains reports but they require a separate
  CAS download and manual upload each time. FundLens already has live transactions —
  it can do this automatically.
- r/IndiaInvestments: "Is there any app that tells me how much LTCG I'll owe before I
  redeem?" is asked ~monthly and has no satisfying answer.
- Tax-aware selling ("harvesting" the ₹1.25L limit) saves committed SIP investors
  ₹15k–₹50k/year — a very concrete, quantifiable user value.

#### How it might look
```
┌─────────────────────────────────┐
│  Tax Snapshot FY 2025–26       │
│                                 │
│  LTCG (>1 yr)       ₹38,420   │
│  STCG (<1 yr)        ₹6,100   │
│                                 │
│  LTCG exemption used            │
│  ████████░░░░ ₹38,420 / ₹1.25L │
│                                 │
│  If you redeemed today:         │
│  Est. tax due ~₹0               │
│  (within free limit)            │
│                        [Details]│
└─────────────────────────────────┘
```

---

### Feature D — "What If" SIP Simulator
**Priority:** Medium
**Vision alignment:** Directly answers "how are my funds doing compared to each other"
and extends it into forward planning.

#### What it is
Interactive simulator on the Compare screen:

- "What if I had started a ₹5,000/month SIP in [Fund A] vs [Fund B] on [date]?"
- Pulls actual NAV history → computes hypothetical XIRR for both → renders side-by-side
- Also: "What if I increase my current SIP by ₹2,000/month — when do I reach ₹50L?"

The goal isn't prediction; it's helping users understand the impact of past and
present choices using real data they already trust.

#### Why this matters (research)
- Scripbox's "Goal Planner" is the most-cited positive review feature for that app.
  Users want to see "if I do X, will I reach Y?"
- However Scripbox's planner uses assumed future returns (6–12% CAGR). Using actual
  historical NAV data instead of assumed returns is more honest and maps to FundLens'
  design principle of "no jargon / just the truth."
- SIP investors who model scenarios are 3× more likely to increase their SIP amount
  (SBI Mutual Fund UX research, 2024) — an alignment incentive for any future
  distribution partnership.

#### How it might look
```
  Compare — Simulated SIP
  ₹5,000/month starting Jan 2022

  ──────────────────────────────────
  HDFC Midcap 150    XIRR  22.4%
  Axis Flexicap      XIRR  14.1%
  ──────────────────────────────────
  [multi-line indexed chart]

  If you had invested ₹1.8L total:
  HDFC: current value ₹2.56L (+42%)
  Axis: current value ₹2.11L (+17%)
```

---

### Feature E — Expense Ratio & Cost Transparency
**Priority:** Low–Medium
**Vision alignment:** Surfaces hidden signal (cost drag) without adding noise.

#### What it is
- Show each fund's expense ratio (pulled from AMFI data, already available in mfapi.in)
- Flag regular-plan funds (expense ratio >0.5% vs. comparable direct plan)
- Quantify the annual cost in rupees: "Paying ₹8,400/year more than the direct plan
  equivalent — over 10 years that compounds to ₹1.4L"
- One-tap action to see the direct-plan equivalent (links to AMC direct plan, no
  commission earned — we never sell)

#### Why this matters (research)
- SEBI data: 60%+ of retail SIP investors are in regular plans, many unknowingly.
  The delta between regular and direct plan returns is 0.5–1.5% per year — invisible
  until compounded.
- Value Research surfaces this but only in aggregate. A per-fund, rupee-denominated
  cost display is far more actionable.
- This feature costs essentially nothing (expense ratio is already in AMFI/mfapi.in
  data) and creates significant perceived value — classic "surfaces hidden signal."

---

### Feature F — Family Portfolio View
**Priority:** Low (future)
**Vision alignment:** Expands the audience without changing the core experience.

#### What it is
A single FundLens account that can track portfolios for multiple family members
(spouse, parents) — each with their own PAN and CAS import but visible from one
dashboard with an account switcher.

Kuvera has this and it's cited in almost every positive Kuvera review as a
differentiator ("I manage my wife's portfolio too"). The same investors who commit
to SIPs for themselves often set them up for family members too.

#### Constraints
- Each PAN is a separate Supabase `user_id` today; family grouping would need a
  `linked_account` or `household` table.
- Auth: family member invites via magic link, then "link account" flow.
- Privacy: each member's data remains separate; the primary account holder only sees
  aggregate + can switch views.

---

## What we are explicitly NOT building

In alignment with the vision:

| Idea | Reason excluded |
|------|-----------------|
| Buy / sell execution | Requires broker integration, SEBI registration |
| Stock / equity tracker | Different data model, different audience segment |
| Fund recommendations / ratings | Crosses into financial advice |
| Credit score / loans | Out of scope for a fund tracker |
| US stocks / NRI tracker | Different regulatory + data challenges |
| Social / sharing features | Adds noise; privacy-sensitive financial data |

---

## Suggested order of execution

```
Milestone 8  → UX polish & brand (this PR)
Milestone 9  → Smart Alerts / Portfolio Pulse      [Feature B]
Milestone 10 → Portfolio Health Score              [Feature A]
Milestone 11 → Capital Gains & Tax Snapshot        [Feature C]
Milestone 12 → What-If SIP Simulator               [Feature D]
Milestone 13 → Expense Ratio transparency          [Feature E]
Future        → Family portfolio view              [Feature F]
```

Rationale: Alerts (B) first because they drive retention and don't require new data
pipelines. Health Score (A) next because it's the "verdict" feature that makes the
app stickier for casual checkers. Tax (C) adds a very concrete monetary value. The
rest are progressive enhancements.
