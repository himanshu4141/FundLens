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

Follow these commit message conventions based on 61 analyzed commits.

### Commit Style: Conventional Commits

### Prefixes Used

- `feat`
- `fix`

### Message Guidelines

- Average message length: ~63 characters
- Keep first line concise and descriptive
- Use imperative mood ("Add feature" not "Added feature")


*Commit message example*

```text
feat: add FundLens ECC bundle (.claude/commands/refactoring.md)
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
feat: add FundLens ECC bundle (.claude/commands/feature-development.md)
```

*Commit message example*

```text
feat: add FundLens ECC bundle (.claude/commands/database-migration.md)
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

**Frequency**: ~29 times per month

**Steps**:
1. Add feature implementation
2. Add tests for feature
3. Update documentation

**Example commit sequence**:
```
ci: add workflow_dispatch to supabase-deploy workflow (#12)
fix: fund card P&L display, chart usability, back nav, benchmark sync, magic link (#13)
feat: add FundLens ECC bundle (.claude/ecc-tools.json)
```

### Add Ecc Bundle Files

Adds a set of configuration, command, skill, and agent files for the FundLens ECC bundle, including documentation and metadata.

**Frequency**: ~3 times per month

**Steps**:
1. Add or update .claude/commands/*.md files (e.g., refactoring.md, feature-development.md, database-migration.md)
2. Add or update .claude/identity.json
3. Add or update .claude/skills/FundLens/SKILL.md
4. Add or update .claude/ecc-tools.json
5. Add or update .codex/agents/*.toml (e.g., docs-researcher.toml, reviewer.toml, explorer.toml)
6. Add or update .agents/skills/FundLens/agents/openai.yaml
7. Add or update .agents/skills/FundLens/SKILL.md

**Files typically involved**:
- `.claude/commands/refactoring.md`
- `.claude/commands/feature-development.md`
- `.claude/commands/database-migration.md`
- `.claude/identity.json`
- `.claude/skills/FundLens/SKILL.md`
- `.claude/ecc-tools.json`
- `.codex/agents/docs-researcher.toml`
- `.codex/agents/reviewer.toml`
- `.codex/agents/explorer.toml`
- `.agents/skills/FundLens/agents/openai.yaml`
- `.agents/skills/FundLens/SKILL.md`

**Example commit sequence**:
```
Add or update .claude/commands/*.md files (e.g., refactoring.md, feature-development.md, database-migration.md)
Add or update .claude/identity.json
Add or update .claude/skills/FundLens/SKILL.md
Add or update .claude/ecc-tools.json
Add or update .codex/agents/*.toml (e.g., docs-researcher.toml, reviewer.toml, explorer.toml)
Add or update .agents/skills/FundLens/agents/openai.yaml
Add or update .agents/skills/FundLens/SKILL.md
```

### Update Agent And Skill Documentation

Adds or updates documentation and configuration for agents and skills related to FundLens.

**Frequency**: ~3 times per month

**Steps**:
1. Add or update .agents/skills/FundLens/SKILL.md
2. Add or update .claude/skills/FundLens/SKILL.md
3. Add or update .agents/skills/FundLens/agents/openai.yaml

**Files typically involved**:
- `.agents/skills/FundLens/SKILL.md`
- `.claude/skills/FundLens/SKILL.md`
- `.agents/skills/FundLens/agents/openai.yaml`

**Example commit sequence**:
```
Add or update .agents/skills/FundLens/SKILL.md
Add or update .claude/skills/FundLens/SKILL.md
Add or update .agents/skills/FundLens/agents/openai.yaml
```

### Add Or Update Codex Agent Configs

Adds or updates agent configuration files in the .codex/agents directory, often in sets.

**Frequency**: ~3 times per month

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

### Update Claude Commands

Adds or updates command markdown files for Claude agent workflows (refactoring, feature development, database migration).

**Frequency**: ~3 times per month

**Steps**:
1. Add or update .claude/commands/refactoring.md
2. Add or update .claude/commands/feature-development.md
3. Add or update .claude/commands/database-migration.md

**Files typically involved**:
- `.claude/commands/refactoring.md`
- `.claude/commands/feature-development.md`
- `.claude/commands/database-migration.md`

**Example commit sequence**:
```
Add or update .claude/commands/refactoring.md
Add or update .claude/commands/feature-development.md
Add or update .claude/commands/database-migration.md
```

### Update Claude Identity And Tools

Adds or updates Claude agent identity and tool configuration files.

**Frequency**: ~3 times per month

**Steps**:
1. Add or update .claude/identity.json
2. Add or update .claude/ecc-tools.json

**Files typically involved**:
- `.claude/identity.json`
- `.claude/ecc-tools.json`

**Example commit sequence**:
```
Add or update .claude/identity.json
Add or update .claude/ecc-tools.json
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
