import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { FlatCompat } from '@eslint/eslintrc';
import pkg from '@eslint/js';
import typescriptEslintEslintPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import { defineConfig, globalIgnores } from 'eslint/config';
import importPlugin from 'eslint-plugin-import';
import globals from 'globals';

const __dirname = dirname(fileURLToPath(import.meta.url));

const { configs } = pkg;
const { node, jest } = globals;

const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: configs.recommended,
  allConfig: configs.all,
});

export default defineConfig([
  {
    languageOptions: {
      parser: tsParser,
      sourceType: 'module',

      parserOptions: {
        project: 'tsconfig.json',
        tsconfigRootDir: __dirname,
      },

      globals: {
        ...node,
        ...jest,
      },
    },

    plugins: {
      '@typescript-eslint': typescriptEslintEslintPlugin,
      import: importPlugin,
    },

    extends: compat.extends('plugin:@typescript-eslint/recommended', 'plugin:prettier/recommended'),

    settings: {
      'import/resolver': {
        typescript: {
          alwaysTryTypes: true,
          project: './tsconfig.json',
        },
        node: true,
      },
    },

    rules: {
      '@typescript-eslint/interface-name-prefix': 'off',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],

      // Import ordering rules
      'import/order': [
        'error',
        {
          groups: [
            'builtin', // Node.js built-in modules
            'external', // External packages
            'internal', // Internal modules (using path aliases)
            'parent', // Parent imports
            'sibling', // Sibling imports
            'index', // Index imports
            'type', // Type imports
          ],
          pathGroups: [
            {
              pattern: '@nestjs/**',
              group: 'external',
              position: 'before',
            },
            {
              pattern: '@/**',
              group: 'internal',
            },
            {
              pattern: '@@/**',
              group: 'internal',
            },
          ],
          pathGroupsExcludedImportTypes: ['builtin'],
          'newlines-between': 'always',
          alphabetize: {
            order: 'asc',
            caseInsensitive: true,
          },
        },
      ],

      // Enforce absolute imports using @/ path alias
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['../**/common/*', '../../common/*', '../common/*'],
              message:
                'Please use absolute imports with @/ path alias (e.g., use @/common/... instead of ../common/...)',
            },
            {
              group: ['../**/modules/*', '../../modules/*', '../modules/*'],
              message:
                'Please use absolute imports with @/ path alias (e.g., use @/modules/... instead of ../modules/...)',
            },
            {
              group: ['../**/drizzle/*', '../../drizzle/*', '../drizzle/*'],
              message:
                'Please use absolute imports with @/ path alias (e.g., use @/drizzle/... instead of ../drizzle/...)',
            },
          ],
        },
      ],

      // Ensure consistent import style
      'import/no-duplicates': 'error',
      'import/first': 'error',
      'import/newline-after-import': 'error',
      'import/no-useless-path-segments': [
        'error',
        {
          noUselessIndex: true,
        },
      ],
    },
  },
  globalIgnores(['**/.eslintrc.js', '**/drizzle/**']),
]);
