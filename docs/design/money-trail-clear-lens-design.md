# Money Trail Clear Lens Design Handoff

## Source

The visual handoff is stored at `docs/design/assets/money-trail-clear-lens-handoff.png`.

This design extends the Clear Lens / Focus Ring system already introduced by PR #64. The app name remains FundLens and the feature name remains Money Trail.

## Main Screens

- Portfolio preview: a Money Trail card on the Portfolio screen summarises the current Indian financial year, invested amount, withdrawn amount, net invested, compact yearly bars, and a `View all` call to action.
- Money Trail index: a dedicated screen with four summary metrics, a financial-year chart, search, sort/filter controls, and a transaction list.
- Transaction detail: a full-screen detail page showing user-friendly transaction facts and how FundLens uses the transaction.
- Filter sheet: a Clear Lens bottom sheet with date range, transaction type, AMC, amount range, and action buttons.
- Sort sheet: a Clear Lens bottom sheet with radio-style sort options and an apply action.
- CSV export sheet: a compact confirmation/export surface that explains the file contains transactions matching the current filters.
- Quick action/help card: supporting surfaces explain how transaction history powers portfolio value, returns, and insights.

## Entry Points

- Portfolio screen Money Trail preview opens the full Money Trail screen.
- Quick Actions includes `Money Trail`.
- Expanded fund rows include `View transactions`, opening Money Trail pre-filtered to that fund.
- Fund Detail includes `View fund transactions`, opening Money Trail pre-filtered to that fund.

## Components

- Reuse Clear Lens cards, headers, button treatment, shadows, typography, and bottom sheet styling from PR #64.
- Use small rounded icon chips for transaction direction.
- Use compact bar charts for yearly financial-year summaries instead of dense tables.
- Keep list rows focused on transaction type, fund name, date, amount, and status/direction only.
- Keep units, NAV, reference ID, payment mode, and calculation flags on the transaction detail screen.

## Colour And Token Usage

- Background: `#FAFBFD`.
- Primary text/navy: `#0A1430`.
- Secondary/slate text: `#263248`.
- Invested, successful money-in, and net invested: `#10B981`.
- Dividend/mint surfaces: `#A7F3D0`.
- Dividers and quiet borders: `#E6EBF1`.
- Withdrawals use slate or amber-style treatment, not red.
- Failed/reversed records use muted grey and are hidden by default.

## Empty And Error States

- No transactions: `No transactions yet` with `Upload CAS`.
- No filtered results: `No matching transactions` with `Clear filters`.
- Annual summary failure: show `Couldn’t build yearly summary` while keeping the transaction list visible.
- Partial details: show `Some details are missing` inside transaction detail when optional fields are unavailable.
- CSV export failure: show `Couldn’t export CSV` with a retry path.

## CSV Export Flow

- Export is available from the Money Trail screen and transaction detail where appropriate.
- Exports use the current visible filtered and sorted transaction list.
- The export sheet uses Clear Lens card and button styling.
- Suggested file name: `fundlens-money-trail-YYYY-MM-DD.csv`.
- Columns should be user-friendly and exclude raw CAS noise.

## Validation Expectations

- Compare Portfolio preview, Money Trail index, transaction list, detail, filter sheet, sort sheet, export sheet, quick action entry, fund-row entry, and fund-detail entry against the handoff image.
- Confirm the implementation uses PR #64 Clear Lens tokens and primitives instead of creating another token set.
- Confirm the Money Trail UI remains beginner-friendly and avoids dense finance-table layouts.
- Confirm transactions hidden by default are visually muted and clearly labelled when shown.
