/**
 * Browser Arcade - Comprehensive Site & Navigation Validation Test Suite
 * Validates links, canonical URLs, meta tags, sitemap, robots.txt, Cloudflare _headers, and assets.
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
  { file: 'index.html', canonical: '/' },
  { file: 'games/2048/index.html', canonical: '/games/2048/' },
  { file: 'about/index.html', canonical: '/about/' },
  { file: 'contact/index.html', canonical: '/contact/' },
  { file: 'privacy/index.html', canonical: '/privacy/' },
  { file: 'terms/index.html', canonical: '/terms/' },
  { file: '404.html', canonical: null }
];

// 1. Verify all HTML pages exist and have valid canonical links and metadata
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

// 4. Verify Sitemap.xml template integrity and coverage
runTest('sitemap.xml covers all active production routes without obsolete domains', () => {
  const sitemapPath = path.join(ROOT_DIR, 'sitemap.xml');
  assert.ok(fs.existsSync(sitemapPath), 'sitemap.xml is missing');

  const sitemapContent = fs.readFileSync(sitemapPath, 'utf8');
  assert.ok(sitemapContent.includes('<?xml version="1.0" encoding="UTF-8"?>'), 'Missing XML declaration');

  const expectedUrls = [
    'https://REPLACE_WITH_CONFIRMED_DOMAIN/',
    'https://REPLACE_WITH_CONFIRMED_DOMAIN/games/2048/',
    'https://REPLACE_WITH_CONFIRMED_DOMAIN/about/',
    'https://REPLACE_WITH_CONFIRMED_DOMAIN/contact/',
    'https://REPLACE_WITH_CONFIRMED_DOMAIN/privacy/',
    'https://REPLACE_WITH_CONFIRMED_DOMAIN/terms/'
  ];

  expectedUrls.forEach(url => {
    assert.ok(sitemapContent.includes(`<loc>${url}</loc>`), `sitemap.xml missing URL: ${url}`);
  });
});

// 5. Verify robots.txt configuration
runTest('robots.txt allows indexing and documents sitemap reference', () => {
  const robotsPath = path.join(ROOT_DIR, 'robots.txt');
  assert.ok(fs.existsSync(robotsPath), 'robots.txt is missing');

  const robotsContent = fs.readFileSync(robotsPath, 'utf8');
  assert.ok(robotsContent.includes('User-agent: *'), 'robots.txt missing User-agent: *');
  assert.ok(robotsContent.includes('Allow: /'), 'robots.txt missing Allow: /');
  assert.ok(robotsContent.includes('sitemap.xml'), 'robots.txt missing sitemap.xml reference');
});

// 6. Verify Navigation link integrity across all pages
runTest('Navigation and footer links are consistent with trailing slashes across all platform pages', () => {
  const pagesToCheck = ['index.html', 'games/2048/index.html', 'about/index.html', 'contact/index.html', 'privacy/index.html', 'terms/index.html'];

  pagesToCheck.forEach(page => {
    const content = fs.readFileSync(path.join(ROOT_DIR, page), 'utf8');
    assert.ok(content.includes('href="/"'), `${page} missing link to Home /`);
    assert.ok(content.includes('href="/games/2048/"'), `${page} missing link to 2048/`);
    assert.ok(content.includes('href="/about/"'), `${page} missing link to About/`);
    assert.ok(content.includes('href="/contact/"'), `${page} missing link to Contact/`);
    assert.ok(content.includes('href="/privacy/"'), `${page} missing link to Privacy/`);
    assert.ok(content.includes('href="/terms/"'), `${page} missing link to Terms/`);
  });
});

// 6b. Verify all internal links to directory routes use trailing slashes
runTest('All internal links across all HTML documents to platform directory routes use trailing slashes', () => {
  const allHtmlFiles = [
    'index.html',
    'games/2048/index.html',
    'about/index.html',
    'contact/index.html',
    'privacy/index.html',
    'terms/index.html',
    '404.html'
  ];

  const directoryRoutes = ['about', 'games/2048', 'contact', 'privacy', 'terms'];

  allHtmlFiles.forEach(file => {
    const filePath = path.join(ROOT_DIR, file);
    assert.ok(fs.existsSync(filePath), `${file} is missing`);
    const content = fs.readFileSync(filePath, 'utf8');

    const hrefRegex = /href="([^"#:]+)"/g;
    let match;
    while ((match = hrefRegex.exec(content)) !== null) {
      const url = match[1];
      directoryRoutes.forEach(route => {
        assert.notStrictEqual(
          url,
          `/${route}`,
          `${file} contains non-trailing-slash internal link: href="/${route}" (must be "/${route}/")`
        );
      });
    }
  });
});

// 7. Verify Cloudflare Pages Hosting Configuration (_headers)
runTest('Cloudflare _headers exists with security headers and safe asset revalidation caching', () => {
  const headersPath = path.join(ROOT_DIR, '_headers');
  assert.ok(fs.existsSync(headersPath), '_headers file is missing');

  const headersContent = fs.readFileSync(headersPath, 'utf8');

  // Verify security headers in global rule
  assert.ok(headersContent.includes('/*'), '_headers missing global /* rule');
  assert.ok(headersContent.includes('X-Content-Type-Options: nosniff'), 'Missing X-Content-Type-Options header');
  assert.ok(headersContent.includes('X-Frame-Options: SAMEORIGIN'), 'Missing X-Frame-Options header');
  assert.ok(headersContent.includes('Referrer-Policy: strict-origin-when-cross-origin'), 'Missing Referrer-Policy header');

  // Verify caching scoped strictly to static assets with safe revalidation policy
  assert.ok(headersContent.includes('/assets/*'), '_headers missing /assets/* rule');
  assert.ok(
    headersContent.includes('Cache-Control: public, max-age=0, must-revalidate'),
    'Missing safe revalidation Cache-Control in /assets/*'
  );

  // Verify immutable caching is NOT applied to unhashed assets
  assert.ok(
    !headersContent.includes('immutable'),
    '_headers must NOT set immutable caching on unhashed static assets'
  );

  // Verify vercel.json is safely removed
  const vercelPath = path.join(ROOT_DIR, 'vercel.json');
  assert.ok(!fs.existsSync(vercelPath), 'vercel.json must be removed for Cloudflare Pages deployment');
});

// 8. Verify complete elimination of unowned emails and placeholder domains
runTest('Zero unowned email addresses or assumed hostnames exist in production files', () => {
  const filesToCheck = [
    'index.html',
    'games/2048/index.html',
    'about/index.html',
    'contact/index.html',
    'privacy/index.html',
    'terms/index.html',
    'robots.txt',
    'sitemap.xml',
    'assets/js/arcade.js'
  ];

  filesToCheck.forEach(file => {
    const content = fs.readFileSync(path.join(ROOT_DIR, file), 'utf8');
    assert.ok(!content.includes('browserarcade.dev'), `${file} contains unowned browserarcade.dev domain`);
    assert.ok(!content.includes('feedback@'), `${file} contains unowned feedback@ email`);
    assert.ok(!content.includes('privacy@'), `${file} contains unowned privacy@ email`);
    assert.ok(!content.includes('terms@'), `${file} contains unowned terms@ email`);
  });
});

// 9. Verify Contact Form GitHub Issue Integration & Privacy Disclosures
runTest('Contact page implements GitHub Issues submission URL, email visibility warning, and copy fallback', () => {
  const contactPath = path.join(ROOT_DIR, 'contact/index.html');
  const content = fs.readFileSync(contactPath, 'utf8');

  assert.ok(
    content.includes('https://github.com/aryansharma11223/BrowserArcade/issues/new'),
    'Contact page missing GitHub Issues new-issue URL'
  );
  assert.ok(
    content.includes('copyFormattedFeedback'),
    'Contact page missing copyFormattedFeedback fallback'
  );
  assert.ok(
    content.includes('Public Visibility Notice') || content.includes('Public Visibility Warning'),
    'Contact page missing email public visibility notice'
  );
  assert.ok(
    content.includes('Important Public Privacy Notice') || content.includes('Public Submission Notice'),
    'Contact page missing public issue privacy notice'
  );
});

// 10. Verify all static directory routes and their index.html files exist
runTest('All static directory routes contain valid index.html files', () => {
  const routes = [
    '', // root
    'games/2048',
    'about',
    'contact',
    'privacy',
    'terms'
  ];

  routes.forEach(route => {
    const indexPath = path.join(ROOT_DIR, route, 'index.html');
    assert.ok(fs.existsSync(indexPath), `Missing index.html for route /${route}`);
  });

  // Verify custom 404 page exists at root
  assert.ok(fs.existsSync(path.join(ROOT_DIR, '404.html')), 'Missing root 404.html error page');
});

// 11. Verify Cloudflare deployment guide accuracy, routing documentation, and absence of obsolete Vercel references
runTest('CLOUDFLARE_DEPLOYMENT_GUIDE.md documents safe revalidation, routing distinction, and AdSense clarity', () => {
  const guidePath = path.join(ROOT_DIR, 'CLOUDFLARE_DEPLOYMENT_GUIDE.md');
  assert.ok(fs.existsSync(guidePath), 'CLOUDFLARE_DEPLOYMENT_GUIDE.md is missing');

  const guideContent = fs.readFileSync(guidePath, 'utf8');

  // Verify asset caching policy
  assert.ok(
    guideContent.includes('max-age=0, must-revalidate'),
    'Guide must document safe revalidation caching (max-age=0, must-revalidate)'
  );
  assert.ok(
    !guideContent.includes('max-age=31536000, immutable'),
    'Guide must not recommend immutable caching for unhashed assets'
  );

  // Verify obsolete Vercel references are removed
  assert.ok(
    !guideContent.toLowerCase().includes('vercel.app'),
    'Guide must not reference obsolete vercel.app domain'
  );
  assert.ok(
    !guideContent.toLowerCase().includes('vercel.json'),
    'Guide must not reference vercel.json'
  );

  // Verify AdSense clarity and commercial terms
  assert.ok(
    guideContent.includes('no prohibition on commercial static websites or advertising'),
    'Guide must clarify Cloudflare terms regarding commercial sites/ads'
  );
  assert.ok(
    guideContent.includes('AdSense approval is not guaranteed'),
    'Guide must explicitly state AdSense approval is not guaranteed'
  );

  // Verify all 5 explicit redirect rules are documented
  const expectedRedirectRoutes = ['/about', '/games/2048', '/contact', '/privacy', '/terms'];
  expectedRedirectRoutes.forEach(route => {
    const hasRuleDoc = guideContent.includes(`\`${route}\` → \`${route}/\``) ||
                       guideContent.includes(`${route} → ${route}/`) ||
                       (guideContent.includes(route) && guideContent.includes(`${route}/`));
    assert.ok(
      hasRuleDoc,
      `Guide must document explicit redirect for ${route}`
    );
  });

  // Verify clear distinction between explicit _redirects and Cloudflare built-in behavior
  assert.ok(
    guideContent.includes('Explicitly Configured Redirects') || guideContent.includes('_redirects'),
    'Guide must document explicitly configured _redirects'
  );
  assert.ok(
    guideContent.includes('Documented Cloudflare') || guideContent.includes('Built-in Behavior'),
    'Guide must document Cloudflare built-in behavior'
  );

  // Verify no unsupported automatic 308 guarantee remains
  assert.ok(
    !guideContent.includes('automatic 308') && !guideContent.includes('automatically receives a 308'),
    'Guide must not contain unverified automatic 308 claims'
  );
});

// 12. Verify Cloudflare Pages _redirects file and rules
runTest('_redirects exists with 5 non-circular HTTP 301 rules enforcing trailing slashes', () => {
  const redirectsPath = path.join(ROOT_DIR, '_redirects');
  assert.ok(fs.existsSync(redirectsPath), '_redirects file is missing');

  const content = fs.readFileSync(redirectsPath, 'utf8');
  const lines = content.split('\n')
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('#'));

  assert.strictEqual(lines.length, 5, `Expected exactly 5 redirect rules, found ${lines.length}`);

  const expectedRules = [
    { from: '/about', to: '/about/', code: '301' },
    { from: '/games/2048', to: '/games/2048/', code: '301' },
    { from: '/contact', to: '/contact/', code: '301' },
    { from: '/privacy', to: '/privacy/', code: '301' },
    { from: '/terms', to: '/terms/', code: '301' }
  ];

  const parsedRules = [];

  lines.forEach(line => {
    const parts = line.split(/\s+/);
    assert.strictEqual(parts.length, 3, `Malformed redirect rule line: "${line}"`);
    const [from, to, code] = parts;
    assert.strictEqual(code, '301', `Rule "${from}" must use HTTP 301, got ${code}`);
    assert.strictEqual(to, `${from}/`, `Destination for "${from}" must be "${from}/", got "${to}"`);
    assert.notStrictEqual(from, to, `Self-redirect detected for "${from}"`);
    assert.notStrictEqual(from, '/', `Root "/" must not be redirected`);
    parsedRules.push({ from, to, code });
  });

  // Verify all expected rules are present
  expectedRules.forEach(expected => {
    const found = parsedRules.find(r => r.from === expected.from && r.to === expected.to && r.code === expected.code);
    assert.ok(found, `Missing expected redirect rule: ${expected.from} -> ${expected.to} ${expected.code}`);
  });

  // Verify no circular redirects exist (e.g. A -> B and B -> A)
  parsedRules.forEach(rule => {
    const reverse = parsedRules.find(r => r.from === rule.to);
    assert.strictEqual(reverse, undefined, `Circular redirect detected: ${rule.from} -> ${rule.to} and ${rule.to} -> ${reverse ? reverse.to : ''}`);
  });
});

console.log('\n========================================');
console.log(`Site Validation Results: ${passedTests}/${totalTests} Passed (100% Success)`);
console.log('========================================\n');
