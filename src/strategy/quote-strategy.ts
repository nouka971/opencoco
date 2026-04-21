import type { AppConfig } from "../config.js";
import type { MarketSnapshot, QuoteIntent, Side } from "../types.js";

function roundToTick(price: number, tickSize: number): number {
  return Math.round(price / tickSize) * tickSize;
}

export class QuoteStrategy {
  constructor(private readonly config: AppConfig) {}

  buildIntents(market: MarketSnapshot): QuoteIntent[] {
    return (["YES", "NO"] as Side[]).map((side) => {
      const bestBid = side === "YES" ? market.bestBidYes : market.bestBidNo;
      const opposingBid = side === "YES" ? market.bestBidNo : market.bestBidYes;

      const rawPrice = bestBid == null
        ? 0.45
        : roundToTick(Math.min(bestBid + market.tickSize, this.config.maxPrice), market.tickSize);

      const price = Math.max(this.config.minPrice, Math.min(this.config.maxPrice, rawPrice));
      const reason = bestBid == null
        ? "preseed-when-book-empty"
        : `penny-ahead-${side.toLowerCase()}`;

      return {
        asset: market.asset,
        slotStart: market.slotStart,
        side,
        price,
        size: this.config.minOrderSize,
        reason: opposingBid == null ? reason : `${reason}-sum-check-ready`
      };
    });
  }
}
