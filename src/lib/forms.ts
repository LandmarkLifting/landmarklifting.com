/**
 * Form definitions, rebuilt from the WordPress backup.
 *
 * Fields, labels, options, required flags and redirects all come from
 * `wp_gf_form_meta` in the September 2026 dump, cross-checked against 1,733
 * real entries in `wp_gf_entry`. Only two Gravity Forms were still embedded —
 * Get a Quote (#4) and Referral (#6). Schedule Estimate, the old Contact form
 * and Test were retired and are deliberately not rebuilt.
 *
 * Netlify registers a form by parsing the deployed HTML at deploy time, so
 * every field — hidden ones included — must exist in the static markup. A field
 * injected by JavaScript alone is never registered and its value is silently
 * dropped on submit.
 */

export type FieldType =
  | 'text'
  | 'tel'
  | 'email'
  | 'select'
  | 'textarea'
  | 'file'
  | 'checkbox';

export interface Field {
  name: string;
  label: string;
  type: FieldType;
  required?: boolean;
  /** Help text under the input. On a checkbox, the consent wording. */
  hint?: string;
  /** Allows a link in the label; rendered with set:html. */
  labelHtml?: string;
  options?: string[];
  accept?: string;
  multiple?: boolean;
  /** `file` only — enforced client-side and stated in the hint. */
  maxFiles?: number;
  /** Span both columns of the two-column grid. */
  wide?: boolean;
}

export interface FormSpec {
  /** Netlify form name; groups submissions in the dashboard. */
  name: string;
  heading: string;
  intro?: string;
  submitLabel: string;
  /** Post-submit redirect, as configured in Gravity Forms. */
  action: string;
  /** Whether to post the hidden attribution block. */
  attribution: boolean;
  fields: Field[];
}

/**
 * "Service Needed?" — exactly the four options the original offered. Not a
 * guess: these are the only values that appear across 1,733 entries.
 */
const SERVICE_OPTIONS = [
  'Concrete Lifting',
  'Void Filling',
  'New Concrete',
  'Concrete Replacement',
];

/**
 * TCPA consent wording, kept verbatim from the original form. This is the
 * legal basis for texting a lead — do not reword it without asking.
 */
const CONSENT_DESCRIPTION =
  'By entering your phone number, you consent to receive messages for this ' +
  'event via SMS. Message and data rates may apply. Reply STOP to opt out. ' +
  'By proceeding, you confirm that you have read and agree to Landmark ' +
  "Lifting's Terms of Use and Privacy Notice.";

/**
 * Hidden attribution fields.
 *
 * The original captured five (`utmcsr`, `utmcmd`, `utmccn`, `utmctr`,
 * `utmgclid`) using Google Analytics `__utmz` cookie conventions — values like
 * `google`, `organic`, `(direct)`, `(not set)`. Names are modernised here, and
 * `utm_content`, `wbraid`/`gbraid` and the page fields are new.
 *
 * See `Attribution.astro` for how they are filled. Two rules carried over from
 * the audit of the old entries: attribution must be captured on FIRST landing
 * and persisted (65% of entries had data although most visitors submit from a
 * clean URL), and a missing value must post as empty — the old form wrote the
 * literal string `undefined` 493 times into GCLID alone.
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
  'landing_page',
  'referrer',
  'page_submitted_from',
  'user_agent',
] as const;

export const forms: Record<string, FormSpec> = {
  /** Gravity Forms #4. 1,733 entries; the site's main lead form. */
  quote: {
    name: 'quote',
    heading: 'Get a quote',
    intro: 'Tell us what needs lifting and we will get back to you with a price.',
    submitLabel: 'Get my quote',
    action: '/quote-page-thank-you/',
    attribution: true,
    fields: [
      { name: 'first_name', label: 'First Name', type: 'text', required: true },
      { name: 'last_name', label: 'Last Name', type: 'text', required: true },
      { name: 'email', label: 'Email', type: 'email', required: true },
      { name: 'phone', label: 'Phone', type: 'tel', required: true },
      // GF stored one "address" field with four subfields; split out here so
      // each gets a real label and the right autocomplete hint.
      { name: 'address_street', label: 'Street Address', type: 'text', required: true },
      { name: 'address_line2', label: 'Address Line 2', type: 'text' },
      { name: 'address_city', label: 'City', type: 'text', required: true },
      { name: 'address_zip', label: 'ZIP Code', type: 'text', required: true },
      {
        name: 'service_needed',
        label: 'Service Needed?',
        type: 'select',
        required: true,
        options: SERVICE_OPTIONS,
        wide: true,
      },
      {
        name: 'description',
        label: 'Describe the work needed and location',
        type: 'textarea',
        required: true,
        wide: true,
      },
      {
        name: 'photos',
        label: 'Photo Upload',
        type: 'file',
        accept: 'image/jpeg,image/png,image/gif',
        multiple: true,
        maxFiles: 5,
        wide: true,
        hint: 'Optional. Up to 5 photos (jpg, png or gif) — they let us quote far more accurately.',
      },
      {
        name: 'consent',
        label: 'I agree to the privacy policy.',
        labelHtml: 'I agree to the <a href="/privacy/">privacy policy</a>.',
        type: 'checkbox',
        required: true,
        hint: CONSENT_DESCRIPTION,
        wide: true,
      },
    ],
  },

  /** Gravity Forms #6. 5 entries. No attribution fields on the original. */
  referral: {
    name: 'referral',
    heading: 'Refer a friend',
    intro: 'Send us their details and we will take good care of them.',
    submitLabel: 'Send referral',
    action: '/referral-form-thank-you/',
    attribution: false,
    fields: [
      { name: 'your_name', label: 'Your Name', type: 'text', required: true },
      { name: 'your_email', label: 'Your Email', type: 'email', required: true },
      { name: 'your_phone', label: 'Your Text #', type: 'tel', required: true },
      { name: 'friend_name', label: "Your Friends' Name", type: 'text', required: true },
      { name: 'friend_email', label: "Your Friends' Email", type: 'email', required: true },
      { name: 'friend_phone', label: "Your Friends' Phone", type: 'tel', required: true },
      // Fields 9 and 10 were required but UNLABELLED in Gravity Forms, so their
      // intent is not recoverable from the dump. Labelled by inference — worth
      // confirming against a real entry before this goes live.
      {
        name: 'friend_location',
        label: 'Their city or address',
        type: 'text',
        required: true,
      },
      {
        name: 'notes',
        label: 'What do they need doing?',
        type: 'textarea',
        required: true,
        wide: true,
      },
      {
        name: 'photos',
        label: 'Photo Upload',
        type: 'file',
        accept: 'image/jpeg,image/png,image/gif',
        multiple: true,
        maxFiles: 5,
        wide: true,
        hint: 'Optional.',
      },
    ],
  },
};

/**
 * Post-submit destination.
 *
 * Gravity Forms configured this per form, not per page: Get a Quote always went
 * to `/quote-page-thank-you/` wherever it was embedded. `/contact-thank-you/`
 * and `/front-page-form-thank-you/` belong to forms that are no longer embedded
 * — both pages are still built, but nothing routes to them.
 */
export function actionFor(key: string): string {
  return forms[key]?.action ?? '/quote-page-thank-you/';
}
