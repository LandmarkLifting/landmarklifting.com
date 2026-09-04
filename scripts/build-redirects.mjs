/**
 * Turns the WordPress Redirection plugin rules into a Cloudflare `_redirects`
 * file, following chains to their final destination and normalising WordPress's
 * trailing slashes.
 *
 * Run before/with the build: `node scripts/build-redirects.mjs`
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data', f), 'utf8'));

const redirects = read('redirects.json');
const docs = read('docs.json');

const FRONT_PAGE_ID = '45';
const byId = new Map(docs.map((d) => [d.id, d]));

function permalink(doc) {
  if (doc.id === FRONT_PAGE_ID) return '/';
  if (doc.type === 'post') return `/${doc.slug}/`;
  const segments = [doc.slug];
  let parent = doc.parent;
  const seen = new Set([doc.id]);
  while (parent && parent !== '0' && !seen.has(parent)) {
    seen.add(parent);
    const p = byId.get(parent);
    if (!p) break;
    // Keep WordPress's nesting even under the front page — this must match
    // permalink() in src/lib/content.ts.
    segments.unshift(p.slug);
    parent = p.parent;
  }
  return `/${segments.join('/')}/`;
}

/** Every path the rebuilt site actually serves. */
const live = new Set(['/', '/blog/']);
for (const d of docs) live.add(permalink(d));
for (const d of docs)
  for (const t of d.terms) {
    if (t.taxonomy === 'category') live.add(`/category/${t.slug}/`);
    if (t.taxonomy === 'post_tag' && d.type === 'post') live.add(`/tag/${t.slug}/`);
  }

