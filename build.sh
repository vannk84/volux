#!/bin/bash

# Build script for Volux

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}Building Volux...${NC}"

# Clean dist folder first
rm -rf dist/chrome dist/firefox
echo -e "${YELLOW}Cleaned dist folder${NC}"

# Create dist directories
mkdir -p dist/chrome
mkdir -p dist/firefox

# Build Chrome version
echo -e "${YELLOW}Building Chrome extension...${NC}"
cp manifest.json dist/chrome/
cp -r icons dist/chrome/
cp -r background dist/chrome/
cp -r content dist/chrome/
cp -r popup dist/chrome/
mkdir -p dist/chrome/options
cp options/* dist/chrome/options/

# Remove Firefox-specific files from Chrome build
rm -f dist/chrome/background/background-firefox.js

# Chrome: Remove affiliate links (policy compliance)
sed -i 's|<script src="../affiliate/config.js"></script>||g' dist/chrome/popup/popup.html
sed -i '/<div class="affiliate-section"/,/affiliate-disclosure/d' dist/chrome/popup/popup.html
sed -i '/^const AFFILIATE_/d' dist/chrome/background/background.js

# Fix permissions
chmod -R 755 dist/chrome/

echo -e "${GREEN}Chrome extension ready: dist/chrome/${NC}"

# Build Firefox version
echo -e "${YELLOW}Building Firefox extension...${NC}"
cp manifest.firefox.json dist/firefox/manifest.json
cp -r icons dist/firefox/
cp -r content dist/firefox/
cp -r popup dist/firefox/
mkdir -p dist/firefox/options
cp options/* dist/firefox/options/
mkdir -p dist/firefox/background
cp background/background-firefox.js dist/firefox/background/

# Firefox: Remove affiliate links (policy compliance)
sed -i 's|<script src="../affiliate/config.js"></script>||g' dist/firefox/popup/popup.html
sed -i '/<div class="affiliate-section"/,/affiliate-disclosure/d' dist/firefox/popup/popup.html
sed -i '/^const AFFILIATE_/d' dist/firefox/background/background-firefox.js

# Fix permissions
chmod -R 755 dist/firefox/

echo -e "${GREEN}Firefox extension ready: dist/firefox/${NC}"

# Create zip files if zip is available
if command -v zip &> /dev/null; then
    cd dist/chrome && zip -r ../volux-chrome.zip . -x "*.DS_Store" && cd ../..
    cd dist/firefox && zip -r ../volux-firefox.zip . -x "*.DS_Store" && cd ../..
    echo -e "${GREEN}Zip files created!${NC}"
fi

echo -e "${GREEN}Build complete!${NC}"
echo ""
echo "To install:"
echo "  Chrome: Go to chrome://extensions, enable Developer mode, click 'Load unpacked' and select dist/chrome"
echo "  Firefox: Go to about:debugging, click 'This Firefox', click 'Load Temporary Add-on' and select any file in dist/firefox"
