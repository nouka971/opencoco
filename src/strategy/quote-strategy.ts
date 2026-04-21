import type { AppConfig } from "../config.js";
import type { MarketSnapshot, QuoteIntent, Side } from "../types.js";

function roundToTick(price: number, tickSize: number): number {
  return Math.round(price / tickSize) * tickSize;
}

function floorToTick(price: number, tickSize: number): number {
  return Math.floor(price / tickSize) * tickSize;
}

export class QuoteStrategy {
  constructor(private readonly config: AppConfig) {}

  buildIntents(market: MarketSnapshot): QuoteIntent[] {
    return (["YES", "NO"] as Side[]).map((side) => {
      const bestBid = side === "YES" ? market.bestBidYes : market.bestBidNo;
      const opposingBid = side === "YES" ? market.bestBidNo : market.bestBidYes;

      const seededPrice = bestBid == null
        ? 0.45
        : roundToTick(Math.min(bestBid + market.tickSize, this.config.maxPrice), market.tickSize);

      const cappedBySum = opposingBid == null
        ? seededPrice
        : floorToTick(
            Math.min(seededPrice, this.config.sumCheckThreshold - opposingBid),
            market.tickSize
          );

      const price = Math.max(this.config.minPrice, Math.min(this.config.maxPrice, cappedBySum));
      const reason = bestBid == null
        ? "preseed-when-book-empty"
        : opposingBid == null
          ? `penny-ahead-${side.toLowerCase()}`
          : `penny-ahead-${side.toLowerCase()}-sum-capped`;

      return {
        asset: market.asset,
        tokenId: side === "YES" ? market.tokenIdYes : market.tokenIdNo,
        slotStart: market.slotStart,
        side,
        price,
        size: this.config.minOrderSize,
        reason: opposingBid == null ? reason : `${reason}-sum-check-ready`,
        tickSize: market.tickSize,
        negRisk: market.negRisk
      };
    });
  }
}
