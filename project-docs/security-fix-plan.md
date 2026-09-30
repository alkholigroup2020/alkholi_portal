# Phased SQL and Access-Control Fix Plan

## Summary and agreed decisions

Replace browser-supplied SQL with server-owned operations, parameterize SQL inputs, and enforce the permissions those operations require.

- **Login/logout is Phase 1.**
- Apply and test one phase at a time; do not advance automatically.
- Deploy and verify on production during planned maintenance windows; downtime is acceptable.
- Phase 1 may require every user to sign in again.
- Preserve the login UI, local-storage token transport, stored-password reauthentication, and existing session lifetime.
- Preserve DTR's current assignment and manager rules; do not activate currently unused role flags.
- Defer password-storage removal, cookie-based sessions, LDAP certificate changes, document-access hardening, and background-job redesign.

## Working method for every phase

Each phase is a separate reviewable change with its frontend and backend deployed together.

1. Record the current release and relevant behavior before editing. Obtain database parameter/column metadata through read-only inspection where needed; stored-procedure definitions are absent from this repository.
2. Use fixed server-written SQL with typed `.input(...)` parameters. Database identifiers and procedure names must never come from request data.
3. Run automated checks locally, then `npm run lint` and `npm run build`.
4. Deploy during a maintenance window. Refresh browser clients after deployment.
5. Test production reads first. Exercise writes only on designated test records/accounts, record their previous values, and restore them afterward. Do not perform injection or destructive tests against production databases.
6. Record the release, checks, results, and rollback instructions here. Mark the phase **Verified** before starting the next one.

Add a local security-test command using Node's test runner and mocked SQL/LDAP dependencies. Tests must never load production credentials or import the application entry point that schedules employee synchronization.

If verification fails, keep the affected functionality under maintenance. Restore a known-good release only when doing so does not expose retired SQL endpoints; otherwise fix forward.

## Implementation phases

### Phase 1 — Login, session validation, and logout

**Goal:** Establish a trustworthy caller identity without redesigning the authentication experience.

Implement and verify these checkpoints separately within Phase 1:

**1A. Login SQL and input handling**

- Parameterize every query and stored-procedure call used by login, reauthentication, and logout.
- Validate required strings without altering passwords; normalize domains against the four existing supported domains.
- Move domain-controller selection entirely to the server. Remove `dc_ip` from the login form request and ignore it if an older client sends it.
- Escape LDAP search-filter values, close LDAP connections, and handle connection failures.
- Keep successful login response fields and existing translated error meanings. Return controlled error codes rather than database exception text.

**1B. Session identity**

- Issue signed tokens containing a session-version marker, unique session identifier, employee code, account, and domain obtained from successful authentication and HR lookup.
- Keep database token registration and revocation.
- Introduce shared authentication middleware and have all existing module authorization wrappers use it.
- Verify signature with an explicit algorithm allowlist, require the new session version, check database registration, and expose the verified identity as `req.auth`.
- Reject legacy tokens with `401`; users sign in again. Confirm token-column capacity before deployment.
- Protect `/login-api/reauthenticate`. Resolve the password lookup and AD identity from `req.auth`; stop trusting body-supplied email, account, or domain.
- Restore the bearer header from storage **before** the frontend sends a reauthentication request.

**1C. Logout and frontend recovery**

- Keep `POST /login-api/logoff`, but revoke only the bearer token being presented; remove body-token targeting.
- Make repeated logout of an already-revoked valid token successful. Report database failures without claiming revocation succeeded.
- Always clear client authentication data, cached permissions, profile data, and authorization headers when logging out.
- Handle network errors without assuming `error.response` exists.
- Preserve Arabic/English navigation and successful Code of Conduct return navigation; failed login must not trigger a success redirect.

**Acceptance:** Valid login for each available domain; wrong credentials; missing HR information; page refresh; CoC deep link; logout twice; logged-out token rejection; legacy/tampered token rejection; identity-body spoofing rejection; AD/SQL failure handling. Run adversarial cases with mocks.

**Impact:** One-time sign-in for all users. All protected modules require a basic smoke test because they share authentication.

### Phase 2 — Public business-card lookup

- Introduce `GET /business-cards-api/public-cards/:employeeCode` with a validated identifier and fixed parameterized query.
- Explicitly select only fields consumed by public card templates; preserve the template data shape.
- Update the public card page while preserving existing public URLs and QR-code destinations.
- Remove `/business-cards-api/open-sql-call` in the same release.

**Acceptance:** Existing cards/company layouts render without login; unknown cards have a controlled not-found state; the removed endpoint returns `404`; unrelated employee fields are absent.

### Phase 3 — Portal identity and profile access

- Keep existing profile and authorization route names, but obtain the employee from `req.auth`.
- Parameterize queries and prevent profile updates targeting another employee.
- Replace the profile component's business-card SQL calls with `GET /portal-api/my-business-card`, returning card availability and QR information for the caller.
- Preserve authorization response flags and evaluate membership from the database.

**Acceptance:** Own profile, photo update, permissions, and card shortcut work; changing employee identifiers cannot expose another profile or permissions.

### Phase 4 — Administration membership operations

- Add `GET /administration-api/members/:module` with a fixed allowlist: `portal`, `business-cards`, `coc`, `elevators`, `hr-surveys`, `dtr`.
- Map each module to a fixed query; update the six Vuex list callers.
- Require portal-administrator membership for all administration membership reads, additions, deletions, and employee lookups.
- Parameterize existing mutation handlers.

**Acceptance:** An administrator can manage a designated test membership; ordinary users receive `403`; invalid modules receive `400`; duplicate/missing-member behavior remains controlled.

### Phase 5 — DTR organization setup and assignments

- Introduce administration endpoints for organization children, employees within a path, assignment lists, and assignment creation.
- Accept validated branch/division/department/project/subproject values and an allowlisted hierarchy level.
- Preserve hierarchy mappings; handle stored `"undefined"` strings inside the server adapter without migrating existing data.
- Move assignment creation out of the business-card SQL endpoint.
- Require portal-administrator membership. Check duplicates and insert within one transaction.
- Remove administration generic SQL endpoints once all callers are migrated.

**Acceptance:** Navigate every level; compare employee/assignment lists; create a test assignment; reject duplicates and unauthorized changes.

### Phase 6 — Authenticated business-card operations

- Add fixed endpoints for card lists, a single editable card, and activity logs.
- Require business-card administrator membership for management operations.
- Parameterize generation, employee lookup, and deletion handlers; retain response formats where possible.
- Remove remaining business-card generic SQL endpoints after profile and DTR setup callers have moved.

**Acceptance:** Generate, view, edit, and delete a test card; inspect logs; check profile/public cards; reject unauthorized management.

### Phase 7 — DTR reads and employee scope

- Introduce fixed endpoints for assigned employees, period entries, calendar details, and pending manager approvals.
- Move organization expansion/employee filtering into server services.
- Require DTR membership; derive assignment scope and manager identity from the caller.
- Preserve active-employee filtering and the 21st-to-20th period.
- Limit details to assigned employees or entries the caller can approve.

**Acceptance:** Compare every assignment level; test overlapping/empty assignments, period boundaries, and manager queues; reject direct requests for unrelated employees.

### Phase 8 — DTR saves, submission, and approval

- Keep `/dtr-api/save-dtr-data`; enforce assignment checks and derive editor/manager values from trusted data.
- Add explicit submit, approve, decline, bulk-submit, and bulk-approve operations.
- Accept employee IDs, dates, day values, and decline text; never SQL or caller-selected final status.
- Preserve statuses: draft `0`, pending `1`, declined `2`, approved `3`.
- Assigned users can save drafts/declined entries and submit them; the recorded manager can approve/decline pending entries.
- Make bulk operations transactional; reject all targets if any is unauthorized or stale. Return `409` for state conflicts.
- Remove remaining DTR generic SQL endpoints.

**Acceptance:** Complete draft → submission → decline → correction → resubmission → approval on test data; check bulk behavior, short months, leap years, duplicates, unauthorized targets, and stale updates.

### Phase 9 — Remaining SQL audit and completion

- Audit CoC, HR/elevator surveys, business-card/vCard routes, and remaining queries for interpolated external values.
- Parameterize remaining inputs and enforce existing membership, self-service ownership, and administrative permissions.
- Preserve intended public routes with narrowly scoped handlers.
- Review stored procedures for unsafe dynamic SQL; bound parameters alone do not secure procedure internals.
- Confirm no request can select arbitrary SQL, tables, columns, or procedures.
- Add regression checks against generic SQL routes and SQL-bearing frontend payloads.

**Acceptance:** Removed endpoints return `404`; cross-module checks pass; database-definition uncertainties are resolved before audit completion.

## Completion criteria and limitations

Complete only when all phases are verified, legitimate workflows pass, and clients cannot choose SQL or bypass access checks. Generic SQL endpoints remain a known risk until removed; Phase 1 alone does not close that exposure.

No schema migration is planned by default. Document and back up any required metadata-driven compatibility change before deployment.

Track phases as **Not started → Implemented → Deployed → Verified**, with dated checks and test account/record names, never passwords or tokens.

## Progress record

Baseline: `ce02b0b830eebe965beb225a71b285d82a8ad3ff`; working tree clean before this document. Baseline login used interpolated SQL, body-provided identity for reauthentication, body-provided tokens for logout, and duplicated token-existence middleware.

