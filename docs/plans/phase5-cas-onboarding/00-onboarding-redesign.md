# Onboarding Redesign — Reference for ExecPlans M1 and M2


## Why This Document Exists


M1 and M2 (the two CAS onboarding ExecPlans in this folder) both touch the same screens. Rather than duplicate the visual and copy decisions in two places, this file captures the **shared end-state UX** so each ExecPlan only describes the implementation slice it owns.


Read this first. It is not optional.


## What "CAS" Means In Plain Language


CAS stands for Consolidated Account Statement. India has two registrar-and-transfer agents (RTAs): CAMS and KFintech. Between them they run accounting for ~95% of mutual fund AMCs. A CAS is a free PDF a user can request from either RTA (or from MFCentral / CDSL / NSDL) that lists every mutual fund holding the user owns across every AMC, plus every transaction.


The PDF is password-protected. CAMS/KFintech use the user's PAN as the password. CDSL/NSDL use PAN + DDMMYYYY of birth.


There is no API for CAS. The user must request it through one of the portals and it lands in their email a minute or two later.


## The User Journey (target end state)


1. New user opens FolioLens, signs in
2. Sees a 4-step onboarding wizard
3. **Step 1 — Welcome**: tells them what a CAS is, why we need it, what stays private
4. **Step 2 — Identity**: PAN (required), DOB (optional, with hint about CDSL/NSDL), email (pre-filled)
5. **Step 3 — Import**: three cards in priority order
   - **Upload a CAS PDF** (recommended, fastest)
   - **Get a fresh CAS** (guides to CAMS/KFintech/MFCentral via in-app browser)
   - **Set up auto-refresh** (M2 only — skippable, deferred)
6. **Step 4 — Done**: portfolio loaded; nudge them to set up auto-refresh if they skipped it


No WebView wrapping a third-party portal at any point. We use `expo-web-browser` (an in-app browser based on SFSafariViewController on iOS, Chrome Custom Tab on Android) only for portals — that returns the user to FolioLens cleanly when they dismiss it.


## Visual Hierarchy


- Each onboarding step is a full-bleed `ClearLensScreen`
- Top: progress indicator (4 pills, current one filled emerald)
- Body: one focused decision per screen (no walls of text)
- Bottom: primary CTA (filled emerald), secondary CTA when applicable (outlined)


## Copy Catalog (canonical)


- Welcome title: "Let's pull in your portfolio"
- Welcome body: "We need your Consolidated Account Statement (CAS) — a free statement from CAMS or KFintech that lists every mutual fund you own. We'll calculate your real return, sector exposure, and a money trail across all your investments."
- Privacy line: "Read-only. Stored encrypted. Never shared."
- Identity title: "Tell us who you are"
- Identity body: "Your PAN unlocks the CAS PDF. Date of birth is only needed if you import a CDSL or NSDL statement."
- Import title: "How would you like to start?"
- Upload card title: "Upload a CAS PDF"
- Upload card body: "Got one already? Upload it now and we'll do the rest."
- Request card title: "Get a fresh CAS"
- Request card body: "We'll show you exactly what to do. Takes about 2 minutes."
- Auto-refresh card title: "Set up auto-refresh (advanced)"
- Auto-refresh card body: "Forward CAS emails to your private FolioLens address and never re-upload."
- Done title: "Your portfolio is ready"


## Cross-References


- M1 implements steps 1-4 minus auto-refresh (and the Upload + Request paths)
- M2 implements the auto-refresh path and post-import nudge
