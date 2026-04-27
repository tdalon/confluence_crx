import { nodeResolve } from '@rollup/plugin-node-resolve';

const banner = `// Browser API polyfill for Firefox
console.log('🔧 Confluence Extension Background Script Loading...');
if (typeof browser !== 'undefined' && typeof chrome === 'undefined') {
  console.log('🦊 Firefox detected - mapping browser to chrome');
  globalThis.chrome = browser;
} else {
  console.log('🌐 Chrome/Chromium detected');
}`;

const simpleBanner = `// Browser API polyfill for Firefox
console.log('🔍 Search script loading...');
if (typeof browser !== 'undefined' && typeof chrome === 'undefined') {
  globalThis.chrome = browser;
  console.log('🦊 Firefox - mapped browser to chrome');
}`;

export default [
  // Background script bundle
  {
    input: 'background.js',
    output: {
      file: 'dist/background.bundle.js',
      format: 'iife',
      sourcemap: false,
      banner: banner
    },
    plugins: [nodeResolve()]
  },
  // Search script bundle
  {
    input: 'search.js',
    output: {
      file: 'dist/search.bundle.js',
      format: 'iife',
      sourcemap: false,
      banner: `${simpleBanner}`,
      footer: `//# sourceURL=search.bundle.js`
    },
    plugins: [nodeResolve()]
  },
  // Label dictionary UI bundle
  {
    input: 'label-dictionary-ui.js',
    output: {
      file: 'dist/label-dictionary-ui.bundle.js',
      format: 'iife',
      sourcemap: false,
      banner: simpleBanner
    },
    plugins: [nodeResolve()]
  },
  // Snippets UI bundle
  {
    input: 'snippets-ui.js',
    output: {
      file: 'dist/snippets-ui.bundle.js',
      format: 'iife',
      sourcemap: false,
      banner: simpleBanner
    },
    plugins: [nodeResolve()]
  }
];
