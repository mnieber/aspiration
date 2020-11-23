import { symbols } from "./internal/symbols";
import { getOrCreate } from "./internal/utils";

export const optional = { optional: true };

export type ToAny<FacetT, FuncT extends (this: FacetT, ...a: any) => any> = (
  this: FacetT,
  ...a: Parameters<FuncT>
) => any;

export type Labelled<T> = { label: string; func: T };

export type MaybeLabelled<T> = Labelled<T> | T;

export const ret = <T>(x: T) => ({
  label: "ret",
  func: x,
});

type FunctionMap<FacetT, FuncT extends (this: FacetT, ...a: any) => any> = {
  [label: string]: MaybeLabelled<ToAny<FacetT, FuncT>>[];
};

export class Callbacks<FacetT, FuncT extends (...a: any) => any> {
  callbacks: FunctionMap<FacetT, FuncT>;
  self: any;
  args: Parameters<FuncT>;

  constructor(callbacks: FunctionMap<FacetT, FuncT>, self: any, args) {
    this.callbacks = callbacks;
    this.self = self;
    this.args = args;
  }

  exec(label: string, options: any) {
    const callbacks = this.callbacks[label];

    if (callbacks === undefined) {
      if (!options?.optional) {
        throw Error("Callback not found: " + label);
      }
      return undefined;
    }

    var result = undefined;
    var hasResult = false;
    callbacks.forEach((f) => {
      const func = "func" in f ? f.func.bind(this.self) : f.bind(this.self);
      const label = "label" in f ? f.label : "";
      // @ts-ignore
      const localResult = func(...this.args);
      if (label === "ret") {
        result = localResult;
        hasResult = true;
      } else if (!hasResult) {
        result = localResult;
      }
    });
    return result;
  }

  enter() {
    this.exec("enter", optional);
  }

  exit() {
    this.exec("exit", optional);
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
