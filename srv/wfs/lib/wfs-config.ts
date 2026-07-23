import { WfsSoapCredentials } from './wfs-types';

/**
 * Single seam for resolving the WFS SOAP endpoint base URL + WS-Security credentials.
 * Local dev reads `.env` (loaded into `process.env` by CAP automatically); BTP deployment
 * will resolve the same shape from a bound Destination once one is provisioned — that
 * swap only ever touches this class, never `WfsSoapClient` or `wfs-service.ts`.
 *
 * Auth mechanism: WS-Security UsernameToken (PasswordDigest), per direct evidence in
 * `API Specs/WFS_API_SOAPUI.xml` (`wssPasswordType="PasswordDigest"`), not OAuth2 as the
 * SDD section 15.6 states — see the plan's open items; confirm with the WFS/SAP integration
 * team before go-live.
 */
export class WfsConfig {
  static getSoapCredentials(): WfsSoapCredentials {
    const endpointBase = process.env.WFS_SOAP_ENDPOINT_BASE;
    const username = process.env.WFS_SOAP_USER;
    const password = process.env.WFS_SOAP_PASSWORD;

    if (!endpointBase || !username || !password) {
      throw new Error(
        'Missing WFS SOAP credentials — set WFS_SOAP_ENDPOINT_BASE, WFS_SOAP_USER and WFS_SOAP_PASSWORD (see .env.example).'
      );
    }

    return { endpointBase, username, password };
  }
}
