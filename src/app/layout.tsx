import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Kitchen Spurs | Analytics System & Restaurant Demo',
  description:
    'A high-reliability analytics engine capturing browser interactions and server transactional events with real-time dashboard visualizations.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark bg-stone-950 text-stone-100 antialiased">
      <body className="min-h-screen bg-stone-950 font-sans selection:bg-amber-500 selection:text-stone-950">
        {children}
      </body>
    </html>
  );
}
