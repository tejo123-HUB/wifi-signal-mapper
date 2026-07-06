# Project file structure

```
wifi-signal-mapper/
├── .gitignore
├── package.json
├── package-lock.json
├── README.md
├── CLAUDE.md
├── AGENTS.md
├── BUILD_STEPS.md
├── data/
│   └── wifi.db                          (generated at runtime, not committed)
├── uploads/
│   └── .gitkeep                         (room photos land here, not committed)
├── server/
│   ├── index.js                         thin loader — core + enabled modules
│   ├── features.config.js               enabled module ids
│   ├── core/
│   │   ├── db.js                        floors, rooms, samples tables
│   │   ├── floorplanBuilder.js          F01/F02 — room upload + arrangement
│   │   ├── wifiScanner.js               F03 — RSSI reading
│   │   └── interpolation.js             F05/F14 — IDW heatmap math
│   └── modules/
│       ├── multiAP/
│       │   └── index.js                 F07
│       ├── congestionTracking/
│       │   └── index.js                 F08
│       ├── deadZoneReport/
│       │   └── index.js                 F09
│       ├── speedTest/
│       │   └── index.js                 F11
│       ├── multiFloor/
│       │   └── index.js                 F12
│       └── pdfExport/
│           └── index.js                 F13
└── public/
    ├── index.html
    ├── style.css
    ├── app.js                           thin loader — core + enabled modules
    ├── features.config.js               enabled module ids (mirrors server)
    ├── core/
    │   ├── canvasEngine.js              shared composite floor canvas drawing
    │   ├── floorplanBuilder.js          F01/F02 — upload + drag/resize UI
    │   ├── tagging.js                   F02/F04 — click-to-tag + save sample
    │   └── heatmap.js                   F06 — render heatmap layer
    └── modules/
        ├── multiAP.js                   F07
        ├── congestionTracking.js        F08
        ├── deadZoneReport.js            F09
        ├── speedTest.js                 F11
        ├── multiFloor.js                F12
        └── pdfExport.js                 F13
```

## Notes

- `data/` and `uploads/*` are runtime-generated and excluded from git via `.gitignore` (only `uploads/.gitkeep` is committed, to keep the folder in the repo).
- Every file under `server/modules/` and `public/modules/` follows the module contract defined in `CLAUDE.md`/`AGENTS.md` — same shape regardless of which feature it implements.
- `server/index.js` and `public/app.js` are the only two files that should never contain feature-specific logic — they just read `features.config.js` and loop.
