/**
 * Browser Arcade - Comprehensive Site & Navigation Validation Test Suite
 * Validates links, canonical URLs, meta tags, sitemap, robots.txt, and assets.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

let totalTests = 0;
let passedTests = 0;

function runTest(name, fn) {
  totalTests++;
  try {
    fn();
    passedTests++;
    console.log(`  ✓ ${name}`);
  } catch (error) {
    console.error(`  ✗ ${name}`);
    console.error(`    Error: ${error.message}`);
    throw error;
  }
}

console.log('\n========================================');
console.log('Running Site & Navigation Validation Suite');
console.log('========================================\n');

const ROOT_DIR = path.join(__dirname, '..');

const HTML_PAGES = [
  { file: 'index.html', canonical: 'https://browserarcade.pages.dev/' },
  { file: 'games/2048/index.html', canonical: 'https://browserarcade.pages.dev/games/2048/' },
  { file: 'about/index.html', canonical: 'https://browserarcade.pages.dev/about/' },
  { file: 'contact/index.html', canonical: 'https://browserarcade.pages.dev/contact/' },
  { file: 'privacy/index.html', canonical: 'https://browserarcade.pages.dev/privacy/' },
  { file: 'terms/index.html', canonical: 'https://browserarcade.pages.dev/terms/' },
  { file: '404.html', canonical: null }
];

// 1. Verify all HTML pages exist and have required metadata
HTML_PAGES.forEach(({ file, canonical }) => {
  runTest(`HTML Page "${file}" exists and has valid title, meta description, and structure`, () => {
    const fullPath = path.join(ROOT_DIR, file);
    assert.ok(fs.existsSync(fullPath), `File ${file} does not exist`);

    const content = fs.readFileSync(fullPath, 'utf8');
    assert.ok(content.includes('<!DOCTYPE html>'), `${file} missing <!DOCTYPE html>`);
    assert.ok(content.includes('<title>'), `${file} missing <title> tag`);
    assert.ok(content.includes('</title>'), `${file} missing </title> tag`);

    if (canonical) {
      assert.ok(
        content.includes(`<link rel="canonical" href="${canonical}">`),
        `${file} missing expected canonical link: ${canonical}`
      );
      assert.ok(
        content.includes('<meta name="description" content="'),
        `${file} missing meta description`
      );
      assert.ok(
        content.includes('<meta property="og:title"'),
        `${file} missing OpenGraph title`
      );
    }
  });
});

// 2. Verify all internal asset references resolve to real files
runTest('All referenced CSS stylesheets and JavaScript modules exist on disk', () => {
  const referencedAssets = [
    'assets/css/reset.css',
    'assets/css/variables.css',
    'assets/css/components.css',
    'assets/css/platform.css',
    'assets/js/arcade.js',
    'assets/js/storage.js',
    'assets/js/sound.js',
    'games/2048/css/2048.css',
    'games/2048/js/main.js',
    'games/2048/js/engine.js',
    'games/2048/js/input.js',
    'games/2048/js/renderer.js',
    'favicon.svg',
    'manifest.webmanifest'
  ];

  referencedAssets.forEach(relPath => {
    const assetPath = path.join(ROOT_DIR, relPath);
    assert.ok(fs.existsSync(assetPath), `Referenced asset does not exist: ${relPath}`);
  });
});

// 3. Verify all SVG game thumbnails exist and are non-empty
runTest('All SVG game thumbnails exist and have valid SVG XML headers', () => {
  const thumbs = [
    'assets/images/games/2048-thumb.svg',
    'assets/images/games/snake-thumb.svg',
    'assets/images/games/blockdrop-thumb.svg',
    'assets/images/games/minesweeper-thumb.svg',
    'assets/images/og-image.svg'
  ];

  thumbs.forEach(relThumb => {
    const thumbPath = path.join(ROOT_DIR, relThumb);
    assert.ok(fs.existsSync(thumbPath), `Thumbnail missing: ${relThumb}`);
    const svgContent = fs.readFileSync(thumbPath, 'utf8');
    assert.ok(svgContent.includes('<svg') && svgContent.includes('</svg>'), `Invalid SVG: ${relThumb}`);
  });
});

// 4. Verify Sitemap.xml integrity and coverage
runTest('sitemap.xml covers all active production routes', () => {
  const sitemapPath = path.join(ROOT_DIR, 'sitemap.xml');
  assert.ok(fs.existsSync(sitemapPath), 'sitemap.xml is missing');

  const sitemapContent = fs.readFileSync(sitemapPath, 'utf8');
  assert.ok(sitemapContent.includes('<?xml version="1.0" encoding="UTF-8"?>'), 'Missing XML declaration');

  const expectedUrls = [
    'https://browserarcade.pages.dev/',
    'https://browserarcade.pages.dev/games/2048/',
    'https://browserarcade.pages.dev/about/',
    'https://browserarcade.pages.dev/contact/',
    'https://browserarcade.pages.dev/privacy/',
    'https://browserarcade.pages.dev/terms/'
  ];

  expectedUrls.forEach(url => {
    assert.ok(sitemapContent.includes(`<loc>${url}</loc>`), `sitemap.xml missing URL: ${url}`);
  });
});

// 5. Verify robots.txt points to sitemap.xml
runTest('robots.txt allows indexing and references sitemap.xml', () => {
  const robotsPath = path.join(ROOT_DIR, 'robots.txt');
  assert.ok(fs.existsSync(robotsPath), 'robots.txt is missing');

  const robotsContent = fs.readFileSync(robotsPath, 'utf8');
  assert.ok(robotsContent.includes('User-agent: *'), 'robots.txt missing User-agent: *');
  assert.ok(robotsContent.includes('Allow: /'), 'robots.txt missing Allow: /');
  assert.ok(
    robotsContent.includes('Sitemap: https://browserarcade.pages.dev/sitemap.xml'),
    'robots.txt missing Sitemap reference'
  );
});

// 6. Verify Navigation link integrity across all pages
runTest('Navigation and footer links are consistent across all platform pages', () => {
  const pagesToCheck = ['index.html', 'games/2048/index.html', 'about/index.html', 'contact/index.html', 'privacy/index.html', 'terms/index.html'];

  pagesToCheck.forEach(page => {
    const content = fs.readFileSync(path.join(ROOT_DIR, page), 'utf8');
    assert.ok(content.includes('href="/"'), `${page} missing link to Home /`);
    assert.ok(content.includes('href="/games/2048/"'), `${page} missing link to 2048`);
    assert.ok(content.includes('href="/about/"'), `${page} missing link to About`);
    assert.ok(content.includes('href="/contact/"'), `${page} missing link to Contact`);
    assert.ok(content.includes('href="/privacy/"'), `${page} missing link to Privacy`);
    assert.ok(content.includes('href="/terms/"'), `${page} missing link to Terms`);
  });
});

console.log('\n========================================');
console.log(`Site Validation Results: ${passedTests}/${totalTests} Passed (100% Success)`);
console.log('========================================\n');
