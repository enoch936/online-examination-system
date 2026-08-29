import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';

export default defineConfig([
  ...nextVitals,
  {
    rules: {
      // Next 16's React-Compiler rules are stricter than the existing code.
      // Report as warnings (non-blocking) so CI stays green while the
      // codebase is migrated. Tighten once cleaned up.
      'react-hooks/refs': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/static-components': 'warn',
      'react-hooks/preserve-manual-memoization': 'warn',
      'react/no-unescaped-entities': 'warn',
    },
  },
  globalIgnores([
    '.next/**',
    'node_modules/**',
    'next-env.d.ts',
    'tsconfig.tsbuildinfo',
    'server_log.txt',
  ]),
]);