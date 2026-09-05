//! Sidecar lifecycle supervision (FID-2026-0820-009): spawn, exponential-
//! backoff crash restart, graceful stdin-watchdog shutdown, zombie-free reap.

use std::io::{self, BufRead, BufReader};
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::thread;
use std::time::{Duration, Instant};

// Windows-only: `creation_flags` on Command (see spawn_sidecar).
#[cfg(windows)]
use std::os::windows::process::CommandExt;

use crate::gateway::{SpawnSpec, GATEWAY_TOKEN_ENV};

/// Keys forwarded from `.env.local` to the sidecar process, in addition to
/// every `NEXT_PUBLIC_*` variable. The sidecar runs inference in direct-
/// provider mode, so it needs the routing + key variables below.
const SIDECAR_ENV_KEYS: &[&str] = &[
    "DIRECT_PROVIDER",
    "INFERENCE_BASE_URL",
    "OR_MASTER_KEY",
    "OPENROUTER_API_KEY",
    "INFERENCE_API_KEY",
    "SAVANT_CODE_API_KEY",
];

/// Loads env pairs from `.env.local` (repo root in dev) so the sidecar's env
/// validation passes at startup and inference routing works. Missing file
/// yields an empty set; parse errors are ignored (the sidecar reports its
/// own validation error).
pub fn sidecar_env_vars() -> Vec<(String, String)> {
    let mut vars = Vec::new();
    // Repo root is two levels above the desktop crate (dev layout); the
    // release layout ships the sidecar beside the shell, so also try the
    // exe dir and its parent.
    let mut candidates = Vec::new();
    if let Ok(cwd) = std::env::current_dir() {
        candidates.push(cwd.join(".env.local"));
        candidates.push(cwd.join("..").join(".env.local"));
        candidates.push(cwd.join("..").join("..").join(".env.local"));
    }
    let exe_dir = crate::current_exe_dir();
    candidates.push(exe_dir.join(".env.local"));
    candidates.push(
        exe_dir
            .parent()
            .map(|p| p.join(".env.local"))
            .unwrap_or_else(|| PathBuf::from(".env.local")),
    );
    for candidate in candidates {
        let Ok(contents) = std::fs::read_to_string(&candidate) else {
            continue;
        };
        for line in contents.lines() {
            let line = line.trim();
            if line.is_empty() || line.starts_with('#') {
                continue;
            }
            let Some((key, value)) = line.split_once('=') else {
                continue;
            };
            let key = key.trim();
            let forwards = key.starts_with("NEXT_PUBLIC_") || SIDECAR_ENV_KEYS.contains(&key);
            if !forwards {
                continue;
            }
            vars.push((key.to_string(), value.trim().to_string()));
        }
        if !vars.is_empty() {
            // FID-2026-0901-001 diagnostic: log which keys (never values)
            // are forwarded to the sidecar child process, so a missing
            // provider key is provable from the shell log.
            log::info!(
                target: "savant_desktop",
                "sidecar env: forwarded {} keys from {}: {:?}",
                vars.len(),
                candidate.display(),
                vars.iter().map(|(k, _)| k.as_str()).collect::<Vec<_>>()
            );
            break;
        }
    }
    vars
}

pub const BACKOFF_BASE_MS: u64 = 1_000;
pub const BACKOFF_CAP_MS: u64 = 30_000;
pub const MAX_CRASHES_PER_WINDOW: usize = 5;
pub const CRASH_WINDOW_SECS: u64 = 300;
pub const SHUTDOWN_GRACE: Duration = Duration::from_secs(3);

const SHUTDOWN_POLL: Duration = Duration::from_millis(50);

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum LifecycleState {
    Spawning,
    Ready,
    ShuttingDown,
    Dead,
}

impl LifecycleState {
    pub fn as_str(self) -> &'static str {
        match self {
            LifecycleState::Spawning => "spawning",
            LifecycleState::Ready => "ready",
            LifecycleState::ShuttingDown => "shutting-down",
            LifecycleState::Dead => "dead",
        }
    }

    /// Enforced transition validity; exercised by unit tests today and by
    /// the lifecycle loop as event surfacing expands.
    #[cfg_attr(not(test), allow(dead_code))]
    pub fn can_transition_to(self, next: LifecycleState) -> bool {
        use LifecycleState::*;
        matches!(
            (self, next),
            (Spawning, Ready)
                | (Spawning, Dead)
                | (Ready, ShuttingDown)
                | (Ready, Dead)
                | (ShuttingDown, Dead)
                | (Dead, Spawning)
        )
    }
}

