---
name: minisign-pubkey-vs-secret-key
description: Decode the base64 comment line to pick the shareable key
version: 0.1.0
metadata:
    origin: agent
---

# Minisign Keypairs: Only the .pub Is Shareable

`tauri signer generate -w <path>` writes the password-ENCRYPTED SECRET key to `<path>` and prints/writes the PUBLIC key separately at `<path>.pub`. Both are base64 blobs starting `dW50cnVzdGVkIGNvbW1lbnQ6...` — indistinguishable at a glance.

Decode the comment line before trusting which one you hold:

- `untrusted comment: rsign encrypted secret key` → PRIVATE — never paste, never commit; escrow per procedure (password manager + offline backup).
- `untrusted comment: minisign public key: <HEXID>` → shareable; this is the value that goes INLINE in Tauri `plugins.updater.pubkey`.

Evidence: 2026-08-26 session near-miss — the encrypted secret was pasted into chat; caught by decoding the comment line BEFORE any use. If a secret ever does leak, rotate via a bridge release trusting a new pubkey (never improvise mid-incident).
