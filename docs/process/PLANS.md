# Codex Execution Plans (ExecPlans)

This document defines the requirements for an ExecPlan. An ExecPlan is a self-contained, living design document that a coding agent can follow to deliver a working feature or system change.

Treat the reader as a complete beginner to this repository. They only have the working tree and the ExecPlan file. There is no memory of prior plans and no external context.

## How To Use ExecPlans
- When authoring an ExecPlan, follow this file to the letter.
- When implementing an ExecPlan, proceed milestone by milestone without asking for “next steps”.
- When discussing an ExecPlan, record decisions in the plan’s decision log so a future reader understands why changes were made.
- When researching unknowns, use milestones for proofs of concept that validate feasibility before full implementation.

## Non-Negotiable Requirements
- Every ExecPlan must be fully self-contained in its current form.
- Every ExecPlan is a living document and must be updated as work progresses.
- Every ExecPlan must enable a complete novice to implement the feature end-to-end.
- Every ExecPlan must produce demonstrably working behavior, not just code changes.
- Every term of art must be defined in plain language or not used.

Purpose and intent come first. Begin by explaining why the work matters from a user’s perspective and how to see it working. Then guide the reader through the exact steps to achieve that outcome, including what to edit, what to run, and what they should observe.

Do not point to external blogs or docs. If knowledge is required, embed it in the plan in your own words. If an ExecPlan builds upon a prior ExecPlan that is checked in, incorporate it by reference. If not, include all relevant context directly.

## Formatting
- Each ExecPlan must be a single fenced code block labeled as `md`.
- Do not nest additional fences inside. Use indented blocks for commands and examples.
- Use two blank lines after every heading.
- Use correct Markdown syntax for ordered and unordered lists.
- If an ExecPlan is the only content of a Markdown file, omit the outer triple backticks.

## Guidelines
- Self-containment and plain language are paramount.
- Avoid undefined jargon.
- Resolve ambiguities inside the plan and explain the choice.
- Anchor the plan with observable outcomes and clear validation steps.
- Specify repository context explicitly, including file paths and commands.
- Make steps idempotent and safe; include retry guidance for fragile steps.
- Validation is required and must include expected outputs.

## Milestones And Progress
- Milestones tell the story of the work. Each milestone must state scope, expected outcome, commands to run, and acceptance criteria.
- Progress is a required checklist that tracks granular completion and updates over time.

## ExecPlan Template

# Title

## Goal

## User Value

## Context

## Assumptions

## Definitions

## Scope

## Out of Scope

## Approach

## Alternatives Considered

## Milestones

## Validation

## Risks And Mitigations

## Decision Log

## Progress
- [ ] Task 1
- [ ] Task 2
