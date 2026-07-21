using { timesheet.db as db } from '../db/schema';
 

service TimesheetService {
  entity Timesheets as projection on db.TIMESHEET;
}