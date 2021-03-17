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

function _host(operationHost, operationMember, descriptor, createDefaultCbs) {
  const f = descriptor.value;

  if (typeof descriptor.value === "function") {
    descriptor.value = function (...args) {
      const admin = getAdmin(this);
      const callbacks =
        admin.callbackMap?.[operationMember] ?? createDefaultCbs(this);
      const paramsMemo = {};

      const paramNames = (admin.paramNames =
        admin.paramNames ?? getParamNames(f));

      // Create memo of param values
      paramNames.forEach((paramName, idx) => {
        paramsMemo[paramName] = callbacks[paramName];
        callbacks[paramName] = args[idx];
      });

      if (callbacks.enter) callbacks.enter();
      const returnValue = f.bind(this)(...args)(callbacks);
      if (callbacks.exit) callbacks.exit();

      // Restore memo of param values
      if (callbacks) {
        paramNames.forEach((paramName, idx) => {
          callbacks[paramName] = paramsMemo[paramName];
        });
      }
      return returnValue;
    };
  }
  return descriptor;
}

export function host(...args) {
  if (args.length === 1) {
    const wrapped = (operationHost, operationMember, descriptor) => {
      return _host(operationHost, operationMember, descriptor, args[0]);
    };
    return wrapped;
  }

  const [operationHost, operationMember, descriptor] = args;
  return _host(operationHost, operationMember, descriptor, () => ({}));
}

export function setCallbacks(host: any, cbs: any) {
  getAdmin(host).callbackMap = cbs;
}

export const stub = () => undefined as any;

export const nop = (...args: any[]) => undefined as any;

export const maybe = (x: Function) => x ?? nop;
