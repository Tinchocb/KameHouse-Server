import js from "@eslint/js"
import reactPlugin from "eslint-plugin-react"
import reactHooksPlugin from "eslint-plugin-react-hooks"
import jsxA11y from "eslint-plugin-jsx-a11y"
import tsPlugin from "@typescript-eslint/eslint-plugin"
import tsParser from "@typescript-eslint/parser"

export default [
    js.configs.recommended,
    {
        files: ["src/**/*.{ts,tsx}"],
        plugins: {
            react: reactPlugin,
            "react-hooks": reactHooksPlugin,
            "jsx-a11y": jsxA11y,
            "@typescript-eslint": tsPlugin,
        },
        languageOptions: {
            parser: tsParser,
            parserOptions: {
                ecmaVersion: "latest",
                sourceType: "module",
                ecmaFeatures: { jsx: true },
            },
        },
        rules: {
            // React
            ...reactPlugin.configs.recommended.rules,
            "react/react-in-jsx-scope": "off", // Not needed with React 17+
            "react/prop-types": "off",          // TypeScript handles this

            // React Hooks
            ...reactHooksPlugin.configs.recommended.rules,

            // Accessibility — enforce ARIA on interactive UI elements
            "jsx-a11y/alt-text": "warn",
            "jsx-a11y/aria-label-has-associated-control": "warn",
            "jsx-a11y/interactive-supports-focus": "warn",
            "jsx-a11y/click-events-have-key-events": "warn",
            "jsx-a11y/no-static-element-interactions": "warn",

            // TypeScript
            "@typescript-eslint/no-explicit-any": "warn",
            "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
        },
        settings: {
            react: { version: "detect" },
        },
    },
    {
        ignores: [
            "out/**",
            "node_modules/**",
            "src/api/generated/**",
            "src/routeTree.gen.ts",
            ".storybook/**",
        ],
    },
]
