# FundLens PRD: Money Trail

## 1. Feature name

**Money Trail**

Money Trail helps users understand the cashflow history behind their mutual fund portfolio: what went in, what came out, what moved internally, and how those transactions shaped the current portfolio.

Internal/technical name may remain `transactions`, but the user-facing feature name should be **Money Trail**.

---

## 2. Product context

FundLens is for novice mutual fund investors who want to understand portfolio performance without finance jargon, excessive data, or misleading one-time-return numbers.

The existing app explains portfolio value, returns, benchmark comparison, allocation, funds, and projections. Money Trail adds the missing “how did I get here?” layer.

It should answer:

- How much did I invest in each financial year?
- How much did I withdraw?
- What is my net invested amount?
- Which funds received my money?
- What happened on a specific date?
- Which transactions are included in my portfolio and return calculations?

Design must follow the **Clear Lens / Focus Ring** system: calm, clear, beginner-friendly, premium but not intimidating.

---

## 3. Problem

Novice investors often see only current portfolio value and returns. They do not easily understand the underlying money movements that created those outcomes.

This creates confusion such as:

- “How much have I actually invested?”
- “Why did my portfolio value change?”
- “Did I withdraw from this fund?”
- “Was my return caused by market performance or because I kept investing?”
- “Where can I verify the transaction history behind the numbers?”

Current portfolio screens show outcomes. They do not provide a simple, trusted, searchable view of the cashflows behind those outcomes.

---

## 4. Goal

Create a beginner-friendly Money Trail experience that shows all CAS-derived committed transactions and summarises annual investing behaviour.

The feature should help users understand:

1. **Money invested** through SIPs and lump sums.
2. **Money withdrawn** through redemptions, SWPs, and dividend payouts.
3. **Internal movements** such as switches and reinvestments without inflating net invested figures.
4. **Financial-year cashflow pattern** across the portfolio.
5. **Transaction details** in plain language.
6. **How FundLens uses each transaction** in portfolio and return calculations.

---

## 5. Non-goals

Money Trail does **not** initially include:

- Manual transaction entry.
- Editing imported transactions.
- Bank statement reconciliation.
- Tax reporting or capital gains calculation.
- Broker/platform settlement details.
- Raw CAS field inspection.
- Duplicate correction UI.
- Transaction-level audit-grade reporting.

The feature should stay useful, simple, and understandable. No Bloomberg cosplay.

---

## 6. Data source and core assumptions

### 6.1 Source

Transactions come from **CAS only**.

No manual, broker, or platform-derived transaction source is included in MVP.

### 6.2 Visibility

Show only transactions that are committed and relevant to the user’s actual portfolio history.

Failed, reversed, and reversal-linked transactions should be hidden by default.

### 6.3 Folio visibility

Folio numbers should be visible by default.

No masking is required in MVP.

### 6.4 Time period basis

Portfolio preview and annual summaries should use **Indian financial year** by default.

Example: FY 2025–26, not calendar year 2025.

---

## 7. Recommended transaction treatment

### 7.1 External vs internal cashflows

Money Trail should distinguish between:

| Category | Meaning | Example | Counts toward net invested? |
|---|---|---|---|
| External money in | Fresh money added by user | SIP, lump sum purchase | Yes |
| External money out | Money returned to user | Redemption, SWP, dividend payout | Yes, as withdrawal |
| Internal movement | Money moved within portfolio | Switch in/out, dividend reinvestment | No |
| Ignored/reversed | Transaction did not remain committed | Failed, reversed, reversal pair | No, hidden by default |

This prevents overstating invested amount when money simply moved from one fund to another.

### 7.2 Switch handling recommendation

Treat switches as **internal movements**.

Recommendation:

- Show switch transactions in Money Trail when the user filters for internal movements or switch transactions.
- Do **not** include switch-in or switch-out in annual net invested.
- Do **not** treat portfolio-level switch transactions as external cashflows for XIRR.
- In transaction detail, explain clearly:
  > This moved money between funds. It does not count as new money invested.

