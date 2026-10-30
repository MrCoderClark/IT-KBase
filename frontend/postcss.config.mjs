/** Webpack production builds (`next build --webpack`) need PostCSS.
 *  `next dev` uses Turbopack + `@tailwindcss/turbopack` instead.
 */
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};

export default config;
