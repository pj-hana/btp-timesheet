import cds from "@sap/cds";
import { WfsSoapClient } from "./lib/wfs-soap-client";
import { WfsErrorMapper } from "./lib/wfs-error";
import { WfsMapper } from "./lib/wfs-mapper";
import {
  getPolicySet,
  getJobStatus,
  getTimesheetStatusInfo,
  getTimeOffRequests,
  getEmployeeSchedule,
  getPeriodsByEmpId,
  submitTimeSheet,
  importTimeData,
  JobStatus,
  TimesheetStatusInfo,
  TimeOffRequest,
  EmployeeScheduleEntry,
  ImportTimeDataResult,
  PeriodDataListByEmpId,
} from "#cds-models/com/origin/wfs/WFSService";
const LOG = cds.log("wfs-service");

/**
 * Wraps Origin's 8 WFS SOAP operations as a clean CAP OData v4 service. This is a thin
 * protocol-translation layer only — no batch/poll orchestration lives here (see
 * `Diagrams/Timesheet_API_05_Submit_To_WFS.mmd`; that belongs to the future BFF), and
 * nothing is persisted (system of engagement, not record).
 */
export class WfsService extends cds.ApplicationService {
  private soapClient = new WfsSoapClient();

  async init() {
    this.on(getPolicySet, this.onGetPolicySet.bind(this));
    this.on(getJobStatus, this.onGetJobStatus.bind(this));
    this.on(getTimesheetStatusInfo, this.onGetTimesheetStatusInfo.bind(this));
    this.on(getTimeOffRequests, this.onGetTimeOffRequests.bind(this));
    this.on(getEmployeeSchedule, this.onGetEmployeeSchedule.bind(this));
    this.on(getPeriodsByEmpId, this.onGetPeriodsByEmpId.bind(this));
    this.on(submitTimeSheet, this.onSubmitTimeSheet.bind(this));
    this.on(importTimeData, this.onImportTimeData.bind(this));

    return super.init();
  }

  private async onGetPolicySet(req: cds.Request): Promise<string[]> {
    const { effectiveDate, policySetName, policyType } = req.data;
    LOG.debug("getPolicySet", { policySetName, policyType });
    const result = await this.soapClient.getPolicySet({
      effectiveDate: WfsMapper.toWsDate(effectiveDate),
      policySetName,
      policyType,
    });
    return WfsErrorMapper.unwrap(result, req);
  }

  private async onGetJobStatus(req: cds.Request): Promise<JobStatus> {
    const { jobId, includeLog } = req.data;
    LOG.debug("getJobStatus", { jobId });
    const result = await this.soapClient.getJobStatus({
      jobId: WfsMapper.toWsGeneratedId(jobId),
      includeLog,
    });
    return WfsMapper.fromJobStatus(WfsErrorMapper.unwrap(result, req));
  }

  private async onGetTimesheetStatusInfo(req: cds.Request): Promise<TimesheetStatusInfo> {
    const { employeeId, asOfDate } = req.data;
    LOG.debug("getTimesheetStatusInfo", { employeeId });
    const result = await this.soapClient.getTimesheetStatusInfo({
      employeeId,
      asOfDate: WfsMapper.toWsDate(asOfDate),
    });
    return WfsMapper.fromTimesheetStatusInfo(WfsErrorMapper.unwrap(result, req));
  }

  private async onGetTimeOffRequests(req: cds.Request): Promise<TimeOffRequest[]> {
    const {
      employeeId,
      startDate,
      endDate,
      lastModifiedAfter,
      status,
      getDetails,
    } = req.data;
    LOG.debug("getTimeOffRequests", { employeeId });
    const result = await this.soapClient.getTimeOffRequests({
      employeeId,
      dateRange: WfsMapper.toWsDateRange(startDate, endDate),
      lastModifiedAfter: WfsMapper.toWsDateTime(lastModifiedAfter),
      status,
      getDetails,
    });
    return WfsMapper.fromTimeOffRequests(WfsErrorMapper.unwrap(result, req));
  }

  private async onGetEmployeeSchedule(req: cds.Request): Promise<EmployeeScheduleEntry[]> {
    const { employeeId, startDate, endDate, payCodeSet, version } = req.data;
    LOG.debug("getEmployeeSchedule", { employeeId });

    const result = await this.soapClient.getEmployeeSchedule({
      employeeId,
      dateRange: WfsMapper.toWsDateRange(startDate, endDate),
      payCodeSet,
      version,
    });

    return WfsMapper.fromEmployeeSchedule(WfsErrorMapper.unwrap(result, req));
  }

  private async onGetPeriodsByEmpId(req: cds.Request): Promise<PeriodDataListByEmpId> {
    const { employeeId, numberOfPriorPeriods, requestDate } = req.data;
    LOG.debug("getPeriodsByEmpId", { employeeId, numberOfPriorPeriods });
    const result = await this.soapClient.getPeriodsByEmpId({
      employeeId,
      numberOfPriorPeriods,
      requestDate: WfsMapper.toWsDate(requestDate),
    });
    // WfsMapper stays CDS-agnostic and returns dates as plain ISO strings; cds-typer's
    // CdsDate/CdsDateTime are branded template-literal types it can't verify structurally
    // at compile time, even though the mapper guarantees the correct ISO format.
    return WfsMapper.fromPeriodsByEmpId(
      WfsErrorMapper.unwrap(result, req),
    ) as unknown as PeriodDataListByEmpId;
  }

  private async onSubmitTimeSheet(req: cds.Request): Promise<string | undefined> {
    const { assignmentMatchId, employeeMatchId, periodEndDate } = req.data;
    LOG.debug("submitTimeSheet", {
      assignmentMatchId,
      employeeMatchId,
      periodEndDate,
    });
    const result = await this.soapClient.submitTimeSheet({
      assignmentMatchId,
      employeeMatchId,
      periodEndDate,
    });
    return WfsErrorMapper.unwrap(result, req);
  }

  private async onImportTimeData(req: cds.Request): Promise<ImportTimeDataResult> {
    const { sourceSystem, employees, properties } = req.data;
    LOG.debug("importTimeData", {
      sourceSystem,
      employeeCount: employees?.length ?? 0,
    });
    const result = await this.soapClient.importTimeData({
      data: {
        sourceSystem,
        employeeTimeRecords: WfsMapper.toEmployeeTimeRecordsWire(employees),
      },
      properties: WfsMapper.toPropertiesWire(properties),
    });
    return WfsMapper.fromImportTimeDataResult(
      WfsErrorMapper.unwrap(result, req),
    );
  }
}

export default WfsService;
