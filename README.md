# Landmark Lifting — Astro rebuild

A static rebuild of landmarklifting.com, reconstructed from the September 2026
WordPress backup after the original site was compromised. Content, metadata,
redirects and media all come from the backup's database dump; nothing is
carried over from the WordPress runtime.

- **Framework:** Astro (static output, no server rendering)
- **Host:** Netlify (`netlify.toml`)
- **Original stack:** WordPress + Salient theme + WPBakery page builder

## Commands

```bash
npm install
npm run dev       # local dev server
npm run build     # collect media, generate redirects, build to dist/
npm run verify    # post-build link/image/metadata checks
npm run preview   # build, then serve the output locally
```

`npm run build` is `scripts/build-redirects.mjs` then `astro build`. It reads
only what is committed, so a fresh clone or a CI runner builds with no extra
setup.

`npm run media` is separate on purpose. It re-imports images from the WordPress
backup and is the **only** thing that needs that 978 MB folder — its outputs
(`public/wp-content/uploads/`, `src/data/media-sizes.json`,
`src/data/used_media.json`) are committed. It refuses to run if the backup is
missing rather than pruning every image and writing empty metadata.

## How the content works

WordPress stored every page as Salient/WPBakery shortcode markup
(`[vc_row][vc_column][vc_column_text]…`). That markup is preserved verbatim in
`src/data/docs.json` and parsed at build time:

| File | Role |
| --- | --- |
| `src/lib/shortcode.ts` | Parses shortcode markup into a node tree |
| `src/components/Blocks.astro` | Maps each shortcode to a component |
| `src/components/blocks/*.astro` | One component per shortcode family |
| `src/lib/content.ts` | Loads the data, rebuilds WordPress permalinks |
| `src/lib/render.ts` | Translates shortcode attributes to CSS |
| `src/lib/site.ts` | Site config recovered from `wp_options` |

Thirty distinct shortcodes appear in the content; all of them are handled. An
unrecognised shortcode renders its children rather than dropping them, so new
content can never silently vanish.

### Data files (`src/data/`)

Generated from the backup's SQL dump. They are checked in — the backup is not a
build dependency, except when re-running `collect-media.mjs`.

- `docs.json` — 80 pages + 23 posts: content, SEO metadata, hero settings
- `attachments.json` — the media library (ID → file, alt text)
- `blocks.json` — reusable content blocks (`[ls_content_block]`)
- `menus.json` — all six WordPress nav menus
- `redirects.json` — rules from the Redirection plugin
- `service-areas.json` — map marker data (see below)
- `used_media.json` — which files `collect-media.mjs` copied
- `media-sizes.json` — intrinsic image dimensions, measured at build time

## Design

The brand was recovered from the Salient theme configuration (`salient_redux`
and the generated `salient-dynamic-styles.css`) rather than guessed — the
palette and typefaces are the originals:

- Accent `#f15c28`, ink `#221e1e`
- Roboto for body copy, Roboto Condensed for headings (700, uppercase)
- Container 1100px, wide container 1425px

On top of that, `src/styles/global.css` is a refreshed system rather than a
transcription of the old CSS:

- **Fluid type scale** (`--step-h1` … `--step-lead`). The large end of each
  clamp matches the original desktop size, so nothing renders bigger than the
  design it replaces; the small end is a proper mobile size.
- **Readable body copy** — 1.65 line-height, and a `--measure` cap so text in a
  full-width column does not run to 130 characters.
- **A spacing scale** (`--space-*`, `--section-y`) instead of ad-hoc pixels.
- **Warm neutrals** chosen to sit with the orange, layered shadows, and a
  consistent radius scale.
- **Component detailing**: quieter accordions, pill before/after labels,
  a dropdown affordance and active-page underline in the nav, a sticky
  translucent header, and card treatments for the blog and category grids.

### Why the header is dark

The logo is drawn for a dark ground. Its keyline and the whole "Lifting" script
wordmark are white, so on a light header both disappear and only "LANDMARK"
reads — half the company name was invisible. The header is dark ink with white
navigation, which also ties it to the hero and footer.

### Hero backgrounds

The band uses the page header's own background image. A featured image only
stands in when it is actually usable as one: `collect-media.mjs` records each
image's dimensions and whether it has an alpha channel, and transparency means
a logo rather than a photograph. Without that rule several pages were stretching
a logo across the hero — one of them 200x100.

### Page-type treatments

Not every page is the same shape, so a few types get their own handling rather
than one generic body layout:

