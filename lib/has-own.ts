/**
 * Whether `key` is one of the object's own entries. The `in` operator also says yes to names every
 * object inherits (`constructor`, `toString`, `__proto__`), which lets them pass as a known kind.
 */
export const hasOwn = (object: object, key: PropertyKey): boolean => Object.prototype.hasOwnProperty.call(object, key)
