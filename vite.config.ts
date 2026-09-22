import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react()],
  resolve: {
    alias: [
      // `npm run dev:ui` troca o cliente Supabase por um simulado, para trabalhar
      // na interface sem banco e sem login. Não afeta dev nem build normais.
      ...(mode === "ui-mock"
        ? [{
            find: /^@\/integrations\/supabase\/client$/,
            replacement: path.resolve(__dirname, "./src/dev/mockSupabase.ts"),
          }]
        : []),
      { find: "@", replacement: path.resolve(__dirname, "./src") },
    ],
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
  },
}));
