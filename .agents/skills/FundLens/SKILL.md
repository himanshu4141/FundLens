---
name: fundlens-conventions
description: Development conventions and patterns for FundLens. TypeScript React project with conventional commits.
---

# Fundlens Conventions

> Generated from [himanshu4141/FundLens](https://github.com/himanshu4141/FundLens) on 2026-03-19

## Overview

This skill teaches Claude the development patterns and conventions used in FundLens.

## Tech Stack

- **Primary Language**: TypeScript
- **Framework**: React
- **Architecture**: type-based module organization
- **Test Location**: separate

## When to Use This Skill

Activate this skill when:
- Making changes to this repository
- Adding new features following established patterns
- Writing tests that match project conventions
- Creating commits with proper message format

## Commit Conventions

Follow these commit message conventions based on 105 analyzed commits.

### Commit Style: Conventional Commits

### Prefixes Used

- `feat`

### Message Guidelines

- Average message length: ~64 characters
- Keep first line concise and descriptive
- Use imperative mood ("Add feature" not "Added feature")


*Commit message example*

```text
feat: add FundLens ECC bundle (.claude/commands/update-skill-and-agent-documentation.md)
```

*Commit message example*

```text
fix: fund card P&L display, chart usability, back nav, benchmark sync, magic link (#13)
```

*Commit message example*

```text
ci: add workflow_dispatch to supabase-deploy workflow (#12)
```

*Commit message example*

```text
discovery: product vision, screens, and tech stack (#1)
```

*Commit message example*

```text
initial: project setup
```

*Commit message example*

```text
feat: add FundLens ECC bundle (.claude/commands/add-ecc-bundle.md)
```

*Commit message example*

```text
feat: add FundLens ECC bundle (.claude/commands/feature-development.md)
```

*Commit message example*

```text
feat: add FundLens ECC bundle (.codex/agents/docs-researcher.toml)
```

## Architecture

### Project Structure: Single Package

This project uses **type-based** module organization.

### Source Layout

```
src/
├── components/
├── constants/
├── hooks/
├── lib/
├── store/
├── types/
├── utils/
```

### Configuration Files

- `.github/workflows/pr-preview.yml`
- `.github/workflows/production.yml`
- `.github/workflows/supabase-deploy.yml`
- `.prettierrc`
- `eslint.config.js`
- `package.json`
- `tsconfig.json`
- `vercel.json`

### Guidelines

- Group code by type (components, services, utils)
- Keep related functionality in the same type folder
- Avoid circular dependencies between type folders

## Code Style

### Language: TypeScript

### Naming Conventions

| Element | Convention |
|---------|------------|
| Files | camelCase |
| Functions | camelCase |
| Classes | PascalCase |
| Constants | SCREAMING_SNAKE_CASE |

### Import Style: Path Aliases (@/, ~/)

### Export Style: Mixed Style


*Preferred import style*

```typescript
// Use path aliases for imports
import { Button } from '@/components/Button'
import { useAuth } from '@/hooks/useAuth'
import { api } from '@/lib/api'
```

## Error Handling

### Error Handling Style: Try-Catch Blocks


*Standard error handling pattern*

```typescript
try {
  const result = await riskyOperation()
  return result
} catch (error) {
  console.error('Operation failed:', error)
  throw new Error('User-friendly message')
}
```

## Common Workflows

These workflows were detected from analyzing commit patterns.

### Feature Development

Standard feature implementation workflow

**Frequency**: ~30 times per month

**Steps**:
1. Add feature implementation
2. Add tests for feature
3. Update documentation

**Example commit sequence**:
```
feat: add FundLens ECC bundle (.codex/agents/explorer.toml)
feat: add FundLens ECC bundle (.codex/agents/reviewer.toml)
feat: add FundLens ECC bundle (.codex/agents/docs-researcher.toml)
```

### Add Ecc Bundle

Adds a new ECC bundle for FundLens, including command documentation, agent/skill definitions, and configuration files.

**Frequency**: ~4 times per month

**Steps**:
1. Add or update .claude/commands/add-ecc-bundle.md
2. Add or update .claude/identity.json
3. Add or update .claude/ecc-tools.json
4. Add or update .agents/skills/FundLens/SKILL.md
5. Add or update .claude/skills/FundLens/SKILL.md
6. Add or update agent configuration files in .codex/agents/ (docs-researcher.toml, reviewer.toml, explorer.toml)
7. Add or update .agents/skills/FundLens/agents/openai.yaml

**Files typically involved**:
- `.claude/commands/add-ecc-bundle.md`
- `.claude/identity.json`
- `.claude/ecc-tools.json`
- `.agents/skills/FundLens/SKILL.md`
- `.claude/skills/FundLens/SKILL.md`
- `.codex/agents/docs-researcher.toml`
- `.codex/agents/reviewer.toml`
- `.codex/agents/explorer.toml`
- `.agents/skills/FundLens/agents/openai.yaml`

**Example commit sequence**:
```
Add or update .claude/commands/add-ecc-bundle.md
Add or update .claude/identity.json
Add or update .claude/ecc-tools.json
Add or update .agents/skills/FundLens/SKILL.md
Add or update .claude/skills/FundLens/SKILL.md
Add or update agent configuration files in .codex/agents/ (docs-researcher.toml, reviewer.toml, explorer.toml)
Add or update .agents/skills/FundLens/agents/openai.yaml
```

### Update Skill And Agent Documentation

Updates documentation for FundLens skills and agents, ensuring documentation files are current.

**Frequency**: ~3 times per month

**Steps**:
1. Edit or add .claude/commands/update-skill-and-agent-documentation.md or similar documentation files
2. Update .agents/skills/FundLens/SKILL.md and/or .claude/skills/FundLens/SKILL.md

**Files typically involved**:
- `.claude/commands/update-skill-and-agent-documentation.md`
- `.claude/commands/update-skill-documentation.md`
- `.claude/commands/update-agent-and-skill-documentation.md`
- `.agents/skills/FundLens/SKILL.md`
- `.claude/skills/FundLens/SKILL.md`

**Example commit sequence**:
```
Edit or add .claude/commands/update-skill-and-agent-documentation.md or similar documentation files
Update .agents/skills/FundLens/SKILL.md and/or .claude/skills/FundLens/SKILL.md
```

### Feature Development Command Docs

Adds or updates feature development command documentation for FundLens ECC bundle.

**Frequency**: ~4 times per month

**Steps**:
1. Add or update .claude/commands/feature-development.md

**Files typically involved**:
- `.claude/commands/feature-development.md`

**Example commit sequence**:
```
Add or update .claude/commands/feature-development.md
```

### Add Codex Agent Configs

Adds or updates Codex agent configuration files for FundLens ECC bundle.

**Frequency**: ~4 times per month

**Steps**:
1. Add or update .codex/agents/docs-researcher.toml
2. Add or update .codex/agents/reviewer.toml
3. Add or update .codex/agents/explorer.toml

**Files typically involved**:
- `.codex/agents/docs-researcher.toml`
- `.codex/agents/reviewer.toml`
- `.codex/agents/explorer.toml`

**Example commit sequence**:
```
Add or update .codex/agents/docs-researcher.toml
Add or update .codex/agents/reviewer.toml
Add or update .codex/agents/explorer.toml
```


## Best Practices

Based on analysis of the codebase, follow these practices:

### Do

- Use conventional commit format (feat:, fix:, etc.)
- Use camelCase for file names
- Prefer mixed exports

### Don't

- Don't use long relative imports (use aliases)
- Don't write vague commit messages
- Don't deviate from established patterns without discussion

---

*This skill was auto-generated by [ECC Tools](https://ecc.tools). Review and customize as needed for your team.*