/// Crash restart delay: doubling from 1s capped at 30s (missed question 1).
pub fn backoff_delay_ms(crash_index: u32) -> u64 {
    let shift = crash_index.min(31);
    BACKOFF_BASE_MS
        .saturating_mul(1u64 << shift)
        .min(BACKOFF_CAP_MS)
}

/// Give up after MAX_CRASHES_PER_WINDOW crashes inside the crash window.
pub fn should_give_up(crash_instants: &[Instant], now: Instant) -> bool {
    let window = Duration::from_secs(CRASH_WINDOW_SECS);
    let recent = crash_instants
        .iter()
        .filter(|instant| now.duration_since(**instant) <= window)
        .count();
    recent >= MAX_CRASHES_PER_WINDOW
}

#[derive(Debug)]
pub enum ShutdownOutcome {
    ExitedCleanly,
    ForcedKill,
    AlreadyGone,
}

pub struct SidecarHandle {
    child: Child,
}

impl SidecarHandle {
    pub fn pid(&self) -> u32 {
        self.child.id()
    }

    /// Non-blocking reap probe used by the watch loop.
    pub fn try_reap(&mut self) -> io::Result<Option<std::process::ExitStatus>> {
        self.child.try_wait()
    }

    /// Graceful stop. Closing stdin triggers the sidecar's stdin-watchdog —
    /// the primary cross-platform shutdown path (FID-2026-0820-008). A hard
    /// kill is only the grace-period fallback.
    pub fn graceful_shutdown(mut self) -> ShutdownOutcome {
        drop(self.child.stdin.take());
        let deadline = Instant::now() + SHUTDOWN_GRACE;
        loop {
            match self.child.try_wait() {
                Ok(Some(_status)) => return ShutdownOutcome::ExitedCleanly,
                Ok(None) => {
                    if Instant::now() >= deadline {
                        break;
                    }
                    thread::sleep(SHUTDOWN_POLL);
                }
                Err(_err) => return ShutdownOutcome::AlreadyGone,
            }
        }
        if self.child.kill().is_err() {
            return ShutdownOutcome::AlreadyGone;
        }
        let _ = self.child.wait();
        ShutdownOutcome::ForcedKill
    }
}

/// Drains one sidecar output stream into the structured log so the child can
/// never fill the OS pipe buffer and block mid-write — an unread pipe turns
/// the sidecar into a wedged-not-dead process that no watchdog recovers.
fn spawn_stream_drain(label: &'static str, stream: impl io::Read + Send + 'static) {
    thread::spawn(move || {
        let mut reader = BufReader::new(stream);
        let mut line = String::new();
        loop {
            line.clear();
            match reader.read_line(&mut line) {
                Ok(0) | Err(_) => break,
                Ok(_) => {
                    log::debug!(target: "savant_sidecar", "{label}: {}", line.trim_end());
                }
            }
        }
    });
}

pub fn spawn_sidecar(spec: &SpawnSpec) -> io::Result<SidecarHandle> {
    let mut command = Command::new(&spec.program);
    command
        .args(&spec.args)
        .env(GATEWAY_TOKEN_ENV, &spec.token)
        .envs(sidecar_env_vars())
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    // FID-2026-0820-011 installer-smoke find: release builds are GUI-subsystem
    // (main.rs `windows_subsystem = "windows"`), so a Windows console-subsystem
    // child would otherwise get its OWN visible console — the blank
    // `savant-sidecar.exe` window seen during the smoke. CREATE_NO_WINDOW (0x0800_0000)
    // suppresses it. Debug builds inherit the dev console and keep it for
    // direct log visibility.
    #[cfg(windows)]
    if !cfg!(debug_assertions) {
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        command.creation_flags(CREATE_NO_WINDOW);
    }

    let mut child = command.spawn()?;
    // Both output streams MUST be drained for the child's lifetime.
    if let Some(stdout) = child.stdout.take() {
        spawn_stream_drain("stdout", stdout);
    }
    if let Some(stderr) = child.stderr.take() {
        spawn_stream_drain("stderr", stderr);
    }
    Ok(SidecarHandle { child })
}

