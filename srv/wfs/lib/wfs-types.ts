/**
 * WFS SOAP wire-format shapes, as declared in the WSDLs under `wsdl/` (copied from
 * `API Specs/SOAP/*.xml`). Nothing in this file is CDS-facing — conversion to/from the
 * clean CDS-native shapes happens exclusively in `wfs-mapper.ts`.
 */

export interface WsDate {
  day: number;
  month: number;
  year: number;
}

export interface WsDateTime extends WsDate {
  hours: number;
  minutes: number;
  seconds: number;
}

export interface WsGeneratedId {
  id: number;
}

/** Every WFS SOAP response extends this — there is no WSDL fault, this is the only error signal. */
export interface WsResultObjectBase<T> {
  detailedErrorMessage?: string;
  operationSuccessful: boolean;
  resultCode: number;
  resultDescription?: string;
  result: T;
}

export interface GenericFieldWire {
  fieldName?: string;
  fieldValue?: string;
}

// --- E2G_OE_getPolicySet ---

export interface GetPolicySetInput {
  effectiveDate?: WsDate;
  policySetName?: string;
  policyType?: string;
}

export type GetPolicySetResult = WsResultObjectBase<string[]>;

// --- E2G_submitTimeSheet ---

export interface SubmitTimeSheetInput {
  assignmentMatchId?: string;
  employeeMatchId?: string;
  /** Plain string per WSDL (not WSDate) — real format unconfirmed, passed through untouched. */
  periodEndDate?: string;
}

export type SubmitTimeSheetResult = WsResultObjectBase<string | undefined>;

// --- E2G_getJobStatus ---

export interface GetJobStatusInput {
  includeLog?: boolean;
  jobId?: WsGeneratedId;
}

export interface BatchJobStatusChoice {
  /** Free-text — WSDL declares no enumeration values. */
  batch_job_status?: string;
}

export interface JobStatusResponseWire {
  completedTasks?: number;
  description?: string;
  endTime?: string;
  errorCount?: number;
  log?: string;
  messages?: number;
  startTime?: string;
  status?: BatchJobStatusChoice;
  totalTasks?: number;
  warningCount?: number;
}

export type GetJobStatusResult = WsResultObjectBase<JobStatusResponseWire>;

// --- E2G_OE_getTimesheetStatusInfo ---

export interface GetTimesheetStatusInfoInput {
  asOfDate?: WsDate;
  employeeId?: string;
}

export interface TimesheetStatusInfoWire {
  approvalLevel?: string;
  asOfDate?: string;
  assignmentId?: string;
  currentState?: string;
  isAmendment?: boolean;
  isEmployeeApproved?: boolean;
  mgrApprovalLevel?: string;
  /** Plain string per WSDL (not WSDate) — real format unconfirmed, passed through untouched. */
  payPeriodEndDate?: string;
  payPeriodStartDate?: string;
  policyProfile?: string;
}

export type GetTimesheetStatusInfoResult = WsResultObjectBase<TimesheetStatusInfoWire>;

// --- E2G_OE_getTimeOffRequests ---

export interface WsDateRange {
  startDate?: WsDate;
  endDate?: WsDate;
}

export interface GetTimeOffRequestsInput {
  dateRange?: WsDateRange;
  employeeId?: string[];
  getDetails?: boolean;
  lastModifiedAfter?: WsDateTime;
  /** Free-text filter values — WSDL declares no enumeration. */
  status?: string[];
}

export interface TimeOffRequestDetailWire {
  detailRecordId?: string;
  endDateTime?: string;
  hours?: number;
  payCode?: string;
  startDateTime?: string;
  workDate?: string;
}

export interface TimeOffRequestWire {
  absenceType?: string;
  absenceTypeDesc?: string;
  assignmentId?: string;
  comments?: string;
  defaultPayCode?: string;
  details?: TimeOffRequestDetailWire[];
  employeeId?: string;
  endDate?: string;
  firstName?: string;
  hoursRequested?: number;
  lastName?: string;
  requestId?: string;
  requestMadeAt?: string;
  startDate?: string;
  status?: string;
  systemTimestamp?: string;
}

export type GetTimeOffRequestsResult = WsResultObjectBase<TimeOffRequestWire[]>;

// --- E2G_OE_getEmployeeSchedule ---

export interface GetEmployeeScheduleInput {
  dateRange?: WsDateRange;
  employeeId?: string;
  payCodeSet?: string;
  version?: string;
}

