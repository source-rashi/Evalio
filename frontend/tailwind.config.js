/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}", "./public/index.html"],
  theme: {
    extend: {
      colors: {
        primary: "#4F46E5",
        secondary: "#22C55E",
        accent: "#F59E0B",
        bg: "#F9FAFB",
        text: {
          primary: "#1F2937",
          secondary: "#6B7280",
        },
      },
      fontFamily: {
        heading: ["Inter", "Poppins", "system-ui", "sans-serif"],
        body: ["Inter", "Roboto", "system-ui", "sans-serif"],
      },
      borderRadius: {
        xl: "14px",
      },
    },
  },
  plugins: [],
};