- **Content outside a row** — the legal pages, thank-you pages and a few others
  keep their body as plain HTML with no WPBakery row around it. Without a
  wrapper that renders edge-to-edge at ~150 characters a line.
  `PageContent.astro` groups any such run into a contained, readable block.
- **Thank-you pages** — `ThankYou.astro`. The originals were one centred line
  in white space, immediately after someone asked for a quote. The client's
  message is kept verbatim and given a confirmation card, "what happens next",
  and somewhere to go.
- **Blog posts** — a single measured column (68ch) at lead size.
- **City / service pages** — see the media-row scrim below.

### Long "headings"

138 headings in the imported content are really sentences; the longest runs 293
characters. Set as display type (34px uppercase condensed) they were
unreadable, so anything over 90 characters renders as lead prose instead
(`.h--prose`). The tag is untouched — only the appearance changes — so document
structure and SEO are unaffected.

### Heroes and media rows

Every hero uses one treatment: the photo, a dark two-layer gradient, white type.
The original set a dark font colour on some heroes, which meant a near-white
scrim that bleached the photo and left the type low-contrast.

Separately, 36 rows across the 37 city pages put light text over a background
photo or an autoplaying video **with no overlay configured** — the copy sat
directly on moving footage. Any row combining light text with background media
now gets a guaranteed scrim, and background video is dimmed and desaturated so
it reads as ambience rather than competing with the words.

### One <h1> per page

The hero supplies each page's `<h1>`, so an `<h1>` in the body would be a second
top-level heading. Body-level `h1`s are demoted to `h2` before rendering. All
114 pages have exactly one.

### Column widths

WPBakery fractions become `.col--1_2`, `.col--2_3` … classes that set
`--col-width` **in the stylesheet**, never inline. This matters: an inline
custom property beats every media query, so inlining the width would make the
responsive rules impossible to apply. Only a fraction with no matching class
falls back to an inline width (see `KNOWN_WIDTHS` in `Blocks.astro`).

### Images

`scripts/collect-media.mjs` measures every image with sharp and writes
`src/data/media-sizes.json`. Figures render with real `width`/`height`
attributes (no layout shift) and are capped at their intrinsic width, so a
252px logo is never stretched across a 1100px column.

## Media

Only the 152 files actually referenced by the rebuilt site are copied out of the
backup (~19 MB of the original 522 MB library). They keep their original
`/wp-content/uploads/...` paths so existing image URLs and any inbound links
still resolve.

To re-copy after content changes:

```bash
node scripts/collect-media.mjs --backup /path/to/backup
```

## Redirects

`scripts/build-redirects.mjs` turns the Redirection plugin's rules into
`public/_redirects`. It follows redirect chains to their final destination in a
single hop, normalises trailing slashes, and refuses to emit a redirect that
would land on a 404. Legacy WordPress endpoints (`/wp-admin/*`, `/feed/`,
`/author/*`, …) are also handled.

Do not edit `public/_redirects` by hand — change the script or
`src/data/redirects.json` and re-run the build.

**Rule order matters.** `_redirects` is matched top to bottom and the first
match wins, so an exact rule must never sit below a wildcard that would swallow
it. The generator writes all 209 exact rules first and the 2 wildcards last.

(This also avoids a Cloudflare-specific trap, if the site ever moves back: there,
every rule from the first wildcard onwards counts as "dynamic" and only 100 are
honoured — with wildcards mid-file, 29 rules were silently dropped.)

A couple of legacy URLs contain non-ASCII characters (one has a literal
ellipsis); those are percent-encoded on the way out, or the rule never matches
what the browser actually sends.

All 209 exact rules are verified end to end against a local `wrangler dev`.

## Forms

The original used Gravity Forms, which has no static equivalent. Forms now embed
**Tally**. Add your form IDs in `src/lib/site.ts`:

```ts
export const tallyForms = {
  contact:  '',  // was Gravity Forms #5
  quote:    '',  // was Gravity Forms #4
  estimate: '',  // was Gravity Forms #2
  referral: '',  // was Gravity Forms #6
};
```

The ID is the part after `tally.so/r/`. Until an ID is filled in, that form
renders a call-us / email-us fallback instead of an empty embed, so no page
ships a dead form.

## Service-area map

The original page held a complete HTML document — Leaflet map and all — pasted
into a raw-HTML block. It has been rebuilt as
`src/components/blocks/ServiceAreaMap.astro`, with the 37 markers in
`src/data/service-areas.json`. Leaflet loads lazily from a CDN; if it is
unavailable, the linked list of service areas below the map is the fallback.

