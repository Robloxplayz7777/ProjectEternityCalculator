// Forging XP — native shell (tao + wry / WebView2)
// Frameless transparent window, edge resizing, true window opacity,
// settings + window-bounds persistence, and always-fits-the-screen sizing.

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::fs;
use std::path::PathBuf;
use std::time::Duration;

use tao::dpi::{LogicalSize, PhysicalPosition, PhysicalSize};
use tao::event::{Event, WindowEvent};
use tao::event_loop::{ControlFlow, EventLoopBuilder, EventLoopProxy};
use tao::window::{ResizeDirection, Window, WindowBuilder};
use wry::{WebContext, WebViewBuilder};

const HTML: &str = include_str!("../ui/index.html");
const CSS: &str = include_str!("../ui/style.css");
const JS: &str = include_str!("../ui/app.js");

const DEFAULT_W: f64 = 1060.0; // logical px
const DEFAULT_H: f64 = 740.0;
const MIN_W: f64 = 640.0;
const MIN_H: f64 = 460.0;

enum UserEvent {
    Ipc(String),
    ShowFallback,
}

fn data_dir() -> PathBuf {
    let base = std::env::var_os("APPDATA")
        .map(PathBuf::from)
        .unwrap_or_else(|| std::env::temp_dir());
    let d = base.join("ForgingXpCalculator");
    let _ = fs::create_dir_all(&d);
    d
}
fn settings_path() -> PathBuf {
    data_dir().join("settings.json")
}
fn bounds_path() -> PathBuf {
    data_dir().join("window.json")
}

// ---------- screen geometry ----------

#[derive(Clone, Copy, Debug)]
struct R {
    x: i32,
    y: i32,
    w: i32,
    h: i32,
}

#[cfg(windows)]
mod win {
    #[repr(C)]
    #[derive(Default, Clone, Copy)]
    pub struct RECT {
        pub left: i32,
        pub top: i32,
        pub right: i32,
        pub bottom: i32,
    }
    #[repr(C)]
    pub struct MONITORINFO {
        pub cb: u32,
        pub rc_monitor: RECT,
        pub rc_work: RECT,
        pub flags: u32,
    }
    #[repr(C)]
    #[derive(Clone, Copy)]
    pub struct POINT {
        pub x: i32,
        pub y: i32,
    }
    #[link(name = "user32")]
    extern "system" {
        pub fn MonitorFromPoint(pt: POINT, flags: u32) -> isize;
        pub fn GetMonitorInfoW(h: isize, mi: *mut MONITORINFO) -> i32;
        pub fn GetWindowLongPtrW(hwnd: isize, idx: i32) -> isize;
        pub fn SetWindowLongPtrW(hwnd: isize, idx: i32, v: isize) -> isize;
        pub fn SetLayeredWindowAttributes(hwnd: isize, key: u32, alpha: u8, flags: u32) -> i32;
    }
    pub const MONITOR_DEFAULTTONEAREST: u32 = 2;
    pub const GWL_EXSTYLE: i32 = -20;
    pub const WS_EX_LAYERED: isize = 0x0008_0000;
    pub const LWA_ALPHA: u32 = 0x2;
}

/// Work area (screen minus taskbar) of the monitor nearest to a point, in physical px.
fn work_area_near(x: i32, y: i32) -> Option<R> {
    #[cfg(windows)]
    unsafe {
        let h = win::MonitorFromPoint(win::POINT { x, y }, win::MONITOR_DEFAULTTONEAREST);
        if h == 0 {
            return None;
        }
        let mut mi = win::MONITORINFO {
            cb: std::mem::size_of::<win::MONITORINFO>() as u32,
            rc_monitor: Default::default(),
            rc_work: Default::default(),
            flags: 0,
        };
        if win::GetMonitorInfoW(h, &mut mi) == 0 {
            return None;
        }
        let r = mi.rc_work;
        return Some(R { x: r.left, y: r.top, w: r.right - r.left, h: r.bottom - r.top });
    }
    #[cfg(not(windows))]
    {
        let _ = (x, y);
        None
    }
}

