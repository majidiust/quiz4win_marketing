import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { publicEnv } from "@/lib/env";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: publicEnv.appName,
    template: `%s — ${publicEnv.appName}`,
  },
  description: "Centralized marketing operations, content workflow and scheduling for BingoBingo.",
  applicationName: publicEnv.appName,
  robots: { index: false, follow: false },
};

const themeScript = `(() => { try { const t = localStorage.getItem('mkt-theme') || 'system'; const d = t === 'dark' || (t === 'system' && matchMedia('(prefers-color-scheme: dark)').matches); document.documentElement.classList.add(d ? 'dark' : 'light'); document.documentElement.style.colorScheme = d ? 'dark' : 'light'; } catch(e){} })();`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-full bg-background text-foreground font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
