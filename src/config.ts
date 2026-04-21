import "dotenv/config";
import path from "node:path";

export interface AppConfig {
  env: "development" | "test" | "production";
  logLevel: "debug" | "info" | "warn" | "error";
  asset: string;
  marketWindowMinutes: number;
  minPrice: number;
  maxPrice: number;
  minOrderSize: number;
  maxSlotExposureUsd: number;
  maxSideExposureUsd: number;
  maxReplacementsPerMinute: number;
  sumCheckThreshold: number;
  dryRun: boolean;
  runtimeDir: string;
  heartbeatFile: string;
  clobUrl: string;
  wsUrl: string;
  gammaUrl: string;
  polyApiKey: string;
  polyApiSecret: string;
  polyPassphrase: string;
  polyAddress: string;
  polygonPrivateKey: string;
}

function readNumber(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    throw new Error(`${name} must be a valid number`);
  }
  return parsed;
}

function readBoolean(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (!raw) return fallback;
  return raw === "1" || raw.toLowerCase() === "true";
}

function readString(name: string, fallback = ""): string {
  return process.env[name]?.trim() || fallback;
}

export function loadConfig(): AppConfig {
  const minPrice = readNumber("OPENCOCO_MIN_PRICE", 0.1);
  const maxPrice = readNumber("OPENCOCO_MAX_PRICE", 0.9);
  const sumCheckThreshold = readNumber("OPENCOCO_SUM_CHECK_THRESHOLD", 0.985);
  const dryRun = readBoolean("OPENCOCO_DRY_RUN", true);
  const runtimeDir = readString("OPENCOCO_RUNTIME_DIR", "./runtime");

  if (minPrice <= 0 || maxPrice >= 1 || minPrice >= maxPrice) {
    throw new Error("OPENCOCO_MIN_PRICE / OPENCOCO_MAX_PRICE are inconsistent");
  }

  if (sumCheckThreshold <= 0 || sumCheckThreshold >= 1) {
    throw new Error("OPENCOCO_SUM_CHECK_THRESHOLD must be between 0 and 1");
  }

  const config: AppConfig = {
    env: readString("NODE_ENV", "development") as AppConfig["env"],
    logLevel: readString("LOG_LEVEL", "info") as AppConfig["logLevel"],
    asset: readString("OPENCOCO_ASSET", "BTC"),
    marketWindowMinutes: readNumber("OPENCOCO_MARKET_WINDOW_MINUTES", 15),
    minPrice,
    maxPrice,
    minOrderSize: readNumber("OPENCOCO_MIN_ORDER_SIZE", 5),
    maxSlotExposureUsd: readNumber("OPENCOCO_MAX_SLOT_EXPOSURE_USD", 25),
    maxSideExposureUsd: readNumber("OPENCOCO_MAX_SIDE_EXPOSURE_USD", 12.5),
    maxReplacementsPerMinute: readNumber("OPENCOCO_MAX_REPLACEMENTS_PER_MINUTE", 24),
    sumCheckThreshold,
    dryRun,
    runtimeDir,
    heartbeatFile: path.resolve(readString("OPENCOCO_HEARTBEAT_FILE", "./runtime/bot-status.json")),
    clobUrl: readString("POLY_CLOB_URL", "https://clob.polymarket.com"),
    wsUrl: readString("POLY_WS_URL", "wss://ws-subscriptions-clob.polymarket.com/ws/market"),
    gammaUrl: readString("POLY_GAMMA_URL", "https://gamma-api.polymarket.com"),
    polyApiKey: readString("POLY_API_KEY"),
    polyApiSecret: readString("POLY_API_SECRET"),
    polyPassphrase: readString("POLY_PASSPHRASE"),
    polyAddress: readString("POLY_ADDRESS"),
    polygonPrivateKey: readString("POLYGON_PRIVATE_KEY")
  };

  if (config.marketWindowMinutes !== 15) {
    throw new Error("V1 only supports 15-minute markets");
  }

  if (!config.dryRun) {
    const required = [
      ["POLY_API_KEY", config.polyApiKey],
      ["POLY_API_SECRET", config.polyApiSecret],
      ["POLY_PASSPHRASE", config.polyPassphrase],
      ["POLY_ADDRESS", config.polyAddress],
      ["POLYGON_PRIVATE_KEY", config.polygonPrivateKey]
    ];
    const missing = required.filter(([, value]) => !value).map(([name]) => name);
    if (missing.length > 0) {
      throw new Error(`Missing required live secrets: ${missing.join(", ")}`);
    }
  }

  return config;
}
