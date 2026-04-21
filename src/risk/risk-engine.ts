import type { AppConfig } from "../config.js";
import type { ActiveOrder, QuoteDecision, QuoteIntent, RiskExposure, Side } from "../types.js";

function sideExposure(orders: ActiveOrder[], slotStart: string, side: Side): number {
  return orders
    .filter((order) => order.slotStart === slotStart && order.side === side && order.status === "OPEN")
    .reduce((sum, order) => sum + (order.price * order.size), 0);
}

export class RiskEngine {
  constructor(private readonly config: AppConfig) {}

  computeExposure(orders: ActiveOrder[], slotStart: string): RiskExposure {
    const yesUsd = sideExposure(orders, slotStart, "YES");
    const noUsd = sideExposure(orders, slotStart, "NO");
    return {
      totalUsd: yesUsd + noUsd,
      yesUsd,
      noUsd
    };
  }

  evaluate(
    intent: QuoteIntent,
    orders: ActiveOrder[],
    opposingBid: number | null
  ): QuoteDecision {
    const createdAt = new Date().toISOString();
    const exposure = this.computeExposure(orders, intent.slotStart);
    const nextCost = intent.price * intent.size;
    const currentSideExposure = intent.side === "YES" ? exposure.yesUsd : exposure.noUsd;

    if (opposingBid != null && intent.price + opposingBid > this.config.sumCheckThreshold) {
      return {
        asset: intent.asset,
        tokenId: intent.tokenId,
        slotStart: intent.slotStart,
        side: intent.side,
        action: "BLOCK",
        reason: "sum-check-threshold-exceeded",
        createdAt
      };
    }

    if (exposure.totalUsd + nextCost > this.config.maxSlotExposureUsd) {
      return {
        asset: intent.asset,
        tokenId: intent.tokenId,
        slotStart: intent.slotStart,
        side: intent.side,
        action: "BLOCK",
        reason: "slot-exposure-cap-exceeded",
        createdAt
      };
    }

    if (currentSideExposure + nextCost > this.config.maxSideExposureUsd) {
      return {
        asset: intent.asset,
        tokenId: intent.tokenId,
        slotStart: intent.slotStart,
        side: intent.side,
        action: "BLOCK",
        reason: "side-exposure-cap-exceeded",
        createdAt
      };
    }

    const existing = orders.find(
      (order) =>
        order.slotStart === intent.slotStart &&
        order.side === intent.side &&
        order.status === "OPEN"
    );

    if (!existing) {
      return {
        asset: intent.asset,
        tokenId: intent.tokenId,
        slotStart: intent.slotStart,
        side: intent.side,
        action: "PLACE",
        price: intent.price,
        size: intent.size,
        reason: intent.reason,
        createdAt
      };
    }

    if (Math.abs(existing.price - intent.price) < 0.009) {
      return {
        asset: intent.asset,
        tokenId: intent.tokenId,
        slotStart: intent.slotStart,
        side: intent.side,
        action: "KEEP",
        reason: "within-tick",
        createdAt
      };
    }

    return {
      asset: intent.asset,
      tokenId: intent.tokenId,
      slotStart: intent.slotStart,
      side: intent.side,
      action: "REPLACE",
      price: intent.price,
      size: intent.size,
      existingOrderId: existing.orderId,
      reason: "price-moved",
      createdAt
    };
  }
}
