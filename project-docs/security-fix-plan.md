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
| 5     | Deployed    | User confirmed deployed and accepted on 2026-09-30 (smoke-check details not supplied) |
| 6     | Deployed    | User confirmed deployed and accepted on 2026-09-30 (smoke-check details not supplied) |
| 7     | Implemented | User confirmed tested and accepted on 2026-10-01; deployment and individual verification results not supplied |
| 8     | Implemented | Local checks passed 2026-10-01; deployment and production verification pending |
| 9     | Not started | Pending; do not advance automatically                         |

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

### Phase 5 acceptance record — 2026-09-30

Before any Phase 6 edit, the user was asked whether Phase 5 (recorded as **Implemented** only) had been tested and accepted, and chose “Accepted, deployed”. Phase 5 is accepted for progression to Phase 6 and its status is recorded as **Deployed** from that confirmation. The release identifier, maintenance window, account aliases, and individual Phase 5 smoke-check results were not supplied and are not inferred, so the status is not upgraded to **Verified**.

### Phase 6 implementation record — 2026-09-30

**Status: Implemented — local checks passed.** Phase 6 has not been deployed or verified in production. Starting checkout: `2afae1a`, with a clean working tree. No application startup, process restart, production data/schema write, email, deployment, commit, or push was performed. Phase 7 has not started.

#### API contracts

All management routes are under `/business-cards-api`, run the shared `authorize` middleware followed by `requireRole(..., 'businessCardsAdmin')` (the Phase 4 helper: one fixed `EXISTS` query on `dbo.business_card_admins` for `req.auth.employeeCode`, evaluated on every request), and return JSON. Portal-administrator membership is not a substitute. Read routes send `Cache-Control: no-store`.

| Route | Input | Success |
| ----- | ----- | ------- |
| `GET /cards` (new) | none | `200` array ordered by `employeeID`: `employeeID`, `fullName_e`, `mailAddress`, `title`, `profilePic`, `qrCodePath` |
| `GET /cards/:employeeCode` (new) | card ID in the path | `200` one object: `employeeID`, `company`, `fullName_a`, `fullName_e`, `arabicTitle`, `title`, `mobileNumber`, `landLines`, `faxLine`, `mailAddress`, `webSite`, `mainColor` |
| `GET /activity-logs` (new) | none | `200` array, newest first: `ID`, `theDate` (`YYYY-MM-DD`), `theTime` (`HH:MM:SS`), `Admin_Name`, `theAction`, `BCard_ID`, `BCard_Name` |
| `POST /save-employee-data` (URL kept) | multipart: the existing text fields plus optional `employeePicture`, `companyLogo`, `qrLogo` images | `200 { "employeeID", "action": "Creation" \| "Update", "cleanupPending" }` (previously the bare ID as text) |
| `POST /delete-business-card` (URL kept) | JSON `{ "bCardID" }` | `200 { "message": "successfullyDeleted", "cleanupPending" }` |

Errors: `400 invalidEmployeeCode`, `400 invalidCardData`, `400 fileTypeError`, `400 fileTooLarge`, `400 invalidUpload`, `400 invalidRequest` (malformed JSON or percent-encoding), `401 authFailed`, `403 forbidden`, `404 cardNotFound`, `503 serviceUnavailable`. No database, file-system, or exception text is returned.

**Removed:** `POST /business-cards-api/sql-call` and `GET /business-cards-api/hr-sql-call` (`router/sqlCalls.js` deleted, along with the now-unused `configs/hrSQL.js`), and `POST /business-cards-api/get-employee-data`, which had no caller and is superseded by `GET /cards/:employeeCode`. All three reach the API's terminal JSON `404 notFound` for every HTTP method and caller. No alias executes supplied SQL.

**Unchanged and still public:** `GET /public-cards/:employeeCode`, `GET /vcard`, and the static `/business-cards/<file>` and `/vcard/<file>` mounts. They run no session or role check.

#### Implementation and material decisions

- `server/businessCards/services/cardManagement.js` holds every statement as a module constant; `router/cardManagement.js`, `services/qrCode.js`, and `createApi.js` compose it, and `main.js` injects `mssql`, the portal config, `fs.promises`, the QR renderer, and the role check. The legacy `router/business-cards.js` was deleted. Every request value is a typed input; no SQL text, table, column, or procedure name comes from the browser.
- **Caller and audit identity.** The acting administrator is `req.auth.employeeCode`. The save and delete batches read that employee's `fullName` from `dbo.business_card_admins` inside the same transaction and pass it to `businessCards.logging`; if the row is gone the batch rolls back and the route returns `403`. The `creator`, `adminName`, `adminID`, and `adminAccount` fields the old client sent are ignored, and the client no longer sends them. On delete, the logged card name is the stored `fullName_e` and the removed QR file is the stored `qrCodePath`; the old handler took both from the request body, which allowed a caller to choose the file to delete.
- **Save** is one fixed batch: `SET XACT_ABORT ON`, a transaction, the actor check, a lookup of the card `WITH (UPDLOCK, HOLDLOCK)`, then `businessCards.employeeData_addData` or `employeeData_updateData` with named typed parameters, a confirmation that the row exists with the new QR name, the audit call, and the commit. A logging failure now rolls the save back instead of leaving an unaudited change. The status row is read from the last recordset so procedure result sets cannot be mistaken for it.
- **Delete** is one fixed batch with the same actor check and lock, `employeeData_deleteData @cardID`, a confirmation that the row is gone, the audit call, and the commit. A missing card returns `404 cardNotFound` with no audit row.
- **Card IDs** are 1–10 ASCII letters, digits, `_` or `-` on every management route, and are upper-cased on save (the client already did this). The limit is 10 because `businessCards.logs.BCard_ID` and the logging procedure's `@cardID` are `varchar(10)`; a longer ID could not be audited without truncation. The longest existing ID is 6. The public lookup keeps its 20-character limit.
- **Generated IDs** (`X` plus five digits, same range) are checked with a bound `EXISTS` query and written with a create-only flag, so a collision is retried instead of overwriting another card. The old loop never re-queried and could spin forever.
- **Field validation** uses the procedure parameter sizes (names and titles 100, mobile 20, landlines and fax 150, email and website 50); longer values, control characters, and repeated fields return `400 invalidCardData` instead of being truncated. The company must be one of the nine existing names. Colors must be hex (`#RGB` to `#RRGGBBAA`). The QR width must be 100–2000 pixels (default 300); previously it was unbounded.
- **Stored `undefined` markers are preserved.** Absent optional values are still stored as the text `undefined`, which the templates and the vCard compare against. A missing main color keeps the stored value on update.
- **Uploads.** Authorization runs before multer reads the body. Files are held in memory (three files, 5,120,000 bytes each, as before), must be PNG or JPEG by declared type and by signature, and are written only after the card is validated, under server-generated names (`<cardID>_<uuid>.<png|jpg>`). The old handler built file names from the request's `employeeID` and the original extension.
- **Files and failures.** New files are written before the database batch. If the batch fails, new files are removed and an overwritten same-name QR file is restored from the bytes read beforehand, and the route returns an error. After a commit, replaced pictures, logos, and QR files are removed; a missing file is harmless, and a file that cannot be removed returns success with `cleanupPending: true`. Only plain file names inside `uploads/businessCards` are ever removed; `profile.png`, `undefined`, and names containing path separators are left alone. Previously a missing old file made the whole update or delete fail after the database change.
- **Delete removes only the card's QR file**, as before. The card's picture and logo stay on disk (see findings).
- **Frontend.** `store/businessCards/index.js` gained `getGeneratedCards`, `getActivityLogs`, and `getCard`; `saveEmployeeData` and `deleteBusinessCard` no longer read identity from local storage and resolve to the saved ID or a boolean. The three pages and `bCardDeletion.vue` use only these actions. Errors are translated through the new `errorMessages.businessCards` keys in English and Arabic. A failed list shows an empty list. A missing card on an edit link leaves the empty form. A failed save keeps the entered values and no longer navigates to a stale card. After a successful save the page navigates with `localePath`. Search boxes treat the text literally and tolerate null fields. `cursor-pointer` was added to the buttons in the edited files.
- `CLAUDE.md` no longer lists a business-card `sqlCalls.js` router.

