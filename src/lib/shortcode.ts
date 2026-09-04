/**
 * WordPress / WPBakery shortcode parser.
 *
 * The original site stored page content as Salient + WPBakery shortcodes
 * (`[vc_row][vc_column][vc_column_text]...`). This turns that flat string into
 * a tree the Astro components can render.
 */

export type Attrs = Record<string, string>;

export type Node =
  | { kind: 'html'; html: string }
  | { kind: 'tag'; name: string; attrs: Attrs; children: Node[] };

// Shortcode names may contain hyphens (`[fancy-ul]`, `[text-with-icon]`).
const TAG_RE = /\[(\/?)([a-zA-Z0-9_][a-zA-Z0-9_-]*)((?:[^\]\[]|\[(?!\/?[a-zA-Z0-9_]))*?)(\/?)\]/g;

/** Parse `foo="bar" baz='qux' flag` into an object. */
export function parseAttrs(raw: string): Attrs {
  const attrs: Attrs = {};
  const re = /([a-zA-Z0-9_-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s\]]+))|([a-zA-Z0-9_-]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw))) {
    if (m[1]) attrs[m[1]] = decodeEntities(m[2] ?? m[3] ?? m[4] ?? '');
    else if (m[5]) attrs[m[5]] = '';
  }
  return attrs;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&#8217;|&#039;|&#39;/g, "'")
    .replace(/&#8220;|&#8221;|&quot;/g, '"')
    .replace(/&#8211;/g, '–')
    .replace(/&#8212;/g, '—')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ');
}

interface Token {
  open: boolean;
  close: boolean;
  selfClose: boolean;
  name: string;
  attrs: string;
  start: number;
  end: number;
}

function tokenize(input: string): Token[] {
  const out: Token[] = [];
  TAG_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = TAG_RE.exec(input))) {
    out.push({
      open: m[1] !== '/',
      close: m[1] === '/',
      selfClose: m[4] === '/',
      name: m[2],
      attrs: m[3] ?? '',
      start: m.index,
      end: m.index + m[0].length,
    });
  }
  return out;
}

/**
 * A tag is a container only if a matching close tag exists further along,
 * accounting for nesting of the same name. Otherwise it is treated as void.
 */
function findClose(tokens: Token[], i: number): number {
  const name = tokens[i].name;
  let depth = 0;
  for (let j = i + 1; j < tokens.length; j++) {
    const t = tokens[j];
    if (t.name !== name) continue;
    if (t.open && !t.selfClose) depth++;
    else if (t.close) {
      if (depth === 0) return j;
      depth--;
    }
  }
  return -1;
}

export function parseShortcodes(input: string): Node[] {
  if (!input) return [];
  const tokens = tokenize(input);
  const [nodes] = build(input, tokens, 0, tokens.length, 0, input.length);
  return nodes;
}

function build(
  src: string,
  tokens: Token[],
  ti: number,
  tEnd: number,
  from: number,
  to: number,
): [Node[], number] {
  const nodes: Node[] = [];
  let cursor = from;
  let i = ti;

  const pushHtml = (text: string) => {
    if (text.trim()) nodes.push({ kind: 'html', html: text });
  };

  while (i < tEnd) {
    const t = tokens[i];
    if (t.start >= to) break;

    if (t.close) {
      // Stray close tag with no opener — emit literally.
      i++;
      continue;
    }

    pushHtml(src.slice(cursor, t.start));

    const closeIdx = t.selfClose ? -1 : findClose(tokens, i);
    if (closeIdx === -1 || closeIdx >= tEnd) {
      nodes.push({ kind: 'tag', name: t.name, attrs: parseAttrs(t.attrs), children: [] });
      cursor = t.end;
      i++;
    } else {
      const closeTok = tokens[closeIdx];
      const [children] = build(src, tokens, i + 1, closeIdx, t.end, closeTok.start);
      nodes.push({ kind: 'tag', name: t.name, attrs: parseAttrs(t.attrs), children });
      cursor = closeTok.end;
      i = closeIdx + 1;
    }
  }

  pushHtml(src.slice(cursor, to));
  return [nodes, i];
}

/** WPBakery stores raw HTML blocks as base64 of a URI-encoded string. */
export function decodeRawHtml(payload: string): string {
  const trimmed = payload.trim();
  if (!trimmed) return '';
  try {
    return decodeURIComponent(atob(trimmed));
  } catch {
    return trimmed;
  }
}

/** Collect the visible text of a node tree — used for excerpts and search. */
export function textOf(nodes: Node[]): string {
  let out = '';
  for (const n of nodes) {
    if (n.kind === 'html') out += n.html.replace(/<[^>]+>/g, ' ');
    else {
      if (n.attrs.text) out += ' ' + n.attrs.text;
      if (n.attrs.title) out += ' ' + n.attrs.title;
      out += ' ' + textOf(n.children);
    }
  }
  return out.replace(/\s+/g, ' ').trim();
}
