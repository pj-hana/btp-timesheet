# WFS Wrapper API — Technical Specification

**Version**: 0.3 (implemented `getPeriodsByEmpId` — 8th operation; see §5.2.1)
**Component**: `wfs-service` (standalone CAP project, `/app/wfs-service`)
**Reference**: [CLAUDE.md](../../../CLAUDE.md), [SAP_BTP_Timesheet_UI_Detailed_Solution_Design_For_Claude.md](../../../SDD/SAP_BTP_Timesheet_UI_Detailed_Solution_Design_For_Claude.md)

---

## 1. Business Requirement

### 1.1 Requirement Overview

WFS (WorkForce Software) exposes its integration surface only via SOAP (plus one REST endpoint
for calculated time, out of scope here — see §1.3). Per `CLAUDE.md`, SOAP is preferred over REST
for WFS operations due to stability issues, and the future Timesheet API BFF is built with SAP
CAP. CAP's native remote-service integration (CALESI, `cds.connect.to()` / `cds import`) has no
SOAP adapter — it only understands OData/OpenAPI/REST. This wrapper exists to close that gap:
it is a standalone CAP service that translates the 8 in-scope WFS SOAP operations into a clean
OData v4 contract, so the future BFF (or anything else) can consume WFS the same way it consumes
any other CAP/OData remote service.

### 1.2 Core Functions

1. Read employee pay codes / policy sets (`getPolicySet`)
2. Read WFS timesheet status + policy profile (`getTimesheetStatusInfo`)
3. Read time-off requests (`getTimeOffRequests`)
4. Read employee roster/schedule (`getEmployeeSchedule`)
5. Submit a WFS timesheet (`submitTimeSheet`)
6. Batch-import time data and obtain a job ID (`importTimeData`)
7. Poll a batch job's status (`getJobStatus`)
8. Read an employee's list of pay periods, with schedule/timesheet detail and metadata
   (`getPeriodsByEmpId`) — see §5.2.1.

### 1.3 Out of Scope

- The WFS REST `/calculated-time/employee/v1` endpoint — its OpenAPI spec (`API Specs/REST/wfs-integration-api.yaml`)
  defines no base URL and no auth scheme anywhere; building it now would mean guessing at both.
- Batch/poll orchestration (looping `getJobStatus` until a submitted job completes, scheduling,
  HANA persistence of job state) — see `Diagrams/Timesheet_API_05_Submit_To_WFS.mmd`. This wrapper
  exposes `submitTimeSheet`/`importTimeData`/`getJobStatus` as single-call operations only; the
  future Timesheet API BFF owns the loop.

---

## 2. Design Principles

- **Thin protocol adapter, not a second business layer.** Every operation is a direct 1:1 wrapper
  around one WFS SOAP call. No aggregation, caching, or cross-operation logic.
- **Stateless.** System of engagement, not record — no `db/` schema, nothing persisted between
  requests.
- **No invented types.** Where the WSDL gives no confirmed format (several date/time fields
  declared `xs:string` with no example anywhere in-repo) or no enumeration (status/state fields),
  the CDS model keeps them as plain `String` rather than guessing — see §5.
- **Single error convention.** All 8 operations wrap responses in `WSResultObjectBase`, and none of
  the 8 WSDLs declare a `wsdl:fault` — `operationSuccessful=false` is the only error signal. One
  shared mapper (`WfsErrorMapper`) is the only place that inspects it.

---

## 3. Architecture

```
┌─────────────────────────── Out of scope for this document ───────────────────────────┐
│                                                                                        │
│   Future Timesheet API (CAP BFF) — consumes this service as a normal remote OData v4  │
│   service via cds.connect.to() / CALESI, once built                                   │
│                                                                                        │
└────────────────────────────────────────┬───────────────────────────────────────────────┘
                                          │  OData v4 (HTTP)
                                          ▼
┌────────────────────────────────── wfs-service (this project) ─────────────────────────┐
│                                                                                         │
│   WFSService (CDS)  ──►  WfsService (TS class, cds.ApplicationService)                 │
│                              │                                                         │
│                              ├─► WfsErrorMapper   (operationSuccessful=false handling) │
│                              ├─► WfsMapper         (wire <-> clean CDS-native scalars) │
│                              └─► WfsSoapClient     (soap npm client, 1 method/op)      │
│                                        │                                               │
│                                        │  WS-Security UsernameToken (PasswordDigest)   │
└────────────────────────────────────────┼───────────────────────────────────────────────┘
                                          ▼
                          WFS SOAP endpoints (origin-dev.au.wfs.cloud, SOAP 1.2)
```