fn primary_work_area(window: &Window) -> R {
    if let Some(m) = window.primary_monitor().or_else(|| window.current_monitor()) {
        let p = m.position();
        let s = m.size();
        if let Some(w) = work_area_near(p.x + s.width as i32 / 2, p.y + s.height as i32 / 2) {
            return w;
        }
        // fallback: leave room for a taskbar
        let tb = (56.0 * m.scale_factor()) as i32;
        return R { x: p.x, y: p.y, w: s.width as i32, h: s.height as i32 - tb };
    }
    R { x: 0, y: 0, w: 1920, h: 1032 }
}

/// Default bounds: comfortable size, never bigger than ~92% of the work area, centered.
fn fit_bounds(wa: R, scale: f64) -> R {
    let w = ((DEFAULT_W * scale) as i32).min((wa.w as f64 * 0.92) as i32);
    let h = ((DEFAULT_H * scale) as i32).min((wa.h as f64 * 0.90) as i32);
    R { x: wa.x + (wa.w - w) / 2, y: wa.y + (wa.h - h) / 2, w, h }
}

/// Clamp saved bounds so the whole window sits inside the work area of its monitor.
fn clamp_bounds(b: R, scale: f64) -> R {
    let cx = b.x + b.w / 2;
    let cy = b.y + b.h / 2;
    let Some(wa) = work_area_near(cx, cy) else { return b };
    let min_w = (MIN_W * scale) as i32;
    let min_h = (MIN_H * scale) as i32;
    let w = b.w.clamp(min_w.min(wa.w), wa.w);
    let h = b.h.clamp(min_h.min(wa.h), wa.h);
    let x = b.x.clamp(wa.x, wa.x + wa.w - w);
    let y = b.y.clamp(wa.y, wa.y + wa.h - h);
    R { x, y, w, h }
}

fn load_bounds() -> Option<R> {
    let s = fs::read_to_string(bounds_path()).ok()?;
    let v: serde_json::Value = serde_json::from_str(&s).ok()?;
    let g = |k: &str| v.get(k).and_then(|n| n.as_i64()).map(|n| n as i32);
    let r = R { x: g("x")?, y: g("y")?, w: g("w")?, h: g("h")? };
    if r.x < -20000 || r.y < -20000 || r.w < 200 || r.h < 200 {
        return None;
    }
    Some(r)
}

fn save_bounds(window: &Window) {
    if window.is_minimized() || window.is_maximized() {
        return;
    }
    let (Ok(pos), size) = (window.outer_position(), window.inner_size()) else { return };
    if pos.x < -20000 || pos.y < -20000 {
        return;
    }
    let j = serde_json::json!({ "x": pos.x, "y": pos.y, "w": size.width, "h": size.height });
    let _ = fs::write(bounds_path(), j.to_string());
}

fn apply_bounds(window: &Window, r: R) {
    window.set_outer_position(PhysicalPosition::new(r.x, r.y));
    window.set_inner_size(PhysicalSize::new(r.w as u32, r.h as u32));
}

fn set_opacity(window: &Window, v: f64) {
    #[cfg(windows)]
    {
        use tao::platform::windows::WindowExtWindows;
        let hwnd = window.hwnd() as isize;
        let alpha = (v.clamp(0.2, 1.0) * 255.0) as u8;
        unsafe {
            let ex = win::GetWindowLongPtrW(hwnd, win::GWL_EXSTYLE);
            if alpha >= 255 {
                // fully opaque: drop the layered style (keeps per-pixel transparency path clean)
                if ex & win::WS_EX_LAYERED != 0 {
                    win::SetLayeredWindowAttributes(hwnd, 0, 255, win::LWA_ALPHA);
                }
            } else {
                win::SetWindowLongPtrW(hwnd, win::GWL_EXSTYLE, ex | win::WS_EX_LAYERED);
                win::SetLayeredWindowAttributes(hwnd, 0, alpha, win::LWA_ALPHA);
            }
        }
    }
    #[cfg(not(windows))]
    let _ = (window, v);
}

