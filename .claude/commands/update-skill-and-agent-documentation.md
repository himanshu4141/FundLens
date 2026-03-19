---
name: update-skill-and-agent-documentation
description: Workflow command scaffold for update-skill-and-agent-documentation in FundLens.
allowed_tools: ["Bash", "Read", "Write", "Grep", "Glob"]
---

# /update-skill-and-agent-documentation

Use this workflow when working on **update-skill-and-agent-documentation** in `FundLens`.

## Goal

Updates documentation for FundLens skills and agents, ensuring documentation files are current.

## Common Files

- `.claude/commands/update-skill-and-agent-documentation.md`
- `.claude/commands/update-skill-documentation.md`
- `.claude/commands/update-agent-and-skill-documentation.md`
- `.agents/skills/FundLens/SKILL.md`
- `.claude/skills/FundLens/SKILL.md`

## Suggested Sequence

1. Understand the current state and failure mode before editing.
2. Make the smallest coherent change that satisfies the workflow goal.
3. Run the most relevant verification for touched files.
4. Summarize what changed and what still needs review.

## Typical Commit Signals

- Edit or add .claude/commands/update-skill-and-agent-documentation.md or similar documentation files
- Update .agents/skills/FundLens/SKILL.md and/or .claude/skills/FundLens/SKILL.md

## Notes

- Treat this as a scaffold, not a hard-coded script.
- Update the command if the workflow evolves materially.