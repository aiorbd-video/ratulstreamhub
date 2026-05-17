
import nextVitals from "eslint-config-next/core-web-vitals.js";
import nextTs from "eslint-config-next/typescript.js";

/** @type {import('eslint').Linter.FlatConfig[]} */
const eslintConfig = [
  nextVitals,
  nextTs,
  {
    ignores: [
      // Default ignores of eslint-config-next:
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
    ]
  }
];

export default eslintConfig;
