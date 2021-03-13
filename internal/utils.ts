import { symbols } from "./symbols";

export function getOrCreate(obj, key, fn) {
  if (!obj[key]) {
    obj[key] = fn();
  }
  return obj[key];
}

export function getAdmin(host) {
  return getOrCreate(host, symbols.admin, () => ({}));
}
