import type { AppConfig } from "../config.js";
import { Logger } from "../logger.js";
import { JsonlStore } from "../storage/jsonl-store.js";
import type { ActiveOrder, FillRecord } from "../types.js";

export class Reconciler {
  constructor(
    private readonly config: AppConfig,
    private readonly logger: Logger,
    private readonly store: JsonlStore
  ) {}

  reconcile(orders: ActiveOrder[], fills: FillRecord[]): void {
    const snapshot = {
      ts: new Date().toISOString(),
      asset: this.config.asset,
      openOrders: orders.filter((order) => order.status === "OPEN").length,
      fills: fills.length
    };
    this.store.append("reconciliation.jsonl", snapshot);
    this.logger.info("reconciliation complete", snapshot);
  }
}
