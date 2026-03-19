import type { Config } from 'jest';

const config: Config = {
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
  // Global threshold reflects reality: hooks/screens are Supabase/RN coupled (untestable in Node).
  // Pure utils (formatting, navUtils, xirr) achieve ~97% lines individually.
  coverageThreshold: {
    global: { lines: 20 },
  },
  coverageReporters: ['text', 'lcov'],
};

export default config;