export interface EmployeeScheduleLineWire {
  detailRecordId?: string;
  employeePeriodVersion?: string;
  endDateTime?: string;
  hours?: number;
  isPublicHoliday?: boolean;
  payCode?: string;
  phDescription?: string;
  startDateTime?: string;
  workDate?: string;
}

export type GetEmployeeScheduleResult = WsResultObjectBase<EmployeeScheduleLineWire[]>;

// --- E2G_importTimeData ---

export interface TimeRecordWire {
  amount?: string;
  endDttm?: string;
  genericFields?: { generic_field: GenericFieldWire[] };
  hours?: string;
  payCode?: string;
  recordId?: string;
  startDttm?: string;
  workDate?: string;
}

export interface EmployeeTimeRecordWire {
  assignmentMatchId?: string;
  employeeMatchId?: string;
  timeRecords?: { timeRecord: TimeRecordWire[] };
}

export interface ImportTimeDataInput {
  data?: {
    employeeTimeRecords?: { employee: EmployeeTimeRecordWire[] };
    sourceSystem?: string;
  };
  properties?: { property: GenericFieldWire[] };
}

export interface ImportTimeDataResponseWire {
  jobId: WsGeneratedId;
  startDateTime?: string;
  successful?: boolean;
  timeRecordCount?: number;
}

export type ImportTimeDataResult = WsResultObjectBase<ImportTimeDataResponseWire>;

// --- E2G_getPeriods_by_EmpId ---

export interface GetPeriodsByEmpIdInput {
  employeeId?: string;
  numberOfPriorPeriods?: number;
  requestDate?: WsDate;
}

export interface FieldLabelWire {
  field?: string;
  label?: string;
}

export interface PayCodeWire {
  payCode?: string;
  payCodeType?: string;
}

export interface TimeSheetMetaDataWire {
  fieldLabels?: FieldLabelWire[];
  payCodes?: PayCodeWire[];
}

export interface AssignmentInfoWire {
  assignmentDescription?: string;
  assignmentId?: WsGeneratedId;
}

export interface TimeSheetIdWire {
  assignmentInfo?: AssignmentInfoWire;
  payPeriodBeginDate?: WsDate;
  payPeriodEndDate?: WsDate;
}

/**
 * Unlike every other operation's response fields (plain `xs:string`, see `TimesheetStatusInfoWire`
 * etc.), this WSDL declares `endDateTime`/`startDateTime`/`workDate` as structured `WSDateTime`/
 * `WSDate` — mapped to native CDS `DateTime`/`Date` via `WfsMapper.fromWsDate`/`fromWsDateTime`.
 */
export interface ScheduleDetailRowWire {
  amount?: number;
  comments?: string;
  endDateTime?: WsDateTime;
  hours?: number;
  ld?: string[];
  payCode?: string;
  startDateTime?: WsDateTime;
  unit?: number[];
  workDate?: WsDate;
}

export interface TimeSheetDetailRowWire {
  amount?: number;
  comments?: string;
  endDateTime?: WsDateTime;
  hours?: number;
  inSwipeLatitude?: number;
  inSwipeLongitude?: number;
  ld?: string[];
  outSwipeLatitude?: number;
  outSwipeLongitude?: number;
  payCode?: string;
  startDateTime?: WsDateTime;
  unit?: number[];
  workDate?: WsDate;
}

export interface ExceptionSeverityChoiceWire {
  /** Free-text — WSDL declares no enumeration values. */
  exception_severity?: string;
}

export interface WsPolicyIdWire {
  /** Free-text — WSDL declares no enumeration values. */
  policyId?: string;
}

export interface TimeSheetExceptionWire {
  code?: string;
  date?: WsDate;
  message?: string;
  severity?: ExceptionSeverityChoiceWire;
  temporaryExceptionKey?: WsGeneratedId;
  type?: WsPolicyIdWire;
}

export interface PeriodDataWire {
  managerApproval?: string;
  periodId?: TimeSheetIdWire;
  scheduleDetailRow?: ScheduleDetailRowWire[];
  submittedByEmployee?: boolean;
  timeSheetDetailRow?: TimeSheetDetailRowWire[];
  timeSheetException?: TimeSheetExceptionWire[];
}

export interface PeriodDataListByEmpIdWire {
  periodMetaData?: TimeSheetMetaDataWire;
  periods?: PeriodDataWire[];
}

export type GetPeriodsByEmpIdResult = WsResultObjectBase<PeriodDataListByEmpIdWire>;

export interface WfsSoapCredentials {
  endpointBase: string;
  username: string;
  password: string;
}
