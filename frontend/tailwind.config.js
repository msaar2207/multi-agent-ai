/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: [
    "./pages/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        quran: ['"Scheherazade New"', "serif"],
      },
      typography: ({ theme }) => ({
        tight: {
          css: {
            p: { marginTop: "0.25rem", marginBottom: "0.25rem" },
            li: {
              marginTop: "0.1rem !important",
              marginBottom: "0.1rem !important",
            },
            ul: {
              marginTop: "0.25rem !important",
              marginBottom: "0.25rem !important",
              paddingLeft: "1rem",
            },
            ol: {
              marginTop: "0.25rem !important",
              marginBottom: "0.25rem !important",
              paddingLeft: "1rem",
            },
            h1: { marginTop: "0.5rem", marginBottom: "0.5rem" },
            h2: { marginTop: "0.5rem", marginBottom: "0.5rem" },
            h3: { marginTop: "0.5rem", marginBottom: "0.5rem" },
          },
        },
      }),
    },
  },
  plugins: [
    require("@tailwindcss/typography"),
    require("tailwind-scrollbar-hide"),
    require("tailwindcss-animate")
  ],
};
