export const COMMON_JAPANESE_SURNAME_PATTERN = "(佐藤|鈴木|高橋|田中|伊藤|渡辺|山本|中村|小林|加藤|吉田|山田|佐々木|山口|松本|井上|木村|斎藤|清水|山崎|池田|橋本|石川|前田|藤田|後藤|岡田|長谷川|村上|近藤|石井|坂本|遠藤|青木|藤井|西村|福田|太田|三浦|藤原|岡本|松田|中川|中島|原田|小川|竹内|和田|中野|金子|上田|酒井|工藤|横山|宮崎|宮本|内田|柴田|谷口|安藤|丸山|今井|高木|大野|杉山|増田|小島|平野|田村|大塚|久保|松井|岩崎|桜井|菅原|野口|新井|渡部|大西|杉本|古川|浜田|市川|大橋|小野|田口|平田|川口|川崎|飯田|吉川|本田|久保田|沢田|吉村|岩田|中西|服部|樋口|福島|川上|永井|松岡|田辺|森田|黒田|矢野|大久保|内藤|松尾|菊地|野村|平井|望月|岩本|片山|川島|武田|広瀬|北村|荒木|大谷|松下|小山|石田|上野|篠原|須藤|萩原|大島|小沢|宮川|成田|小田|石原|横田|岡崎|大森|栗原|伊東|松浦|三宅|浅野|西田|大場|大村|熊谷|星野|河野|平山|村田|多田|島田)";
export const COMMON_GIVEN_NAME_PATTERN = "(太郎|花子|一郎|二郎|三郎|健太|翔太|陽太|悠真|大翔|蓮|湊|蒼|樹|陽葵|凛|結菜|美咲|優奈|愛|葵|さくら|ひなた|はると|ゆうと)";

export const PHONE_PATTERN_SOURCE = String.raw`(?:\(?[0０][0-9０-９]{1,4}\)?[\s　\-ー−－.．/／]?[0-9０-９]{1,4}[\s　\-ー−－.．/／]?[0-9０-９]{3,4})`;
export const CONTACT_LABEL_PATTERN_SOURCE = String.raw`(?:(?:LINE\s*ID|ラインID|連絡先|電話番号|TEL|Tel|tel)[:：は]?\s*[A-Za-z0-9._@\-ー−－０-９ぁ-んァ-ン]{2,60}|電話[:：]\s*[A-Za-z0-9._@\-ー−－０-９ぁ-んァ-ン]{2,60})`;
export const POSTAL_CODE_PATTERN_SOURCE = String.raw`〒?\s*[0-9０-９]{3}[-ー−－]?[0-9０-９]{4}`;
export const JAPANESE_ADDRESS_PATTERN_SOURCE = String.raw`(?:${POSTAL_CODE_PATTERN_SOURCE}|(?:住所|所在地|自宅|住まい)[:：]?\s*[^\s、。]{2,80}|(?:東京都|北海道|大阪府|京都府|[一-龯]{2,3}県)[一-龯ぁ-んァ-ン0-9０-９\s　\-ー−－丁目番地号市区町村]{2,80})`;
export const MEDICAL_INFO_PATTERN_SOURCE = String.raw`(?:自閉スペクトラム症?|自閉症|注意欠如多動症|注意欠陥多動性障害|ADHD|ＡＤＨＤ|ASD|ＡＳＤ|LD|ＬＤ|学習障害|発達障害|知的障害|発達特性|診断名|障害名|病名|持病|疾患|障害(?!物)|アレルギー|食物アレルギー|てんかん|癲癇|発作|痙攣|けいれん|投薬|服薬|薬名|薬を飲|病院(?!ごっこ)|通院|医療|療育|発達検査|知能検査)`;
export const FAMILY_INFO_PATTERN_SOURCE = String.raw`(?:家庭環境|家庭事情|家庭の事情|家庭状況|母子家庭|父子家庭|ひとり親|離婚|別居|生活保護|虐待|ネグレクト|児童相談所|里親|養護施設)`;
export const GUARDIAN_NAME_PATTERN_SOURCE = String.raw`(?:(?:保護者名|保護者氏名|母親名|父親名|祖母名|祖父名|母親氏名|父親氏名|祖母氏名|祖父氏名|保護者の名前|母親の名前|父親の名前|祖母の名前|祖父の名前)[:：は]?\s*[^\s、。]{1,30}|(?:保護者|母親|父親|祖母|祖父)の?(?:名前|氏名|実名|本名)[:：は]?\s*[^\s、。]{1,30}|(?:保護者|母親|父親|祖母|祖父)[:：]\s*[^\s、。]{1,30})`;

export function createLikelyFullNamePattern(flags = "") {
  return new RegExp(`${COMMON_JAPANESE_SURNAME_PATTERN}(?!先生|さん|くん|ちゃん|君)[一-龯]{1,3}`, flags);
}

export function createPhonePattern(flags = "") {
  return new RegExp(PHONE_PATTERN_SOURCE, flags);
}

export function createContactLabelPattern(flags = "") {
  return new RegExp(CONTACT_LABEL_PATTERN_SOURCE, flags);
}

export function createJapaneseAddressPattern(flags = "") {
  return new RegExp(JAPANESE_ADDRESS_PATTERN_SOURCE, flags);
}

export function createMedicalInfoPattern(flags = "") {
  return new RegExp(MEDICAL_INFO_PATTERN_SOURCE, flags);
}

export function createFamilyInfoPattern(flags = "") {
  return new RegExp(FAMILY_INFO_PATTERN_SOURCE, flags);
}

export function createGuardianNamePattern(flags = "") {
  return new RegExp(GUARDIAN_NAME_PATTERN_SOURCE, flags);
}

export function normalizePrivacyScanText(value) {
  return String(value || "")
    .normalize("NFKC")
    .replace(/[\u200B-\u200D\uFEFF\u202A-\u202E\u2066-\u2069]/g, "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "");
}