- **Type of API**: OData V4 (this service's own contract); SOAP 1.2 (upstream, to WFS)
- **Consumer**: future Timesheet API (BFF); directly testable standalone via `cds watch` until then

---

## 4. Build Objects

| Layer | Object | Purpose |
|---|---|---|
| CDS model | `srv/wfs-service.cds` | `WFSService` — 6 functions (reads) + 2 actions (writes), 19 non-persisted structured types |
| Service impl | `srv/wfs-service.ts` | `WfsService` class — one handler per operation, wires mapper + error + SOAP client together |
| SOAP adapter | `srv/lib/wfs-soap-client.ts` | `WfsSoapClient` — one method per WFS operation, wraps the `soap` npm client |
| Mapper | `srv/lib/wfs-mapper.ts` | `WfsMapper` — static conversions between WFS wire shapes and clean CDS-native scalars |
| Error mapper | `srv/lib/wfs-error.ts` | `WfsErrorMapper` — single `unwrap()` entry point for the `operationSuccessful` convention |
| Config | `srv/lib/wfs-config.ts` | `WfsConfig` — resolves SOAP endpoint base + WS-Security credentials |
| Wire types | `srv/lib/wfs-types.ts` | TS interfaces mirroring the 8 WSDLs exactly (never exposed past the mapper layer) |
| WSDLs | `wsdl/*.wsdl` | Local static copies of `API Specs/SOAP/*.xml` |

---

## 5. Field Specifications

### 5.1 Type mapping principle

WFS wire values collapse to native CDS scalars at the service boundary (`Date`, `DateTime`,
`Int64`) rather than mirroring `WSDate{day,month,year}` / `WSGeneratedId{id}` as nested structs —
those are Axis2 serialization artifacts, not business concepts. Conversion happens only inside
`WfsMapper`.

**Important asymmetry, confirmed against every WSDL of the original 7 operations**: WFS only uses
structured `WSDate`/`WSDateTime` on **request** parameters (`effectiveDate`, `asOfDate` on
`getTimesheetStatusInfo`'s input, `dateRange` on `getTimeOffRequests`/`getEmployeeSchedule`,
`lastModifiedAfter`). Every **response** field that carries a date/time value is declared plain
`xs:string` in the WSDL, with no example format anywhere in-repo — those are passed through
untouched as CDS `String`, not parsed into `Date`/`DateTime`. Getting this backwards (as an early
draft of this model did) risks silently truncating or corrupting real WFS timestamps once
integrated. Affected response fields: `TimeOffDetail.{startDateTime,endDateTime,workDate}`,
`TimeOffRequest.{startDate,endDate,requestMadeAt, systemTimestamp}`, `EmployeeScheduleEntry.
{startDateTime,endDateTime,workDate}`, `TimesheetStatusInfo.{asOfDate,payPeriodStartDate,
payPeriodEndDate}`, `JobStatus.{startTime,endTime}`, `TimeRecordInput.{workDate,startDttm,endDttm}`
(WFS types these as strings even as import *input*), `ImportTimeDataResult.startDateTime`.

**`getPeriodsByEmpId` (8th operation, added later) is the one confirmed exception to this rule**: its
WSDL genuinely declares `endDateTime`/`startDateTime`/`workDate`/`TimeSheetException.date` as
structured `WSDate`/`WSDateTime` on the **response** side too, unlike all 7 other operations. This
model follows the WSDL literally for that one operation (`ScheduleDetailRow`/`TimeSheetDetailRow`/
`TimeSheetException` fields are CDS `Date`/`DateTime`, converted via `WfsMapper.fromWsDate`/
`fromWsDateTime`), rather than applying the plain-`String` convention derived from the other 7 — see
§5.2.1 for the full rationale and the still-open confirmation item (§11 item 7).

Other deliberate non-inventions:
- `status` / `currentState` / `batch_job_status` stay plain `String` — the WSDL declares no
  enumeration values for any of them.
- `hours` fields stay `Double` (WSDL types them `xs:double`), not `Decimal`.
- `periodEndDate` (submitTimeSheet input) stays `String` — WSDL types it `xs:string`, not `WSDate`.

### 5.2 Operations

| CDS operation | Kind | WFS SOAP operation | Input | Output |
|---|---|---|---|---|
| `getPolicySet` | function | `E2G_OE_getPolicySet` | `effectiveDate:Date, policySetName:String, policyType:String` | `array of String` |
| `getJobStatus` | function | `E2G_getJobStatus` | `jobId:Int64, includeLog:Boolean` | `JobStatus` |
| `getTimesheetStatusInfo` | function | `E2G_OE_getTimesheetStatusInfo` | `employeeId:String, asOfDate:Date` | `TimesheetStatusInfo` |
| `getTimeOffRequests` | function | `E2G_OE_getTimeOffRequests` | `employeeId:many String, startDate/endDate:Date, lastModifiedAfter:DateTime, status:many String, getDetails:Boolean` | `array of TimeOffRequest` |
| `getEmployeeSchedule` | function | `E2G_OE_getEmployeeSchedule` | `employeeId:String, startDate/endDate:Date, payCodeSet:String, version:String` | `array of EmployeeScheduleEntry` |
| `submitTimeSheet` | action | `E2G_submitTimeSheet` | `assignmentMatchId, employeeMatchId, periodEndDate: String` | `String` |
| `importTimeData` | action | `E2G_importTimeData` | `sourceSystem:String, employees:many EmployeeTimeInput, properties:many GenericField` | `ImportTimeDataResult` |
| `getPeriodsByEmpId` | function | `E2G_getPeriods_by_EmpId` | `employeeId:String, numberOfPriorPeriods:Integer, requestDate:Date` | `PeriodDataListByEmpId` |

Full field-level type definitions for every structured type (`TimeOffRequest`, `EmployeeScheduleEntry`,
`TimesheetStatusInfo`, `JobStatus`, `EmployeeTimeInput`/`TimeRecordInput`, `ImportTimeDataResult`,
`PeriodDataListByEmpId` and its nested types) are in `srv/wfs-service.cds` — not duplicated here to
avoid drift between spec and source. §5.2.1 below is kept as a reference for `getPeriodsByEmpId`
specifically because of the date/time-typing decision it documents (§5.1).

#### 5.2.1 `getPeriodsByEmpId` field spec

Source: `API Specs/SOAP/E2G_getPeriods_by_EmpId.xml`, copied to `wsdl/E2G_getPeriods_by_EmpId.wsdl`.
Implemented across `srv/wfs-service.cds` (types `FieldLabel`, `PayCode`, `TimeSheetMetaData`,
`AssignmentInfo`, `TimeSheetId`, `ScheduleDetailRow`, `TimeSheetDetailRow`, `TimeSheetException`,
`PeriodData`, `PeriodDataListByEmpId`), `srv/wfs-service.ts` (`onGetPeriodsByEmpId`),
`srv/lib/wfs-soap-client.ts` (`getPeriodsByEmpId`), and `srv/lib/wfs-mapper.ts`
(`WfsMapper.fromPeriodsByEmpId` and its private per-type helpers).

**Request** (`E2g_period_data_request_by_empid`):

| Field | WFS wire type | CDS-native type |
|---|---|---|
| `employeeId` | `xs:string` | `String` |
| `numberOfPriorPeriods` | `xs:int` | `Integer` |
| `requestDate` | `WSDate` | `Date` (structured `WSDate{day,month,year}` per §5.1 principle) |

**Response** (`E2G_getPeriods_by_EmpIdResult`, wraps `WSResultObjectBase` per §6.1) →
`result: PeriodDataListByEmpId`:

| Type | Field | WFS wire type | CDS-native type |
|---|---|---|---|
| `PeriodDataListByEmpId` | `periodMetaData` | `E2g_time_sheet_meta_data` | `TimeSheetMetaData` |
| | `periods` | `array of E2g_period_data` | `array of PeriodData` |
| `TimeSheetMetaData` | `fieldLabels` | `array of E2g_field_label{field,label}` | `array of FieldLabel{field:String, label:String}` |
| | `payCodes` | `array of E2g_pay_code{payCode,payCodeType}` | `array of PayCode{payCode:String, payCodeType:String}` |
| `PeriodData` | `managerApproval` | `xs:string` | `String` |
| | `periodId` | `E2g_time_sheet_id` | `TimeSheetId` (below) |
| | `scheduleDetailRow` | `array of E2g_schedule_detail_row` | `array of ScheduleDetailRow` (below) |
| | `submittedByEmployee` | `xs:boolean` | `Boolean` |
| | `timeSheetDetailRow` | `array of E2g_time_sheet_detail_row` | `array of TimeSheetDetailRow` (below) |
| | `timeSheetException` | `array of E2g_time_sheet_exception` | `array of TimeSheetException` (below) |
| `TimeSheetId` | `assignmentInfo` | `E2g_assignment_info{assignmentDescription:string, assignmentId:WSGeneratedId}` | `AssignmentInfo{assignmentDescription:String, assignmentId:Int64}` |
| | `payPeriodBeginDate` / `payPeriodEndDate` | `WSDate` | `Date` (structured `WSDate`, per §5.1) |
| `ScheduleDetailRow` | `amount` | `xs:double` | `Double` |
| | `comments` | `xs:string` | `String` |
| | `endDateTime` / `startDateTime` | `WSDateTime` | **`DateTime`** — see note below |
| | `hours` | `xs:int` | `Integer` |
| | `ld` | `array of xs:string` | `array of String` |
| | `payCode` | `xs:string` | `String` |
| | `unit` | `array of xs:double` | `array of Double` |
| | `workDate` | `WSDate` | **`Date`** — see note below |
| `TimeSheetDetailRow` | same shape as `ScheduleDetailRow` plus `inSwipeLatitude`/`inSwipeLongitude`/`outSwipeLatitude`/`outSwipeLongitude` (`xs:double` → `Double`); `hours` is `xs:double` → `Double` here (not `Integer`) | | |
| `TimeSheetException` | `code` | `xs:string` | `String` |
| | `date` | `WSDate` | **`Date`** — see note below |
| | `message` | `xs:string` | `String` |
| | `severity` | `Exception_severityChoice{exception_severity:string}` | `String` |
| | `temporaryExceptionKey` | `WSGeneratedId` | `Int64` |
| | `type` | `WSPolicyId{policyId:string}` | `String` |

**Response-field date/time asymmetry, §5.1 note**: `endDateTime`/`startDateTime`/`workDate` (both
detail-row types) and `TimeSheetException.date` are structured `WSDate`/`WSDateTime` types in this
WSDL, unlike the other 7 operations' response fields (plain `xs:string`, per §5.1). This build follows
the WSDL literally here — CDS `Date`/`DateTime`, round-tripped via the new `WfsMapper.fromWsDate`/
`fromWsDateTime` (inverses of the existing request-side `toWsDate`/`toWsDateTime`) into ISO
`YYYY-MM-DD` / `YYYY-MM-DDTHH:mm:ssZ` strings. **This is still unconfirmed against a live WFS
payload** (§11 item 7) — if WFS actually serializes these as plain strings in practice despite the
WSDL's structured declaration (as turned out to be true, in effect, for the other 7 operations' WSDLs
in a different way — see §5.1), the `soap` npm client would fail to parse the response into the shape
`WfsMapper` expects, or silently produce `undefined` dates. Revisit once a real sample is available.