| Phase | Status      | Production verification                                      |
| ----- | ----------- | ------------------------------------------------------------ |
| 1     | Verified    | User confirmed deployed and working on 2026-09-16             |
| 2     | Verified    | User confirmed deployed, verified, and accepted on 2026-09-22 |
| 3     | Deployed    | Partial read-only smoke 2026-09-29; user accepted it for progression the same day (remaining checks not performed) |
| 4     | Deployed    | User confirmed deployed and accepted on 2026-09-30 (smoke-check details not supplied) |
| 5     | Implemented | Local checks passed 2026-09-30; not deployed or verified      |
| 6–9   | Not started | Pending; do not advance automatically                         |

Production release, maintenance window, and designated test accounts/records: to be recorded by the user before deployment.

### Phase 1 implementation record — 2026-09-15

**Implemented:** Checkpoints 1A, 1B, and 1C. Phase 2 has not started. No production deployment, AD login, employee-data write, token revocation, schema change, commit, or push was performed during implementation.

#### API behavior

- `POST /login-api/login` still accepts `userAccount`, `password`, and `domain` and returns the existing response fields. `dc_ip` is ignored. Domains are normalized and selected from the existing server-owned mapping. The LDAP result supplies the canonical account; HR supplies the employee code.
- Tokens use HS256 and compact claims: `v` (session version 1), `jti` (random 128-bit identifier), `e` (employee code), `a` (account), `d` (domain), and `iat`. No new expiry is introduced. All protected modules reject old-version tokens and verify both the signed identity and its database registration.
- `POST /login-api/reauthenticate` requires `Authorization: Bearer ...`; its body cannot select an identity. The response preserves `message` (email) and adds `employeeCode`, `userAccount`, and `domain` so the browser can restore authoritative identity before loading profile and permissions.
- `POST /login-api/logoff` accepts the bearer header and an empty body. A valid, already-revoked token returns `200`; invalid/legacy tokens return `401`. Database failures return `503`. Browser state clears immediately, and a 15-second revocation timeout produces a translated warning instead of claiming server revocation succeeded.
- Invalid login input returns `400`; authentication failures return `401`; existing missing-HR conditions remain `404`; service/data-capacity failures return `503`. Unexpected SQL/LDAP exception text is not sent to the browser. JSON/form parsing is bounded to 16 KB.
- Late login, reauthentication, profile, and permission responses cannot restore the cleared session. Successful login navigates once; failed login does not redirect to the CoC form.

#### Database compatibility checked (read-only)

- `dbo.userTokens.userToken` and the registration/check/revocation procedure parameters are `varchar(300)`. Compact tokens fit ordinary 20-character account/employee identifiers (264 characters in the maximum ordinary test case); token issuance rejects values exceeding 300 rather than truncating them.
- `usersInfo` and profile procedure parameter sizes were inspected. Typed bindings preserve Unicode profile/name/title parameters. Values exceeding existing field limits fail with `accountDataInvalid` before profile writes rather than being silently truncated. The stored encrypted-password field remains `varchar(300)`.
- HR lookup parameters match the observed `Pay_employees` / `pay_code_tables` types: employee code `varchar(15)`, email `varchar(100)`, branch `varchar(10)`, and position/system code `varchar(15)`.
- `SELECT TOP (0)` confirmed query access to the identity and token-registration columns; no employee/token rows were retrieved.
- Stored-procedure definitions returned `NULL` with the current database account. Their internal SQL and any hidden side effects remain unverified; the broader procedure audit remains Phase 9. No migration is required for this implementation against the inspected schema.
- Login rejects ambiguous HR email matches and oversized account/profile data. If a production account fails these checks, correct the account data or assess a separate schema change; do not weaken identity checks or truncate credentials.

#### Local checks

- [x] `npm run test:security`: 30 tests pass with mocked SQL, LDAP, Axios, and Vuex flows. HTTP integration tests bind only to loopback and use test-only signing keys. Run on Node 18.17+; validated locally on Node 24.21.0.
- [x] Input rejection, password preservation, LDAP escaping/cleanup/timeouts, safe error responses, all four domains, token versions/signatures/registration, spoofed reauthentication identity, and repeatable bearer-only logout.
- [x] Parameter binding for HR lookups, profile insert/update, token registration, identity lookup, and revocation; database-error cleanup and field-size checks.
- [x] Client refresh ordering, cache clearing, offline logout, rejected sessions, late responses, localized CoC navigation, and profile-loading failures.
- [x] `npm run lint`: final full-repository run passed after all Phase 1 code changes.
- [x] `npm run build`: final production build passed, including the logout timeout. Build warnings concern outdated Browserslist data and large existing bundles/PDF-library code; no dependency upgrades were included in this phase.

#### Production deployment checklist — user to complete

1. Record the maintenance window, release identifier, and designated normal/admin test accounts below. Keep a protected backup of the current release and database; keep `.env` and `uploads/` out of versioned documentation.
2. Stop all workers during deployment (`pm2 stop alkholi_portal` where the checked-in PM2 configuration is used). Deploy frontend and backend together, including every new service/helper/store file. Keep the existing `tokenKey` and `encKey` values; no key rotation or SQL migration is required.
3. Run `npm ci` and `npm run build` on the deployment host as required by your existing release process. Start the existing PM2 application with `pm2 restart alkholi_portal`. Avoid mixed old/new workers during this session-protocol change.
4. Refresh browser clients. Existing sessions must return to login. If an older PWA page remains cached, reload it until the new assets are active.
5. With designated accounts, complete the checks below. Do not run injection payloads or destructive database tests against production. The application continues its existing employee synchronization and other production integrations.
6. Record results and mark Phase 1 **Verified** only after all applicable checks pass. Do not start Phase 2 automatically.

| Production check                                                                                        | Result / account alias |
| ------------------------------------------------------------------------------------------------------- | ---------------------- |
| Existing browser session prompts for a fresh login                                                      | Pending                |
| Normal login for each available domain; expected profile and shortcuts                                  | Pending                |
| Refresh retains the correct employee identity                                                           | Pending                |
| Portal, administration, cards, CoC, both survey modules, and DTR load with their expected accounts      | Pending                |
| Login and CoC return navigation work in English and Arabic                                              | Pending                |
| Logout clears profile/permissions; back navigation and refresh cannot recover authenticated access      | Pending                |
| Repeating logout for a designated valid test session succeeds; its protected requests subsequently fail | Pending                |
| No unexpected authentication/SQL errors in protected production logs                                    | Pending                |

Maintenance window: **Pending**. Deployed release: **Pending**. Verified by/date: **Pending**.

#### Rollback / recovery

- Keep the site in maintenance if login or shared authorization fails. Stop all workers before replacing files; never deploy just the old frontend or just the old middleware.
- Prefer fixing forward. No database rollback is needed for a code-only Phase 1 failure; successful logins may have refreshed ordinary profile and token rows.
- Restoring the baseline release also restores its known SQL/authentication weaknesses. Keep external access blocked while such a rollback is in place, and do not treat it as a secure release. Do not rotate keys or delete session/profile tables as a troubleshooting shortcut.
- Preserve build/runtime diagnostics in a protected location; record only sanitized error codes and outcomes here, never credentials, tokens, encrypted passwords, or employee records.

### Phase 1 acceptance record — 2026-09-16

The user explicitly confirmed, “Yes, it is deployed and works fine,” in response to the Phase 1 readiness question. Phase 1 is accepted for progression to Phase 2. The original implementation/deployment checklist above is preserved as historical evidence; the deployment release, exact deployment date, and individual production-check results were not supplied and are not inferred.

### Phase 2 implementation record — 2026-09-16

**Status: Implemented — local checks passed.** Phase 2 has not been deployed or verified in production. Starting checkout: `a8af45bba8af8b5df5c69c415d8327c67909518e`, with a clean working tree. No application startup, process restart, production data/schema write, email, deployment, commit, or push was performed. Phase 3 has not started.

#### API and frontend changes

- Added unauthenticated `GET /business-cards-api/public-cards/:employeeCode`. Success is one JSON object, not a SQL recordset array. No token, role flag, administrator membership, or client-supplied identity establishes access: this operation deliberately returns already-public card data for the requested identifier.
- Identifiers must be strings of 1–20 ASCII letters, digits, underscores, or hyphens. No trimming, case normalization, numeric conversion, or truncation is performed. Leading zeros and generated `X…` identifiers are preserved. Invalid IDs return `400 { "message": "invalidEmployeeCode" }`; missing records return `404 { "message": "cardNotFound" }`; database failures or ambiguous duplicate records return `503 { "message": "serviceUnavailable" }`. Malformed percent-encoded parameters also produce the controlled `400` response.
- The service executes one fixed `SELECT TOP (2)` from `businessCards.employeeData` with `request.input('employeeCode', sql.VarChar(20), employeeCode)`. Neither SQL text nor database identifiers can be selected by the request. Pools close after success, connection failure, query failure, and missing/ambiguous results; cleanup failures do not replace the primary outcome.
- Explicit SQL and response projections contain only these 14 consumed fields: `employeeID`, `company`, `companyLogo`, `profilePic`, `fullName_a`, `fullName_e`, `arabicTitle`, `title`, `mobileNumber`, `landLines`, `faxLine`, `mailAddress`, `webSite`, and `mainColor`. `qrCodePath` and any unrelated/extra row properties are excluded. Existing null values and legacy string sentinels are retained for template compatibility.
- The public page now performs that GET and consumes its single-object response. English/Arabic loading, invalid-link, not-found, and service-failure states replace raw exception notifications and empty-record dereferences. An absent optional Nuxt route parameter is handled without requesting the literal ID `undefined`. A 15-second client timeout handles unavailable services, and request sequencing prevents late responses from replacing a newer card or updating a destroyed page. Unknown company layouts produce a controlled service state rather than a blank page.
- All nine layout selections remain: Alkholi Group, AKSTRA Consulting, AKTEK, Custom, AMOS & SBTMC Manager, BTECO, Alkholi Holding, UPMOC, and MX Reality. Templates, vCard URLs (including the custom address parameters), `/business-card/:id`, `/ar/business-card/:id`, and QR generation destinations are unchanged.
- Removed `POST /business-cards-api/open-sql-call` entirely, with no SQL-executing alias. The shared API composition in `server/businessCards/createApi.js` lets isolated HTTP tests exercise the same public/legacy router ordering and terminal JSON `404` used by production. The existing Nuxt server-middleware mount still points to `server/businessCards/main.js`; no new Nuxt mount is needed.

