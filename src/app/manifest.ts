import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Bluecounts POS',
    short_name: 'Bluecounts',
    description: 'Offline-First Multi-Tenant POS & Inventory',
    start_url: '/',
    display: 'standalone',
    background_color: '#0f172a',
    theme_color: '#0f172a',
    icons: [
      { src: '/icon-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
      { src: '/icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
    ],
  };
}
