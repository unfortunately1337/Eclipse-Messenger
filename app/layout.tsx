
import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ThemeProvider } from "next-themes";
import AppToastViewport from "@/app/app/AppToastViewport";
import { LocaleProvider } from "@/components/LocaleProvider";
import { getServerLocale } from "@/lib/i18n/server";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  interactiveWidget: "resizes-visual",
};

export const metadata: Metadata = {
  title: "Eclipse",
  description: "Anonymous, Encrypted, Secure.",
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/brand/ico_light.ico", sizes: "any" },
      { url: "/brand/ico_light.ico", sizes: "32x32", type: "image/x-icon" },
      { url: "/brand/ico_light.ico", sizes: "64x64", type: "image/x-icon" },
      { url: "/brand/ico_light.ico", sizes: "128x128", type: "image/x-icon" },
    ],
    shortcut: "/icon.svg",
    apple: [
      { url: "/brand/hello_light.png", sizes: "180x180", type: "image/png" },
    ],
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getServerLocale();
  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        <link rel="manifest" href="/manifest.webmanifest" crossOrigin="use-credentials" />
        <link rel="preconnect" href="https://cdn.jsdelivr.net" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://cdn.jsdelivr.net" />
      </head>
      <body className="antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          <LocaleProvider initialLocale={locale}>
            {children}
            <AppToastViewport />
          </LocaleProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
