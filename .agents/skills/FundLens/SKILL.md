```markdown
# FundLens Development Patterns

> Auto-generated skill from repository analysis

## Overview
This skill documents the core development patterns, coding conventions, and workflows used in the FundLens TypeScript codebase. FundLens is a TypeScript project without a detected framework, focused on financial simulation and fund analysis. The repository emphasizes clear commit practices, modular code organization, and rapid, iterative feature development with a focus on UI quality.

## Coding Conventions

- **File Naming:**  
  Use camelCase for file names.  
  _Example:_  
  ```
  simulatorCalc.ts
  fundDetails.tsx
  ```

- **Import Style:**  
  Use alias imports for modules.  
  _Example:_  
  ```typescript
  import { calculateReturns } from 'src/utils/simulatorCalc';
  ```

- **Export Style:**  
  Mixed usage of named and default exports.  
  _Examples:_  
  ```typescript
  // Named export
  export function calculateReturns(...) { ... }

  // Default export
  export default SimulatorScreen;
  ```

- **Commit Messages:**  
  Follow [Conventional Commits](https://www.conventionalcommits.org/) with prefixes like `fix`, `docs`, `feat`.  
  _Example:_  
  ```
  feat: add fund simulator screen and core calculation logic
  fix: correct calculation rounding in simulator results
  docs: update simulator usage instructions
  ```

## Workflows

### Feature Enhancement with Iterative Fixes
**Trigger:** When shipping a new feature or screen, followed by rapid usability, logic, or UI improvements based on testing or feedback.  
**Command:** `/ship-feature-with-rapid-fix-cycle`

1. Implement the new feature or screen, including core logic and associated tests.
2. Commit the initial implementation (often touching a main screen file and related utility/test files).
3. Make a series of focused `fix` commits to the same main file(s), each addressing a specific UX, logic, or UI issue.
4. Each fix commit typically changes only the main screen file or closely related files.

_Files commonly involved:_
- `app/(tabs)/simulator.tsx`
- `src/utils/simulatorCalc.ts`
- `src/utils/__tests__/simulatorCalc.test.ts`

_Example commit sequence:_
```
feat: add simulator screen and calculation utilities
fix: correct interest rate calculation in simulator
fix: improve simulator input validation UX
```

### Single-File UI Bugfix
**Trigger:** When a specific UI bug or visual glitch needs to be quickly resolved in a screen/component.  
**Command:** `/fix-ui-bug`

1. Identify the UI bug or visual issue.
2. Make targeted changes to the affected screen/component file.
3. Commit with a descriptive message referencing the bug and affected UI element.

_Files commonly involved:_
- `app/fund/[id].tsx`
- `app/(tabs)/simulator.tsx`

_Example commit:_
```
fix: resolve overflow issue in fund details header
```

## Testing Patterns

- **Test File Naming:**  
  Test files follow the `*.test.*` pattern and are colocated with utilities or features.  
  _Example:_  
  ```
  src/utils/__tests__/simulatorCalc.test.ts
  ```

- **Testing Framework:**  
  The specific testing framework is not detected, but tests are written in TypeScript and likely use common assertion libraries.

- **Test Example:**  
  ```typescript
  import { calculateReturns } from '../simulatorCalc';

  test('calculates returns correctly for simple input', () => {
    expect(calculateReturns(1000, 0.05, 1)).toBeCloseTo(1050);
  });
  ```

## Commands

| Command                              | Purpose                                                      |
|---------------------------------------|--------------------------------------------------------------|
| /ship-feature-with-rapid-fix-cycle    | Start a new feature and iterate with rapid, focused fixes    |
| /fix-ui-bug                          | Quickly resolve a specific UI bug in a single file           |
```
