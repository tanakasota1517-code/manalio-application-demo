import { isProductionLikeRuntime } from "../_supabase.js";

const NO_STORE_HEADERS = { "cache-control": "no-store" };

export const runtime = "nodejs";

export async function GET() {
  const useMock = process.env.MANABI_USE_MOCK === "true";
  const exposeDetails = process.env.MANABI_EXPOSE_HEALTH_DETAILS === "true";
  const canExposeDetails = exposeDetails && !isProductionLikeRuntime();
  const supabaseDisabled = process.env.MANABI_DISABLE_SUPABASE === "true";
  const hasAnthropicKey = Boolean(process.env.ANTHROPIC_API_KEY);
  const hasOpenAIKey = Boolean(process.env.OPENAI_API_KEY);
  const hasSupabaseUrl = !supabaseDisabled && Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL);
  const hasSupabaseAnonKey = !supabaseDisabled && Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY);
  const hasSupabaseServiceRole = !supabaseDisabled && Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
  const bedrockGuardrailMode = String(process.env.MANABI_BEDROCK_GUARDRAIL_MODE || "off").trim().toLowerCase();

  const health = {
    ok: true,
    mode: useMock ? "mock" : "live",
    freeProvider: process.env.MANABI_FREE_PROVIDER || "openai",
    practiceProvider: process.env.MANABI_PRACTICE_PROVIDER || "openai",
    providerFallback: process.env.MANABI_ALLOW_PROVIDER_FALLBACK === "true" ? "enabled" : "disabled",
    providers: {
      openai: useMock ? "mock" : hasOpenAIKey ? "configured" : "missing",
      anthropic: useMock ? "mock" : hasAnthropicKey ? "configured" : "missing",
    },
    models: {
      openaiFree: process.env.OPENAI_FREE_MODEL || "gpt-5.4-mini",
      openaiPractice: process.env.OPENAI_PRACTICE_MODEL || "gpt-5.4",
      anthropicFree: process.env.ANTHROPIC_FREE_MODEL || "claude-haiku-4-5-20251001",
      anthropicPractice: process.env.ANTHROPIC_PRACTICE_MODEL || "claude-sonnet-4-6",
    },
    persistence: {
      supabase: hasSupabaseUrl && hasSupabaseServiceRole ? "configured" : "missing",
      url: hasSupabaseUrl ? "configured" : "missing",
      anonKey: hasSupabaseAnonKey ? "configured" : "missing",
      serviceRole: hasSupabaseServiceRole ? "configured" : "missing",
    },
    auth: {
      supabase: hasSupabaseUrl && hasSupabaseAnonKey ? "configured" : "missing",
    },
    guardrail: {
      bedrock: bedrockGuardrailMode === "off" ? "off" : "enabled",
    },
  };

  if (canExposeDetails) {
    return Response.json(health, { headers: NO_STORE_HEADERS });
  }

  if (isProductionLikeRuntime()) {
    return Response.json({ ok: health.ok }, { headers: NO_STORE_HEADERS });
  }

  return Response.json({
    ok: health.ok,
    mode: health.mode,
    auth: health.auth.supabase,
    persistence: health.persistence.supabase,
    guardrail: health.guardrail.bedrock,
  }, { headers: NO_STORE_HEADERS });
}
