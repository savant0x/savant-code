//! Pre-webview runtime gate (FID-2026-0820-009 missed question 7): on
//! Windows, detect the WebView2 Evergreen Runtime BEFORE any Tauri builder
//! work runs, so a machine without it receives a native recovery dialog plus
//! the official download link instead of a silent blank window. The dialog is
//! shown via `rfd` directly because the gate fires pre-builder, where no
//! AppHandle exists for the dialog plugin's Rust API. Non-Windows shells ship
//! their engine with the OS (WKWebView) or via distro packages (WebKitGTK),
//! so the gate passes through unchanged there.

#[cfg(windows)]
mod platform {
    use std::process;

    use rfd::{MessageButtons, MessageDialog, MessageDialogResult, MessageLevel};
    use winreg::enums::{
        HKEY_CURRENT_USER, HKEY_LOCAL_MACHINE, KEY_READ, KEY_WOW64_32KEY, KEY_WOW64_64KEY,
    };
    use winreg::RegKey;

    /// Microsoft-documented EdgeUpdate clients subkey carrying the WebView2
    /// Evergreen Runtime install state (`pv` value) for the fixed client id.
    const CLIENTS_SUBKEY: &str =
        "Software\\Microsoft\\EdgeUpdate\\Clients\\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}";

    /// Official Evergreen Bootstrapper page offered by the recovery dialog.
    const WEBVIEW2_DOWNLOAD_URL: &str = "https://go.microsoft.com/fwlink/p/?LinkId=2124703";

    /// The documented sentinel states "registry entry exists but no usable
    /// runtime": an empty or all-zero `pv` never counts as installed.
    fn is_installed_version(value: &str) -> bool {
        !value.is_empty() && value != "0.0.0.0"
    }

    /// Probes the documented EdgeUpdate locations in priority order: the
    /// 64-bit HKLM view, the 32-bit HKLM view (the classic WOW6432Node home),
    /// then the per-user HKCU install. First non-sentinel `pv` wins.
    fn installed_runtime_version() -> Option<String> {
        let probes = [
            (HKEY_LOCAL_MACHINE, KEY_READ | KEY_WOW64_64KEY),
            (HKEY_LOCAL_MACHINE, KEY_READ | KEY_WOW64_32KEY),
            (HKEY_CURRENT_USER, KEY_READ),
        ];
        probes.into_iter().find_map(|(hive, access)| {
            RegKey::predef(hive)
                .open_subkey_with_flags(CLIENTS_SUBKEY, access)
                .ok()
                .and_then(|client| client.get_value::<String, _>("pv").ok())
                .filter(|version| is_installed_version(version))
        })
    }

    fn missing_message() -> String {
        format!(
            "Savant Desktop needs the Microsoft Edge WebView2 Runtime, which \
             is not installed on this machine.\n\nDownload it from:\n{}\n\n\
             Open the download page now?",
            WEBVIEW2_DOWNLOAD_URL
        )
    }

    /// Blocks until the operator answers, optionally opens the download page,
    /// then exits non-zero: without the runtime no window can ever render.
    pub fn ensure_runtime_or_exit() {
        if installed_runtime_version().is_some() {
            return;
        }
        eprintln!(
            "WebView2 Runtime not found — showing recovery dialog (download: {})",
            WEBVIEW2_DOWNLOAD_URL
        );
        let open_page_now = MessageDialog::new()
            .set_title("Savant — missing component")
            .set_level(MessageLevel::Warning)
            .set_buttons(MessageButtons::YesNo)
            .set_description(missing_message())
            .show();
        if open_page_now == MessageDialogResult::Yes {
            let _opened = open::that(WEBVIEW2_DOWNLOAD_URL);
        }
        process::exit(1);
    }

    #[cfg(test)]
    mod tests {
        use super::*;

        #[test]
        fn sentinel_versions_are_not_a_runtime() {
            assert!(is_installed_version("121.33.51.10"));
            assert!(!is_installed_version(""));
            assert!(!is_installed_version("0.0.0.0"));
        }

        #[test]
        fn clients_subkey_targets_the_documented_client_id() {
            assert!(CLIENTS_SUBKEY.starts_with("Software\\Microsoft\\EdgeUpdate\\Clients\\"));
            assert!(CLIENTS_SUBKEY.ends_with("{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}"));
        }

        #[test]
        fn recovery_message_offers_the_official_download_page() {
            let message = missing_message();
            assert!(message.contains("WebView2"));
            assert!(message.contains(WEBVIEW2_DOWNLOAD_URL));
            assert!(message.ends_with("Open the download page now?"));
        }
    }
}

#[cfg(not(windows))]
mod platform {
    /// WKWebView ships with macOS and WebKitGTK arrives via distro packages,
    /// so there is no pre-JS engine gap to guard on these platforms
    /// (missed-question 7 scope: Windows WebView2 only).
    pub fn ensure_runtime_or_exit() {}
}

pub use platform::ensure_runtime_or_exit;
