#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

//! Savant desktop shell entrypoint (FID-2026-0820-009).

fn main() {
    // Missed-question 7 gate: a machine without the WebView2 runtime gets a
    // native recovery dialog BEFORE any webview or JS exists to render one.
    savant_desktop_lib::webview_check::ensure_runtime_or_exit();
    savant_desktop_lib::run()
}
