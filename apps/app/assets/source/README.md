# Source Assets for Rava

Drop your high-resolution master brand artwork here. The automated asset generation script (`npm run assets:generate` or `npm run play:assets`) will read from this directory to generate all required app icons, adaptive layers, splash screens, web favicons, and Google Play Store listing assets.

## Files You Can Provide

| File Path | Description | Recommended Specs |
|---|---|---|
| `assets/source/icon-source.png` | Master app icon / logo mark | **1024×1024 px** (or higher), square, high-res PNG (transparent or opaque background). |
| `assets/source/feature-graphic-source.png` | Google Play Feature Graphic *(optional)* | **1024×500 px**, PNG or JPEG, no alpha channel, <= 15MB. If omitted, the script auto-generates a clean banner with your logo. |
| `assets/source/monochrome-source.png` | Android 13+ Themed Icon mark *(optional)* | **432×432 px** or **1024×1024 px**, single-color silhouette with transparent background. If omitted, the script extracts the silhouette from `icon-source.png`. |

## How to Run

```bash
# Generate all asset variants from source
npm run assets:generate

# Or pass a custom source file directly:
npm run assets:generate -- --source /path/to/my-logo.png

# Validate generated assets & Google Play readiness
npm run play:preflight
```

## Generated Outputs

Running `npm run assets:generate` creates:
- `assets/images/icon.png` (1024×1024, opaque, no alpha)
- `assets/images/android-icon-foreground.png` (432×432, transparent, mark inside 66% safe zone)
- `assets/images/android-icon-monochrome.png` (432×432, white silhouette on transparent, inside 66% safe zone)
- `assets/images/splash-icon.png` (512×512, transparent, centered mark)
- `assets/images/favicon.png` (196×196, for Expo web)
- `assets/store/google-play-icon-512.png` (512×512, 32-bit PNG, <= 1MB)
- `assets/store/google-play-feature-graphic.png` (1024×500, no alpha)
