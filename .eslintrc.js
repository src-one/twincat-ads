module.exports = {
    "env": {
        "node": true
    },
    "extends": "eslint:recommended",
    "parserOptions": {
        "ecmaVersion": 6
    },
    "rules": {
        "indent": ["error", 4, { "SwitchCase": 1 }],
        "quotes": ["error", "double"],
        "linebreak-style": [
            "error",
            "unix"
        ],
        "quotes": [
            "error",
            "single"
        ],
        "sort-imports": "error",
        "spaced-comment": "error",
        "unicode-bom": [
            "error",
            "never"
        ],
    }
};