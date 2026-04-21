type LogLevel = "debug" | "info" | "warn" | "error";

const priorities: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40
};

export class Logger {
  constructor(private readonly minLevel: LogLevel) {}

  private write(level: LogLevel, message: string, fields?: Record<string, unknown>): void {
    if (priorities[level] < priorities[this.minLevel]) return;

    const payload = {
      ts: new Date().toISOString(),
      level,
      message,
      ...(fields || {})
    };

    const line = JSON.stringify(payload);
    if (level === "error") {
      console.error(line);
      return;
    }
    console.log(line);
  }

  debug(message: string, fields?: Record<string, unknown>): void {
    this.write("debug", message, fields);
  }

  info(message: string, fields?: Record<string, unknown>): void {
    this.write("info", message, fields);
  }

  warn(message: string, fields?: Record<string, unknown>): void {
    this.write("warn", message, fields);
  }

  error(message: string, fields?: Record<string, unknown>): void {
    this.write("error", message, fields);
  }
}
