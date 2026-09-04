/**
 * Loads the content extracted from the WordPress database and resolves the
 * permalinks WordPress would have produced (`/%postname%/`, with pages nested
 * under their parent).
 */
import docsJson from '../data/docs.json';
import attachmentsJson from '../data/attachments.json';
import blocksJson from '../data/blocks.json';
import menusJson from '../data/menus.json';
import mediaSizesJson from '../data/media-sizes.json';

export interface PageHeader {
  bg: string | null;
  bg_color: string | null;
  height: string | null;
  font_color: string | null;
  alignment: string | null;
  parallax: string | null;
  subtitle: string | null;
}

export interface Seo {
  title: string;
  description: string;
  canonical: string;
  noindex: string | null;
  og_image: string;
  og_title: string;
  og_description: string;
  reading_time: string | null;
}

export interface Doc {
  id: string;
  type: 'page' | 'post';
  slug: string;
  title: string;
  parent: string;
  date: string;
  modified: string;
  excerpt: string;
  menu_order: string;
  content: string;
  seo: Seo;
  featured_image: string | null;
  page_header: PageHeader;
  custom_css: string;
  terms: { name: string; slug: string; taxonomy: string }[];
}

export interface Attachment {
  id: string;
  file: string | null;
  alt: string;
  title: string;
  caption: string;
  mime: string;
}

export const docs = docsJson as unknown as Doc[];
export const attachments = attachmentsJson as unknown as Record<string, Attachment>;
export const blocks = blocksJson as unknown as Record<
  string,
  { id: string; title: string; content: string; custom_css: string }
>;

/** WordPress `page_on_front` — this page renders at `/`. */
export const FRONT_PAGE_ID = '45';
/** WordPress `page_for_posts` — the blog index. */
export const BLOG_PAGE_ID = '1112';

const byId = new Map(docs.map((d) => [d.id, d]));

/** Rebuild the permalink for a document, honouring page nesting. */
export function permalink(doc: Doc): string {
  if (doc.id === FRONT_PAGE_ID) return '/';
  if (doc.type === 'post') return `/${doc.slug}/`;

  // WordPress nests a child under its parent's slug even when that parent is
  // the front page, so /landmark-lifting-2/<child>/ is the URL that was
  // indexed. Keep that shape rather than hoisting children to the root.
  const segments = [doc.slug];
  let parent = doc.parent;
  const seen = new Set([doc.id]);
  while (parent && parent !== '0' && !seen.has(parent)) {
    seen.add(parent);
    const p = byId.get(parent);
    if (!p) break;
    segments.unshift(p.slug);
    parent = p.parent;
  }
  return `/${segments.join('/')}/`;
}

export function docById(id: string | null | undefined): Doc | undefined {
  return id ? byId.get(id) : undefined;
}

/** Resolve an attachment ID to a public URL under the original uploads path. */
export function mediaUrl(id: string | null | undefined): string | null {
  if (!id) return null;
  // Idempotent: an already-resolved path passes straight through, so callers
  // can safely resolve a value that may have been resolved upstream.
  if (id.startsWith('/wp-content/')) return id;
  if (/^https?:\/\//.test(id)) {
    const m = id.match(/\/wp-content\/uploads\/.+$/);
    return m ? m[0] : id;
  }
  const a = attachments[id];
  return a?.file ? `/wp-content/uploads/${a.file}` : null;
}

const mediaSizes = mediaSizesJson as unknown as Record<
  string,
  { w: number; h: number; alpha?: boolean }
>;

/**
 * Is an image suitable as a full-bleed hero background?
 *
 * A featured image is chosen for social cards and post listings, not for
 * spanning a hero band — several of them are logos on a transparent ground,
 * and one is 200x100. Transparency marks a graphic rather than a photograph,
 * and anything narrower than the content column would only be upscaled.
 */
export function usableAsHero(id: string | null | undefined): boolean {
  const size = mediaSize(id);
  if (!size) return false;
  // Transparency means a logo or graphic, never a hero photo.
  if (size.alpha) return false;
  // Below this the image is too small to sit behind a full-width band; the
  // plain gradient hero looks better than a heavily upscaled thumbnail.
  return size.w >= 700;
}

/** Intrinsic pixel dimensions of an image, by attachment ID or resolved path. */
export function mediaSize(id: string | null | undefined): { w: number; h: number } | null {
  const url = mediaUrl(id);
  if (!url) return null;
  const key = url.replace('/wp-content/uploads/', '');
  return mediaSizes[key] ?? null;
}

export function mediaAlt(id: string | null | undefined, fallback = ''): string {
  if (!id) return fallback;
  const a = attachments[id];
  return a?.alt || a?.title || fallback;
}

export const pages = docs.filter((d) => d.type === 'page');
export const posts = docs
  .filter((d) => d.type === 'post')
  .sort((a, b) => b.date.localeCompare(a.date));

