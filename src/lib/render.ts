/**
 * Helpers that translate WPBakery / Salient shortcode attributes into the
 * CSS classes and inline styles used by this rebuild.
 */
import type { Attrs } from './shortcode';

/** Salient colour keywords, resolved to the palette from salient_redux. */
const PALETTE: Record<string, string> = {
  'accent-color': '#f15c28',
  'extra-color-1': '#221e1e',
  'extra-color-2': '#ffffff',
  'extra-color-3': '#333333',
  'color-1': '#f15c28',
  white: '#ffffff',
  default: '',
};

export function color(value: string | undefined): string {
  if (!value) return '';
  const v = value.trim();
  if (v.startsWith('#') || v.startsWith('rgb')) return v;
  return PALETTE[v.toLowerCase()] ?? '';
}

/**
 * Is a colour light enough to need dark text on top of it? Used where a column
 * carries its own background inside a row that set a global light/dark text
 * colour — otherwise white text can land on a white column.
 */
export function isLightColor(value: string | undefined): boolean | null {
  const v = color(value);
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(v.trim());
  if (!m) return null;
  let hex = m[1];
  if (hex.length === 3) hex = hex.split('').map((c) => c + c).join('');
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  // Perceived luminance (ITU-R BT.601).
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6;
}

/** `1/3` -> `33.3333%`. Falls back to full width. */
export function widthPercent(raw: string | undefined): string {
  if (!raw) return '100%';
  const m = raw.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (!m) return '100%';
  const pct = (Number(m[1]) / Number(m[2])) * 100;
  if (!isFinite(pct) || pct <= 0) return '100%';
  return `${Number(pct.toFixed(4))}%`;
}

/** WPBakery padding values are either a percentage or a bare pixel count. */
export function spacing(raw: string | undefined): string | null {
  if (!raw) return null;
  const v = raw.trim();
  if (!v || v === '0') return null;
  if (/^\d+(\.\d+)?%$/.test(v)) return v;
  if (/^\d+(\.\d+)?px$/.test(v)) return v;
  if (/^\d+(\.\d+)?$/.test(v)) return `${v}px`;
  return v;
}

/**
 * `tag:h3|text_align:left|color:%23FFFFFF` -> structured heading options.
 */
export function fontContainer(raw: string | undefined): {
  tag: string;
  align: string | null;
  color: string | null;
  fontSize: string | null;
  lineHeight: string | null;
} {
  const out = { tag: 'h2', align: null as string | null, color: null as string | null,
                fontSize: null as string | null, lineHeight: null as string | null };
  if (!raw) return out;
  for (const part of raw.split('|')) {
    const [k, ...rest] = part.split(':');
    const v = decodeURIComponent(rest.join(':') || '');
    if (!v) continue;
    if (k === 'tag' && /^h[1-6]$|^p$|^div$/.test(v)) out.tag = v;
    else if (k === 'text_align') out.align = v;
    else if (k === 'color') out.color = v;
    else if (k === 'font_size') out.fontSize = /^\d+$/.test(v) ? `${v}px` : v;
    else if (k === 'line_height') out.lineHeight = v;
  }
  return out;
}

/**
 * A lot of the original content uses a heading shortcode for what is really a
 * sentence — some run past 170 characters. Set as display type (34px uppercase
 * condensed) they are unreadable, so anything this long is styled as lead prose
 * instead. The tag is left alone; only the appearance changes.
 */
export const PROSE_HEADING_CHARS = 90;

