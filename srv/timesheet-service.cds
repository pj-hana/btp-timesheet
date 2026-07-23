using { timesheet.db as db } from '../db/schema';


service TimesheetService @(requires:'ts_update') {


  entity Timesheets as projection on db.TIMESHEET;

  function getLoginUserInfo() returns {
        userId : String;
        name   : String;
        roles  : array of String;
    };

    function getTimesheet(
        period : Date
    ) returns Timesheets;
  
}