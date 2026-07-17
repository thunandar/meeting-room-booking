import type { Metadata } from 'next';
import { Geist, Instrument_Serif } from 'next/font/google';
import { AuthProvider } from '@/lib/auth';
import { Toaster } from '@/lib/toast';
import './globals.css';

const geist = Geist({ subsets: ['latin'], variable: '--font-geist-sans' });
const instrumentSerif = Instrument_Serif({ weight: '400', subsets: ['latin'], variable: '--font-instrument-serif' });

export const metadata: Metadata = {
  title: 'Meeting Room Booking',
  description: 'Bookings for a single meeting room, with role-based access',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body
        className={`${geist.variable} ${instrumentSerif.variable} min-h-screen bg-page-warm font-sans text-[15px] text-ink antialiased`}
      >
        <AuthProvider>{children}</AuthProvider>
        <Toaster />
      </body>
    </html>
  );
}
