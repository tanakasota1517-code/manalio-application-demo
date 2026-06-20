import "./globals.css";
import { SITE_URL } from "./site-config";
import PwaRegister from "./pwa-register";

const siteTitle = "Manalio | 保育者養成校向けAI実習指導支援";
const siteDescription = "保育実習の日誌づくりを、学校フォーマット、確認候補、教員が確認するポイントとともに安全に扱えるAI実習指導支援プラットフォームです。";
const isPublicDemoOnly = process.env["MANABI_PUBLIC_DEMO_ONLY"] === "true";

export const metadata = {
  metadataBase: new URL(SITE_URL),
  applicationName: "Manalio",
  title: siteTitle,
  description: siteDescription,
  keywords: ["保育実習", "実習日誌", "保育者養成校", "AI実習指導", "実習指導"],
  ...(isPublicDemoOnly ? {} : { manifest: "/manifest.webmanifest" }),
  icons: {
    icon: [
      { url: "/images/brand-icon.svg", type: "image/svg+xml" },
      { url: "/images/app-icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/images/app-icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/images/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    title: "Manalio",
    statusBarStyle: "default",
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    title: siteTitle,
    description: siteDescription,
    type: "website",
    locale: "ja_JP",
    siteName: "Manalio",
    images: [
      {
        url: "/images/manalio-hero-photo.jpg",
        width: 1400,
        height: 700,
        alt: "保育者養成校で実習指導について学ぶ学生と教員のイメージ",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: siteTitle,
    description: siteDescription,
    images: ["/images/manalio-hero-photo.jpg"],
  },
  robots: {
    index: !isPublicDemoOnly,
    follow: !isPublicDemoOnly,
  },
};

const websiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "Manalio",
  url: SITE_URL,
  inLanguage: "ja-JP",
  description: siteDescription,
};

const softwareJsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Manalio",
  url: SITE_URL,
  applicationCategory: "EducationalApplication",
  operatingSystem: "Web",
  inLanguage: "ja-JP",
  description: siteDescription,
  audience: {
    "@type": "EducationalAudience",
    educationalRole: "teacher",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="ja">
      <body>
        <a className="skip-link" href="#main-content">本文へスキップ</a>
        {children}
        {!isPublicDemoOnly ? <PwaRegister /> : null}
        {!isPublicDemoOnly ? (
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify([websiteJsonLd, softwareJsonLd]) }}
          />
        ) : null}
      </body>
    </html>
  );
}
