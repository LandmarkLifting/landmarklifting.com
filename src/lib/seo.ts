/**
 * Yoast SEO never stored a finished title. It stored a *template* —
 * `%%title%% %%sep%% %%sitename%%` — and expanded the `%%…%%` variables when
 * WordPress rendered the page. The backup contains those templates verbatim,
 * so a title that still carries one has to be expanded here or the literal
 * `%%title%% %%page%%` ships as the browser tab title.
 */
import { site } from './site';
import type { Doc } from './content';

/** Characters Yoast templates use to separate a title from its branding. */
const SEPARATORS = /[|–—·•]/;

const firstTerm = (doc: Doc, taxonomy: string) =>
  doc.terms.find((t) => t.taxonomy === taxonomy)?.name ?? '';

/**
 * Expand one `%%variable%%`. Yoast dropped any variable it could not fill, so
 * an unknown name resolves to nothing rather than being left on the page.
 */
function expand(name: string, doc: Doc): string {
  switch (name) {
    case 'title':
      return doc.title;
    case 'sitename':
      return site.name;
    case 'sitedesc':
      return site.tagline;
    case 'sep':
      return '|';
    case 'excerpt':
    case 'excerpt_only':
      return doc.excerpt || doc.seo.description;
    case 'primary_category':
    case 'category':
      return firstTerm(doc, 'category');
    case 'tag':
      return firstTerm(doc, 'post_tag');
    case 'currentyear':
      return String(new Date().getFullYear());
    // `%%page%%` is "Page 2 of 5" on a paginated archive. Every route here is a
    // single page, where Yoast expanded it to nothing.
    default:
      return '';
  }
}

/**
 * These templates were written against the page titles of the day, and a title
 * edited later can end up repeating the words the template appends — the Utah
 * service page is `%%title%% in Utah | …` against a title that already reads
 * "Concrete Lifting in Utah". Yoast would happily print "in Utah in Utah"; drop
 * the literal instead when the expanded text already ends with it.
 */
function withoutRepeat(sofar: string, literal: string): string {
  const cut = literal.search(SEPARATORS);
  const phrase = (cut === -1 ? literal : literal.slice(0, cut)).trim();
  if (!phrase) return literal;
  const normalise = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const done = normalise(sofar);
  const tail = normalise(phrase);
  if (!tail || !(done === tail || done.endsWith(` ${tail}`))) return literal;
  return cut === -1 ? '' : literal.slice(cut);
}

/** Tidy up the spacing and any separator left dangling by an empty variable. */
function tidy(title: string): string {
  return title
    .replace(/\s+/g, ' ')
    .replace(/\s*\|\s*/g, ' | ')
    .replace(/^(?:\s*\|)+|(?:\|\s*)+$/g, '')
    .trim();
}

/**
 * The `<title>` for a document: the Yoast template expanded, or the site's own
 * `Page | Landmark Lifting` shape where there is nothing usable to expand.
 */
export function seoTitle(doc: Doc, fallback = `${doc.title} | ${site.name}`): string {
  const template = (doc.seo.title ?? '').trim();
  if (!template) return fallback;
  if (!template.includes('%%')) return template;

  // Split into alternating literal / variable segments, so a literal can be
  // measured against the text the variables have already produced.
  const segments = template.split(/%%([a-z0-9_-]+)%%/gi);
  let out = '';
  /** A template of nothing but variables carries no branding of its own. */
  let onlyVariables = true;

  for (let i = 0; i < segments.length; i++) {
    if (i % 2 === 1) {
      out += expand(segments[i].toLowerCase(), doc);
      continue;
    }
    let literal = segments[i];
    if (literal.trim()) {
      onlyVariables = false;
      literal = withoutRepeat(out, literal);
    }
    out += literal;
  }

  const title = tidy(out);
  if (!title) return fallback;
  return onlyVariables ? `${title} | ${site.name}` : title;
}
