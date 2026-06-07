# Phoenix Messenger Desktop v1.4.0-beta

Phoenix Messenger Desktop is a thin Tauri shell around the hosted web
application:

`https://phoenix-messenger.netlify.app`

Firebase, Firestore, Cloudinary, and LiveKit remain hosted services. Their
server secrets are not bundled into the desktop application.

## Configuration

- Window size: 1200 x 800
- Minimum size: 900 x 650
- Native title bar
- Background: `#0B0D12`
- Bundle identifier: `app.phoenix-messenger.desktop`
- Source: `src-tauri/`
- Desktop icon source: `public/phoenix-desktop-icon.svg`
- Offline fallback: `public/offline.html`

## Development

```bash
npm install
npm run desktop:dev
```

The development wrapper uses the local Vite server.

## macOS Build

Run on macOS:

```bash
npm run desktop:build
```

Outputs are created under `src-tauri/target/release/bundle/`, including the
`.app` and `.dmg` bundles. Building on Apple Silicon creates an Apple Silicon
bundle. Add the Rust Intel target and build it separately when an Intel release
is required.

## Windows Build

Run on Windows with Rust, WebView2, and Visual Studio Build Tools installed:

```bash
npm run desktop:build
```

Tauri produces Windows installer bundles under
`src-tauri/target/release/bundle/`, including MSI and NSIS EXE installers.

## Icon Generation

Regenerate all desktop formats from the Phoenix orange/purple SVG:

```bash
npx tauri icon public/phoenix-desktop-icon.svg -o src-tauri/icons
```

This produces PNG, Windows ICO, and macOS ICNS assets.

## Release Process

1. Verify the hosted Messenger production URL.
2. Run `npm run lint` and `npm run build`.
3. Run `npx netlify build --offline`.
4. Update versions in `package.json`, `src-tauri/Cargo.toml`, and
   `src-tauri/tauri.conf.json`.
5. Build macOS bundles on macOS.
6. Build MSI and NSIS EXE bundles on Windows.
7. Sign and notarize installers before public distribution.

## Planned Native Features

- Tray icon
- Deep links
- Automatic updates
- Signed release pipeline