fn page() -> String {
    HTML.replace(
        r#"<link rel="stylesheet" href="style.css">"#,
        &format!("<style>{}</style>", CSS),
    )
    .replace(
        r#"<script src="app.js"></script>"#,
        &format!("<script>{}</script>", JS.replace("</script>", "<\\/script>")),
    )
}

fn main() {
    let event_loop = EventLoopBuilder::<UserEvent>::with_user_event().build();
    let proxy: EventLoopProxy<UserEvent> = event_loop.create_proxy();

    let mut wb = WindowBuilder::new()
        .with_title("Forging XP")
        .with_decorations(false)
        .with_transparent(true)
        .with_visible(false)
        .with_resizable(true)
        .with_min_inner_size(LogicalSize::new(MIN_W, MIN_H))
        .with_inner_size(LogicalSize::new(DEFAULT_W, DEFAULT_H));
    #[cfg(windows)]
    {
        use tao::platform::windows::{IconExtWindows, WindowBuilderExtWindows};
        wb = wb.with_undecorated_shadow(false);
        if let Ok(icon) = tao::window::Icon::from_resource(1, None) {
            wb = wb.with_window_icon(Some(icon));
        }
    }
    let window = wb.build(&event_loop).expect("failed to create window");

    // ---- place the window so it always fits on screen ----
    let scale = window.scale_factor();
    let bounds = match load_bounds() {
        Some(b) => clamp_bounds(b, scale),
        None => fit_bounds(primary_work_area(&window), scale),
    };
    apply_bounds(&window, bounds);

    // ---- settings handed to the page at boot ----
    let boot = fs::read_to_string(settings_path()).unwrap_or_default();
    let boot_js = format!(
        "window.__BOOT = {};",
        serde_json::to_string(&boot).unwrap_or_else(|_| "\"\"".into())
    );

    let mut ctx = WebContext::new(Some(data_dir().join("webview")));
    let ipc_proxy = proxy.clone();
    let builder = WebViewBuilder::new_with_web_context(&mut ctx)
        .with_transparent(true)
        .with_background_color((0, 0, 0, 0))
        .with_initialization_script(&boot_js)
        .with_html(page())
        .with_devtools(cfg!(debug_assertions))
        .with_ipc_handler(move |req| {
            let _ = ipc_proxy.send_event(UserEvent::Ipc(req.body().clone()));
        });
    #[cfg(windows)]
    let builder = {
        use wry::WebViewBuilderExtWindows;
        builder
            .with_additional_browser_args("--autoplay-policy=no-user-gesture-required --disable-features=msWebOOUI,msPdfOOUI,msSmartScreenProtection")
            .with_scroll_bar_style(wry::ScrollBarStyle::Default)
    };
    let webview = match builder.build(&window) {
        Ok(w) => w,
        Err(e) => {
            #[cfg(windows)]
            unsafe {
                #[link(name = "user32")]
                extern "system" {
                    fn MessageBoxW(h: isize, t: *const u16, c: *const u16, f: u32) -> i32;
                }
                let msg: Vec<u16> = format!(
                    "Couldn't start the WebView2 runtime:\n{e}\n\nInstall Microsoft Edge WebView2 Runtime and try again."
                )
                .encode_utf16()
                .chain([0])
                .collect();
                let cap: Vec<u16> = "Forging XP".encode_utf16().chain([0]).collect();
                MessageBoxW(0, msg.as_ptr(), cap.as_ptr(), 0x10);
            }
            eprintln!("webview error: {e}");
            return;
        }
    };

    // safety net: never leave the window invisible if the page is slow
    {
        let p = proxy.clone();
        std::thread::spawn(move || {
            std::thread::sleep(Duration::from_millis(1800));
            let _ = p.send_event(UserEvent::ShowFallback);
        });
    }

    let mut shown = false;
    let mut was_max = false;

    event_loop.run(move |event, _, control_flow| {
        *control_flow = ControlFlow::Wait;
        let _ = &ctx; // keep the web context alive
        match event {
            Event::WindowEvent { event: WindowEvent::CloseRequested, .. } => {
                save_bounds(&window);
                *control_flow = ControlFlow::Exit;
            }
            Event::WindowEvent { event: WindowEvent::Resized(_), .. } => {
                let m = window.is_maximized();
                if m != was_max {
                    was_max = m;
                    let _ = webview.evaluate_script(&format!("window.__onMaximized && window.__onMaximized({m})"));
                }
            }
            Event::UserEvent(UserEvent::ShowFallback) => {
                if !shown {
                    shown = true;
                    window.set_visible(true);
                }
            }
            Event::UserEvent(UserEvent::Ipc(body)) => {
                let Ok(v) = serde_json::from_str::<serde_json::Value>(&body) else { return };
                match v.get("cmd").and_then(|c| c.as_str()).unwrap_or("") {
                    "ready" => {
                        if !shown {
                            shown = true;
                            window.set_visible(true);
                            window.set_focus();
                            // nudge so a cold WebView2 fills the frame from the first paint
                            let s = window.inner_size();
                            window.set_inner_size(PhysicalSize::new(s.width + 1, s.height));
                            window.set_inner_size(s);
                        }
                    }
                    "drag" => {
                        let _ = window.drag_window();
                    }
                    "resize" => {
                        let dir = match v.get("dir").and_then(|d| d.as_str()).unwrap_or("") {
                            "n" => ResizeDirection::North,
                            "s" => ResizeDirection::South,
                            "e" => ResizeDirection::East,
                            "w" => ResizeDirection::West,
                            "ne" => ResizeDirection::NorthEast,
                            "nw" => ResizeDirection::NorthWest,
                            "se" => ResizeDirection::SouthEast,
                            "sw" => ResizeDirection::SouthWest,
                            _ => return,
                        };
                        if !window.is_maximized() {
                            let _ = window.drag_resize_window(dir);
                        }
                    }
                    "min" => window.set_minimized(true),
                    "max" => {
                        if !window.is_maximized() {
                            save_bounds(&window);
                        }
                        window.set_maximized(!window.is_maximized());
                    }
                    "close" => {
                        save_bounds(&window);
                        *control_flow = ControlFlow::Exit;
                    }
                    "pin" => {
                        let on = v.get("value").and_then(|b| b.as_bool()).unwrap_or(false);
                        window.set_always_on_top(on);
                    }
                    "opacity" => {
                        let o = v.get("value").and_then(|b| b.as_f64()).unwrap_or(1.0);
                        set_opacity(&window, o);
                    }
                    "fit" => {
                        if window.is_maximized() {
                            window.set_maximized(false);
                        }
                        let pos = window.outer_position().unwrap_or_default();
                        let sz = window.outer_size();
                        let wa = work_area_near(pos.x + sz.width as i32 / 2, pos.y + sz.height as i32 / 2)
                            .unwrap_or_else(|| primary_work_area(&window));
                        apply_bounds(&window, fit_bounds(wa, window.scale_factor()));
                        save_bounds(&window);
                    }
                    "save" => {
                        if let Some(d) = v.get("data").and_then(|d| d.as_str()) {
                            let tmp = settings_path().with_extension("tmp");
                            if fs::write(&tmp, d).is_ok() {
                                let _ = fs::rename(&tmp, settings_path());
                            }
                        }
                    }
                    _ => {}
                }
            }
            _ => {}
        }
    });
}