### 5.3 Naming

The exposed CDS layer drops the `E2G_`/`OE_` WFS prefixes (e.g. `E2G_OE_getPolicySet` →
`getPolicySet`), matching the sibling CATS API's plain-business-name convention
(`SAP_CATS_API/Spec/SAP CATS API - Technical Spec.md`). This is a stylistic choice, not yet
confirmed with the user (see §11).

---

## 6. Behavior Specification

### 6.1 Error handling (`WfsErrorMapper.unwrap`)

Every WFS response wraps in `WsResultObjectBase<T> { operationSuccessful, resultCode,
resultDescription, detailedErrorMessage, result: T }`. Every handler calls
`WfsErrorMapper.unwrap(result, req)`:

- Empty/missing SOAP response → `req.reject(502, 'Empty response from WFS')`.
- `operationSuccessful === false` → `req.reject({ code: 'WFS_<resultCode>', message:
  detailedErrorMessage || resultDescription || 'WFS operation failed', status: 502 })`.
- Otherwise → returns the unwrapped `result` payload.

`req.reject()` (not `req.error()`) is used deliberately: `req.error()` only queues the error and
returns normally (per `@sap/cds/lib/req/request.js`), so a handler that does further mapping on
the payload (e.g. `getJobStatus` calling `WfsMapper.fromJobStatus`) would crash with a generic 500
on a null/absent `result`, masking the intended 502. This was caught and fixed via the integration
test suite (§13) — an earlier draft used `req.error()` and produced exactly that failure mode.

