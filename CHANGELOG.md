# Changelog

All notable changes to the Forging XP Calculator, split by platform.
Adding a new version section at the top and pushing it publishes that release automatically.
Downloads for every version are on the [Releases](../../releases) page.

## [1.4.1] — 2026-11-02

### 🖥️ Desktop (Windows) and 📱 Mobile (Android)
- **Fastest route: you can now add ores, not just remove them.** Fixed: ores skipped because a better one was unlocked ("not needed") showed a red − and couldn't be brought into the route.
  - **Green +** on a "not needed" ore adds it. The route then uses the best of the ores you've added (tagged *ADDED*), and falls back to the automatic pick where none of them is unlocked yet. For example, at Lv 35 → 50, adding Crystalite gives Crystalite all the way; adding Verdite as well gives Crystalite 35 → 45, then Verdite 45 → 50.
  - **Red −** on an ore you added removes it again. On an automatically picked ore it excludes it (the row goes dark, and green + brings it back).
  - Ores that unlock after your target have a disabled button.
  - A **reset** link next to the route heading appears whenever you've customised the route.

## [1.4.0] — 2026-11-02

### 🖥️ Desktop (Windows) and 📱 Mobile (Android)
- **In-app updates.** On launch, the app checks GitHub for a newer release and shows a card with what's new. One click updates: Windows downloads the new version and restarts, Android downloads the APK and opens the installer. You can choose *Later*, *Skip this version*, or turn it off in **Settings → Updates**, which also has *Check for updates* and shows your version.
- **Rebalanced ores** (XP per craft of 4): Iron 320 → **276**, Steel 1,120 → **729**, Kobold 2,560 → **1,992**. Old default values update automatically; values you typed in yourself are kept.
- **Fastest route: include / exclude ores.** Every ore is listed with a button. Red **−** excludes it (the row goes dark) and the route is recalculated without it. Green **+** brings it back. Your choice is saved.
- **Verdite** has a richer emerald-green ingot.

### 📱 Mobile (Android)
- Unlock badges inside list rows are now compact, so material names aren't cut off on narrow phones.
- Needs two new permissions for updates: internet (to check for releases) and installing packages (to install the downloaded update).

> **Note:** builds before 1.4.0 can't update themselves. Install 1.4.0 manually once; from then on, updates come in-app.

## [1.3.0] — 2026-11-01

### 🖥️ Desktop (Windows) and 📱 Mobile (Android)
- **Max level raised to 50** (was 35). Level 1 → 50 is 7,020,524 XP in total. The level boxes, XP Table, progress bar and Max shortcut all follow the new cap. Theoretical mode now lifts the Lv 50 cap.
- **New material: Verdite.** Unlocks at Lv 45, 8,105 XP per craft of 4 (2,026.25 each).
- **Obsidian has a value now:** 5,875 XP per craft of 4 (1,468.75 each). Unlocks at Lv 35 and is now a normal levelling material (it used to be max-level only).
- **Crystalite rebalanced:** 4,160 → 3,806 XP per craft of 4 (951.5 each). If you still had the old 4,160 saved, it updates automatically. Values you entered yourself are kept.
- The fastest route now continues Crystalite → **Obsidian (Lv 35)** → **Verdite (Lv 45)**.
- Per-item XP shows decimals where needed (e.g. 951.5 each). Counts still round up to whole crafts of 4.

## [1.2.2] — 2026-10-29

### 🖥️ Desktop (Windows)
- Result numbers (items needed, XP, crafts, levels, "other materials", tables) can now be **selected by dragging** and copied.
- **Click any result number to copy it**: just the digits (e.g. `2124`), with a "Copied" toast and a brief highlight. Clicking the number in an "other materials" row copies it; clicking the row's name still switches material.

### 📱 Mobile (Android)
- Result numbers can be **long-pressed to select** (with the normal Android copy menu), or **tapped to copy** instantly, with a toast and a short vibration.
- Swiping between tabs no longer interferes while text is selected.

## [1.2.1] — 2026-10-29

### 🖥️ Desktop (Windows) and 📱 Mobile (Android)
- Documented where the XP formula comes from. It was derived by measuring the max XP of every blacksmithing level from 1 to 25 in-game and fitting a formula to those values, and it matches all of them exactly. Levels above 25 (and Theoretical mode) are extrapolated.
  - Shown in the XP Table tab and in Settings → About, and explained in the README.

## [1.2.0] — 2026-10-28

### 🖥️ Desktop (Windows) and 📱 Mobile (Android)
- **New: Theoretical mode.** A flask button in the top bar lifts the real Lv 35 cap so the XP formula keeps going past 35 (up to Lv 500). Use it to plan what levels beyond the cap would cost.
  - The button glows purple and results are tagged *THEORETICAL · no level cap* while it's on.
  - The level boxes, the XP Table (extends past 35) and the progress bar follow the lifted cap. The target's **Max** shortcut becomes **+25**.
  - Obsidian (unlocks at Lv 35) becomes usable past 35 in this mode once its XP value is set.
  - Turning it off snaps everything back inside Lv 35. It always starts **off** when the app opens.
- On phones narrower than 370 px the button shows just the flask icon.

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