#### Read-only database evidence and limitations

- A separate one-off metadata inspection used the configured connection without starting the application. Automated tests never load `.env` or application entry points. Only column metadata and aggregate identifier-shape/duplicate checks were returned; no employee records, credentials, tokens, or connection details are recorded here.
- `sys.columns` / `sys.types` confirm `businessCards.employeeData.employeeID` is non-null `varchar(20)`, and all 14 selected fields exist. Aggregate checks found no IDs outside the chosen character set and no duplicate employee-ID groups. Custom `X…` IDs exist; leading-zero handling is covered by mocks even though none were observed in the aggregate snapshot.
- The inspected object has no publication/status column. Existing generation writes to `businessCards.employeeData`, and existing public viewing reads from it; row existence remains the publication rule. No new publication policy or schema change is introduced.
- Phase 2 uses no stored procedure. The Phase 1 finding that procedure definitions are unavailable remains unresolved for Phase 9; this change does not establish the safety of procedure internals or other SQL handlers.

#### Local validation and second review

- `npm run test:security`: **42 passed, 0 failed**, including all 30 Phase 1 tests and 12 new Phase 2 tests explicitly added to the package script. Mocked HTTP tests bind only to loopback. The actual remaining generic SQL router is loaded with injected SQL/auth dependencies, without importing runtime configuration; unchanged management/vCard handlers are stubbed in the isolated app.
- New coverage includes the exact public projection and typed binding, 20-character and leading-zero IDs, custom IDs, rejected injection-like inputs before database allocation, malformed URI encoding, ignored query-text/table query parameters, all nine public company responses without auth, stale bearer tolerance, safe 400/404/503 outcomes, pool cleanup, and retired endpoint `404` with/without a bearer and with a trailing slash. Remaining generic routes still reject unauthenticated requests.
- Frontend coverage executes the Vue page methods and watcher, including missing IDs, empty/unsupported responses, network failures, and out-of-order/destroyed-page responses. Real Vue/Vuetify templates render bilingual fields and original vCard links for all nine companies at 375/1280 breakpoint widths, with English/LTR and Arabic/RTL settings. These are render assertions, not browser screenshots or live vCard downloads.
- First test run: 39 passed, 2 failed because the test renderer enabled SSR before a client watcher test and the fixture did not use Nuxt's PascalCase registration for CustomLayout. Corrected both fixture issues; the next run passed 41/41. The second review added the missing-URL-ID case and exact SQL projection assertion; the full suite then passed 42/42.
- `npm run lint`: **passed (exit 0)**, including the final rerun after the optional-ID review fix.
- `npm run build`: **passed (exit 0)**, client and server compiled successfully. The completed bundle includes the optional-ID review fix and the new endpoint, with no retired-endpoint reference in the public-page bundle. Output includes the existing outdated Browserslist warning and Babel's large `vue-pdf-embed` deoptimization notice; no dependency upgrades were made. Validated on Node 24.21.0.
- The second review read the complete tracked diff and every new service/router/composition/test file, traced public requests through validation, parameter binding, response projection and error handling, and checked shared authentication remained unchanged. It also inspected generated Nuxt routes/components, template field consumers, QR generation, vCard links, cleanup, and client request races. The optional-ID behavior was found and fixed during this review.
- Independent `rg` searches across `pages`, `components`, `store`, and `server` find no remaining application call or route registration for `open-sql-call`. Retirement is additionally verified through isolated HTTP requests, not text search alone. `git diff --check` passed.
- No live AD/SQL workflow, browser visual inspection, production failure injection, card mutation, or live vCard download was performed. Production smoke checks below remain necessary.

#### Explicit residual exposure for later phases

- **Phase 9:** `GET /business-cards-api/vcard` remains public and interpolates `req.query.employeeID` into `SELECT *`. All nine public templates call it; Custom also supplies its existing address parameters. Its SQL, error handling, connection/file behavior, and output require the scheduled audit. Removing `open-sql-call` does **not** secure all public-card APIs.
- **Phases 3, 5, 6:** authenticated `POST /business-cards-api/sql-call` still executes browser SQL. Callers are `components/portal/userProfile.vue` (availability/QR), `components/administration/dtrSetup/drtAdminPopup.vue` (assignment lookup/create), and the generated-cards, card-generator, and activity-logs pages under `pages/business-cards/`. `GET /business-cards-api/hr-sql-call` also remains; no frontend caller was found. Session authentication is not administrator membership/scope enforcement.
- **Phase 6:** existing card generation, employee lookup, deletion, and logging SQL in `router/business-cards.js` remains outside this change. Existing static uploads and session/background-job behavior are unchanged. The broader SQL/access-control problem remains open.

#### Production deployment and smoke checks — user to perform

1. Record release identifier, maintenance window, and aliases for existing cards covering every available company/custom layout. Deploy frontend/backend together, including the new service/router/API-composition files and translations, during planned maintenance. Stop/restart workers only as part of the user's deployment procedure; avoid mixed versions. No schema migration is needed.
2. Run the normal `npm ci` / `npm run build` release procedure. Refresh cached/PWA clients so old code no longer calls the retired endpoint. Keep existing `/business-card/:id` links and printed QR codes unchanged.
3. In a signed-out/private browser, open existing English and Arabic public URLs and scan an existing QR. Check all nine company layouts where records exist, including a custom `X…` card; verify names/titles, image/logo, telephone/fax/email/web links, and mobile/desktop rendering. Use an existing leading-zero ID if available; do not create a production record solely for this check.
4. Download the vCard from existing ordinary and custom cards and confirm expected contact/address details. Do not send adversarial inputs to the legacy vCard endpoint.
5. Inspect `GET /business-cards-api/public-cards/<existing-id>` without a token: expect `200`, one object, the 14 listed fields, and no `qrCodePath`/unrelated data. Use an agreed nonexistent valid ID: expect `404 cardNotFound` and the translated page state. A benign invalid ID such as 21 ASCII digits must return `400 invalidEmployeeCode`; `/business-card` without an ID must display the translated invalid-link state.
6. Send `POST /business-cards-api/open-sql-call` with the harmless JSON body `{}` and no bearer: expect `404`, never a SQL result. Do not send SQL/injection payloads to production. For the service-failure UI, use browser request blocking/offline mode; do not disconnect production SQL or simulate database failures there. Server-side 503 handling is covered by mocks.
7. Confirm normal login, refresh and logout with a designated account, and public viewing while signed out and signed in as an ordinary user. No card administrator membership should be required for public viewing. Check protected production logs for unexpected failures without copying sensitive contents into this document.
8. Card verification is read-only: do not generate/edit/delete cards, assignments, or memberships. Any additional production write test requires separate authorization and designated test records; record prior values before writing and restore them afterward. Record actual results below and mark Phase 2 **Deployed**, then **Verified**, only after those events occur. Stop before Phase 3.

Maintenance window: **Pending**. Deployed release: **Pending**. Card/account aliases and smoke results: **Pending**. Verified by/date: **Pending**.

#### Rollback / recovery

- If verification fails, keep affected business-card functionality under maintenance and preserve sanitized diagnostics. Fix forward where possible. This phase has no schema/data migration to undo.
- Never restore an accessible release that reintroduces `open-sql-call`, including an unmodified Phase 1 release. A rollback candidate must retain the retirement boundary and compatible public frontend/backend lookup, or remain inaccessible under maintenance until corrected.
- Replace frontend/backend atomically and refresh browser/PWA caches. Do not restore only the old public page: it requires the retired endpoint. Preserve existing card rows, uploaded assets, URLs, and QR images; no data deletion or regeneration is required for rollback.

### Phase 2 acceptance record — 2026-09-22

The user explicitly confirmed that Phase 2 was deployed, verified, and accepted and authorized progression to Phase 3. The detailed production aliases, release identifier, and individual Phase 2 smoke-test results were not supplied and are not inferred. Phase 2 is recorded as **Verified** from that confirmation.

### Phase 3 implementation record — 2026-09-22

**Status: Implemented — local checks passed.** Phase 3 has not been deployed or verified in production. Starting checkout: `658e43f`, with a clean working tree. Phase 2 acceptance was confirmed before any Phase 3 edit. No application startup, process restart, production data/schema write, email, deployment, commit, or push was performed. Phase 4 has not started.

#### API, database, file, and frontend changes