No `resultCode` → meaning table exists anywhere in-repo, so all failures currently map to a
generic HTTP 502 (see §11, open item).

### 6.2 SOAP client (`WfsSoapClient`)

- One cached `soap.Client` per operation (`Map<operation, Client>`), created once via
  `soap.createClientAsync(wsdlPath, { forceSoap12Headers: true })` against the local WSDL copy —
  decouples app startup from live WFS availability.
- Endpoint resolved per call: `<WFS_SOAP_ENDPOINT_BASE>/<Operation>.<Operation>HttpsSoap12Endpoint/`
  — this exact path pattern was confirmed against every WSDL's `soap:address` for the SOAP 1.2
  binding, including `E2G_getPeriods_by_EmpId`'s.
- Auth: `soap.WSSecurity(username, password, { passwordType: 'PasswordDigest' })` — WS-Security
  UsernameToken embedded in the SOAP envelope, confirmed against `API Specs/WFS_API_SOAPUI.xml`
  (`wssPasswordType="PasswordDigest"`, HTTP-layer `authType: No Authorization`). This overrides the
  SDD's mention of "OAuth Client Credentials" (§15.6), which appears stale/inaccurate for the SOAP
  layer — see §11.

---

## 7. Service Definition — `WFSService`

Defined in `srv/wfs-service.cds`, namespace `com.origin.wfs`, path `/wfs-service`,
`@(requires: 'authenticated-user')`.

