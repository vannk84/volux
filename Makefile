# Volux - Browser Extension Makefile
# Usage: make [target]

.PHONY: all build build-chrome build-firefox clean serve stop package help

# Colors
GREEN := \033[0;32m
YELLOW := \033[1;33m
BLUE := \033[0;34m
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

# Show help
help:
	@echo "$(BLUE)Volux - Available Commands$(NC)"
	@echo ""
	@echo "  $(GREEN)make$(NC)              Build both extensions (default)"
	@echo "  $(GREEN)make build$(NC)        Build both Chrome and Firefox extensions"
	@echo "  $(GREEN)make build-chrome$(NC) Build Chrome extension only"
	@echo "  $(GREEN)make build-firefox$(NC)Build Firefox extension only"
	@echo "  $(GREEN)make clean$(NC)        Clean dist folder"
	@echo "  $(GREEN)make package$(NC)      Create zip files for store submission"
	@echo "  $(GREEN)make serve$(NC)        Start local server for website (port 8080)"
	@echo "  $(GREEN)make serve-bg$(NC)     Start server in background"
	@echo "  $(GREEN)make stop$(NC)         Stop local server"
	@echo "  $(GREEN)make watch$(NC)        Watch for changes and rebuild"
	@echo "  $(GREEN)make install$(NC)      Show installation instructions"
	@echo "  $(GREEN)make help$(NC)         Show this help message"
