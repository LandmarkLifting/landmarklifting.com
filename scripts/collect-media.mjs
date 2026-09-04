/**
 * Works out which of the 401 WordPress attachments the rebuilt site actually
 * references, then copies just those out of the backup into public/, keeping
 * the original /wp-content/uploads/... paths so image URLs stay stable.
 *
 * Usage: node scripts/collect-media.mjs [--backup <path>]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { parseShortcodes } from '../src/lib/shortcode.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argIdx = process.argv.indexOf('--backup');
const BACKUP =
  argIdx > -1
    ? process.argv[argIdx + 1]
    : '/Users/zac/quarantine/landmarklifting.com_2026-Sep-04_backup_6a9af8b33c4552.27435530';
const UPLOADS = path.join(BACKUP, 'wp-content/uploads');
const DEST = path.join(ROOT, 'public/wp-content/uploads');

/*
 * This is a migration step, not a build step. Its outputs — the copied files,
 * media-sizes.json and used_media.json — are committed, so a clone (or CI)
 * builds without the backup ever being present.
 *
 * Refuse to run rather than continue against a missing source: carrying on
 * would prune every image and write an empty media-sizes.json, quietly
 * breaking intrinsic image sizing and hero selection.
 */
if (!fs.existsSync(UPLOADS)) {
  console.error(`collect-media: no uploads directory at\n  ${UPLOADS}\n`);
  console.error('Pass the backup location with --backup <path>.');
  console.error('This script is only needed when re-importing content from the');
  console.error('WordPress backup; the normal build does not use it.');
  process.exit(1);
}

const read = (f) => JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data', f), 'utf8'));
const docs = read('docs.json');
const blocks = Object.values(read('blocks.json'));
const attachments = read('attachments.json');

/** Shortcode attributes that hold attachment IDs. */
const ID_ATTRS = ['image_url', 'image_2_url', 'background_image', 'images', 'icon_image', 'bg_image'];

const ids = new Set();
const urls = new Set();

const walk = (nodes) => {
  for (const n of nodes) {
    if (n.kind !== 'tag') {
      continue;
    }
    for (const attr of ID_ATTRS) {
      const v = n.attrs[attr];
      if (v) for (const id of v.split(',')) if (/^\d+$/.test(id.trim())) ids.add(id.trim());
    }
    walk(n.children);
  }
};

const URL_RE = /\/wp-content\/uploads\/([^\s"')\\]+\.(?:jpe?g|png|gif|webp|svg|mp4|ico))/gi;

for (const d of [...docs, ...blocks]) {
  const content = d.content || '';
  walk(parseShortcodes(content));
  for (const m of content.matchAll(URL_RE)) urls.add(m[1]);
}
/** Page header backgrounds and OG images are stored as either an ID or a URL. */
const addRef = (value) => {
  const v = String(value || '').trim();
  if (!v) return;
  if (/^\d+$/.test(v)) {
    ids.add(v);
    return;
  }
  for (const m of v.matchAll(URL_RE)) urls.add(m[1]);
};

for (const d of docs) {
  addRef(d.featured_image);
  addRef(d.page_header?.bg);
  addRef(d.seo?.og_image);
}

// Site chrome referenced from src/lib/site.ts rather than page content.
addRef('/wp-content/uploads/2024/01/Landmark-lifting-Orange.png');

const files = new Set(urls);
const unresolved = [];
for (const id of ids) {
  const a = attachments[id];
  if (a?.file) files.add(a.file);
  else unresolved.push(id);
}

let copied = 0;
let bytes = 0;
const missing = [];
for (const f of [...files].sort()) {
  const src = path.join(UPLOADS, f);
  if (!fs.existsSync(src)) {
    missing.push(f);
    continue;
  }
  const dst = path.join(DEST, f);
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.copyFileSync(src, dst);
  bytes += fs.statSync(src).size;
  copied++;
}

// Remove anything left behind by an earlier run so public/ mirrors the
// current content exactly.
let pruned = 0;
if (fs.existsSync(DEST)) {
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(p);
        if (fs.readdirSync(p).length === 0) fs.rmdirSync(p);
      } else {
        const rel = path.relative(DEST, p);
        if (!files.has(rel)) {
          fs.unlinkSync(p);
          pruned++;
        }
      }
    }
  };
  walk(DEST);
}

// Record intrinsic dimensions so pages can size images correctly: no
// upscaling past the source resolution, and no layout shift while loading.
const sizes = {};
for (const f of [...files].sort()) {
  const src = path.join(UPLOADS, f);
  if (!fs.existsSync(src)) continue;
  if (/\.(svg|mp4)$/i.test(f)) continue;
  try {
    const meta = await sharp(src).metadata();
    // `alpha` distinguishes logos and graphics from photographs, which decides
    // whether an image is usable as a full-bleed hero background.
    if (meta.width && meta.height) {
      sizes[f] = { w: meta.width, h: meta.height, alpha: Boolean(meta.hasAlpha) };
    }
  } catch {
    /* unreadable image — pages simply omit the size hint */
  }
}

fs.writeFileSync(
  path.join(ROOT, 'src/data/media-sizes.json'),
  JSON.stringify(sizes, null, 1),
);

fs.writeFileSync(
  path.join(ROOT, 'src/data/used_media.json'),
  JSON.stringify([...files].sort(), null, 1),
);

console.log(`referenced ids: ${ids.size} (unresolved: ${unresolved.length})`);
console.log(`measured ${Object.keys(sizes).length} images`);
console.log(`copied ${copied} files, ${(bytes / 1048576).toFixed(1)} MB${pruned ? `, pruned ${pruned} stale` : ""}`);
if (unresolved.length) console.log('unresolved attachment ids:', unresolved.join(', '));
if (missing.length) console.log('missing from backup:', missing.join(', '));
