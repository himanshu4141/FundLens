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

Follow these commit message conventions based on 28 analyzed commits.

### Commit Style: Conventional Commits

### Prefixes Used

- `feat`
- `fix`
- `ci`
- `discovery`
- `initial`

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
feat: add FundLens ECC bundle (.claude/homunculus/instincts/inherited/FundLens-instincts.yaml)
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

### Database Migration

Database schema changes with migration files

**Frequency**: ~6 times per month

**Steps**:
1. Create migration file
2. Update schema definitions
3. Generate/update types

**Files typically involved**:
- `**/types.ts`
- `migrations/*`
- `**/schema.*`

**Example commit sequence**:
```
feat: milestone 1 — foundation, auth, schema, CI/CD (#2)
feat: milestone 2 — data pipeline Edge Functions (#3)
feat: milestone 3 — onboarding & CAS webhook import (#4)
```

### Feature Development

Standard feature implementation workflow

**Frequency**: ~27 times per month

**Steps**:
1. Add feature implementation
2. Add tests for feature
3. Update documentation

**Files typically involved**:
- `app/(tabs)/*`
- `app/*`
- `app/auth/*`

**Example commit sequence**:
```
discovery: product vision, screens, and tech stack (#1)
feat: milestone 1 — foundation, auth, schema, CI/CD (#2)
feat: milestone 2 — data pipeline Edge Functions (#3)
```

### Refactoring

Code refactoring and cleanup workflow

**Frequency**: ~5 times per month

**Steps**:
1. Ensure tests pass before refactor
2. Refactor code structure
3. Verify tests still pass

**Files typically involved**:
- `src/**/*`

**Example commit sequence**:
```
feat: milestone 3 — onboarding & CAS webhook import (#4)
feat: milestone 4 — home screen with portfolio data & XIRR (#5)
feat: milestone 5 — fund detail with performance & NAV charts (#6)
```

### Feature Milestone Development

Implements a major feature or milestone, typically including new screens, hooks, utilities, and documentation.

**Frequency**: ~2 times per month

**Steps**:
1. Create or update one or more screen files under app/(tabs)/ or app/fund/ or app/onboarding/
2. Add or update related React hooks in src/hooks/
3. Add or update shared utilities in src/utils/ as needed
4. Update or create milestone-specific documentation in docs/plans/
5. Update AGENTS.md or CLAUDE.md with validation checklists or process notes (optional)
6. Update or add database migrations in supabase/migrations/ if schema changes are needed

**Files typically involved**:
- `app/(tabs)/*.tsx`
- `app/fund/[id].tsx`
- `app/onboarding/*.tsx`
- `src/hooks/*.ts`
- `src/utils/*.ts`
- `docs/plans/*.md`
- `AGENTS.md`
- `CLAUDE.md`
- `supabase/migrations/*.sql`

**Example commit sequence**:
```
Create or update one or more screen files under app/(tabs)/ or app/fund/ or app/onboarding/
Add or update related React hooks in src/hooks/
Add or update shared utilities in src/utils/ as needed
Update or create milestone-specific documentation in docs/plans/
Update AGENTS.md or CLAUDE.md with validation checklists or process notes (optional)
Update or add database migrations in supabase/migrations/ if schema changes are needed
```

### Database Schema Change And Migration

Adds or modifies database tables/columns and generates corresponding migration scripts.

**Frequency**: ~2 times per month

**Steps**:
1. Edit or add SQL migration file in supabase/migrations/
2. Update supabase/config.toml if configuration changes are needed
3. Regenerate src/types/database.types.ts if types need to reflect schema changes
4. Update related edge functions or hooks to use new schema

**Files typically involved**:
- `supabase/migrations/*.sql`
- `supabase/config.toml`
- `src/types/database.types.ts`
- `supabase/functions/**/*.ts`

**Example commit sequence**:
```
Edit or add SQL migration file in supabase/migrations/
Update supabase/config.toml if configuration changes are needed
Regenerate src/types/database.types.ts if types need to reflect schema changes
Update related edge functions or hooks to use new schema
```

### Edge Function Development Or Update

Creates or updates Supabase Edge Functions for backend logic (e.g., data sync, CAS import, onboarding).

**Frequency**: ~2 times per month

**Steps**:
1. Create or modify function file in supabase/functions/<function-name>/index.ts
2. If needed, update or add shared helpers in supabase/functions/_shared/
3. Add or update related migration if new tables/columns are needed
4. Update or add documentation in docs/plans/ or relevant markdown files

**Files typically involved**:
- `supabase/functions/*/index.ts`
- `supabase/functions/_shared/*.ts`
- `supabase/migrations/*.sql`
- `docs/plans/*.md`

**Example commit sequence**:
```
Create or modify function file in supabase/functions/<function-name>/index.ts
If needed, update or add shared helpers in supabase/functions/_shared/
Add or update related migration if new tables/columns are needed
Update or add documentation in docs/plans/ or relevant markdown files
```

### Documentation And Execplan Update

Adds or updates documentation, milestone plans, and process records.

**Frequency**: ~2 times per month

**Steps**:
1. Create or update docs/plans/<milestone>.md with implementation details
2. Update AGENTS.md, CLAUDE.md, or docs/SCREENS.md as needed
3. Update README.md with new instructions or project structure

**Files typically involved**:
- `docs/plans/*.md`
- `AGENTS.md`
- `CLAUDE.md`
- `docs/SCREENS.md`
- `README.md`

**Example commit sequence**:
```
Create or update docs/plans/<milestone>.md with implementation details
Update AGENTS.md, CLAUDE.md, or docs/SCREENS.md as needed
Update README.md with new instructions or project structure
```

### Ci Cd Workflow Update

Modifies GitHub Actions workflows or Supabase deployment configuration for CI/CD improvements.

**Frequency**: ~1 times per month

**Steps**:
1. Edit or add workflow files in .github/workflows/
2. Update supabase/config.toml or related config files if needed
3. Update documentation to reflect CI/CD changes

**Files typically involved**:
- `.github/workflows/*.yml`
- `supabase/config.toml`
- `README.md`

**Example commit sequence**:
```
Edit or add workflow files in .github/workflows/
Update supabase/config.toml or related config files if needed
Update documentation to reflect CI/CD changes
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
