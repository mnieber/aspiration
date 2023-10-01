export const getCbs = <T>(cbs: T, args: any) => {
  return {
    ...cbs,
    args,
  };
};

export type Cbs<T extends (...args: any[]) => any> = {
  args: Parameters<T>[0];
};

export type CallbackMap<T> = {
  [K in keyof T]: T[K] & {
    enter?: () => void;
    exit?: () => void;
  };
};

export const withCbs = <CbsT, K extends keyof CbsT>(
  cbs: CbsT,
  fnName: K,
  args: any,
  f: (cbs: CbsT[K]) => any
) => {
  const cbsWithArgs = getCbs(cbs[fnName], args) as CbsT[K];
  (cbsWithArgs as any).enter && (cbsWithArgs as any).enter();
  const result = f(cbsWithArgs);
  (cbsWithArgs as any).exit && (cbsWithArgs as any).exit();
  return result;
};
