// @ts-check
import tseslint from "typescript-eslint";
import eslintPluginReactHooks from "eslint-plugin-react-hooks";
import eslintConfigPrettier from "eslint-config-prettier";

export default tseslint.config(
  {
    ignores: ["dist/**", "node_modules/**", "coverage/**"],
  },
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    plugins: {
      "react-hooks": eslintPluginReactHooks,
    },
    rules: {
      "prefer-const": "error",
      eqeqeq: ["error", "always"],
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-explicit-any": "error",
      ...eslintPluginReactHooks.configs["recommended-latest"].rules,
    },
  },
  eslintConfigPrettier,
);
