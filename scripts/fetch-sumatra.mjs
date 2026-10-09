// Downloads the portable 64-bit SumatraPDF build into resources/bin so it can be
// bundled with the installer. SumatraPDF is GPLv3; it ships unmodified as a
// separate program, with its licence alongside it.
import { createWriteStream, existsSync, mkdirSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'

const VERSION = process.env.SUMATRA_VERSION || '3.5.2'
const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const binDir = join(root, 'resources', 'bin')
const exe = join(binDir, 'SumatraPDF.exe')

if (existsSync(exe) && !process.argv.includes('--force')) {
  console.log(`SumatraPDF already present at ${exe} (use --force to re-download)`)
  process.exit(0)
}

mkdirSync(binDir, { recursive: true })
const url = `https://www.sumatrapdfreader.org/dl/rel/${VERSION}/SumatraPDF-${VERSION}-64.zip`
const zip = join(binDir, 'sumatra.zip')
console.log(`Downloading ${url}`)
const res = await fetch(url)
if (!res.ok) throw new Error(`Download failed: ${res.status} ${res.statusText}`)
await pipeline(Readable.fromWeb(res.body), createWriteStream(zip))

// tar.exe ships with Windows 10 and later and can extract zip files.
const extractDir = join(binDir, 'extract')
rmSync(extractDir, { recursive: true, force: true })
mkdirSync(extractDir)
execFileSync('tar', ['-xf', zip, '-C', extractDir], { stdio: 'inherit' })
const found = readdirSync(extractDir).find((f) => /^SumatraPDF.*\.exe$/i.test(f))
if (!found) throw new Error('No SumatraPDF executable found in the download')
renameSync(join(extractDir, found), exe)
rmSync(extractDir, { recursive: true, force: true })
rmSync(zip, { force: true })

writeFileSync(
  join(binDir, 'SumatraPDF-LICENSE.txt'),
  `SumatraPDF ${VERSION} is free software licensed under the GNU GPL v3.\n` +
    'Source code: https://github.com/sumatrapdfreader/sumatrapdf\n' +
    'It is included unmodified and used as a separate program for printing.\n'
)
console.log(`SumatraPDF ${VERSION} saved to ${exe}`)
