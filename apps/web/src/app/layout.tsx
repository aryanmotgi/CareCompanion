import type { Metadata, Viewport } from 'next';
import { Figtree, Noto_Sans } from 'next/font/google';
import { Analytics } from '@vercel/analytics/next';
import './globals.css';

const figtree = Figtree({
  subsets: ['latin'],
  variable: '--font-figtree',
  display: 'swap',
});

const notoSans = Noto_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-source-sans',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'CareCompanion AI — Cancer Care App for Patients & Caregivers',
    template: '%s | CareCompanion AI',
  },
  description:
    'The all-in-one cancer care app for patients and caregivers. Track chemo side effects, manage medications, understand tumor markers, prep for oncology visits, and coordinate your cancer treatment — powered by AI.',
  keywords: [
    'cancer care app',
    'cancer caregiver',
    'cancer treatment tracker',
    'chemo side effects tracker',
    'oncology visit planner',
    'tumor marker tracker',
    'cancer medication manager',
    'caregiver coordination app',
    'cancer patient organizer',
    'AI health assistant',
  ],
  manifest: '/manifest.json',
  icons: {
    icon: '/logo.svg',
    apple: '/logo-192.png',
  },
  metadataBase: new URL('https://carecompanionai.org'),
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'CareCompanion AI — Cancer Care App for Patients & Caregivers',
    description:
      'Track chemo side effects, manage medications, understand tumor markers, and coordinate cancer care — all in one AI-powered app built for patients and caregivers.',
    url: 'https://carecompanionai.org',
    siteName: 'CareCompanion AI',
    type: 'website',
    locale: 'en_US',
    images: [
      {
        url: '/logo-512.png',
        width: 512,
        height: 512,
        alt: 'CareCompanion AI — Cancer care app logo',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'CareCompanion AI — Cancer Care App for Patients & Caregivers',
    description:
      'Track chemo side effects, manage medications, understand tumor markers, and coordinate cancer care — all in one AI-powered app.',
    images: ['/logo-512.png'],
  },
  robots: {
    index: true,
    follow: true,
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
    <html lang="en" className={`${figtree.variable} ${notoSans.variable}`}>
      <head>
        <meta name="theme-color" content="#6366F1" />
      </head>
      <body className="font-sans antialiased">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'WebApplication',
              name: 'CareCompanion AI',
              url: 'https://carecompanionai.org',
              description:
                'AI-powered cancer care app for patients and caregivers. Track chemo side effects, manage medications, understand tumor markers, and coordinate your cancer treatment.',
              applicationCategory: 'HealthApplication',
              operatingSystem: 'Web',
              offers: {
                '@type': 'Offer',
                price: '0',
                priceCurrency: 'USD',
              },
              featureList: [
                'Cancer treatment tracker',
                'Chemo side effects tracker',
                'Medication manager',
                'Tumor marker tracking',
                'Oncology visit prep',
                'Caregiver coordination',
                'AI health chat',
                'Document scanning',
              ],
            }),
          }}
        />
        {children}
        <Analytics />
      </body>
    </html>
  );
}
