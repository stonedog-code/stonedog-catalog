import js from "@eslint/js";
import globals from "globals";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";

/**
 * Flat config, migrated from `.eslintrc.cjs`.
 *
 * eslint 9 deprecated eslintrc and eslint 10 removes it, so this had to happen
 * either way. Nothing here depends on `eslint-plugin-react`, which is what
 * pins several sibling repos to eslint 9, so this one goes to 10.
 *
 * Two translations are not one-to-one and are worth naming:
 *
 *   - `env: { node, es2024, jest }` has no flat equivalent. The `globals`
 *     package carries the same sets; `jest` is scoped to the test files rather
 *     than declared globally, so a `describe` cannot quietly appear in
 *     production code.
 *   - `ignorePatterns: ["*.cjs"]` becomes `**\/*.cjs`. Flat config matches
 *     ignore entries against the path from the config file's directory, so a
 *     bare `*.cjs` would only ignore the root ones. The old lint script also
 *     passed `--ext ts`, which flat config drops -- so without this the file
 *     set silently widens to take in every `.cjs` in the tree.
 */
export default [
  {
    ignores: ["dist/**", "node_modules/**", "coverage/**", "**/*.cjs"],
  },
  js.configs.recommended,
  {
    files: ["**/*.ts"],
    languageOptions: {
      parser: tsParser,
      parserOptions: { ecmaVersion: "latest", sourceType: "module" },
      globals: { ...globals.node },
    },
    plugins: { "@typescript-eslint": tsPlugin },
    rules: {
      // typescript-eslint's own list of the core rules the compiler already
      // enforces better -- `no-undef` and `no-redeclare` among them. Both are
      // wrong rather than merely noisy on TypeScript: `no-undef` cannot see a
      // type-only reference, and `no-redeclare` reads overload signatures as
      // duplicates.
      ...tsPlugin.configs["flat/eslint-recommended"].rules,
      ...tsPlugin.configs.recommended.rules,
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    },
  },
  {
    files: ["**/*.test.ts", "**/__tests__/**/*.ts"],
    languageOptions: { globals: { ...globals.jest } },
  },
];
