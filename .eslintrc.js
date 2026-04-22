module.exports = {
  env: {
    es2021: true,
    node: true,
  },
  extends: ["eslint:recommended", "airbnb-base", "prettier"],
  overrides: [
    {
      env: {
        node: true,
      },
      files: [".eslintrc.{js,cjs}"],
      parserOptions: {
        sourceType: "script",
      },
    },
  ],
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "module",
  },
  rules: {
    "no-unused-vars": ["error", { argsIgnorePattern: "next" }],
    "consistent-return": "off",
    "no-underscore-dangle": [
      "error",
      {
        allow: ["_id"],
        allowAfterThis: true,
      },
    ],
    "import/no-unresolved": [2, { ignore: ["mailgun.js"] }],
  },
};
