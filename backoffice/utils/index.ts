import type { JsonSerializable } from "types/json";

export function checkAllKeys(
	obj: typeof Object,
	callback: (key: string, value: typeof Object | JsonSerializable) => void,
) {
	for (const key in obj) {
		if (Object.hasOwn(obj, key)) {
			callback(key, obj[key]);
			if (typeof obj[key] === "object" && obj[key] !== null) {
				checkAllKeys(obj[key], callback);
			}
		}
	}
}
