# Phase 5 implementation prompt — DTR organization setup and assignments

Implement **Phase 5: DTR organization setup and assignments** in this repository. Complete its code changes, tests, self-review, and documentation; stop before the next phase. This is an implementation request, not a request for another plan.

## Project context

You are working in the Alkholi employee portal repository. Read `AGENTS.md` and `project-docs/security-fix-plan.md` before editing. Inspect the actual checkout; file names below are starting points, not proof that earlier work is present.

The application is a Nuxt 2 monolith with Vue 2 Options API, Vuetify 2, Vuex, English/Arabic translations and RTL layouts. Express APIs are mounted through `nuxt.config.js` server middleware. Microsoft SQL Server holds application and HR data. Features include the portal, administration, business cards, Code of Conduct (CoC), surveys, and daily time reports (DTR).

The security problem is that several APIs execute SQL supplied by the browser, including an unauthenticated public-card endpoint. Other handlers interpolate external values into SQL, and token existence alone does not enforce roles or employee scope. We are replacing these paths gradually with fixed server-owned operations, typed parameters, and server-side authorization.

Phase 1 introduced shared authentication in `server/shared/authorization.js` and services under `server/login/services/`. After successful authentication, `req.auth` supplies the verified employee code, account, domain, session identifier, and token. Reuse this identity; never trust local storage, body fields, or client-side role flags to establish the caller. Preserve login/logout behavior and existing session lifetime.

## Working rules

- Implement only the phase named above. Do not automatically start the next phase.
- First inspect Git status and the previous phase's implementation and verification record. Preserve unrelated user changes. Prior phases must have been tested and accepted: use recorded evidence or the user's explicit confirmation. If evidence is missing, do read-only preparation and ask only for that missing readiness confirmation before modifying the next phase. Do not invent verification.
- Trace every affected frontend caller, response consumer, router mount, and database operation before editing. Use `rg` to find references. Keep frontend and backend changes deployable together.
- Use fixed SQL/procedure names and typed `request.input(...)` parameters with `mssql`. Never accept SQL or database identifiers from clients. An allowlisted resource name must map to fixed server-owned queries; parameterizing values while accepting query text is still unsafe.
- Preserve schema, public URLs, legitimate workflow behavior, response fields needed by consumers, and English/Arabic support. Follow repository formatting and lint rules; use `$t(...)`, `localePath(...)`, and `cursor-pointer` for clickable buttons.
- Inspect database metadata read-only when needed; do not guess procedure signatures or silently truncate values. Keep credentials, tokens, employee records, and connection details out of output and documentation. If definitions are inaccessible, state the precise uncertainty.
- Do not redesign sessions, remove stored passwords, change LDAP certificates, activate unused DTR role flags, overhaul static document access, or redesign background jobs in this task. Record unrelated findings for later.
- The user deploys and verifies on production and accepts planned downtime. Do not deploy, restart their processes, alter live schema/data, send emails, or commit/push as part of this prompt. Prepare a concrete deployment/rollback checklist. Production writes need separately authorized designated test records.
- Do not start the full application against live services merely to test: startup schedules employee synchronization. Automated tests must use mocks or isolated fixtures, never load `.env`, and never import the full server entry point. Prefer pure services and an isolated Express test app.
- Recovery must not re-expose retired SQL endpoints. If verification fails, keep affected functionality under maintenance; restore a known-good release only when it preserves that boundary, otherwise fix forward. Production test-write instructions must include recording previous values and restoring them afterward.

## Phase objective and starting points

Implement Phase 5 only, after Phases 1–4 have been accepted. DTR setup builds organization and employee queries in the browser; its assignment popup also uses the business-card generic SQL API to create DTR assignments. Move these operations to authorized administration handlers.

Inspect `pages/administration/dtr-setup/`, `components/administration/dtrSetup/` (including the existing spelling `drtAdminPopup.vue`), `store/administration/dtrSetup.js`, and administration routers/configurations.

