# AGENTS.md

## Purpose
This file defines how coding agents should plan and execute work in this repository.

## Project State

Phases 1–3 are fully shipped: foundation, the Phase 2 data pipeline (M1–M9 + M11), and the Clear Lens design system. Phase 4 (Tools Hub) has M0 + M1 (Goal Planner) shipped; M2–M4 are stacked PRs. Phase 5 (CAS onboarding redesign) is in flight — M1 wizard at PR #92, M2 Resend Inbound backend at PR #93. The app has magic-link + Google auth, the upload-first onboarding wizard, home screen with XIRR / benchmark / Money Trail preview, fund detail, leaderboard, wealth simulator, portfolio insights, native feedback form with screenshot attachments, and three EAS-channel build flavours (production / preview-main / preview-pr).

Active ExecPlans live under `docs/plans/<phase>/`. Shipped plans move to `docs/plans/archive/`. The brand was renamed FundLens → FolioLens; expect old names only inside archive material.

## Repository Anchors

Read `VISION.md` at the start of every session. Read the others on-demand.

| Read this | When you are... |
|---|---|
| `VISION.md` | Always — read this first |
| `docs/INFRASTRUCTURE.md` | Anything that touches CI/CD, environments, secrets, Supabase / Vercel / Resend / Expo config, or domain routing |
| `docs/SCREENS.md` | Building or changing any UI, navigation, or screen layout |
| `docs/TECH-DISCOVERY.md` | Touching DB schema, third-party data sources, or the data pipeline |

## ExecPlans
When writing complex features, multi-day efforts, or significant refactors, use an ExecPlan as described in `docs/process/PLANS.md` from design through implementation.

An ExecPlan is required when:
- The work spans multiple files or systems.
- The change is risky, ambiguous, or has multiple steps.
- The work is expected to take more than a short session.

For small, contained changes (single file edits, small fixes), an ExecPlan is not required.

ExecPlans must follow the formatting and content requirements in `docs/process/PLANS.md`.

## Defaults
- Prefer explicit assumptions over implicit ones.
- Keep plans and progress up to date as work evolves.
- Validate with runnable checks where possible.

## Validation Checklist (required before closing any PR)

Do not raise or mark a PR ready-for-review until all of the following pass:

### TypeScript + Lint
```bash
npm run typecheck   # zero errors
npm run lint        # zero warnings (--max-warnings 0)
```

### React hooks
- All `useEffect`, `useCallback`, and `useMemo` hooks must include every variable they reference in their dependency array.
- `react-hooks/exhaustive-deps` is set to `'error'` — lint will catch this, but review manually too.

### Edge Functions
- Any Edge Function that uses Deno APIs (`Deno.serve`, `jsr:`, `npm:`) must be in `supabase/functions/` and excluded from the root `tsconfig.json` and `eslint.config.js`.
- After making changes to an Edge Function, verify it is deployed: check the function's last-deployed timestamp in the Supabase Dashboard or re-deploy explicitly.
- Edge Functions called by pg_cron must be deployed with `--no-verify-jwt`.

### Supabase migrations
- After writing a new migration, apply it to the production DB (`supabase db push` or via the Supabase MCP tool) and confirm it ran without errors.
- For cron schedule changes, verify the `cron.job` table reflects the new schedule.

### Stacked PRs
- When a bug fix is committed, it must go on the earliest milestone branch where the faulty code was introduced — not on the tip of the stack.
- After adding commits to a lower branch, rebase all downstream branches and force-push.

### Documentation
- After implementation, add an "Amendments" section to the relevant ExecPlan(s) if the actual implementation diverged from the original plan.
- Update the README "What works now" section to reflect any new capabilities.
