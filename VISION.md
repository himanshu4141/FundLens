# FolioLens — Vision and Mission

## The Problem

Tracking a mutual fund portfolio today is painful for a novice investor:

- Tools like Value Research show everything — too much data, too much jargon, no clear signal.
- Checking how each fund is doing means visiting multiple pages one by one.
- Standard return metrics like YTD and rolling returns assume you invested everything on day one. Most people invest via SIPs — money goes in every month — so those numbers are misleading and don't reflect how your investment is actually performing.

The result: you either don't check, or you check and still don't know if you're doing well.

## The Vision

Open the app on a random Tuesday morning and immediately know:

- How did my portfolio move today? (Market fell 1% — did my portfolio fall more or less?)
- How is each fund doing compared to its benchmark?
- How are my funds doing compared to each other?
- What return am I actually earning, given that I invest via SIP?

No searching. No digging. No jargon to decode. Just the answer.

## Core Questions the App Answers

1. **Daily pulse** — Market moved X% today. My portfolio moved Y%. Here's how each fund moved.
2. **Portfolio vs market** — My overall portfolio return vs. Nifty 50 (or a broad market benchmark).
3. **Fund vs benchmark** — Each fund vs. its own declared benchmark (e.g. HDFC Midcap vs Nifty Midcap 150).
4. **Fund vs fund** — How my funds compare to each other side by side.
5. **SIP-aware return** — My actual return (XIRR), which accounts for the timing of every SIP instalment — not a misleading lump-sum approximation.

## Design Principles

- **Built for novice investors** — not finance professionals.
- **Dejargonify everything** — if a term like XIRR must appear, explain it in one plain sentence right there.
- **Minimal noise** — surface the signal, hide everything else.
- **Single shot** — the most important answer should be visible without any tapping or scrolling.

## Out of Scope (for now)

- Stock / equity portfolio tracking
- Tax optimisation or capital gains reporting
- Broker or demat account integration
- Buy / sell recommendations
- Any form of financial advice
