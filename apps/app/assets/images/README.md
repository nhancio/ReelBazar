# App Icons & Assets for Rava

All icon, splash, and store assets in this directory and `assets/store/` are generated automatically via `sharp` using `npm run assets:generate`.

## Generated Files

| File | Specs & Purpose |
|---|---|
| `icon.png` | **1024×1024 px**, square, **no alpha channel** (required by Apple App Store & Expo). |
| `android-icon-foreground.png` | **432×432 px**, transparent background, logo mark centered within the inner **66.67% / 288×288 px safe zone** (prevents clipping by Android OEM adaptive icon masks). |
| `android-icon-monochrome.png` | **432×432 px**, pure white silhouette on transparent background, centered in safe zone (for Android 13+ themed icons). |
| `splash-icon.png` | **512×512 px**, transparent PNG centered over black background (`#000000`). |
| `favicon.png` | **196×196 px** PNG for web / Expo web. |

## Updating Master Brand Assets

To update icons with new brand artwork:
1. Place your master artwork in `apps/app/assets/source/icon-source.png` (or `.jpg`, `.jpeg`, `.webp`).
2. *(Optional)* Place a custom Google Play feature graphic in `apps/app/assets/source/feature-graphic-source.png` (1024×500 px).
3. Run the generator:
   ```bash
   npm run assets:generate
   ```
4. Verify store compliance:
   ```bash
   npm run play:preflight
   ```
