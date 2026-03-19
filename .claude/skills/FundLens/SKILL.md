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

Follow these commit message conventions based on 39 analyzed commits.

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

**Frequency**: ~5 times per month

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

Implements a major feature or milestone, including UI, hooks, and supporting documentation.

**Frequency**: ~2 times per month

**Steps**:
1. Implement or update UI screens in app/(tabs)/*.tsx or app/fund/[id].tsx or app/onboarding/*.tsx
2. Add or update supporting React hooks in src/hooks/*.ts
3. Add or update utility functions in src/utils/*.ts
4. Write or update milestone plan/ExecPlan in docs/plans/0X-*.md
5. Update README.md or AGENTS.md if process or features change
6. Update or create database migrations in supabase/migrations/*.sql if schema changes are needed

**Files typically involved**:
- `app/(tabs)/index.tsx`
- `app/(tabs)/compare.tsx`
- `app/(tabs)/settings.tsx`
- `app/fund/[id].tsx`
- `app/onboarding/index.tsx`
- `app/onboarding/pdf.tsx`
- `src/hooks/usePortfolio.ts`
- `src/hooks/useFundDetail.ts`
- `src/hooks/useCompare.ts`
- `src/hooks/useInboundSession.ts`
- `src/utils/xirr.ts`
- `src/utils/formatting.ts`
- `docs/plans/0*-*.md`
- `README.md`
- `AGENTS.md`
- `supabase/migrations/*.sql`

**Example commit sequence**:
```
Implement or update UI screens in app/(tabs)/*.tsx or app/fund/[id].tsx or app/onboarding/*.tsx
Add or update supporting React hooks in src/hooks/*.ts
Add or update utility functions in src/utils/*.ts
Write or update milestone plan/ExecPlan in docs/plans/0X-*.md
Update README.md or AGENTS.md if process or features change
Update or create database migrations in supabase/migrations/*.sql if schema changes are needed
```

### Database Schema Change And Migration

Adds or modifies database tables, columns, or indexes, with matching migration scripts and type updates.

**Frequency**: ~2 times per month

**Steps**:
1. Create or edit SQL migration in supabase/migrations/*.sql
2. Update supabase/config.toml if function schedules or config are affected
3. Regenerate src/types/database.types.ts if schema changes
4. Update related edge functions or data-fetching hooks if needed

**Files typically involved**:
- `supabase/migrations/*.sql`
- `supabase/config.toml`
- `src/types/database.types.ts`
- `supabase/functions/*/index.ts`

**Example commit sequence**:
```
Create or edit SQL migration in supabase/migrations/*.sql
Update supabase/config.toml if function schedules or config are affected
Regenerate src/types/database.types.ts if schema changes
Update related edge functions or data-fetching hooks if needed
```

### Edge Function Development Or Update

Implements or updates a Supabase Edge Function, including shared helpers, CORS/auth, and logging.

**Frequency**: ~2 times per month

**Steps**:
1. Create or update function in supabase/functions/<function-name>/index.ts
2. Update or add shared helpers in supabase/functions/_shared/*.ts (e.g., auth, cors, supabase-client)
3. Update or add logging as needed
4. Update supabase/config.toml or supabase/functions/deno.json if config changes
5. Update or add related docs in docs/plans/0*-*.md

**Files typically involved**:
- `supabase/functions/*/index.ts`
- `supabase/functions/_shared/*.ts`
- `supabase/config.toml`
- `supabase/functions/deno.json`
- `docs/plans/0*-*.md`

**Example commit sequence**:
```
Create or update function in supabase/functions/<function-name>/index.ts
Update or add shared helpers in supabase/functions/_shared/*.ts (e.g., auth, cors, supabase-client)
Update or add logging as needed
Update supabase/config.toml or supabase/functions/deno.json if config changes
Update or add related docs in docs/plans/0*-*.md
```

### Ci Cd Workflow Update

Updates CI/CD workflows for deployment, typechecking, linting, or scheduling.

**Frequency**: ~2 times per month

**Steps**:
1. Edit or add workflow YAML in .github/workflows/*.yml
2. Update supabase/config.toml or tsconfig.json for compatibility
3. Update documentation if process changes

**Files typically involved**:
- `.github/workflows/*.yml`
- `supabase/config.toml`
- `tsconfig.json`
- `README.md`

**Example commit sequence**:
```
Edit or add workflow YAML in .github/workflows/*.yml
Update supabase/config.toml or tsconfig.json for compatibility
Update documentation if process changes
```

### Documentation And Execplan Update

Adds or updates documentation, milestone plans, and process docs to match implementation.

**Frequency**: ~3 times per month

**Steps**:
1. Edit or add docs/plans/0*-*.md for milestone planning
2. Update README.md, AGENTS.md, CLAUDE.md, or docs/SCREENS.md as needed
3. Update docs/TECH-DISCOVERY.md or docs/process/PLANS.md for process or discovery changes

**Files typically involved**:
- `docs/plans/0*-*.md`
- `README.md`
- `AGENTS.md`
- `CLAUDE.md`
- `docs/SCREENS.md`
- `docs/TECH-DISCOVERY.md`
- `docs/process/PLANS.md`

**Example commit sequence**:
```
Edit or add docs/plans/0*-*.md for milestone planning
Update README.md, AGENTS.md, CLAUDE.md, or docs/SCREENS.md as needed
Update docs/TECH-DISCOVERY.md or docs/process/PLANS.md for process or discovery changes
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