- Kept `POST /portal-api/get-user-profile`, `POST /portal-api/save-user-profile`, and `POST /portal-api/get-user-authorizations`. Shared Phase 1 authentication runs before each operation, and the only subject identity is `req.auth.employeeCode`. JSON, query-string, and multipart employee identifiers are ignored and cannot select a different employee.
- Profile reads explicitly return only `profilePicPath` and `portalProfilePicPath`. Authorization reads return the existing six booleans: `isPortalAdmin`, `isBusinessCardsAdmin`, `isCOCAdmin`, `isElevatorsSurveysUser`, `isHRSurveysUser`, and `isDTRUser`. One fixed query evaluates membership in the six server-owned tables for the authenticated employee; request roles and client flags are not accepted.
- Added authenticated `GET /portal-api/my-business-card`. It returns exactly `{ "hasCard": false, "qrCodePath": null }` when no row exists, or `{ "hasCard": true, "qrCodePath": <string-or-null> }` for the caller's card. Duplicate rows and database failures return a controlled `503`. Responses use `Cache-Control: no-store`.
- Replaced all affected interpolated SQL and procedure calls with fixed server-owned statements and typed `mssql` inputs. Employee codes bind as `varchar(20)`, generated portal-photo filenames as `nvarchar(300)`, and photo-origin flags as `bit`. No SQL text, table, column, procedure, or employee identity is accepted from the browser.
- Profile photo replacement uses one SQL transaction with locking for the authenticated `usersInfo` row. It updates `usersInfo` plus matching `admin_members`, `business_card_admins`, `coc_admins`, `elevators_users`, `hr_surveys_users`, and `dtr_users` rows together. A database failure rolls back these writes and attempts to remove only the new generated file.
- Upload authentication runs before Multer. Files are limited to one PNG/JPEG of at most 5 MiB, receive server-generated UUID filenames, and must have a matching PNG/JPEG signature. Missing, invalid, wrong-type, and oversized uploads receive translated controlled errors. The old file is removed only after commit, only when its path resolves directly inside the profile-upload directory, and only when no other profile or membership row still references it. A missing old file is harmless; unsafe/shared paths remain untouched; a cleanup failure returns successful profile replacement with `cleanupPending: true` and leaves only the unremoved old file for controlled follow-up.
- The portal store no longer sends cached employee IDs in profile, authorization, or multipart requests. The profile component uses only `/portal-api/my-business-card`; no portal/profile caller sends SQL to the generic business-card endpoint. Card and profile responses retain token/request-generation guards so delayed responses cannot restore or display signed-out state.
- Preserved the existing HR-photo, default `profile.png`, and portal-photo URL fallbacks, success notification key, public-card URLs, English/Arabic UI, and localized card link. Added English/Arabic messages for invalid type/content, size, missing profile, and service failures.
- The portal API now has a dependency-injected composition used by production and isolated HTTP tests. Unknown portal API paths return JSON `404`; `/portal-api/profile-data/...` remains available with its existing URL behavior.

#### Read-only database evidence and limitations

- A one-off read-only metadata inspection used the configured SQL connection without importing the application entry point or starting Nuxt. No credentials, connection details, tokens, or employee rows were printed or recorded.
- `sys.parameters` confirmed the legacy profile/membership procedures use `varchar(20)` employee IDs, `nvarchar(300)` photo names, and `bit` flags. `sys.columns` confirmed `dbo.usersInfo`, all six membership tables, and `businessCards.employeeData` have the fixed columns used by this phase; `businessCards.employeeData.qrCodePath` is `varchar(25)`.
- The implementation uses direct fixed statements rather than the legacy profile/membership procedures, so inaccessible procedure bodies are not relied on for Phase 3 query construction. The earlier finding that stored-procedure definitions are unavailable remains relevant to the Phase 9 audit and is not considered resolved globally.
- No schema migration is required. Public profile-image serving remains unchanged and broader static-document hardening remains deferred. Live SQL failure injection, concurrent production uploads, filesystem-permission failures, and visual browser inspection were not performed locally.

#### Local validation and second review

- `npm run test:security`: **53 passed, 0 failed**. The package script explicitly includes the new `tests/security/portal-profile.test.js`; 11 Phase 3 tests ran alongside all 42 prior tests. Tests use mocked SQL, test-only signed sessions, temporary upload directories, and loopback-only isolated Express servers. They do not load `.env` or import the application entry point.
- Phase 3 coverage includes typed bindings and fixed projections; all six permission flags; card-present/no-card/duplicate/failure states; JSON/query/multipart identity spoofing; missing/revoked sessions; authentication-before-upload; valid, missing, wrong-type, signature-mismatched, oversized, and database-failed uploads; transaction/propagation statements; missing/unsafe/shared/locked old files; pool and new-file cleanup; fallback URLs; frontend removal of identity and SQL payloads; English/Arabic error keys; and delayed profile/permission/card responses after logout.
- The first isolated Phase 3 run reported 8 passes and 2 failures caused by assertions in the new tests; the assertions were corrected without weakening behavior. The next isolated run passed. The first lint run found three unnecessary `async` modifiers in the new service; they were removed. Final `npm run lint`: **passed (exit 0)**.
- Final `npm run build`: **passed (exit 0)**; client and server compiled successfully. Output retains the existing outdated Browserslist notice, large-bundle warnings, and Babel deoptimization notice for `vue-pdf-embed`; no dependency update was included.
- The required second review traced each route through shared authentication, `req.auth`, validation, typed inputs, fixed queries, response/error handling, transaction boundaries, and filesystem cleanup. It found that a legacy filename might be shared by another row; the transaction was strengthened to check every affected profile/membership table before deletion, and a regression test was added. The final full suite, lint, build, and `git diff --check` passed after that fix.
- Independent searches find no `business-cards-api/sql-call`, `business-cards-api/hr-sql-call`, request-derived employee identity, or interpolated SQL in `components/portal`, `store/portal`, or `server/portal`. Isolated HTTP tests prove spoofed fields cannot select another employee and missing/revoked sessions receive `401`. The prior Phase 2 HTTP suite still proves retired `open-sql-call` paths return `404`.

#### Explicit residual exposure for later phases

- The authenticated `/business-cards-api/sql-call` endpoint intentionally remains for Phases 5–6. Its remaining frontend callers are the generated-cards, card-generator, and activity-logs pages plus `components/administration/dtrSetup/drtAdminPopup.vue`. The profile component is no longer a caller. `/business-cards-api/hr-sql-call` also remains; no frontend caller was found.
- Administration and DTR generic SQL endpoints, business-card management SQL, the public vCard interpolation described in Phase 2, and role enforcement outside this phase remain unresolved. Phase 3 secures portal identity/profile access only; it does not complete the broader SQL/access-control plan.

#### Production deployment and smoke checks — user to perform

1. Record the maintenance window, release identifier, and aliases for a normal account with a card, a normal account without a card, an account covering each permission flag, and—only if separately authorized—a designated photo-write test account. Record the photo test account's current `portalProfilePicPath`, existing file, and matching `profilePicPath` / `hrPicture` / `portalPicture` values in every membership table where it has a row. Protect these records outside this document.
2. Stop all workers during deployment and deploy frontend/backend together, including the portal service/router/composition files, store/component bundle, translations, and tests. Use the existing release procedure (`npm ci`, `npm run build`, then the configured PM2 restart). No SQL migration is needed. Refresh cached/PWA clients and avoid mixed old/new workers.
3. Read-only checks first: sign in with each designated account; refresh; confirm the correct profile image fallback and all six expected shortcuts in English and Arabic. In browser developer tools, verify profile and authorization POST bodies are empty and `GET /portal-api/my-business-card` returns only `hasCard` and `qrCodePath` for the signed-in account.
4. For card-present and no-card accounts, confirm the QR shortcut respectively appears or stays absent, opens the same employee's localized public-card URL, and survives refresh. Confirm an existing signed-out Phase 2 public card still renders in English and Arabic and `POST /business-cards-api/open-sql-call` with harmless `{}` still returns `404`.
5. With a disposable test session, call each protected portal endpoint without a bearer and after logout/revocation; expect `401 authFailed`. Use browser throttling to delay profile, permission, and card responses, log out before they complete, and confirm the cleared profile/shortcuts do not return.
6. In a non-production staging environment, add a mismatched benign employee ID to the profile/authorization JSON or query string and confirm the response still belongs to the signed-in account. Do not probe other employees or send SQL/injection payloads to production.
7. Perform a production photo replacement only with separate authorization for the designated record. Upload a valid PNG/JPEG under 5 MiB, verify the profile and any applicable membership lists show the new image, and confirm other employees are unchanged. Exercise invalid/missing/oversized uploads in staging or browser-side validation, not by placing arbitrary files on production.
8. Immediately restore the authorized photo test: restore the recorded database values and original file through the approved operational procedure, verify every affected profile/membership row and UI, and remove only the newly generated unreferenced test file. Never recursively delete the upload directory or delete a file still referenced by any row.
9. Check sanitized production logs for unexpected `401`, `404`, `503`, transaction, upload, or cleanup failures without copying sensitive data here. Record actual outcomes below and mark Phase 3 **Deployed**, then **Verified**, only after deployment and all applicable checks succeed. Stop before Phase 4.

Maintenance window: **Pending**. Deployed release: **Pending**. Account/test-record aliases and smoke results: **Pending**. Verified by/date: **Pending**.

#### Rollback / recovery

- Keep portal profile, permission, and card-shortcut functionality under maintenance if verification fails. Prefer fixing forward. This phase has no schema migration to reverse; failed SQL photo writes roll back as a unit, although a failed filesystem cleanup can leave an unreferenced generated file that must be reviewed individually.
- Do not restore an accessible older release that lets browser employee IDs select profile/permission targets or makes the profile component send SQL. A rollback candidate must preserve the Phase 1–3 identity boundary and Phase 2 `open-sql-call` retirement. If no such release exists, keep the affected endpoints/UI unavailable until corrected.
- Replace frontend/backend atomically and refresh browser/PWA caches. Do not restore only the old profile component or only the old portal routers. Preserve existing profile rows, membership flags, card rows, and uploaded images.
- For an authorized photo-write recovery, compare the designated record with the pre-test values, restore those exact values and original file through the approved operational process, and verify no other row references a candidate cleanup file before deleting that single file. Do not rotate keys, clear sessions/tables, or delete the upload directory as a troubleshooting shortcut.

