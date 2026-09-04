import type { APIRoute } from 'astro';
import { mediaUrl, permalink, posts } from '../lib/content';
import { site } from '../lib/site';

const esc = (s: string) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

export const GET: APIRoute = () => {
  const items = posts
    .map((p) => {
      const url = new URL(permalink(p), site.url).href;
      const img = mediaUrl(p.featured_image);
      return `    <item>
      <title>${esc(p.title)}</title>
      <link>${url}</link>
      <guid isPermaLink="true">${url}</guid>
      <pubDate>${new Date(p.date.replace(' ', 'T')).toUTCString()}</pubDate>
      <description>${esc(p.seo.description || '')}</description>
${img ? `      <enclosure url="${new URL(img, site.url).href}" type="image/jpeg" />\n` : ''}    </item>`;
    })
    .join('\n');

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${esc(site.name)}</title>
    <link>${site.url}/</link>
    <description>${esc(site.tagline)}</description>
    <language>en-us</language>
${items}
  </channel>
</rss>
`;
  return new Response(body, { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' } });
};
