// The analysis engine (with the Public Suffix List and MIME parser) is the bulk of
// the bundle, so it loads in the background after first paint.
let promise: Promise<typeof import('./engine')> | null = null

export function loadEngine() {
  promise ??= import('./engine')
  return promise
}
