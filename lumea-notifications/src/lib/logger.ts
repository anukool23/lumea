import pino from "pino";

const isDev = process.env.NODE_ENV !== "production";

export const logger = pino(
  {
    level: isDev ? "debug" : "info",
    base: { service: "lumea-notifications" },
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: {
      log(obj) {
        const { time, ...rest } = obj as Record<string, unknown>;
        return { "@timestamp": time ?? new Date().toISOString(), ...rest };
      },
    },
  },
  isDev
    ? pino.transport({
        target: "pino-pretty",
        options: { colorize: true, translateTime: "SYS:standard", ignore: "pid,hostname" },
      })
    : undefined
);

export function childLogger(requestId: string) {
  return logger.child({ request_id: requestId });
}
