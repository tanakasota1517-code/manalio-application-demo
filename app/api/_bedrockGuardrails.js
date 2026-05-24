import { createHmac, createHash } from "node:crypto";

export const BEDROCK_GUARDRAIL_PRICING_USD_PER_1000_UNITS = {
  contentPolicyUnits: 0.15,
  topicPolicyUnits: 0.15,
  sensitiveInformationPolicyUnits: 0.10,
  contextualGroundingPolicyUnits: 0.10,
  automatedReasoningPolicyUnits: 0.17,
  wordPolicyUnits: 0,
  sensitiveInformationPolicyFreeUnits: 0,
};

const DEFAULT_REGION = "ap-northeast-1";
const DEFAULT_SOURCE = "INPUT";
const DEFAULT_OUTPUT_SCOPE = "INTERVENTIONS";

export function getBedrockGuardrailConfig(env = process.env) {
  return {
    region: env.AWS_BEDROCK_REGION || env.AWS_REGION || DEFAULT_REGION,
    guardrailIdentifier: env.MANABI_BEDROCK_GUARDRAIL_ID || "",
    guardrailVersion: env.MANABI_BEDROCK_GUARDRAIL_VERSION || "DRAFT",
    accessKeyId: env.AWS_ACCESS_KEY_ID || "",
    secretAccessKey: env.AWS_SECRET_ACCESS_KEY || "",
    sessionToken: env.AWS_SESSION_TOKEN || "",
  };
}

export function validateBedrockGuardrailConfig(config = getBedrockGuardrailConfig()) {
  const missing = [];
  if (!config.region) missing.push("AWS_REGION or AWS_BEDROCK_REGION");
  if (!config.guardrailIdentifier) missing.push("MANABI_BEDROCK_GUARDRAIL_ID");
  if (!config.guardrailVersion) missing.push("MANABI_BEDROCK_GUARDRAIL_VERSION");
  if (!config.accessKeyId) missing.push("AWS_ACCESS_KEY_ID");
  if (!config.secretAccessKey) missing.push("AWS_SECRET_ACCESS_KEY");
  return missing;
}

export function estimateBedrockTextUnits(text) {
  const length = String(text || "").length;
  if (length === 0) return 0;
  return Math.ceil(length / 1000);
}

export function estimateBedrockGuardrailCost(text, enabledPolicies = { sensitiveInformationPolicyUnits: true }) {
  const textUnits = estimateBedrockTextUnits(text);
  const breakdown = {};
  let totalUsd = 0;

  for (const [policy, enabled] of Object.entries(enabledPolicies)) {
    if (!enabled) continue;
    const price = BEDROCK_GUARDRAIL_PRICING_USD_PER_1000_UNITS[policy] || 0;
    const costUsd = (textUnits * price) / 1000;
    breakdown[policy] = {
      textUnits,
      pricePer1000UnitsUsd: price,
      costUsd,
    };
    totalUsd += costUsd;
  }

  return {
    characters: String(text || "").length,
    textUnits,
    breakdown,
    totalUsd,
  };
}

export function calculateBedrockGuardrailCostFromUsage(usage = {}) {
  const breakdown = {};
  let totalUsd = 0;

  for (const [policy, price] of Object.entries(BEDROCK_GUARDRAIL_PRICING_USD_PER_1000_UNITS)) {
    const units = Number(usage?.[policy] || 0);
    if (!Number.isFinite(units) || units <= 0) continue;
    const costUsd = (units * price) / 1000;
    breakdown[policy] = {
      units,
      pricePer1000UnitsUsd: price,
      costUsd,
    };
    totalUsd += costUsd;
  }

  return { breakdown, totalUsd };
}

export function buildBedrockGuardrailRequest(text, { source = DEFAULT_SOURCE, outputScope = DEFAULT_OUTPUT_SCOPE } = {}) {
  return {
    source,
    outputScope,
    content: [
      {
        text: {
          text: String(text || ""),
          qualifiers: ["guard_content"],
        },
      },
    ],
  };
}

