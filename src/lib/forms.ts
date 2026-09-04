/**
 * Form definitions for the Netlify Forms rebuild.
 *
 * The original site used Gravity Forms. Its field definitions lived in the
 * WordPress `wp_gf_form_meta` table and were NOT carried into this repo — only
 * the form names and IDs survived, in `gravityFormMap`. The specs below are
 * therefore a considered reconstruction for a concrete-lifting contractor, not
 * a transcription of the originals. If exact parity matters, the real field
 * JSON is still recoverable from the backup's SQL dump.
 *
 * Netlify registers a form by parsing the deployed HTML at deploy time, so
 * every field — hidden ones included — must exist in the static markup. Fields
 * injected by JavaScript alone are never registered and their values are
 * silently dropped on submit.
 */

export type FieldType =
  | 'text'
  | 'tel'
  | 'email'
  | 'date'
  | 'select'
  | 'textarea'
  | 'file';

export interface Field {
  name: string;
  label: string;
  type: FieldType;
  required?: boolean;
  /** Rendered under the input as help text. */
  hint?: string;
  /** Options for `select`. */
  options?: string[];
  /** `file` only — accepted MIME types. */
  accept?: string;
  /** `file` only — allow selecting several files. */
  multiple?: boolean;
  /** Span both columns in the two-column grid. */
  wide?: boolean;
}

export interface FormSpec {
  /** Netlify form name. Submissions are grouped under this in the dashboard. */
  name: string;
  heading: string;
  intro?: string;
  submitLabel: string;
  /** Where to send the browser after a successful post. */
  action: string;
  fields: Field[];
}

const JOB_TYPES = [
  'Driveway',
  'Sidewalk or walkway',
  'Patio',
  'Garage floor',
  'Steps or stairs',
  'Pool deck',
  'Void filling',
  'Commercial or industrial',
  'Other / not sure',
];

/**
 * Attribution fields, posted with every form.
 *
 * The site runs Google Ads (`AW-664651796`) and a Meta Pixel, so a lead with no
 * source attached cannot be tied back to the campaign that paid for it. These
 * are populated by `Attribution.astro`, which records the FIRST touch of a
 * session — the ad click usually lands on a service or location page, and the
 * form is submitted later from `/contact/` or `/get-a-quote/`, by which point
 * the query string is long gone.
 *
 * They render as real hidden inputs with empty values so Netlify registers
 * them; the script fills them in on load.
 */
export const ATTRIBUTION_FIELDS = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'gclid',
  'gbraid',
  'wbraid',
  'fbclid',
  'first_landing_page',
  'referrer',
  'submitted_from',
] as const;

/** Contact details shared by most forms. */
const contactFields: Field[] = [
  { name: 'name', label: 'Name', type: 'text', required: true },
  { name: 'phone', label: 'Phone', type: 'tel', required: true },
  { name: 'email', label: 'Email', type: 'email', required: true },
];

export const forms: Record<string, FormSpec> = {
  quote: {
    name: 'quote',
    heading: 'Get a quote',
    intro: 'Tell us what needs lifting and we will get back to you with a price.',
    submitLabel: 'Request my quote',
    action: '/quote-page-thank-you/',
    fields: [
      ...contactFields,
      {
        name: 'address',
        label: 'Service address or city',
        type: 'text',
        required: true,
        hint: 'Where the concrete is. We serve most of the Wasatch Front.',
      },
      { name: 'job_type', label: 'What needs lifting?', type: 'select', options: JOB_TYPES },
      {
        name: 'message',
        label: 'Tell us about the problem',
        type: 'textarea',
        wide: true,
        hint: 'How far has it settled? How long has it been sinking?',
      },
      {
        name: 'photos',
        label: 'Photos of the area',
        type: 'file',
        accept: 'image/*',
        multiple: true,
        wide: true,
        hint: 'Optional, but photos let us quote far more accurately.',
      },
    ],
  },

  contact: {
    name: 'contact',
    heading: 'Contact us',
    intro: 'Send us a message and we will get straight back to you.',
    submitLabel: 'Send message',
    action: '/contact-thank-you/',
    fields: [
      { name: 'name', label: 'Name', type: 'text', required: true },
      { name: 'email', label: 'Email', type: 'email', required: true },
      { name: 'phone', label: 'Phone', type: 'tel' },
      { name: 'message', label: 'Message', type: 'textarea', required: true, wide: true },
    ],
  },

  estimate: {
    name: 'estimate',
    heading: 'Schedule an estimate',
    intro: 'Pick a day that suits you and we will confirm the time.',
    submitLabel: 'Request my estimate',
    action: '/contact-thank-you/',
    fields: [
      ...contactFields,
      { name: 'address', label: 'Service address', type: 'text', required: true },
      { name: 'job_type', label: 'What needs lifting?', type: 'select', options: JOB_TYPES },
      { name: 'preferred_date', label: 'Preferred date', type: 'date' },
      {
        name: 'preferred_time',
        label: 'Preferred time',
        type: 'select',
        options: ['Morning', 'Afternoon', 'Either works'],
      },
      { name: 'notes', label: 'Anything else we should know?', type: 'textarea', wide: true },
    ],
  },

  referral: {
    name: 'referral',
    heading: 'Refer someone to us',
    intro: 'Send us their details and we will take good care of them.',
    submitLabel: 'Send referral',
    action: '/referral-form-thank-you/',
    fields: [
      { name: 'name', label: 'Your name', type: 'text', required: true },
      { name: 'phone', label: 'Your phone', type: 'tel', required: true },
      { name: 'email', label: 'Your email', type: 'email', required: true },
      { name: 'referral_name', label: 'Their name', type: 'text', required: true },
      { name: 'referral_phone', label: 'Their phone', type: 'tel', required: true },
      { name: 'referral_email', label: 'Their email', type: 'email' },
      {
        name: 'notes',
        label: 'How do you know them, and what do they need?',
        type: 'textarea',
        wide: true,
      },
    ],
  },
};

/**
 * Per-page thank-you overrides.
 *
 * WordPress had a separate thank-you page for each place the quote form
 * appeared, and those pages are all still built, so the same form keeps
 * sending visitors to the page that matches where they submitted it.
 */
const THANK_YOU_BY_PATH: Record<string, string> = {
  '/': '/front-page-form-thank-you/',
  '/contact/': '/contact-thank-you/',
  '/get-a-quote/': '/quote-page-thank-you/',
};

/** The post-submit destination for `key` when submitted from `pathname`. */
export function actionFor(key: string, pathname: string): string {
  const spec = forms[key];
  if (key === 'quote' && THANK_YOU_BY_PATH[pathname]) return THANK_YOU_BY_PATH[pathname];
  return spec?.action ?? '/contact-thank-you/';
}
