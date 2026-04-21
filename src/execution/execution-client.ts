import { randomUUID } from "node:crypto";
import type { AppConfig } from "../config.js";
import { Logger } from "../logger.js";
import { JsonlStore } from "../storage/jsonl-store.js";
import type { ActiveOrder, QuoteDecision } from "../types.js";

export class ExecutionClient {
  private replacementCounters = new Map<string, number>();

  constructor(
    private readonly config: AppConfig,
    private readonly logger: Logger,
    private readonly store: JsonlStore
  ) {}

  execute(decision: QuoteDecision, currentOrders: ActiveOrder[]): ActiveOrder[] {
    const orders = [...currentOrders];

    if (decision.action === "KEEP" || decision.action === "SKIP" || decision.action === "BLOCK") {
      this.store.append("quote-decisions.jsonl", decision);
      return orders;
    }

    if (decision.action === "REPLACE" && !this.canReplace(decision.asset)) {
      const throttled = { ...decision, action: "BLOCK", reason: "replacement-throttled" };
      this.store.append("quote-decisions.jsonl", throttled);
      this.logger.warn("replacement blocked", { asset: decision.asset, side: decision.side });
      return orders;
    }

    if (decision.action === "REPLACE" && decision.existingOrderId) {
      const idx = orders.findIndex((order) => order.orderId === decision.existingOrderId);
      if (idx >= 0) {
        orders[idx] = { ...orders[idx], status: "REPLACED", updatedAt: new Date().toISOString() };
        this.store.append("orders.jsonl", orders[idx]);
      }
    }

    if (decision.action === "PLACE" || decision.action === "REPLACE") {
      const order: ActiveOrder = {
        orderId: this.config.dryRun ? `dry-${randomUUID()}` : randomUUID(),
        asset: decision.asset,
        slotStart: decision.slotStart,
        side: decision.side,
        price: decision.price ?? 0,
        size: decision.size ?? this.config.minOrderSize,
        status: "OPEN",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      orders.push(order);
      this.store.append("quote-decisions.jsonl", decision);
      this.store.append("orders.jsonl", {
        ...order,
        executionMode: this.config.dryRun ? "dry-run" : "live"
      });
      this.logger.info("order accepted", {
        orderId: order.orderId,
        side: order.side,
        price: order.price,
        size: order.size,
        mode: this.config.dryRun ? "dry-run" : "live"
      });
    }

    return orders;
  }

  hydrate(existing: ActiveOrder[]): ActiveOrder[] {
    return existing.map((order) => ({ ...order }));
  }

  private canReplace(asset: string): boolean {
    const minute = Math.floor(Date.now() / 60_000);
    const key = `${asset}:${minute}`;
    const count = this.replacementCounters.get(key) ?? 0;
    if (count >= this.config.maxReplacementsPerMinute) {
      return false;
    }
    this.replacementCounters.set(key, count + 1);
    return true;
  }
}
