fn main() {
    // Capture the Rust target triple at build time so runtime code can resolve
    // the triple-suffixed externalBin sidecar (FID-2026-0820-009 Step 2).
    let arch = std::env::var("CARGO_CFG_TARGET_ARCH").unwrap_or_default();
    let os = std::env::var("CARGO_CFG_TARGET_OS").unwrap_or_default();
    let triple = match (arch.as_str(), os.as_str()) {
        ("x86_64", "windows") => "x86_64-pc-windows-msvc".to_string(),
        ("aarch64", "macos") => "aarch64-apple-darwin".to_string(),
        ("x86_64", "linux") => "x86_64-unknown-linux-gnu".to_string(),
        _ => format!("{arch}-{os}"),
    };
    println!("cargo:rustc-env=SIDECAR_TARGET_TRIPLE={triple}");
    tauri_build::build()
}
