# Volux Makefile - Command Reference

Complete guide to all available `make` commands for the Volux project.

---

## 🚀 Quick Start

```bash
# Build everything
make

# Verify it's clean for Chrome Store
make submit-check

# Create submission package
make package

# Start development environment
make dev
```

---

## 📦 Build Commands

### `make` (default)
Build both Chrome and Firefox extensions.
```bash
make
```
**What it does:**
- Cleans dist folder
- Builds Chrome extension → `dist/chrome/`
- Builds Firefox extension → `dist/firefox/`
- Strips affiliate code automatically

### `make build`
Same as default `make` - builds both extensions.

### `make build-chrome`
Build Chrome extension only.
```bash
make build-chrome
```
**Output:** `dist/chrome/`

**What it does:**
- Copies files to dist/chrome/
- Removes affiliate code
- Removes Firefox-specific files
- Sets proper permissions

### `make build-firefox`
Build Firefox extension only.
```bash
make build-firefox
```
**Output:** `dist/firefox/`

### `make rebuild`
Quick rebuild without cleaning first (faster).
```bash
make rebuild
```
**Use when:** Making small changes and don't need full clean build.

### `make clean`
Remove all built files.
```bash
make clean
```
**Removes:**
- `dist/chrome/`
- `dist/firefox/`
- `dist/*.zip`

---

## ✅ Testing & Verification

### `make verify`
Check that extension is clean (no affiliate code).
```bash
make verify
```
**Checks for:**
- ❌ Affiliate code
- ❌ UTM parameters
- ❌ Ref parameters

**CRITICAL:** Always run before submitting to Chrome Store!

### `make audit`
Full Chrome Store submission audit.
```bash
make audit
```
**Checks:**
- ✅ manifest.json exists
- ✅ Permissions are used in code
- ✅ No affiliate code
- ✅ Privacy policy is accessible
- ✅ Package structure correct

### `make submit-check`
**Most important command before Chrome Store submission!**
```bash
make submit-check
```
**What it does:**
1. Builds extension
2. Verifies no affiliate code
3. Runs full audit
4. Shows submission checklist

**Use this before every Chrome Store submission!**

### `make test`
Show manual testing instructions.
```bash
make test
```
**Opens:** Step-by-step testing guide

---

## 📦 Packaging

### `make package`
Create ZIP files for store submission.
```bash
make package
```
**Creates:**
- `dist/volux-chrome.zip` → Submit to Chrome Web Store
- `dist/volux-firefox.zip` → Submit to Firefox Add-ons

**Note:** Automatically excludes .DS_Store files

---

## 🌐 Website Commands

### `make serve`
Start local website server (foreground).
```bash
make serve
```
**URL:** http://localhost:8080
**Stop:** Press `Ctrl+C`

### `make serve-bg`
Start local website server (background).
```bash
make serve-bg
```
**URL:** http://localhost:8080
**Stop:** `make stop`

### `make stop`
Stop background server.
```bash
make stop
```
**Stops:**
- Background server on port 8080
- Any Python http.server on port 8080

---

## 🔧 Development Workflow

### `make dev`
**One-command development setup!**
```bash
make dev
```
**What it does:**
1. Builds extension
2. Starts website server in background
3. Shows URLs

**After running:**
- Extension: Load `dist/chrome/` in Chrome
- Website: http://localhost:8080

**When done:** `make stop`

### `make watch`
Watch for changes and auto-rebuild.
```bash
make watch
```
**Requires:** `inotifywait` (install: `sudo apt install inotify-tools`)

**Watches:** All files except dist/, node_modules/, .git/

**Stop:** `Ctrl+C`

---

## 📊 Information Commands

### `make stats`
Show extension statistics.
```bash
make stats
```
**Shows:**
- Chrome extension: file count, size
- Firefox extension: file count, size
- Website: page count, size

### `make version`
Show current version from manifest.json.
```bash
make version
```

### `make install`
Show installation instructions for testing locally.
```bash
make install
```
**Shows:**
- How to load in Chrome
- How to load in Firefox

### `make docs`
Show documentation (displays SUBMIT_CHECKLIST.md).
```bash
make docs
```

### `make help`
Show all available commands with descriptions.
```bash
make help
```

---

## 🎯 Common Workflows

### **First Time Setup**
```bash
# Build extension
make

# Test locally
make install
# (Follow instructions to load in Chrome)

# Verify it's clean
make verify
```

