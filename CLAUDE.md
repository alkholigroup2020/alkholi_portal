# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Nuxt dev server on http://localhost:3000
npm run build     # Production build
npm run start     # Run production build (also used by PM2 in ecosystem.config.js)
npm run generate  # Static site generation
npm run lint      # ESLint over .js and .vue files (alias for lint:js)
```

There is no test runner configured. Production deployment runs `nuxt start` under PM2 cluster mode (`ecosystem.config.js`, `instances: 'max'`).

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

### Authentication flow

1. `POST /login-api/login` calls `server/login/utils/adAuth.js`, which binds to Active Directory over LDAPS (port 636) using a service account, then re-binds with the user's password to verify it. The DC IP is supplied per-request and the supported domains are hardcoded in `authentication.js > reauthenticate`: `alkholi`, `buildingtek`, `upmoc`, `amos-sa`.
2. Extra employee data is fetched from the **HR MSSQL database** (`Menaitech`, see `server/login/configs/hrSQL.js`) — `Pay_employees` joined with `pay_code_tables` for the title.
3. The user's password is encrypted with `cryptr` (`process.env.encKey`) and a JWT (`process.env.tokenKey`) is generated. Both are persisted to the **portal MSSQL database** (`alkholiPortal`, see `server/login/configs/sql.js`) via stored procs `usersInfo_addData` / `userTokens_addToken`.
4. The frontend stores the token in `localStorage` and sets `axios.defaults.headers.common.Authorization = 'Bearer <token>'` (see `store/login/index.js`).
5. Every subsequent API request is gated by an `authorize` middleware (e.g. `server/portal/middleware/authorization.js`) that calls the `userTokens_checkIfExist` stored proc.
6. `POST /login-api/reauthenticate` decrypts the stored password and re-binds to AD — used to re-validate sessions.

### Database access pattern

All SQL access is **MSSQL via `mssql` + stored procedures**, not an ORM. Pattern across every router:

```js
async function portalDB() {
  const pool = new sql.ConnectionPool(sqlConfigs)
  await pool.connect()
  return pool
}

const conn = await portalDB()
try {
  await conn.request().query(`exec dbo.someStoredProc '${value}'`)
} finally {
  await conn.close()
}
```

Two databases are used:
- `alkholiPortal` (config `server/login/configs/sql.js`, env `sql*`) — application data, tokens, admin membership tables.
- `Menaitech` HR database (config `server/login/configs/hrSQL.js`, env `hrSQL*`) — read-only employee lookup.

Some modules (`dtr`, `hrSurveys`) also use additional dbs configured via `dbServerIP` / `hrSurvey_db*` env vars.

### Authorization model

`POST /portal-api/get-user-authorizations` returns booleans like `isPortalAdmin`, `isBusinessCardsAdmin`, `isCOCAdmin`, `isElevatorsSurveysUser`, `isHRSurveysUser`, `isDTRUser` by calling `<module>_admins_checkIfExist` / `<module>_users_checkIfExist` stored procs. The frontend uses these to gate routes and admin UI in the per-module layouts.

### Static uploads

Each module that handles uploads (`businessCards`, `portal`/profile images, etc.) serves them via `express.static` from `uploads/<module>/...` mounted under its own API path. Generated PDFs/QRCodes/vCards live there too.

## Conventions

- **Buttons**: apply the `cursor-pointer` class to every clickable button (per the user's global instructions).
- **Git**: do not run `git commit` or `git push` — the user handles git operations.
- **Secrets**: `.env` is checked in and contains live AD/SQL/email credentials. Treat it as sensitive when sharing diffs or logs; do not echo values.
- **Theme colors** are defined in `nuxt.config.js > vuetify.theme` (`primary: #000046` etc.) — prefer Vuetify theme keys over hard-coded hexes.
