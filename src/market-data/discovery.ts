import type { AppConfig } from "../config.js";
import type { MarketSnapshot } from "../types.js";

export class MarketDiscovery {
  constructor(private readonly config: AppConfig) {}

  async discover(): Promise<MarketSnapshot[]> {
    const nowSec = Math.floor(Date.now() / 1000);
    const currentSlot = Math.floor(nowSec / 900) * 900;
    const offsets = [0, 900, 1800, 2700];
    const snapshots: MarketSnapshot[] = [];

    for (const offset of offsets) {
      const slotEpoch = currentSlot + offset;
      const slug = `${this.config.asset.toLowerCase()}-updown-15m-${slotEpoch}`;
      const response = await fetch(`${this.config.gammaUrl}/markets?slug=${slug}`, { method: "GET" });
      if (!response.ok) {
        continue;
      }

      const payload = await response.json() as unknown;
      const record = (Array.isArray(payload) ? payload[0] : payload) as {
        slug?: string;
        conditionId?: string;
        clobTokenIds?: string | string[];
        minimum_tick_size?: string | number;
        tick_size?: string | number;
        negRisk?: boolean;
        neg_risk?: boolean;
      } | undefined;

      if (!record?.conditionId || !record.clobTokenIds) {
        continue;
      }

      let tokenIds: string[] = [];
      if (Array.isArray(record.clobTokenIds)) {
        tokenIds = record.clobTokenIds.map(String);
      } else {
        try {
          tokenIds = JSON.parse(record.clobTokenIds) as string[];
        } catch {
          tokenIds = [];
        }
      }

      if (tokenIds.length !== 2) {
        continue;
      }

      snapshots.push({
        asset: this.config.asset,
        slug: record.slug || slug,
        conditionId: String(record.conditionId),
        tokenIdYes: tokenIds[0],
        tokenIdNo: tokenIds[1],
        negRisk: Boolean(record.negRisk ?? record.neg_risk ?? false),
        slotEpoch,
        slotStart: new Date(slotEpoch * 1000).toISOString(),
        slotEnd: new Date((slotEpoch + 900) * 1000).toISOString(),
        bestBidYes: null,
        bestAskYes: null,
        bestBidNo: null,
        bestAskNo: null,
        tickSize: Number(record.minimum_tick_size || record.tick_size || 0.01),
        updatedAt: new Date().toISOString()
      });
    }

    return snapshots;
  }
}