#### Read-only database evidence and limitations

- One-off read-only scripts used the configured connection without importing an application entry point or starting Nuxt. They printed only schema metadata and aggregates; no card or log rows, credentials, tokens, or connection details were output or recorded.
- **`businessCards.employeeData`:** `employeeID varchar(20) NOT NULL` (primary key, the only index); `mailAddress varchar(150)`, `company varchar(100)`, `fullName_a nvarchar(100)`, `fullName_e varchar(100)`, `arabicTitle nvarchar(100)`, `title varchar(100)`, `mobileNumber varchar(20)`, `landLines varchar(150)`, `faxLine varchar(150)`, `webSite varchar(50)`, `profilePic nvarchar(100)`, `companyLogo nvarchar(100)`, `qrCodePath varchar(25)`, `mainColor varchar(10)`, all nullable. 99 rows with 99 distinct IDs, none outside the accepted character set, none lower-case, 8 generated `X…` IDs. No file name contains a path separator, and no picture, logo, or QR file is shared between rows.
- **`businessCards.logs`:** `ID int identity` (primary key), `theDate date`, `theTime time`, `Admin_Name varchar(100)`, `theAction varchar(20)`, `BCard_ID varchar(10)`, `BCard_Name nchar(100)`, all `NOT NULL`. 223 rows with actions `Creation`, `Update`, and `Deletion`. The response trims the fixed-width name.
- The schema has no triggers, defaults, check constraints, or foreign keys. `dbo.business_card_admins.fullName` is `varchar(50)`.
- **Procedures:** `sys.parameters` confirmed `employeeData_addData` and `employeeData_updateData` (15 parameters each; note `@mailAddress varchar(50)` against a 150-character column), `employeeData_deleteData (@cardID varchar(20))`, and `logging (@date date, @time time, @adminName varchar(100), @action varchar(20), @cardID varchar(10), @cardName varchar(100))`. The bound names and types match. `OBJECT_DEFINITION` returns `NULL` for all five, so their internal SQL and any side effects remain **unverified** (Phase 9). `employeeData_checkIfExist` is no longer called.
- The database collation is `SQL_Latin1_General_CP1_CI_AS`. Arabic text typed into the `varchar` fields (English name, title, and the log's card name) is stored as `?`, as it was before this phase; the two `nvarchar` fields keep Arabic.
- **Compile-only check:** the six new statements and the role query were compiled against the live schema inside `IF 1 = 0 BEGIN … END` with typed `DECLARE`s, so they were parsed and name-bound but never executed. 7/7 compiled; negative controls were rejected (unknown column 207, syntax 156). Procedure parameter binding happens only at run time and rests on the metadata comparison.
- **Not exercised locally:** a live save or delete, real lock behavior, the procedures' run-time behavior inside a transaction, and browser rendering.

#### Local validation and second review

- `npm run test:security`: **111 passed, 0 failed** (exit 0) on Node 24.21.0: the 90 existing tests plus 21 in the new `tests/security/business-cards.test.js`, added explicitly to the package script; the runner output lists all 21 by name. Tests use mocked `mssql`, test-only signed sessions, a temporary upload directory, the real `createAuth`/`createRoleChecks`/card service/routers, and loopback-only isolated Express servers. They do not load `.env` or import `server/*/main.js`.
- New coverage:
  - statement text (no `SELECT *`, ordering, transaction, lock hints, actor lookup, named procedure calls) and exact typed bindings;
  - projections for the three reads, checked against the fields each page uses;
  - invalid and injection-like IDs rejected before any pool, QR, or file work; field sizes, companies, colors, and QR widths;
  - creation with apostrophes and Arabic text stored as data, spoofed audit fields ignored, the audit row carrying the session administrator's name;
  - editing with and without new uploads, QR size changes, placeholder and traversal-like stored file names never removed, locked files reported as pending;
  - generated-ID collision and race retries, and exhaustion as a controlled `503`;
  - connection, query, procedure, disk, and QR failures leaving no new file, restoring the previous QR, writing no audit row, and returning no success; membership revoked between the guard and the write;
  - delete using the stored name and file, repeat delete `404`, missing and locked QR files, database failures keeping the card;
  - through HTTP: the full administrator lifecycle on a fixture card; `403` for an ordinary employee on all five routes with only their own role query executed despite spoofed body, query, header, and form fields; `401` for missing, tampered, and revoked sessions before any SQL; revocation on the next request;
  - retired `/sql-call`, `/hr-sql-call`, `/open-sql-call`, and `/get-employee-data` returning `404` for administrators, ordinary users, and anonymous callers on `GET`, `POST`, `PUT`, and `DELETE` with no statement executed;
  - the public card lookup, the real `vCard` router, and static artifacts answering without a session, with a stale token, and for non-administrators, with no role query;
  - wrong type, oversized, unexpected, and mismatched uploads, oversized fields, malformed JSON and percent-encoding, and hostile original file names;
  - the real store, the three page scripts, and the delete dialog executed with mocks; source scans of callers and server files; English/Arabic keys; `cursor-pointer` on every button in the edited templates; and the real QR renderer producing a PNG.
- `tests/security/public-cards.test.js` and `tests/security/dtr-setup.test.js` were updated for the new composition: the two business-card gateways are asserted as `404`, and the caller scan expects no remaining business-card SQL caller.
- **First runs:** the first run of the new file was 19 passed and 2 failed, both test mistakes (a `GET` sent with a body; a scan that matched a translation key in a template). After correction it passed 21/21. The first lint run flagged one `no-control-regex` error on the deliberate control-character check, which now carries a targeted disable comment.
- **Second review:** the complete diff and new files were read and each request traced from page to store to `authorize`, the role check, validation, typed binding, response, and error handling. Findings fixed: multer field-limit errors were reported as upload errors and are now `invalidCardData` (regression assertion added); the unused business-card HR connection config was removed. The module entry point was loaded once outside the test suite to confirm its imports resolve; no request or connection was made.
- **Final checks after all changes:** `npm run test:security` 111/111 (exit 0); `npm run lint` passed (exit 0); `git diff --check` passed; `npm run build` passed (exit 0), client and server compiled. Output keeps the existing outdated-Browserslist, large-bundle, and Babel `vue-pdf-embed` notices; no dependency changed.
- **Independent searches:** no `sql-call`, `sqlCalls`, `get-employee-data`, or `req.body.query` reference remains outside `server/dtr` and the DTR table page and calendar component. The built client bundle contains no `business-cards-api/sql-call`, `hr-sql-call`, `get-employee-data`, or `[businessCards]` text, and does contain the new endpoints. Every `.query(...)` argument under `server/businessCards` other than `vCard.js` is a module constant.

#### Explicit residual exposure and findings for later phases

- **Phases 7–8 — DTR generic SQL:** `/dtr-api/sql-call` and `/dtr-api/hr-sql-call` remain, called by `pages/dtr/dtr-table/index.vue` and `components/dtr/dtr-table/employeeCalendar.vue`. They are now the only browser-SQL gateways left, and any authenticated user can still reach them.
- **Phase 9:** `GET /business-cards-api/vcard` still interpolates `req.query.employeeID` into `SELECT *` and is public. The five `businessCards` procedure bodies are unreadable.
- **Static artifacts stay public by design.** Card pictures, logos, and QR files under `/business-cards-api/business-cards/` need no session (unchanged; document-access hardening is deferred).
- **Orphaned files.** Deleting a card leaves its picture and logo on disk and publicly reachable by file name (unchanged behavior). Files orphaned by earlier failed saves also remain. A cleanup needs a separate decision.
- **Concurrent administrators.** Two administrators saving and deleting the same card at the same moment can leave a card row whose QR file was just removed; saving the card again regenerates it. The database changes themselves are serialized by the row lock.
- **Behavior notes:** a card ID over 10 characters is now rejected; an edit link to a deleted card followed by Submit creates the card again (unchanged upsert behavior); the activity log shows the administrator's name from `business_card_admins`, which may be formatted differently from the name the browser used to send.

#### Production deployment and smoke checks — user to perform

1. Record the maintenance window, release identifier, and aliases for a business-card administrator account and an ordinary account without that membership (ideally a portal administrator who is not a card administrator). Only if separately authorized, agree one designated fixture card ID for the write test. No SQL migration or key change is needed.
2. Stop all workers and deploy frontend and backend together, including `server/businessCards/{createApi.js,main.js,router/cardManagement.js,services/cardManagement.js,services/qrCode.js}` with `router/sqlCalls.js`, `router/business-cards.js`, and `configs/hrSQL.js` removed, the three pages, the delete dialog, the store, the locales, and the tests. Run the existing `npm ci` / `npm run build` / PM2 restart procedure, refresh cached/PWA clients, and avoid mixed old/new workers: an old client calls the removed route and expects the old save response.
3. **Read-only checks, as the card administrator, in English and Arabic:**
   - Generated cards: the list loads in ID order with the same names, IDs, emails, titles, and pictures as before; search by ID and by name works; a QR link downloads and “Show the card” opens the public card.
   - Open an existing card's edit link: every field is filled as before, including Arabic name and title, and the color for a Custom card. Leave without submitting.
   - Open `/business-cards/card-generator?id=<an unused ID>`: a translated “not found” message appears and the empty form stays usable.
   - Activity logs: newest first, with the same dates, times, names, and actions as before; search works.
   - In developer tools these screens request only `GET /business-cards-api/cards`, `/cards/<id>`, and `/activity-logs`; nothing goes to `sql-call`.
4. **Boundary checks:**
   - As the administrator, `POST /business-cards-api/sql-call` with the harmless body `{}`, `GET /business-cards-api/hr-sql-call`, and `POST /business-cards-api/get-employee-data` with `{}` return `404 {"message":"notFound"}`.
   - As the ordinary account, `GET /business-cards-api/cards` and `GET /business-cards-api/activity-logs` return `403 {"message":"forbidden"}`; without a session they return `401`. Direct navigation to `/business-cards/generated-cards` redirects to the portal.
   - Do not send SQL, injection payloads, or write requests to production for these checks.
5. **Public checks, signed out:** an existing card opens in English and Arabic for each available company layout, its vCard downloads, a printed or saved QR still opens the card, and the profile QR shortcut on the portal home still appears for an account with a card.
6. **Only with separate authorization (production write), using the designated fixture ID:**
   - First record whether a card with that ID exists. If it does, record every field from its edit form, its picture, logo, and QR file names from the list, keep copies of those three files, and note the current top activity-log entry.
   - Generate (or update) the fixture with a picture and a name containing an apostrophe and an Arabic name: the public card opens, the list shows it, the QR downloads, and the log shows `Creation` or `Update` with your own name.
   - Edit it without uploading files and change the title: the picture and logo are unchanged and the log shows `Update`.
   - Delete it: the row disappears, the public URL shows the not-found state, the log shows `Deletion`, and a second delete attempt from a stale tab shows the translated not-found message.
   - Restore the recorded state: if the fixture existed before, generate it again with the recorded values and the saved picture and logo and compare the edit form and public card; if it did not, leave it deleted. The test's activity-log rows remain as a record; do not delete log rows.
7. Check sanitized production logs for unexpected `400`, `401`, `403`, `404`, or `503` responses on business-card routes and confirm the portal, administration, DTR setup, DTR table, CoC, and survey modules still load. Record outcomes below and mark Phase 6 **Deployed**, then **Verified**, only after those events occur. Do not start Phase 7 automatically.

Maintenance window: **Pending**. Deployed release: **Pending**. Account/fixture aliases and smoke results: **Pending**. Verified by/date: **Pending**.

#### Rollback / recovery

- If verification fails, keep the business-card management screens under maintenance and preserve sanitized diagnostics. Prefer fixing forward. This phase has no schema or data migration to reverse.
- Saves and deletes are single transactions, so a failed operation leaves no partial card or audit row. A fixture changed by an authorized write test is restored only through step 6.
- Do not restore an accessible release that serves `/business-cards-api/sql-call` or `/business-cards-api/hr-sql-call`; every pre-Phase-6 release does, and lets any signed-in user run SQL. A rollback candidate must also preserve the Phase 1–5 boundaries and the Phase 2 `open-sql-call` retirement. If none exists, keep `/business-cards` and the five management routes unavailable (for example at the reverse proxy) until fixed. The public card, vCard, and static artifact routes can stay available because they do not depend on this phase's routes.
- Replace frontend and backend atomically and refresh browser/PWA caches. Do not restore only the old pages (they need the removed route and the old save response) or only the old routers. Preserve existing card rows, log rows, and uploaded files; no deletion or regeneration is required for rollback.

### Phase 6 acceptance record — 2026-09-30

Before any Phase 7 edit, the user was asked whether Phase 6 (recorded as **Implemented** only) had been tested and accepted, and chose “Accepted, deployed”. Phase 6 is accepted for progression to Phase 7 and its status is recorded as **Deployed** from that confirmation. The release identifier, maintenance window, account aliases, and individual Phase 6 smoke-check results were not supplied and are not inferred, so the status is not upgraded to **Verified**.

### Phase 7 implementation record — 2026-09-30

**Status: Implemented — local checks passed.** Phase 7 has not been deployed or verified in production. Starting checkout: `9755160`, with a clean working tree. No application startup, process restart, production data/schema write, email, deployment, commit, or push was performed. Phase 8 has not started.

**DTR is not fully secured by this phase.** `POST /dtr-api/sql-params-call` still executes SQL text sent by the browser (see “Remaining legacy calls”). Phase 7 moves the reads and their scope to the server and retires the two gateways that no caller needs any more.

#### API contracts

All routes are under `/dtr-api`, run the shared `authorize` middleware followed by `requireRole(..., 'dtrUser')` (the Phase 4 helper: one fixed `EXISTS` query on `dbo.dtr_users` for `req.auth.employeeCode`, evaluated on every request), and return JSON. Read routes send `Cache-Control: no-store`. **The caller is always `req.auth.employeeCode`.** No route accepts an administrator, manager, assignment, branch, or hierarchy value; such fields in the query string, body, or headers are ignored.

Inputs: `start` and `end` are `YYYY-MM-DD` and must be the 21st of a month and the 20th of the following month (years 2000–2100). An employee code is 1–10 ASCII letters, digits, `_` or `-`, and not the text `undefined`. Repeated or structured values are rejected.

| Route | Input | Success |
| ----- | ----- | ------- |
| `GET /assigned-employees` | none | `200` array: every active employee inside the caller's assignments, once each, in first-seen order (assignment `id`, then employee code): `employee_code`, `employee_name_eng`, `employee_name_a`, `employee_picture` |
| `GET /period-entries` | `start`, `end`, optional `employeeCode` | `200` array of `EmployeeCode`, `ApprovalStatus` (0–3 as stored), `DeclineFlag` (boolean), for assigned employees that have an entry in that period. With `employeeCode`: zero or one row for that assigned employee |
| `GET /employees/:employeeCode` | code in the path | `200 { employee_code, employee_name_eng, employee_picture, Manager_Code }` for an assigned employee (the details the calendar needs to save) |
| `GET /employees/:employeeCode/calendar` | code in the path, `start`, `end` | `200 { EmployeeCode, entry }`. `entry` is `null` when nothing is saved, otherwise `{ ApprovalStatus, DeclineFlag, DeclineMessage, days }`, where `days` maps each day number of the period (28 to 31 keys) to the stored code or `null` |
| `GET /pending-approvals` | `start`, `end` | `200` array in entry-`id` order: `EmployeeCode`, `employeeName`, `employeePicture`, `ApprovalStatus` (always `1`), `days` |

Errors: `400 invalidPeriod`, `400 invalidEmployeeCode`, `400 invalidRequest` (malformed JSON or percent-encoding), `401 authFailed`, `403 forbidden` (not a DTR member), `404 employeeNotFound`, `404 notFound` (unknown route or method), `503 serviceUnavailable`. No database or exception text is returned. An empty scope returns `200 []`.

`404 employeeNotFound` is one answer for an unknown employee, an inactive one, one outside the caller's assignments and, for the calendar, an entry the caller may not approve. It does not reveal whether the employee or an entry exists.

**Removed:** `POST /dtr-api/sql-call` and `POST /dtr-api/hr-sql-call`. They reach the API's terminal JSON `404 notFound` for every method and caller, before any session lookup. No alias executes supplied SQL, and no browser-SQL route uses the HR connection any more.

**Kept for Phase 8, handlers unchanged:** `POST /dtr-api/sql-params-call` and `POST /dtr-api/save-dtr-data`. Both now also require DTR membership (previously any signed-in employee).

#### Implementation and material decisions

- `server/dtr/services/dtrReads.js` holds every statement as a module constant; `router/dtrReads.js` and `createApi.js` compose it, and `main.js` injects `mssql`, both configs, and the role check. Request values are bound as `varchar(10)` inputs (`nvarchar(10)` for the manager code); no SQL text, table, column, or level name comes from the browser. The service never receives a request object.
- **Scope resolution.** One fixed query reads the caller's `dtr.adminAssignment` rows. Each row is classified by the stored sentinel pattern exactly as the old page did: all three lower codes `undefined` is division level, then department, project, and sub-project. Any other pattern, an empty value, a value longer than the HR columns, or `undefined` in any other spelling matches no employee, as it did before; a malformed row can never widen the scope. Stored codes are used as data and are not restricted to a character set.
- **Hierarchy rules are the Phase 5 ones, reused rather than copied.** `server/administration/services/dtrSetup.js` now exports the `FROM`/`WHERE` text of its four employee lists (`EMPLOYEE_SCOPES`); the DTR statements are built from that text with their own columns. HR mappings, the active filter (`pay_emp_finance.stop_val_flag = 0`), and branch scoping are therefore identical: division lists the whole division; department lists division employees whose project code is one of the department's projects; project lists employees whose unit is one of the project's sub-projects; sub-project matches the full path.
- **Deduplication.** Identical assignment paths are resolved once; employees are keyed the way both databases compare codes (case-insensitive, trailing spaces ignored) and listed once in first-seen order. Overlapping assignments previously produced one panel per assignment for the same employee. No assignment, or only unusable ones, runs no HR statement and returns an empty list.
- **One employee.** Details, single statuses, and calendars check the employee with the same scope text plus `A.employee_code = @employeeCode`, so a guessed code outside the caller's assignments is refused without listing anything. Two HR rows for one code return `503` instead of choosing one.
- **Calendar access** is granted to an assignee, or to the recorded manager of an entry that is pending in the requested period. A manager loses access once the entry is approved or declined. Employee HR details are for assignees only.
- **Pending approvals** are selected by `ManagerCode = <session employee>`, `ApprovalStatus = 1`, and the period. Inactive employees' pending entries are still listed, as before.
- **Policy preserved:** DTR membership plus assignment scope for entry work, the recorded manager for approvals. `isDTRAdmin`, `isApprover`, and the other stored flags are not read anywhere.
- **Periods.** The validated `YYYY-MM-DD` text is bound as `varchar(10)` and converted by SQL Server (`CONVERT(date, @periodStart, 23)`), so no driver or time-zone setting can shift a day. The server returns only the days that exist in the period; day columns a short month does not use are never returned.
- **Responses are projected.** The old reads returned `SELECT *`: the full HR employee row (every column) for the save lookup, and whole `dtrEntries` rows. The new responses carry only the fields the screens use.
- **Retiring the two gateways in this phase.** After the read callers moved, `/sql-call` and `/hr-sql-call` had no caller left, so they were removed instead of waiting for Phase 8. `/hr-sql-call` was the only browser-SQL route on the HR connection.
- **Membership on the remaining legacy routes.** Item 2 of this phase requires DTR membership, and the DTR layout already sends non-members away, so the two remaining write routes now check it too. Their handlers are otherwise unchanged; `dtr-actions.js` is byte-identical. This narrows the remaining arbitrary-SQL exposure from every signed-in employee to DTR members. It costs one extra session lookup per save, because the untouched save router still runs its own check.
- **Frontend.** `store/dtr/index.js` gained `getAssignedEmployees`, `getPeriodEntries`, `getCalendar`, `getEmployee`, and `getPendingApprovals`; the two pages and the calendar component use only these for reads. Errors are translated through the new `errorMessages.dtr` keys in English and Arabic; raw exception text is no longer shown for reads. A failed list shows an empty list; failed statuses leave the shown data unchanged; a failed employee lookup stops the save and clears the overlay. `cursor-pointer` was added to every button in the three edited files. Two redirects now use `localePath`.
- **Period defects fixed** in the new `utils/dtr-period.js`, which replaces the page's date arithmetic (about 290 lines of `if`/`switch` branches):
  - In October and November the old page produced `20-010-YYYY` and `21-011-YYYY`. The previous/next buttons then did nothing, and the malformed text was used as the period in the queries. Periods are now always zero-padded.
  - Returning to either page with a stored December–January period took the start year from the end date, which produced an empty calendar. The start year now comes from the start date.
  - The “current period” rule is unchanged: it uses the UTC calendar date, and days 1–20 belong to the period that started the previous month.
- **Send button.** With no assigned employee the table is now empty without an error, and “Send For Approval” is disabled. Previously the page sent `IN ()`, which is not valid SQL.
- **Status display is unchanged:** the same colors and English status texts, set in the page from `ApprovalStatus`.
- **Phase 5 defect found and fixed here.** Timing the scope statements against HR showed that the deployed Phase 5 department list (`GET /administration-api/dtr-setup/employees/department`) reused a cached plan that took over 1.5 seconds for 7 of 184 department paths and 16.6 seconds for the worst, past the driver's 15-second limit (a `503`). The project list had 2 slow paths of 618 (worst 5.5 seconds). The cause is parameter-sensitive plans (`pay_code_tables.section_code` and `.division_code` are `varchar(max)`). The four Phase 5 list statements and the four new DTR list statements now end with `OPTION (RECOMPILE)`; nothing else in their text changed. After the change every path returned the same rows, the slowest in 253 ms. The single-employee statements seek the HR primary key and stayed under 40 ms without the hint.

#### Read-only database evidence and limitations

- One-off read-only scripts used the configured connections without importing an application entry point or starting Nuxt. They printed only schema metadata, counts, timings, and error numbers; no employee, assignment, or entry rows, credentials, tokens, or connection details were output or recorded.
- **`dtr.dtrEntries`:** `id int identity` (clustered primary key); `EmployeeCode varchar(10)`, `employeeName varchar(100)`, `ManagerCode nvarchar(10)`, `StartDate date`, `EndDate date`, `ApprovalStatus int` (all `NOT NULL`); `employeePicture varchar(300)`, `ModifiedDate datetime`, `ModifiedBy nvarchar(20)`, `DeclineMessage nvarchar(300)`, `DeclineFlag bit`, and 31 day columns `[21]`…`[31]`, `[1]`…`[20]` of `nvarchar(5)`, all nullable. A unique index covers `(EmployeeCode, StartDate, EndDate)`. No trigger, default, check constraint, or foreign key. It holds 5 rows in 2 periods, one per employee, every period running from a 21st to the next 20th; statuses present are `0` and `1`.
- **`dtr.adminAssignment`:** now 4 rows for 2 employees (3 division-level, 1 sub-project-level), no malformed sentinel pattern and no unusual characters. One holder's rows spell the employee code differently in case or trailing space; SQL treats them as equal and the statement keeps that comparison.
- **Membership:** `dbo.dtr_users` has 2 rows. One of the 2 assignment holders and one of the 2 recorded managers are not members. They could not open the DTR screens before (the layout redirects) and are refused by the API now.
- **HR:** `Pay_employees.employee_code varchar(15)` (primary key with `company_code`; all 10,382 codes are distinct, at most 6 characters, none with unusual characters); `Manager_Code`, `department`, `section`, `Division`, `Unit` are `varchar(15)`; `pay_emp_finance.stop_val_flag` is numeric. HR collation is `Arabic_CI_AS`, the portal's `SQL_Latin1_General_CP1_CI_AS`; both are case-insensitive.
- **Procedures:** `dtr.dtrEntries_checkIfExist (@employeeID varchar(20), @startDate date, @endDate date)` is called only by the unchanged save handler. `OBJECT_DEFINITION` returns `NULL` for it and for `dtr.adminAssignment_addData`, so their internal SQL remains **unverified** (Phase 9). Phase 7 calls no procedure.
- **Compile-only check:** the 12 new statements (4 portal, 8 HR) and the 4 updated Phase 5 lists were compiled against the live schemas inside `IF 1 = 0 BEGIN … END` with typed `DECLARE`s, so they were parsed and name-bound but never executed. 16/16 compiled; negative controls were rejected (unknown column 207, syntax 156).
- **Equivalence with the old page logic (counts only):**
  - Every path in HR: 83 divisions, 184 departments, 618 projects, and 125 sub-projects. For each, the employee set of the old loops equals the new statement's: 0 mismatches of 1,010, distinct totals 2,195 / 1,785 / 1,326 / 1,326, with 2,195 active employees.
  - The 4 existing assignments: same employee sets (3, 1, 3, and 86 employees); per holder 90 and 3 employees, with no overlap today.
  - Both stored periods: the parameterized period filter returns the same number of entries as the old literal filter (1 and 4).
  - Both manager queues: same number of pending entries (3 and 1).
- **Not exercised locally:** the real save handler behind the new composition (tests use a stand-in router because the real one imports the runtime session service), browser rendering, and department- or project-level assignments in production (none exist).
- **Limitation:** `GET /period-entries` reads the period's entries with one fixed statement and keeps the assigned employees' rows on the server. The table has no index that starts with the period; at the current size this is irrelevant, and a later index would not change the API.

#### Local validation and second review

- `npm run test:security`: **133 passed, 0 failed** (exit 0) on Node 24.21.0: the 111 existing tests plus 22 in the new `tests/security/dtr-reads.test.js`, added explicitly to the package script; the runner output lists all 22 by name. Tests use mocked `mssql`, test-only signed sessions, the real `createAuth`/`createRoleChecks`/read service/routers, and loopback-only isolated Express servers. They do not load `.env` or import `server/*/main.js`. The mock interprets each fixed statement with the old page's loops, so results are compared against the previous behavior.
- New coverage:
  - statement text (no `SELECT *`, Phase 5 scope text, active filter, branch scoping, period conversion, manager and pending predicates, day-column order, recompile hint) and exact typed bindings;
  - periods for every month of 2024–2026: 28, 29, 30, and 31 days, the December–January boundary, and 24 rejected shapes including the old `010` text, the old year bug, injection text, arrays, and out-of-range years;
  - sentinel classification at all four levels and 21 malformed rows resolving to nothing;
  - assigned employees at every level through HTTP, compared with the Phase 5 list of the same path, with inactive employees and equal codes in another branch excluded and projections without private HR columns;
  - overlapping and repeated assignments in two branches listing each employee once in order; no assignment, malformed assignments, a manager without assignments, and an over-long caller code returning `[]` with no HR statement;
  - period entries for each level and period; a guessed, unknown, inactive, or other-branch code refused alike with no entry read;
  - calendars for each level, the four month lengths, a stale value in an unused day column not returned, an assignee without an entry, the recorded manager of a pending entry, and 15 refused combinations; access lost after approval;
  - employee details for assignees only, fail-closed on duplicate HR codes;
  - manager queues per manager and period, with a caller-selected manager ignored in the query string and headers;
  - spoofed employee, administrator, manager, branch, division, level, and `query` parameters unable to widen any route; repeated and structured parameters rejected; `POST`/`PUT`/`DELETE` on read routes `404`;
  - `401` for missing, malformed, tampered, and revoked sessions before any SQL; `403` for a non-member who holds an assignment and approvals, with only the role query executed; membership revocation on the next request;
  - invalid periods and codes stopping after the role check; malformed percent-encoding; unknown routes; every statement, both connections, and the role check failing with `503` and no database text; all pools closed;
  - retired `/sql-call` and `/hr-sql-call` returning `404` for members, managers, non-members, and anonymous callers on `GET`, `POST`, `PUT`, and `DELETE`, with no statement and no pool;
  - the legacy gateway and the save route still answering members, and refusing non-members (`403`) and anonymous callers (`401`) before any statement;
  - the period helper across three years, including the October and November cases and the twelve previous/next cases of the old switch;
  - the real store, both page scripts, and the calendar script executed with mocks: requests, status mapping, empty and failed lists, the restored December period, the 28–31 day calendars, and the save lookup;
  - source scans of callers and server files, English/Arabic keys, and `cursor-pointer` on every button in the edited templates.
- **First runs:** the first run of the new file was 20 passed and 2 failed, both test mistakes (a count that included a code comment; a pattern that did not match the remaining gateway's name). After correction it passed 22/22. The first lint run flagged two `no-unmodified-loop-condition` errors in a test loop, which was rewritten.
- **Second review:** the complete diff and new files were read and each request traced from page to store to `authorize`, the role check, validation, scope resolution, typed binding, response, and error handling. Findings fixed: the plan-sensitivity defect above (found by timing every HR path, which the first equivalence run over existing assignments had not reached); calendar and employee-detail reads at each assignment level were added to the tests; one template line was reformatted. The module entry point was loaded once outside the test suite to confirm its imports resolve and to list its routes; no request or connection was made.
- **Final checks after all changes:** `npm run test:security` 133/133 (exit 0); `npm run lint` passed (exit 0); `git diff --check` passed; `npm run build` passed (exit 0), client and server compiled. Output keeps the existing outdated-Browserslist, large-bundle, and Babel `vue-pdf-embed` notices; no dependency changed.
- **Independent searches:** no `sql-call`, `hr-sql-call`, `sqlCalls`, or `req.body.query` reference remains in the sources outside `server/dtr/createApi.js` and `server/dtr/router/sqlCalls.js`. The built client bundle contains no `dtr-api/sql-call`, `hr-sql-call`, `adminAssignment`, `Pay_employees`, or `pay_code_tables` text; it contains the new endpoints, and `sql-params-call` in exactly three chunks (the callers listed below).

#### Remaining legacy calls and residual exposure (Phase 8 inventory)

Every remaining browser-SQL call is a status `UPDATE` on `dtr.dtrEntries` sent to `POST /dtr-api/sql-params-call`:

| Caller | Operation |
| ------ | --------- |
| `pages/dtr/dtr-table/index.vue` → `sendForApproval` | set status `1` for the listed employees and period; the employee codes are interpolated into an `IN (...)` list |
| `components/dtr/dtr-table/employeeCalendar.vue` → `sendSingleForApproval` | set status `1` for one employee and period |
| `pages/dtr/approvals/index.vue` → `singleApproval` | set status `3` for one employee and period |
| `pages/dtr/approvals/index.vue` → `singleDecline` | set status `2`, decline message, and flag |
| `pages/dtr/approvals/index.vue` → `approveAll` | set status `3` for the listed employees; codes interpolated into `IN (...)` |
| `components/dtr/dtr-table/employeeCalendar.vue` → `saveData` | `POST /dtr-api/save-dtr-data` (not browser SQL, but it trusts body values) |

- **Residual exposure until Phase 8:** any DTR member can still send arbitrary SQL to `/dtr-api/sql-params-call`, which runs on the portal connection. That bypasses the read scope added here and reaches every table that connection can use. The Phase 7 scope checks are therefore a complete boundary only for callers who use the new routes. Whether the portal login can reach HR data through cross-database or linked-server names was not tested.
- **`/save-dtr-data` still trusts the body:** `managerCode`, `dtrAdmin`, `employeeName`, and `employeePicture` come from the request, no assignment check is made, and values are bound without types. Because the recorded manager decides who may approve and read a pending entry, a member can still choose that manager when saving.
- **Findings for Phase 8:**
  - The save handler's `UPDATE` filters on `EmployeeCode` only. With the unique key on employee and period, saving again for an employee who already has an entry in another period will fail, or move the single existing row to the new period. No employee has two entries yet.
  - The save always writes status `0`, so a direct request can reset a pending or approved entry.
  - The legacy handlers return database error text, and a failed connection leaves an unhandled rejection in their `finally` block.
  - `GET /dtr-api/employees/:employeeCode` exists only to feed the save; it can be dropped when the server derives the manager.
  - The `dtrApp.dtrPage.successApproval` and `successDecline` translation keys do not exist, so those notifications show the key.
- **Unchanged behavior notes:** status texts, calendar day labels, and the approvals headings are untranslated English. A new entry cannot be deleted through the portal.
- **Phase 9:** the two `dtr` procedure bodies are unreadable. The public vCard interpolation from Phase 2 remains.

#### Production deployment and smoke checks — user to perform

1. Record the maintenance window, release identifier, and aliases for: a DTR member who holds assignments, a DTR member who is the recorded manager of pending entries, and an ordinary account without DTR membership. No SQL migration or key change is needed.
2. Before deploying, note for the assignment holder how many employees the DTR table lists for the current period and the status of two or three of them, and for the manager how many entries the approvals page lists.
3. Stop all workers and deploy frontend and backend together, including `server/dtr/{createApi.js,main.js,router/dtrReads.js,router/sqlCalls.js,services/dtrReads.js}`, `server/administration/services/dtrSetup.js`, `store/dtr/index.js`, `utils/dtr-period.js`, the two DTR pages, the calendar component, the locales, and the tests. Run the existing `npm ci` / `npm run build` / PM2 restart procedure, refresh cached/PWA clients, and avoid mixed old/new workers: an old client calls the removed routes and a new client needs the new ones.
4. **Read-only checks, as the assignment holder, in English and Arabic:**
   - Open the DTR table. The period dialog shows zero-padded dates (in October: `21-09-2026` to `20-10-2026`, then `21-10-2026` to `20-11-2026` from the 21st). Previous and next move one period at a time, including across December–January.
   - Save the period. The employee list has the same people and statuses as in step 2, and nobody appears twice.
   - Open an employee with a saved entry: the day values, and any decline message, match what was shown before. Open an employee without an entry: every day shows the default.
   - Choose a December–January period, open the approvals page, and return to the table: the calendar still shows 21 December to 20 January.
   - In developer tools these screens request only `GET /dtr-api/assigned-employees`, `/period-entries`, and `/employees/<code>/calendar`; nothing goes to `sql-call` or `hr-sql-call`.
5. **As the manager:** the approvals page lists the same pending employees as in step 2 for that period and an empty message for a period without any. Opening a row shows its days. Do not approve or decline. The request is `GET /dtr-api/pending-approvals` with only `start` and `end`.
6. **Boundary checks:**
   - As a DTR member, `POST /dtr-api/sql-call` and `POST /dtr-api/hr-sql-call` with the harmless body `{}` return `404 {"message":"notFound"}`.
   - As the ordinary account, `GET /dtr-api/assigned-employees` returns `403 {"message":"forbidden"}`; without a session it returns `401`. Direct navigation to `/dtr/dtr-table` redirects to the portal.
   - As the assignment holder, `GET /dtr-api/period-entries?start=2026-12-21&end=2026-01-20` returns `400 invalidPeriod`, and `GET /dtr-api/employees/<a code outside the assignments>` returns `404 employeeNotFound`.
   - As the manager, adding `&managerCode=<another code>` to the pending-approvals request returns the same own queue.
   - Do not send SQL, injection payloads, or write requests to production for these checks.
7. **Phase 5 re-check, as a portal administrator:** in DTR setup, “List all under …” on one of the largest departments now loads within a second.
8. **Only with separate authorization (production write), on one designated test employee and period:** Phase 7 changed no write handler, so one save is enough to confirm the path.
   - First record whether that employee has an entry for that period and, if so, every day value, its status, and its decline message.
   - Change one day and save: the success message appears and the status shows “Ready to be sent for approval”. Reopen the calendar and confirm the value.
   - Restore: if an entry existed, set the recorded day values back and save. A save always leaves status `0`; if the recorded status was different, or if no entry existed before, restoring means a manual database operation through the approved operational procedure, targeting that single `id`. If that cannot be authorized, do not run the write test. Do not send for approval, approve, or decline as part of this phase's checks.
9. Check sanitized production logs for unexpected `400`, `401`, `403`, `404`, or `503` responses on DTR routes and confirm the portal, administration, DTR setup, business-card, CoC, and survey modules still load. Record outcomes below and mark Phase 7 **Deployed**, then **Verified**, only after those events occur. Do not start Phase 8 automatically.

Maintenance window: **Pending**. Deployed release: **Pending**. Account/test-record aliases and smoke results: **Pending**. Verified by/date: **Pending**.

#### Rollback / recovery

- If verification fails, keep the DTR screens under maintenance and preserve sanitized diagnostics. Prefer fixing forward. This phase has no schema or data migration to reverse and wrote no data.
- Do not restore an accessible release that serves `/dtr-api/sql-call` or `/dtr-api/hr-sql-call`; every pre-Phase-7 release does, and lets any signed-in employee run SQL on the portal and HR databases. A rollback candidate must also preserve the Phase 1–6 boundaries. If none exists, keep `/dtr` and `/dtr-api` unavailable (for example at the reverse proxy) until fixed; the other modules do not depend on this phase's routes.
- The recompile hint on the Phase 5 lists is part of this release. If only that hint is suspected, remove the single constant in `server/administration/services/dtrSetup.js` and redeploy rather than restoring an older release.
- Replace frontend and backend atomically and refresh browser/PWA caches. Do not restore only the old pages (they need the removed routes) or only the old routers. Existing entries and assignments are untouched; no deletion or regeneration is required for rollback.

### Phase 7 acceptance record — 2026-10-01

Before any Phase 8 edit, the user explicitly confirmed: “Yes, Phase 7 been tested and accepted”. This authorizes progression to Phase 8. Deployment, release identifier, maintenance window, account aliases, and individual smoke-check results were not supplied and are not inferred. The progress status remains **Implemented**; this confirmation does not manufacture a deployment or detailed **Verified** record. Historical implementation and recovery instructions above describe their original releases; the Phase 8 instructions below supersede their DTR deployment/write-check instructions for this checkout.

### Phase 8 implementation record — 2026-10-01

**Status: Implemented — local checks passed.** Deployment and production verification are pending. Starting checkout: `d50a278` (Phase 7). The existing deletion of `uploads/businessCards/E00025_QR_800x800.png` was preserved. No application startup, process restart, production data/schema write, email, deployment, commit, or push was performed. Phase 9 has not started.

#### API changes and workflow

All writes require the shared verified session and current DTR membership. Caller/editor identity comes only from `req.auth.employeeCode`. Assignment and employee scope reuse Phase 7 services, including active employment and the existing branch/hierarchy rules. No unused DTR role flag is activated.

| POST route under `/dtr-api` | Request body | Server-owned transition |
| --- | --- | --- |
| `/save-dtr-data` | `employeeCode`, `start`, `end`, `version`, `dtrEntries: [{date, type}]` | Absent entry or draft `0`/declined `2` → draft `0`, assigned employee only |
| `/submit` | `employeeCode`, `start`, `end`, `version` | Draft `0`/declined `2` → pending `1`, assigned employee only |
| `/approve` | `employeeCode`, `start`, `end`, `version` | Pending `1` → approved `3`, recorded manager only |
| `/decline` | Same single-target fields plus `declineMessage` | Pending `1` → declined `2`, recorded manager only |
| `/bulk-submit` | `start`, `end`, `targets: [{employeeCode, version}]` | Same submit rules for every target, atomically |
| `/bulk-approve` | Same bulk fields | Same approve rules for every target, atomically |

- Unknown body fields, SQL text, client-selected status, manager/editor/name/picture metadata, malformed periods/versions, duplicate targets, and unsupported day codes are rejected. Bulk requests contain 1–5000 distinct targets. Server-owned queries and identifiers use typed `mssql` inputs; ID lists are never assembled into SQL.
- Reads add an opaque `version` derived from the complete stored entry. Saving a genuinely absent entry requires `version: null`; other requests require the displayed version. Save returns `{message: 'dtrSaved', version}`; actions return `{message: 'dtrUpdated', affected}`. Existing read-consumer fields remain, with internal audit/manager fields used only for the version hash.
- Saves resolve employee name, picture, and manager from trusted HR data. Missing required values or values exceeding verified column capacity return `422 employeeInfoInvalid`, without truncation. Null/empty pictures are supported. Audit values now identify the authenticated employee code rather than a browser-supplied name. Existing rows are not rewritten by a migration.
- Pending and approved records cannot be saved, reopened, or submitted. Only the stored `ManagerCode` can decide a pending record. Manager decisions retain the Phase 7 ability to process already-pending inactive employees. No reopen endpoint exists.
- Declining stores nonblank Unicode text up to 300 characters and sets `DeclineFlag = 1`. Correction/save leaves the reason and flag visible while setting draft status. Resubmission clears both (`NULL`, `0`); approval also clears them. This matches the calendar feedback and avoids stale decline indicators after resubmission.
- Every actual day in the previous month's 21st through the current month's 20th must occur exactly once with a fixed code. Input order is immaterial. Columns are always server-owned `[21]`–`[31]`, `[1]`–`[20]`; nonexistent days are bound as `NULL`, covering 28/29/30/31-day months and year boundaries. Allowed codes: `RA`, `AB`, `AV`, `SV`, `UP<20`, `UP>20`, `D`, `NB`, `HA`, `MV`, `HDM`, `HDN`, `MRG`, `DOC`, `ST`. Submission validates saved actual-day codes too.
- Portal writes run in a serializable transaction. Membership/assignment reads remain locked through commit; entry reads use `UPDLOCK, HOLDLOCK` on employee and period, compare versions, and check states inside the transaction. Save/submit hold read-only serializable HR scope/manager data through the portal commit, then roll back that read-only transaction to release locks. Bulk targets are sorted, all checked before the first update, and committed together. Conditional updates additionally constrain status/manager and require exactly one affected row. Deadlock, duplicate creation, stale state, and stale versions return controlled `409 stateConflict`; other database failures return sanitized `503 serviceUnavailable`. All pools/transactions are released on success and failure.
- Audit time advances at least one SQL `datetime` tick on an immediate identical save, keeping old versions stale even after rapid corrections. No schema change or stored procedure is needed. A lost response after commit is still ambiguous to the client: reload before retrying.

#### Changed areas and complete caller inventory

- `server/dtr/services/dtrWrites.js` owns writes; `entryVersion.js` owns the fixed entry fields/hash; `dtrReads.js` exposes reusable Phase 7 scope logic and the response version. `router/dtr-actions.js`, `createApi.js`, and `main.js` compose authenticated reads/writes with bounded request bodies and controlled errors. The existing Nuxt `/dtr-api` mount is unchanged.
- `components/dtr/dtr-table/employeeCalendar.vue` calls save and single submit with the displayed version and complete day values, including default `RA` for formerly missing values. Pending/approved and failed-load calendars disable writes. A conflict preserves edits, disables further writes, and offers an explicit reload. Successful save updates the version/table state; submit closes the panel and refreshes the table.
- `pages/dtr/dtr-table/index.vue` retains versions in both refresh paths and sends structured bulk-submit targets. It refreshes after success/failure. The approvals page sends single approve/decline and bulk-approve requests, retains selection/version across confirmation, removes successful rows, clears committed selections, and refreshes on errors. Each confirmation dialog is bound to its selected employee and displayed version, including cached panels. The decline field and all new feedback/confirmation/reload text have English and Arabic translations.
- The calendar's old employee-info request is no longer needed: save metadata is resolved on the server. Phase 7's safe employee-detail read and Vuex action remain available. Assigned-employee, period-status, calendar, and pending-approval reads remain fixed, scoped routes.
- `server/dtr/router/sqlCalls.js` is deleted, and all mounted legacy aliases are removed. `/dtr-api/sql-call`, `/sql-params-call`, and `/hr-sql-call` return `404`; there are no remaining DTR callers or fallback gateways. `CLAUDE.md` now reflects this boundary. SQL execution and procedure audits outside this phase remain Phase 9 work.

#### Database evidence and remaining limitations

Read-only metadata was checked against Phase 7: all **43/43** entry-column types/capacities match, with **two unique indexes and no triggers**. The new seven portal statements, assignment read, three revised entry reads, and four HR scope statements were checked with typed declarations inside `IF 1 = 0 BEGIN ... END`: **15/15 compiled without executing writes**. Both negative controls were rejected (SQL errors 207 and 156). No credentials, connection details, employee rows, or tokens were printed or recorded.

`OBJECT_DEFINITION` remains unavailable (`NULL`) for the retired `dtr.dtrEntries_checkIfExist` and administration's `dtr.adminAssignment_addData`. The new save does not execute the former, but their definitions remain **unverified**, as recorded in Phase 7; administration procedure internals still need Phase 9 review. No application-wide SQL/security completion claim is made.

Local transaction fixtures simulate locking, failures, and rollback. They do not prove real SQL Server contention behavior, runtime write permissions, commit ambiguity, or large-batch performance. Holding serializable HR reads can delay HR updates; monitor timeout/deadlock rates and bulk duration during production checks. Real browser/mobile interaction and production English/Arabic layouts are pending; local Vue/Vuetify SSR checks cover both directions and control states. Historical rows may retain manager/editor metadata previously supplied by clients; verify the manager of designated test rows against trusted HR before testing. No background jobs, sessions, static-document access, or legacy records were redesigned.

#### Validation and second review

| Command/check | Actual result |
| --- | --- |
| Baseline `npm run test:security` before edits | 133 passed, 0 failed |
| Final `npm run test:security` | **158 passed, 0 failed**, exit 0; all 26 new write tests and 21 retained read tests ran through the explicitly updated command |
| Final `npm run lint` | **Passed**, exit 0, no warnings |
| Final `npm run build` | **Passed**, exit 0; client and server compiled. Existing outdated Browserslist, large bundle, and large PDF-module Babel notices remain |
| `git diff --check` | Passed; only Git line-ending conversion notices |
| Read-only database checks | 43/43 metadata match; 15/15 statements compiled; negative controls rejected; no writes |
| Independent source/compiled-client searches | No retired DTR gateway callers or browser-built DTR SQL found |
| Isolated HTTP retirement checks | All three retired paths return `404` for five tested HTTP methods, with and without sessions; no database pool is opened |

`tests/security/dtr-writes.test.js` exercises the isolated injected Express API and service, while `tests/security/helpers/dtr-fixture.js` shares scoped fixtures with read tests. Tests never load `.env` or application entry points. Coverage includes the complete draft/submission/decline/correction/resubmission/approval chain; membership revoked during a request; assignment/manager/editor impersonation; pending/approved protection; repeated and stale actions; simultaneous saves/creation and manager decisions; mixed forbidden/stale/invalid bulk requests changing zero rows; successful bulk operations; second-write/affected-row failure rollback; day codes, duplicate/missing/out-of-period days, leap/short months, reordered mapping, and other-period isolation; trusted data capacities; pool/transaction failures and cleanup; frontend payloads, feedback, refresh, stale reload, selected-dialog versions, translations, and real Vue 2/Vuetify SSR calendar controls in English/Arabic RTL. An obsolete Phase 7 test asserting that the write SQL gateway still worked was replaced with retirement coverage; existing applicable read cases remain.

Initial test assertions tied to the retired route/data shape and initial lint failures were corrected. After the first passing implementation, the complete diff (including new files) was reviewed again from callers through authentication, scope, validation, binding, transaction, response, and errors. That review corrected duplicate status-refresh code, empty-picture compatibility, incomplete default-day payloads, conflict reload behavior, misleading confirmation text, and shared/cached approval dialogs. Regression cases were added and the full security/lint/build checks were rerun. Independent `rg` searches included affected server, frontend/store, router mounts, and compiled client assets, as well as direct HTTP retirement tests.

#### Deployment and production verification checklist — user performs these steps

1. Record the release and maintenance window, prior table/approval counts, and aliases for an assignment holder, a recorded manager who is a DTR member, and an account without DTR membership. Preserve the unrelated deleted QR image according to the user's intended release. No schema or session migration is required.
2. Stop all workers and deploy frontend/backend together, including the new version/write services, revised read services/router/API composition, deleted SQL router, calendar/table/approval pages, and both locales. Follow the user's normal `npm ci`, build, and PM2 deployment procedure. Refresh browser/PWA caches; do not mix old workers or clients. Old SQL clients must receive `404`/validation errors, never an SQL fallback.
3. **Read-only, English and Arabic, desktop and mobile:** compare assignment/table/approval counts; inspect all four statuses and decline reasons; confirm pending/approved calendars have disabled writes, absent entries show defaults, and failed reads require reload. Change periods across December/January and February in leap/nonleap years and verify the 21st–20th mapping. Open multiple approval panels and confirm each dialog shows the selected employee. Developer tools should show the scoped Phase 7 GET routes and opaque versions, with no legacy SQL requests.
4. **Read-only boundaries:** harmless `POST {}` to each of `/dtr-api/sql-call`, `/dtr-api/sql-params-call`, `/dtr-api/hr-sql-call` must return `404`, including a DTR member. Without a session, a protected read returns `401`; a nonmember receives `403`; out-of-scope employee reads retain Phase 7's rejection. Do not send SQL or injection payloads to production.
5. **Production writes require separate authorization first.** Designate two employees and exact periods for the checks below. Securely record whether each row exists and, if it does, its primary key and **every prior column**, including all day placeholders, status, decline text/flag, manager, employee metadata, and audit values. Keep employee data out of this document. Obtain authorization for exact operational restoration before testing: approved rows are immutable through these APIs and newly created rows have no delete/reopen API. If restoration is not authorized, perform only read-only checks.
6. On a designated eligible employee/period, execute save → submit → recorded-manager decline with Unicode/apostrophe text → correction/save → resubmit → approve. Confirm statuses `0 → 1 → 2 → 0 → 1 → 3`, visible correction reason, cleanup on resubmission, success messages/table refresh, authenticated audit identity, and no change to other periods. A second tab with an old version must receive `409`; simultaneous manager decisions must leave one accepted decision and one controlled conflict. Reload before another attempt, especially after a lost response.
7. On separately agreed eligible periods/rows for the two designated employees, bulk-submit then bulk-approve. For a mixed stale batch, capture two pending versions, decide one singly, then submit the captured bulk-approval request: expect `409` and the other row unchanged. An authenticated DTR member without the relevant assignment/recorded-manager role must receive `403` for the same designated targets, with zero changes. Record before/after values. Do not induce database failures in production; rollback-on-failure is covered locally. Use separate agreed rows/periods where necessary because approved entries cannot reopen.
8. Restore exact previous values through the separately authorized operational process, targeting each existing row by primary key plus employee/period. If originally absent, remove only the newly created designated row identified by its new primary key. Restore audit/manager/metadata/decline fields and nonexistent-day placeholders too; verify full values and counts afterward. Never use a retired gateway or introduce a reopen bypass for restoration.
9. Inspect sanitized logs for unexpected `400/401/403/409/503`, SQL timeouts/deadlocks, and slow bulk operations; smoke-test portal, administration/DTR setup, business cards, CoC, and surveys. Record the actual release, aliases, outcomes and restoration evidence. Mark **Deployed**/**Verified** only when confirmed. Stop before Phase 9.

Maintenance window: **Pending**. Deployed release: **Pending**. Account/test-record aliases, separate production-write/restoration authorization, smoke results, and restoration evidence: **Pending**. Verified by/date: **Pending**.

#### Rollback / recovery

- Keep DTR functionality under maintenance if verification fails; preserve sanitized diagnostics and fix forward. There is no schema migration to reverse. Restore only separately authorized designated test records from their saved snapshots.
- Phase 7 and earlier releases expose at least one retired DTR SQL gateway and are **not safe accessible rollback targets**. A rollback candidate must retain all three DTR retirements and the Phase 1–7 boundaries. If none exists, block `/dtr` and `/dtr-api` at the reverse proxy until fixed; leave unrelated modules available as appropriate.
- Replace frontend/backend together and refresh caches. Preserve assignments and application data. Recovery must not enable SQL gateways, create an unapproved reopen workflow, or regenerate/delete existing DTR records.
