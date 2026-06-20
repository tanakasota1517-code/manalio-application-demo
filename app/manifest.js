export default function manifest() {
  if (isPublicDemoOnly()) {
    return {
      id: "/demo",
      name: "Manalio 公開デモ",
      short_name: "Manalio",
      description: "保育者養成校向けAI実習支援の公開デモ",
      lang: "ja-JP",
      start_url: "/demo",
      scope: "/demo",
      display: "browser",
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
      ],
      shortcuts: [
        {
          name: "学生画面デモ",
          short_name: "学生デモ",
          description: "架空データで学生画面を開く",
          url: "/demo/student",
          icons: [{ src: "/images/app-icon-192.png", sizes: "192x192" }],
        },
        {
          name: "教員画面デモ",
          short_name: "教員デモ",
          description: "架空データで教員画面を開く",
          url: "/demo/teacher",
          icons: [{ src: "/images/app-icon-192.png", sizes: "192x192" }],
        },
      ],
    };
  }

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

function isPublicDemoOnly() {
  return process.env["MANABI_PUBLIC_DEMO_ONLY"] === "true";
}
