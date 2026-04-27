# Building for Chrome and Firefox

This extension supports both Chrome and Firefox with different approaches:
- **Chrome**: Uses ES modules directly (no build needed)
- **Firefox**: Uses bundled version (requires build)

## Important Notes

### Firefox Compatibility Issues Resolved

1. **ES Modules**: Firefox Manifest V2 doesn't support ES modules in background scripts or popup pages. Solution: Bundle all modules with Rollup.

2. **alert() Blocking**: Firefox blocks `alert()` in popup pages, which freezes the UI. Solution: Use visible HTML error messages instead.

3. **Addon ID Required**: Firefox requires an explicit addon ID in `browser_specific_settings` for storage APIs to work with temporary addons.

4. **Manifest Version**: Firefox has incomplete Manifest V3 support, so we use Manifest V2.

5. **Context Menus**: Manifest V2 uses `"browser_action"` context type instead of `"action"`. Solution: Build script automatically patches the context types.

6. **Script Injection API**: Manifest V2 doesn't have `chrome.scripting` API. Solution: Runtime detection to use `chrome.tabs.executeScript` for Firefox and `chrome.scripting` for Chrome.

7. **Message Response Handling**: Firefox doesn't set `chrome.runtime.lastError` when no message listener exists (returns undefined response instead). Solution: Check for both `lastError` and `undefined` response.

## Setup (One-time)

```bash
npm install
```

## Usage

### For Chrome (No Build Required!)
Just load the extension folder in Chrome - it works out of the box!
- Uses `manifest.json` (Manifest V3 with ES modules)
- Directly loads `background.js` with `import` statements

### For Firefox (Build Required)
```bash
npm run build-firefox
```
- Bundles all modules into `dist/background.bundle.js`
- Temporarily replaces `manifest.json` with Firefox version (Manifest V2)
- Load the extension folder in Firefox

### After Testing Firefox - Restore Chrome Manifest
```bash
npm run restore-chrome
```
This restores the Chrome manifest so you can continue Chrome development.

## Development Workflow

### Chrome Development (recommended)
1. Edit code normally (background.js, shared.js, snippets.js, etc.)
2. Reload extension in Chrome
3. No build step needed! ✨

### Firefox Testing
1. Run `npm run build-firefox`
2. Load in Firefox and test
3. Run `npm run restore-chrome` when done
4. Continue Chrome development

## Files

- `manifest.json` - Chrome version (Manifest V3, uses ES modules)
- `manifest.firefox.json` - Firefox version (Manifest V2, uses bundled file)
- `manifest.chrome.json` - Backup of Chrome manifest (auto-created during Firefox build)
- `dist/background.bundle.js` - Bundled file for Firefox (auto-generated)

## Why Different Approaches?

- **Chrome** fully supports Manifest V3 with ES modules in service workers
- **Firefox** has incomplete Manifest V3 support and doesn't support ES modules in background scripts
- This setup gives you the best of both: fast Chrome development + Firefox compatibility
