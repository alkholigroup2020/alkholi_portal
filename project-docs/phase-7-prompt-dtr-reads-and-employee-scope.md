# Phase 7 implementation prompt — DTR reads and employee scope

Implement **Phase 7: DTR reads and employee scope** in this repository. Complete its code changes, tests, self-review, and documentation; stop before the next phase. This is an implementation request, not a request for another plan.

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

Implement Phase 7 only, after Phases 1–6 have been accepted. The DTR table and approval screens currently build employee-scope and period queries in the browser. Move reads and access-scope resolution to the server, while reserving write/transition changes for Phase 8.

Inspect `pages/dtr/dtr-table/index.vue`, `pages/dtr/approvals/index.vue`, `components/dtr/dtr-table/employeeCalendar.vue`, and `server/dtr/`. Reuse hierarchy knowledge and safe services introduced in Phase 5.

## Required implementation

1. Introduce fixed authenticated endpoints for assigned employees, period entries/statuses, calendar details, employee metadata needed by the calendar, and pending manager approvals. Document exact inputs and response shapes and update all relevant read callers.
2. Require DTR membership. Resolve assignment scope from the authenticated employee and `dtr.adminAssignment`; never accept a caller-selected administrator/manager identity as authority.
3. Move hierarchy expansion, active-employee filtering, and scope selection into server services using parameterized SQL. Preserve existing HR hierarchy mappings, sentinel compatibility, and branch distinctions.
4. Pending approvals must be scoped to the authenticated manager and pending records. Allow employee/calendar details only for assigned employees or records that the caller is authorized to approve; possession of a guessed employee code must not grant access.
5. Preserve the 21st-to-20th reporting period, current date conversions, status display, and response fields the calendar/table need. Validate periods and handle short months and leap years.
6. Deduplicate overlapping assignments without dropping legitimate employees. Keep empty scope an empty result; never broaden it into all employees.
7. Preserve the agreed policy: DTR membership plus assignment scope for entry work, and the recorded employee manager for approvals. Do not newly require unused `isAdmin`, `isApprover`, or other stored role flags.
8. Update only DTR read workflows in this phase. Inventory remaining generic calls used by saves/submission/approval for Phase 8. Do not remove a gateway that those callers still need, or claim DTR is fully secure while arbitrary-SQL gateways remain.

## Acceptance scenarios

- Compare lists and calendar data for every hierarchy assignment level, overlapping assignments, empty assignments, inactive employees, and identical codes in different branches.
- Manager queues contain only that manager's pending entries in the requested period.
- Changing manager/employee/path parameters cannot access unrelated records through the new endpoints.
- Missing DTR membership, revoked sessions, invalid periods, unknown employees, and SQL failures receive controlled responses.
- Cover month/year boundaries, 28/29/30/31-day months, and the preserved 21st-to-20th sequence.
- Existing DTR writes still work with their current callers; document each remaining legacy call and the residual risk.

## Required validation and second review

1. Add meaningful regression tests in `tests/security/` that exercise the changed handlers/services and frontend behavior, including the phase-specific cases above. Reuse the existing Node test runner and dependency-injection patterns. Inspect `package.json`: `test:security` currently enumerates files explicitly, so add new test files to the command when necessary.
2. Run `npm run test:security`, `npm run lint`, and `npm run build`. Fix failures caused by your changes. Verify all new tests actually ran. Report any environmental blocker with the exact command and result; do not describe an unrun check as passed.
3. **Double-check your work after the first implementation and passing tests.** Review the complete diff, including new files, as a reviewer. Trace each request from caller through authentication, role/scope checks, validation, parameter binding, response, and error handling. Check for missed callers, direct-API bypasses, unsafe fallback routes, changed data shapes, broken localization, connection/file cleanup, and race conditions relevant to this phase. Fix findings and rerun affected checks.
4. Independently search for the old calls and unsafe patterns in the affected scope. Verify retired endpoints through isolated HTTP tests, not only text searches. If a legacy endpoint must remain for a later phase, list its callers and residual exposure explicitly.
5. Update `project-docs/security-fix-plan.md` with a separate dated entry and status for this phase. Record API changes, changed areas, actual commands/results, limitations, production smoke-test steps, and rollback/recovery steps. Preserve historical records. Mark **Implemented** when local checks pass; mark **Deployed** or **Verified** only when those events are actually confirmed. Missing database-definition evidence must remain visible.
6. Finish with a concise summary of changes, test results, remaining risks, and the exact production checks the user should perform. Do not claim that the entire SQL/access-control problem is fixed while later phases or required checks remain.

Work through implementation and local verification rather than returning only a proposal. Make routine implementation decisions from the repository and explain material decisions. Ask a focused question only when missing business policy, database facts, or phase-readiness evidence prevents a safe implementation. Stop after this phase.
