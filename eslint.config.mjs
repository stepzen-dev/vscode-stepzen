/**
 * Copyright IBM Corp. 2025
 * Assisted by CursorAI
 */

import typescriptEslint from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";

export default [{
    files: ["**/*.ts"],
}, {
    plugins: {
        "@typescript-eslint": typescriptEslint,
    },

    languageOptions: {
        parser: tsParser,
        ecmaVersion: 2022,
        sourceType: "module",
    },

    rules: {
        "@typescript-eslint/naming-convention": ["warn", {
            selector: "import",
            format: ["camelCase", "PascalCase"],
        }],

        curly: "warn",
        eqeqeq: "warn",
        "no-throw-literal": "warn",
        semi: "warn",
        "no-console": "error",
    },

    // Service layer specific rules - enforce architectural boundaries
}, {
    files: ["src/services/**/*.ts"],
    plugins: {
        "@typescript-eslint": typescriptEslint,
    },
    languageOptions: {
        parser: tsParser,
        ecmaVersion: 2022,
        sourceType: "module",
    },
    rules: {
        "no-restricted-imports": ["error", {
            "patterns": [
                "../commands/*",
                "../commands",
                "../panels/*", 
                "../panels"
            ],
            "paths": [
                {
                    "name": "../utils/codelensProvider",
                    "message": "Services must not import from utils layer (extension layer). CodeLens providers belong in the extension layer. See docs/architecture.md"
                },
                {
                    "name": "../utils/runtimeDiagnostics", 
                    "message": "Services must not import from utils layer (extension layer). Diagnostics belong in the extension layer. See docs/architecture.md"
                },
                {
                    "name": "../utils/safeRegisterCommand",
                    "message": "Services must not import from utils layer (extension layer). Command registration belongs in the extension layer. See docs/architecture.md"
                },
                {
                    "name": "../utils/stepzenProject",
                    "message": "Services must not import from utils layer (extension layer). Project utilities belong in the extension layer. See docs/architecture.md"
                }
            ]
        }],
    },

    // Types layer should be pure - no imports from other layers
}, {
    files: ["src/types/**/*.ts"],
    plugins: {
        "@typescript-eslint": typescriptEslint,
    },
    languageOptions: {
        parser: tsParser,
        ecmaVersion: 2022,
        sourceType: "module",
    },
    rules: {
        "no-restricted-imports": ["error", {
            "patterns": ["../*"]
        }],
    },
}];