export default function manifest() {
  return {
    id: "/",
    name: "Manalio",
    short_name: "Manalio",
    description: "保育者養成校向けAI実習指導支援プラットフォーム",
    lang: "ja-JP",
    start_url: "/login",
    scope: "/",
    display: "standalone",
    display_override: ["standalone", "browser"],
    background_color: "#ffffff",
    theme_color: "#183B6B",
    orientation: "portrait-primary",
    categories: ["education", "productivity"],
    icons: [
      {
        src: "/images/brand-icon.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
      {
        src: "/images/app-icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/images/app-icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/images/app-icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      {
        name: "ログイン",
        short_name: "ログイン",
        description: "学校アカウントでManalioにログインする",
        url: "/login",
        icons: [{ src: "/images/app-icon-192.png", sizes: "192x192" }],
      },
      {
        name: "サービス画面",
        short_name: "サービス",
        description: "実習支援画面を開く",
        url: "/app",
        icons: [{ src: "/images/app-icon-192.png", sizes: "192x192" }],
      },
    ],
  };
}
