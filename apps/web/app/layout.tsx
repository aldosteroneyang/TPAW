import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Retirement Monte Carlo Planner',
  description: 'TPAW retirement simulation prototype'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-Hant">
      <body>
        <main className="mx-auto min-h-screen max-w-5xl px-6 py-10">{children}</main>
      </body>
    </html>
  );
}
