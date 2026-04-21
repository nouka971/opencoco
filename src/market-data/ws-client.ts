import type { AppConfig } from "../config.js";
import { Logger } from "../logger.js";
import type { MarketSnapshot } from "../types.js";

export class MarketDataClient {
  constructor(
    private readonly config: AppConfig,
    private readonly logger: Logger
  ) {}

  async start(): Promise<void> {
    this.logger.info("market data client ready", {
      asset: this.config.asset,
      wsUrl: this.config.wsUrl
    });
  }

  refresh(snapshot: MarketSnapshot): MarketSnapshot {
    return {
      ...snapshot,
      updatedAt: new Date().toISOString()
    };
  }
}
