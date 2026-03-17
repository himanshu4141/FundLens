# AGENTS.md

## Purpose
This file defines how coding agents should plan and execute work in this repository.

## Repository Anchors
Agents must review these documents at the start of new work:
- VISION.md — the product vision, core user problems, design principles, and what is out of scope. All decisions must align with this document.
- docs/SCREENS.md — the screen map and navigation structure. Reference this when building any UI or planning flows.

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