### Phase 3 deployment and production smoke record — 2026-09-29

**Status: Deployed — read-only production smoke partially passed.** The user confirmed that Phase 3 was deployed and authorized live browser checks at `https://portal.alkholi.com/`. An earlier draft of this record incorrectly treated deployment as confirmation of complete verification; the progress table is corrected to **Deployed**. The release identifier, maintenance window, and designated account aliases were not supplied and are not inferred. Phase 4 has not started.

Checks completed through the live browser with one authenticated account:

- The English portal loaded the authenticated employee's profile with the existing no-photo fallback, a QR/card shortcut for that employee, and the expected permission-based shortcuts for the account. The HR-survey shortcut was not present for this account. A refresh retained the same authenticated identity and shortcuts.
- The Arabic portal loaded in RTL with localized labels. After requests settled, it showed the same employee profile, QR/card shortcut, and expected shortcuts. The Arabic view also survived refresh.
- The employee's existing public card opened successfully in both English and Arabic from the localized portal link, preserving the Phase 2 public URL behavior.
- Direct unauthenticated navigation to `GET /portal-api/my-business-card` returned `{"message":"authFailed"}` rather than card data.
- Logout reached `/login`. A subsequent fresh navigation to `/` remained on `/login`; the profile, QR, and permission shortcuts did not reappear.

Production verification still pending:

- No designated no-card account or accounts covering every permission flag were supplied, so the explicit no-card result and all six membership combinations were not exercised live.
- No production photo replacement, invalid upload, database-failure, or filesystem-cleanup case was run. These require staging or separate authorization for a designated production record, with previous values recorded and restored afterward.
- No live request-body inspection, mismatched-ID tampering, SQL/injection probe, or deterministic delayed-response race was performed. Identity-spoofing and delayed-response behavior remain covered by the isolated regression suite; production request-body inspection and throttled logout still require a designated test session.
- The live `POST /business-cards-api/open-sql-call` `404` was not independently checked. The built-in browser rejected the local `data:` form needed to issue a bodyless POST because its navigation policy permits only HTTP(S); direct address-bar navigation can issue only GET. No workaround, SQL payload, or authenticated request was attempted. Sanitized production logs, the release identifier, and the maintenance window were also not independently checked.

Do not mark Phase 3 **Verified** until the applicable pending checks are completed and recorded. Do not start Phase 4 automatically.

### Phase 3 acceptance record — 2026-09-29

Before any Phase 4 edit, the user was asked whether Phase 3 (recorded as **Deployed** with partial smoke checks) was accepted, and answered “Yes, Phase 3 accepted.” Phase 3 is accepted for progression to Phase 4. The pending Phase 3 checks listed above were **not** performed and remain open; the status stays **Deployed** rather than being upgraded to **Verified** by inference.

### Phase 4 implementation record — 2026-09-29

**Status: Implemented — local checks passed.** Phase 4 has not been deployed or verified in production. Starting checkout: `3381ea8`, with only the user's uncommitted edits to `AGENTS.md`, `CLAUDE.md`, and this document (preserved). No application startup, process restart, production data/schema write, email, deployment, commit, or push was performed. Phase 5 has not started.

#### API, authorization, and frontend changes

- Added `GET /administration-api/members/:module`. Exactly six resource names are accepted: `portal` → `dbo.admin_members`, `business-cards` → `dbo.business_card_admins`, `coc` → `dbo.coc_admins`, `elevators` → `dbo.elevators_users`, `hr-surveys` → `dbo.hr_surveys_users`, `dtr` → `dbo.dtr_users`. A `Map` selects one of six frozen, server-written statement sets; the route value is never placed in SQL. Anything else — case variants, table names, `__proto__`/`constructor`/`toString` (also percent-encoded), non-strings — returns `400 { "message": "invalidModule" }` before any database pool is opened. Rows are explicitly projected to the eight consumed fields (`_id`, `employeeID`, `fullName`, `title`, `mailAddress`, `profilePicPath`, `hrPicture`, `portalPicture`); `branch` is no longer sent. Responses use `Cache-Control: no-store`.
- Added reusable server-side role checks in `server/shared/roles.js`: `createRoleChecks({ sql, portalConfig }).hasRole(role, employeeCode)` and `requireRole(roleChecks, role)` middleware for `portalAdmin`, `businessCardsAdmin`, `cocAdmin`, `elevatorsUser`, `hrSurveysUser`, and `dtrUser`. Each role runs one fixed parameterized `EXISTS` query against its own table only; no role implies another (portal administrators do not implicitly hold module roles). Membership is evaluated on every request, so revocation applies to the next request. Unknown role names throw at configuration time. The caller is taken only from `req.auth.employeeCode`; missing identity → `401 authFailed`, non-member → `403 forbidden`, role-check failure → `503 serviceUnavailable`.
- Every administration route now runs the shared `authorize` middleware followed by `requireRole(..., 'portalAdmin')`: the new list endpoint; all twelve existing mutation URLs (`/add-` and `/delete-` for `portal-admin`, `business-card-admin`, `coc-admin`, `elevators-survey-admin`, `hr-survey-user`, `dtr-user`); `POST /get-employee-info`; and the legacy `POST /sql-call` and `POST /hr-sql-call`. Mutation URLs, request bodies (`{ code }`), and success response shapes are unchanged. Unknown administration paths return JSON `404 notFound`; malformed JSON or percent-encoding returns JSON `400 invalidRequest` rather than an HTML error page.
- The target employee (`body.code`) is validated separately from the caller: a string of 1–20 ASCII letters, digits, `_` or `-`, with no trimming, case change, or numeric conversion (leading zeros preserved). Otherwise `400 invalidEmployeeCode`, before any SQL. Codes longer than the HR key (`varchar(15)`) are reported as missing HR data without querying, so they cannot be truncated into a different lookup.
- The seven legacy routers (`portalAdmins`, `businessCardsAdmins`, `cocAdmins`, `elevatorsSurveyAdmins`, `hrSurveys`, `dtrUsers`, `dtrSetup`) were replaced by `router/memberships.js` and `services/memberships.js`. HR employee, HR title, and portal-picture lookups bind `employee_code varchar(15)`, `system_code varchar(15)`, `branch_code varchar(10)`, and `employeeID varchar(20)`. The existing numeric position comparison is preserved (`'0042'` still matches title code `42`).
- **Add:** a pre-check keeps the existing precedence (`memberExist` before HR checks). One fixed batch then runs `SET XACT_ABORT ON`, opens a transaction, re-checks existence `WITH (UPDLOCK, HOLDLOCK)`, calls the existing `dbo.<table>_addData` procedure with named, typed parameters (`varchar(20/50/150/50/50)`, `nvarchar(300)`, `bit`), confirms the row exists, and commits. This closes the check-then-insert race even for `coc_admins` and `dtr_users`, which have no unique key on `employeeID`. A duplicate-key error (2627/2601) is also mapped to `memberExist`. The final status row is read from the last recordset, so procedure result sets cannot be mistaken for it.
- **Delete:** one fixed batch locks and counts the target's rows, calls the existing `dbo.<table>_deleteMember @memberID`, recounts, and commits. It returns `404 notFound` when no row existed and `503` if the procedure removed nothing. It never claims success without an observed removal.
- **HR data handling:** missing HR employee or title data returns `404 employeeInfoMessing` (existing code). Missing required `fullName`/`mailAddress` (NOT NULL columns) now also returns `employeeInfoMessing`; the old handlers stored the literal text `'null'`. Values exceeding the observed column sizes return `422 employeeInfoInvalid` instead of being silently truncated. Picture selection is portal photo, then non-empty HR photo, then `profile.png` (the old code could store an empty HR path).
- Status codes for existing error messages changed from `500` to `409 memberExist`, `404 notFound`/`employeeInfoMessing`, and `503 serviceUnavailable`. The frontend reads only `message`, so notifications are unchanged. Database/exception text is no longer returned by any administration route, including the legacy SQL routes.
- The six list stores now call `GET /members/<resource>` with no body. The add/delete/lookup stores use the shared `authErrorMessage` helper, so English/Arabic messages are translated and network errors without a response no longer throw. On a failed list request the list is cleared, so a revoked administrator does not keep seeing stale membership. English and Arabic messages were added for `invalidEmployeeCode`, `employeeInfoInvalid`, `forbidden`, `authFailed`, `serviceUnavailable`, and the new `administration.members` list namespace (including `invalidModule`). Components, layouts, and page URLs are unchanged.
- `server/administration/createApi.js` composes the API from injected dependencies (the `server/portal/createApi.js` pattern). `main.js` remains the only runtime entry point and keeps the existing `/administration-api` mount in `nuxt.config.js`.

#### Read-only database evidence and limitations

