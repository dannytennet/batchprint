# Batch Print

A Windows desktop app for printing many files in one go. Collect files into named
batches, set print options for the whole batch or for individual files, put them
in the order you want, then print the lot.

## Features

- **Named batches** you can switch between. They save automatically, and can be
  duplicated, exported to a file and imported again.
- **Add files** by dragging files or folders onto the window, with the Add buttons, or
  from Windows Explorer (right-click → *Add to print batch*, or *Send to → Batch Print*).
  Folders are scanned for printable files, including subfolders (configurable).
- **Supported files**: PDF, images (PNG, JPG, GIF, BMP, TIFF, WebP), Word, Excel,
  PowerPoint, OpenDocument, RTF, TXT and CSV.
- **Batch defaults with per-item overrides** for printer, copies, page range, one or
  two-sided, colour or black & white, paper size, tray, orientation and scaling
  (fit to page, shrink, actual size). Select several items to change them together.
  Overridden settings are highlighted and can be reset to the batch default.
- **Reorder** by dragging (drag a multi-selection to move it as a group), with the
  move buttons, Alt+↑/↓, or sort by name. Untick an item to skip it without removing it.
- **Previews and page counts.** Thumbnails for every item, a page-by-page preview
  that marks pages your range leaves out, and a running total of pages to print.
- **Print history** of every file sent, with its settings and any errors.

## How printing works

- **PDFs and images** are printed by [SumatraPDF](https://www.sumatrapdfreader.org),
  which is bundled with the installer and runs silently in the background.
- **Office documents** are first converted to PDF with **LibreOffice** (which must be
  installed on each PC), then printed the same way. Conversion happens when you add
  the file, so the preview and page count are ready before you print. Converted
  copies are cached and redone automatically if the original file changes.
- Items print one at a time, in list order. A failed item is logged and the rest of
  the batch carries on. Printing can be cancelled.
- Paper sizes and trays are read from the printer driver, so the lists match each
  printer. Refresh printers in the batch defaults panel if you add a new one.

## Installing on other PCs

1. Install [LibreOffice](https://www.libreoffice.org/download/) (only needed for Office files).
2. Run the `Batch Print Setup x.y.z.exe` installer.

The installer adds the Explorer right-click entry and the Send To shortcut. On
Windows 11 the right-click entry is under **Show more options**. Files added from
Explorer go to the batch that is currently open. Uninstalling removes both entries.

The installer is not code-signed yet, so Windows SmartScreen will warn the first time
it runs. To sign it, set `CSC_LINK` (path to, or base64 of, a `.pfx` certificate) and
`CSC_KEY_PASSWORD` before running `npm run dist`.

## Development

Requires Node.js 22.

```sh
npm install
npm run fetch-sumatra   # downloads SumatraPDF into resources/bin (Windows)
npm run dev             # run the app with hot reload
npm test                # unit tests
npm run typecheck
npm run dist            # build the Windows installer into dist/
```

To test adding from the command line the way Explorer does:
`npm run dev -- -- --add "C:\path\to\file.pdf" "C:\path\to\folder"`.

The CI workflow runs the tests on every push and builds the Windows installer, which
is attached to the run as an artifact.

### Layout

| Path | What it does |
| --- | --- |
| `src/main/` | Electron main process: batch storage, folder scanning, LibreOffice conversion, printer discovery, the print runner |
| `src/preload/` | The bridge that exposes the API in `src/shared/api.ts` to the window |
| `src/renderer/` | React UI |
| `src/shared/` | Types and logic used by both sides (settings inheritance, page ranges, file types, reordering) |
| `build/installer.nsh` | Installer additions for the Explorer menu and Send To |
| `tests/` | Vitest unit tests |

Batches, settings and history are stored as JSON in `%APPDATA%\Batch Print`.
