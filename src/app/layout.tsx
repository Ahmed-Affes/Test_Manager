import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Test Manager — Software Verification & Quality Assurance Platform',
  description:
    'Collaborative software testing and verification platform preserving complete historical fidelity, audit logs, test execution evidence, and release sign-off gating.',
  icons: {
    icon: '/favicon.svg',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-zinc-950 text-zinc-100 antialiased selection:bg-blue-500 selection:text-white">
        {children}
      </body>
    </html>
  );
}