## Required implementation

1. Add explicit administration endpoints for organization children, employees within an organization path, assignment lists, and assignment creation. Use clear resource/action names and record exact request/response contracts in the phase notes. Reuse suitable handlers added by earlier phases.
2. Validate branch/division/department/project/subproject values and an allowlisted hierarchy level. Select fixed server-owned queries; neither table names nor SQL fragments may come from the browser.
3. Trace and preserve the actual HR mappings: UI hierarchy labels do not necessarily match HR column names. Preserve active-employee filtering and include the full organization path where necessary to avoid mixing branches with identical codes.
4. Keep existing stored `"undefined"` sentinel values compatible inside the repository/adapter. Prefer absent optional fields in the new API contract; do not migrate existing assignment data or silently reinterpret the hierarchy.
5. Require portal-administrator membership for every new operation, using the helper established in Phase 4.
6. Move duplicate checking and assignment creation from the business-card endpoint into one server operation and transaction. Prevent concurrent duplicate inserts with appropriate locking/isolation or a verified existing constraint; a transaction alone is insufficient if both checks can pass concurrently. Do not add a live constraint or migration silently.
7. Resolve employee display/profile details from trusted server lookups. Preserve the existing assignment flags and UI validation without activating those flags as new DTR access policies. Do not add edit/delete features that are currently disabled.
8. Migrate every DTR setup caller. Remove administration `sql-call` and `hr-sql-call` routes after verifying no consumers remain. Confirm the assignment popup no longer calls business-card SQL routes, so Phase 6 can retire them safely.

## Acceptance scenarios

- Every existing hierarchy level returns the expected children, employees, and assignments, including empty branches and same-code/different-branch fixtures.
- Division-, department-, project-, and subproject-level assignments preserve sentinel semantics and selected flags.
- Assignment creation works; duplicates and concurrent duplicate attempts do not create multiple rows.
- Invalid paths, missing employees, unauthorized callers, and failed writes leave no partial assignment.
- Retired administration SQL endpoints return `404`; Phase 4 membership screens and portal behavior still work.

## Required validation and second review

1. Add meaningful regression tests in `tests/security/` that exercise the changed handlers/services and frontend behavior, including the phase-specific cases above. Reuse the existing Node test runner and dependency-injection patterns. Inspect `package.json`: `test:security` currently enumerates files explicitly, so add new test files to the command when necessary.
2. Run `npm run test:security`, `npm run lint`, and `npm run build`. Fix failures caused by your changes. Verify all new tests actually ran. Report any environmental blocker with the exact command and result; do not describe an unrun check as passed.
3. **Double-check your work after the first implementation and passing tests.** Review the complete diff, including new files, as a reviewer. Trace each request from caller through authentication, role/scope checks, validation, parameter binding, response, and error handling. Check for missed callers, direct-API bypasses, unsafe fallback routes, changed data shapes, broken localization, connection/file cleanup, and race conditions relevant to this phase. Fix findings and rerun affected checks.
4. Independently search for the old calls and unsafe patterns in the affected scope. Verify retired endpoints through isolated HTTP tests, not only text searches. If a legacy endpoint must remain for a later phase, list its callers and residual exposure explicitly.
5. Update `project-docs/security-fix-plan.md` with a separate dated entry and status for this phase. Record API changes, changed areas, actual commands/results, limitations, production smoke-test steps, and rollback/recovery steps. Preserve historical records. Mark **Implemented** when local checks pass; mark **Deployed** or **Verified** only when those events are actually confirmed. Missing database-definition evidence must remain visible.
6. Finish with a concise summary of changes, test results, remaining risks, and the exact production checks the user should perform. Do not claim that the entire SQL/access-control problem is fixed while later phases or required checks remain.

Work through implementation and local verification rather than returning only a proposal. Make routine implementation decisions from the repository and explain material decisions. Ask a focused question only when missing business policy, database facts, or phase-readiness evidence prevents a safe implementation. Stop after this phase.
