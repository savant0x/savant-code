//! Gateway handshake constants and sidecar spawn-spec construction.
//!
//! Encodes the frozen FID-2026-0820-008 handshake contract (JSON-RPC 2.0,
//! hello/protocolVersion, reserved application error codes) so the shell and
//! the gateway agree without importing each other.

use std::net::TcpListener;
use std::path::{Path, PathBuf};

/// ENV key carrying the gateway bearer token to the sidecar. ENV-only by
/// contract: never argv, never disk, never logs (FID-2026-0820-008).
pub const GATEWAY_TOKEN_ENV: &str = "SAVANT_GATEWAY_TOKEN";

// Frozen-contract surface: consumed by unit tests today and by the gateway
// integration when FID-2026-0820-008 lands; dormant until then.
/// Frozen handshake major version (FID-2026-0820-008).
#[cfg_attr(not(test), allow(dead_code))]
pub const GATEWAY_PROTOCOL_VERSION: i64 = 1;

/// Reserved application error codes (FID-2026-0820-008).
#[cfg_attr(not(test), allow(dead_code))]
pub const ERR_UNAUTHORIZED: i64 = -32001;
#[cfg_attr(not(test), allow(dead_code))]
pub const ERR_ORIGIN_REJECTED: i64 = -32002;
#[cfg_attr(not(test), allow(dead_code))]
pub const ERR_UNSUPPORTED_PROTOCOL_VERSION: i64 = -32003;
#[cfg_attr(not(test), allow(dead_code))]
pub const ERR_SESSION_BUSY: i64 = -32004;

const TOKEN_BYTES: usize = 32;

#[derive(Debug, Clone)]
pub struct SpawnSpec {
    pub program: PathBuf,
    pub args: Vec<String>,
    pub token: String,
}

pub fn generate_gateway_token() -> Result<String, getrandom::Error> {
    let mut bytes = [0u8; TOKEN_BYTES];
    getrandom::fill(&mut bytes)?;
    Ok(base64_url_nopad(&bytes))
}

fn base64_url_nopad(data: &[u8]) -> String {
    const ALPHABET: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
    let mut encoded = String::with_capacity(data.len().div_ceil(3) * 4);
    for chunk in data.chunks(3) {
        let b0 = u32::from(chunk[0]);
        let b1 = u32::from(chunk.get(1).copied().unwrap_or(0));
        let b2 = u32::from(chunk.get(2).copied().unwrap_or(0));
        let group = (b0 << 16) | (b1 << 8) | b2;
        encoded.push(ALPHABET[(group >> 18) as usize & 0x3f] as char);
        encoded.push(ALPHABET[(group >> 12) as usize & 0x3f] as char);
        if chunk.len() > 1 {
            encoded.push(ALPHABET[(group >> 6) as usize & 0x3f] as char);
        }
        if chunk.len() > 2 {
            encoded.push(ALPHABET[group as usize & 0x3f] as char);
        }
    }
    encoded
}

/// Binds loopback :0, reads the assigned port, then releases the listener.
/// The tiny bind/handoff window is standard practice; if another process
/// claims the port first, the sidecar's own bind failure surfaces through
/// the normal crash/restart ladder rather than silently misrouting.
pub fn allocate_ephemeral_port() -> std::io::Result<u16> {
    let listener = TcpListener::bind(("127.0.0.1", 0))?;
    let port = listener.local_addr()?.port();
    drop(listener);
    Ok(port)
}

pub fn build_spawn_spec(sidecar: &Path, port: u16, token: &str) -> SpawnSpec {
    SpawnSpec {
        program: sidecar.to_path_buf(),
        // The ephemeral port rides argv (it is not secret); the token never does.
        args: vec![format!("--port={port}")],
        token: token.to_string(),
    }
}

/// Security invariant probe; enforced by unit tests and reusable by debug
/// assertions once more of the spawn wiring consumes it.
#[cfg_attr(not(test), allow(dead_code))]
pub fn token_is_exposed_on_argv(spec: &SpawnSpec) -> bool {
    spec.program.to_string_lossy().contains(&spec.token)
        || spec.args.iter().any(|arg| arg.contains(&spec.token))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reserved_error_codes_match_the_frozen_contract() {
        assert_eq!(GATEWAY_PROTOCOL_VERSION, 1);
        assert_eq!(ERR_UNAUTHORIZED, -32001);
        assert_eq!(ERR_ORIGIN_REJECTED, -32002);
        assert_eq!(ERR_UNSUPPORTED_PROTOCOL_VERSION, -32003);
        assert_eq!(ERR_SESSION_BUSY, -32004);
    }

    #[test]
    fn generated_tokens_are_long_unique_and_url_safe() {
        let first = generate_gateway_token().expect("token generation succeeds");
        let second = generate_gateway_token().expect("token generation succeeds");
        assert_eq!(first.len(), 43); // 32 bytes -> 10 full groups + one 3-char tail
        assert_ne!(first, second);
        assert!(
            first
                .chars()
                .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_'),
            "token charset must stay URL-safe: {first}"
        );
    }

    #[test]
    fn base64_encoding_matches_rfc4648_vectors() {
        assert_eq!(base64_url_nopad(b""), "");
        assert_eq!(base64_url_nopad(b"f"), "Zg");
        assert_eq!(base64_url_nopad(b"fo"), "Zm8");
        assert_eq!(base64_url_nopad(b"foo"), "Zm9v");
    }

    #[test]
    fn spawn_spec_keeps_token_off_argv() {
        let spec = build_spawn_spec(
            Path::new("/opt/binaries/savant-sidecar"),
            5100,
            "sekret-token",
        );
        assert_eq!(spec.args, vec![String::from("--port=5100")]);
        assert!(!token_is_exposed_on_argv(&spec));
    }

    #[test]
    fn exposure_detector_flags_a_leaked_token() {
        let spec = SpawnSpec {
            program: PathBuf::from("sidecar"),
            args: vec![String::from("--port=1"), String::from("--token=sekret")],
            token: String::from("sekret"),
        };
        assert!(token_is_exposed_on_argv(&spec));
    }

    #[test]
    fn ephemeral_port_allocation_returns_nonzero_ports() {
        let port = allocate_ephemeral_port().expect("loopback bind succeeds");
        assert!(port > 0);
    }
}
