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
      const callbacks = this[symbols.callbackMap][operationMember];
      if (!callbacks) {
        console.error(
          `Missing callbacks for operations ${operationMember}` +
            ` in host ${this}`
        );
      }
      if (callbacks.enter) callbacks.enter();
      const paramsMemo = {};
      const paramNames = getParamNames(f);

      // Create memo of param values
      paramNames.forEach((paramName, idx) => {
        paramsMemo[paramName] = callbacks[paramName];
        callbacks[paramName] = args[idx];
      });

      const returnValue = f.bind(this)(...args)(callbacks);
      if (callbacks.exit) callbacks.exit();

      // Restore memo of param values
      paramNames.forEach((paramName, idx) => {
        callbacks[paramName] = paramsMemo[paramName];
      });
      return returnValue;
    };
  }
  return descriptor;
}

export const setCallbacks = (facet: any, cbs: any) => {
  facet[symbols.callbackMap] = cbs;
};

export const stub = () => undefined as any;
