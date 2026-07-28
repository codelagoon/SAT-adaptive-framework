import type { Config } from "tailwindcss";
export default { darkMode: "class", content: ["./src/**/*.{ts,tsx}"], theme: { extend: { colors: { ink: "var(--ink)", paper: "var(--paper)", muted: "var(--muted)", accent: "var(--accent)", line: "var(--line)" } } }, plugins: [] } satisfies Config;
