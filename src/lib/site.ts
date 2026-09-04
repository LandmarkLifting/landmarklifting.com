/**
 * Site-wide configuration recovered from the WordPress options table
 * (`salient_redux`, widgets and menus).
 */

export const site = {
  name: 'Landmark Lifting',
  tagline: 'Utah Concrete Lifting Experts',
  url: 'https://landmarklifting.com',
  logo: '/wp-content/uploads/2024/01/Landmark-lifting-Orange.png',
  logoHeight: 85,
  mobileLogoHeight: 50,
  phone: '801-420-5117',
  phoneHref: 'tel:+18014205117',
  email: 'steve@landmarklifting.com',
  social: {
    facebook: 'https://www.facebook.com/landmarklifting/',
    youtube: 'https://www.youtube.com/channel/UCnRzWT7jm1tlBcxDuoFS2Jw',
    linkedin: 'https://www.linkedin.com/in/landmark-lifting-495610b4',
    instagram: 'https://www.instagram.com/landmarklifting/',
    tiktok: 'https://www.tiktok.com/@landmark.lifting',
  },
  /**
   * Twitter/X handle. The theme had the Twitter icon switched off, but Yoast
   * still published it as `twitter:site`, so the card metadata keeps it.
   */
  twitterHandle: '@LandmarkLifting',
  /** Footer widget areas, as configured in the original footer. */
  locations: [
    {
      name: 'Alpine, Utah',
      phone: '(801) 420-5117',
      phoneHref: 'tel:+18014205117',
      lines: ['256 North Main Street', 'Alpine, Utah 84004'],
    },
    {
      name: 'American Fork, Utah',
      phone: '(801) 420-5117',
      phoneHref: 'tel:+18014205117',
      lines: ['195 South 600 East', 'American Fork, Utah 84003'],
    },
    {
      name: 'Spanish Fork, Utah',
      phone: '(385) 325-2699',
      phoneHref: 'tel:+13853253424',
      lines: ['296 West 1400 North', 'Spanish Fork, UT 84660'],
    },
  ],
} as const;

/**
 * Tally form IDs, replacing the original Gravity Forms.
 *
 * Fill in the ID from a Tally form's share URL (tally.so/r/<ID>). Any form left
 * blank renders a "call us" fallback instead of an empty embed.
 */
export const tallyForms: Record<string, string> = {
  contact: '', // was Gravity Forms #5 "Contact"
  quote: '', // was Gravity Forms #4 "Get a Quote"
  estimate: '', // was Gravity Forms #2 "Schedule Estimate"
  referral: '', // was Gravity Forms #6 "Referral Form"
};

/** Maps the original Gravity Forms IDs onto the Tally form keys above. */
export const gravityFormMap: Record<string, keyof typeof tallyForms> = {
  '1': 'contact',
  '2': 'estimate',
  '3': 'estimate',
  '4': 'quote',
  '5': 'contact',
  '6': 'referral',
};
