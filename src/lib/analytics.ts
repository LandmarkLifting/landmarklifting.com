/**
 * Tracking recovered from the WordPress backup.
 *
 * On the old site these were installed by two plugins:
 *   - Google Site Kit  → Tag Manager, GA4 and Google Ads (all modules active,
 *                        each with useSnippet = true)
 *   - Insert Headers and Footers → Facebook Pixel + site-verification metas
 *
 * Set any value to '' to stop that tag being emitted. Tags only render in a
 * production build, so `astro dev` never pollutes the reporting.
 */
export const analytics = {
  /** Google Tag Manager container (Site Kit `tagmanager`). */
  gtmId: 'GTM-5VQ96Q6',

  /**
   * GA4 measurement ID (Site Kit `analytics-4`).
   *
   * NOTE: the old site loaded this gtag snippet *and* GTM. If the GTM
   * container also contains a GA4 tag for this property, pageviews are counted
   * twice — that was already true before the rebuild. Check the container; if
   * GA4 lives inside GTM, blank this out and let GTM own it.
   */
  ga4Id: 'G-S7KT4YH0RN',

  /** Google Ads conversion ID (Site Kit `ads`), configured through gtag. */
  googleAdsId: 'AW-664651796',

  /** Facebook / Meta Pixel, previously injected into the header. */
  facebookPixelId: '1549200572048469',

  /**
   * CallRail number swapping, for a *direct* install. Most accounts deliver the
   * swap script through the GTM container instead — if that is how this one is
   * set up, leave these blank; the container tag is what runs it.
   *
   * For a direct install, CallRail's snippet is
   * `//cdn.callrail.com/companies/<accountId>/<companyKey>/12/swap.js`. Copy the
   * two path segments out of it. The script then renders in the <head>, ahead of
   * everything else, so numbers are swapped before the page paints.
   *
   * The swap runs once per page load. This site does full page navigations, so
   * that is every page; adding Astro's client-side router later would need the
   * swap re-run on each navigation.
   */
  callRail: { accountId: '', companyKey: '' },

  /** Search-engine ownership verification metas. */
  googleSiteVerification: 'FqW5PGe-W7geiFk-kj2Xu3NDwM1DeKVgAnYvigYjuEk',
  bingSiteVerification: '9749C601C166700E5F583BC791F094F7',
} as const;

/**
 * Universal Analytics (UA-68134376-1) was also in the database but has been
 * switched off by Google since July 2023, so it is deliberately not carried
 * over. CallRail's plugin was installed but never configured — no account or
 * company key was ever saved — so there is no direct snippet to restore, and
 * `callRail` above is left blank for the GTM container to own.
 */
