import { describe, expect, it } from "vitest";
import { RiskEngine } from "../src/risk/risk-engine.js";
import type { ActiveOrder, QuoteIntent } from "../src/types.js";

const config = {
  maxSlotExposureUsd: 20,
  maxSideExposureUsd: 10,
  sumCheckThreshold: 0.985
} as const;

describe("RiskEngine", () => {
  it("blocks sum check violations", () => {
    const engine = new RiskEngine(config as never);
    const intent: QuoteIntent = {
      asset: "BTC",
      slotStart: "2026-04-21T12:00:00.000Z",
      side: "YES",
      price: 0.5,
      size: 5,
      reason: "test"
    };

    const decision = engine.evaluate(intent, [], 0.49);
    expect(decision.action).toBe("BLOCK");
    expect(decision.reason).toBe("sum-check-threshold-exceeded");
  });

  it("blocks slot exposure cap", () => {
    const engine = new RiskEngine(config as never);
    const orders: ActiveOrder[] = [
      {
        orderId: "1",
        asset: "BTC",
        slotStart: "2026-04-21T12:00:00.000Z",
        side: "YES",
        price: 0.9,
        size: 10,
        status: "OPEN",
        createdAt: "2026-04-21T11:00:00.000Z",
        updatedAt: "2026-04-21T11:00:00.000Z"
      }
    ];

    const intent: QuoteIntent = {
      asset: "BTC",
      slotStart: "2026-04-21T12:00:00.000Z",
      side: "NO",
      price: 0.5,
      size: 25,
      reason: "test"
    };

    const decision = engine.evaluate(intent, orders, 0.2);
    expect(decision.action).toBe("BLOCK");
    expect(decision.reason).toBe("slot-exposure-cap-exceeded");
  });
});
