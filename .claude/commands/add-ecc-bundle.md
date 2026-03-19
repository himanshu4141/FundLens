---
name: add-ecc-bundle
description: Workflow command scaffold for add-ecc-bundle in FundLens.
allowed_tools: ["Bash", "Read", "Write", "Grep", "Glob"]
---

# /add-ecc-bundle

Use this workflow when working on **add-ecc-bundle** in `FundLens`.

## Goal

Adds a new ECC (Extensible Cognitive Component) bundle for FundLens, including agent definitions, skill documentation, commands, and configuration files.

## Common Files

- `.claude/commands/feature-development.md`
- `.claude/commands/refactoring.md`
- `.claude/commands/database-migration.md`
- `.claude/identity.json`
- `.claude/ecc-tools.json`
- `.claude/skills/FundLens/SKILL.md`

## Suggested Sequence

1. Understand the current state and failure mode before editing.
2. Make the smallest coherent change that satisfies the workflow goal.
3. Run the most relevant verification for touched files.
4. Summarize what changed and what still needs review.

## Typical Commit Signals

- Add or update .claude/commands/*.md files (such as feature-development.md, refactoring.md, database-migration.md)
- Add or update .claude/identity.json
- Add or update .claude/ecc-tools.json
- Add or update .claude/skills/FundLens/SKILL.md
- Add or update .agents/skills/FundLens/agents/openai.yaml

## Notes

- Treat this as a scaffold, not a hard-coded script.
- Update the command if the workflow evolves materially.