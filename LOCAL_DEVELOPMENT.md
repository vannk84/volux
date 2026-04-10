# Local Development - Volux Website

Quick guide to run the Volux website locally for testing and development.

---

## 🚀 Quick Start (Choose One Method)

### Method 1: Bash Script (Easiest)
```bash
./serve-local.sh
```

**Custom port:**
```bash
./serve-local.sh 3000
```

### Method 2: npm (Recommended)
```bash
npm run serve
# OR
npm run dev
```

### Method 3: Direct Python
```bash
cd docs
python3 -m http.server 8000
```

### Method 4: Node.js (npx serve)
```bash
npx serve docs -p 8000
```

---

## 📂 Website Structure

```
docs/
├── index.html          # Homepage (landing page)
├── privacy.html        # Privacy Policy (required for Chrome Store)
├── terms.html          # Terms of Service
├── refund.html         # Refund Policy
├── robots.txt          # SEO
├── sitemap.xml         # SEO
├── humans.txt          # Credits
├── llms.txt            # AI/LLM metadata
└── .well-known/        # Domain verification
```

**All CSS is inline** (in `<style>` tags)
**All JavaScript is inline** (in `<script>` tags)

---

## 🌐 Access the Website

Once server is running, open your browser:

**Homepage:**
http://localhost:8000

**Privacy Policy (Chrome Store requirement):**
http://localhost:8000/privacy.html

**Terms:**
http://localhost:8000/terms.html

**Refund Policy:**
http://localhost:8000/refund.html

---

## ✅ Testing Checklist

Before deploying or submitting to Chrome Store:

### Visual Testing
- [ ] Open http://localhost:8000
- [ ] Check homepage loads correctly
- [ ] Scroll through all sections
- [ ] Test "Get Extension" buttons
- [ ] Check mobile responsiveness (resize browser)

### Privacy Policy (CRITICAL for Chrome Store)
- [ ] Open http://localhost:8000/privacy.html
- [ ] Verify "Extension vs Website" section is present
- [ ] Check all links work
- [ ] Verify Microsoft Clarity disclaimer is visible
- [ ] Test link from extension options page

### All Pages
- [ ] Homepage: http://localhost:8000/
- [ ] Privacy: http://localhost:8000/privacy.html
- [ ] Terms: http://localhost:8000/terms.html
- [ ] Refunds: http://localhost:8000/refund.html

### Links to Verify
- [ ] Firefox Add-ons link (if present)
- [ ] GitHub repository link
- [ ] LemonSqueezy checkout link
- [ ] Email links (support@devlifeeasy.com)

---

## 🔧 Making Changes

### Edit HTML Files

**Homepage:**
```bash
# Edit with your favorite editor
code docs/index.html
# OR
vim docs/index.html
# OR
nano docs/index.html
```

**Privacy Policy:**
```bash
code docs/privacy.html
```

**Save and refresh browser** - changes appear immediately (no build needed)

### Testing Changes

1. Edit file (e.g., `docs/index.html`)
2. Save
3. Refresh browser (Ctrl+R or Cmd+R)
4. Changes appear immediately

**Pro tip:** Enable "Auto-reload" in browser DevTools for instant updates

---

## 🐛 Common Issues

### Port Already in Use

**Error:**
```
OSError: [Errno 98] Address already in use
```

**Fix:**
```bash
# Kill process on port 8000
lsof -ti:8000 | xargs kill -9

# OR use different port
./serve-local.sh 3000
```

### Permission Denied

**Error:**
```
bash: ./serve-local.sh: Permission denied
```

**Fix:**
```bash
chmod +x serve-local.sh
./serve-local.sh
```

### Python Not Found

**Error:**
```
python3: command not found
```

**Fix:** Use Node.js method instead:
```bash
npx serve docs -p 8000
```

---

## 🎨 Development Tips

### Live Reload (Optional)

Install browser extension for auto-reload:
- Chrome: "Live Server Web Extension"
- Firefox: "Live Reload"

### Testing Mobile View

**In browser:**
1. Open DevTools (F12)
2. Click device toolbar (Ctrl+Shift+M)
3. Select device (iPhone, iPad, etc.)

