// The plugin's installed dependencies do not include this host utility (it is
// only used by diff rendering, which the workflow UI never shows). Minimal
// stand-in so the real primitives bundle can be built for the static demo.
export const CODE_HIGHLIGHT_EXTENSIONS: readonly string[] = []
export function languageForPath(_path: string): string | undefined { return undefined }
