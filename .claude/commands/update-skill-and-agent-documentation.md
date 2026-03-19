---
name: update-skill-and-agent-documentation
description: Workflow command scaffold for update-skill-and-agent-documentation in FundLens.
allowed_tools: ["Bash", "Read", "Write", "Grep", "Glob"]
---

# /update-skill-and-agent-documentation

Use this workflow when working on **update-skill-and-agent-documentation** in `FundLens`.

## Goal

Updates documentation related to skills and agents, often as part of ECC bundle changes or feature development.

## Common Files

- `.claude/commands/update-skill-and-agent-documentation.md`
- `.claude/commands/update-skill-documentation.md`
- `.claude/commands/update-agent-and-skill-documentation.md`
- `.claude/skills/FundLens/SKILL.md`
- `.agents/skills/FundLens/SKILL.md`

## Suggested Sequence

1. Understand the current state and failure mode before editing.
2. Make the smallest coherent change that satisfies the workflow goal.
3. Run the most relevant verification for touched files.
4. Summarize what changed and what still needs review.

## Typical Commit Signals

- Add or update .claude/commands/update-skill-and-agent-documentation.md or similar documentation command files
- Add or update .claude/skills/FundLens/SKILL.md
- Add or update .agents/skills/FundLens/SKILL.md

## Notes

- Treat this as a scaffold, not a hard-coded script.
- Update the command if the workflow evolves materially.