# Phase 6 implementation prompt — Authenticated business-card operations

Implement **Phase 6: Authenticated business-card operations** in this repository. Complete its code changes, tests, self-review, and documentation; stop before the next phase. This is an implementation request, not a request for another plan.

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

Implement Phase 6 only, after Phases 1–5 have been accepted. Public cards and profile card shortcuts now have dedicated APIs, and DTR setup should no longer use card SQL routes. Finish migrating authenticated card management and remove its remaining SQL gateways.

Inspect `server/businessCards/router/business-cards.js`, `server/businessCards/router/sqlCalls.js`, `pages/business-cards/`, relevant stores/components, and the public-card implementation from Phase 2.

## Required implementation

1. Add fixed authenticated endpoints for generated-card lists, a single editable card, and activity logs. Reuse equivalent safe endpoints if earlier phases already created them; document the final interfaces.
2. Require current business-card administrator membership from the database for management reads and writes, using `req.auth.employeeCode`. Do not authorize from a client-supplied employee ID or audit-actor field, and do not implicitly substitute portal-admin membership.
3. Parameterize all SQL in generation/save, employee lookup, deletion, and activity logging for this management workflow. Keep targets validated and derive the acting user from the session.
4. Preserve required list/edit response fields, sorting, existing company variants, uploads, QR codes, and downloadable card artifacts. Run authorization before upload/file side effects and handle missing files/records and database failures without a false success.
5. Update management pages and stores to use the dedicated APIs. Review dialogs and helper components, not just top-level pages.
6. Search the entire repository for remaining callers, especially `components/portal/userProfile.vue` and the DTR assignment popup. Once those prerequisites are satisfied, remove authenticated business-card `sql-call` and `hr-sql-call` handlers, including unused HTTP-method variants. Do not leave a query-executing compatibility endpoint.
7. Preserve public card and vCard routes without adding administrative authentication to them. Regression-test their links; the separate public vCard SQL audit is scheduled for Phase 9.

## Acceptance scenarios

- Authorized card administrators can list, generate, inspect, edit, and delete a designated fixture card and see the expected activity log.
- Ordinary employees cannot invoke management APIs directly, even if they change local role flags or audit fields.
- All public card variants and profile QR shortcuts remain available to their intended audiences.
- Names containing apostrophes and Arabic text remain data, not query syntax; invalid IDs and database/upload failures are handled safely.
- Missing/deleted cards and stale edit requests do not crash the UI.
- No active caller depends on the removed gateways; their mounted routes return `404`.

## Required validation and second review

1. Add meaningful regression tests in `tests/security/` that exercise the changed handlers/services and frontend behavior, including the phase-specific cases above. Reuse the existing Node test runner and dependency-injection patterns. Inspect `package.json`: `test:security` currently enumerates files explicitly, so add new test files to the command when necessary.
2. Run `npm run test:security`, `npm run lint`, and `npm run build`. Fix failures caused by your changes. Verify all new tests actually ran. Report any environmental blocker with the exact command and result; do not describe an unrun check as passed.
3. **Double-check your work after the first implementation and passing tests.** Review the complete diff, including new files, as a reviewer. Trace each request from caller through authentication, role/scope checks, validation, parameter binding, response, and error handling. Check for missed callers, direct-API bypasses, unsafe fallback routes, changed data shapes, broken localization, connection/file cleanup, and race conditions relevant to this phase. Fix findings and rerun affected checks.
4. Independently search for the old calls and unsafe patterns in the affected scope. Verify retired endpoints through isolated HTTP tests, not only text searches. If a legacy endpoint must remain for a later phase, list its callers and residual exposure explicitly.
5. Update `project-docs/security-fix-plan.md` with a separate dated entry and status for this phase. Record API changes, changed areas, actual commands/results, limitations, production smoke-test steps, and rollback/recovery steps. Preserve historical records. Mark **Implemented** when local checks pass; mark **Deployed** or **Verified** only when those events are actually confirmed. Missing database-definition evidence must remain visible.
6. Finish with a concise summary of changes, test results, remaining risks, and the exact production checks the user should perform. Do not claim that the entire SQL/access-control problem is fixed while later phases or required checks remain.

Work through implementation and local verification rather than returning only a proposal. Make routine implementation decisions from the repository and explain material decisions. Ask a focused question only when missing business policy, database facts, or phase-readiness evidence prevents a safe implementation. Stop after this phase.
