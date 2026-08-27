//! Tauri shell wiring (FID-2026-0820-009): plugins, gateway state, IPC, and
//! the background supervision loop driving `gateway-lifecycle` events.

mod gateway;
mod supervisor;
pub mod webview_check;

use std::path::{Path, PathBuf};
use std::sync::{Mutex, MutexGuard};
use std::thread;
use std::time::{Duration, Instant};

use log::{info, warn};
use tauri::{AppHandle, Emitter, Manager, RunEvent, State};
use tauri_plugin_log::RotationStrategy;

use crate::gateway::{allocate_ephemeral_port, build_spawn_spec, generate_gateway_token};
use crate::supervisor::{
    backoff_delay_ms, resolve_sidecar_path, should_give_up, spawn_sidecar, LifecycleState,
    SidecarHandle, CRASH_WINDOW_SECS, MAX_CRASHES_PER_WINDOW,
};

const MAIN_WINDOW_LABEL: &str = "main";
const LIFECYCLE_EVENT: &str = "gateway-lifecycle";
const SIDECAR_BASE_NAME: &str = "savant-sidecar";
const WATCH_POLL: Duration = Duration::from_millis(200);

struct GatewayConfig {
    port: u16,
    token: String,
}

impl GatewayConfig {
    fn payload(&self) -> GatewayConfigPayload {
        GatewayConfigPayload {
            port: self.port,
            token: self.token.clone(),
        }
    }
}

struct GatewayState {
    inner: Mutex<Option<GatewayConfig>>,
}

struct SidecarSlot(Mutex<Option<SidecarHandle>>);

#[derive(Clone, serde::Serialize)]
struct GatewayConfigPayload {
    port: u16,
    token: String,
}

#[derive(Clone, serde::Serialize)]
struct LifecyclePayload {
    state: &'static str,
    detail: Option<String>,
}

enum WatchEnd {
    ExitedCleanly,
    Failed,
    ShutdownRequested,
}

fn lock_slot<T>(slot: &Mutex<T>) -> MutexGuard<'_, T> {
    // A panicked holder must not wedge the whole shell; recover and continue.
    slot.lock().unwrap_or_else(|poisoned| poisoned.into_inner())
}

fn sidecar_slot(app: &AppHandle) -> MutexGuard<'_, Option<SidecarHandle>> {
    // inner() hands back the &'r SidecarSlot behind the State wrapper, so the
    // returned guard's lifetime roots in `app`, not in a local binding.
    let slot: &SidecarSlot = app.state::<SidecarSlot>().inner();
    lock_slot(&slot.0)
}

fn emit_lifecycle(app: &AppHandle, state: LifecycleState, detail: Option<String>) {
    let payload = LifecyclePayload {
        state: state.as_str(),
        detail,
    };
    if let Err(err) = app.emit(LIFECYCLE_EVENT, payload) {
        warn!("lifecycle event dropped before any listener existed: {err}");
    }
}

fn record_crash(crash_instants: &mut Vec<Instant>, at: Instant) {
    crash_instants.push(at);
    let window = Duration::from_secs(CRASH_WINDOW_SECS);
    crash_instants.retain(|instant| at.duration_since(*instant) <= window);
}

fn schedule_restart(crash_instants: &[Instant]) -> bool {
    if should_give_up(crash_instants, Instant::now()) {
        return false;
    }
    let index = u32::try_from(crash_instants.len().saturating_sub(1)).unwrap_or(0);
    thread::sleep(Duration::from_millis(backoff_delay_ms(index)));
    true
}

fn current_exe_dir() -> PathBuf {
    std::env::current_exe()
        .ok()
        .and_then(|exe| exe.parent().map(Path::to_path_buf))
        .unwrap_or_else(|| PathBuf::from("."))
}

fn watch_child(app: &AppHandle) -> WatchEnd {
    loop {
        {
            let mut guard = sidecar_slot(app);
            match guard.as_mut() {
                None => return WatchEnd::ShutdownRequested,
                Some(handle) => match handle.try_reap() {
                    Err(err) => {
                        warn!("sidecar reap failed: {err}");
                        return WatchEnd::Failed;
                    }
                    Ok(Some(status)) => {
                        return if status.success() {
                            WatchEnd::ExitedCleanly
                        } else {
                            WatchEnd::Failed
                        };
                    }
                    Ok(None) => {}
                },
            }
        }
        thread::sleep(WATCH_POLL);
    }
}

