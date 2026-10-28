# Changelog

All notable changes to the Forging XP Calculator, split by platform.
Downloads for every version are on the [Releases](../../releases) page.

## [1.1.1] — 2026-10-28

### 🖥️ Desktop (Windows)
- Fixed: on the Level Projection tab, large XP amounts (e.g. "+624,000 XP · 3 spare") overflowed their row into the result panel.
- Material rows now adapt to the card's own width: the XP column grows to fit, the +4 / +16 / +64 buttons hide when space is tight, and on very narrow layouts the XP amount moves under the material name.
- "Spare" items (left over after whole crafts of 4) now show in amber instead of red.

### 📱 Mobile (Android)
- No functional changes; version bumped to stay in sync with desktop.

## [1.1.0] — 2026-10-28

### 🖥️ Desktop (Windows)
- Release builds are now a single `.exe` (no `WebView2Loader.dll` needed).

### 📱 Mobile (Android)
- Fixed: Start / Target cards were wider than the screen on narrower phones (360 px and below) and got cut off.
- New adaptive launcher icon: the anvil fills the icon on a dark forge background, with no white outline. Works with circle, squircle and rounded-square launchers.
- The floating result pill is now solid, so text underneath doesn't show through.
- Small-screen polish for 320 px phones (lists, colour swatches).

### Project
- Releases are built and published automatically by GitHub Actions.

## [1.0.0] — 2026-10-28

First release.

### Both platforms
- **Materials Needed**: start level + current XP → target level; items, crafts, overshoot, progress bar, and the same goal in every material.
- **Fastest route**: uses the best material unlocked at each stage (Iron → Steel 6 → Kobold 15 → Crystalite 25).
- **Level Projection**: the level you'll reach with what you have. Locked materials only count once you reach their level.
- **XP Table**: the full blacksmithing curve, with unlock markers.
- Crafting-accurate rounding: everything is in whole crafts of 4 items.
- Editable material XP values and unlock levels, sounds, themes and accent colours.

### 🖥️ Desktop (Windows)
- Frameless window, resizable from every edge, always fits on screen, always-on-top, window opacity.

### 📱 Mobile (Android)
- Swipe between tabs, bottom navigation, haptics, hold-to-repeat steppers, scroll-safe sliders, tap guard while scrolling, back-button support.