Rationale: A switch is usually a movement within the portfolio, not fresh money added or withdrawn. Counting both switch-out and switch-in in annual money flow would make the user’s investing activity look artificially large.

### 7.3 Dividend handling recommendation

Dividend handling depends on type.

Recommended MVP rules:

| Dividend type | Treatment | Counts toward net invested? | User-facing explanation |
|---|---|---:|---|
| Dividend payout | External money out / income | Reduces net invested as withdrawal/income | “Money paid out to you” |
| Dividend reinvestment | Internal movement | No | “Dividend reinvested inside the fund” |

Dividend payout should appear as money out because cash leaves the fund and goes to the investor.

Dividend reinvestment should not inflate money invested because it is not fresh money added by the user.

### 7.4 Failed and reversed transaction handling

Failed/reversed transactions should be hidden behind a filter.

Also hide the original transaction that was reversed, when FundLens can confidently identify the reversal pair.

Reason:

- These transactions are not committed portfolio events.
- Showing them by default can inflate activity and confuse users.
- They should not affect portfolio value, net invested, or return calculations.

Recommended filter:

> Show reversed / failed transactions

When enabled, show them in a muted style with clear labels:

- Failed
- Reversed
- Reversal

---

## 8. Entry points

### 8.1 Portfolio screen

Add a compact **Money Trail Preview** section on the Portfolio screen.

Purpose: show the user their annual investing pattern without sending them straight into a transaction table.

Suggested placement: below the portfolio hero/benchmark summary and before deeper insights.

Content:

- Title: **Money Trail**
- Subtitle: **Your investments by financial year, net of withdrawals**
- Current financial year summary
- Compact bar/list for last 3–5 financial years
- Total invested
- Total withdrawn
- Net invested
- CTA: **View Money Trail**

Example copy:

```text
Money Trail

You invested ₹18.2L net in FY 2025–26.
₹21.4L invested · ₹3.2L withdrawn

View all transactions →
```

### 8.2 Quick action menu

Add a shortcut in the quick action menu:

> Money Trail

This opens the full Money Trail screen.

### 8.3 Fund detail screen

Add an entry point on each fund detail screen:

> View fund transactions

This opens Money Trail pre-filtered by the selected fund.

### 8.4 Your Funds screen

In the expanded fund row, add an action:

> Transactions

This opens Money Trail pre-filtered by that fund.

Do not add this as a separate top-level row unless the expanded row becomes too crowded.

---

## 9. Information architecture

### 9.1 Portfolio screen

Shows a summary only:

- Financial-year money flow preview.
- Current FY net invested.
- Total invested / withdrawn / net invested.
- Link to full Money Trail.

### 9.2 Money Trail screen

Main transaction browsing screen.

Sections:

1. Header summary.
2. Financial-year cashflow summary.
3. Search, sort, and filters.
4. Transaction list.
5. Transaction detail screen/bottom sheet.

### 9.3 Transaction detail

Shows complete user-relevant details for a selected transaction.

Do not show raw CAS fields.

---

## 10. User stories

### 10.1 Portfolio summary

As a user, I want to see how much I invested and withdrew each financial year, so I understand my investing behaviour over time.

### 10.2 Full transaction list

As a user, I want to see all committed transactions in one place, so I can verify what happened in my portfolio.

### 10.3 Transaction detail

As a user, I want to tap a transaction and see its details in plain language, so I understand the amount, date, fund, AMC, units, NAV, and how FundLens treats it.

### 10.4 Filtering

As a user, I want to filter transactions by date, type, AMC, and fund, so I can quickly find relevant activity.

### 10.5 Sorting

As a user, I want to sort transactions by date, amount, or fund name, so I can review the list in the order that makes sense.

### 10.6 Fund-specific transaction view

As a user, I want to open transactions for a specific fund from fund detail or expanded fund row, so I can understand activity in that fund.

---

