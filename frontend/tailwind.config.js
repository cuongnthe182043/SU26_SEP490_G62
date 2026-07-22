const { heroui } = require("@heroui/theme");
const path = require("path");

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    path.join(__dirname, "src/pages/Accountant/**/*.{js,jsx,ts,tsx}"),
    path.join(__dirname, "src/pages/Coordinator/**/*.{js,jsx,ts,tsx}"),
    path.join(__dirname, "src/pages/Manager/**/*.{js,jsx,ts,tsx}"),
    path.join(__dirname, "src/components/**/*.{js,jsx,ts,tsx}"),
    path.join(__dirname, "src/hooks/**/*.{js,jsx,ts,tsx}"),
    path.join(__dirname, "node_modules/@heroui/theme/dist/**/*.{js,ts,jsx,tsx}"),
  ],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        sans: ["Geist", "Google Sans", "Open Sans", "system-ui", "-apple-system", "sans-serif"],
      },
    },
  },
  plugins: [
    heroui({
      themes: {
        light: {
          colors: {
            primary: { DEFAULT: "#3B4FD8", foreground: "#ffffff" },
          },
        },
        dark: {
          colors: {
            // Nền tối hơi ngả xanh cho khớp brand, chữ sáng nổi bật dễ đọc
            background: "#0e1016",
            foreground: "#e6e8ef",
            focus: "#6B7BFF",
            content1: "#161922",
            content2: "#1e2230",
            content3: "#272b3a",
            content4: "#333850",
            divider: "rgba(255,255,255,0.12)",
            default: {
              50: "#1a1d27",
              100: "#20242f",
              200: "#2a2e3c",
              300: "#363b4d",
              400: "#4a5069",
              500: "#6b7189",
              600: "#9096ac",
              700: "#b7bccc",
              800: "#d7dae4",
              900: "#eceef4",
              foreground: "#e6e8ef",
              DEFAULT: "#20242f",
            },
            primary: { DEFAULT: "#6B7BFF", foreground: "#0b1020" },
          },
        },
      },
    }),
  ],
};
