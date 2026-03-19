---
name: add-ecc-bundle-files
description: Workflow command scaffold for add-ecc-bundle-files in FundLens.
allowed_tools: ["Bash", "Read", "Write", "Grep", "Glob"]
---

# /add-ecc-bundle-files

Use this workflow when working on **add-ecc-bundle-files** in `FundLens`.

## Goal

Adds a set of configuration, command, skill, and agent files for the FundLens ECC bundle, including documentation and metadata.

## Common Files

- `.claude/commands/refactoring.md`
- `.claude/commands/feature-development.md`
- `.claude/commands/database-migration.md`
- `.claude/identity.json`
- `.claude/skills/FundLens/SKILL.md`
- `.claude/ecc-tools.json`

## Suggested Sequence

1. Understand the current state and failure mode before editing.
2. Make the smallest coherent change that satisfies the workflow goal.
3. Run the most relevant verification for touched files.
4. Summarize what changed and what still needs review.

## Typical Commit Signals

- Add or update .claude/commands/*.md files (e.g., refactoring.md, feature-development.md, database-migration.md)
- Add or update .claude/identity.json
- Add or update .claude/skills/FundLens/SKILL.md
- Add or update .claude/ecc-tools.json
- Add or update .codex/agents/*.toml (e.g., docs-researcher.toml, reviewer.toml, explorer.toml)

## Notes

- Treat this as a scaffold, not a hard-coded script.
- Update the command if the workflow evolves materially.