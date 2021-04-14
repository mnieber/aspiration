import { getAdmin } from "./internal/utils";

var STRIP_COMMENTS = /(\/\/.*$)|(\/\*[\s\S]*?\*\/)|(\s*=[^,\)]*(('(?:\\'|[^'\r\n])*')|("(?:\\"|[^"\r\n])*"))|(\s*=[^,\)]*))/gm;
var ARGUMENT_NAMES = /([^\s,]+)/g;
function getParamNames(func) {
  var fnStr = func.toString().replace(STRIP_COMMENTS, "");
  var result = fnStr
    .slice(fnStr.indexOf("(") + 1, fnStr.indexOf(")"))
    .match(ARGUMENT_NAMES);
  if (result === null) result = [];
  return result;
}

function _setDefaultCallbacks(hostObjectAdmin, propertyName, defaultCbs) {
  hostObjectAdmin.defaultCallbackMap = hostObjectAdmin.defaultCallbackMap ?? {};
  hostObjectAdmin.defaultCallbackMap[propertyName] = defaultCbs;
  return defaultCbs;
}

function _host(target, propertyName, descriptor, createDefaultCbs) {
  const f = descriptor.value;

  if (typeof descriptor.value === "function") {
    descriptor.value = function (...args) {
      const admin = getAdmin(this);

      const callbacks =
        admin.callbackMap?.[propertyName] ??
        admin.defaultCallbackMap?.[propertyName] ??
        _setDefaultCallbacks(admin, propertyName, createDefaultCbs(this));

      if (!admin.paramNamesMap) admin.paramNamesMap = {};
      const paramNames = (admin.paramNamesMap[propertyName] =
        admin.paramNamesMap[propertyName] ?? getParamNames(f));

      // Create memo of param values
      const paramsMemo = {};
      for (var idx = 0, n = paramNames.length; idx < n; ++idx) {
        const paramName = paramNames[idx];
        paramsMemo[paramName] = callbacks[paramName];
        callbacks[paramName] = args[idx];
      }

      if (callbacks.enter) callbacks.enter();
      const returnValue = f.bind(this)(...args)(callbacks);
      if (callbacks.exit) callbacks.exit();

      // Restore memo of param values
      for (var idx = 0, n = paramNames.length; idx < n; ++idx) {
        const paramName = paramNames[idx];
        callbacks[paramName] = paramsMemo[paramName];
      }

      return returnValue;
    };
  }
  return descriptor;
}

export function host(...args) {
  if (args.length === 1) {
    const wrapped = (target, propertyName, descriptor) => {
      return _host(target, propertyName, descriptor, args[0]);
    };
    return wrapped;
  }

  const [target, propertyName, descriptor] = args;
  return _host(target, propertyName, descriptor, () => ({}));
}

export function setCallbacks(host: any, cbs: any) {
  const admin = getAdmin(host);
  admin.callbackMap = cbs;
  admin.defaultCallbackMap = admin.defaultCallbackMap ?? {};
}

export class Cbs {
  enter() {}
  exit() {}
}

export const stub = () => undefined as any;

export const nop = (...args: any[]) => undefined as any;

export const maybe = (x: Function) => x ?? nop;
