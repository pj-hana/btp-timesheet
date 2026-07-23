namespace com.origin.timesheet;
using { timesheet.db as db } from '../db/schema';


service TimesheetService @(requires:'ts_update') {


    type LoginUserInfo {
        userId: String;
        givenName: String;
        familyName:String;
        persona: String enum {
                WFS_CATS;
                CATS;
            };
    }

  entity Timesheets as projection on db.TIMESHEET;

  function getLoginUserInfo() returns LoginUserInfo;

    function getTimesheet(
        period : Date
    ) returns Timesheets;
  
}