fn supervise_until_dead(app: AppHandle, port: u16, token: String) {
    let exe_dir = current_exe_dir();
    let triple = env!("SIDECAR_TARGET_TRIPLE");
    let Some(sidecar_path) = resolve_sidecar_path(&exe_dir, SIDECAR_BASE_NAME, triple) else {
        warn!(
            "sidecar binary not found beside {}; build it with 'bun run --cwd=desktop build:sidecar'",
            exe_dir.display()
        );
        emit_lifecycle(
            &app,
            LifecycleState::Dead,
            Some(format!(
                "sidecar binary missing beside {} — the gateway entrypoint ships with FID-2026-0820-008",
                exe_dir.display()
            )),
        );
        return;
    };

    let mut crash_instants: Vec<Instant> = Vec::new();
    loop {
        emit_lifecycle(&app, LifecycleState::Spawning, None);
        let spec = build_spawn_spec(&sidecar_path, port, &token);
        match spawn_sidecar(&spec) {
            Err(err) => {
                warn!("sidecar spawn failed: {err}");
                record_crash(&mut crash_instants, Instant::now());
                if !schedule_restart(&crash_instants) {
                    emit_lifecycle(
                        &app,
                        LifecycleState::Dead,
                        Some(String::from("spawn-failure loop exceeded the crash budget")),
                    );
                    return;
                }
            }
            Ok(handle) => {
                info!("sidecar spawned (pid {})", handle.pid());
                *sidecar_slot(&app) = Some(handle);
                emit_lifecycle(&app, LifecycleState::Ready, None);
                match watch_child(&app) {
                    WatchEnd::ShutdownRequested => {
                        emit_lifecycle(&app, LifecycleState::ShuttingDown, None);
                        if let Some(handle) = sidecar_slot(&app).take() {
                            let outcome = handle.graceful_shutdown();
                            info!("sidecar stopped: {outcome:?}");
                        }
                        emit_lifecycle(
                            &app,
                            LifecycleState::Dead,
                            Some(String::from("shell shutdown")),
                        );
                        return;
                    }
                    WatchEnd::ExitedCleanly => {
                        // A clean exit is a deliberate quit — never restarted
                        // (FID-2026-0820-009 missed question 1).
                        *sidecar_slot(&app) = None;
                        emit_lifecycle(
                            &app,
                            LifecycleState::Dead,
                            Some(String::from(
                                "sidecar exited cleanly; restart suppressed by design",
                            )),
                        );
                        return;
                    }
                    WatchEnd::Failed => {
                        *sidecar_slot(&app) = None;
                        record_crash(&mut crash_instants, Instant::now());
                        warn!("sidecar crashed ({} in window)", crash_instants.len());
                        if !schedule_restart(&crash_instants) {
                            emit_lifecycle(
                                &app,
                                LifecycleState::Dead,
                                Some(format!(
                                    "crash loop exceeded the budget ({} crashes / {}s)",
                                    MAX_CRASHES_PER_WINDOW, CRASH_WINDOW_SECS
                                )),
                            );
                            return;
                        }
                    }
                }
            }
        }
    }
}

#[tauri::command]
fn get_gateway_config(state: State<'_, GatewayState>) -> Result<GatewayConfigPayload, String> {
    let guard = lock_slot(&state.inner);
    match guard.as_ref() {
        Some(config) => Ok(config.payload()),
        None => Err(String::from("gateway configuration is not ready yet")),
    }
}

fn shutdown_sidecar(app: &AppHandle) {
    if let Some(handle) = sidecar_slot(app).take() {
        let outcome = handle.graceful_shutdown();
        info!("sidecar stopped during exit: {outcome:?}");
    }
}

pub fn run() {
    tauri::Builder::default()
        .plugin(
            tauri_plugin_log::Builder::new()
                .rotation_strategy(RotationStrategy::KeepAll)
                .build(),
        )
        .plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
            if let Some(window) = app.get_webview_window(MAIN_WINDOW_LABEL) {
                let _focused = window.set_focus();
            }
        }))
        // Consent-gated updater (FID-2026-0820-011 Step 4): the check itself
        // is driven from the webview so consent UX stays entirely in our UI;
        // signature verification is enforced by this plugin against the
        // pubkey pinned in tauri.conf.json. Invalid signatures abort and
        // keep the running version — never auto-relaunch (missed-Q9).
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(GatewayState {
            inner: Mutex::new(None),
        })
        .manage(SidecarSlot(Mutex::new(None)))
        .invoke_handler(tauri::generate_handler![get_gateway_config])
        .setup(|app| {
            // Branding: compose the native window title from the crate
            // version so releases bump the root VERSION file once and every
            // surface follows (FID-2026-0824-032 audit condition; the
            // sync-version script keeps Cargo.toml fed from VERSION).
            if let Some(window) = app.get_webview_window(MAIN_WINDOW_LABEL) {
                let _ = window.set_title(&format!("Savant Code v{}", env!("CARGO_PKG_VERSION")));
            }
            let port = allocate_ephemeral_port()?;
            // getrandom::Error does not implement StdError, so `?` cannot
            // convert it into the boxed-error type; stringify explicitly.
            let token = generate_gateway_token().map_err(|err| err.to_string())?;
            *lock_slot(&app.state::<GatewayState>().inner) = Some(GatewayConfig {
                port,
                token: token.clone(),
            });
            let handle = app.handle().clone();
            std::thread::spawn(move || supervise_until_dead(handle, port, token));
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("failed to build the Savant desktop shell")
        .run(|app, event| {
            if let RunEvent::ExitRequested { .. } = event {
                shutdown_sidecar(app);
            }
        });
}