## 11. Portfolio screen component

### Component name

**Money Trail Preview**

### Purpose

Give a simple cashflow lens on the portfolio.

### Required content

- Current financial year net invested.
- Invested amount.
- Withdrawn amount.
- Last 3–5 FY summaries.
- Total invested.
- Total withdrawn.
- Net invested.
- CTA to full Money Trail.

### Example structure

```text
Money Trail
Your investments by financial year, net of withdrawals.

FY 2025–26
₹18.2L net invested
₹21.4L in · ₹3.2L out

FY 2024–25  ₹12.6L net
FY 2023–24  ₹9.8L net
FY 2022–23  ₹6.1L net

View all transactions →
```

### Design guidance

- Use a calm insight card, not a dense chart.
- Lead with one sentence insight.
- Use a compact FY list or small bars.
- Withdrawals should not be red by default.
- Use emerald for money in / net positive.
- Use slate or amber for money out.

---

## 12. Money Trail screen

### 12.1 Header

Title:

> Money Trail

Subtitle:

> Every investment, withdrawal, switch, and dividend in your portfolio.

### 12.2 Summary cards

Show:

| Metric | Meaning |
|---|---|
| Total invested | External money added by user |
| Withdrawn | External money taken out |
| Net invested | Total invested minus withdrawn |
| Transactions | Count of visible committed transactions |

Example:

```text
Total invested    ₹58.4L
Withdrawn         ₹3.1L
Net invested      ₹55.3L
Transactions      186
```

### 12.3 Financial-year summary

Show annual money flow by Indian financial year.

Recommended display:

```text
FY 2025–26
₹18.2L net invested
₹21.4L in · ₹3.2L out

FY 2024–25
₹12.6L net invested
₹12.6L in · ₹0 out
```

Should support tap/filter by FY later, but MVP can simply display the summary.

---

## 13. Transaction list

### 13.1 Default sort

Default sort:

> Newest first

### 13.2 Row summary

Each transaction row should show only the most important details.

Show:

- Transaction type icon.
- Transaction type label.
- Fund name.
- Date.
- Amount.
- Direction badge: Money in / Money out / Internal.

Do **not** show units or NAV in the row summary. Keep the list clean.

Example investment row:

```text
SIP investment
DSP Large & Mid Cap Fund
24 Apr 2026

₹60,000
Money in
```

Example withdrawal row:

```text
Withdrawal
DSP US Specific Equity Omni FoF
12 Mar 2026

₹54.8K
Money out
```

Example switch row:

```text
Switch out
DSP Small Cap Fund
04 Feb 2026

₹1.2L
Internal movement
```

### 13.3 Visual treatment

| Type | Visual treatment |
|---|---|
| Money in | Emerald icon/badge |
| Money out | Slate or amber icon/badge |
| Internal movement | Navy/slate dual-arrow icon |
| Dividend | Mint badge |
| Failed/reversed | Muted grey, hidden by default |

Avoid using red for withdrawals. Red implies an error or loss.

---

## 14. Transaction detail

### 14.1 Mobile behaviour

Open transaction detail as a **full-screen detail page** on mobile.

A bottom sheet may be too cramped for transaction detail, especially when explaining how FundLens uses the transaction.

### 14.2 Detail fields

Show only fields that make sense to an average retail investor.

Required fields:

- Transaction type.
- Amount.
- Date.
- Fund name.
- AMC.
- Folio number.
- Units.
- NAV, labelled as **price per unit**.
- Direction: Money in / Money out / Internal movement.
- Source: CAS.

Optional if available:

- Dividend type.
- Switch source/destination fund.
- Transaction reference.
- Import date.

Do not show raw CAS fields or overly technical metadata.

### 14.3 “How FundLens uses this” block

Add a transparency block in transaction detail.

Example for SIP purchase:

```text
How FundLens uses this

Counts as money invested: Yes
Used in return calculation: Yes
Affects current holdings: Yes
```

Example for switch:

