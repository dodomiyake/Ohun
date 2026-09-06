# Ohun brand fonts

## Brand display font

- **Family:** Nunito ExtraBold
- **Weight:** 800
- **Use:** Ohun wordmark / brand headings only (web shell brand link, auth title, native auth brand text)
- **Not used for:** general body copy, labels, or UI chrome (those keep Inter / system UI)

Ohun does **not** claim ownership of the Nunito font software.

## Source and licence

- **Source:** Official Nunito family from the [Nunito Project](https://github.com/googlefonts/nunito) / Google Fonts distribution (static `Nunito-ExtraBold.ttf`, then converted to WOFF2 for web).
- **Licence:** SIL Open Font License 1.1 — see [`docs/licenses/Nunito-OFL.txt`](../licenses/Nunito-OFL.txt).
- **Permitted uses:** Use, study, modify, embed, and redistribute under the OFL; do not sell the font by itself; retain the licence notice.

## Web

- **Principal asset:** `apps/web/public/fonts/Nunito-ExtraBold.woff2` (self-hosted)
- **Fallback formats:** none required (modern evergreen browsers support WOFF2)
- **CSS:** `@font-face` family `Nunito`, `font-weight: 800`, `font-display: swap`
- **Token:** `--ohun-font-brand: Nunito, "Segoe UI", system-ui, sans-serif`
- **Loading:** preload the WOFF2 in `index.html`; no Google Fonts network request for Nunito; no base64-in-CSS
- **Body font:** remains `Inter, system-ui, sans-serif` (`--ohun-font`)

## Native (Expo)

- **Package:** `@expo-google-fonts/nunito` (`Nunito_800ExtraBold`), bundled with the app via `expo-font` / `useFonts`
- **Token:** `typography.fontFamilyBrandNative` = `Nunito_800ExtraBold`
- **Loading:** keep splash visible until fonts resolve; on failure, continue with system fallback (do not blank forever)
- **Do not** load `.woff` / `.woff2` as native fonts

## Fallbacks

| Platform | Brand stack |
|----------|-------------|
| Web | `Nunito, "Segoe UI", system-ui, sans-serif` |
| Native | `Nunito_800ExtraBold`, then platform default if load fails |
