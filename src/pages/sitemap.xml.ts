import type { APIRoute } from 'astro';
import { categories, permalink, routableDocs, tags } from '../lib/content';
import { site } from '../lib/site';

export const GET: APIRoute = () => {
  const urls: { loc: string; lastmod?: string; priority: string }[] = [];

  for (const d of routableDocs) {
    if (d.seo.noindex) continue;
    urls.push({
      loc: new URL(permalink(d), site.url).href,
      lastmod: (d.modified || d.date).replace(' ', 'T').replace(/$/, '+00:00'),
      priority: permalink(d) === '/' ? '1.0' : d.type === 'post' ? '0.6' : '0.8',
    });
  }
  for (const c of categories()) {
    urls.push({ loc: new URL(`/category/${c.slug}/`, site.url).href, priority: '0.4' });
  }
  for (const t of tags()) {
    urls.push({ loc: new URL(`/tag/${t.slug}/`, site.url).href, priority: '0.3' });
  }

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (u) =>
      `  <url><loc>${u.loc}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ''}<priority>${u.priority}</priority></url>`,
  )
  .join('\n')}
</urlset>
`;

  return new Response(body, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};
