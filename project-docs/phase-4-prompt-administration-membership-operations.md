# Phase 4 implementation prompt — Administration membership operations

Implement **Phase 4: Administration membership operations** in this repository. Complete its code changes, tests, self-review, and documentation; stop before the next phase. This is an implementation request, not a request for another plan.

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

Implement Phase 4 only, after Phases 1–3 have been accepted. The six administration membership lists currently request SQL directly, and administrative mutations must enforce the caller's administrator membership on the server.

Inspect the routers under `server/administration/router/`, the six membership stores under `store/administration/`, the administrative components, and the current administration router mounting. The existing portal-administrator membership source is `dbo.admin_members` / its membership-check procedure.

## Required implementation

1. Add `GET /administration-api/members/:module` with exactly these accepted resource names: `portal`, `business-cards`, `coc`, `elevators`, `hr-surveys`, and `dtr`.
2. Map them to fixed server queries for the existing corresponding membership tables. Reject unrecognized values, including prototype-like keys. Never interpolate the route value as a table or procedure name.
3. Require authenticated portal-administrator membership, resolved from `req.auth.employeeCode`, for membership lists, additions, deletions, and administrative employee lookups. Frontend visibility and the identity of the employee being added are not proof that the caller is an administrator.
4. Replace the six Vuex list requests with the new endpoint. Preserve required row fields and current duplicate/missing-member behavior and notifications.
5. Parameterize the existing membership mutation handlers and administrative employee lookups, including their HR title/profile lookups. Validate target employee identifiers and bind values using observed SQL types.
6. Put reusable role checks where later administration phases can use them. Do not assume portal administrators automatically hold every other module's role.
7. Retain administration generic SQL routes until DTR setup migrates in Phase 5. Require portal-administrator membership on those administration-only legacy routes during the transition, after confirming their callers. Document that role gating does not eliminate arbitrary-SQL execution for permitted callers. Do not change the business-card SQL fallback still used by DTR setup in this phase.

## Acceptance scenarios

- Portal administrators can list each resource and add/remove a designated membership in isolated fixtures.
- An authenticated nonadministrator cannot list members, mutate memberships, or use administrative employee lookups or administration SQL fallback routes.
- Spoofed caller IDs or role flags cannot grant access; target employee IDs are validated separately.
- Invalid resource names, missing HR data, duplicates, nonexistent members, and SQL failures are handled safely.
- A revoked portal-admin membership takes effect on subsequent requests.
- All six screens and the still-existing DTR setup navigation continue to work; no cross-module caller was accidentally blocked.

## Required validation and second review

1. Add meaningful regression tests in `tests/security/` that exercise the changed handlers/services and frontend behavior, including the phase-specific cases above. Reuse the existing Node test runner and dependency-injection patterns. Inspect `package.json`: `test:security` currently enumerates files explicitly, so add new test files to the command when necessary.
2. Run `npm run test:security`, `npm run lint`, and `npm run build`. Fix failures caused by your changes. Verify all new tests actually ran. Report any environmental blocker with the exact command and result; do not describe an unrun check as passed.
3. **Double-check your work after the first implementation and passing tests.** Review the complete diff, including new files, as a reviewer. Trace each request from caller through authentication, role/scope checks, validation, parameter binding, response, and error handling. Check for missed callers, direct-API bypasses, unsafe fallback routes, changed data shapes, broken localization, connection/file cleanup, and race conditions relevant to this phase. Fix findings and rerun affected checks.
4. Independently search for the old calls and unsafe patterns in the affected scope. Verify retired endpoints through isolated HTTP tests, not only text searches. If a legacy endpoint must remain for a later phase, list its callers and residual exposure explicitly.
5. Update `project-docs/security-fix-plan.md` with a separate dated entry and status for this phase. Record API changes, changed areas, actual commands/results, limitations, production smoke-test steps, and rollback/recovery steps. Preserve historical records. Mark **Implemented** when local checks pass; mark **Deployed** or **Verified** only when those events are actually confirmed. Missing database-definition evidence must remain visible.
6. Finish with a concise summary of changes, test results, remaining risks, and the exact production checks the user should perform. Do not claim that the entire SQL/access-control problem is fixed while later phases or required checks remain.

Work through implementation and local verification rather than returning only a proposal. Make routine implementation decisions from the repository and explain material decisions. Ask a focused question only when missing business policy, database facts, or phase-readiness evidence prevents a safe implementation. Stop after this phase.
