# Savant-Code for Windows dev setup

Welcome!

For development, we have a shared windows machine, via shadow.tech.

## Accessing the machine

You can access the machine either from the browser or with the desktop app:

1. Shadow.tech Web viewer:

- Go to https://pc.shadow.tech/home

2. Shadow.tech desktop app:

- They claim its better, idk.
- https://shadow.tech/download/

Supposedly you can also use Window's Remote Desktop to access the machine instead, but I've not tried it.
Shadow.tech claims their protocol is better optimized for lower bandwidth use & hence smoother performance.

## Verified behaviour

Every command and message in this file was checked against the source, not
recalled (2026-10-16): the bash requirement and
`SAVANT_CODE_GIT_BASH_PATH` (`sdk/src/tools/windows-bash.ts:18`, `:30`, `:89`),
the release-metadata failure (`cli/release-core/launcher.js:1150`), the update
message (`:1236`, `:1278`), and proxied release downloads
(`HTTPS_PROXY`, exercised by `cli/src/__tests__/release/proxy-http-get-https.test.ts`).

The `Issue #NNN` links below point at the canonical repository
(`github.com/savant0x/savant-code`) and were **not** re-checked in this pass —
treat the issue numbers as unverified.

## Set-up guide:

You shouldn't need this - but just in case you stop using Shadow.tech, or make a new account, here's a guide on how
to get from a blank Windows install to a Savant-Code install.

Surprisingly: most guides in fact recommend running everything in an Admin PowerShell, contra to advice to not use
sudo on eg: Linux/macOS.

- Install Choco: Open PowerShell as Admin, and run the command from https://chocolatey.org/install
- Install NVM: Restart PowerShell (still as Admin) and run `choco install nvm -y`
- Install Node: Restart PowerShell (still as Admin) and run `nvm install node`
- Install Savant-Code: Run `npm i -g savant-code`

---

## Common Windows Issues & Troubleshooting

Running into problems? Here are solutions to the most common Windows-specific issues.

### Issue: "Failed to determine latest version" or release metadata on First Run

**Symptom**:
```powershell
PS C:\> savant-code
❌ Failed to determine latest version
Please check your internet connection and try again
```

**Cause**:
Some release wrappers or older installations may check public release metadata during startup. This can fail when:

- Corporate firewall blocks `github.com`
- Proxy settings not configured
- Network connectivity issues
- VPN required for external access

**Solutions**:

1. **Set the `HTTPS_PROXY` environment variable** (if behind corporate proxy or a restricted network):

   Savant-Code natively supports proxy environment variables. This is the recommended fix:

   **PowerShell:**
   ```powershell
   $env:HTTPS_PROXY = "http://your-proxy-server:port"
   savant-code
   ```

   **CMD:**
   ```cmd
   set HTTPS_PROXY=http://your-proxy-server:port
   savant-code
   ```

   To make it permanent, add `HTTPS_PROXY` to your Windows System Environment Variables (Settings → System →
   Advanced → Environment Variables).

2. **Verify network access**:
   ```powershell
   curl https://registry.npmjs.org/savant-code/latest
   ```
   If this fails, you have a network/firewall issue.

3. **Configure npm proxy** (for the `npm install` step only):
   ```powershell
   npm config set proxy http://your-proxy-server:port
   npm config set https-proxy http://your-proxy-server:port
   ```
   Note: This only helps with `npm install`. Savant-Code's own downloads use `HTTPS_PROXY` instead.

4. **Disable VPN temporarily** or whitelist `registry.npmjs.org` and `savant-code.com` in your firewall

5. **Clear npm cache and reinstall**:
   ```powershell
   npm cache clean --force
   npm uninstall -g savant-code
   npm install -g savant-code
   ```

**Reference**: Issue [#294](https://github.com/savant0x/savant-code/issues/294)

---

### Issue: "Bash is required but was not found" Error

**Symptom**:
```text
Bash is required but was not found on this Windows system.
```

**Cause**:
Savant-Code requires bash for command execution. This error appears when:

- Git for Windows is not installed
- You're not running inside WSL
- bash.exe is not in your PATH

**Solutions**:

1. **Install Git for Windows** (recommended):
   - Download from https://git-scm.com/download/win
   - This installs `bash.exe` which Savant-Code will automatically detect
   - Works in PowerShell, CMD, or Git Bash terminals

2. **Use WSL (Windows Subsystem for Linux)**:
   - Provides full Linux environment with native bash
   - Install: `wsl --install` in PowerShell (Admin)
   - Run savant-code inside WSL for best compatibility

3. **Set custom bash path** (advanced):
   - If bash.exe is installed in a non-standard location:
   ```powershell
   set SAVANT_CODE_GIT_BASH_PATH=C:\path\to\bash.exe
   ```

**Reference**: Issue [#274](https://github.com/savant0x/savant-code/issues/274)

---

### Issue: Git Commands Fail on Windows

**Symptom**:
Git operations (commit, rebase, complex commands) fail with syntax errors or unexpected behavior.

**Cause**:
Complex git commands may have issues with Windows path handling or shell escaping.

**Solutions**:

1. **Ensure Git for Windows is installed**:
   - Download from https://git-scm.com/download/win
   - Savant-Code uses bash.exe from Git for Windows for command execution

2. **Use WSL for complex operations**:
   - Provides full Linux environment with native bash
   - Install: `wsl --install` in PowerShell (Admin)
   - Run savant-code inside WSL for best compatibility

**Reference**: Issue [#274](https://github.com/savant0x/savant-code/issues/274)

---

### Message: "Update available: unknown → [version]"

**What it means**:
This is **not an error** - it's an informational message indicating:

- Your local binary needs to be downloaded/updated
- `unknown` is the placeholder the launcher prints when it cannot read the
  installed version (`cli/release-core/launcher.js` — the same message prints
  your real version when it can), not an error state
- Savant-Code will automatically download the correct version

**What to do**:

- Wait for the download to complete: "Download complete! Starting Savant-Code..."
- If download fails, check your internet connection
- If it persists, try the solutions in "Failed to determine latest version" above

This section previously said the placeholder reads `error`, which the launcher
never prints (verified 2026-10-16 against `cli/release-core/launcher.js:1236`,
`:1278`).

---

### Still Having Issues?

If these solutions don't resolve your problem:

1. **Search existing issues**: https://github.com/savant0x/savant-code/issues
2. **Open a new issue**: https://github.com/savant0x/savant-code/issues/new
3. **Join Discord community**: https://savant-code.com/discord

When reporting issues, please include:

- Windows version: `winver` command
- PowerShell/Git Bash/CMD
- Node version: `node --version`
- Full error message
- Steps to reproduce
