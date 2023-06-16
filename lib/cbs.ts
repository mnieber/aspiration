import { symbols } from '../internal/symbols';
import { getAdmin } from '../internal/utils';
import { host } from './host';

// This function sets all callbacks for all functions in `host`.
export function setCallbackMap(host: any, callbackMap: any) {
  const admin = getAdmin(host);
  admin.callbackMap = callbackMap;
  admin.defaultCallbackMap = admin.defaultCallbackMap ?? {};
}

// This function gets the callbacks for the currently executing function in `host`.
export function getCallbacks<T = unknown>(host) {
  return host[symbols.cbs] as unknown as T;
}

export class Cbs {
  enter() {}
  exit() {}
}

export const stub = undefined as any;

export const withCbs = (createDefaultCbs?: Function) =>
  host(['args'], createDefaultCbs);

export class CbsWithArgs<T extends (...args: any[]) => any> extends Cbs {
  args: Parameters<T>[0] = stub;
}

export type DefineCbs<T, U> = {
  [K in keyof T]: T[K] extends (...args: any[]) => any
    ? K extends keyof U
      ? CbsWithArgs<T[K]> & U[K]
      : CbsWithArgs<T[K]>
    : never;
};