## Tracking

Everything the old site actually ran, recovered from the database and
re-implemented in `src/components/Analytics.astro`. IDs live in
`src/lib/analytics.ts`; blank any value to drop that tag.

| Tag | ID | Was installed by |
| --- | --- | --- |
| Google Tag Manager | `GTM-5VQ96Q6` | Site Kit (`tagmanager`) |
| GA4 | `G-S7KT4YH0RN` | Site Kit (`analytics-4`) |
| Google Ads | `AW-664651796` | Site Kit (`ads`) |
| Meta/Facebook Pixel | `1549200572048469` | Insert Headers and Footers |
| Google site verification | `FqW5PGe-…` | Insert Headers and Footers |
| Bing site verification | `9749C601…` | Insert Headers and Footers |

Tags render **only in production builds**, so `astro dev` never pollutes
reporting. GTM's snippet is in `<head>` with its `<noscript>` iframe first in
`<body>`, as Google requires.

**Worth checking:** the old site loaded both GTM *and* a GA4 gtag snippet. If
the GTM container also holds a GA4 tag for this property, pageviews are counted
twice — that was already true before the rebuild. Open the container; if GA4
lives inside it, blank `ga4Id` and let GTM own it.

Not carried over: Universal Analytics `UA-68134376-1` (Google switched it off in
July 2023), and CallRail — its plugin was installed but never configured, so
there was no account key to restore.

## Verification

`npm run verify` fails if any page has a broken internal link, a missing image,
a leaked shortcode, stray `null` metadata, an unexpected `noindex`, or a
`var(--token)` with no definition. Run it after any content or design change.

The rendered pages were also swept in a real browser across 24 representative
URLs at desktop and mobile, checking for horizontal overflow, images scaled past
their own resolution, text with too little contrast against its background, and
pages without exactly one `<h1>` — all clean.

Reveal-on-scroll content is gated behind a `.js` class set in `<head>`, so with
scripting off (or if the observer never fires) the copy renders visible rather
than staying at `opacity: 0`.

## SEO notes for the WordPress → Astro move

What is already handled:

- **Trailing slashes**, handled at four layers:
  1. `trailingSlash: 'always'` + directory output, so the build emits
     `/about/index.html` and every generated link ends in a slash.
  2. Imported markup is normalised — WordPress content full of bare
     `/contact` links gets the slash added at render time.
  3. `_redirects` carries an explicit **301** for every page's slash-less form.
     The runtime's own `auto-trailing-slash` only answers **307** (temporary),
     which tells search engines to keep the un-slashed URL indexed — the
     opposite of what you want when consolidating signals.
  4. `npm run verify` fails the build if any internal link omits the slash.

  Verified against a local `wrangler dev`: all 112 pages return 301 from their
  slash-less URL and 200 from the canonical one.
- **Permalinks** match WordPress exactly, 104 of 104, including nested children.
- **301s**, not 302s, for all 92 redirect rules, each collapsed to a single hop.
- **Old sitemap URLs.** Google has Yoast's `/sitemap_index.xml` and its
  per-type sitemaps on file; those now 301 to `/sitemap.xml`.
- **Self-referencing canonicals** and matching `og:url` on every page.
- **One `<h1>` per page**, and `<title>`s are unique across the site.
- **Structured data**: organisation on every page, breadcrumbs on pages,
  `BlogPosting` on posts.
- **`robots.txt`** allows everything and points at the sitemap; the site was
  `blog_public = 1` in WordPress, so that matches.
- **Tag and category archives** were indexable in Yoast and are rebuilt, so
  those URLs keep working.

Worth doing at launch, outside the codebase:

1. **Pick a canonical host.** There is no www → apex rule in `_redirects`
   because Netlify handles it: add both domains under Domain management and set
   the apex as primary, and Netlify 301s `www` to it (canonicals already point
   at the apex).
2. **Resubmit the sitemap** in Search Console and watch Coverage for a few
   weeks; the redirect map is the safety net but it is worth seeing it settle.
3. **Confirm 404s return a real 404 status**, not 200. Netlify serves
   `dist/404.html` automatically for unmatched paths — verify once deployed.

Known gaps in the *source* content, not the migration:

- **4 pages have no meta description** (`/privacy-policy/`, `/cookies/`,
  `/contact-thank-you/`, and one post) — they had none in WordPress either.
- **152 of 401 media items have no alt text** in the library. Content images
  fall back to the attachment title where there is one; the rest render with an
  empty alt. Writing real alt text is a content job, not something to invent.
