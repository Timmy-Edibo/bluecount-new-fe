import type { Metadata, Viewport } from 'next';
import { AuthProvider } from '@/contexts/AuthContext';
import { SessionProvider } from '@/contexts/SessionContext';
import { PWARegister } from '@/components/PWARegister';
import './globals.css';

export const metadata: Metadata = {
  title: 'Bluecounts POS',
  description: 'Offline-First Multi-Tenant POS & Inventory',
  manifest: '/manifest.webmanifest',
};

export const viewport: Viewport = {
  themeColor: '#0f172a',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <PWARegister />
        <AuthProvider>
          <SessionProvider>{children}</SessionProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
