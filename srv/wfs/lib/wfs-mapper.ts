import {
  WsDate,
  WsDateRange,
  WsDateTime,
  WsGeneratedId,
  GenericFieldWire,
  JobStatusResponseWire,
  TimesheetStatusInfoWire,
  TimeOffRequestWire,
  EmployeeScheduleLineWire,
  ImportTimeDataResponseWire,
  EmployeeTimeRecordWire,
  TimeRecordWire,
  PeriodDataListByEmpIdWire,
  TimeSheetMetaDataWire,
  PeriodDataWire,
  TimeSheetIdWire,
  ScheduleDetailRowWire,
  TimeSheetDetailRowWire,
  TimeSheetExceptionWire,
} from './wfs-types';

/** Clean, CDS-facing shapes the mapper builds outbound SOAP payloads from. */
export interface CleanGenericField {
  fieldName?: string;
  fieldValue?: string;
}

export interface CleanTimeRecordInput {
  recordId?: string;
  workDate?: string;
  startDttm?: string;
  endDttm?: string;
  payCode?: string;
  hours?: number;
  amount?: number;
  genericFields?: CleanGenericField[];
}

export interface CleanEmployeeTimeInput {
  assignmentMatchId?: string;
  employeeMatchId?: string;
  timeRecords?: CleanTimeRecordInput[];
}

/**
 * Converts between WFS SOAP wire shapes (`wfs-types.ts`) and clean, CDS-native scalars.
 * `WSDate`/`WSDateTime`/`WSGeneratedId` are Axis2 serialization artifacts, not business
 * concepts, so they never cross into `wfs-service.cds` or `wfs-service.ts` — this class is
 * the only place that constructs or reads them.
 *
 * Note: WFS only uses structured `WSDate`/`WSDateTime` on request/input fields. Every
 * response field that carries a date/time is declared `xs:string` in the WSDLs with no
 * confirmed format anywhere in-repo, so those are passed through untouched (see the
 * corresponding `// plain xs:string` comments in `wfs-service.cds`) rather than parsed.
 */
export class WfsMapper {
  static toWsDate(date?: string): WsDate | undefined {
    if (!date) return undefined;
    const [year, month, day] = date.split('-').map(Number);
    return { day, month, year };
  }

  static toWsDateTime(dateTime?: string): WsDateTime | undefined {
    if (!dateTime) return undefined;
    const parsed = new Date(dateTime);
    if (Number.isNaN(parsed.getTime())) return undefined;
    return {
      day: parsed.getUTCDate(),
      month: parsed.getUTCMonth() + 1,
      year: parsed.getUTCFullYear(),
      hours: parsed.getUTCHours(),
      minutes: parsed.getUTCMinutes(),
      seconds: parsed.getUTCSeconds(),
    };
  }

  /**
   * Inverse of `toWsDate`. Only needed for `getPeriodsByEmpId` — every other operation's
   * response date/time fields are plain `xs:string` (see class doc), so this had no caller
   * until that operation's WSDL turned out to declare structured response dates instead.
   */
  static fromWsDate(wsDate?: WsDate): string | undefined {
    if (!wsDate || wsDate.year === undefined || wsDate.year === null) return undefined;
    const month = String(wsDate.month).padStart(2, '0');
    const day = String(wsDate.day).padStart(2, '0');
    return `${wsDate.year}-${month}-${day}`;
  }

  static fromWsDateTime(wsDateTime?: WsDateTime): string | undefined {
    const date = WfsMapper.fromWsDate(wsDateTime);
    if (!date) return undefined;
    const hours = String(wsDateTime?.hours ?? 0).padStart(2, '0');
    const minutes = String(wsDateTime?.minutes ?? 0).padStart(2, '0');
    const seconds = String(wsDateTime?.seconds ?? 0).padStart(2, '0');
    return `${date}T${hours}:${minutes}:${seconds}Z`;
  }

  static toWsDateRange(startDate?: string, endDate?: string): WsDateRange | undefined {
    if (!startDate && !endDate) return undefined;
    return { startDate: WfsMapper.toWsDate(startDate), endDate: WfsMapper.toWsDate(endDate) };
  }

  static toWsGeneratedId(id?: number): WsGeneratedId | undefined {
    if (id === undefined || id === null) return undefined;
    return { id };
  }

  static fromWsGeneratedId(wsId?: WsGeneratedId): number | undefined {
    return wsId?.id;
  }

