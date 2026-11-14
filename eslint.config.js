import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

export default tseslint.config(
  { ignores: ['dist/', 'coverage/', 'node_modules/'] },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  {
    languageOptions: {
      globals: globals.node,
      parserOptions: {
        projectService: {
          allowDefaultProject: [
            '*.js',
            '*.cjs',
            'vitest.config.ts',
            'vitest.e2e.config.ts',
            'stryker.config.mjs',
          ],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      'no-console': ['error', { allow: ['info', 'warn', 'error'] }],
      eqeqeq: ['error', 'always'],
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/explicit-function-return-type': ['error', { allowExpressions: true }],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['**/*.js', '**/*.cjs', '**/*.mjs'],
    ...tseslint.configs.disableTypeChecked,
  },
  prettier,
);
