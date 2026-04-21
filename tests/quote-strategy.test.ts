import { describe, expect, it } from "vitest";
import { QuoteStrategy } from "../src/strategy/quote-strategy.js";
import type { MarketSnapshot } from "../src/types.js";

describe("QuoteStrategy", () => {
  it("quotes one penny ahead when books exist", () => {
    const strategy = new QuoteStrategy({
      maxPrice: 0.9,
      minPrice: 0.1,
      minOrderSize: 5,
      sumCheckThreshold: 0.985
    } as never);

    const market: MarketSnapshot = {
      asset: "BTC",
      slug: "btc-updown-15m-1",
      conditionId: "c1",
      tokenIdYes: "yes",
      tokenIdNo: "no",
      negRisk: false,
      slotEpoch: 1713700800,
      slotStart: "2026-04-21T12:00:00.000Z",
      slotEnd: "2026-04-21T12:15:00.000Z",
      bestBidYes: 0.48,
      bestAskYes: 0.49,
      bestBidNo: 0.47,
      bestAskNo: 0.48,
      tickSize: 0.01,
      updatedAt: "2026-04-21T12:00:00.000Z"
    };

    const intents = strategy.buildIntents(market);
    expect(intents[0]?.price).toBe(0.49);
    expect(intents[1]?.price).toBe(0.48);
    expect(intents[0]?.tokenId).toBe("yes");
    expect(intents[1]?.tokenId).toBe("no");
  });

  it("caps quotes under the sum threshold", () => {
    const strategy = new QuoteStrategy({
      maxPrice: 0.9,
      minPrice: 0.1,
      minOrderSize: 5,
      sumCheckThreshold: 0.985
    } as never);

    const market: MarketSnapshot = {
      asset: "BTC",
      slug: "btc-updown-15m-2",
      conditionId: "c2",
      tokenIdYes: "yes2",
      tokenIdNo: "no2",
      negRisk: false,
      slotEpoch: 1713701700,
      slotStart: "2026-04-21T12:15:00.000Z",
      slotEnd: "2026-04-21T12:30:00.000Z",
      bestBidYes: 0.6,
      bestAskYes: 0.61,
      bestBidNo: 0.38,
      bestAskNo: 0.39,
      tickSize: 0.01,
      updatedAt: "2026-04-21T12:15:00.000Z"
    };

    const intents = strategy.buildIntents(market);
    expect(intents[0]?.price).toBe(0.6);
    expect(intents[1]?.price).toBe(0.38);
  });
});
