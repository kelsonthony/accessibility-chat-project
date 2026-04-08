import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Accessibility Intelligence Platform',
  description: 'Multilingual accessibility compliance assistant with RAG and telemetry.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
