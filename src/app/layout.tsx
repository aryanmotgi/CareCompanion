import type { Metadata, Viewport } from 'next';
import { Outfit, Source_Sans_3 } from 'next/font/google';
import { SupabaseProvider } from '@/components/providers/SupabaseProvider';
import './globals.css';

const outfit = Outfit({
  subsets: ['latin'],
  variable: '--font-outfit',
  display: 'swap',
});

const sourceSans = Source_Sans_3({
  subsets: ['latin'],
  variable: '--font-source-sans',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'CareCompanion AI',
  description: 'AI-powered health organizer for cancer patients and their caregivers',
  manifest: '/manifest.json',
  icons: {
    icon: '/logo.svg',
    apple: '/logo-192.png',
  },
  openGraph: {
    title: 'CareCompanion AI',
    description: 'AI-powered health organizer for cancer patients and their caregivers',
    url: 'https://carecompanionai.org',
    siteName: 'CareCompanion AI',
    type: 'website',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'CareCompanion',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${outfit.variable} ${sourceSans.variable}`}>
      <body className="font-sans antialiased">
        <SupabaseProvider>{children}</SupabaseProvider>
      </body>
    </html>
  );
}
