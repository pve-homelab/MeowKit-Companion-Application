You are building the official MeowKit Companion App and MeowKitIDE. The application must be built using Electron for cross‑platform support (Windows, macOS, Linux), React for the UI, and Monaco Editor for the integrated IDE. The app must include all features listed below and must be architected cleanly, modularly, and with production‑grade detail.

The MeowKit device is ESP32‑based. All flashing, communication, and device management must work offline and without requiring the BOOT button. The app must support both official firmware and custom firmware.

Include the following major systems:

1. Firmware Flashing System
   - Offline flashing of official firmware versions stored in a backend database.
   - Offline flashing of custom firmware uploaded by the user.
   - Automatic bootloader entry without pressing the BOOT button (use RTS/DTR toggling).
   - Full ESP32 bootloader protocol support.
   - Flash progress UI, logs, error handling, and device detection.
   - Ability to bundle selected MeowKit apps into the firmware before flashing.
   - Ability to flash filesystem partitions (SPIFFS/LittleFS) for assets, scripts, IR codes, music, etc.

2. SD Card / Storage Management System
   - Access MeowKit storage via USB MSC or equivalent.
   - Upload, remove, and manage:
     - Music files
     - Scripts
     - Assets
     - IR codes
     - App data
   - Show storage usage, file tree, and metadata.
   - Support drag‑and‑drop file management.

3. App Marketplace and App Manager
   - Browse installable MeowKit apps.
   - Install, remove, update apps.
   - Mark apps as “included” so they are automatically bundled during firmware flashing.
   - Support custom apps uploaded by the user.
   - Backend API for app listings, metadata, screenshots, versions, and dependencies.

4. Serial Console and Device Commands
   - Integrated serial monitor with baud rate selection.
   - Auto‑reconnect.
   - Ability to send commands to the MeowKit device.
   - Ability to trigger bootloader mode via serial command.
   - Ability to read logs, crash dumps, and debug output.

5. Integrated MeowKitIDE (VS Code‑style)
   - Monaco Editor embedded inside React.
   - Full MeowKit‑themed syntax highlighting, colors, fonts, and icons.
   - Support both single‑file (Arduino‑style) and multi‑file (VS Code‑style) workflows.
   - File explorer, tabs, panels, and layout built with MeowKit React components.
   - Build system integration:
     - ESP-IDF toolchain
     - Arduino toolchain
     - Custom MeowKit build scripts
   - One‑click build, upload, and serial monitor.
   - Examples browser and template generator.
   - Optional debugging support (GDB, breakpoints, variable inspection).

6. Device Manager Panel
   - Show connected MeowKit devices.
   - Firmware version, installed apps, storage usage.
   - Quick actions: restart, reset, flash, open serial monitor.
   - Health/status indicators.

7. Architecture Requirements
   - Electron main process handles USB/serial, filesystem, and native operations.
   - React front‑end handles UI, IDE, marketplace, and device manager.
   - IPC bridge between React and Electron for all native operations.
   - Modular code structure with clear separation of concerns.
   - Offline‑first design for flashing and app management.
   - Auto‑update system for the companion app itself.

8. Design Requirements
   - Use the MeowKit React UI library (see Prompt 2) for all UI components.
   - The entire app must visually match the MeowKit brand, documentation, and website.
   - Monaco Editor must be themed to match MeowKit colors, fonts, and UI style.

Your task: Generate the full architecture, component structure, module layout, and implementation plan for this complete MeowKit Companion App + MeowKitIDE. Include all subsystems, data flows, IPC channels, UI layout, backend logic, and integration details. The output must be exhaustive, production‑ready, and technically precise.
