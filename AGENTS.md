# Repository Guidelines

## Project Structure & Module Organization

This is a Nuxt 2 application using Vue 2, Vuetify 2, Vuex, and Express server middleware. `pages/` defines routes; `layouts/` provides feature shells; `components/` contains UI components; `store/` holds feature-specific state and API actions. `server/<module>/` groups Express entry points (`main.js`), routers, authorization middleware, and SQL configurations.

Features include the portal, administration, business cards, Code of Conduct, surveys, and daily time reports (DTR). Register new APIs and component directories in `nuxt.config.js`. Keep styles and fonts in `assets/`, public files in `static/`, translations in `locales/`, and generated documents in ignored `uploads/`.

## Build, Test, and Development Commands

- `npm ci`: install dependencies from the lockfile.
- `npm run dev`: start development at `http://localhost:3000`. Its predev script stops an existing Nuxt process from this project on port 3000; unrelated processes cause startup to abort.
- `npm run build`: create the production build.
- `npm run start`: serve the production build; PM2 configuration is in `ecosystem.config.js`.
- `npm run lint`: run ESLint on JavaScript and Vue files.
- `npm run generate`: generate static output; backend-dependent features still require server APIs.

## Coding Style & Naming Conventions

Use two-space indentation, UTF-8, LF endings, single quotes, and no semicolons. Follow `.editorconfig`, `.prettierrc`, and `.eslintrc.js`. Use Vue Options API and existing Vuex patterns. Match neighboring feature filenames; Nuxt routes use `index.vue` and dynamic names such as `_bcard.vue`.

Use `$t(...)` and `localePath(...)`; update both English and Arabic translations. Prefer Vuetify theme keys and apply `cursor-pointer` to clickable buttons.

## Testing Guidelines

No automated test runner, test naming convention, or coverage threshold is configured. Run lint and build for code changes, then manually verify affected workflows, permissions, and English/Arabic layouts. Record results and any unavailable integrations in the PR.

## Commit & Pull Request Guidelines

History uses short, descriptive messages without enforced prefixes, such as `fix COC font size responsiveness`. Keep changes focused. PRs should explain behavior changes, link relevant issues, list validation, and include screenshots for UI changes. Agents must leave commits and pushes to the user.

## Security & Configuration

Keep `.env` credentials private and untracked. Development requires configured AD, SQL, and email integrations. Use parameterized SQL and enforce permissions server-side. The application schedules employee synchronization every ten minutes; use development services when running locally.
