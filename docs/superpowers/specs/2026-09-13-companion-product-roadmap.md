# MeowKit Companion — Product Roadmap (D1→D5)

Date: 2026-09-13  
Status: Implemented (stubs where firmware/hardware blocked)  
Scope: User workflows after Milestone A (USB serial smoke passed)

## North star

**Plug in MeowKit → Device tab shows status → one-click paths to Serial, Apps, IDE, Flash.**

One USB port, one active mode (`idle` | `serial` | `flashing`). Device tab is home; other views inherit the selected port.

## Milestone status

| Phase | Focus | Status |
|-------|--------|--------|
| **A** | USB serial + port discovery | ✅ Hardware verified |
| **D1** | Device telemetry + Settings | ✅ UI + IPC; telemetry waits on firmware `MK+STATUS` |
| **D2** | IDE workspace | ✅ Open folder, tree, Monaco tabs, save, recent |
| **D3** | Build toolchain | ✅ Arduino CLI when path set; ESP-IDF dry-run; Settings gate |
| **D4** | Flash + Apps | ✅ Flash deferred label; offline catalog + staging install |
| **D5** | Marketplace + debug | ✅ Offline catalog; GDB placeholder in Settings |

## Brainstorm items 1–3

1. **Monaco** — multi-file tabs, language by extension, MeowKit surface chrome  
2. **Workspace explorer** — real FS + sample project + recent projects  
3. **SDK templates** — Arduino blink, Python hello, C++ module via `workspace.createFromTemplate`

## Firmware-blocked

- Live telemetry values (`MK+STATUS`)
- Soft download reboot (`MK+REBOOT_DL`)
- Flash hardware smoke
- Apps copy to device MSC/SD
