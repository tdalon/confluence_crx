const fs = require('fs');
const path = require('path');

// Copy Firefox-specific manifest
const firefoxManifest = path.join(__dirname, 'manifest.firefox.json');
const manifest = path.join(__dirname, 'manifest.json');
const manifestBackup = path.join(__dirname, 'manifest.chrome.json');

// Only backup if it's a Chrome manifest (manifest_version 3) or backup doesn't exist
const currentManifest = JSON.parse(fs.readFileSync(manifest, 'utf8'));
if (currentManifest.manifest_version === 3) {
    // Current manifest is Chrome version, safe to backup
    fs.copyFileSync(manifest, manifestBackup);
    console.log('✓ Backed up Chrome manifest to manifest.chrome.json');
} else if (!fs.existsSync(manifestBackup)) {
    console.warn('⚠️  Warning: Current manifest is not Chrome version and no backup exists.');
    console.warn('   Creating backup anyway, but you may need to restore manually.');
    fs.copyFileSync(manifest, manifestBackup);
} else {
    console.log('ℹ️  Skipping backup - using existing manifest.chrome.json');
}

// Copy Firefox manifest
fs.copyFileSync(firefoxManifest, manifest);
console.log('✓ Copied Firefox manifest');

// Transform HTML files for Firefox
const htmlTransforms = [
    {
        src: 'search.html',
        dest: 'dist/search.html',
        replacements: [
            // Fix relative paths for resources FIRST
            { from: /src="images\//g, to: 'src="../images/' },
            { from: /href="images\//g, to: 'href="../images/' },
            // Then replace script tag - use regex to ensure complete tag
            { from: /<script type="module" src="search\.js"><\/script>/g, to: '<script src="search.bundle.js"></script>' }
        ]
    },
    {
        src: 'snippets.html',
        dest: 'dist/snippets.html',
        replacements: [
            { from: /src="images\//g, to: 'src="../images/' },
            { from: /href="images\//g, to: 'href="../images/' },
            { from: /<script type="module" src="snippets-ui\.js"><\/script>/g, to: '<script src="snippets-ui.bundle.js"></script>' }
        ]
    },
    {
        src: 'label-dictionary.html',
        dest: 'dist/label-dictionary.html',
        replacements: [
            { from: /src="images\//g, to: 'src="../images/' },
            { from: /href="images\//g, to: 'href="../images/' },
            { from: /<script type="module" src="label-dictionary-ui\.js"><\/script>/g, to: '<script src="label-dictionary-ui.bundle.js"></script>' }
        ]
    }
];

htmlTransforms.forEach(transform => {
    let content = fs.readFileSync(transform.src, 'utf8');
    transform.replacements.forEach(replacement => {
        if (replacement.from instanceof RegExp) {
            content = content.replace(replacement.from, replacement.to);
        } else {
            content = content.replace(replacement.from, replacement.to);
        }
    });
    
    fs.writeFileSync(transform.dest, content);
    console.log(`✓ Transformed ${transform.src} → ${transform.dest}`);
});

// Patch bundled background.js to use dist HTML files
const backgroundBundle = path.join(__dirname, 'dist', 'background.bundle.js');
let backgroundContent = fs.readFileSync(backgroundBundle, 'utf8');

// Replace HTML file references with dist versions
backgroundContent = backgroundContent
    .replace(/snippets\.html/g, 'dist/snippets.html')
    .replace(/label-dictionary\.html/g, 'dist/label-dictionary.html')
    .replace(/search\.html/g, 'dist/search.html');

// Replace "action" context with "browser_action" for Manifest V2 compatibility
backgroundContent = backgroundContent
    .replace(/contexts:\s*\[([^\]]*)"action"([^\]]*)\]/g, 'contexts: [$1"browser_action"$2]');

fs.writeFileSync(backgroundBundle, backgroundContent);
console.log('✓ Patched background.bundle.js to use dist HTML files');
console.log('✓ Patched context menus to use browser_action for Firefox');

console.log('');
console.log('Firefox build ready! Load the extension folder in Firefox.');
console.log('To restore Chrome manifest, run: npm run restore-chrome');
