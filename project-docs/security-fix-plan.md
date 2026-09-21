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

| Phase | Status      | Production verification                          |
| ----- | ----------- | ------------------------------------------------ |
| 1     | Verified    | User confirmed deployed and working on 2026-09-16 |
| 2     | Implemented | Pending; deployment is user-controlled            |
| 3–9   | Not started | Pending; do not advance automatically             |

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
