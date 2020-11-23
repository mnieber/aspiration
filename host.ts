import { Callbacks, pushCallbacks, popCallbacks } from "./Callbacks";
import { symbols } from "./internal/symbols";

// Do some magic to ensure that the member function
// is bound to it's host.
// Copied from the bind-decorator npm package.
function wrapDescriptor(descriptor, operationMember) {
  return {
    configurable: true,
    get() {
      const bound = descriptor.value.bind(this);
      Object.defineProperty(this, operationMember, {
        value: bound,
        configurable: true,
        writable: true,
      });
      return bound;
    },
  };
}

export function host(operationHost, operationMember, descriptor) {
  const f = descriptor.value;

  function getCallbacks(facet, args) {
    const callbackMap = (facet[symbols.callbackMap] || {})[operationMember];
    const callbacks = new Callbacks(callbackMap ?? {}, facet, args);
    pushCallbacks(callbacks);
    return callbacks;
  }

  if (typeof descriptor.value === "function") {
    descriptor.value = function (...args) {
      const callbacks = getCallbacks(this, args);
      callbacks.enter();
      const returnValue = f.bind(this)(...args);
      callbacks.exit();
      popCallbacks();
      return returnValue;
    };
  }
  return wrapDescriptor(descriptor, operationMember);
}
