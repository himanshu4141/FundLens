---
name: feature-enhancement-with-iterative-fixes
description: Workflow command scaffold for feature-enhancement-with-iterative-fixes in FundLens.
allowed_tools: ["Bash", "Read", "Write", "Grep", "Glob"]
---

# /feature-enhancement-with-iterative-fixes

Use this workflow when working on **feature-enhancement-with-iterative-fixes** in `FundLens`.

## Goal

Implements a new feature or major screen, followed by a series of focused fixes and UX improvements to the same files, often on the same day.

## Common Files

- `app/(tabs)/simulator.tsx`
- `src/utils/simulatorCalc.ts`
- `src/utils/__tests__/simulatorCalc.test.ts`

## Suggested Sequence

1. Understand the current state and failure mode before editing.
2. Make the smallest coherent change that satisfies the workflow goal.
3. Run the most relevant verification for touched files.
4. Summarize what changed and what still needs review.

## Typical Commit Signals

- Step 1: Implement new feature or screen, including core logic and tests.
- Step 2: Commit initial implementation (often touching a main screen file and utility/test files).
- Step 3: Make a series of focused fix commits to the same main file(s), each addressing specific UX, logic, or UI issues.
- Step 4: Each fix commit typically changes only the main screen file or closely related files.

## Notes

- Treat this as a scaffold, not a hard-coded script.
- Update the command if the workflow evolves materially.