/// Resolves the sidecar binary next to the running shell executable using the
/// Tauri externalBin convention (triple-suffixed), falling back to the plain
/// native name for unrenamed dev builds.
pub fn resolve_sidecar_path(exe_dir: &Path, base_name: &str, triple: &str) -> Option<PathBuf> {
    let stripped = base_name.strip_suffix(".exe").unwrap_or(base_name);
    let native_ext = if cfg!(windows) { ".exe" } else { "" };
    let mut candidates = Vec::new();
    if !triple.is_empty() {
        candidates.push(exe_dir.join(format!("{stripped}-{triple}{native_ext}")));
    }
    candidates.push(exe_dir.join(format!("{stripped}{native_ext}")));
    candidates.into_iter().find(|candidate| candidate.is_file())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn lifecycle_transitions_follow_the_state_machine() {
        use LifecycleState::*;
        assert!(Spawning.can_transition_to(Ready));
        assert!(Spawning.can_transition_to(Dead));
        assert!(Ready.can_transition_to(ShuttingDown));
        assert!(Ready.can_transition_to(Dead));
        assert!(ShuttingDown.can_transition_to(Dead));
        assert!(Dead.can_transition_to(Spawning));
        assert!(!Ready.can_transition_to(Spawning));
        assert!(!Dead.can_transition_to(Ready));
        assert!(!ShuttingDown.can_transition_to(Ready));
        assert_eq!(LifecycleState::Ready.as_str(), "ready");
    }

    #[test]
    fn backoff_doubles_then_caps_at_thirty_seconds() {
        assert_eq!(backoff_delay_ms(0), 1_000);
        assert_eq!(backoff_delay_ms(1), 2_000);
        assert_eq!(backoff_delay_ms(2), 4_000);
        assert_eq!(backoff_delay_ms(3), 8_000);
        assert_eq!(backoff_delay_ms(4), 16_000);
        assert_eq!(backoff_delay_ms(5), 30_000);
        assert_eq!(backoff_delay_ms(40), 30_000);
    }

    #[test]
    fn give_up_trips_only_on_five_recent_crashes() {
        let now = Instant::now();
        let stale = now - Duration::from_secs(CRASH_WINDOW_SECS + 60);
        assert!(!should_give_up(&[now; 4], now));
        assert!(should_give_up(&[now; 5], now));
        assert!(!should_give_up(&[stale; 4], now));
        assert!(!should_give_up(&[stale, stale, stale, stale, now], now));
    }

    #[cfg(windows)]
    fn trivial_spec(token: &str) -> SpawnSpec {
        SpawnSpec {
            program: PathBuf::from("cmd"),
            args: vec![String::from("/C"), String::from("exit 0")],
            token: token.to_string(),
        }
    }

    #[cfg(not(windows))]
    fn trivial_spec(token: &str) -> SpawnSpec {
        SpawnSpec {
            program: PathBuf::from("sh"),
            args: vec![String::from("-c"), String::from("true")],
            token: token.to_string(),
        }
    }

    #[test]
    fn spawned_child_reaps_to_a_clean_exit() {
        let mut handle =
            spawn_sidecar(&trivial_spec("watchdog-test")).expect("trivial child spawns");
        let deadline = Instant::now() + Duration::from_secs(10);
        loop {
            match handle.try_reap().expect("reap probe succeeds") {
                Some(status) => {
                    assert!(status.success());
                    break;
                }
                None => {
                    assert!(Instant::now() < deadline, "child never exited");
                    thread::sleep(SHUTDOWN_POLL);
                }
            }
        }
    }

    #[test]
    fn graceful_shutdown_reports_a_clean_exit_for_short_children() {
        let handle = spawn_sidecar(&trivial_spec("shutdown-test")).expect("child spawns");
        thread::sleep(Duration::from_millis(200));
        match handle.graceful_shutdown() {
            ShutdownOutcome::ExitedCleanly | ShutdownOutcome::AlreadyGone => {}
            outcome => panic!("unexpected shutdown outcome: {outcome:?}"),
        }
    }
}