### **Before Chrome Store Submission**
```bash
# Full check
make submit-check

# Create package
make package

# Read checklist
cat SUBMIT_CHECKLIST.md

# Upload dist/volux-chrome.zip to Chrome Web Store
```

### **Development Workflow**
```bash
# Start dev environment
make dev

# Make changes to source files...

# Rebuild
make rebuild

# Reload extension in Chrome
# (chrome://extensions → click reload icon)

# When done
make stop
```

### **Testing Website Changes**
```bash
# Start server
make serve

# Open http://localhost:8080 in browser

# Edit docs/index.html or docs/privacy.html

# Refresh browser to see changes

# Ctrl+C to stop
```

### **Pre-Release Checklist**
```bash
# 1. Clean build
make clean
make

# 2. Verify clean
make verify

# 3. Full audit
make audit

# 4. Check stats
make stats

# 5. Check version
make version

# 6. Create packages
make package

# 7. Test locally
make install
# Load and test in browser

# 8. Submit
# Upload dist/volux-chrome.zip
```

---

## 🔍 Troubleshooting

### Build fails
```bash
# Clean and rebuild
make clean
make
```

### Server won't start (port in use)
```bash
# Stop existing server
make stop

# Try again
make serve
```

### Affiliate code found
```bash
# Rebuild from scratch
make clean
make build-chrome

# Verify again
make verify

# If still found, check source files
grep -r "affiliate" popup/ background/ content/
```

### Permission denied
```bash
# Fix permissions
chmod +x serve-local.sh
chmod +x build.sh

# Try again
make
```

---

## 📋 Command Cheatsheet

| Command | What It Does | When to Use |
|---------|-------------|-------------|
| `make` | Build both extensions | Always start here |
| `make verify` | Check for affiliate code | Before submission |
| `make audit` | Full Chrome Store audit | Before submission |
| `make submit-check` | Complete pre-submit check | **Before every submission** |
| `make package` | Create ZIP files | Final step before upload |
| `make serve` | Start website server | Test website locally |
| `make dev` | Build + serve website | Development workflow |
| `make stop` | Stop server | When done developing |
| `make clean` | Remove built files | Start fresh |
| `make help` | Show all commands | When confused |

---

## ⚡ One-Liners for Common Tasks

**Quick rebuild and verify:**
```bash
make rebuild && make verify
```

**Build and package in one go:**
```bash
make && make package
```

**Full submission check:**
```bash
make submit-check && make package
```

**Development mode:**
```bash
make dev
```

**Clean slate:**
```bash
make clean && make
```

---

## 🚨 CRITICAL Commands (Don't Skip!)

### Before Every Chrome Store Submission:

1. **Verify clean:**
   ```bash
   make verify
   ```
   ❌ If affiliate code found → **DO NOT SUBMIT**

2. **Full audit:**
   ```bash
   make audit
   ```
   Check all items are ✅

3. **Submit check:**
   ```bash
   make submit-check
   ```
   Follow the checklist

4. **Package:**
   ```bash
   make package
   ```
   Upload `dist/volux-chrome.zip`

---

## 💡 Pro Tips

**Alias for quick commands:**
```bash
# Add to ~/.bashrc or ~/.zshrc
alias mb='make build-chrome'
alias mv='make verify'
alias ms='make submit-check'
alias md='make dev'
```

**Check before committing:**
```bash
make verify && git add . && git commit
```

**Auto-verify on build:**
```bash
make build-chrome && make verify
```

**Full pipeline:**
```bash
make clean && make && make verify && make audit && make package
```

---

## 📖 Related Files

- `SUBMIT_CHECKLIST.md` - Detailed submission checklist
- `CHROME_STORE_SUBMISSION.md` - Copy-paste ready content
- `CHROME_SUBMISSION_AUDIT.md` - Technical audit details
- `LOCAL_DEVELOPMENT.md` - Website development guide
- `build.sh` - Alternative to Makefile
- `serve-local.sh` - Alternative server script

---

## 🎯 Quick Decision Tree

**Want to build?**
→ `make`

**Want to test website?**
→ `make serve`

**Want to develop?**
→ `make dev`

**Ready to submit to Chrome Store?**
→ `make submit-check` → `make package` → Upload

**Something broken?**
→ `make clean` → `make`

**Need help?**
→ `make help`

---

**Remember:** Always run `make submit-check` before submitting to Chrome Web Store! 🚀
