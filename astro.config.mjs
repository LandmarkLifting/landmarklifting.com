import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://landmarklifting.com',
  trailingSlash: 'always',
  build: { format: 'directory' },
  compressHTML: true,
});