export function buildDefaultManalioGuardrailPolicy() {
  return {
    name: "manalio-pii-precheck",
    description: "Manalio PoC pre-check guardrail for PII and sensitive identifiers before external AI calls.",
    blockedInputMessaging: "入力内容に個人情報や要配慮情報が含まれている可能性があります。該当箇所を置き換えてから再送信してください。",
    blockedOutputsMessaging: "出力内容に個人情報や要配慮情報が含まれている可能性があるため表示を止めました。",
    sensitiveInformationPolicyConfig: {
      piiEntitiesConfig: [
        { type: "NAME", inputAction: "ANONYMIZE", inputEnabled: true, outputAction: "ANONYMIZE", outputEnabled: true },
        { type: "EMAIL", inputAction: "ANONYMIZE", inputEnabled: true, outputAction: "ANONYMIZE", outputEnabled: true },
        { type: "PHONE", inputAction: "ANONYMIZE", inputEnabled: true, outputAction: "ANONYMIZE", outputEnabled: true },
        { type: "ADDRESS", inputAction: "ANONYMIZE", inputEnabled: true, outputAction: "ANONYMIZE", outputEnabled: true },
        { type: "URL", inputAction: "ANONYMIZE", inputEnabled: true, outputAction: "ANONYMIZE", outputEnabled: true },
        { type: "USERNAME", inputAction: "ANONYMIZE", inputEnabled: true, outputAction: "ANONYMIZE", outputEnabled: true },
        { type: "PASSWORD", inputAction: "ANONYMIZE", inputEnabled: true, outputAction: "ANONYMIZE", outputEnabled: true },
        { type: "AWS_ACCESS_KEY", inputAction: "ANONYMIZE", inputEnabled: true, outputAction: "ANONYMIZE", outputEnabled: true },
        { type: "AWS_SECRET_KEY", inputAction: "ANONYMIZE", inputEnabled: true, outputAction: "ANONYMIZE", outputEnabled: true },
      ],
      regexesConfig: [
        {
          name: "japanese_school_id",
          description: "学籍番号、学生番号、出席番号などの学校内識別子",
          pattern: "(学籍番号|学生番号|出席番号)[:：]?\\s*[A-Za-z0-9\\-ー−]{2,40}",
          inputAction: "ANONYMIZE",
          inputEnabled: true,
          outputAction: "ANONYMIZE",
          outputEnabled: true,
        },
        {
          name: "guardian_name_label",
          description: "保護者名、母親名、父親名などのラベル付き氏名",
          pattern: "(保護者名|母親名|父親名|祖母名|祖父名|保護者の名前|母親の名前|父親の名前)[:：は]?\\s*[^\\s、。]{1,30}",
          inputAction: "ANONYMIZE",
          inputEnabled: true,
          outputAction: "ANONYMIZE",
          outputEnabled: true,
        },
        {
          name: "diagnosis_or_family_context",
          description: "診断名、服薬、家庭事情など要配慮情報の明示",
          pattern: "(ADHD|ASD|自閉症|発達障害|診断名|服薬|通院|療育|家庭事情|虐待|ネグレクト|児童相談所)",
          inputAction: "ANONYMIZE",
          inputEnabled: true,
          outputAction: "ANONYMIZE",
          outputEnabled: true,
        },
      ],
    },
    tags: [
      { key: "Project", value: "Manalio" },
      { key: "Purpose", value: "PoC-PII-Precheck" },
    ],
  };
}

export async function createBedrockGuardrail(policy = buildDefaultManalioGuardrailPolicy(), options = {}) {
  const config = { ...getBedrockGuardrailConfig(), ...(options.config || {}) };
  const missing = validateBedrockCreateGuardrailConfig(config);
  if (missing.length > 0) {
    throw new Error(`Bedrock Guardrail creation config missing: ${missing.join(", ")}`);
  }

  const body = JSON.stringify({
    clientRequestToken: options.clientRequestToken || `manalio-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-pii-precheck`,
    ...policy,
  });
  const host = `bedrock.${config.region}.amazonaws.com`;
  const path = "/guardrails";
  const now = options.now || new Date();
  const headers = signAwsJsonRequest({
    method: "POST",
    service: "bedrock",
    region: config.region,
    host,
    path,
    body,
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey,
    sessionToken: config.sessionToken,
    now,
  });

  const response = await (options.fetchImpl || fetch)(`https://${host}${path}`, {
    method: "POST",
    headers,
    body,
    signal: options.signal,
  });
  const responseText = await response.text();
  const parsed = parseJsonResponse(responseText);

  if (!response.ok) {
    const message = parsed?.message || parsed?.Message || responseText || `HTTP ${response.status}`;
    throw new Error(`Bedrock CreateGuardrail request failed: ${response.status} ${message}`);
  }

  return parsed;
}

function validateBedrockCreateGuardrailConfig(config = getBedrockGuardrailConfig()) {
  const missing = [];
  if (!config.region) missing.push("AWS_REGION or AWS_BEDROCK_REGION");
  if (!config.accessKeyId) missing.push("AWS_ACCESS_KEY_ID");
  if (!config.secretAccessKey) missing.push("AWS_SECRET_ACCESS_KEY");
  return missing;
}

