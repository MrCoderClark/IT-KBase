import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

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
    default: "TechBase — IT Knowledge Hub",
    template: "%s · TechBase",
  },
  description:
    "Enterprise IT knowledge base. Turn Word docs and PDFs into structured, searchable, versioned runbooks.",
  applicationName: "TechBase",
  authors: [{ name: "TechBase" }],
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F6F8FB" },
    { media: "(prefers-color-scheme: dark)", color: "#0A0F1C" },
  ],
  colorScheme: "light dark",
};

/**
 * Blocking inline script to resolve the theme before paint.
 * Prevents a light-to-dark (or vice-versa) flash. Reads `tb_theme` from
 * localStorage; falls back to the system preference. Must stay in sync
 * with the theme toggle (added in a later pass).
 */
const themeInitScript = `
(function () {
  try {
    var stored = localStorage.getItem('tb_theme');
    var systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    var mode = stored === 'light' || stored === 'dark'
      ? stored
      : (systemDark ? 'dark' : 'light');
    if (mode === 'dark') document.documentElement.classList.add('dark');
    document.documentElement.dataset.theme = mode;
  } catch (_) { /* no-op */ }
})();
`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-full flex flex-col bg-canvas text-fg">
        {children}
      </body>
    </html>
  );
}