```text
How FundLens uses this

Counts as money invested: No
Used in portfolio return calculation: No
Affects current holdings: Yes

This moved money between funds. It does not count as new money invested.
```

Example for dividend payout:

```text
How FundLens uses this

Counts as withdrawal/income: Yes
Used in return calculation: Yes
Affects current holdings: Yes
```

---

## 15. Search, sort, and filter

### 15.1 Search

Search should support:

- Fund name.
- AMC.
- Transaction type.
- Amount.
- Folio number.

Placeholder:

> Search fund, AMC, amount…

### 15.2 Sort options

MVP sort options:

- Newest first.
- Oldest first.
- Largest amount.
- Fund name A–Z.

Future options:

- Smallest amount.
- Fund name Z–A.
- AMC A–Z.

### 15.3 Filters

MVP filters:

- Financial year / date range.
- Transaction type.
- Money direction.
- AMC.
- Fund name.

Date presets:

- This financial year.
- Last financial year.
- Last 3 financial years.
- All time.
- Custom range.

Transaction type filters:

- SIP investment.
- Lump sum investment.
- Withdrawal.
- Switch.
- Dividend.
- Transfer.
- Failed/reversed.

Direction filters:

- Money in.
- Money out.
- Internal movement.

### 15.4 Failed/reversed filter

Failed/reversed transactions should be hidden by default.

Add an explicit filter option:

> Show failed and reversed transactions

When enabled, show them muted and clearly labelled.

---

## 16. Empty states

### 16.1 No transactions

```text
No transactions yet

Upload your CAS statement to see your complete Money Trail.
```

CTA:

> Upload CAS

### 16.2 No results after filter

```text
No matching transactions

Try changing your filters or date range.
```

CTA:

> Clear filters

---

## 17. Error states

### 17.1 Transaction data incomplete

```text
Some details are missing

This transaction came from your CAS statement, but a few optional details were not available.
```

### 17.2 Annual summary unavailable

```text
Couldn’t build yearly summary

Your transactions are still available below.
```

---

## 18. Data model draft

```ts
type PortfolioTransaction = {
  id: string;

  date: string; // ISO date
  financialYear: string; // e.g. "FY 2025-26"

  fundId: string;
  fundName: string;
  amcId?: string;
  amcName?: string;

  type:
    | "sip_purchase"
    | "purchase"
    | "redemption"
    | "switch_in"
    | "switch_out"
    | "dividend_payout"
    | "dividend_reinvestment"
    | "stp_in"
    | "stp_out"
    | "swp"
    | "reversal"
    | "failed"
    | "unknown";

  userFacingType: string;

  direction: "money_in" | "money_out" | "internal" | "neutral";
  cashflowScope: "external" | "internal" | "ignored";

  amount: number;
  units?: number;
  nav?: number;

  folioNumber?: string;
  transactionReference?: string;

  source: "cas";
  importBatchId?: string;

  isCommitted: boolean;
  isReversedOrFailed: boolean;
  reversalGroupId?: string;

  includedInInvestedAmount: boolean;
  includedInXirr: boolean;
  includedInCurrentHoldings: boolean;

  createdAt: string;
  updatedAt: string;
};
```

```ts
type AnnualMoneyFlow = {
  financialYear: string; // e.g. "FY 2025-26"
  invested: number;
  withdrawn: number;
  netInvested: number;
  internalMovements: number;
  transactionCount: number;
};
```

---

## 19. Calculation alignment rules

Money Trail must not introduce a competing portfolio, invested amount, holdings, or XIRR calculation model.

The app already calculates portfolio value and XIRR. Money Trail should reuse or reference the same existing calculation services/selectors/helpers wherever possible. If the definitions below differ from existing production logic, the implementation must either:

1. Align with the existing production calculation and document the difference in the PR / implementation notes, or
2. Update the shared calculation layer deliberately so Portfolio, Fund Detail, XIRR, and Money Trail all use the same rule.

