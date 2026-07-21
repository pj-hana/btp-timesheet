namespace timesheet.db;

using {
  cuid,
  managed
} from '@sap/cds/common';

type ConfirmationStatus : String enum {  
    Draft     = 'Draft';   
    Confirmed = 'Confirmed'; 
} 
type WfsSubmissionStatus : String enum {
    Pending    = 'Pending';   
    Submitted  = 'Submitted';   
    InProgress = 'InProgress';   
    Completed  = 'Completed';   
    Failed     = 'Failed'; 
} 
type RecordType : String enum {
    WFS      = 'WFS';   
    SAP_CATS = 'SAP_CATS'; 
}

entity TIMESHEET : cuid, managed {
  employeeId          : String;
  startDate           : Date;
  endDate             : Date;
  confirmationStatus  : ConfirmationStatus;
  wfsSubmissionStatus : WfsSubmissionStatus;
  sapSubmissionStatus : String;
  entries : Composition of many TIMESHEET_ENTRY
              on entries.timesheet = $self;
}


entity TIMESHEET_ENTRY : cuid, managed {
  timesheet : Association to TIMESHEET not null;
  recordType : RecordType;
  entryDate  : Date;
  hours      : Double;
  payCode    : String;
  startTime  : Timestamp;
  endTime    : Timestamp;
  wbsElementId : String;
  networkId       : String;
  activityTypeId  : String;
  internalOrderId : String;
  senderCostCenterId   : String;
  receiverCostCenterId : String;
  controllingArea : String;
  companyCode     : String;
  sapTimeSheetRecordId : String;
  sapLineStatus         : String;
  sapRejectionReason    : String;
  sapAccountingDocument : String;
}