- A one-off read-only metadata script used the configured connection without importing application entry points or starting Nuxt. It printed only schema metadata and aggregates; no employee rows, credentials, tokens, or connection details were output or recorded.
- **Membership tables:** all six share the same columns: `_id int identity`, `employeeID varchar(20) NOT NULL`, `fullName varchar(50) NOT NULL`, `title varchar(150) NULL`, `profilePicPath nvarchar(300) NULL`, `mailAddress varchar(50) NOT NULL`, `branch varchar(50) NULL`, `hrPicture bit`, `portalPicture bit`. `admin_members`, `business_card_admins`, `elevators_users`, and `hr_surveys_users` have a primary key on `employeeID`. `coc_admins` is keyed only on `_id`, and `dtr_users` has no index. None of the six tables has triggers or default constraints.
- **Procedures:** `sys.parameters` confirmed all 18 procedures (`_addData`, `_checkIfExist`, `_deleteMember` for each table). Their parameter names and types exactly match the bound inputs; the delete procedures take `@memberID varchar(20)`. `OBJECT_DEFINITION` still returns `NULL` for every procedure, so their internal SQL and any hidden side effects remain unverified (Phase 9). The existence checks now use fixed `EXISTS` queries instead of `_checkIfExist`.
- **HR (`Menaitech`):** `Pay_employees.employee_code varchar(15)`, `branch_code varchar(10)`, `position varchar(15)`, `employee_name_eng varchar(512)`, `Email varchar(100) NULL`, `employee_picture varchar(900)`; `pay_code_tables.system_code varchar(15)`, `branch_code varchar(10)`, `system_desp_e varchar(550)`. Aggregates: employee codes are unique, all within the accepted character set, and at most 6 characters long. No duplicate type-21 title rows exist. Maximum observed lengths are Email 39, picture 69, branch 9, and English title 74. The maximum observed English name is **52 characters, above the 50-character `fullName` column**. At least one HR employee therefore cannot be added until the data or schema is corrected; previously such names were silently truncated.
- **Compile-only check:** all 33 fixed statements (six modules × exists/list/add/delete, six role checks, portal-picture, and both HR lookups) were compiled against the live schemas inside `IF 1 = 0 BEGIN … END` with typed `DECLARE`s, so they were parsed and name-bound but never executed. **33/33 compiled.** A negative control confirmed the method rejects an unknown column (error 207) and a syntax error (156). Procedure parameter binding happens only at run time and is covered by the metadata comparison, not by this check.
- No schema migration is required.

#### Local validation and second review

- `npm run test:security`: **70 passed, 0 failed** (exit 0) on Node 24.21.0. This is the 53 prior tests plus 17 in the new `tests/security/administration.test.js`, which was added explicitly to the package script; the test runner output lists all 17 by name. Tests use mocked `mssql`, test-only signed sessions, the real `createAuth`/`createRoleChecks`/membership service/legacy SQL router, and loopback-only isolated Express servers. They do not load `.env` or import `server/*/main.js`.
- Coverage includes:
  - the exact six-name allowlist and its frozen fixed statements, plus prototype-like, encoded, and non-string names;
  - typed bindings and observed sizes for all inputs, with no values in SQL text, the exact projection, and pools closed on success and failure;
  - list/add/remove through HTTP for all six resources, plus `get-employee-info` and admin use of the legacy routes;
  - `403` with only the role query executed for an authenticated non-administrator who holds every other module role, on all 20 protected routes;
  - spoofed body, query, and header identity or role flags;
  - `401` for missing, tampered, and revoked sessions before any SQL;
  - revoked portal-admin membership taking effect on the next request;
  - invalid and injection-like target IDs; duplicates, including the concurrent-insert race and duplicate-key errors; missing HR, title, name, or email; oversized data; procedure result sets; unremoved deletes;
  - SQL, connection, and role-check failures returning `503` without detail; malformed JSON and percent-encoding; unknown routes;
  - the real Vuex stores (GET URL with no body, list clearing, translated 403, network failures, unchanged mutation URLs and payloads), English/Arabic key presence, and a source scan confirming that the only remaining administration generic-SQL callers are the six DTR setup pages using the `adminPage` layout.
- **First runs:**
  - The first new-test run was 15 passed and 2 failed. Service methods threw synchronously for invalid input instead of rejecting, which was fixed by making them `async` (same HTTP behavior). A test compared arrays created in a different VM realm by reference, which was fixed by comparing structurally.
  - The first lint run flagged one `import/order` error in `server/administration/main.js`, which was fixed.
  - Prettier formatting was applied to the new files.
- **Second review:** the complete diff and every new file were read, and each request was traced from caller through `authorize`, `requirePortalAdmin` (`req.auth`), validation, typed binding, response, and error handling. The review found that malformed JSON bodies or malformed percent-encoded route parameters fell through to Express's default HTML error page. A JSON error handler (`400 invalidRequest`, otherwise `503`) and regression tests were added. No other finding. `rg` confirmed no remaining references to the deleted routers; the one `router/hrSurveys.js` hit is the separate `server/hrSurveys` module.
- **Final checks after all changes:**
  - `npm run test:security`: 70/70 passed (exit 0).
  - `npm run lint`: passed (exit 0).
  - `git diff --check`: passed.
  - `npm run build`: passed (exit 0); client and server compiled successfully. Output retains the existing outdated-Browserslist, large-bundle, and Babel `vue-pdf-embed` deoptimization notices; no dependency was changed. The client bundle contains `administration-api/members/` and no `SELECT * FROM dbo.<membership table>` text.
- **Independent searches:** no membership store or administration component sends SQL. The only request-derived values in administration server code are `body.code` (validated target), `params.module` (Map key only), and `body.query` in the legacy SQL router. All `${…}` interpolations in the new SQL builders are server constants evaluated once at load time.
- No live AD/SQL workflow, browser visual inspection, production mutation, or failure injection was performed locally.

#### Explicit residual exposure for later phases

- **Phase 5 — administration generic SQL:** `POST /administration-api/sql-call` (portal DB) and `POST /administration-api/hr-sql-call` (HR DB) still execute SQL text from the browser. Callers: `pages/administration/dtr-setup/index.vue`, `divisions/_divisions.vue`, `departments/_departments.vue`, `projects/_projects.vue`, `sub-projects/_subProjects.vue`, and `sub-project/_subProject.vue`. They now require current portal-administrator membership and return sanitized errors. **Role gating does not remove arbitrary-SQL execution for portal administrators or anyone holding an administrator's token.** Remove these routes in Phase 5.
- **Phases 5–6 — business-card generic SQL (unchanged here, as required):** `POST /business-cards-api/sql-call` is still reachable by **any authenticated user**, not just administrators. `components/administration/dtrSetup/drtAdminPopup.vue` still uses it for the assignment duplicate check and `dtr.adminAssignment_addData`, interpolating the values returned by `get-employee-info`. The generated-cards, card-generator, and activity-logs pages also use it. `GET /business-cards-api/hr-sql-call` also remains. This is the most significant open SQL exposure.
- **Carried from Phase 2:** the public vCard interpolation remains.
- **Phase 9:** procedure bodies are unreadable. Any logic inside `_addData`/`_deleteMember` is trusted but unaudited.
- **Behavior notes:**
  - An administrator can still remove themselves or the last portal administrator (unchanged; no business policy supplied).
  - `coc_admins` and `dtr_users` may already contain duplicate rows. A delete that removes only some rows is reported as success, and the remaining row stays visible.
  - HR records with names over 50 characters or no email can no longer be added; correct the HR data or assess a schema change.

#### Production deployment and smoke checks — user to perform

1. Record the maintenance window, release identifier, and aliases for: a portal-administrator account; an ordinary authenticated account with **no** portal-admin membership, ideally one holding another module role; and, only if separately authorized, one designated test employee code for membership writes. No SQL migration or key change is needed.
2. Stop all workers and deploy frontend and backend together. This includes `server/shared/roles.js`, `server/administration/{createApi.js,main.js,router/,services/}` with the seven old router files removed, the administration stores, the locales, and the tests. Run the existing `npm ci` / `npm run build` / PM2 restart procedure, refresh cached/PWA clients, and avoid mixed old/new workers.
3. **Read-only checks first, as the portal administrator:**
   - Open each of the six membership screens in English and Arabic.
   - Confirm names, IDs, emails, titles, and photos match the pre-deployment view.
   - In developer tools, confirm each list is a bodyless `GET /administration-api/members/<resource>` returning `200` without `branch`, and that no `administration-api/sql-call` request is made by these screens.
   - Open DTR setup and navigate company → branch → division → department → project → sub-project; confirm the lists still load.
   - Open the assignment popup and look up an existing employee code without saving.
4. **As the ordinary account:**
   - Direct navigation to `/administration` must redirect to the portal.
   - `GET /administration-api/members/portal` with that session must return `403 {"message":"forbidden"}`.
   - Without a session it must return `401`.
   - As the administrator, `GET /administration-api/members/unknown` must return `400 invalidModule`.
   - Do not send SQL, injection payloads, or other employees' IDs to production.
5. **Only with separate authorization:**
   - First record whether the designated test employee is present in the chosen membership table(s), with their full row values.
   - Add them on one screen: expect success, then an immediate re-add showing the translated duplicate message.
   - Remove them: expect success, then a repeat removal showing the not-found message.
   - Restore the recorded pre-test state exactly: re-add if originally present and compare the row; leave absent if originally absent.
   - Never test by removing a real administrator. For the revocation check, temporarily add a designated test account as portal admin, confirm access, remove it, then confirm the same signed-in session now receives `403` without logging out. Restore the original state afterwards.
6. Check sanitized production logs for unexpected `401`, `403`, `404`, or `503` responses on administration, portal, business-card, DTR, CoC, and survey routes, confirming no cross-module caller was blocked. Record outcomes below and mark Phase 4 **Deployed**, then **Verified**, only after those events occur. Do not start Phase 5 automatically.

Maintenance window: **Pending**. Deployed release: **Pending**. Account/test-record aliases and smoke results: **Pending**. Verified by/date: **Pending**.

#### Rollback / recovery

