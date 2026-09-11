import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import './lab.css';
import './advanced.css';
import './code.css';
import './pipeline.css';
import './workspace.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  metadataBase: new URL(
    'https://your-site.example',
  ),
  title: 'ESPLAB | Interactive ESP32 Atlas',
  description:
    'Explore 14 ESP32 chip families in 3D, wire virtual devices, and learn GPIO, protocols, and memory through hands-on experiments.',
  openGraph: {
    title: 'ESPLAB | The interactive ESP32 atlas',
    description:
      'Explore the hardware. Build a circuit. Understand every byte.',
    images: [
      {
        url: '/og.png',
        width: 1733,
        height: 907,
        alt: 'ESPLAB | The interactive ESP32 atlas',
      },
    ],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ESPLAB | The interactive ESP32 atlas',
    description: 'An interactive electronics workbench for curious minds.',
    images: ['/og.png'],
  },
  icons: { icon: '/favicon.svg' },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
