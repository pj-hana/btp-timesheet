import cds from '@sap/cds';
import { WsResultObjectBase } from './wfs-types';

/**
 * Every WFS SOAP operation wraps its response in `WSResultObjectBase` — none of the 7
 * WSDLs declare a `wsdl:fault`, so `operationSuccessful=false` is the only error signal.
 * This is the single place that inspects it; handlers in `wfs-service.ts` always route
 * through `unwrap()` rather than checking `operationSuccessful` themselves.
 *
 * Uses `req.reject()`, not `req.error()` — `req.error()` only queues the error and returns
 * normally (see `@sap/cds/lib/req/request.js`), so a handler that does further mapping on
 * the returned payload (e.g. `WfsMapper.fromJobStatus`) would crash on a null/absent
 * `result` with a generic 500, masking the intended 502. `req.reject()` throws immediately,
 * so callers never see a payload from a failed call.
 *
 * No `resultCode` -> meaning table exists anywhere in-repo, so failures map to a generic
 * 502 (Bad Gateway) until WFS/SAP functional teams confirm one (see plan open items).
 */
export class WfsErrorMapper {
  static unwrap<T>(result: WsResultObjectBase<T> | undefined, req: cds.Request): T {
    if (!result) {
      return req.reject(502, 'Empty response from WFS');
    }

    const { operationSuccessful, resultCode, resultDescription, detailedErrorMessage, result: payload } = result;

    if (operationSuccessful === false) {
      return req.reject({
        code: `WFS_${resultCode ?? 'UNKNOWN'}`,
        message: detailedErrorMessage || resultDescription || 'WFS operation failed',
        status: 502,
      });
    }

    return payload;
  }
}