---

## 8. Auth & Security

| Concern | Local dev | BTP deployment |
|---|---|---|
| Service-level auth | `kind: 'mocked'`, user `bff-svc` with role `authenticated-user` | `kind: 'xsuaa'` |
| WFS credentials | `.env` (gitignored): `WFS_SOAP_ENDPOINT_BASE`, `WFS_SOAP_USER`, `WFS_SOAP_PASSWORD` | Bound BTP Destination (mechanism TBD — see §11) |

The real caller in production will be the future Timesheet API BFF, calling server-to-server —
`authenticated-user` is enforced now regardless, since retrofitting auth later is more expensive
than requiring it from the start.

---

## 9. OData URL Examples

```
GET  /wfs-service/getPolicySet(effectiveDate=2026-01-01,policySetName='STANDARD',policyType='WEEKLY')
GET  /wfs-service/getJobStatus(jobId=12345,includeLog=true)
GET  /wfs-service/getTimesheetStatusInfo(employeeId='E1',asOfDate=2026-01-01)
POST /wfs-service/submitTimeSheet
     { "assignmentMatchId": "AM1", "employeeMatchId": "EM1", "periodEndDate": "2026-01-14" }
POST /wfs-service/importTimeData
     { "sourceSystem": "BFF", "employees": [...], "properties": [] }
GET  /wfs-service/getPeriodsByEmpId(employeeId='E1',numberOfPriorPeriods=3,requestDate=2026-01-01)
```

`getTimeOffRequests` / `getEmployeeSchedule` take `many String`/collection-valued GET parameters —
exercised via the CDS model + metadata check (§13), not via a hand-built collection-literal URL in
this doc, since the exact OData v4 collection-parameter encoding is CAP/library behavior, not
something this wrapper controls.

---

## 10. Testing

- **Unit** (`test/wfs-mapper.test.ts`, 21 tests): `WfsMapper`'s date/time/ID conversions (including
  the new `fromWsDate`/`fromWsDateTime` inverses), generic field wrapping, `importTimeData` request
  shaping, and response mapping (including the full `getPeriodsByEmpId` nested-type round-trip) — no
  CAP bootstrap.
- **Integration** (`test/wfs-service.test.ts`, 11 tests): boots the real CAP service via
  `cds.test()`, with `WfsSoapClient` replaced by the manual mock at
  `srv/lib/__mocks__/wfs-soap-client.ts` (shared `jest.fn()`s via `jest.requireMock`, so the
  service's own `new WfsSoapClient()` and the test's assertions target the same mock instance).
  Covers: happy-path mapping and WFS-failure → 502 for `getPolicySet` / `getTimesheetStatusInfo` /
  `submitTimeSheet` / `getPeriodsByEmpId`; `getJobStatus`'s `batch_job_status` unwrapping;
  `importTimeData`'s nested wire shaping; and unauthenticated requests → 401 (**currently broken**,
  see §11 item 9 — unrelated pre-existing issue, not introduced by `getPeriodsByEmpId`).
