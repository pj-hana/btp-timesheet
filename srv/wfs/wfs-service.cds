namespace com.origin.wfs;

//service WFSService  @(path: '/wfs-service', requires: 'authenticated-user')
service WFSService  @(path: '/wfs-service')


 {

  type GenericField {
    fieldName  : String;
    fieldValue : String;
  }

  // Note: startDateTime/endDateTime/workDate are plain xs:string in the WSDL (not WSDate/WSDateTime),
  // with no confirmed format anywhere in-repo — kept as String rather than guessing at Date/DateTime.
  type TimeOffDetail {
    detailRecordId : String;
    startDateTime  : String;
    endDateTime    : String;
    hours          : Double;
    payCode        : String;
    workDate       : String;
  }

  type TimeOffRequest {
    requestId       : String;
    employeeId      : String;
    assignmentId    : String;
    firstName       : String;
    lastName        : String;
    absenceType     : String;
    absenceTypeDesc : String;
    defaultPayCode  : String;
    comments        : String;
    // startDate/endDate/requestMadeAt/systemTimestamp are plain xs:string in the WSDL, unconfirmed format.
    startDate       : String;
    endDate         : String;
    hoursRequested  : Double;
    requestMadeAt   : String;
    systemTimestamp : String;
    status          : String;
    details         : many TimeOffDetail;
  }

  // startDateTime/endDateTime/workDate are plain xs:string in the WSDL, unconfirmed format.
  type EmployeeScheduleEntry {
    detailRecordId      : String;
    employeePeriodVersion : String;
    startDateTime       : String;
    endDateTime         : String;
    hours               : Double;
    isPublicHoliday     : Boolean;
    payCode             : String;
    phDescription       : String;
    workDate            : String;
  }

  // asOfDate/payPeriodStartDate/payPeriodEndDate are plain xs:string in the WSDL, unconfirmed format.
  type TimesheetStatusInfo {
    assignmentId       : String;
    asOfDate           : String;
    approvalLevel      : String;
    currentState        : String;
    isAmendment         : Boolean;
    isEmployeeApproved  : Boolean;
    mgrApprovalLevel    : String;
    payPeriodStartDate  : String;
    payPeriodEndDate    : String;
    policyProfile       : String;
  }

  // startTime/endTime are plain xs:string in the WSDL, unconfirmed format.
  type JobStatus {
    startTime      : String;
    endTime        : String;
    status         : String;
    completedTasks : Integer;
    totalTasks     : Integer;
    errorCount     : Integer;
    warningCount   : Integer;
    messages       : Integer;
    description    : String;
    log            : String;
  }

  // workDate/startDttm/endDttm are plain xs:string in the WSDL (even on this input side), unconfirmed format.
  type TimeRecordInput {
    recordId      : String;
    workDate      : String;
    startDttm     : String;
    endDttm       : String;
    payCode       : String;
    hours         : Double;
    amount        : Double;
    genericFields : many GenericField;
  }

  type EmployeeTimeInput {
    assignmentMatchId : String;
    employeeMatchId   : String;
    timeRecords       : many TimeRecordInput;
  }

  // startDateTime is plain xs:string in the WSDL, unconfirmed format.
  type ImportTimeDataResult {
    jobId           : Int64;
    startDateTime   : String;
    successful      : Boolean;
    timeRecordCount : Integer;
  }

  type FieldLabel {
    field : String;
    label : String;
  }

  type PayCode {
    payCode     : String;
    payCodeType : String;
  }

  type TimeSheetMetaData {
    fieldLabels : many FieldLabel;
    payCodes    : many PayCode;
  }

  type AssignmentInfo {
    assignmentDescription : String;
    assignmentId          : Int64;
  }

  type TimeSheetId {
    assignmentInfo     : AssignmentInfo;
    payPeriodBeginDate : Date;
    payPeriodEndDate   : Date;
  }

  // Note: unlike the other 7 operations, this WSDL declares endDateTime/startDateTime/workDate
  // as structured WSDateTime/WSDate (not xs:string) — mapped to native DateTime/Date accordingly.
  type ScheduleDetailRow {
    amount        : Double;
    comments      : String;
    endDateTime   : DateTime;
    hours         : Integer;
    ld            : many String;
    payCode       : String;
    startDateTime : DateTime;
    unit          : many Double;
    workDate      : Date;
  }

  type TimeSheetDetailRow {
    amount            : Double;
    comments          : String;
    endDateTime       : DateTime;
    hours             : Double;
    inSwipeLatitude   : Double;
    inSwipeLongitude  : Double;
    ld                : many String;
    outSwipeLatitude  : Double;
    outSwipeLongitude : Double;
    payCode           : String;
    startDateTime     : DateTime;
    unit              : many Double;
    workDate          : Date;
  }

  type TimeSheetException {
    code                  : String;
    date                  : Date;
    message               : String;
    // WSDL declares no enumeration values for exception_severity/type/policyId — free-text.
    severity              : String;
    temporaryExceptionKey : Int64;
    type                  : String;
  }

  type PeriodData {
    managerApproval    : String;
    periodId           : TimeSheetId;
    scheduleDetailRow  : many ScheduleDetailRow;
    submittedByEmployee : Boolean;
    timeSheetDetailRow : many TimeSheetDetailRow;
    timeSheetException : many TimeSheetException;
  }

  type PeriodDataListByEmpId {
    periodMetaData : TimeSheetMetaData;
    periods        : many PeriodData;
  }

  function getPolicySet(effectiveDate: Date, policySetName: String, policyType: String) returns array of String;

  function getJobStatus(jobId: Int64, includeLog: Boolean) returns JobStatus;

  function getTimesheetStatusInfo(employeeId: String, asOfDate: Date) returns TimesheetStatusInfo;

  function getTimeOffRequests(
    employeeId        : many String,
    startDate         : Date,
    endDate           : Date,
    lastModifiedAfter : DateTime,
    status            : many String,
    getDetails        : Boolean
  ) returns array of TimeOffRequest;

  function getEmployeeSchedule(
    employeeId  : String,
    startDate   : Date,
    endDate     : Date,
    payCodeSet  : String,
    version     : String
  ) returns array of EmployeeScheduleEntry;

  function getPeriodsByEmpId(
    employeeId            : String,
    numberOfPriorPeriods  : Integer,
    requestDate           : Date
  ) returns PeriodDataListByEmpId;

  action submitTimeSheet(
    assignmentMatchId : String,
    employeeMatchId   : String,
    periodEndDate     : String
  ) returns String;

  action importTimeData(
    sourceSystem : String,
    employees    : many EmployeeTimeInput,
    properties   : many GenericField
  ) returns ImportTimeDataResult;
}
