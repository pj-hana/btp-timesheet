/**
 * Manual Jest mock for `WfsSoapClient`. `mockFns` are module-scoped so tests can configure
 * return values directly, while `WfsService` (which does `new WfsSoapClient()` itself)
 * still resolves to these same shared jest.fn()s via the instance field assignments below.
 */
export const mockFns = {
  getPolicySet: jest.fn(),
  submitTimeSheet: jest.fn(),
  getJobStatus: jest.fn(),
  getTimesheetStatusInfo: jest.fn(),
  getTimeOffRequests: jest.fn(),
  getEmployeeSchedule: jest.fn(),
  importTimeData: jest.fn(),
  getPeriodsByEmpId: jest.fn(),
};

export class WfsSoapClient {
  getPolicySet = mockFns.getPolicySet;
  submitTimeSheet = mockFns.submitTimeSheet;
  getJobStatus = mockFns.getJobStatus;
  getTimesheetStatusInfo = mockFns.getTimesheetStatusInfo;
  getTimeOffRequests = mockFns.getTimeOffRequests;
  getEmployeeSchedule = mockFns.getEmployeeSchedule;
  importTimeData = mockFns.importTimeData;
  getPeriodsByEmpId = mockFns.getPeriodsByEmpId;
}
