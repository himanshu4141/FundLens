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

Follow these commit message conventions based on 50 analyzed commits.

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

### Database Migration

Database schema changes with migration files

**Frequency**: ~4 times per month

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

**Frequency**: ~28 times per month

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

**Frequency**: ~4 times per month

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

### Milestone Feature Development

Implements a major feature or screen, including UI, hooks, utilities, and documentation.

**Frequency**: ~2 times per month

**Steps**:
1. Create or update screen files under app/(tabs) or app/onboarding or app/fund.
2. Implement or update supporting hooks in src/hooks/ (e.g., usePortfolio.ts, useFundDetail.ts, useCompare.ts).
3. Add or update utility functions in src/utils/ as needed.
4. Update or add documentation in docs/plans/ (e.g., docs/plans/04-home-screen.md).
5. Update types in src/types/database.types.ts if required.
6. Optionally, add or update migrations in supabase/migrations/ if schema changes are needed.

**Files typically involved**:
- `app/(tabs)/*.tsx`
- `app/onboarding/*.tsx`
- `app/fund/[id].tsx`
- `src/hooks/*.ts`
- `src/utils/*.ts`
- `docs/plans/*.md`
- `src/types/database.types.ts`
- `supabase/migrations/*.sql`

**Example commit sequence**:
```
Create or update screen files under app/(tabs) or app/onboarding or app/fund.
Implement or update supporting hooks in src/hooks/ (e.g., usePortfolio.ts, useFundDetail.ts, useCompare.ts).
Add or update utility functions in src/utils/ as needed.
Update or add documentation in docs/plans/ (e.g., docs/plans/04-home-screen.md).
Update types in src/types/database.types.ts if required.
Optionally, add or update migrations in supabase/migrations/ if schema changes are needed.
```

### Database Schema Migration

Adds or modifies database tables, columns, or indexes, including updating types and sometimes seeds.

**Frequency**: ~2 times per month

**Steps**:
1. Create or update migration SQL files in supabase/migrations/.
2. Update src/types/database.types.ts to reflect schema changes.
3. If new tables or columns are user-facing, update related hooks or utilities.
4. If seed data is needed, include it in the migration or as a separate seed migration.

**Files typically involved**:
- `supabase/migrations/*.sql`
- `src/types/database.types.ts`

**Example commit sequence**:
```
Create or update migration SQL files in supabase/migrations/.
Update src/types/database.types.ts to reflect schema changes.
If new tables or columns are user-facing, update related hooks or utilities.
If seed data is needed, include it in the migration or as a separate seed migration.
```

### Edge Function Development

Creates or updates Supabase Edge Functions for backend logic, including shared helpers and CORS/auth handling.

**Frequency**: ~2 times per month

**Steps**:
1. Create or update function files in supabase/functions/[function-name]/index.ts.
2. If needed, update or add shared helpers in supabase/functions/_shared/ (e.g., auth.ts, cors.ts, import-cas.ts).
3. Update supabase/config.toml if function config changes.
4. Update or add Deno config in supabase/functions/deno.json if new dependencies or types are needed.
5. Update related frontend hooks or flows to use the new/updated function.

**Files typically involved**:
- `supabase/functions/*/index.ts`
- `supabase/functions/_shared/*.ts`
- `supabase/config.toml`
- `supabase/functions/deno.json`

**Example commit sequence**:
```
Create or update function files in supabase/functions/[function-name]/index.ts.
If needed, update or add shared helpers in supabase/functions/_shared/ (e.g., auth.ts, cors.ts, import-cas.ts).
Update supabase/config.toml if function config changes.
Update or add Deno config in supabase/functions/deno.json if new dependencies or types are needed.
Update related frontend hooks or flows to use the new/updated function.
```

### Ci Cd Workflow Update

Adds or updates CI/CD workflows for deployment, typechecking, or environment config.

**Frequency**: ~1 times per month

**Steps**:
1. Edit or add workflow files in .github/workflows/ (e.g., supabase-deploy.yml, production.yml, pr-preview.yml).
2. Update supabase/config.toml or tsconfig.json if build/deploy config changes.
3. Update README.md or AGENTS.md if CI/CD process documentation needs to be changed.

**Files typically involved**:
- `.github/workflows/*.yml`
- `supabase/config.toml`
- `tsconfig.json`
- `README.md`
- `AGENTS.md`

**Example commit sequence**:
```
Edit or add workflow files in .github/workflows/ (e.g., supabase-deploy.yml, production.yml, pr-preview.yml).
Update supabase/config.toml or tsconfig.json if build/deploy config changes.
Update README.md or AGENTS.md if CI/CD process documentation needs to be changed.
```

### Documentation And Execplan Update

Updates or adds documentation and implementation plans to match new features or changes.

**Frequency**: ~2 times per month

**Steps**:
1. Edit or add markdown files in docs/plans/ for milestone or feature plans.
2. Update AGENTS.md, CLAUDE.md, or README.md for process, agent, or project documentation.
3. Optionally, update docs/SCREENS.md, docs/TECH-DISCOVERY.md, or VISION.md for broader changes.

**Files typically involved**:
- `docs/plans/*.md`
- `AGENTS.md`
- `CLAUDE.md`
- `README.md`
- `docs/SCREENS.md`
- `docs/TECH-DISCOVERY.md`
- `VISION.md`

**Example commit sequence**:
```
Edit or add markdown files in docs/plans/ for milestone or feature plans.
Update AGENTS.md, CLAUDE.md, or README.md for process, agent, or project documentation.
Optionally, update docs/SCREENS.md, docs/TECH-DISCOVERY.md, or VISION.md for broader changes.
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