/** Normalise to a leading slash and a trailing slash (bare paths only). */
function norm(raw) {
  let u = String(raw || '').trim();
  if (!u) return null;
  u = u.replace(/^https?:\/\/(?:www\.)?landmarklifting\.com/i, '');
  if (u.startsWith('#')) return null;
  if (!u.startsWith('/')) u = `/${u}`;
  const [pathPart, ...restParts] = u.split(/(?=[#?])/);
  const rest = restParts.join('');
  const withSlash =
    pathPart === '/' || /\.[a-z0-9]{2,5}$/i.test(pathPart)
      ? pathPart
      : pathPart.replace(/\/+$/, '') + '/';
  return withSlash + rest;
}

/**
 * Targets whose original destination no longer exists on the rebuilt site.
 * These were pages we deliberately dropped (WooCommerce/account) or old
 * chains that dead-ended in the source data.
 */
const OVERRIDES = new Map([
  ['/account/toc/', '/terms-and-conditions/'],
  ['/account/privacy-policy/', '/privacy-policy/'],
  ['/my-account/checkout/', '/'],
  ['/home/eco-friendly/', '/eco-friendly/'],
  ['/account/', '/'],
  // Links in the old page copy that never had a Redirection rule.
  ['/concrete-lifting/', '/concrete-lifting-utah/'],
]);

const rules = [];
for (const r of redirects) {
  if (r.status !== 'enabled') continue;
  const from = norm(r.url);
  const to = norm(r.action_data);
  if (!from || !to || from === to) continue;
  rules.push({ from, to, code: Number(r.action_code) || 301 });
}

const direct = new Map(rules.map((r) => [r.from, r.to]));

/** Follow redirect chains so every rule lands in one hop. */
function resolve(target) {
  let current = target;
  const seen = new Set();
  for (let i = 0; i < 10; i++) {
    // A path the rebuilt site serves is already a valid destination.
    const base = current.split(/[#?]/)[0];
    if (live.has(base)) break;
    if (OVERRIDES.has(current)) {
      current = OVERRIDES.get(current);
      continue;
    }
    const next = direct.get(current);
    if (!next || seen.has(next)) break;
    seen.add(next);
    current = next;
  }
  const finalBase = current.split(/[#?]/)[0];
  return live.has(finalBase) ? current : (OVERRIDES.get(current) ?? current);
}

const out = new Map();
const unresolved = [];
for (const r of rules) {
  const to = resolve(r.to);
  const base = to.split(/[#?]/)[0];
  if (!live.has(base)) {
    unresolved.push(`${r.from} -> ${to}`);
    // Never emit a redirect into a 404: fall back to the home page.
    out.set(r.from, { to: '/', code: 301 });
    continue;
  }
  if (live.has(r.from)) continue; // a live page must not redirect away
  out.set(r.from, { to, code: r.code });
}

// Legacy WordPress endpoints that should not 404 or leak the old stack.
/**
 * Tags Yoast exposed at /tag/<slug>/ that no longer have a published post
 * behind them. Without these they would 404 instead of landing on the blog.
 */
const EMPTY_TAGS = [
  'cracked-concrete', 'fixing-concrete', 'joint-sealing', 'landmark-lifting',
  'mud-jacking', 'protecting-concrete', 'sika-flex', 'trip-hazards', 'void-filling',
].filter((slug) => !live.has(`/tag/${slug}/`));

const EXTRA = [
  // Pages dropped with the WooCommerce/test cleanup: redirect, never 404.
  ['/checkout/', '/', 301],
  ['/order-confirmation/', '/', 301],
  ['/order-failed/', '/', 301],
  ['/test/', '/', 301],
  ...EMPTY_TAGS.map((slug) => [`/tag/${slug}/`, '/blog/', 301]),
  ['/wp-admin/*', '/', 301],
  ['/wp-login.php', '/', 301],
  ['/xmlrpc.php', '/', 301],
  ['/feed/', '/rss.xml', 301],
  ['/blog/feed/', '/rss.xml', 301],
  ['/author/admin/', '/blog/', 301],
  ['/author/*', '/blog/', 301],
  ['/category/uncategorized/', '/blog/', 301],
  // Yoast's sitemap URLs — these are the ones Google has on file.
  ['/sitemap_index.xml', '/sitemap.xml', 301],
  ['/page-sitemap.xml', '/sitemap.xml', 301],
  ['/post-sitemap.xml', '/sitemap.xml', 301],
  ['/category-sitemap.xml', '/sitemap.xml', 301],
  ['/post_tag-sitemap.xml', '/sitemap.xml', 301],
  ['/author-sitemap.xml', '/sitemap.xml', 301],
  ['/product-sitemap.xml', '/sitemap.xml', 301],
  // Targets linked from the old page copy that had no Redirection rule.
  ['/concrete-lifting/', '/concrete-lifting-utah/', 301],
  ['/account/privacy-policy/', '/privacy-policy/', 301],
  ['/account/toc/', '/terms-and-conditions/', 301],
];

/**
 * WordPress served every URL with a trailing slash, and so do we. Cloudflare's
 * `auto-trailing-slash` already normalises a slash-less request, but it answers
 * with a 307 (temporary) — which tells search engines to keep the un-slashed
 * URL. An explicit rule per page makes it a 301 so signals consolidate onto the
 * canonical form. Redirect rules are matched before assets, so these win.
 */
const slashRules = [...live]
  .filter((u) => u !== '/' && u.endsWith('/'))
  .map((u) => [u.replace(/\/$/, ''), u, 301])
  .sort(([a], [b]) => a.localeCompare(b));

/**
 * `_redirects` is matched top to bottom and the first match wins, so an exact
 * rule must never sit below a wildcard that would swallow it. Every exact rule
 * is written first and the wildcards last.
 *
 * This also side-steps a Cloudflare quirk, should the site ever move back:
 * there, every rule from the first splat onwards counts as a "dynamic" rule and
 * only 100 are honoured — with wildcards mid-file, later rules were silently
 * dropped.
 */
const exact = [];
const splat = [];

/**
 * A few legacy URLs contain non-ASCII characters (one has a literal ellipsis).
 * Browsers send those percent-encoded, so the rule has to be written that way
 * or it never matches.
 */
const encodePath = (p) =>
  String(p).replace(/[^\x00-\x7F]+/g, (m) => encodeURIComponent(m));

for (const [from, { to, code }] of [...out].sort(([a], [b]) => a.localeCompare(b))) {
  (from.includes('*') ? splat : exact).push([from, to, code]);
}
for (const [from, to, code] of EXTRA) {
  if (out.has(from)) continue;
  (String(from).includes('*') ? splat : exact).push([from, to, code]);
}
for (const [from, to, code] of slashRules) {
  if (!out.has(from)) exact.push([from, to, code]);
}

const lines = [
  '# Generated by scripts/build-redirects.mjs from the WordPress Redirection plugin.',
  '# Do not edit by hand — re-run the script instead.',
  '#',
  '# Exact rules first, wildcards last — first match wins.',
  '',
];
for (const [from, to, code] of exact) lines.push(`${encodePath(from)}  ${to}  ${code}`);
lines.push('', '# Wildcard rules — must stay at the end.');
for (const [from, to, code] of splat) lines.push(`${encodePath(from)}  ${to}  ${code}`);
lines.push('');

fs.mkdirSync(path.join(ROOT, 'public'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'public/_redirects'), lines.join('\n'));

console.log(
  `wrote ${exact.length} exact + ${splat.length} wildcard rules -> public/_redirects`,
);
if (unresolved.length) {
  console.log(`\n${unresolved.length} sent to / because the target no longer exists:`);
  for (const u of unresolved) console.log(`  ${u}`);
}
