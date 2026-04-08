---
name: single-file-ui-bugfix
description: Workflow command scaffold for single-file-ui-bugfix in FundLens.
allowed_tools: ["Bash", "Read", "Write", "Grep", "Glob"]
---

# /single-file-ui-bugfix

Use this workflow when working on **single-file-ui-bugfix** in `FundLens`.

## Goal

Fixes a specific UI bug or visual issue by modifying only the affected screen/component file.

## Common Files

- `app/fund/[id].tsx`
- `app/(tabs)/simulator.tsx`

## Suggested Sequence

1. Understand the current state and failure mode before editing.
2. Make the smallest coherent change that satisfies the workflow goal.
3. Run the most relevant verification for touched files.
4. Summarize what changed and what still needs review.

## Typical Commit Signals

- Step 1: Identify the UI bug or visual issue.
- Step 2: Make targeted changes to the affected screen/component file.
- Step 3: Commit with a descriptive message referencing the bug and affected UI element.

## Notes

- Treat this as a scaffold, not a hard-coded script.
- Update the command if the workflow evolves materially.