Do **not** create a separate Money Trail-only calculation path that can drift from the rest of the app. One source of truth, less spreadsheet goblin energy.

### 19.1 Money Trail annual summary

The annual financial-year summary should be derived from committed CAS transactions using the same transaction classification used by existing portfolio and XIRR calculations.

The summary should expose:

- Money invested.
- Money withdrawn.
- Net invested.
- Internal movements, shown separately where useful.
- Transaction count.

### 19.2 Recommended classification

Use this classification unless the existing app already defines a different canonical rule. If it differs, prefer the app’s existing canonical rule and document the mismatch.

| Transaction | Money Trail treatment | Portfolio/XIRR alignment intent |
|---|---|---|
| SIP purchase | External money in | Should align with invested amount and XIRR cashflow treatment |
| Lump sum purchase | External money in | Should align with invested amount and XIRR cashflow treatment |
| Redemption | External money out | Should align with withdrawal and XIRR cashflow treatment |
| SWP | External money out | Should align with withdrawal and XIRR cashflow treatment |
| Switch in | Internal movement | Should not inflate portfolio-level net invested |
| Switch out | Internal movement | Should not inflate portfolio-level net invested |
| Dividend payout | External money out / income | Should be visible as money received; align with existing XIRR handling |
| Dividend reinvestment | Internal reinvestment | Should not inflate external net invested unless existing logic explicitly does so |
| STP in/out | Internal movement unless CAS/source indicates external cashflow | Should not double-count at portfolio level |
| Failed/reversed | Excluded by default | Must not affect portfolio value, invested amount, withdrawn amount, or XIRR |

### 19.3 Net invested

Net invested should represent external user cashflow, not internal fund movement.

```text
Net invested = external money in - external money out
```

Switches, STPs, and reinvestments should be tracked separately as internal movements so the user can see them without inflating net invested.

### 19.4 Failed/reversed transactions

Failed/reversed transactions should be hidden by default.

When a reversal can be confidently matched to an original transaction, hide both the reversal and the original transaction from the default list and all Money Trail summaries.

They should be excluded from:

- Portfolio value.
- Invested amount.
- Withdrawn amount.
- Net invested.
- XIRR.
- Default transaction count.

Add a filter to show failed/reversed transactions for transparency, but keep them muted and clearly labelled.

### 19.5 Calculation validation

Implementation must include validation that Money Trail totals reconcile with the app’s existing portfolio/XIRR calculation inputs. At minimum:

- Money Trail invested/withdrawn totals should be traceable to the same committed CAS transactions used by existing calculations.
- Failed/reversed transactions should not affect existing portfolio totals.
- Switch handling should not inflate portfolio-level invested amount.
- Dividend handling should match the existing XIRR treatment or update the shared rule consistently.

---

## 20. UX copy principles

Use plain language first. Keep mutual fund terms available only when helpful.

| Technical term | Preferred user-facing copy |
|---|---|
| Transaction | Money movement / Money Trail |
| Purchase | Investment |
| Redemption | Withdrawal |
| Units allotted | Units bought |
| NAV | Price per unit |
| Switch | Moved between funds |
| XIRR cashflow | Used in return calculation |

Where useful, show both:

> Withdrawal
> Also called redemption

---

## 21. Scope

This section is intentionally explicit so an implementation agent can build deterministically.

### 21.1 In scope

The first implementation includes:

#### Entry points

- Add a Money Trail preview card on the Portfolio screen.
- Add Money Trail to the quick action menu.
- Add a `View fund transactions` entry point on Fund Detail, pre-filtered by that fund.
- Add a Transactions / Money Trail action inside the expanded fund row on Your Funds, pre-filtered by that fund.

#### Money Trail screen

- Create the full Money Trail screen.
- Show header summary cards:
  - Total invested.
  - Withdrawn.
  - Net invested.
  - Transaction count.
- Show annual financial-year summary.
- Show transaction list.
- Show full-screen transaction detail.
- Show active filter chips.
- Add `Clear filters`.

