export default [
  {
    ignores: [
      "node_modules/**",
      "dist/**",
      "docs/**",
      "*.js",
      "tests/**",
      ".agents/**",
    ],
  },
  {
    files: ["apps/desktop/**/*.cjs", "apps/desktop/renderer/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      globals: Object.fromEntries(
        [
          "require",
          "module",
          "exports",
          "__dirname",
          "process",
          "Buffer",
          "console",
          "setTimeout",
          "clearTimeout",
          "setInterval",
          "clearInterval",
          "URL",
          "Response",
          "structuredClone",
          "document",
          "window",
          "localStorage",
          "location",
          "crypto",
          "FormData",
          "confirm",
          "getComputedStyle",
        ].map((name) => [name, "readonly"]),
      ),
    },
    rules: {
      "no-undef": "error",
      "no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", caughtErrors: "none" },
      ],
      "no-unreachable": "error",
      "no-constant-condition": "error",
      eqeqeq: "error",
    },
  },
];
