---
name: minisign-pubkey-vs-secret-key
description: Decode the base64 comment line to pick the shareable key
version: 0.1.1
metadata:
    origin: agent
---

# Minisign Keypairs: Only the .pub Is Shareable

## When to Use

Before sharing, committing, or pasting a Tauri/minisign signing key — and
whenever a key blob has to be classified as secret or shareable.

`tauri signer generate -w <path>` writes the password-ENCRYPTED SECRET key to
`<path>` and prints/writes the PUBLIC key separately at `<path>.pub`. Both are
base64 blobs starting `dW50cnVzdGVkIGNvbW1lbnQ6...` — indistinguishable at a
glance. Treating the wrong one as shareable leaks a signing key.

## Procedure

Decode the comment line before trusting which one you hold:

- `untrusted comment: rsign encrypted secret key` → PRIVATE — never paste,
  never commit; escrow per procedure (password manager + offline backup).
- `untrusted comment: minisign public key: <HEXID>` → shareable; this is the
  value that goes INLINE in Tauri `plugins.updater.pubkey`.

## Pitfalls

- Choosing by file extension. The secret is the base file; the `.pub` sibling is
  the shareable one — the extension is the only reliable hint, the bytes are not.
- Decoding *after* the key has been used. The decode must precede any use.
- Improvising a rotation mid-incident. Rotate via a bridge release that trusts a
  new pubkey, in order.

## Verification

Decode the blob and read its first line before the key is used anywhere. A
shareable key's first line reads `untrusted comment: minisign public key:
<HEXID>`. Anything reading `untrusted comment: rsign encrypted secret key` is
the private key — stop, and rotate via a bridge release if it was ever pasted or
committed.

Evidence: 2026-08-26 session near-miss — the encrypted secret was pasted into
chat; caught by decoding the comment line BEFORE any use.
