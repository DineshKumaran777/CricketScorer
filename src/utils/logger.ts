interface LogEntry {
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  requestId?: string;
  userId?: string;
  matchId?: string;
  inningsId?: string;
  ballId?: string;
  clientEventId?: string;
  duration?: number;
  timestamp: string;
  [key: string]: any;
}

const SENSITIVE_KEYS = new Set([
  'password', 'token', 'secret', 'authorization', 'jwt', 'apiKey', 'api_key',
]);

function sanitize(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(sanitize);

  const cleaned: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (SENSITIVE_KEYS.has(key.toLowerCase())) {
      cleaned[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      cleaned[key] = sanitize(value);
    } else {
      cleaned[key] = value;
    }
  }
  return cleaned;
}

function formatEntry(level: LogEntry['level'], message: string, meta?: Record<string, any>): LogEntry {
  const entry: LogEntry = {
    level,
    message,
    timestamp: new Date().toISOString(),
  };

  if (meta) {
    const sanitized = sanitize(meta);
    Object.assign(entry, sanitized);
  }

  return entry;
}

function write(entry: LogEntry) {
  const line = JSON.stringify(entry);
  if (entry.level === 'error') {
    console.error(line);
  } else if (entry.level === 'warn') {
    console.warn(line);
  } else if (entry.level === 'debug') {
    console.debug(line);
  } else {
    console.log(line);
  }
}

export const logger = {
  info(message: string, meta?: Record<string, any>) {
    write(formatEntry('info', message, meta));
  },

  warn(message: string, meta?: Record<string, any>) {
    write(formatEntry('warn', message, meta));
  },

  error(message: string, meta?: Record<string, any>) {
    write(formatEntry('error', message, meta));
  },

  debug(message: string, meta?: Record<string, any>) {
    if (process.env.NODE_ENV !== 'production') {
      write(formatEntry('debug', message, meta));
    }
  },
};
