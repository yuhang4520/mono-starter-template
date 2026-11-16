// The API contract deliberately uses JSON-compatible values on every platform.
export const identityTransformer = {
  serialize: (value: unknown) => value,
  deserialize: (value: unknown) => value,
}
