using { timesheet.db as db } from '../db/schema';


service TimesheetService {
  entity Timesheets as projection on db.TIMESHEET;

  function getLoginUserInfo() returns {
        userId : String;
        name   : String;
        roles  : array of String;
    };
  
}