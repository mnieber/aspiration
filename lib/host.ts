import { symbols } from '../internal/symbols';
import { getAdmin } from '../internal/utils';

function _setDefaultCallbacks(hostObjectAdmin, propertyName, defaultCbs) {
  hostObjectAdmin.defaultCallbackMap = hostObjectAdmin.defaultCallbackMap ?? {};
  hostObjectAdmin.defaultCallbackMap[propertyName] = defaultCbs;
  return defaultCbs;
}

function _host(target, propertyName, descriptor, paramNames, createDefaultCbs) {
  const f = descriptor.value;

  if (typeof descriptor.value === 'function') {
    descriptor.value = function (...args) {
      // Get or create callbacks object
      const admin = getAdmin(this);
      const callbacks =
        admin.callbackMap?.[propertyName] ??
        admin.defaultCallbackMap?.[propertyName] ??
        _setDefaultCallbacks(admin, propertyName, createDefaultCbs(this));

      // Replace the arguments in the callbacks object with the current
      // arguments. Keep a memo of the previous arguments.
      const paramsMemo = {};
      for (var idx = 0, n = paramNames.length; idx < n; ++idx) {
        const paramName = paramNames[idx];
        paramsMemo[paramName] = callbacks[paramName];
        callbacks[paramName] = args[idx];
      }

      const cbsMemo = this[symbols.cbs];
      this[symbols.cbs] = callbacks;

      // Execute the function (passing in the callbacks)
      if (callbacks.enter) callbacks.enter();
      const returnValue = f.bind(this)(...args);
      if (callbacks.exit) callbacks.exit();

      // Restore memo of param values
      this[symbols.cbs] = cbsMemo;
      for (var idx = 0, n = paramNames.length; idx < n; ++idx) {
        const paramName = paramNames[idx];
        callbacks[paramName] = paramsMemo[paramName];
      }

      return returnValue;
    };
  }
  return descriptor;
}

export function host(paramNames?: string[], createDefaultCbs?: Function) {
  return (target, propertyName, descriptor) =>
    _host(
      target,
      propertyName,
      descriptor,
      paramNames ?? [],
      createDefaultCbs ?? (() => ({}))
    );
}
