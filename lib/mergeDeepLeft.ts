function isObject(item) {
  return item && typeof item === 'object' && !Array.isArray(item);
}

export function mergeDeepLeft(target, source) {
  const output = Object.assign({}, source);
  for (const key in target) {
    if (isObject(target[key]) && isObject(source[key])) {
      output[key] = mergeDeepLeft(target[key], source[key]);
    } else {
      output[key] = target[key];
    }
  }
  return output;
}
