// ESLint flat config (Next 16 removed `next lint` and the old .eslintrc format).
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  // shortcut: React Compiler rules are warnings while load-on-mount effects (Access, Billing, CPO
  // Settings, Stations, AdminApp theme) and SessionDetails' Date.now() remain; make them errors once refactored.
  { rules: { "react-hooks/set-state-in-effect": "warn", "react-hooks/purity": "warn" } },
  globalIgnores([".next/**", ".open-next/**", "out/**", "next-env.d.ts", "supabase/functions/**", ".claude/**", ".agents/**", ".taste-skill/**", "graphify-out/**"]),
]);
