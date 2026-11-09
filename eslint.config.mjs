import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier/flat";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  prettier,
  {
    // lib/engine is pure: it runs in the browser and on the server, so no DB, network or UI imports.
    files: ["lib/engine/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "@/db",
                "@/db/*",
                "@/app/*",
                "@/components/*",
                "next",
                "next/*",
                "react",
                "react-dom",
                "react-dom/*",
                "drizzle-orm",
                "drizzle-orm/*",
                "postgres",
                "three",
                "@react-three/*",
              ],
              message: "lib/engine must stay free of database, network and UI imports.",
            },
          ],
        },
      ],
    },
  },
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts", "db/migrations/**"]),
]);

export default eslintConfig;