export function isProseHeading(text: string | undefined): boolean {
  const plain = String(text ?? '')
    .replace(/<[^>]+>/g, '')
    .replace(/&[a-z#0-9]+;/gi, ' ')
    .trim();
  return plain.length > PROSE_HEADING_CHARS;
}

/** Class to add to a heading whose text is really prose. */
export function headingClass(text: string | undefined, extra = ''): string {
  return [extra, isProseHeading(text) ? 'h--prose' : ''].filter(Boolean).join(' ') || undefined as any;
}

/**
 * Every page except the front page renders its title as the hero <h1>, so an
 * <h1> in the body would be a second top-level heading. Demote those to <h2>
 * before parsing — covers both raw HTML and WPBakery's font_container syntax.
 */
export function demoteContentH1(content: string): string {
  return content
    .replace(/<(\/?)h1(\s|>)/gi, '<$1h2$2')
    .replace(/tag:h1\b/gi, 'tag:h2');
}

/** Only allow heading tags we intend to emit. */
export function headingTag(raw: string | undefined, fallback = 'h2'): string {
  const v = (raw || '').trim().toLowerCase();
  return /^h[1-6]$/.test(v) || v === 'p' || v === 'span' || v === 'div' ? v : fallback;
}

const BUTTON_SIZES: Record<string, string> = {
  small: 'btn--small',
  medium: 'btn--medium',
  large: 'btn--large',
  jumbo: 'btn--jumbo',
};

export function buttonClasses(attrs: Attrs): string {
  const size = BUTTON_SIZES[(attrs.size || 'medium').toLowerCase()] ?? 'btn--medium';
  const raw = (attrs.button_color_2 || attrs.color || attrs.button_color || '').toLowerCase();
  let variant = 'btn--accent';
  if (raw === 'extra-color-1') variant = 'btn--dark';
  else if (raw === 'extra-color-2' || raw === 'white') variant = 'btn--white';
  else if ((attrs.button_style || '').includes('see-through')) variant = 'btn--outline';
  return `btn ${variant} ${size}`;
}

/**
 * Rewrite absolute links back to the live domain into site-relative paths, so
 * internal navigation stays on the rebuilt site.
 */
export function internalHref(url: string | undefined): string {
  const raw = (url || '').trim();
  if (!raw) return '#';
  const m = raw.match(/^https?:\/\/(?:www\.)?landmarklifting\.com(\/.*)?$/i);
  if (m) {
    const path = m[1] || '/';
    // Restore WordPress's trailing slash on bare page paths.
    if (/\/$|#|\?|\.[a-z0-9]+$/i.test(path)) return path;
    return `${path}/`;
  }
  return raw;
}

export function isExternal(href: string): boolean {
  return /^https?:\/\//i.test(href) && !/landmarklifting\.com/i.test(href);
}

/** Extract a YouTube video ID from any of the URL shapes used on the site. */
export function youtubeId(url: string | undefined): string | null {
  if (!url) return null;
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/);
  return m ? m[1] : null;
}

/**
 * The original content contains WordPress-encoded entities and absolute URLs.
 * Normalise both, and make embedded media lazy.
 */
export function cleanHtml(html: string): string {
  // An <h1> inside body markup is always a duplicate of the hero title: the
  // front page's own <h1> comes from a heading shortcode, not from raw HTML.
  return markProseHeadings(html.replace(/<(\/?)h1(\s|>)/gi, '<$1h2$2'))
    .replace(/https?:\/\/(?:www\.)?landmarklifting\.com\/wp-content\//gi, '/wp-content/')
    .replace(/href="https?:\/\/(?:www\.)?landmarklifting\.com(\/[^"]*)?"/gi, (_m, p) => `href="${p || '/'}"`)
    // WordPress served every page with a trailing slash; keep imported links
    // consistent so nothing relies on a server-side redirect.
    .replace(/href="(\/[^"#?]*?)"/gi, (m, p) =>
      /\.[a-z0-9]{2,5}$/i.test(p) || p.endsWith('/') ? m : `href="${p}/"`,
    )
    .replace(/<iframe(?![^>]*\bloading=)/gi, '<iframe loading="lazy"')
    .replace(/<img(?![^>]*\bloading=)/gi, '<img loading="lazy" decoding="async"');
}

/** Tag over-long headings inside raw content so the CSS can calm them down. */
function markProseHeadings(html: string): string {
  return html.replace(
    /<(h[1-4])([^>]*)>([\s\S]*?)<\/\1>/gi,
    (match, tag, attrs, inner) => {
      if (!isProseHeading(inner)) return match;
      return /class\s*=\s*"/i.test(attrs)
        ? `<${tag}${attrs.replace(/class\s*=\s*"/i, 'class="h--prose ')}>${inner}</${tag}>`
        : `<${tag}${attrs} class="h--prose">${inner}</${tag}>`;
    },
  );
}

// ---------------------------------------------------------------------------
// Paragraphs
// ---------------------------------------------------------------------------

/**
 * Block-level tags a paragraph may never wrap. This is the `$allblocks` list
 * from WordPress's own `wpautop()`, kept in the same order for comparison.
 */
const AUTOP_BLOCKS =
  '(?:table|thead|tfoot|caption|col|colgroup|tbody|tr|td|th|div|dl|dd|dt|ul|ol|li|pre|form' +
  '|map|area|blockquote|address|style|p|h[1-6]|hr|fieldset|legend|section|article|aside' +
  '|hgroup|header|footer|nav|figure|figcaption|details|menu|summary)';

/** `wpautop()`'s block-tag patterns, with `ALLBLOCKS` standing in for the list. */
const blockRe = (pattern: string) =>
  new RegExp(pattern.replace(/ALLBLOCKS/g, AUTOP_BLOCKS), 'g');

/**
 * WordPress never stored the `<p>` tags for content written in the classic
 * editor — `wpautop()` added them on the way out, from the blank lines between
 * paragraphs. This rebuild renders the stored HTML directly, so without the
 * same pass those blank lines collapse and a whole post runs together as one
 * unbroken block of type with a gap only where a heading happens to fall.
 *
 * A port of `wpautop()`, so posts break where they always did, with the one
 * departure marked below. Content that already carries its own `<p>` tags
 * (anything from the block editor) passes through unchanged — this is
 * idempotent.
 */
export function autop(text: string, br = true): string {
  if (!text || !text.trim()) return text;

  // <pre> is the one place where newlines are content rather than layout.
  const preserved: string[] = [];
  let out = `${text}\n`.replace(/<pre[\s\S]*?<\/pre>/gi, (m) => {
    preserved.push(m);
    return `<WPPreTag${preserved.length - 1}>`;
  });

  out = out.replace(/\r\n?/g, '\n');

  // A newline inside a tag is a wrapped attribute, not a paragraph break.
  out = replaceInHtmlTags(out, '\n', ' <!-- wpnl --> ');

  out = out.replace(/\s*<figcaption([^>]*)>/g, '<figcaption$1>');
  out = out.replace(/<\/figcaption>\s*/g, '</figcaption>');

  // A deliberate departure from `wpautop()`. WordPress only treats a *blank*
  // line as a paragraph break, so a heading, list or table written on the line
  // straight after a sentence — which is how the classic editor saved most of
  // these posts — ends up nested inside that paragraph. The browser closes the
  // <p> at the block tag anyway, which leaves the copy after it as a bare text
  // node with no paragraph margin at all: the run-on spacing this pass exists
  // to fix. A block tag that opens or closes a line is a paragraph boundary.
  out = out.replace(blockRe('\\n([ \\t]*</?ALLBLOCKS[^>]*>)'), '\n\n$1');
  out = out.replace(blockRe('(</?ALLBLOCKS[^>]*>[ \\t]*)\\n'), '$1\n\n');

  out = out.replace(/\n\n+/g, '\n\n');
  out = out
    .split(/\n\s*\n/)
    .filter((chunk) => chunk !== '')
    .map((chunk) => `<p>${chunk.replace(/^\n+|\n+$/g, '')}</p>\n`)
    .join('');

  out = out.replace(/<p>\s*<\/p>/g, '');
  out = out.replace(/<p>([^<]+)<\/(div|address|form)>/g, '<p>$1</p></$2>');
  // A block element that ended up wrapped in a paragraph is unwrapped again.
  out = out.replace(blockRe('<p>\\s*(</?ALLBLOCKS[^>]*>)\\s*</p>'), '$1');
  out = out.replace(/<p>(<li[\s\S]*?)<\/p>/g, '$1');
  out = out.replace(/<p><blockquote([^>]*)>/gi, '<blockquote$1><p>');
  out = out.split('</blockquote></p>').join('</p></blockquote>');
  out = out.replace(blockRe('<p>\\s*(</?ALLBLOCKS[^>]*>)'), '$1');
  out = out.replace(blockRe('(</?ALLBLOCKS[^>]*>)\\s*</p>'), '$1');

  if (br) {
    out = out.replace(/<(script|style|svg|math)[\s\S]*?<\/\1>/g, (m) =>
      m.replace(/\n/g, '<WPPreserveNewline />'),
    );
    out = out.replace(/<br\s*\/?>/gi, '<br />');
    // A single newline inside a paragraph was a line break in the editor.
    out = out.replace(/(?<!<br \/>)\s*\n/g, '<br />\n');
    out = out.split('<WPPreserveNewline />').join('\n');
  }

  out = out.replace(blockRe('(</?ALLBLOCKS[^>]*>)\\s*<br />'), '$1');
  // WordPress only strips a trailing break before a handful of block tags, so a
  // heading that followed a line of copy without a blank line above it kept a
  // stray <br /> and an extra line of space. Every block tag closes the
  // paragraph anyway, so the break has nothing left to break.
  out = out.replace(blockRe('<br />(\\s*</?ALLBLOCKS[^>]*>)'), '$1');
  out = out.replace(/\n<\/p>$/, '</p>');

  if (out.includes('<!-- wpnl -->')) {
    out = out.split(' <!-- wpnl --> ').join('\n').split('<!-- wpnl -->').join('\n');
  }

  return out.replace(/<WPPreTag(\d+)>/g, (_m, i) => preserved[Number(i)]);
}

/** Apply a replacement only inside HTML tags, as `wp_replace_in_html_tags()` does. */
function replaceInHtmlTags(html: string, needle: string, replacement: string): string {
  return html.replace(/<[^>]*>/g, (tag) => tag.split(needle).join(replacement));
}

/**
 * Block-editor posts store their markup wrapped in `<!-- wp:… -->` delimiters,
 * which WordPress consumed when it rendered the blocks. They are dead weight in
 * the output, and — because they are neither text nor a block tag — they also
 * confuse the paragraph pass, so they come off first.
 */
export function stripBlockComments(html: string): string {
  return html.replace(/<!--\s*\/?wp:[\s\S]*?-->/g, '');
}

/**
 * Authors wrote paragraphs that a shortcode interrupts — `<p>Copy [nectar_btn]
 * more copy</p>` — and the parser hands each side of the shortcode over as its
 * own chunk, so one carries an opening tag it never closes and the other a
 * closing tag that opens nothing. A browser turns each stray tag into an empty
 * paragraph, which is a stray gap in the middle of the copy.
 */
function balanceParagraphs(html: string): string {
  const parts = html.split(/(<p(?=[\s>])[^>]*>|<\/p\s*>)/gi);
  const unclosed: number[] = [];
  const drop = new Set<number>();
  // Odd indices are the tags the split captured.
  for (let i = 1; i < parts.length; i += 2) {
    if (parts[i].startsWith('</')) {
      if (unclosed.length) unclosed.pop();
      else drop.add(i);
    } else {
      unclosed.push(i);
    }
  }
  for (const i of unclosed) drop.add(i);
  return drop.size === 0 ? html : parts.filter((_, i) => !drop.has(i)).join('');
}

/**
 * Turn a chunk of stored WordPress markup into paragraphed HTML: strip the
 * block-editor delimiters, restore the paragraphs `wpautop()` used to add, and
 * drop the paragraph tags the source left dangling.
 */
export function toParagraphs(html: string): string {
  return balanceParagraphs(autop(stripBlockComments(html)));
}
