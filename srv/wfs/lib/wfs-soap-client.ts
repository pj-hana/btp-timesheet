import path from "node:path";
import * as soap from "soap";
import { WfsConfig } from "./wfs-config";
import {
  GetPolicySetInput,
  GetPolicySetResult,
  SubmitTimeSheetInput,
  SubmitTimeSheetResult,
  GetJobStatusInput,
  GetJobStatusResult,
  GetTimesheetStatusInfoInput,
  GetTimesheetStatusInfoResult,
  GetTimeOffRequestsInput,
  GetTimeOffRequestsResult,
  GetEmployeeScheduleInput,
  GetEmployeeScheduleResult,
  ImportTimeDataInput,
  ImportTimeDataResult,
  GetPeriodsByEmpIdInput,
  GetPeriodsByEmpIdResult,
} from "./wfs-types";

const WSDL_DIR = path.join(__dirname, "../wsdl");

interface OperationConfig {
  wsdlFile: string;
  operation: string;
}

const OPERATIONS: Record<string, OperationConfig> = {
  getPolicySet: {
    wsdlFile: "E2G_OE_getPolicySet.wsdl",
    operation: "E2G_OE_getPolicySet",
  },
  submitTimeSheet: {
    wsdlFile: "E2G_submitTimeSheet.wsdl",
    operation: "E2G_submitTimeSheet",
  },
  getJobStatus: {
    wsdlFile: "E2G_getJobStatus.wsdl",
    operation: "E2G_getJobStatus",
  },
  getTimesheetStatusInfo: {
    wsdlFile: "E2G_OE_getTimesheetStatusInfo.wsdl",
    operation: "E2G_OE_getTimesheetStatusInfo",
  },
  getTimeOffRequests: {
    wsdlFile: "E2G_OE_getTimeOffRequests.wsdl",
    operation: "E2G_OE_getTimeOffRequests",
  },
  getEmployeeSchedule: {
    wsdlFile: "E2G_OE_getEmployeeSchedule.wsdl",
    operation: "E2G_OE_getEmployeeSchedule",
  },
  importTimeData: {
    wsdlFile: "E2G_importTimeData.wsdl",
    operation: "E2G_importTimeData",
  },
  getPeriodsByEmpId: {
    wsdlFile: "E2G_getPeriods_by_EmpId.wsdl",
    operation: "E2G_getPeriods_by_EmpId",
  },
};

/**
 * Thin protocol adapter over the 8 WFS SOAP operations. One public method per operation;
 * each returns the raw `WsResultObjectBase<T>`-shaped result untouched — error unwrapping
 * (`operationSuccessful=false`) happens one layer up, in `WfsErrorMapper`, never here.
 *
 * WSDLs are loaded from local static copies under `wsdl/` (decouples startup from live WFS
 * availability); the runtime endpoint + WS-Security credentials are resolved per call via
 * `WfsConfig` and applied to a cached `soap.Client` per operation.
 */
export class WfsSoapClient {
  private clients = new Map<string, soap.Client>();

  private async getClient(key: keyof typeof OPERATIONS): Promise<soap.Client> {
    const cached = this.clients.get(key);
    if (cached) return cached;

    const { wsdlFile } = OPERATIONS[key];
    // forceSoap12Headers: every WFS WSDL exposes SOAP 1.1, SOAP 1.2 and plain-HTTP bindings;
    // we standardize on SOAP 1.2 (env="http://www.w3.org/2003/05/soap-envelope").
    const client = await soap.createClientAsync(path.join(WSDL_DIR, wsdlFile), {
      forceSoap12Headers: true,
      forceUseSchemaXmlns: true
    });
  

    const { endpointBase, username, password } = WfsConfig.getSoapCredentials();
    const { operation } = OPERATIONS[key];
    // Endpoint path pattern confirmed against every WSDL's soap:address for the SOAP 1.2
    // binding: <base>/<Operation>.<Operation>HttpsSoap12Endpoint/
    const endpointUrl = `${endpointBase.replace(/\/$/, "")}/${operation}.${operation}HttpsSoap12Endpoint/`;
    client.setEndpoint(endpointUrl);

    client.setSecurity(
      new soap.WSSecurity(username, password, {
        passwordType: "PasswordDigest",
        hasTimeStamp: false,
        mustUnderstand: true,
      }),
    );

    this.clients.set(key, client);
    return client;
  }

  private async call<TInput, TResult>(
    key: keyof typeof OPERATIONS,
    argsKey: string,
    input: TInput,
  ): Promise<TResult> {
    const client = await this.getClient(key);

    const method = `${OPERATIONS[key].operation}Async` as keyof soap.Client;
    
    const fn = client[method] as unknown as (
      args: Record<string, TInput>,
    ) => Promise<[{return:TResult}, ...unknown[]]>;
    const [result] = await fn.call(client, { [argsKey]: input });
    return result?.return;
  }

  getPolicySet(input: GetPolicySetInput): Promise<GetPolicySetResult> {
    return this.call<GetPolicySetInput, GetPolicySetResult>("getPolicySet", "request", input);
  }

  submitTimeSheet(input: SubmitTimeSheetInput): Promise<SubmitTimeSheetResult> {
    return this.call<SubmitTimeSheetInput, SubmitTimeSheetResult>("submitTimeSheet", "payload", input);
  }

  getJobStatus(input: GetJobStatusInput): Promise<GetJobStatusResult> {
    return this.call<GetJobStatusInput, GetJobStatusResult>("getJobStatus", "payload", input);
  }

  getTimesheetStatusInfo(
    input: GetTimesheetStatusInfoInput,
  ): Promise<GetTimesheetStatusInfoResult> {
    return this.call<GetTimesheetStatusInfoInput, GetTimesheetStatusInfoResult>("getTimesheetStatusInfo", "request", input);
  }

  getTimeOffRequests(
    input: GetTimeOffRequestsInput,
  ): Promise<GetTimeOffRequestsResult> {
    return this.call<GetTimeOffRequestsInput, GetTimeOffRequestsResult>("getTimeOffRequests", "request", input);
  }

  getEmployeeSchedule(
    input: GetEmployeeScheduleInput,
  ): Promise<GetEmployeeScheduleResult> {
    return this.call<GetEmployeeScheduleInput, GetEmployeeScheduleResult>("getEmployeeSchedule", "request", input);
  }

  importTimeData(input: ImportTimeDataInput): Promise<ImportTimeDataResult> {
    return this.call<ImportTimeDataInput, ImportTimeDataResult>("importTimeData", "payload", input);
  }

  getPeriodsByEmpId(input: GetPeriodsByEmpIdInput): Promise<GetPeriodsByEmpIdResult> {
    return this.call<GetPeriodsByEmpIdInput, GetPeriodsByEmpIdResult>("getPeriodsByEmpId", "request", input);
  }
}
