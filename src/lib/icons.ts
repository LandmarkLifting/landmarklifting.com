/**
 * Icons come from real icon libraries, read straight off disk at build time so
 * the markup is the libraries' own geometry rather than an approximation:
 *
 *   - Lucide (ISC)          — interface and concept icons, 24px stroke grid
 *   - Bootstrap Icons (MIT) — brand marks, 16px filled grid
 *
 * Only the icons a page actually uses end up in the HTML; nothing ships a whole
 * icon font for three glyphs, which is what the original Salient build did.
 */
import fs from 'node:fs';
import path from 'node:path';

export type IconSet = 'lucide' | 'brand';

const ROOTS: Record<IconSet, string> = {
  lucide: 'node_modules/lucide-static/icons',
  brand: 'node_modules/bootstrap-icons/icons',
};

export interface IconData {
  /** The library's own inner markup (paths, circles …). */
  body: string;
  viewBox: string;
  /** Stroke icons inherit currentColor via `stroke`; brand marks via `fill`. */
  stroked: boolean;
}

const cache = new Map<string, IconData | null>();

export function getIcon(name: string, set: IconSet = 'lucide'): IconData | null {
  const key = `${set}/${name}`;
  if (cache.has(key)) return cache.get(key)!;

  const file = path.resolve(process.cwd(), ROOTS[set], `${name}.svg`);
  let data: IconData | null = null;

  if (fs.existsSync(file)) {
    const svg = fs.readFileSync(file, 'utf8');
    const viewBox = svg.match(/viewBox="([^"]+)"/)?.[1] ?? '0 0 24 24';
    const body = (svg.match(/<svg[^>]*>([\s\S]*?)<\/svg>/)?.[1] ?? '')
      // Drop the library's own class names; styling is ours.
      .replace(/\sclass="[^"]*"/g, '')
      .trim();
    if (body) data = { body, viewBox, stroked: set === 'lucide' };
  }

  cache.set(key, data);
  return data;
}

/**
 * The original content refers to Salient's bundled Iconsmind font. These are
 * the equivalents in Lucide for the icons actually used on the site.
 */
export const ICONSMIND_TO_LUCIDE: Record<string, string> = {
  broom: 'broom',
  'recycling-2': 'recycle',
  recycling: 'recycle',
  'medal-2': 'medal',
  medal: 'medal',
  'medal-3': 'medal',
  shield: 'shield-check',
  clock: 'clock',
  'like-2': 'thumbs-up',
  like: 'thumbs-up',
  home: 'house',
  wrench: 'wrench',
  'check-2': 'circle-check',
  phone: 'phone',
};