- If verification fails, keep the administration screens under maintenance and preserve sanitized diagnostics. Prefer fixing forward. This phase has no schema migration to reverse.
- Any membership write made during testing must be restored from the values recorded in step 5. Mutations are transactional, so a failed add or delete leaves no partial membership change.
- Do not restore an accessible release that lets the six stores post SQL or lets non-administrators reach administration mutations and generic SQL routes; every pre-Phase-4 release does both. A rollback candidate must also preserve the Phase 1–3 identity boundary and the Phase 2 `open-sql-call` retirement. If none exists, keep `/administration` and `/administration-api` unavailable (for example at the reverse proxy) until fixed.
- Replace frontend and backend atomically and refresh browser/PWA caches. Do not restore only the old stores (they require the retained legacy SQL route and would bypass the new endpoint) or only the old routers.

### Phase 4 acceptance record — 2026-09-30

Before any Phase 5 edit, the user was asked whether Phase 4 (recorded as **Implemented** only) had been tested and accepted, and chose “Accepted, deployed”. Phase 4 is accepted for progression to Phase 5 and its status is recorded as **Deployed** from that confirmation. The release identifier, maintenance window, account aliases, and individual Phase 4 smoke-check results were not supplied and are not inferred, so the status is not upgraded to **Verified**.

### Phase 5 implementation record — 2026-09-30

**Status: Implemented — local checks passed.** Phase 5 has not been deployed or verified in production. Starting checkout: `fc7c560`, with a clean working tree. No application startup, process restart, production data/schema write, email, deployment, commit, or push was performed. Phase 6 has not started.

#### API contracts

All routes are under `/administration-api`, run the shared `authorize` middleware followed by `requireRole(..., 'portalAdmin')` (the Phase 4 helper, evaluated on every request), and return JSON. Read routes send `Cache-Control: no-store`. Path values are strings of 1–10 ASCII letters, digits, `_` or `-`; the text `undefined` (any case) is rejected as a code. Each level requires **exactly** its own path fields: a missing, repeated, malformed, or extra path field returns `400 invalidPath` rather than being reinterpreted as another level. Unrelated fields are ignored.

| Route | Input | Success |
| ----- | ----- | ------- |
| `GET /dtr-setup/organization/:kind` | `kind` ∈ `companies`, `branches` (no query); `divisions` (`branch`); `departments` (`branch`, `division`); `projects` (+ `department`); `sub-projects` (+ `project`) | `200` array. Companies: `company_code`, `company_desc_a`, `company_desc_e`, `comp_logo`. Branches: `branch_code`, `branch_name_a`, `branch_name_e`, `logo`. Others: `system_code`, `system_desp_a`, `system_desp_e` (sub-projects also `division_code`). |
| `GET /dtr-setup/employees/:level` | `level` ∈ `division` (`branch`, `division`), `department` (+ `department`), `project` (+ `project`), `sub-project` (+ `subProject`), as query values | `200` array of `employee_code`, `employee_name_eng`, `employee_name_a`, `employee_picture`, `Email` |
| `GET /dtr-setup/assignments/:level` | same levels and query values | `200` array of `id`, `employeeCode`, `adminName`, `picPath`, `isHrPic`, `isPortalPic`, `isDTRAdmin`, `isApprover`, `isManpowerAdmin`, `isMigrator`, `isReportAdmin` (integers, as stored) |
| `POST /dtr-setup/assignments/:level` | JSON body: the level's path fields, `employeeCode`, and optional booleans `isDTRAdmin`, `isApprover`, `isManpowerAdmin`, `isMigrator`, `isReportAdmin` | `201 { "message": "assignmentAdded" }` |

Errors: `400 invalidLevel`, `400 invalidPath`, `400 invalidRoles`, `400 invalidEmployeeCode`, `400 invalidRequest` (malformed JSON/encoding), `401 authFailed`, `403 forbidden`, `404 pathNotFound`, `404 employeeInfoMessing`, `409 assignmentExists`, `422 employeeInfoInvalid`, `503 serviceUnavailable`. No database or exception text is returned. Empty branches of the hierarchy return `200 []`.

`POST /administration-api/get-employee-info` (Phase 4) is reused unchanged for the popup's employee lookup.

**Removed:** `POST /administration-api/sql-call` and `POST /administration-api/hr-sql-call`, with `server/administration/router/sqlCalls.js` deleted. They now reach the API's terminal JSON `404 notFound` for every method and caller. No alias executes supplied SQL.

#### Implementation and material decisions

- `server/administration/services/dtrSetup.js` holds every statement as a module constant selected through `Map`s keyed by the allowlisted `kind`/`level`. Request values are bound as `varchar(10)` inputs (`branchName` as `varchar(100)`); no table name, column, or SQL fragment comes from the browser. `server/administration/router/dtrSetup.js` and `createApi.js` compose it; `main.js` injects `mssql`, both configs, and `memberships.getEmployeeInfo`.
- **HR mappings preserved as traced from the old pages** (UI labels do not match HR names): `pay_code_tables.system_code_type` `41` = division, `42` = department (`major_code` = division), `71` = project (`major_code` = division, `section_code` = department), `72` = sub-project (additionally `division_code` = project). On `Pay_employees`, the UI division is `department`, the UI department is `section`, the UI project is `Division`, and the UI sub-project is `Unit`.
- **Employee lists** keep the active filter (`pay_emp_finance.stop_val_flag = 0`) and are always scoped to `branch_code` and the division, so equal codes in other branches are not mixed. The existing rules are kept: division level lists the whole division; department level lists division employees whose project code is one of the department's projects; project level lists employees whose unit is one of the project's sub-projects; sub-project level matches the full path. The old per-child browser loops became one statement per level using `EXISTS`.
- **Sentinel compatibility:** levels below an assignment are still stored and matched as the text `undefined`, only inside `storedPath()` in the service. The API and frontend omit those fields. No assignment data was migrated.
- **Assignment creation** is one server operation. The employee is resolved through the trusted Phase 4 lookup (HR employee, HR title, portal picture); the requested path is resolved against HR, requiring the branch and every ancestor to exist, and the HR-stored codes are what is written. One fixed batch then sets `XACT_ABORT`, opens a transaction, checks for the same employee on the same path `WITH (UPDLOCK, HOLDLOCK)`, calls the existing `dtr.adminAssignment_addData` with named typed parameters, confirms the row exists, and commits; any error rolls back. Because the table has no unique key on those columns (see evidence), the held range lock is what prevents concurrent duplicates. No constraint or migration was added.
- Browser-supplied names, emails, companies, picture paths, and picture flags are ignored. Stored values: `employeeCode` and `adminName` from HR, `adminCompany` = the employee's HR branch code (as before), `picPath`/`isHrPic`/`isPortalPic` from the portal-then-HR-then-default picture rule.
- **Role flags** are stored exactly as selected. The server repeats the popup's rules (at least one flag; DTR admin and site manager not both) and returns `400 invalidRoles` otherwise. No flag is used as an access policy anywhere in this phase. No edit or delete endpoint was added; `PUT`/`PATCH`/`DELETE` return `404`.
- **Employees without an HR email remain assignable.** `adminEmail` is `NOT NULL`; the old popup stored the literal text `null` for them. The server now stores an empty string. 268 of 2,191 active employees currently have no email, so rejecting them (as Phase 4 does for membership lists) would have blocked an existing workflow. No reader of `adminEmail` exists in the repository.
- **Stricter than before:** an employee code longer than 10 characters, or a name over 100, returns `422 employeeInfoInvalid` instead of being truncated (observed maxima: code 6, name 47). A path that does not exist in HR returns `404 pathNotFound`; previously the browser could insert any text. Hierarchy codes longer than 10 characters are rejected because the assignment columns are `varchar(10)` (observed maxima: branch 9, other codes 3).
- **Frontend:** `store/administration/dtrSetup.js` gained `getOrganization`, `getEmployees`, `getAssignments`, and `createAssignment`; the six DTR setup pages and `drtAdminPopup.vue` call only these. Errors are translated through `errorMessages.administration.dtrSetup` (new English/Arabic keys `invalidLevel`, `invalidPath`, `pathNotFound`, `invalidRoles`, `assignmentExists`, `invalidRequest`); raw exception text is no longer shown. A failed list now shows an empty list. A duplicate still closes the popup with a message; other failures keep it open. Page URLs, layouts, the disabled edit/delete buttons, and table columns are unchanged. `cursor-pointer` was added to the buttons in the edited files.
- `CLAUDE.md` no longer lists an administration `sqlCalls.js` router.

#### Read-only database evidence and limitations

