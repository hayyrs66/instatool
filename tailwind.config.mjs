/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}"],
  theme: {
    extend: {
      fontSize: {
        clamp_hero: "clamp(1.875rem, 0.536rem + 3.571vw, 3.75rem)",
        clamp_p_hero: "clamp(1rem, 0.643rem + 0.952vw, 1.5rem)",
      },
    },
  },
  plugins: [],
};
