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

Follow these commit message conventions based on 14 analyzed commits.

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
fix: fund card P&L display, chart usability, back nav, benchmark sync, magic link (#13)
```

*Commit message example*

```text
ci: add workflow_dispatch to supabase-deploy workflow (#12)
```

*Commit message example*

```text
feat: milestone 8 — UX polish, brand identity, and feature roadmap (#11)
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
fix(ci): remove schedule keys from config.toml
```

*Commit message example*

```text
feat: milestone 8 — benchmark selector, realized gains, compare redesign, chart crosshair (#10)
```

*Commit message example*

```text
feat: milestone 7 — settings profile, smart import, daily sync cron (#8)
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

**Frequency**: ~11 times per month

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

**Frequency**: ~24 times per month

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

**Frequency**: ~9 times per month

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

Implements a major feature or milestone, including UI, hooks, backend logic, and documentation.

**Frequency**: ~2 times per month

**Steps**:
1. Create or update UI screen files in app/(tabs) or app/fund or app/onboarding.
2. Implement or update supporting hooks in src/hooks/.
3. Update or add supporting utility files in src/utils/.
4. Update or add backend logic (e.g., Supabase Edge Functions) in supabase/functions/.
5. Add or update database migrations in supabase/migrations/ if schema/data changes are needed.
6. Update or add documentation in docs/plans/ and/or README.md.

**Files typically involved**:
- `app/(tabs)/*.tsx`
- `app/fund/[id].tsx`
- `app/onboarding/*.tsx`
- `src/hooks/*.ts`
- `src/utils/*.ts`
- `supabase/functions/**/*.ts`
- `supabase/migrations/*.sql`
- `docs/plans/*.md`
- `README.md`

**Example commit sequence**:
```
Create or update UI screen files in app/(tabs) or app/fund or app/onboarding.
Implement or update supporting hooks in src/hooks/.
Update or add supporting utility files in src/utils/.
Update or add backend logic (e.g., Supabase Edge Functions) in supabase/functions/.
Add or update database migrations in supabase/migrations/ if schema/data changes are needed.
Update or add documentation in docs/plans/ and/or README.md.
```

### Edge Function Development And Integration

Adds or updates Supabase Edge Functions, often with supporting migrations, shared helpers, and CORS/auth fixes.

**Frequency**: ~2 times per month

**Steps**:
1. Create or update Edge Function(s) in supabase/functions/.
2. Add or update shared helpers (e.g., _shared/auth.ts, _shared/cors.ts).
3. Update or add database migrations in supabase/migrations/ if new tables/columns are needed.
4. Update types in src/types/database.types.ts if schema changes.
5. Update frontend hooks or flows to call/integrate the new function(s).

**Files typically involved**:
- `supabase/functions/**/*.ts`
- `supabase/functions/_shared/*.ts`
- `supabase/migrations/*.sql`
- `src/types/database.types.ts`
- `src/hooks/*.ts`

**Example commit sequence**:
```
Create or update Edge Function(s) in supabase/functions/.
Add or update shared helpers (e.g., _shared/auth.ts, _shared/cors.ts).
Update or add database migrations in supabase/migrations/ if new tables/columns are needed.
Update types in src/types/database.types.ts if schema changes.
Update frontend hooks or flows to call/integrate the new function(s).
```

### Database Migration And Seeding

Adds or modifies database schema or seeds data, often in support of new features or backend logic.

**Frequency**: ~2 times per month

**Steps**:
1. Create new migration file(s) in supabase/migrations/.
2. Update or add seed data in migration SQL files.
3. Update types in src/types/database.types.ts if schema changes.
4. Update backend logic or Edge Functions to use new schema/data.

**Files typically involved**:
- `supabase/migrations/*.sql`
- `src/types/database.types.ts`
- `supabase/functions/**/*.ts`

**Example commit sequence**:
```
Create new migration file(s) in supabase/migrations/.
Update or add seed data in migration SQL files.
Update types in src/types/database.types.ts if schema changes.
Update backend logic or Edge Functions to use new schema/data.
```

### Ci Cd Pipeline And Config Update

Updates CI/CD workflows, deployment scripts, or Supabase config to support new automation or fix compatibility.

**Frequency**: ~1 times per month

**Steps**:
1. Update or add GitHub Actions workflow files in .github/workflows/.
2. Update supabase/config.toml or other deployment config files.
3. Update tsconfig.json or other project-level config files as needed.

**Files typically involved**:
- `.github/workflows/*.yml`
- `supabase/config.toml`
- `tsconfig.json`

**Example commit sequence**:
```
Update or add GitHub Actions workflow files in .github/workflows/.
Update supabase/config.toml or other deployment config files.
Update tsconfig.json or other project-level config files as needed.
```

### Documentation And Execplan Update

Adds or updates documentation and implementation plans to match new features, flows, or decisions.

**Frequency**: ~2 times per month

**Steps**:
1. Update or add markdown files in docs/plans/.
2. Update README.md or other top-level documentation.
3. Update AGENTS.md, CLAUDE.md, or VISION.md if process or vision changes.

**Files typically involved**:
- `docs/plans/*.md`
- `README.md`
- `AGENTS.md`
- `CLAUDE.md`
- `VISION.md`

**Example commit sequence**:
```
Update or add markdown files in docs/plans/.
Update README.md or other top-level documentation.
Update AGENTS.md, CLAUDE.md, or VISION.md if process or vision changes.
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
