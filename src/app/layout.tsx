import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { siteConfig } from "@config";
import { I18nProvider } from "@/components/i18n/i18n-provider";
import { themeInitScript } from "@/components/layout/theme-toggle";
import { localeNames } from "@/lib/i18n/config";
import { getT } from "@/lib/i18n/server";
import { siteUrl } from "@/lib/site";
import { fontVariables } from "./fonts";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  return {
    metadataBase: new URL(siteUrl()),
    applicationName: siteConfig.brandName || undefined,
    manifest: "/manifest.webmanifest",
    formatDetection: { telephone: false, email: false, address: false },
    icons: {
      icon: [
        { url: "/icon.svg", type: "image/svg+xml" },
        { url: "/brand/icon-32.png", sizes: "32x32", type: "image/png" },
        { url: "/brand/icon-192.png", sizes: "192x192", type: "image/png" },
        { url: "/brand/icon-512.png", sizes: "512x512", type: "image/png" },
      ],
      apple: [{ url: "/apple-icon.png", sizes: "180x180", type: "image/png" }],
    },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#070b14" },
    { media: "(prefers-color-scheme: light)", color: "#eef1f6" },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { locale, dict } = await getT();
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <html lang={localeNames[locale].htmlLang} data-theme="dark" className={fontVariables} suppressHydrationWarning>
      <head>
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-dvh antialiased">
        <I18nProvider locale={locale} dict={dict}>
          {children}
        </I18nProvider>
      </body>
    </html>
  );
}
