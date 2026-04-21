import type { AppConfig } from "../config.js";
import type { MarketSnapshot } from "../types.js";

export class MarketDiscovery {
  constructor(private readonly config: AppConfig) {}

  discover(): MarketSnapshot[] {
    const now = new Date();
    const slotStart = new Date(now);
    slotStart.setUTCMinutes(Math.floor(slotStart.getUTCMinutes() / 15) * 15, 0, 0);
    const slotEnd = new Date(slotStart.getTime() + this.config.marketWindowMinutes * 60_000);
    const epoch = Math.floor(slotStart.getTime() / 1000);

    return [
      {
        asset: this.config.asset,
        slug: `${this.config.asset.toLowerCase()}-updown-15m-${epoch}`,
        conditionId: `stub-${epoch}`,
        tokenIdYes: `yes-${epoch}`,
        tokenIdNo: `no-${epoch}`,
        slotStart: slotStart.toISOString(),
        slotEnd: slotEnd.toISOString(),
        bestBidYes: 0.48,
        bestAskYes: 0.5,
        bestBidNo: 0.48,
        bestAskNo: 0.5,
        tickSize: 0.01,
        updatedAt: new Date().toISOString()
      }
    ];
  }
}
