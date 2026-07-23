import { WfsMapper } from '../srv/wfs/lib/wfs-mapper';

describe('WfsMapper', () => {
  describe('date/time/id round-trips', () => {
    it('converts a CDS date string to a WSDate', () => {
      expect(WfsMapper.toWsDate('2026-02-14')).toEqual({ day: 14, month: 2, year: 2026 });
    });

    it('returns undefined for an empty date', () => {
      expect(WfsMapper.toWsDate(undefined)).toBeUndefined();
    });

    it('converts a CDS datetime string to a WSDateTime', () => {
      expect(WfsMapper.toWsDateTime('2026-02-14T09:30:15Z')).toEqual({
        day: 14,
        month: 2,
        year: 2026,
        hours: 9,
        minutes: 30,
        seconds: 15,
      });
    });

    it('builds a WSDateRange from start/end date strings', () => {
      expect(WfsMapper.toWsDateRange('2026-02-01', '2026-02-28')).toEqual({
        startDate: { day: 1, month: 2, year: 2026 },
        endDate: { day: 28, month: 2, year: 2026 },
      });
    });

    it('returns undefined range when both bounds are missing', () => {
      expect(WfsMapper.toWsDateRange(undefined, undefined)).toBeUndefined();
    });

    it('round-trips a WSGeneratedId to/from a plain number', () => {
      expect(WfsMapper.toWsGeneratedId(12345)).toEqual({ id: 12345 });
      expect(WfsMapper.fromWsGeneratedId({ id: 12345 })).toBe(12345);
    });

    it('converts a WSDate back to a CDS date string', () => {
      expect(WfsMapper.fromWsDate({ day: 14, month: 2, year: 2026 })).toBe('2026-02-14');
    });

    it('returns undefined when converting a missing WSDate', () => {
      expect(WfsMapper.fromWsDate(undefined)).toBeUndefined();
    });

    it('converts a WSDateTime back to a CDS datetime string', () => {
      expect(
        WfsMapper.fromWsDateTime({ day: 14, month: 2, year: 2026, hours: 9, minutes: 30, seconds: 15 })
      ).toBe('2026-02-14T09:30:15Z');
    });

    it('returns undefined when converting a missing WSDateTime', () => {
      expect(WfsMapper.fromWsDateTime(undefined)).toBeUndefined();
    });
  });

  describe('generic field wrapping', () => {
    it('wraps clean fields as the generic_field wire shape', () => {
      expect(WfsMapper.toGenericFieldsWire([{ fieldName: 'a', fieldValue: '1' }])).toEqual({
        generic_field: [{ fieldName: 'a', fieldValue: '1' }],
      });
    });

    it('returns undefined for an empty/missing field list', () => {
      expect(WfsMapper.toGenericFieldsWire(undefined)).toBeUndefined();
      expect(WfsMapper.toGenericFieldsWire([])).toBeUndefined();
    });

    it('wraps clean fields as the distinct property wire shape', () => {
      expect(WfsMapper.toPropertiesWire([{ fieldName: 'a', fieldValue: '1' }])).toEqual({
        property: [{ fieldName: 'a', fieldValue: '1' }],
      });
    });
  });

  describe('importTimeData request shaping', () => {
    it('wraps employees/time records into the nested WFS wire shape', () => {
      const wire = WfsMapper.toEmployeeTimeRecordsWire([
        {
          assignmentMatchId: 'AM1',
          employeeMatchId: 'EM1',
          timeRecords: [{ recordId: 'R1', workDate: '2026-02-01', hours: 8 }],
        },
      ]);
      expect(wire).toEqual({
        employee: [
          {
            assignmentMatchId: 'AM1',
            employeeMatchId: 'EM1',
            timeRecords: {
              timeRecord: [
                {
                  recordId: 'R1',
                  workDate: '2026-02-01',
                  startDttm: undefined,
                  endDttm: undefined,
                  payCode: undefined,
                  hours: '8',
                  amount: undefined,
                  genericFields: undefined,
                },
              ],
            },
          },
        ],
      });
    });
  });

  describe('response mapping', () => {
    it('unwraps a job status choice into a plain status string', () => {
      expect(
        WfsMapper.fromJobStatus({
          completedTasks: 5,
          totalTasks: 5,
          status: { batch_job_status: 'COMPLETED' },
        })
      ).toMatchObject({ completedTasks: 5, totalTasks: 5, status: 'COMPLETED' });
    });

    it('defaults time-off request details to an empty array when absent', () => {
      const [request] = WfsMapper.fromTimeOffRequests([{ requestId: 'R1' }]);
      expect(request.details).toEqual([]);
    });

    it('returns an empty array (not undefined) when no time-off requests are given', () => {
      expect(WfsMapper.fromTimeOffRequests(undefined)).toEqual([]);
    });

    it('maps employee schedule wire entries including workDate', () => {
      const [entry] = WfsMapper.fromEmployeeSchedule([{ detailRecordId: 'S1', workDate: '2026-02-01' }]);
      expect(entry.workDate).toBe('2026-02-01');
    });

    it('maps importTimeData result, converting jobId back to a plain number', () => {
      expect(WfsMapper.fromImportTimeDataResult({ jobId: { id: 999 }, successful: true, timeRecordCount: 1 })).toEqual({
        jobId: 999,
        startDateTime: undefined,
        successful: true,
        timeRecordCount: 1,
      });
    });

    it('maps getPeriodsByEmpId result, converting structured WSDate/WSDateTime response fields to strings', () => {
      const mapped = WfsMapper.fromPeriodsByEmpId({
        periodMetaData: {
          fieldLabels: [{ field: 'payCode', label: 'Pay Code' }],
          payCodes: [{ payCode: 'REG', payCodeType: 'WORKED' }],
        },
        periods: [
          {
            managerApproval: 'APPROVED',
            submittedByEmployee: true,
            periodId: {
              assignmentInfo: { assignmentDescription: 'Warehouse', assignmentId: { id: 555 } },
              payPeriodBeginDate: { day: 1, month: 2, year: 2026 },
              payPeriodEndDate: { day: 14, month: 2, year: 2026 },
            },
            scheduleDetailRow: [
              {
                hours: 8,
                payCode: 'REG',
                startDateTime: { day: 1, month: 2, year: 2026, hours: 9, minutes: 0, seconds: 0 },
                endDateTime: { day: 1, month: 2, year: 2026, hours: 17, minutes: 0, seconds: 0 },
                workDate: { day: 1, month: 2, year: 2026 },
              },
            ],
            timeSheetDetailRow: [],
            timeSheetException: [
              {
                code: 'MISSING_SWIPE',
                date: { day: 2, month: 2, year: 2026 },
                message: 'Missing out swipe',
                severity: { exception_severity: 'WARNING' },
                temporaryExceptionKey: { id: 999 },
                type: { policyId: 'SWIPE_POLICY' },
              },
            ],
          },
        ],
      });

      expect(mapped.periodMetaData).toEqual({
        fieldLabels: [{ field: 'payCode', label: 'Pay Code' }],
        payCodes: [{ payCode: 'REG', payCodeType: 'WORKED' }],
      });
      expect(mapped.periods[0].periodId).toEqual({
        assignmentInfo: { assignmentDescription: 'Warehouse', assignmentId: 555 },
        payPeriodBeginDate: '2026-02-01',
        payPeriodEndDate: '2026-02-14',
      });
      expect(mapped.periods[0].scheduleDetailRow[0]).toMatchObject({
        startDateTime: '2026-02-01T09:00:00Z',
        endDateTime: '2026-02-01T17:00:00Z',
        workDate: '2026-02-01',
      });
      expect(mapped.periods[0].timeSheetException[0]).toEqual({
        code: 'MISSING_SWIPE',
        date: '2026-02-02',
        message: 'Missing out swipe',
        severity: 'WARNING',
        temporaryExceptionKey: 999,
        type: 'SWIPE_POLICY',
      });
    });

    it('defaults getPeriodsByEmpId to an empty periods array and undefined metadata when absent', () => {
      expect(WfsMapper.fromPeriodsByEmpId(undefined)).toEqual({ periodMetaData: undefined, periods: [] });
    });
  });
});
