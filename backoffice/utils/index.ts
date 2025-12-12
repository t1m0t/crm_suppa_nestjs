export function checkAllKeys(obj: any, callback: (key: string, value: any) => void) {
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      callback(key, obj[key]);
      if (typeof obj[key] === 'object' && obj[key] !== null) {
        checkAllKeys(obj[key], callback);
      }
    }
  }
}
