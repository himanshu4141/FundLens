---
name: update-agent-and-skill-documentation
description: Workflow command scaffold for update-agent-and-skill-documentation in FundLens.
allowed_tools: ["Bash", "Read", "Write", "Grep", "Glob"]
---

# /update-agent-and-skill-documentation

Use this workflow when working on **update-agent-and-skill-documentation** in `FundLens`.

## Goal

Adds or updates documentation and configuration for agents and skills related to FundLens.

## Common Files

- `.agents/skills/FundLens/SKILL.md`
- `.claude/skills/FundLens/SKILL.md`
- `.agents/skills/FundLens/agents/openai.yaml`

## Suggested Sequence

1. Understand the current state and failure mode before editing.
2. Make the smallest coherent change that satisfies the workflow goal.
3. Run the most relevant verification for touched files.
4. Summarize what changed and what still needs review.

## Typical Commit Signals

- Add or update .agents/skills/FundLens/SKILL.md
- Add or update .claude/skills/FundLens/SKILL.md
- Add or update .agents/skills/FundLens/agents/openai.yaml

## Notes

- Treat this as a scaffold, not a hard-coded script.
- Update the command if the workflow evolves materially.