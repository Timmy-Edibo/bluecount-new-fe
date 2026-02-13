import type { Metadata } from 'next';
import { AuthProvider } from '@/contexts/AuthContext';
import { SessionProvider } from '@/contexts/SessionContext';
import './globals.css';

export const metadata: Metadata = {
  title: 'Bluecounts POS',
  description: 'Offline-First Multi-Tenant POS & Inventory',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <AuthProvider>
          <SessionProvider>{children}</SessionProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