**Or resize browser window:**
- Desktop: > 1024px
- Tablet: 768px - 1024px
- Mobile: < 768px

### Testing Privacy Policy Link

**From extension:**
1. Load extension locally (chrome://extensions)
2. Open options page
3. Click privacy policy link
4. Should open: http://localhost:8000/privacy.html

**Note:** You may need to update extension code temporarily to use localhost URL

---

## 📝 Before Deploying to Production

### Checklist

- [ ] All links point to production URLs (not localhost)
- [ ] Privacy policy is accurate and up-to-date
- [ ] No console errors (F12 → Console)
- [ ] Microsoft Clarity tracking code present (if desired)
- [ ] Sitemap.xml updated with all pages
- [ ] robots.txt configured correctly

### Deploy to GitHub Pages

If using GitHub Pages:
```bash
git add docs/
git commit -m "Update website"
git push origin main
```

URL will be: `https://yourusername.github.io/volux/`

### Deploy to Custom Domain

Current production: https://volux.devlifeeasy.com

**After changes:**
1. Test locally
2. Commit to git
3. Push to production
4. Verify live site
5. Test privacy policy URL from Chrome Store

---

## 🔍 Debugging

### Check for Errors

**Open browser console:**
1. Right-click → Inspect
2. Console tab
3. Look for errors (red text)

**Common errors:**
- 404 Not Found → File path wrong
- CORS error → Need proper server (Python/Node handles this)
- Clarity script error → Normal on localhost

### Verify Privacy Policy

**Critical for Chrome Store submission:**
```bash
# Check privacy policy exists
curl -I http://localhost:8000/privacy.html

# Should return: 200 OK
```

**Check content:**
```bash
# Verify "Extension vs Website" section exists
curl http://localhost:8000/privacy.html | grep -i "extension vs website"
```

---

## 📊 Performance Testing

### Lighthouse (Chrome DevTools)

1. Open http://localhost:8000
2. F12 → Lighthouse tab
3. Run audit
4. Check scores:
   - Performance: Should be > 90
   - Accessibility: Should be > 90
   - SEO: Should be > 90

### Page Speed

**Check page load time:**
1. F12 → Network tab
2. Reload page (Ctrl+R)
3. Check "Finish" time at bottom

**Goal:** < 2 seconds

---

## 🎯 Production URLs (For Reference)

Once deployed, these are the production URLs:

- **Homepage:** https://volux.devlifeeasy.com/
- **Privacy:** https://volux.devlifeeasy.com/privacy.html
- **Terms:** https://volux.devlifeeasy.com/terms.html
- **Refunds:** https://volux.devlifeeasy.com/refund.html

**Chrome Store Privacy Policy URL:**
```
https://volux.devlifeeasy.com/privacy.html
```
↑ This exact URL must be in Chrome Web Store submission

---

## ⚡ Quick Commands Reference

```bash
# Start server (default port 8000)
./serve-local.sh

# Start server on custom port
./serve-local.sh 3000

# Using npm
npm run serve

# Direct Python
cd docs && python3 -m http.server 8000

# Using npx
npx serve docs -p 8000

# Kill server on port 8000
lsof -ti:8000 | xargs kill -9
```

---

## 🧪 Testing Workflow

**Before Chrome Store submission:**

1. **Start local server**
   ```bash
   ./serve-local.sh
   ```

2. **Test privacy policy**
   - Open: http://localhost:8000/privacy.html
   - Verify "Extension vs Website" section
   - Check all links work

3. **Test all pages**
   - Homepage: All sections visible
   - Privacy: All content accurate
   - Terms: Up to date
   - Refunds: Policy clear

4. **Check console**
   - F12 → Console
   - Should see only Clarity script (optional)
   - No errors

5. **Mobile test**
   - Resize browser
   - Check responsive design works

6. **Stop server**
   - Ctrl+C in terminal

---

## 📚 Additional Resources

**Static site hosting:**
- GitHub Pages (free)
- Netlify (free)
- Vercel (free)
- Cloudflare Pages (free)

**Local development:**
- Python http.server (built-in)
- Node.js serve (npx serve)
- Live Server (VS Code extension)

---

**Happy developing! 🚀**

Any questions? Check the main README or open an issue on GitHub.
