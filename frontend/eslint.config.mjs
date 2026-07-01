import { defineConfig, globalIgnores } from "eslint/config";

import globals from "globals";
import tsParser from "@typescript-eslint/parser";

import { fixupConfigRules } from "@eslint/compat";

import pkg from "@eslint/js";

import { FlatCompat } from "@eslint/eslintrc";

import { join } from "path";

import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const { node, browser } = globals;
const { configs } = pkg;

const compat = new FlatCompat({
    baseDirectory: __dirname,
    recommendedConfig: configs.recommended,
    allConfig: configs.all
});

export default defineConfig([{
    languageOptions: {
        globals: {
            ...node,
        },

        ecmaVersion: 8,
        sourceType: "module",
        parserOptions: {},
    },

    extends: compat.extends("eslint:recommended", "plugin:prettier/recommended"),
}, globalIgnores([
    "node_modules/*",
    "**/*.js",
    "**/graphql/*.ts",
    "**/vite.config.ts",
    "**/vite-env.d.ts",
]), {
    files: ["**/*.ts", "**/*.tsx"],

    languageOptions: {
        parser: tsParser,

        parserOptions: {
            project: join(__dirname, "tsconfig.json"),
        },

        globals: {
            ...browser,
            ...node,
        },
    },

    settings: {
        react: {
            version: "detect",
        },

        "import/resolver": {
            typescript: {
                project: join(__dirname, "tsconfig.json"),
            },
        },
    },

    extends: fixupConfigRules(compat.extends(
        "eslint:recommended",
        "plugin:import/errors",
        "plugin:import/warnings",
        "plugin:import/typescript",
        "plugin:@typescript-eslint/recommended",
        "plugin:@typescript-eslint/recommended-type-checked",
        "plugin:react/recommended",
        "plugin:react-hooks/recommended",
        "plugin:jsx-a11y/recommended",
    )),

    rules: {
        "no-restricted-imports": ["error", {
            patterns: ["@/features/*/*"],
        }],

        "linebreak-style": ["error", "unix"],
        "react/prop-types": "off",

        "import/order": ["error", {
            groups: ["builtin", "external", "internal", "parent", "sibling", "index", "object"],
            "newlines-between": "always",

            pathGroups: [{
                pattern: "react",
                group: "builtin",
                position: "before",
            }],

            alphabetize: {
                order: "asc",
                caseInsensitive: true,
            },

            pathGroupsExcludedImportTypes: ["builtin", "object"],
        }],

        "import/no-unresolved": ["error", { ignore: ["^virtual:"] }],
        "import/default": "off",
        "import/no-named-as-default-member": "off",
        "import/no-named-as-default": "off",
        "react/react-in-jsx-scope": "off",
        "react/self-closing-comp": "error",
        "jsx-a11y/anchor-is-valid": "off",
        "jsx-a11y/media-has-caption": "off",

        "jsx-a11y/no-autofocus": [2, {
            ignoreNonDOM: true,
        }],

        "@typescript-eslint/no-unused-vars": ["error", {
            argsIgnorePattern: "^_",
            varsIgnorePattern: "^_",
            caughtErrorsIgnorePattern: "^_",
            destructuredArrayIgnorePattern: "^_",
        }],

        "@typescript-eslint/explicit-function-return-type": "off",
        "@typescript-eslint/explicit-module-boundary-types": "off",
        "@typescript-eslint/no-empty-function": "off",
        "@typescript-eslint/no-explicit-any": "off",
        "@typescript-eslint/no-unsafe-call": "off",
        "@typescript-eslint/no-unsafe-member-access": "off",
        "@typescript-eslint/no-unsafe-argument": "off",
        "@typescript-eslint/no-floating-promises": "off",

        "@typescript-eslint/consistent-type-imports": ["error", {
            prefer: "type-imports",
            fixStyle: "inline-type-imports",
        }],

        "@typescript-eslint/no-misused-promises": "off",

        "@typescript-eslint/restrict-plus-operands": ["error", {
            allowAny: false,
            allowBoolean: false,
            allowNullish: false,
            allowNumberAndString: false,
            allowRegExp: false,
        }],

        "prefer-template": "error",

        "no-console": ["warn", {
            allow: ["warn", "error"],
        }],

        "object-shorthand": ["error", "always"],
        "@typescript-eslint/no-unsafe-enum-comparison": "off",
    },
}]);
