import { symbols } from "./internal/symbols";
import { getOrCreate } from "./internal/utils";

export const optional = { optional: true };

export type ToAny<FacetT, FuncT extends (this: FacetT, ...a: any) => any> = (
  this: FacetT,
  ...a: Parameters<FuncT>
) => any;

type FunctionMap<FacetT, FuncT extends (this: FacetT, ...a: any) => any> = {
  [label: string]: ToAny<FacetT, FuncT>[];
};

export class Callbacks<FacetT, FuncT extends (...a: any) => any> {
  callbacks: FunctionMap<FacetT, FuncT>;
  self: any;
  args: Parameters<FuncT>;
  queue: Array<Function> = [];

  constructor(callbacks: FunctionMap<FacetT, FuncT>, self: any, args) {
    this.callbacks = callbacks;
    this.self = self;
    this.args = args;
  }

  _schedule(label, options: any) {
    const callbacks = this.callbacks[label];

    if (callbacks === undefined) {
      if (!options?.optional) {
        throw Error("Callback not found: " + label);
      }
      return undefined;
    }

    callbacks.forEach((f) => this.queue.push(f));
  }

  exec(label: string, options: any) {
    if (!label.endsWith("_pre")) {
      this._schedule(label + "_pre", { ...options, optional: true });
    }
    this._schedule(label, options);
    const result = this.flush();
    if (!label.endsWith("_post")) {
      this._schedule(label + "_post", { ...options, optional: true });
    }
    return result;
  }

  flush() {
    var result = undefined;
    this.queue.forEach((f) => {
      result = f.bind(this.self)(...this.args);
    });
    this.queue = [];
    return result;
  }

  enter() {
    this._schedule("enter", { optional: true });
  }

  exit() {
    this._schedule("exit", { optional: true });
    this.flush();
  }
}

type PartialMap<T> = { [k in keyof T]: any };

const _setCallbacks = <
  FacetT extends PartialMap<FacetT>,
  K extends keyof FacetT
>(
  facet: FacetT,
  operationMember: K,
  callbackMap: FunctionMap<FacetT, FacetT[K]>
) => {
  const callbackByOperationName = getOrCreate(
    facet,
    symbols.callbackMap,
    () => ({})
  );
  callbackByOperationName[operationMember] = callbackMap;
};

export const setCallbacks = <FacetT extends PartialMap<FacetT>>(
  facet: FacetT,
  callbacksByOperationMember: Partial<
    {
      [K in keyof FacetT]: FunctionMap<FacetT, FacetT[K]>;
    }
  >
) => {
  Object.entries(callbacksByOperationMember).forEach((x) => {
    _setCallbacks(facet, x[0] as any, x[1] as any);
  });
};

export const getCallbacks = () => {
  const callbacks = stack[stack.length - 1];
  if (!callbacks || !callbacks.callbacks) {
    throw Error("No callbacks");
  }
  return callbacks;
};

export const exec = (label: string | undefined, options: any = undefined) => {
  const callbacks = getCallbacks();
  if (label === undefined) {
    return callbacks.flush();
  }
  return callbacks.exec(label, options);
};

const stack: any[] = [];

export const pushCallbacks = (x: any) => {
  stack.push(x);
};

export const popCallbacks = () => {
  stack.pop();
};