  /** Wraps a clean field array as the `E2g_generic_fields` wire shape (nested inside a time record). */
  static toGenericFieldsWire(fields?: CleanGenericField[]): { generic_field: GenericFieldWire[] } | undefined {
    if (!fields || fields.length === 0) return undefined;
    return { generic_field: fields.map((f) => ({ fieldName: f.fieldName, fieldValue: f.fieldValue })) };
  }

  static fromGenericFieldsWire(wire?: { generic_field: GenericFieldWire[] }): CleanGenericField[] {
    return wire?.generic_field ?? [];
  }

  /** Wraps a clean field array as the `E2g_import_time_data_properties` wire shape (job-level, distinct key from `toGenericFieldsWire`). */
  static toPropertiesWire(fields?: CleanGenericField[]): { property: GenericFieldWire[] } | undefined {
    if (!fields || fields.length === 0) return undefined;
    return { property: fields.map((f) => ({ fieldName: f.fieldName, fieldValue: f.fieldValue })) };
  }

  static toTimeRecordWire(record: CleanTimeRecordInput): TimeRecordWire {
    return {
      recordId: record.recordId,
      workDate: record.workDate,
      startDttm: record.startDttm,
      endDttm: record.endDttm,
      payCode: record.payCode,
      hours: record.hours !== undefined ? String(record.hours) : undefined,
      amount: record.amount !== undefined ? String(record.amount) : undefined,
      genericFields: WfsMapper.toGenericFieldsWire(record.genericFields),
    };
  }

  static toEmployeeTimeRecordWire(employee: CleanEmployeeTimeInput): EmployeeTimeRecordWire {
    return {
      assignmentMatchId: employee.assignmentMatchId,
      employeeMatchId: employee.employeeMatchId,
      timeRecords: employee.timeRecords
        ? { timeRecord: employee.timeRecords.map((r) => WfsMapper.toTimeRecordWire(r)) }
        : undefined,
    };
  }

  static toEmployeeTimeRecordsWire(employees?: CleanEmployeeTimeInput[]): { employee: EmployeeTimeRecordWire[] } | undefined {
    if (!employees || employees.length === 0) return undefined;
    return { employee: employees.map((e) => WfsMapper.toEmployeeTimeRecordWire(e)) };
  }

  static fromJobStatus(wire: JobStatusResponseWire) {
    return {
      startTime: wire.startTime,
      endTime: wire.endTime,
      status: wire.status?.batch_job_status,
      completedTasks: wire.completedTasks,
      totalTasks: wire.totalTasks,
      errorCount: wire.errorCount,
      warningCount: wire.warningCount,
      messages: wire.messages,
      description: wire.description,
      log: wire.log,
    };
  }

  static fromTimesheetStatusInfo(wire: TimesheetStatusInfoWire) {
    return {
      assignmentId: wire?.assignmentId,
      asOfDate: wire?.asOfDate,
      approvalLevel: wire?.approvalLevel,
      currentState: wire?.currentState,
      isAmendment: wire?.isAmendment,
      isEmployeeApproved: wire?.isEmployeeApproved,
      mgrApprovalLevel: wire?.mgrApprovalLevel,
      payPeriodStartDate: wire?.payPeriodStartDate,
      payPeriodEndDate: wire?.payPeriodEndDate,
      policyProfile: wire?.policyProfile,
    };
  }

  static fromTimeOffRequests(wire?: TimeOffRequestWire[]) {
    return (wire ?? []).map((r) => ({
      requestId: r.requestId,
      employeeId: r.employeeId,
      assignmentId: r.assignmentId,
      firstName: r.firstName,
      lastName: r.lastName,
      absenceType: r.absenceType,
      absenceTypeDesc: r.absenceTypeDesc,
      defaultPayCode: r.defaultPayCode,
      comments: r.comments,
      startDate: r.startDate,
      endDate: r.endDate,
      hoursRequested: r.hoursRequested,
      requestMadeAt: r.requestMadeAt,
      systemTimestamp: r.systemTimestamp,
      status: r.status,
      details: (r.details ?? []).map((d) => ({
        detailRecordId: d.detailRecordId,
        startDateTime: d.startDateTime,
        endDateTime: d.endDateTime,
        hours: d.hours,
        payCode: d.payCode,
        workDate: d.workDate,
      })),
    }));
  }