/**
 * A handful of slugs exist as both a page and a post. WordPress served one of
 * them; we pick deterministically — most recently modified wins, then a page
 * over a post, then the longer body — and route only that one.
 */
export const routableDocs: Doc[] = (() => {
  const best = new Map<string, Doc>();
  for (const d of docs) {
    const url = permalink(d);
    const current = best.get(url);
    if (!current) {
      best.set(url, d);
      continue;
    }
    const score = (x: Doc): [string, number, number] => [
      x.modified || x.date,
      x.type === 'page' ? 1 : 0,
      (x.content || '').length,
    ];
    const [am, ap, al] = score(d);
    const [bm, bp, bl] = score(current);
    const wins = am !== bm ? am > bm : ap !== bp ? ap > bp : al > bl;
    if (wins) best.set(url, d);
  }
  return [...best.values()];
})();

/** Slugs that lost the de-duplication above, for reporting during the build. */
export const duplicateUrls = docs.length - routableDocs.length;

/** Blog categories, derived from the posts that survived the rebuild. */
export function categories() {
  const map = new Map<string, { name: string; slug: string; count: number }>();
  for (const p of posts) {
    for (const t of p.terms) {
      if (t.taxonomy !== 'category') continue;
      const e = map.get(t.slug) ?? { name: t.name, slug: t.slug, count: 0 };
      e.count++;
      map.set(t.slug, e);
    }
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export function postsInCategory(slug: string) {
  return posts.filter((p) => p.terms.some((t) => t.taxonomy === 'category' && t.slug === slug));
}

/** Tags that still have at least one published post behind them. */
export function tags() {
  const map = new Map<string, { name: string; slug: string; count: number }>();
  for (const p of posts) {
    for (const t of p.terms) {
      if (t.taxonomy !== 'post_tag') continue;
      const e = map.get(t.slug) ?? { name: t.name, slug: t.slug, count: 0 };
      e.count++;
      map.set(t.slug, e);
    }
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export function postsWithTag(slug: string) {
  return posts.filter((p) => p.terms.some((t) => t.taxonomy === 'post_tag' && t.slug === slug));
}

// ---------------------------------------------------------------------------
// Menus
// ---------------------------------------------------------------------------

interface RawMenuItem {
  id: string;
  order: number;
  parent: string | null;
  label: string;
  type: string | null;
  object: string | null;
  object_id: string | null;
  url: string | null;
  target: string | null;
  classes: string | null;
}

export interface MenuItem {
  label: string;
  /** Null for dropdown parents that had no link of their own in WordPress. */
  href: string | null;
  target?: string;
  children: MenuItem[];
}

const rawMenus = menusJson as unknown as Record<string, RawMenuItem[]>;

function itemHref(i: RawMenuItem): string | null {
  if (i.type === 'post_type' && i.object_id) {
    const d = byId.get(i.object_id);
    return d ? permalink(d) : null;
  }
  const url = (i.url ?? '').trim();
  if (!url) return null;
  // Normalise absolute links back to the site onto relative paths.
  const m = url.match(/^https?:\/\/(?:www\.)?landmarklifting\.com(\/.*)?$/i);
  if (m) return m[1] || '/';
  return url;
}

function itemLabel(i: RawMenuItem): string {
  // WordPress stores an empty title when the item inherits the page's own name.
  if (i.label?.trim()) return decode(i.label);
  const d = i.object_id ? byId.get(i.object_id) : undefined;
  return d ? decode(d.title) : '';
}

function decode(s: string): string {
  return s
    .replace(/&#0?38;|&amp;/g, '&')
    .replace(/&#8217;|&#039;|&#39;/g, "'")
    .replace(/&#8211;/g, '–')
    .replace(/&#8212;/g, '—')
    .replace(/&nbsp;/g, ' ');
}

export function menu(name: string): MenuItem[] {
  const items = rawMenus[name] ?? [];
  type Node = MenuItem & { _order: number };
  const nodes = new Map<string, Node>();

  // Build every item first — a parent with no link of its own still has to
  // stay in the tree, or WordPress would orphan its children up to the top.
  for (const i of items) {
    const label = itemLabel(i);
    if (!label) continue;
    nodes.set(i.id, {
      label,
      href: itemHref(i),
      target: i.target || undefined,
      children: [],
      _order: i.order,
    });
  }

  const roots: Node[] = [];
  for (const i of items) {
    const node = nodes.get(i.id);
    if (!node) continue;
    const parent = i.parent && i.parent !== '0' ? nodes.get(i.parent) : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }

  // Now drop anything that neither links anywhere nor holds children.
  const prune = (arr: Node[]): MenuItem[] =>
    arr
      .sort((a, b) => a._order - b._order)
      .map(({ _order, children, ...rest }) => ({
        ...rest,
        children: prune(children as Node[]),
      }))
      .filter((n) => n.href !== null || n.children.length > 0);

  return prune(roots);
}