- `npm test` runs `cds compile` + `tsc --noEmit` as a `pretest` step before the Jest suite.
  `srv/wfs-service.ts`'s `getPeriodsByEmpId` handler return needs one `as unknown as
  PeriodDataListByEmpId` cast — `WfsMapper` deliberately stays CDS-agnostic and returns ISO date
  strings, but cds-typer's generated `CdsDate`/`CdsDateTime` are branded template-literal types it
  can't verify structurally from a plain `string` at compile time.
- `@cds-models/` (cds-typer output) was regenerated via `npx cds-typer srv/wfs-service.cds` after
  the model change — required manually here since this build's `npm run build`/`watch` scripts don't
  run it as a pretest step; re-run it after any further `.cds` model edits.
- Manually verified (this build): `npm test` passes `cds compile` + `tsc --noEmit`, and all
  `getPeriodsByEmpId`-related unit/integration tests pass. Did **not** re-verify `cds watch` boot or
  a live WFS call for this addition (no live WFS environment available) — see §11 item 7 for the
  still-open date-format confirmation this implies.

---

## 11. Open Items & Risks

1. Confirm the real string format for `periodEndDate` (submitTimeSheet input) and the several
   response date/time fields WFS returns as plain strings (§5.1) — no example exists anywhere
   in-repo for any of them.
2. Confirm whether a `resultCode` → meaning table exists on the WFS side; until then all failures
   map to a generic HTTP 502.
3. **Confirm the WFS auth mechanism with the WFS/SAP integration team.** This build assumes
   WS-Security UsernameToken/PasswordDigest based on direct evidence in
   `API Specs/WFS_API_SOAPUI.xml`, which contradicts the SDD's "OAuth Client Credentials" (§15.6).
4. Confirm the BTP destination approach/naming for the WFS SOAP endpoint once ready to deploy (one
   shared destination across all 7 operations, since they share a host, is the working assumption).
5. **Rotate the plaintext WS-Security credential found in `API Specs/WFS_API_SOAPUI.xml`** — it
   must not be reused as a real dev/test credential.
6. Confirm acceptability of dropping the `E2G_`/`OE_` prefixes in the exposed CDS names (§5.3).
7. `E2G_getPeriods_by_EmpId` (`getPeriodsByEmpId`) is now implemented (§5.2.1), but its
   response-field date/time handling is unverified against a real WFS payload: this build maps
   `ScheduleDetailRow`/`TimeSheetDetailRow`/`TimeSheetException`'s date/time fields as structured
   CDS `Date`/`DateTime` because that is what the WSDL literally declares — a deliberate departure
   from the plain-`String` convention used for the other 7 operations' response dates (§5.1). No
   live call has been made to confirm WFS actually serializes these as structured `WSDate`/
   `WSDateTime` in practice rather than as plain strings despite the WSDL. Confirm with a real
   sample before relying on this in production; if wrong, the `soap` client will fail to parse the
   response or `WfsMapper.fromWsDate`/`fromWsDateTime` will silently return `undefined`.
8. The REST `/calculated-time/employee/v1` endpoint (§1.3) remains deferred pending a confirmed
   base URL and auth scheme.
9. **`@(requires: 'authenticated-user')` on `WFSService` is commented out** in
   `srv/wfs-service.cds` (line 3 has the annotation, but is commented out; the active line 4 has
   none) — discovered via the pre-existing `rejects unauthenticated requests` test, which currently
   fails (requests without credentials reach the handler and get a 502 instead of a 401). This
   predates the `getPeriodsByEmpId` work in this version and was not changed by it; §7/§8 of this
   doc describe the intended (annotated) behavior, which does not match the current source. Needs a
   decision: restore the annotation (matches this doc and package.json's mocked-auth config) or
   update the doc/tests if disabling it was intentional.

---

## 12. Reference Files in Repository

- `API Specs/SOAP/*.xml` (including `E2G_getPeriods_by_EmpId.xml`) — source WSDLs, copied into
  `wsdl/*.wsdl`
- `API Specs/WFS_API_SOAPUI.xml` — SOAPUI project with sample requests; source of the WS-Security
  evidence in §6.2 and the credential-rotation flag in §11
- `API Specs/REST/wfs-integration-api.yaml` — REST spec for the deferred calculated-time endpoint
- `SAP_CATS_API/Spec/SAP CATS API - Technical Spec.md` — sibling API spec; doc template and
  naming-convention source
- `Diagrams/Timesheet_API_05_Submit_To_WFS.mmd` — the submit→batch→poll sequence this wrapper's
  `submitTimeSheet`/`importTimeData`/`getJobStatus` are single-call building blocks for
