import { useEffect, useState } from 'react'
import type { AppSettings, ToolStatus } from '@shared/types'
import type { Run } from '../App'
import { api } from '../api'

interface Props {
  settings: AppSettings
  onChange: (s: AppSettings) => void
  run: Run
}

export function AppSettingsView({ settings, onChange, run }: Props) {
  const [tools, setTools] = useState<ToolStatus | null>(null)
  const [skip, setSkip] = useState(settings.skipFolders.join(', '))

  const refreshTools = () => void api.getToolStatus().then(setTools)
  useEffect(refreshTools, [settings.sofficePath, settings.sumatraPath])

  const save = async (patch: Partial<AppSettings>) => {
    const s = await run(() => api.setSettings(patch))
    if (s) onChange(s)
  }

  const pick = async (key: 'sofficePath' | 'sumatraPath', title: string) => {
    const path = await run(() => api.pickExecutable(title))
    if (path) await save({ [key]: path })
  }

  return (
    <div className="settings-view">
      <header className="toolbar">
        <h1 className="batch-title">Settings</h1>
      </header>
      <div className="settings-body">
        <section className="card">
          <h2>Adding folders</h2>
          <label className="check">
            <input
              type="checkbox"
              checked={settings.includeSubfolders}
              onChange={(e) => save({ includeSubfolders: e.target.checked })}
            />
            Include files in subfolders
          </label>
          <div className="field">
            <label className="field-label">Skip folders named</label>
            <input
              value={skip}
              onChange={(e) => setSkip(e.target.value)}
              onBlur={() =>
                save({
                  skipFolders: skip
                    .split(',')
                    .map((s) => s.trim())
                    .filter(Boolean)
                })
              }
            />
            <div className="field-help">Comma separated. Hidden folders (starting with a dot) are always skipped.</div>
          </div>
        </section>

        <section className="card">
          <h2>Helper programs</h2>
          <ToolRow
            name="LibreOffice"
            purpose="Converts Word, Excel and PowerPoint files to PDF for preview and printing."
            found={tools?.sofficePath ?? null}
            custom={settings.sofficePath}
            onPick={() => pick('sofficePath', 'Locate soffice.exe (in LibreOffice\\program)')}
            onClear={() => save({ sofficePath: '' })}
            missing={
              <>
                Not found. Install it from <b>libreoffice.org</b>, then click Check again.
              </>
            }
          />
          <ToolRow
            name="SumatraPDF"
            purpose="The print engine. It is bundled with Batch Print, so you normally don't need to change this."
            found={tools?.sumatraPath ?? null}
            custom={settings.sumatraPath}
            onPick={() => pick('sumatraPath', 'Locate SumatraPDF.exe')}
            onClear={() => save({ sumatraPath: '' })}
            missing={<>Not found. Reinstall Batch Print or point to a copy of SumatraPDF.exe.</>}
          />
          <button onClick={refreshTools}>Check again</button>
        </section>

        <section className="card">
          <h2>Adding from Windows Explorer</h2>
          <p>
            Right-click any printable file or folder and choose <b>Add to print batch</b> (on Windows 11 it is under
            {' '}<b>Show more options</b>). You can also use <b>Send to → Batch Print</b>, which handles many selected files at
            once. Files go to the batch that is currently open.
          </p>
        </section>
      </div>
    </div>
  )
}

function ToolRow(props: {
  name: string
  purpose: string
  found: string | null
  custom: string
  onPick: () => void
  onClear: () => void
  missing: React.ReactNode
}) {
  return (
    <div className="tool-row">
      <div className="tool-head">
        <span className={`status-dot ${props.found ? 'ok' : 'bad'}`} />
        <b>{props.name}</b>
      </div>
      <p className="muted">{props.purpose}</p>
      <p className="tool-path">{props.found ?? props.missing}</p>
      <div className="tool-actions">
        <button onClick={props.onPick}>Choose location…</button>
        {props.custom && (
          <button className="link-btn" onClick={props.onClear}>
            Use automatic detection
          </button>
        )}
      </div>
    </div>
  )
}
