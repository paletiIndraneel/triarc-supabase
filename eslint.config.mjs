// ESLint flat config (Next 16 removed `next lint` and the old .eslintrc format).
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([".next/**", ".open-next/**", "out/**", "next-env.d.ts", "supabase/functions/**", ".claude/**", ".agents/**", ".remember/**", ".taste-skill/**", "graphify-out/**"]),
]);