- One-off read-only scripts used the configured connections without importing an application entry point or starting Nuxt. They printed only schema metadata and aggregates; no employee or assignment rows, credentials, tokens, or connection details were output or recorded.
- **`dtr.adminAssignment`:** `id int identity` (primary key, the only index), `employeeCode varchar(10)`, `adminName varchar(100)`, `adminEmail varchar(100)` (all `NOT NULL`), `adminCompany varchar(100) NULL`, `picPath nvarchar(300) NULL`, `isHrPic`/`isPortalPic int NULL`, five `int NOT NULL` flags, `branchName varchar(100)`, and four `varchar(10) NOT NULL` code columns. No unique constraint, trigger, default, check, or foreign key. It holds 3 rows, all division-level, with no duplicate employee/path groups and no gaps in the sentinel pattern. The database is not using read-committed snapshot isolation.
- **`dtr.adminAssignment_addData`:** the 17 parameters match the bound names and types and the order the old popup used positionally. `OBJECT_DEFINITION` returns `NULL`, so its internal SQL and any side effects remain **unverified** (Phase 9).
- **HR:** `adm_company`, `adm_branch`, `pay_code_tables`, `Pay_employees`, and `pay_emp_finance` are tables with the selected columns. `pay_code_tables` is keyed on `(system_code_type, system_code, major_code, company_code, branch_code)`; there are no duplicate rows per hierarchy key and no orphaned child rows. Codes of all four types are shared across branches (16, 17, 166, and 32 codes respectively), which is why every statement is branch-scoped. `stop_val_flag` is numeric; no employee has more than one finance row.
- **Equivalence (aggregates only):** over every department and every project in HR, the old loop logic and the new statements return the same totals (department level 1,781 = 1,781; project level 1,324 = 1,324; active filter 2,191 = 2,191).
- **Compile-only check:** all 16 new statements (six organization, four employee, four path, assignment list, assignment add) were compiled against the live schemas inside `IF 1 = 0 BEGIN … END` with typed `DECLARE`s, so they were parsed and name-bound but never executed. 16/16 compiled; negative controls were rejected (unknown column 207, syntax 156). Procedure parameter binding happens only at run time and rests on the metadata comparison.
- **Not exercised locally:** real lock behavior under concurrent requests, a live insert, and browser rendering. The concurrency test uses a mock whose check-and-insert is atomic; it proves the service issues one statement with no separate pre-check, not SQL Server's locking.

#### Local validation and second review

- `npm run test:security`: **90 passed, 0 failed** (exit 0) on Node 24.21.0: the 74 existing tests plus 16 in the new `tests/security/dtr-setup.test.js`, added explicitly to the package script; the runner output lists all 16 by name. Tests use mocked `mssql`, test-only signed sessions, the real `createAuth`/`createRoleChecks`/membership and DTR setup services, and loopback-only isolated Express servers. They do not load `.env` or import `server/*/main.js`.
- New coverage:
  - the exact level/kind allowlists, statement text (branch scoping, active filter, HR column mapping, lock hints, transaction), and prototype-like or table-like names;
  - children, employees, and assignments at every level through HTTP, including empty branches, same-code/different-branch fixtures, inactive employees, projections without private columns, and typed inputs;
  - sentinel binding for division-, department-, project-, and sub-project-level lists and inserts, with flags stored as selected;
  - creation at all four levels from trusted lookups with spoofed name/email/company/picture/path-column fields ignored; duplicates `409`; six concurrent identical requests producing one row;
  - invalid levels, paths, flags, and employee codes rejected before any HR or assignment statement; unknown employees, oversized codes, unknown paths, wrong parents, and failed lookups/writes leaving no row and returning no database detail;
  - `401` without a valid session and `403` for a non-administrator on all 18 new route/level combinations with only the role query executed; membership revocation on the next request;
  - retired `/sql-call` and `/hr-sql-call` returning `404` for administrators, ordinary users, and anonymous callers, for `POST` and `GET`, with no statement executed, while a Phase 4 membership route still answers;
  - the real store module, the six page scripts, and the popup script executed with mocks (URLs, omitted lower levels, no SQL, translated errors, popup close/keep-open behavior, role validation); source scans; English/Arabic keys.
- `tests/security/administration.test.js` was updated for the new composition: the two legacy routes are now asserted as `404`, and the caller scan expects no remaining administration SQL caller.
- The first full run passed 90/90. `npm run lint`: **passed (exit 0)**. `npm run build`: **passed (exit 0)**; client and server compiled. Output keeps the existing outdated-Browserslist, large-bundle, and Babel `vue-pdf-embed` notices; no dependency changed.
- **Second review:** the complete diff and new files were read and each request traced from page to store to `authorize`, `requirePortalAdmin`, validation, typed binding, response, and error handling. Findings fixed: list actions now treat a non-array success body as empty (regression assertion added); Prettier had reformatted the two untouched administration config files, which were restored; the stale `CLAUDE.md` note was corrected. Tests (90/90), lint, `git diff --check`, and build were rerun and passed after these fixes.
- **Independent searches:** no `sql-call` reference remains under `server/administration`, the administration pages, components, or stores. The built client bundle contains `dtr-setup/assignments` and no `administration-api/sql-call`, `hr-sql-call`, or `adminAssignment_addData` text. The only request-derived values in administration server code are `params.kind`/`params.level`/`params.module` (Map keys), `query`/`body` path values and flags (validated, typed inputs), and `body.code`/`body.employeeCode` (validated targets). Every `${…}` in the SQL builders is a module constant.

#### Explicit residual exposure for later phases

- **Phase 6 — business-card generic SQL (unchanged here):** `POST /business-cards-api/sql-call` still executes browser SQL for **any authenticated user**, and `GET /business-cards-api/hr-sql-call` remains. The DTR assignment popup is no longer a caller; the remaining callers are `pages/business-cards/generated-cards/index.vue`, `card-generator/index.vue`, and `activity-logs/index.vue`. Until Phase 6 removes the route, a signed-in user can still write `dtr.adminAssignment` through it, so the new authorization on assignment creation is not yet a complete boundary.
- **Phases 7–8 — DTR generic SQL:** `/dtr-api/sql-call` and `/dtr-api/hr-sql-call` remain, called by `pages/dtr/dtr-table/index.vue` and `components/dtr/dtr-table/employeeCalendar.vue`. The DTR table still reads `dtr.adminAssignment` with the employee code from local storage.
- **Phase 9:** `dtr.adminAssignment_addData` and the other procedure bodies are unreadable. The public vCard interpolation from Phase 2 remains.
- **Behavior notes:** the static `Admins Table`, `Assign An Admin`, and `List all under …` labels are still untranslated English (unchanged). Assignments cannot be edited or removed through the portal (unchanged).

#### Production deployment and smoke checks — user to perform

1. Record the maintenance window, release identifier, and aliases for a portal-administrator account and an ordinary account without portal-admin membership. Only if separately authorized, also choose one designated test employee code and one hierarchy path for a write test. No SQL migration or key change is needed.
2. Stop all workers and deploy frontend and backend together, including `server/administration/{createApi.js,main.js,router/dtrSetup.js,services/dtrSetup.js}` with `router/sqlCalls.js` removed, the DTR setup pages, popup, store, locales, and tests. Run the existing `npm ci` / `npm run build` / PM2 restart procedure, refresh cached/PWA clients, and avoid mixed old/new workers: an old client calls the removed routes and a new client needs the new ones.
3. **Read-only checks, as the portal administrator, in English and Arabic:**
   - Open DTR setup: companies and branches load. Open a branch, then a division, department, project, and sub-project; each list matches the pre-deployment view.
   - Use “List all under …” at division, department, and project level and open a sub-project; employee tables match the pre-deployment view. Check one division that has no departments and one code that also exists under another branch.
   - The three existing division-level assignments appear in their division's Admins Table with the same names, pictures, and flags, and do not appear at lower levels.
   - In developer tools, requests are `GET /administration-api/dtr-setup/...` with only hierarchy codes in the query string; no request goes to `administration-api/sql-call`, `hr-sql-call`, or `business-cards-api/sql-call` from these screens.
   - Open the assignment popup, look up an existing employee code, and cancel without saving.
   - The six Phase 4 membership screens and the portal home still load.
4. **Boundary checks:**
   - As the administrator, `POST /administration-api/sql-call` and `/administration-api/hr-sql-call` with the harmless body `{}` return `404 {"message":"notFound"}`.
   - As the ordinary account, `GET /administration-api/dtr-setup/organization/branches` returns `403 {"message":"forbidden"}`; without a session it returns `401`.
   - As the administrator, `GET /administration-api/dtr-setup/organization/unknown` returns `400 invalidLevel`.
   - Do not send SQL, injection payloads, or write requests to production for these checks.
5. **Only with separate authorization (production write):**
   - First record whether the designated employee already has an assignment on the chosen path, and the full row if so.
   - In the popup, look up the employee, select the agreed flags, and save: the row appears in that level's Admins Table with those flags and does not appear at the parent or child level.
   - Save the same employee on the same path again: the translated “already exists” message appears and no second row is added.
   - Restore the recorded pre-test state. The portal has no delete function for assignments, so removing the test row is a manual database operation through the approved operational procedure, targeting that single `id`; record it. If that cannot be authorized, do not run the write test.
6. Check sanitized production logs for unexpected `400`, `401`, `403`, `404`, or `503` responses on administration routes and confirm the DTR table, business-card, portal, CoC, and survey modules still load. Record outcomes below and mark Phase 5 **Deployed**, then **Verified**, only after those events occur. Do not start Phase 6 automatically.

Maintenance window: **Pending**. Deployed release: **Pending**. Account/test-record aliases and smoke results: **Pending**. Verified by/date: **Pending**.

#### Rollback / recovery

- If verification fails, keep the DTR setup screens under maintenance and preserve sanitized diagnostics. Prefer fixing forward. This phase has no schema or data migration to reverse.
- Assignment creation is one transaction, so a failed save leaves no partial row. A row created by an authorized write test is removed only through the recorded manual procedure in step 5.
- Do not restore an accessible release that serves `/administration-api/sql-call` or `/administration-api/hr-sql-call`, or whose popup posts SQL to the business-card route; every pre-Phase-5 release does both. A rollback candidate must also preserve the Phase 1–4 boundaries and the Phase 2 `open-sql-call` retirement. If none exists, keep `/administration/dtr-setup` and `/administration-api/dtr-setup` unavailable (for example at the reverse proxy) until fixed; the Phase 4 membership screens can stay available because they do not depend on this phase's routes.
- Replace frontend and backend atomically and refresh browser/PWA caches. Do not restore only the old pages (they need the removed routes) or only the old routers.
