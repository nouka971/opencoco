import type { AppConfig } from "../config.js";
import { Logger } from "../logger.js";
import { MarketDiscovery } from "../market-data/discovery.js";
import { MarketDataClient } from "../market-data/ws-client.js";
import { ExecutionClient } from "../execution/execution-client.js";
import { Reconciler } from "../reconciliation/reconciler.js";
import { RiskEngine } from "../risk/risk-engine.js";
import { JsonlStore } from "../storage/jsonl-store.js";
import { QuoteStrategy } from "../strategy/quote-strategy.js";
import type { ActiveOrder, FillRecord, HealthStatus, MarketSnapshot, QuoteDecision } from "../types.js";
import { HealthReporter } from "../health.js";

export class OpenCocoBot {
  private readonly startedAt = new Date().toISOString();
  private lastCycleAt: string | null = null;
  private lastReconcileAt: string | null = null;
  private lastError: string | null = null;
  private orders: ActiveOrder[] = [];
  private fills: FillRecord[] = [];
  private snapshots: MarketSnapshot[] = [];

  private readonly store: JsonlStore;
  private readonly discovery: MarketDiscovery;
  private readonly marketData: MarketDataClient;
  private readonly strategy: QuoteStrategy;
  private readonly risk: RiskEngine;
  private readonly execution: ExecutionClient;
  private readonly reconciler: Reconciler;
  private readonly health: HealthReporter;

  constructor(
    private readonly config: AppConfig,
    private readonly logger: Logger
  ) {
    this.store = new JsonlStore(config.runtimeDir);
    this.discovery = new MarketDiscovery(config);
    this.marketData = new MarketDataClient(config, logger);
    this.strategy = new QuoteStrategy(config);
    this.risk = new RiskEngine(config);
    this.execution = new ExecutionClient(config, logger, this.store);
    this.reconciler = new Reconciler(config, logger, this.store);
    this.health = new HealthReporter(this.store);
  }

  async start(): Promise<void> {
    this.store.ensureRuntimeDir();
    this.snapshots = await this.discovery.discover();
    await this.marketData.start(this.snapshots);
    await this.execution.cancelAll();
    this.orders = await this.execution.hydrate(this.snapshots);
    this.logger.info("bot started", {
      asset: this.config.asset,
      mode: this.config.dryRun ? "dry-run" : "live",
      snapshots: this.snapshots.length
    });
  }

  async runCycle(): Promise<void> {
    try {
      const discoveredSnapshots = await this.discovery.discover();
      this.marketData.setSnapshots(discoveredSnapshots);
      this.snapshots = this.marketData
        .currentSnapshots()
        .slice(0, this.config.maxActiveSlots);
      this.orders = await this.execution.cancelStaleOrders(this.orders, this.snapshots);

      for (const market of this.snapshots) {
        const intents = this.strategy.buildIntents(market);
        const decisions = intents.map((intent) => {
          const opposingBid = intent.side === "YES" ? market.bestBidNo : market.bestBidYes;
          return this.risk.evaluate(intent, this.orders, opposingBid);
        });

        for (const decision of this.enforcePairedQuoting(market.slotStart, decisions)) {
          this.orders = await this.execution.execute(decision, this.orders);
        }
      }

      this.lastCycleAt = new Date().toISOString();
      this.writeHealth();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.lastError = message;
      this.logger.error("cycle failed", { error: message });
      this.writeHealth();
      throw error;
    }
  }

  async reconcile(): Promise<void> {
    this.orders = await this.execution.reconcileOpenOrders(this.orders, this.snapshots);
    this.reconciler.reconcile(this.orders, this.fills);
    this.lastReconcileAt = new Date().toISOString();
    this.writeHealth();
  }

  private enforcePairedQuoting(slotStart: string, decisions: QuoteDecision[]): QuoteDecision[] {
    if (!this.config.requireTwoSidedQuotes) {
      return decisions;
    }

    const openOrders = this.orders.filter(
      (order) => order.slotStart === slotStart && order.status === "OPEN"
    );
    const canQuoteBothSides = decisions.every((decision) =>
      decision.action === "PLACE" || decision.action === "REPLACE" || decision.action === "KEEP"
    );

    if (canQuoteBothSides) {
      return decisions;
    }

    const blockedDecisions = decisions.map((decision) => {
      if (decision.action === "KEEP" || decision.action === "PLACE" || decision.action === "REPLACE") {
        const existingOrder = openOrders.find((order) => order.side === decision.side);
        if (existingOrder) {
          return {
            asset: existingOrder.asset,
            tokenId: existingOrder.tokenId,
            slotStart: existingOrder.slotStart,
            side: existingOrder.side,
            action: "CANCEL" as const,
            existingOrderId: existingOrder.orderId,
            reason: "two-sided-pair-required",
            createdAt: new Date().toISOString()
          };
        }
      }

      return {
        ...decision,
        action: "BLOCK" as const,
        reason: decision.reason === "two-sided-pair-required"
          ? decision.reason
          : `two-sided-pair-required:${decision.reason}`
      };
    });

    return blockedDecisions;
  }

  private writeHealth(): void {
    const status: HealthStatus = {
      name: "opencoco",
      version: "0.1.0",
      asset: this.config.asset,
      liveMode: this.config.dryRun ? "dry-run" : "live",
      startedAt: this.startedAt,
      lastCycleAt: this.lastCycleAt,
      lastReconcileAt: this.lastReconcileAt,
      marketSnapshots: this.snapshots.length,
      openOrders: this.orders.filter((order) => order.status === "OPEN").length,
      lastError: this.lastError
    };
    this.health.write(status);
  }
}
