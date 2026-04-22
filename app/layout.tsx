import type {Metadata} from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'EduQuest Multiplayer',
  description: 'Game edukasi multiplayer dengan sistem otentikasi lokal dan Firebase.',
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
