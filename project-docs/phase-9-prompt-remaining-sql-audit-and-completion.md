# Phase 9 implementation prompt — Remaining SQL audit and completion

Implement **Phase 9: Remaining SQL audit and completion** in this repository. Complete its code changes, tests, self-review, and documentation; stop before the next phase. This is an implementation request, not a request for another plan.

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

Implement Phase 9 only, after Phases 1–8 have been accepted. The generic SQL gateways should now be gone, but fixed-purpose handlers may still interpolate input, omit role/ownership checks, or delegate unsafe dynamic SQL to stored procedures. Finish the SQL/access-control audit without claiming unrelated security findings have been resolved.

Inspect all `server/` modules and callers. Concentrate on `server/coc/router/cocJS.js`, HR/elevator survey routers, `server/businessCards/router/vCard.js`, remaining uploads/exports, and stored-procedure dependencies. Recheck earlier phases rather than assuming their implementation is correct.

## Required implementation

1. Produce a route-to-operation inventory: public versus authenticated access, required role/ownership, input sources, fixed queries/procedures, and frontend consumers. Follow indirect helper calls and values originating from stored data as well as obvious `req.body` interpolation.
2. Parameterize remaining externally influenced SQL and procedure calls. For dynamic identifiers genuinely required by a feature, use a closed server-owned mapping; never splice request values into query text.
3. Enforce the existing intended module policy on the server: employee self-service must use session ownership; CoC administration and survey management/reporting require their appropriate membership. Trace current layouts, flows, and schema to distinguish self-service from administration. Ask about genuinely ambiguous business policy rather than granting broad access or breaking legitimate workflows.
4. Keep public business cards and intended public vCard downloads public, with fixed, validated, parameterized lookups and explicit fields. Test vCard response headers and generated content. Record any separate file/static-document exposure for deferred work; do not redesign static document access in this phase.
5. Check exports and notification-triggering routes for role/scope bypasses and SQL interpolation. Mock email and filesystem effects in tests. Do not send real notices or modify employee submissions as part of verification.
6. Review definitions of every relevant stored procedure for dynamic SQL and injection from input or stored values. Phase 1 could read parameter metadata, but definitions returned `NULL`; do not mistake that for proof of safety. Request the required definition exports/read-only evidence when inaccessible, continue all independent code work, and keep the procedure audit explicitly incomplete until resolved. Do not change database permissions to obtain access on your own.
7. Search the complete application for all old SQL gateway names and SQL-bearing client payloads. Confirm removed routes are not mounted under aliases or alternate HTTP methods. Code in a renamed helper is not remediation if it still executes request-supplied SQL.
8. Add durable regression checks and meaningful behavioral tests to prevent reintroducing arbitrary query execution or authorization bypass. Exclude documentation/test fixtures from source-pattern checks so intentional examples do not produce false positives. Supplement searches with routed HTTP and parameter-binding tests.
9. Record a final coverage matrix in the master plan: each module, completed migrations, permission checks, database-definition evidence, tests, and remaining limitations. Resolve required uncertainty before claiming the full SQL/access-control audit is complete.

## Acceptance scenarios

- Retired gateways across administration, business cards, and DTR return `404`; no client can choose SQL, tables, columns, or procedures through an alternate path.
- Unauthenticated, wrong-role, and wrong-owner requests cannot read protected records or cause database, file, or email effects.
- Employee CoC self-service, CoC admin operations, HR/elevator reports and exports, and public card/vCard flows retain legitimate behavior.
- Mocked injection-like values, quotes, Arabic text, empty results, missing records, and service errors are handled safely across affected modules.
- Earlier login/logout, portal, membership, card, and DTR regression tests remain passing.
- Procedure internals have actual review evidence, or the final report explicitly states that implementation is locally tested but the overall audit is not yet verified.

## Required validation and second review

1. Add meaningful regression tests in `tests/security/` that exercise the changed handlers/services and frontend behavior, including the phase-specific cases above. Reuse the existing Node test runner and dependency-injection patterns. Inspect `package.json`: `test:security` currently enumerates files explicitly, so add new test files to the command when necessary.
2. Run `npm run test:security`, `npm run lint`, and `npm run build`. Fix failures caused by your changes. Verify all new tests actually ran. Report any environmental blocker with the exact command and result; do not describe an unrun check as passed.
3. **Double-check your work after the first implementation and passing tests.** Review the complete diff, including new files, as a reviewer. Trace each request from caller through authentication, role/scope checks, validation, parameter binding, response, and error handling. Check for missed callers, direct-API bypasses, unsafe fallback routes, changed data shapes, broken localization, connection/file cleanup, and race conditions relevant to this phase. Fix findings and rerun affected checks.
4. Independently search for the old calls and unsafe patterns in the affected scope. Verify retired endpoints through isolated HTTP tests, not only text searches. If a legacy endpoint must remain for a later phase, list its callers and residual exposure explicitly.
5. Update `project-docs/security-fix-plan.md` with a separate dated entry and status for this phase. Record API changes, changed areas, actual commands/results, limitations, production smoke-test steps, and rollback/recovery steps. Preserve historical records. Mark **Implemented** when local checks pass; mark **Deployed** or **Verified** only when those events are actually confirmed. Missing database-definition evidence must remain visible.
6. Finish with a concise summary of changes, test results, remaining risks, and the exact production checks the user should perform. Do not claim that the entire SQL/access-control problem is fixed while later phases or required checks remain.

Work through implementation and local verification rather than returning only a proposal. Make routine implementation decisions from the repository and explain material decisions. Ask a focused question only when missing business policy, database facts, or phase-readiness evidence prevents a safe implementation. Stop after this phase.
