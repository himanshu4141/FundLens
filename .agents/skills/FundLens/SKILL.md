```markdown
# FundLens Development Patterns

> Auto-generated skill from repository analysis

## Overview

This skill teaches the core development patterns and workflows used in the FundLens TypeScript codebase. FundLens is a modular application with a focus on maintainable feature development, robust documentation, and theme extensibility. The repository emphasizes clear commit conventions, organized file structures, and a workflow-driven approach to implementing features and extending UI capabilities.

## Coding Conventions

- **Language:** TypeScript
- **Framework:** None detected (custom structure)
- **File Naming:** camelCase for files and folders  
  _Example:_  
  ```
  src/utils/calculateYield.ts
  app/fundDetails.tsx
  ```
- **Import Style:** Uses alias imports for clarity  
  _Example:_  
  ```typescript
  import { calculateYield } from '@utils/calculateYield';
  ```
- **Export Style:** Mixed (both default and named exports)  
  _Example:_  
  ```typescript
  // Named export
  export function calculateYield(...) { ... }

  // Default export
  export default FundDetailsScreen;
  ```
- **Commit Messages:** Conventional commits with prefixes: `feat`, `docs`, `fix`  
  _Example:_  
  ```
  feat: add simulator screen for fund projections
  docs: add execution plan for phase-2 features
  fix: correct theme context usage in fund details
  ```

## Workflows

### Implement Feature with Design Doc and Tests
**Trigger:** When adding a significant new feature (e.g., screen, simulator, toggle) with supporting documentation and robust testing  
**Command:** `/new-feature-with-docs-and-tests`

1. **Add a design or exec plan:**  
   Create a markdown file describing the feature under `docs/plans/phase-*/`.  
   _Example:_  
   ```
   docs/plans/phase-2/simulator-screen.md
   ```
2. **Implement the feature:**  
   Add or update code in `app/` (for screens/components) and `src/` (for utilities).  
   _Example:_  
   ```
   app/tabs/SimulatorScreen.tsx
   src/utils/simulateReturns.ts
   ```
3. **Write unit tests:**  
   Add or update tests in `src/utils/__tests__/`.  
   _Example:_  
   ```
   src/utils/__tests__/simulateReturns.test.ts
   ```
4. **Iterate and enhance:**  
   Make additional commits to fix bugs or improve the feature, often updating the same set of files.

---

### Theme Support Extension
**Trigger:** When making a screen or component responsive to theme toggles (e.g., light/dark mode)  
**Command:** `/extend-theme-support`

1. **Refactor to use theme context:**  
   Replace direct color imports with the `useTheme()` hook in the target screen/component.  
   _Example:_  
   ```typescript
   // Before
   import { colors } from '@styles/colors';
   ...
   style={{ backgroundColor: colors.primary }}

   // After
   import { useTheme } from '@theme/context';
   ...
   const { colors } = useTheme();
   style={{ backgroundColor: colors.primary }}
   ```
2. **Update styles for dynamic theming:**  
   Convert static `StyleSheet.create` usage to factories that generate styles from the theme context.  
   _Example:_  
   ```typescript
   // Before
   const styles = StyleSheet.create({
     container: { backgroundColor: '#fff' }
   });

   // After
   const useStyles = (theme) => ({
     container: { backgroundColor: theme.colors.background }
   });
   ```
3. **Test theme responsiveness:**  
   Ensure the component updates correctly when the theme changes (e.g., toggling between light and dark modes).

---

## Testing Patterns

- **Framework:** Unknown (likely Jest or similar, based on file patterns)
- **Test File Pattern:** Files end with `.test.ts` and are located in `src/utils/__tests__/`
- **Typical Test Example:**  
  ```typescript
  // src/utils/__tests__/calculateYield.test.ts
  import { calculateYield } from '../calculateYield';

  describe('calculateYield', () => {
    it('returns correct yield for valid input', () => {
      expect(calculateYield(1000, 0.05)).toBe(1050);
    });
  });
  ```

## Commands

| Command                        | Purpose                                                    |
|---------------------------------|------------------------------------------------------------|
| /new-feature-with-docs-and-tests| Start a new feature with design doc, implementation, tests |
| /extend-theme-support           | Refactor a component/screen for theme responsiveness       |
```
