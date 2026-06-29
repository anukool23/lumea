import pino from "pino";

/**
 * Structured JSON logger for lumea-post.
 * - Production (NODE_ENV=production): JSON output — ingested by OpenSearch
 * - Development: pretty-printed with colors
 *
 * Every log line includes `service: "lumea-post"` and `@timestamp` for OpenSearch.
 */

const isDev = process.env.NODE_ENV !== "production";

export const logger = pino(
  {
    level: isDev ? "debug" : "info",
    base: { service: "lumea-post" },
    timestamp: pino.stdTimeFunctions.isoTime,
    // OpenSearch expects "@timestamp" not "time"
    formatters: {
      log(obj) {
        const { time, ...rest } = obj as Record<string, unknown>;
        return { "@timestamp": time ?? new Date().toISOString(), ...rest };
      },
    },
    ...(isDev
      ? {}
      : {
          // In production keep JSON compact — Lambda CloudWatch / Firehose ingests it
        }),
  },
  isDev
    ? pino.transport({
        target: "pino-pretty",
        options: { colorize: true, translateTime: "SYS:standard", ignore: "pid,hostname" },
      })
    : undefined
);

/** Child logger with a fixed request_id bound — use inside request handlers */
export function childLogger(requestId: string) {
  return logger.child({ request_id: requestId });
}
