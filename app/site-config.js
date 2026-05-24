export const SITE_URL = normalizeSiteUrl(process.env.NEXT_PUBLIC_SITE_URL || "https://manalio.jp");
export const CONTACT_EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL || "contact@manalio.jp";
export const LEGAL_INFO = {
  sellerName: publicText("NEXT_PUBLIC_LEGAL_SELLER_NAME", "Manalio運営者"),
  representative: publicText("NEXT_PUBLIC_LEGAL_REPRESENTATIVE", "請求があった場合、遅滞なく開示します。"),
  address: publicText("NEXT_PUBLIC_LEGAL_ADDRESS", "請求があった場合、遅滞なく開示します。"),
  phone: publicText("NEXT_PUBLIC_LEGAL_PHONE", "請求があった場合、遅滞なく開示します。"),
  price: publicText("NEXT_PUBLIC_LEGAL_PRICE", "導入範囲、学生数、利用期間、学校フォーマット対応範囲に応じた個別見積り"),
  additionalFees: publicText("NEXT_PUBLIC_LEGAL_ADDITIONAL_FEES", "インターネット接続料金、通信料金等は利用者または導入組織の負担となります。"),
  paymentMethod: publicText("NEXT_PUBLIC_LEGAL_PAYMENT_METHOD", "請求書払い、銀行振込その他個別契約で定める方法"),
  paymentTiming: publicText("NEXT_PUBLIC_LEGAL_PAYMENT_TIMING", "個別契約または請求書に定める期日"),
  serviceStart: publicText("NEXT_PUBLIC_LEGAL_SERVICE_START", "契約成立後、導入設定およびアカウント発行が完了次第提供します。"),
  cancellation: publicText("NEXT_PUBLIC_LEGAL_CANCELLATION", "サービスの性質上、提供開始後の返金は原則として行いません。個別契約で別途定める場合はその内容に従います。"),
};

export function absoluteUrl(path = "") {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${SITE_URL}${normalizedPath === "/" ? "" : normalizedPath}`;
}

function normalizeSiteUrl(value) {
  return String(value || "https://manalio.jp").replace(/\/$/, "");
}

function publicText(key, fallback) {
  return String(process.env[key] || fallback).trim() || fallback;
}