- **Thank-you pages are indexable**, as they were in WordPress. Most sites
  `noindex` them so they do not surface in search — a one-line change if wanted.

## Putting this on GitHub

The repository is ~26 MB across 243 files, largest file 4 MB — comfortably
inside GitHub's limits (100 MB per file, 1 GB recommended per repo). No Git LFS,
no history rewriting, nothing special. `node_modules/`, `dist/`, `.astro/`,
`.wrangler/` and `.DS_Store` are ignored; the ~19 MB of images under
`public/wp-content/uploads/` are committed on purpose, because they are the
site's content and never change.

```bash
git init -b main
git add .
git commit -m "Rebuild landmarklifting.com in Astro from the WordPress backup"
gh repo create landmarklifting --private --source=. --push   # or add a remote by hand
```

There are no credentials in the repo. The analytics IDs in
`src/lib/analytics.ts` (GTM, GA4, Google Ads, Meta Pixel) are public
identifiers — they appear in the HTML of every page — so they are safe either
way, but the repo can stay private if you would rather.

### Continuous deployment

Connect the repo in Netlify (**Add new site → Import an existing project**).
`netlify.toml` already sets everything, so the defaults it offers should be
left alone:

- Build command: `npm run build`
- Publish directory: `dist`
- Node: 22 (pinned in `netlify.toml`)

Because the build no longer depends on the backup, this works on a clean
checkout. Re-importing content is a deliberate local step (`npm run media`),
and the result gets committed like any other change.

## Deployment notes

- `netlify.toml` sets the build command, publish directory and Node version.
- `_redirects` and `_headers` are read from `dist/` by Netlify directly.
- Add the custom domain in **Site configuration → Domain management**, and set
  the apex as primary so `www` redirects to it (see the SEO notes above).
- `site` in `astro.config.mjs` drives canonical URLs, the sitemap and RSS —
  update it if the domain changes.
- Netlify's "Pretty URLs" post-processing also normalises trailing slashes, but
  the explicit 301s in `_redirects` are matched first, so the permanent status
  is what visitors and crawlers get.

## Coverage audit

Every URL Yoast recorded for the original site was checked against the build:

| | |
| --- | --- |
| Indexable URLs the original declared | **129** |
| Served directly by the rebuild | 115 |
| Redirected to a live page | 14 |
| Dead (404, no redirect) | **0** |

Permalinks were also compared one by one against WordPress's own: **104 of 104
match exactly**, including nested children such as
`/how-it-works/what-we-do/` and
`/landmark-lifting-2/landmark-lifting-service-calendar/` (WordPress nests a
child under its parent's slug even when the parent is the front page).

Media was audited the same way: every `/wp-content/uploads/...` reference in
page content, raw-HTML blocks, per-page custom CSS and SEO fields resolves to a
copied file — 153 of 153, nothing missing and nothing dead-weight.

## Deliberately not carried over

- WooCommerce and account pages (checkout, order confirmation/failure, 14
  private products) and a leftover `test` page. Redirects that pointed at them
  are preserved and now resolve to sensible live pages.
- WordPress itself: no plugins, admin, comments, or PHP.

## Not migrated — with reasons

- **Customizer "Additional CSS": `a { font-weight: bold }`.** This one rule was
  live sitewide. It is not carried over because the refreshed design gives body
  links an underline affordance instead, and bold-plus-underline on every link
  reads heavy. To restore it, add that rule to `src/styles/global.css`.
- **Two unpublished drafts**: `concrete-sealing` (26 KB, last touched 2022) and
  `concrete-lifting-in-st-george-utah` (24 KB, July 2025). Never published, so
  never had URLs. The St. George one fits the existing city-page pattern and is
  close to publishable if you want it.
- **14 WooCommerce products** — all `private`, never publicly visible.
- **Two WPCode snippets** — both drafts, so inactive.
- **Post revisions (172), AMP validation records, Gutenberg `wp_global_styles`**
  — WordPress internals, not content.

## Known data quirks from the original site

- `/the-hidden-enemy-how-water-penetration-damages-your-concrete/` existed as
  both a page and a post. The newer, longer page wins; see `routableDocs` in
  `src/lib/content.ts`.
- The map linked Lehi via a typo'd slug (`concrete-lifting-in-iehi-utah`); it
  now points at the real page. The typo'd URL still redirects.
- The Alpine footer widget's phone link pointed at a different number from the
  one displayed. Both now use the displayed number, (801) 420-5117 — worth
  confirming that is correct.
