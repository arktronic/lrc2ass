// @ts-check
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import { defineConfig } from 'eslint/config';
import prettier from 'eslint-config-prettier';

export default defineConfig(
  {
    ignores: ['**/dist/**', '**/node_modules/**', '**/coverage/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  {
    // Keep the library core free of Node.js APIs; only the CLI may use them.
    files: ['packages/lrc2ass/src/**/*.ts'],
    ignores: ['packages/lrc2ass/src/cli.ts', 'packages/lrc2ass/src/bin.ts'],
    rules: {
      'no-restricted-globals': ['error', 'process', 'Buffer', '__dirname', '__filename', 'require', 'global'],
      'no-restricted-imports': ['error', { patterns: ['node:*'] }],
    },
  },
  prettier,
);
