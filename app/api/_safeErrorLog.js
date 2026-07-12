const ALLOWED_LOG_CODES = new Set([
  "operation_failed",
  "access_tracking_failed",
  "auth_operation_failed",
  "auth_session_restore_failed",
  "bedrock_guardrail_compare_failed",
  "bedrock_guardrail_config_missing",
  "feedback_generation_link_check_failed",
  "generation_limit_check_failed",
  "generation_log_write_failed",
  "generation_quota_reservation_failed",
  "generation_request_failed",
  "generation_reservation_completion_failed",
  "generation_reservation_failure_mark_failed",
  "invalid_provider_output",
  "log_persistence_failed",
  "privacy_check_failed",
  "provider_generation_failed",
  "school_format_load_failed",
  "school_format_session_load_failed",
  "school_summary_failed",
  "school_template_context_failed",
  "school_template_fetch_failed",
  "school_template_save_failed",
  "student_process_context_failed",
  "student_process_delete_failed",
  "student_process_persistence_failed",
  "student_process_summary_unavailable",
]);

export function buildSafeErrorLogMeta(_error, fallbackCode = "operation_failed") {
  const code = typeof fallbackCode === "string" && ALLOWED_LOG_CODES.has(fallbackCode)
    ? fallbackCode
    : "operation_failed";
  return { code };
}

export function logSafeApiError(error, fallbackCode = "operation_failed") {
  console.error(buildSafeErrorLogMeta(error, fallbackCode));
}

export function logSafeApiWarning(error, fallbackCode = "operation_failed") {
  console.warn(buildSafeErrorLogMeta(error, fallbackCode));
}
