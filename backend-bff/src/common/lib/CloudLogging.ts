import { createLogger, format, transports } from 'winston';

const mapToGCPSeverity = (level: string, _message?: string): string => {
  const normalized = level.toLowerCase();
  const message = _message?.toLowerCase() ?? '';

  const levelMap: Record<string, string> = {
    silly: 'DEBUG',
    debug: 'DEBUG',
    verbose: 'DEBUG',
    http: 'DEBUG',
    info: 'INFO',
    warn: 'WARNING',
    warning: 'WARNING',
    error: 'ERROR',
  };

  if (message.includes('critical')) return 'CRITICAL';
  if (message.includes('alert')) return 'ALERT';
  if (message.includes('emergency')) return 'EMERGENCY';

  return levelMap[normalized] ?? 'DEFAULT';
};

export const CloudLogging = createLogger({
  level: process.env.NODE_ENV === 'development' ? 'debug' : 'info',
  exitOnError: false,
  transports: [new transports.Console()],
  format: format.combine(
    format.timestamp(),
    format.errors({ stack: true }),
    ...(process.env.NODE_ENV === 'development'
      ? [format.prettyPrint(), format.colorize()]
      : [
          format((info) => {
            info.severity = mapToGCPSeverity(info.level, info.message as string);

            info.labels = {
              service: 'chat-bff',
            };

            if (info.stack) {
              if (typeof info.stack === 'string') {
                info.errorStack = info.stack;
              } else if (Array.isArray(info.stack)) {
                info.errorStack = info.stack.join('\n');
              } else if (info.stack instanceof Error) {
                info.errorStack = info.stack.stack || info.stack.message;
              } else {
                info.errorStack = JSON.stringify(info.stack);
              }
            }

            delete (info as any).level;

            return info;
          })(),
          format.json(),
        ]),
  ),
});
