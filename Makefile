# Volux - Browser Extension Makefile
# Usage: make [target]

.PHONY: all build build-chrome build-firefox clean serve serve-bg stop package help install test verify audit submit-check dev

# Colors
GREEN := \033[0;32m
YELLOW := \033[1;33m
BLUE := \033[0;34m
RED := \033[0;31m
NC := \033[0m

# Default target
all: build

# Build both Chrome and Firefox extensions
build: clean build-chrome build-firefox
	@echo "$(GREEN)Build complete!$(NC)"

# Build Chrome extension only
build-chrome:
	@echo "$(YELLOW)Building Chrome extension...$(NC)"
	@mkdir -p dist/chrome
	@cp manifest.json dist/chrome/
	@cp -r icons dist/chrome/
	@cp -r background dist/chrome/
	@cp -r content dist/chrome/
	@cp -r popup dist/chrome/
	@mkdir -p dist/chrome/options
	@cp options/* dist/chrome/options/
	@rm -f dist/chrome/background/background-firefox.js
	@sed -i 's|<script src="../affiliate/config.js"></script>||g' dist/chrome/popup/popup.html
	@sed -i '/<div class="affiliate-section"/,/affiliate-disclosure/d' dist/chrome/popup/popup.html
	@sed -i '/^const AFFILIATE_/d' dist/chrome/background/background.js
	@chmod -R 755 dist/chrome/
	@echo "$(GREEN)Chrome extension ready: dist/chrome/$(NC)"

# Build Firefox extension only
build-firefox:
	@echo "$(YELLOW)Building Firefox extension...$(NC)"
	@mkdir -p dist/firefox/background
	@mkdir -p dist/firefox/options
	@cp manifest.firefox.json dist/firefox/manifest.json
	@cp -r icons dist/firefox/
	@cp -r content dist/firefox/
	@cp -r popup dist/firefox/
	@cp options/* dist/firefox/options/
	@cp background/background-firefox.js dist/firefox/background/
	@sed -i 's|<script src="../affiliate/config.js"></script>||g' dist/firefox/popup/popup.html
	@sed -i '/<div class="affiliate-section"/,/affiliate-disclosure/d' dist/firefox/popup/popup.html
	@sed -i '/^const AFFILIATE_/d' dist/firefox/background/background-firefox.js
	@chmod -R 755 dist/firefox/
	@echo "$(GREEN)Firefox extension ready: dist/firefox/$(NC)"

# Clean dist folder
clean:
	@echo "$(YELLOW)Cleaning dist folder...$(NC)"
	@rm -rf dist/chrome dist/firefox dist/*.zip
	@echo "$(GREEN)Clean complete$(NC)"

# Create zip packages for store submission
package: build
	@echo "$(YELLOW)Creating zip packages...$(NC)"
	@cd dist/chrome && zip -r ../volux-chrome.zip . -x "*.DS_Store"
	@cd dist/firefox && zip -r ../volux-firefox.zip . -x "*.DS_Store"
	@echo "$(GREEN)Packages created:$(NC)"
	@echo "  dist/volux-chrome.zip"
	@echo "  dist/volux-firefox.zip"

# Start local server for website preview
serve:
	@echo "$(BLUE)Starting local server at http://localhost:8080$(NC)"
	@cd docs && python3 -m http.server 8080

# Start server in background
serve-bg:
	@echo "$(BLUE)Starting local server in background at http://localhost:8080$(NC)"
	@cd docs && python3 -m http.server 8080 &
	@echo "$(GREEN)Server running. Use 'make stop' to stop.$(NC)"

# Stop local server
stop:
	@echo "$(YELLOW)Stopping local server...$(NC)"
	@-lsof -ti:8080 | xargs -r kill 2>/dev/null || true
	@-pkill -f "python.*8080" 2>/dev/null || true
	@echo "$(GREEN)Server stopped$(NC)"

# Watch for changes (requires inotifywait)
watch:
	@echo "$(BLUE)Watching for changes... (Ctrl+C to stop)$(NC)"
	@while true; do \
		inotifywait -qr -e modify -e create -e delete \
			--exclude '(dist|node_modules|\.git)' . && \
		make build; \
	done

# Show install instructions
install:
	@echo "$(BLUE)Installation Instructions:$(NC)"
	@echo ""
	@echo "$(YELLOW)Chrome:$(NC)"
	@echo "  1. Go to chrome://extensions"
	@echo "  2. Enable 'Developer mode'"
	@echo "  3. Click 'Load unpacked'"
	@echo "  4. Select the dist/chrome folder"
	@echo ""
	@echo "$(YELLOW)Firefox:$(NC)"
	@echo "  1. Go to about:debugging"
	@echo "  2. Click 'This Firefox'"
	@echo "  3. Click 'Load Temporary Add-on'"
	@echo "  4. Select any file in dist/firefox"

# Verify extension is clean (no affiliate code)
verify:
	@echo "$(BLUE)Verifying extension is clean...$(NC)"
	@echo ""
	@echo "$(YELLOW)Checking Chrome extension:$(NC)"
	@cd dist/chrome && (grep -r "affiliate" . && echo "$(RED)❌ FOUND AFFILIATE CODE$(NC)" || echo "$(GREEN)✅ No affiliate code$(NC)")
	@cd dist/chrome && (grep -r "utm_" . && echo "$(RED)❌ FOUND UTM$(NC)" || echo "$(GREEN)✅ No UTM parameters$(NC)")
	@cd dist/chrome && (grep -r "ref=" . && echo "$(RED)❌ FOUND REF$(NC)" || echo "$(GREEN)✅ No ref parameters$(NC)")
	@echo ""
	@echo "$(YELLOW)Checking Firefox extension:$(NC)"
	@cd dist/firefox && (grep -r "affiliate" . && echo "$(RED)❌ FOUND AFFILIATE CODE$(NC)" || echo "$(GREEN)✅ No affiliate code$(NC)")
	@echo ""
	@echo "$(GREEN)Verification complete!$(NC)"

# Test extension locally
test:
	@echo "$(BLUE)Testing extension...$(NC)"
	@echo ""
	@echo "$(YELLOW)Manual testing required:$(NC)"
	@echo "  1. Load extension: chrome://extensions"
	@echo "  2. Enable Developer mode"
	@echo "  3. Load unpacked: dist/chrome/"
	@echo "  4. Test features:"
	@echo "     - Add a domain (e.g., youtube.com)"
	@echo "     - Adjust volume"
	@echo "     - Open YouTube tab"
	@echo "     - Verify volume applied"
	@echo "     - Reload page"
	@echo "     - Verify volume persists"
	@echo ""
	@echo "$(GREEN)Press Enter to continue...$(NC)"
	@read

# Audit for Chrome Store submission
audit:
	@echo "$(BLUE)Running Chrome Store submission audit...$(NC)"
	@echo ""
	@echo "$(YELLOW)1. Checking manifest.json$(NC)"
	@test -f dist/chrome/manifest.json && echo "$(GREEN)✅ manifest.json exists$(NC)" || echo "$(RED)❌ manifest.json missing$(NC)"
	@echo ""
	@echo "$(YELLOW)2. Checking permissions usage$(NC)"
	@grep -q "chrome.storage" dist/chrome/background/background.js && echo "$(GREEN)✅ storage permission used$(NC)" || echo "$(RED)❌ storage not used$(NC)"
	@grep -q "chrome.tabs" dist/chrome/background/background.js && echo "$(GREEN)✅ tabs permission used$(NC)" || echo "$(RED)❌ tabs not used$(NC)"
	@echo ""
	@echo "$(YELLOW)3. Checking for affiliate code$(NC)"
	@cd dist/chrome && (grep -r "affiliate" . && echo "$(RED)❌ FOUND AFFILIATE CODE - DO NOT SUBMIT$(NC)" || echo "$(GREEN)✅ No affiliate code$(NC)")
	@echo ""
	@echo "$(YELLOW)4. Checking privacy policy$(NC)"
	@curl -s -o /dev/null -w "%{http_code}" https://volux.devlifeeasy.com/privacy.html | grep -q "200" && echo "$(GREEN)✅ Privacy policy accessible$(NC)" || echo "$(RED)❌ Privacy policy not accessible$(NC)"
	@echo ""
	@echo "$(YELLOW)5. Checking package structure$(NC)"
	@test -d dist/chrome/icons && echo "$(GREEN)✅ icons/ folder exists$(NC)" || echo "$(RED)❌ icons/ missing$(NC)"
	@test -d dist/chrome/background && echo "$(GREEN)✅ background/ folder exists$(NC)" || echo "$(RED)❌ background/ missing$(NC)"
	@test -d dist/chrome/popup && echo "$(GREEN)✅ popup/ folder exists$(NC)" || echo "$(RED)❌ popup/ missing$(NC)"
	@test -d dist/chrome/content && echo "$(GREEN)✅ content/ folder exists$(NC)" || echo "$(RED)❌ content/ missing$(NC)"
	@echo ""
	@echo "$(GREEN)Audit complete! Check SUBMIT_CHECKLIST.md for full checklist.$(NC)"

# Pre-submission check
submit-check: build verify audit
	@echo ""
	@echo "$(BLUE)═══════════════════════════════════════════$(NC)"
	@echo "$(GREEN)  Chrome Store Submission Checklist$(NC)"
	@echo "$(BLUE)═══════════════════════════════════════════$(NC)"
	@echo ""
	@echo "$(YELLOW)✓ Extension built$(NC)"
	@echo "$(YELLOW)✓ Affiliate code verified clean$(NC)"
	@echo "$(YELLOW)✓ Audit complete$(NC)"
	@echo ""
	@echo "$(BLUE)Next steps:$(NC)"
	@echo "  1. Run: $(GREEN)make package$(NC)"
	@echo "  2. Read: $(GREEN)SUBMIT_CHECKLIST.md$(NC)"
	@echo "  3. Upload: $(GREEN)dist/volux-chrome.zip$(NC)"
	@echo ""
	@echo "$(YELLOW)⚠️  IMPORTANT:$(NC)"
	@echo "  - Copy justification from CHROME_STORE_SUBMISSION.md"
	@echo "  - Don't skip the permissions justification field!"
	@echo "  - Include resubmission note"
	@echo ""

# Development workflow (build + serve)
dev: build serve-bg
	@echo ""
	@echo "$(GREEN)Development environment ready!$(NC)"
	@echo ""
	@echo "$(BLUE)Extension:$(NC)"
	@echo "  Load unpacked: dist/chrome/"
	@echo ""
	@echo "$(BLUE)Website:$(NC)"
	@echo "  http://localhost:8080"
	@echo ""
	@echo "$(YELLOW)Make changes and run 'make build' to rebuild$(NC)"
	@echo "$(YELLOW)Run 'make stop' when done$(NC)"

# Quick rebuild (no clean)
rebuild:
	@echo "$(YELLOW)Quick rebuild...$(NC)"
	@make build-chrome
	@make build-firefox
	@echo "$(GREEN)Rebuild complete!$(NC)"

# Show stats
stats:
	@echo "$(BLUE)Volux Extension Statistics$(NC)"
	@echo ""
	@echo "$(YELLOW)Chrome Extension:$(NC)"
	@test -d dist/chrome && find dist/chrome -type f | wc -l | xargs -I {} echo "  Files: {}" || echo "  Not built"
	@test -d dist/chrome && du -sh dist/chrome | cut -f1 | xargs -I {} echo "  Size: {}" || echo ""
	@echo ""
	@echo "$(YELLOW)Firefox Extension:$(NC)"
	@test -d dist/firefox && find dist/firefox -type f | wc -l | xargs -I {} echo "  Files: {}" || echo "  Not built"
	@test -d dist/firefox && du -sh dist/firefox | cut -f1 | xargs -I {} echo "  Size: {}" || echo ""
	@echo ""
	@echo "$(YELLOW)Website:$(NC)"
	@find docs -type f -name "*.html" | wc -l | xargs -I {} echo "  Pages: {}"
	@du -sh docs | cut -f1 | xargs -I {} echo "  Size: {}"

# Open documentation
docs:
	@echo "$(BLUE)Opening documentation...$(NC)"
	@test -f SUBMIT_CHECKLIST.md && cat SUBMIT_CHECKLIST.md || echo "Documentation not found"

# Show version
version:
	@echo "$(BLUE)Volux Extension Version$(NC)"
	@grep '"version"' manifest.json | head -1 | sed 's/.*: "\(.*\)".*/\1/' | xargs -I {} echo "  Version: {}"

# Show help
help:
	@echo "$(BLUE)═══════════════════════════════════════════$(NC)"
	@echo "$(GREEN)       Volux - Available Commands$(NC)"
	@echo "$(BLUE)═══════════════════════════════════════════$(NC)"
	@echo ""
	@echo "$(YELLOW)📦 Build Commands:$(NC)"
	@echo "  $(GREEN)make$(NC)                Build both extensions (default)"
	@echo "  $(GREEN)make build$(NC)          Build both Chrome and Firefox"
	@echo "  $(GREEN)make build-chrome$(NC)   Build Chrome extension only"
	@echo "  $(GREEN)make build-firefox$(NC)  Build Firefox extension only"
	@echo "  $(GREEN)make rebuild$(NC)        Quick rebuild (no clean)"
	@echo "  $(GREEN)make clean$(NC)          Clean dist folder"
	@echo ""
	@echo "$(YELLOW)📋 Testing & Verification:$(NC)"
	@echo "  $(GREEN)make verify$(NC)         Verify no affiliate code"
	@echo "  $(GREEN)make audit$(NC)          Run Chrome Store audit"
	@echo "  $(GREEN)make test$(NC)           Show testing instructions"
	@echo "  $(GREEN)make submit-check$(NC)   Full pre-submission check"
	@echo ""
	@echo "$(YELLOW)📦 Packaging:$(NC)"
	@echo "  $(GREEN)make package$(NC)        Create zip files for stores"
	@echo ""
	@echo "$(YELLOW)🌐 Website:$(NC)"
	@echo "  $(GREEN)make serve$(NC)          Start server (foreground, port 8080)"
	@echo "  $(GREEN)make serve-bg$(NC)       Start server (background)"
	@echo "  $(GREEN)make stop$(NC)           Stop local server"
	@echo ""
	@echo "$(YELLOW)🔧 Development:$(NC)"
	@echo "  $(GREEN)make dev$(NC)            Build + start server"
	@echo "  $(GREEN)make watch$(NC)          Watch for changes and rebuild"
	@echo ""
	@echo "$(YELLOW)📊 Info:$(NC)"
	@echo "  $(GREEN)make stats$(NC)          Show extension statistics"
	@echo "  $(GREEN)make version$(NC)        Show version"
	@echo "  $(GREEN)make install$(NC)        Show installation instructions"
	@echo "  $(GREEN)make docs$(NC)           Show documentation"
	@echo "  $(GREEN)make help$(NC)           Show this help"
	@echo ""
	@echo "$(BLUE)═══════════════════════════════════════════$(NC)"
	@echo "$(YELLOW)Quick Start:$(NC)"
	@echo "  1. $(GREEN)make$(NC)              → Build extensions"
	@echo "  2. $(GREEN)make submit-check$(NC) → Verify for Chrome Store"
	@echo "  3. $(GREEN)make package$(NC)      → Create submission ZIP"
	@echo "  4. $(GREEN)make dev$(NC)          → Development mode"
	@echo "$(BLUE)═══════════════════════════════════════════$(NC)"