  static fromEmployeeSchedule(wire?: EmployeeScheduleLineWire[]) {
    return (wire ?? []).map((e) => ({
      detailRecordId: e.detailRecordId,
      employeePeriodVersion: e.employeePeriodVersion,
      startDateTime: e.startDateTime,
      endDateTime: e.endDateTime,
      hours: e.hours,
      isPublicHoliday: e.isPublicHoliday,
      payCode: e.payCode,
      phDescription: e.phDescription,
      workDate: e.workDate,
    }));
  }

  static fromImportTimeDataResult(wire: ImportTimeDataResponseWire) {
    return {
      jobId: WfsMapper.fromWsGeneratedId(wire.jobId),
      startDateTime: wire.startDateTime,
      successful: wire.successful,
      timeRecordCount: wire.timeRecordCount,
    };
  }

  static fromPeriodsByEmpId(wire?: PeriodDataListByEmpIdWire) {
    return {
      periodMetaData: wire?.periodMetaData
        ? WfsMapper.fromTimeSheetMetaData(wire.periodMetaData)
        : undefined,
      periods: (wire?.periods ?? []).map((p) => WfsMapper.fromPeriodData(p)),
    };
  }

  private static fromTimeSheetMetaData(wire: TimeSheetMetaDataWire) {
    return {
      fieldLabels: (wire.fieldLabels ?? []).map((f) => ({ field: f.field, label: f.label })),
      payCodes: (wire.payCodes ?? []).map((p) => ({ payCode: p.payCode, payCodeType: p.payCodeType })),
    };
  }

  private static fromPeriodData(wire: PeriodDataWire) {
    return {
      managerApproval: wire.managerApproval,
      periodId: wire.periodId ? WfsMapper.fromTimeSheetId(wire.periodId) : undefined,
      scheduleDetailRow: (wire.scheduleDetailRow ?? []).map((r) => WfsMapper.fromScheduleDetailRow(r)),
      submittedByEmployee: wire.submittedByEmployee,
      timeSheetDetailRow: (wire.timeSheetDetailRow ?? []).map((r) => WfsMapper.fromTimeSheetDetailRow(r)),
      timeSheetException: (wire.timeSheetException ?? []).map((e) => WfsMapper.fromTimeSheetException(e)),
    };
  }

  private static fromTimeSheetId(wire: TimeSheetIdWire) {
    return {
      assignmentInfo: wire.assignmentInfo
        ? {
            assignmentDescription: wire.assignmentInfo.assignmentDescription,
            assignmentId: WfsMapper.fromWsGeneratedId(wire.assignmentInfo.assignmentId),
          }
        : undefined,
      payPeriodBeginDate: WfsMapper.fromWsDate(wire.payPeriodBeginDate),
      payPeriodEndDate: WfsMapper.fromWsDate(wire.payPeriodEndDate),
    };
  }

  private static fromScheduleDetailRow(wire: ScheduleDetailRowWire) {
    return {
      amount: wire.amount,
      comments: wire.comments,
      endDateTime: WfsMapper.fromWsDateTime(wire.endDateTime),
      hours: wire.hours,
      ld: wire.ld ?? [],
      payCode: wire.payCode,
      startDateTime: WfsMapper.fromWsDateTime(wire.startDateTime),
      unit: wire.unit ?? [],
      workDate: WfsMapper.fromWsDate(wire.workDate),
    };
  }

  private static fromTimeSheetDetailRow(wire: TimeSheetDetailRowWire) {
    return {
      amount: wire.amount,
      comments: wire.comments,
      endDateTime: WfsMapper.fromWsDateTime(wire.endDateTime),
      hours: wire.hours,
      inSwipeLatitude: wire.inSwipeLatitude,
      inSwipeLongitude: wire.inSwipeLongitude,
      ld: wire.ld ?? [],
      outSwipeLatitude: wire.outSwipeLatitude,
      outSwipeLongitude: wire.outSwipeLongitude,
      payCode: wire.payCode,
      startDateTime: WfsMapper.fromWsDateTime(wire.startDateTime),
      unit: wire.unit ?? [],
      workDate: WfsMapper.fromWsDate(wire.workDate),
    };
  }

  private static fromTimeSheetException(wire: TimeSheetExceptionWire) {
    return {
      code: wire.code,
      date: WfsMapper.fromWsDate(wire.date),
      message: wire.message,
      severity: wire.severity?.exception_severity,
      temporaryExceptionKey: WfsMapper.fromWsGeneratedId(wire.temporaryExceptionKey),
      type: wire.type?.policyId,
    };
  }
}
