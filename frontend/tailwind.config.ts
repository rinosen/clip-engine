import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#090a0f",
        surface: "#12141c",
        "surface-light": "#1b1f2e",
        accent: {
          DEFAULT: "#6366f1",
          hover: "#4f46e5",
          light: "#818cf8",
        },
        viral: {
          green: "#10b981",
          gold: "#f59e0b",
          red: "#ef4444",
        }
      },
    },
  },
  plugins: [],
};
export default config;

