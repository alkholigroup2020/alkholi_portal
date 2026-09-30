# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Nuxt dev server on http://localhost:3000
npm run build     # Production build
npm run start     # Run production build (also used by PM2 in ecosystem.config.js)
npm run generate  # Static site generation
npm run lint      # ESLint over .js and .vue files (alias for lint:js)
npm run test:security  # Security tests (Node's built-in test runner, Node 18.17+)
```

The only tests are the security tests in `tests/security/*.test.js`. They mock SQL, LDAP, and frontend requests; never load `.env` or import an app entry point (`server/*/main.js`) in tests — `server/coc/main.js` schedules employee sync on import. Production deployment runs `nuxt start` under PM2 cluster mode (`ecosystem.config.js`, `instances: 'max'`).

## Stack

- **Nuxt 2.15 (Vue 2 + Vuetify 2)** — not Nuxt 3 / Vue 3. Use Options API, the legacy Vuex store under `store/`, and Vuetify 2 components (`v-app`, `v-btn`, etc.).
- **i18n**: English (LTR) + Arabic (RTL) via `@nuxtjs/i18n`, lazy-loaded from `locales/{en,ar}.json`. Use `this.$t(...)` and `localePath(...)` for routing.
- **Path aliases**: `~/`, `@/`, `~~/`, `@@/` all resolve to the project root (`jsconfig.json`).
- **Auto-imported components**: `nuxt.config.js > components.dirs` lists every auto-import directory. When adding a new component folder, register it there or it won't auto-import.
- **Per-feature layouts**: each top-level feature (`portal`, `businessCards`, `coc`, `dtr`, `hrSurvey`, `elevatorsSurvey`, `adminPage`, `login`) has its own layout in `layouts/`. Pages opt in via `layout: 'businessCard'` etc.

## Architecture

The app is a **monolithic Nuxt 2 frontend with Express APIs mounted as `serverMiddleware`** — there is no separate backend service. Each business module is sliced consistently across three layers:

```
server/<module>/main.js     → Express app, mounted at /<module>-api in nuxt.config.js
server/<module>/router/     → route handlers (one file per resource)
server/<module>/middleware/ → auth/authorization middleware
server/<module>/configs/    → mssql connection configs (read from process.env)
store/<module>/             → Vuex module mirroring the API
pages/<module-route>/       → Nuxt pages
components/<module>/        → feature components
layouts/<module>.vue        → per-feature layout
```

The eight modules wired in `nuxt.config.js > serverMiddleware`:

| Mount path             | Source                          | Purpose                                  |
|------------------------|---------------------------------|------------------------------------------|
| `/login-api`           | `server/login/main.js`          | LDAP auth, JWT token issuance            |
| `/portal-api`          | `server/portal/main.js`         | User profile + cross-module authorizations |
| `/administration-api`  | `server/administration/main.js` | Admin pages for every module             |
| `/business-cards-api`  | `server/businessCards/main.js`  | Digital business cards + vCard download  |
| `/elevators-survey-api`| `server/elevatorsSurveys/main.js` | Elevator inspection surveys           |
| `/coc-api`             | `server/coc/main.js`            | Code of Conduct acknowledgements         |
| `/hr-surveys-api`      | `server/hrSurveys/main.js`      | HR surveys                               |
| `/dtr-api`             | `server/dtr/main.js`            | Daily Time Report                        |

When adding a new module, follow the same pattern and **register it in both `nuxt.config.js > serverMiddleware` and `nuxt.config.js > components.dirs`**.

### Authentication and sessions

- Users sign in with Active Directory over LDAPS. The server chooses the domain controller from the four supported domains (`alkholi`, `buildingtek`, `upmoc`, `amos-sa`); clients never supply it.
- Employee details come from the HR database. Sessions are signed JWTs registered in the portal database; they have no expiry and end only when revoked at logout.
- Login and session logic lives in `server/login/services/`. Every module protects its routes with the shared `authorize` middleware (`server/shared/authorization.js`), which sets the verified caller identity on `req.auth`.
- **Always take caller identity from `req.auth`, never from the request body or query string.**
- Reauthentication and logout act only on the session from the presented bearer token.
- APIs return short error codes that the frontend translates via `locales/`. Never return database or exception text.

### Database access

- All SQL is **MSSQL via `mssql`** (stored procedures and plain queries), with no ORM.
- Use fixed, server-written SQL with typed input parameters. Never build SQL from request values. Procedure names, table names and identifiers must never come from request data.
- Check input lengths against the column sizes, and always close connection pools.
- In migrated modules, `main.js` injects dependencies into a `createApi.js` factory and services, so tests can mock SQL, LDAP and the file system. `server/login/services/repository.js`, `server/portal/services/portalIdentity.js` and `server/businessCards/services/publicCards.js` are reference implementations.
- **Legacy code is unsafe; don't copy it.** Some routers interpolate request values into SQL strings, and the `sqlCalls.js` router in `dtr` runs raw SQL sent by the browser. These are being replaced phase by phase per `project-docs/security-fix-plan.md`; check its progress table before touching those modules.

Two databases are used:
- `alkholiPortal` (config `server/login/configs/sql.js`, env `sql*`) — application data, tokens, admin membership tables.
- `Menaitech` HR database (config `server/login/configs/hrSQL.js`, env `hrSQL*`) — read-only employee lookup.

Some modules (`dtr`, `hrSurveys`) also use additional dbs configured via `dbServerIP` / `hrSurvey_db*` env vars.

### Authorization model

`POST /portal-api/get-user-authorizations` returns booleans like `isPortalAdmin`, `isBusinessCardsAdmin`, `isCOCAdmin`, `isElevatorsSurveysUser`, `isHRSurveysUser`, `isDTRUser` for `req.auth.employeeCode`, using one parameterized `EXISTS` query over the module admin/user tables (`server/portal/services/portalIdentity.js`). The frontend uses these to gate routes and admin UI in the per-module layouts.

Those flags only gate UI. Enforce roles on the server with `requireRole` from `server/shared/roles.js`, placed after `authorize`; each role checks its own table on every request, and portal administrators do not implicitly hold other module roles.

### Static uploads

Each module that handles uploads (`businessCards`, `portal`/profile images, etc.) serves them via `express.static` from `uploads/<module>/...` mounted under its own API path. Generated PDFs/QRCodes/vCards live there too.

## Conventions

- **Buttons**: apply the `cursor-pointer` class to every clickable button (per the user's global instructions).
- **Git**: do not run `git commit` or `git push` — the user handles git operations.
- **Secrets**: `.env` is gitignored and untracked, but the local copy contains live AD/SQL/email credentials. Treat it as sensitive when sharing diffs or logs; do not echo values.
- **Theme colors** are defined in `nuxt.config.js > vuetify.theme` (`primary: #000046` etc.) — prefer Vuetify theme keys over hard-coded hexes.