export function summarizeBedrockGuardrailResponse(response = {}) {
  const assessments = Array.isArray(response.assessments) ? response.assessments : [];
  const findings = [];

  for (const assessment of assessments) {
    for (const item of assessment?.sensitiveInformationPolicy?.piiEntities || []) {
      if (item?.detected === false) continue;
      findings.push({ policy: "sensitiveInformation", type: item.type, action: item.action });
    }
    for (const item of assessment?.sensitiveInformationPolicy?.regexes || []) {
      if (item?.detected === false) continue;
      findings.push({ policy: "sensitiveInformationRegex", type: item.name, action: item.action });
    }
    for (const item of assessment?.contentPolicy?.filters || []) {
      if (item?.detected === false) continue;
      findings.push({ policy: "content", type: item.type, action: item.action, confidence: item.confidence });
    }
    for (const item of assessment?.topicPolicy?.topics || []) {
      if (item?.detected === false) continue;
      findings.push({ policy: "topic", type: item.name, action: item.action });
    }
    for (const item of assessment?.wordPolicy?.customWords || []) {
      if (item?.detected === false) continue;
      findings.push({ policy: "word", type: "customWord", action: item.action });
    }
    for (const item of assessment?.wordPolicy?.managedWordLists || []) {
      if (item?.detected === false) continue;
      findings.push({ policy: "word", type: item.type, action: item.action });
    }
  }

  return {
    action: response.action || "UNKNOWN",
    intervened: response.action === "GUARDRAIL_INTERVENED",
    actionReason: response.actionReason || "",
    findings,
    usage: response.usage || {},
    cost: calculateBedrockGuardrailCostFromUsage(response.usage || {}),
    latencyMs: getGuardrailLatencyMs(assessments),
  };
}

export async function applyBedrockGuardrail(text, options = {}) {
  const config = { ...getBedrockGuardrailConfig(), ...(options.config || {}) };
  const missing = validateBedrockGuardrailConfig(config);
  if (missing.length > 0) {
    throw new Error(`Bedrock Guardrails config missing: ${missing.join(", ")}`);
  }

  const body = JSON.stringify(buildBedrockGuardrailRequest(text, options));
  const host = `bedrock-runtime.${config.region}.amazonaws.com`;
  const path = `/guardrail/${encodeURIComponent(config.guardrailIdentifier)}/version/${encodeURIComponent(config.guardrailVersion)}/apply`;
  const now = options.now || new Date();
  const headers = signAwsJsonRequest({
    method: "POST",
    service: "bedrock",
    region: config.region,
    host,
    path,
    body,
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey,
    sessionToken: config.sessionToken,
    now,
  });

  const response = await (options.fetchImpl || fetch)(`https://${host}${path}`, {
    method: "POST",
    headers,
    body,
    signal: options.signal,
  });
  const responseText = await response.text();
  const parsed = parseJsonResponse(responseText);

  if (!response.ok) {
    const message = parsed?.message || parsed?.Message || responseText || `HTTP ${response.status}`;
    throw new Error(`Bedrock Guardrails request failed: ${response.status} ${message}`);
  }

  return parsed;
}

function signAwsJsonRequest({ method, service, region, host, path, body, accessKeyId, secretAccessKey, sessionToken, now }) {
  const amzDate = toAmzDate(now);
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = sha256Hex(body);
  const canonicalHeaders = [
    ["content-type", "application/json"],
    ["host", host],
    ["x-amz-date", amzDate],
    ...(sessionToken ? [["x-amz-security-token", sessionToken]] : []),
  ];
  const signedHeaders = canonicalHeaders.map(([key]) => key).join(";");
  const canonicalRequest = [
    method,
    path,
    "",
    canonicalHeaders.map(([key, value]) => `${key}:${value}`).join("\n") + "\n",
    signedHeaders,
    payloadHash,
  ].join("\n");
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join("\n");
  const signature = hmacHex(getSignatureKey(secretAccessKey, dateStamp, region, service), stringToSign);
  const authorization = [
    "AWS4-HMAC-SHA256",
    `Credential=${accessKeyId}/${credentialScope}`,
    `SignedHeaders=${signedHeaders}`,
    `Signature=${signature}`,
  ].join(", ");

  return Object.fromEntries([
    ["content-type", "application/json"],
    ["x-amz-date", amzDate],
    ["Authorization", authorization],
    ...(sessionToken ? [["x-amz-security-token", sessionToken]] : []),
  ]);
}

function getSignatureKey(secretAccessKey, dateStamp, regionName, serviceName) {
  const kDate = hmacBuffer(`AWS4${secretAccessKey}`, dateStamp);
  const kRegion = hmacBuffer(kDate, regionName);
  const kService = hmacBuffer(kRegion, serviceName);
  return hmacBuffer(kService, "aws4_request");
}

function hmacBuffer(key, value) {
  return createHmac("sha256", key).update(value, "utf8").digest();
}

function hmacHex(key, value) {
  return createHmac("sha256", key).update(value, "utf8").digest("hex");
}

function sha256Hex(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function toAmzDate(date) {
  return date.toISOString().replace(/[:-]|\.\d{3}/g, "");
}

function parseJsonResponse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function getGuardrailLatencyMs(assessments) {
  const values = assessments
    .map((assessment) => Number(assessment?.invocationMetrics?.guardrailProcessingLatency))
    .filter((value) => Number.isFinite(value));
  if (values.length === 0) return undefined;
  return Math.max(...values);
}
