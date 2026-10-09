import { resolve } from 'node:path'

export const ADD_FLAG = '--add'

/**
 * Paths after `--add` on a command line, as passed by the Explorer menu and the
 * Send To shortcut. `ignore` drops paths such as the app folder that Electron
 * passes in development.
 */
export function pathsFromArgv(argv: string[], ignore: string[] = []): string[] {
  const i = argv.indexOf(ADD_FLAG)
  if (i === -1) return []
  const skip = new Set(ignore.map((p) => resolve(p).toLowerCase()))
  return argv
    .slice(i + 1)
    .filter((a) => a && !a.startsWith('--') && !skip.has(resolve(a).toLowerCase()))
}
