jest.mock('../srv/wfs/lib/wfs-soap-client');

import cds from '@sap/cds';
import fixtures from './fixtures/wfs-responses.json';

// Fetch the SAME cached mock module instance wfs-service.ts receives via jest.mock() above —
// importing '../srv/wfs/lib/__mocks__/wfs-soap-client' directly would load it as a *separate*
// module instantiation with its own distinct jest.fn()s, decoupled from the one actually in use.
const { mockFns } = jest.requireMock<typeof import('../srv/wfs/lib/__mocks__/wfs-soap-client')>(
  '../srv/wfs/lib/wfs-soap-client'
);

const { GET, POST } = cds.test(__dirname + '/..');
const auth = { auth: { username: 'bff-svc', password: '' } };

beforeEach(() => {
  Object.values(mockFns).forEach((fn) => fn.mockReset());
});

describe('WFSService', () => {
  it('getPolicySet: happy path returns the mapped string array', async () => {
    mockFns.getPolicySet.mockResolvedValue(fixtures.getPolicySet.success);

    const { data } = await GET(
      "/wfs-service/getPolicySet(effectiveDate=2026-01-01,policySetName='STANDARD',policyType='WEEKLY')",
      auth
    );

    expect(data.value).toEqual(['STANDARD', 'WEEKLY']);
    expect(mockFns.getPolicySet).toHaveBeenCalledWith(
      expect.objectContaining({
        effectiveDate: { day: 1, month: 1, year: 2026 },
        policySetName: 'STANDARD',
        policyType: 'WEEKLY',
      })
    );
  });

  it('getPolicySet: WFS failure maps to a 502 with the resultCode-prefixed error code', async () => {
    mockFns.getPolicySet.mockResolvedValue(fixtures.getPolicySet.failure);

    await expect(
      GET("/wfs-service/getPolicySet(effectiveDate=2026-01-01,policySetName='X',policyType='Y')", auth)
    ).rejects.toMatchObject({ status: 502, code: 'WFS_404', message: '502 - Policy set not found' });
  });

  it('getJobStatus: maps the batch_job_status choice to a plain status string', async () => {
    mockFns.getJobStatus.mockResolvedValue(fixtures.getJobStatus.success);

    const { data } = await GET('/wfs-service/getJobStatus(jobId=12345,includeLog=true)', auth);

    expect(data.status).toBe('COMPLETED');
    expect(data.completedTasks).toBe(5);
    expect(mockFns.getJobStatus).toHaveBeenCalledWith({ jobId: { id: 12345 }, includeLog: true });
  });

  it('getTimesheetStatusInfo: happy path passes through string-typed date fields untouched', async () => {
    mockFns.getTimesheetStatusInfo.mockResolvedValue(fixtures.getTimesheetStatusInfo.success);

    const { data } = await GET("/wfs-service/getTimesheetStatusInfo(employeeId='E1',asOfDate=2026-01-01)", auth);

    expect(data.payPeriodStartDate).toBe('2026-01-01');
    expect(data.payPeriodEndDate).toBe('2026-01-14');
    expect(data.isEmployeeApproved).toBe(true);
  });

  it('getTimesheetStatusInfo: WFS failure surfaces the resultDescription as the error message', async () => {
    mockFns.getTimesheetStatusInfo.mockResolvedValue(fixtures.getTimesheetStatusInfo.failure);

    await expect(GET("/wfs-service/getTimesheetStatusInfo(employeeId='E1',asOfDate=2026-01-01)", auth)).rejects.toMatchObject(
      { status: 502, code: 'WFS_403', message: '502 - Employee not found' }
    );
  });

  it('getPeriodsByEmpId: happy path maps structured WSDate/WSDateTime response fields to strings', async () => {
    mockFns.getPeriodsByEmpId.mockResolvedValue(fixtures.getPeriodsByEmpId.success);

    const { data } = await GET(
      "/wfs-service/getPeriodsByEmpId(employeeId='E1',numberOfPriorPeriods=3,requestDate=2026-01-01)",
      auth
    );

    expect(data.periodMetaData.payCodes).toEqual([{ payCode: 'REG', payCodeType: 'WORKED' }]);
    expect(data.periods[0].periodId).toMatchObject({
      payPeriodBeginDate: '2026-02-01',
      payPeriodEndDate: '2026-02-14',
    });
    expect(data.periods[0].scheduleDetailRow[0].startDateTime).toBe('2026-02-01T09:00:00Z');
    expect(mockFns.getPeriodsByEmpId).toHaveBeenCalledWith(
      expect.objectContaining({
        employeeId: 'E1',
        numberOfPriorPeriods: 3,
        requestDate: { day: 1, month: 1, year: 2026 },
      })
    );
  });

  it('getPeriodsByEmpId: WFS failure maps to a 502', async () => {
    mockFns.getPeriodsByEmpId.mockResolvedValue(fixtures.getPeriodsByEmpId.failure);

    await expect(
      GET("/wfs-service/getPeriodsByEmpId(employeeId='E1',numberOfPriorPeriods=3,requestDate=2026-01-01)", auth)
    ).rejects.toMatchObject({ status: 502, code: 'WFS_404', message: '502 - Employee not found' });
  });

  it('submitTimeSheet: posts assignment/employee/periodEndDate and unwraps the plain string result', async () => {
    mockFns.submitTimeSheet.mockResolvedValue(fixtures.submitTimeSheet.success);

    const { data } = await POST(
      '/wfs-service/submitTimeSheet',
      { assignmentMatchId: 'AM1', employeeMatchId: 'EM1', periodEndDate: '2026-01-14' },
      auth
    );

    expect(data.value).toBe('SUBMITTED-OK');
    expect(mockFns.submitTimeSheet).toHaveBeenCalledWith({
      assignmentMatchId: 'AM1',
      employeeMatchId: 'EM1',
      periodEndDate: '2026-01-14',
    });
  });

  it('submitTimeSheet: WFS failure maps to a 502', async () => {
    mockFns.submitTimeSheet.mockResolvedValue(fixtures.submitTimeSheet.failure);

    await expect(
      POST('/wfs-service/submitTimeSheet', { assignmentMatchId: 'AM1', employeeMatchId: 'EM1', periodEndDate: '2026-01-14' }, auth)
    ).rejects.toMatchObject({ status: 502, code: 'WFS_500' });
  });

  it('importTimeData: wraps clean employees/properties into the WFS nested wire shape and unwraps the jobId', async () => {
    mockFns.importTimeData.mockResolvedValue(fixtures.importTimeData.success);

    const { data } = await POST(
      '/wfs-service/importTimeData',
      {
        sourceSystem: 'BFF',
        employees: [
          {
            assignmentMatchId: 'AM1',
            employeeMatchId: 'EM1',
            timeRecords: [{ recordId: 'R1', workDate: '2026-02-01', hours: 8 }],
          },
        ],
        properties: [],
      },
      auth
    );

    expect(data.jobId).toBe(12345);
    expect(data.successful).toBe(true);
    expect(mockFns.importTimeData).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          sourceSystem: 'BFF',
          employeeTimeRecords: {
            employee: [
              expect.objectContaining({
                assignmentMatchId: 'AM1',
                employeeMatchId: 'EM1',
                timeRecords: { timeRecord: [expect.objectContaining({ recordId: 'R1', hours: '8' })] },
              }),
            ],
          },
        }),
        properties: undefined,
      })
    );
  });

  it('rejects unauthenticated requests', async () => {
    await expect(GET("/wfs-service/getPolicySet(effectiveDate=2026-01-01,policySetName='X',policyType='Y')")).rejects.toMatchObject(
      { status: 401 }
    );
  });
});
