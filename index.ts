import { symbols } from "./internal/symbols";

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

export function host(operationHost, operationMember, descriptor) {
  const f = descriptor.value;

  if (typeof descriptor.value === "function") {
    descriptor.value = function (...args) {
      const s = symbols.callbackMap;
      const callbacks = this[s]?.[operationMember];
      const paramsMemo = {};

      const paramNames = (f[symbols.paramNames] =
        f[symbols.paramNames] ?? getParamNames(f));

      // Create memo of param values
      if (callbacks) {
        paramNames.forEach((paramName, idx) => {
          paramsMemo[paramName] = callbacks[paramName];
          callbacks[paramName] = args[idx];
        });
      }

      if (callbacks && callbacks.enter) callbacks.enter();
      const returnValue = f.bind(this)(...args)(callbacks);
      if (callbacks && callbacks.exit) callbacks.exit();

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

export const setCallbacks = (facet: any, cbs: any) => {
  facet[symbols.callbackMap] = cbs;
};

export const stub = () => undefined as any;
