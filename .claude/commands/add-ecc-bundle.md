---
name: add-ecc-bundle
description: Workflow command scaffold for add-ecc-bundle in FundLens.
allowed_tools: ["Bash", "Read", "Write", "Grep", "Glob"]
---

# /add-ecc-bundle

Use this workflow when working on **add-ecc-bundle** in `FundLens`.

## Goal

Adds a new ECC (Extensible Command/Component) bundle for FundLens, including agent configurations, skill documentation, identity, and command templates.

## Common Files

- `.claude/identity.json`
- `.agents/skills/FundLens/SKILL.md`
- `.claude/skills/FundLens/SKILL.md`
- `.claude/ecc-tools.json`
- `.codex/agents/docs-researcher.toml`
- `.codex/agents/reviewer.toml`

## Suggested Sequence

1. Understand the current state and failure mode before editing.
2. Make the smallest coherent change that satisfies the workflow goal.
3. Run the most relevant verification for touched files.
4. Summarize what changed and what still needs review.

## Typical Commit Signals

- Create or update .claude/identity.json
- Add or update .agents/skills/FundLens/SKILL.md
- Add or update .claude/skills/FundLens/SKILL.md
- Add or update .claude/ecc-tools.json
- Add or update .codex/agents/docs-researcher.toml

## Notes

- Treat this as a scaffold, not a hard-coded script.
- Update the command if the workflow evolves materially.