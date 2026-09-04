/**
 * Post-build checks: every internal link and image in dist/ must resolve to a
 * built file or a redirect rule, and no WPBakery shortcode may leak into the
 * rendered HTML.
 *
 * Usage: node scripts/verify.mjs   (exits non-zero on failure)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');

if (!fs.existsSync(DIST)) {
  console.error('dist/ not found — run the build first.');
  process.exit(1);
}

const htmlFiles = [];
(function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p);
    else if (entry.name.endsWith('.html')) htmlFiles.push(p);
  }
})(DIST);

const redirectFile = path.join(DIST, '_redirects');
const redirectSources = new Set();
const redirectGlobs = [];
if (fs.existsSync(redirectFile)) {
  for (const line of fs.readFileSync(redirectFile, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const from = t.split(/\s+/)[0];
    if (from.endsWith('*')) redirectGlobs.push(from.slice(0, -1));
    else redirectSources.add(from);
  }
}

const hasRedirect = (href) =>
  redirectSources.has(href) || redirectGlobs.some((g) => href.startsWith(g));

const servesPath = (href) => {
  const clean = decodeURIComponent(href.split(/[#?]/)[0]);
  return (
    fs.existsSync(path.join(DIST, clean)) ||
    fs.existsSync(path.join(DIST, clean, 'index.html'))
  );
};

const problems = {
  images: new Map(),
  links: new Map(),
  shortcodes: new Map(),
  meta: new Map(),
  noindex: new Map(),
};
const note = (bucket, key, page) => {
  if (!problems[bucket].has(key)) problems[bucket].set(key, []);
  problems[bucket].get(key).push(page);
};

const SHORTCODE_RE = /\[(?:vc_|nectar_|ls_content_block|image_with_animation|toggles?\b|divider\b|split_line_heading|testimonial|gravityform|tabbed_section|fancy-ul|text-with-icon)/;

for (const file of htmlFiles) {
  const html = fs.readFileSync(file, 'utf8');
  const page = '/' + path.relative(DIST, file).replace(/index\.html$/, '');

  if (SHORTCODE_RE.test(html)) {
    note('shortcodes', html.match(SHORTCODE_RE)[0], page);
  }

  for (const m of html.matchAll(/<img[^>]+src="([^"]+)"/g)) {
    const src = m[1];
    if (/^(https?:|data:)/.test(src)) continue;
    if (!servesPath(src)) note('images', src, page);
  }

  for (const m of html.matchAll(/url\((?:'|")?(\/wp-content\/[^'")]+)(?:'|")?\)/g)) {
    if (!servesPath(m[1])) note('images', m[1], page);
  }

  // A literal "null"/"undefined" in metadata means a data-extraction bug.
  for (const m of html.matchAll(/(?:content|href)="(null|undefined|NULL)"/g)) {
    note('meta', `stray ${m[1]} in a meta/link attribute`, page);
  }
  // Only pages we deliberately hide should carry noindex.
  if (/<meta name="robots"[^>]*noindex/.test(html) && !page.startsWith('/404')) {
    note('noindex', 'unexpected noindex', page);
  }

  // WordPress served every URL with a trailing slash. A link without one costs
  // an extra redirect hop and splits signals between two URLs.
  for (const m of html.matchAll(/href="(\/[^"#?]*)"/g)) {
    const href = m[1];
    if (href.startsWith('//') || href.startsWith('/wp-content/')) continue;
    if (!href.endsWith('/') && !/\.[a-z0-9]{2,12}$/i.test(href)) {
      note('meta', `link missing trailing slash: ${href}`, page);
    }
  }

  for (const m of html.matchAll(/href="(\/[^"]*)"/g)) {
    const href = m[1];
    if (href.startsWith('//')) continue;
    if (!servesPath(href) && !hasRedirect(href.split(/[#?]/)[0])) {
      note('links', href, page);
    }
  }
}

// Design tokens: every var(--x) must resolve to a definition somewhere.
{
  const cssFiles = [];
  const collect = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) collect(p);
      else if (/\.(astro|css)$/.test(e.name)) cssFiles.push(p);
    }
  };
  collect(path.join(ROOT, 'src'));
  const defined = new Set();
  const perFile = new Map();
  for (const f of cssFiles) {
    const txt = fs.readFileSync(f, 'utf8');
    const local = new Set();
    for (const m of txt.matchAll(/(--[a-z0-9-]+)\s*:/g)) {
      defined.add(m[1]);
      local.add(m[1]);
    }
    perFile.set(f, { txt, local });
  }
  // Tokens supplied inline via a style attribute at runtime.
  for (const t of ['--row-align', '--strip', '--submenu-link', '--col-width']) defined.add(t);
  for (const [f, { txt, local }] of perFile) {
    for (const m of txt.matchAll(/var\((--[a-z0-9-]+)/g)) {
      if (!defined.has(m[1]) && !local.has(m[1])) {
        note('meta', `undefined CSS token ${m[1]}`, path.relative(ROOT, f));
      }
    }
  }
}

let failed = false;
const report = (label, bucket) => {
  const entries = [...problems[bucket]];
  if (entries.length === 0) {
    console.log(`✓ ${label}: none`);
    return;
  }
  failed = true;
  console.log(`\n✗ ${label}: ${entries.length}`);
  for (const [key, pages] of entries.slice(0, 30)) {
    console.log(`   ${key}  — on ${pages.length} page(s), e.g. ${pages[0]}`);
  }
};

console.log(`scanned ${htmlFiles.length} pages\n`);
report('missing images', 'images');
report('broken internal links', 'links');
report('leaked shortcodes', 'shortcodes');
report('stray null metadata', 'meta');
report('unexpected noindex', 'noindex');

process.exit(failed ? 1 : 0);