#### Search, sort, and filters

- Search by fund name, AMC, transaction type, amount, and folio number.
- Sort by:
  - Newest first.
  - Oldest first.
  - Largest amount.
  - Fund name A–Z.
- Filter by:
  - Financial year / date range.
  - Transaction type.
  - Money direction.
  - AMC.
  - Fund name.
- Add a filter to show failed/reversed transactions.
- Failed/reversed transactions are hidden by default.

#### Transaction handling

- Use CAS as the only transaction source.
- Show only committed transactions by default.
- Hide failed/reversed transactions by default.
- If a reversal can be confidently matched to an original transaction, hide both by default.
- Treat switch transactions as internal movements, unless existing app calculation rules define otherwise.
- Treat dividend payout as money received/withdrawn, aligned with existing XIRR handling.
- Treat dividend reinvestment as internal reinvestment, aligned with existing XIRR handling.
- Do not expose raw CAS fields.
- Show folio numbers visibly, not masked.

#### Export

- Add CSV export from the Money Trail screen.
- Export should respect current filters and sort order.
- Export should include user-relevant fields only:
  - Date.
  - Financial year.
  - Transaction type.
  - Direction.
  - Fund name.
  - AMC.
  - Folio number.
  - Amount.
  - Units, if available.
  - NAV / price per unit, if available.
  - Source: CAS.
  - Included in invested amount.
  - Included in return calculation.
- Do not export raw CAS fields or internal debugging metadata.

#### States and transparency

- Add empty states.
- Add error states.
- Add “How FundLens uses this” block on transaction detail.
- Align all totals with existing app portfolio value and XIRR calculations.

### 21.2 Out of scope

The first implementation does not include:

- Manual transaction entry.
- Editing imported transactions.
- Manual correction of transaction classification.
- Bank statement reconciliation.
- Tax reporting.
- Capital gains calculation.
- Broker/platform settlement details.
- Raw CAS field inspection.
- PDF export.
- Duplicate correction UI.
- CAS import reconciliation UI.
- Source/import batch drilldown.
- Calendar-year toggle. Financial year is the only supported annual view for this feature.
- Transaction-level audit-grade reporting.

---

## 22. Design requirements

Money Trail must use the Clear Lens / Focus Ring design system.

Key design principles:

- Clarity over clutter.
- Beginner-friendly language.
- Signal over noise.
- Trust through transparency.
- Use annual summaries before transaction detail.
- Keep list rows clean.
- Use detail view for complexity.

Visual guidance:

- Use card-based summaries.
- Use emerald for positive/external money-in signals.
- Use slate/amber for withdrawals and internal movements.
- Avoid red for withdrawals.
- Use soft backgrounds and rounded cards.
- Keep filters accessible but not dominant.

---

## 23. Acceptance criteria

### Portfolio preview

- User can see current FY net invested.
- User can see invested and withdrawn amounts.
- User can tap through to Money Trail.

### Money Trail screen

- User can see total invested, withdrawn, net invested, and transaction count.
- User can see annual financial-year summaries.
- User can search transactions.
- User can sort transactions.
- User can filter transactions.
- User can clear filters.

### Transaction list

- Rows show type, fund, date, amount, and direction.
- Rows do not show units or NAV.
- Failed/reversed transactions are hidden by default.

### Transaction detail

- User can open a transaction detail screen.
- Detail shows user-relevant fields only.
- Folio number is visible.
- Detail explains how FundLens uses the transaction.

### Data handling

- Switches do not inflate net invested.
- Dividend payout is treated as external money out.
- Dividend reinvestment is treated as internal movement.
- Failed/reversed transactions do not affect portfolio calculations.

---

## 24. Open questions

None blocking MVP.

Potential future decisions:

- Whether to support calendar-year view as an alternative to financial year.
- Whether to add PDF export/share.
- Whether to expose import batch/source details later.
- Whether to add tax/capital gains mode.
