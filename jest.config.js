/** @type {import('jest').Config} */
const config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/src/utils/**/*.test.ts', '<rootDir>/src/hooks/**/*.test.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: { strict: true } }],
  },
  // Collect coverage from all src files so untested files show as 0%
  collectCoverageFrom: [
    'src/**/*.ts',            // .ts only — .tsx files contain JSX that breaks Node instrumenter
    '!src/**/*.test.ts',
    '!src/types/**',          // pure type declarations — nothing executable to cover
    '!src/lib/supabase.ts',   // React Native + Supabase bootstrap — not runnable in Node
    '!src/lib/queryClient.ts',// trivial config object
  ],
  coverageThreshold: {
    global: { lines: 70, statements: 70, branches: 60, functions: 55 },
    // Pure utils (no RN/Supabase deps) must stay near full coverage
    './src/utils/': { lines: 95, statements: 95, branches: 85, functions: 100 },
  },
  coverageReporters: ['text', 'lcov'],
};

module.exports = config;
