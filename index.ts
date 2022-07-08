import { getAdmin } from './internal/utils';

function _setDefaultCallbacks(hostObjectAdmin, propertyName, defaultCbs) {
  hostObjectAdmin.defaultCallbackMap = hostObjectAdmin.defaultCallbackMap ?? {};
  hostObjectAdmin.defaultCallbackMap[propertyName] = defaultCbs;
  return defaultCbs;
}

function _host(target, propertyName, descriptor, paramNames, createDefaultCbs) {
  const f = descriptor.value;

  if (typeof descriptor.value === 'function') {
    descriptor.value = function () {
      const executionContext = _prepareExecutionContext(
        this,
        propertyName,
        createDefaultCbs,
        f,
        arguments,
        paramNames
      );

      if (executionContext.callbacks.enter) executionContext.callbacks.enter();
      const returnValue = executionContext.boundf(executionContext.callbacks);
      if (executionContext.callbacks.exit) executionContext.callbacks.exit();

      // Restore memo of param values
      for (var idx = 0, n = paramNames.length; idx < n; ++idx) {
        const paramName = paramNames[idx];
        executionContext.callbacks[paramName] =
          executionContext.paramsMemo[paramName];
      }

      return returnValue;
    };
  }
  return descriptor;
}

function _prepareExecutionContext(
  self: any,
  propertyName: any,
  createDefaultCbs: any,
  f: any,
  argsArray: any,
  paramNames: string[]
) {
  var args: any[] = [];
  for (var _i = 0; _i < argsArray.length; _i++) {
    args[_i] = argsArray[_i];
  }
  const admin = getAdmin(self);

  const callbacks =
    admin.callbackMap?.[propertyName] ??
    admin.defaultCallbackMap?.[propertyName] ??
    _setDefaultCallbacks(admin, propertyName, createDefaultCbs(self));

  // Create memo of param values
  const paramsMemo = {};
  for (var idx = 0, n = paramNames.length; idx < n; ++idx) {
    const paramName = paramNames[idx];
    paramsMemo[paramName] = callbacks[paramName];
    callbacks[paramName] = args[idx];
  }
  return { callbacks, paramsMemo, boundf: f.bind(self)(...args) };
}

export function host(...args) {
  if (args.length === 2) {
    const wrapped = (target, propertyName, descriptor) => {
      return _host(target, propertyName, descriptor, args[0], args[1]);
    };
    return wrapped;
  }

  if (args.length === 1) {
    const wrapped = (target, propertyName, descriptor) => {
      return _host(target, propertyName, descriptor, args[0], () => ({}));
    };
    return wrapped;
  }

  const [target, propertyName, descriptor] = args;
  return _host(target, propertyName, descriptor, [], () => ({}));
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
