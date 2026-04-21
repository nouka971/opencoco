import { randomUUID } from "node:crypto";
import { ClobClient, OrderType, Side as ClobSide } from "@polymarket/clob-client";
import { Wallet } from "ethers";
import type { AppConfig } from "../config.js";
import { Logger } from "../logger.js";
import { JsonlStore } from "../storage/jsonl-store.js";
import type { ActiveOrder, MarketSnapshot, QuoteDecision, Side } from "../types.js";

function sideToClob(side: Side): ClobSide {
  return ClobSide.BUY;
}

export class ExecutionClient {
  private replacementCounters = new Map<string, number>();
  private liveClient: ClobClient | null = null;

  constructor(
    private readonly config: AppConfig,
    private readonly logger: Logger,
    private readonly store: JsonlStore
  ) {}

  async hydrate(knownMarkets: MarketSnapshot[]): Promise<ActiveOrder[]> {
    if (this.config.dryRun) {
      return [];
    }

    const client = this.getLiveClient();
    const remoteOrders = await client.getOpenOrders(undefined, true);
    const knownByToken = new Map<string, { slotStart: string; side: Side }>();

    for (const market of knownMarkets) {
      knownByToken.set(market.tokenIdYes, { slotStart: market.slotStart, side: "YES" });
      knownByToken.set(market.tokenIdNo, { slotStart: market.slotStart, side: "NO" });
    }

    return remoteOrders
      .map((order): ActiveOrder | null => {
        const tokenInfo = knownByToken.get(order.asset_id);
        if (!tokenInfo) {
          return null;
        }

        const remainingSize =
          Number(order.original_size || 0) - Number(order.size_matched || 0);

        return {
          orderId: order.id,
          asset: this.config.asset,
          tokenId: order.asset_id,
          slotStart: tokenInfo.slotStart,
          side: tokenInfo.side,
          price: Number(order.price),
          size: Number.isFinite(remainingSize) ? Math.max(remainingSize, 0) : Number(order.original_size),
          status: "OPEN",
          createdAt: new Date(order.created_at).toISOString(),
          updatedAt: new Date().toISOString()
        };
      })
      .filter((order): order is ActiveOrder => order !== null);
  }

  async cancelAll(): Promise<void> {
    if (this.config.dryRun || !this.config.cancelAllOnBoot) {
      return;
    }

    const client = this.getLiveClient();
    const response = await client.cancelAll();
    this.logger.warn("cancel-all executed on boot", {
      mode: "live",
      result: typeof response === "object" ? "ok" : String(response)
    });
  }

  async cancelStaleOrders(
    currentOrders: ActiveOrder[],
    activeSnapshots: MarketSnapshot[]
  ): Promise<ActiveOrder[]> {
    const activeSlots = new Set(activeSnapshots.map((snapshot) => snapshot.slotStart));
    let orders = [...currentOrders];

    for (const order of currentOrders) {
      if (order.status !== "OPEN") {
        continue;
      }

      if (activeSlots.has(order.slotStart)) {
        continue;
      }

      orders = await this.execute(
        {
          asset: order.asset,
          tokenId: order.tokenId,
          slotStart: order.slotStart,
          side: order.side,
          action: "CANCEL",
          existingOrderId: order.orderId,
          reason: "slot-no-longer-active",
          createdAt: new Date().toISOString()
        },
        orders
      );
    }

    return orders;
  }

  async execute(decision: QuoteDecision, currentOrders: ActiveOrder[]): Promise<ActiveOrder[]> {
    const orders = [...currentOrders];

    if (decision.action === "KEEP" || decision.action === "SKIP" || decision.action === "BLOCK") {
      this.store.append("quote-decisions.jsonl", decision);
      return orders;
    }

    if (decision.action === "CANCEL") {
      const next = await this.cancelExisting(decision, orders);
      this.store.append("quote-decisions.jsonl", decision);
      return next;
    }

    if (decision.action === "REPLACE" && !this.canReplace(decision.asset)) {
      const throttled = { ...decision, action: "BLOCK", reason: "replacement-throttled" as const };
      this.store.append("quote-decisions.jsonl", throttled);
      this.logger.warn("replacement blocked", { asset: decision.asset, side: decision.side });
      return orders;
    }

    let nextOrders = orders;
    if (decision.action === "REPLACE" && decision.existingOrderId) {
      nextOrders = await this.cancelExisting(decision, nextOrders);
    }

    if (decision.action === "PLACE" || decision.action === "REPLACE") {
      const order = this.config.dryRun
        ? await this.placeDryRunOrder(decision)
        : await this.placeLiveOrder(decision);

      nextOrders.push(order);
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

    return nextOrders;
  }

  async reconcileOpenOrders(
    currentOrders: ActiveOrder[],
    knownMarkets: MarketSnapshot[]
  ): Promise<ActiveOrder[]> {
    if (this.config.dryRun) {
      return [...currentOrders];
    }

    const remoteOpenOrders = await this.hydrate(knownMarkets);
    const remoteIds = new Set(remoteOpenOrders.map((order) => order.orderId));
    const nextOrders = currentOrders.map((order) => {
      if (order.status !== "OPEN" || remoteIds.has(order.orderId)) {
        return order;
      }

      const updated = {
        ...order,
        status: "FILLED" as const,
        updatedAt: new Date().toISOString()
      };
      this.store.append("orders.jsonl", {
        ...updated,
        executionMode: "live",
        reason: "no-longer-open-on-clob"
      });
      return updated;
    });

    for (const remoteOrder of remoteOpenOrders) {
      if (nextOrders.some((order) => order.orderId === remoteOrder.orderId)) {
        continue;
      }
      nextOrders.push(remoteOrder);
      this.store.append("orders.jsonl", {
        ...remoteOrder,
        executionMode: "live",
        reason: "recovered-from-clob"
      });
    }

    return nextOrders;
  }

  private async cancelExisting(
    decision: QuoteDecision,
    currentOrders: ActiveOrder[]
  ): Promise<ActiveOrder[]> {
    if (!decision.existingOrderId) {
      return currentOrders;
    }

    const idx = currentOrders.findIndex((order) => order.orderId === decision.existingOrderId);
    if (idx < 0) {
      return currentOrders;
    }

    const updated = {
      ...currentOrders[idx],
      status: "CANCELED" as const,
      updatedAt: new Date().toISOString()
    };

    if (!this.config.dryRun) {
      const client = this.getLiveClient();
      await client.cancelOrder({ orderID: decision.existingOrderId });
    }

    this.store.append("orders.jsonl", {
      ...updated,
      executionMode: this.config.dryRun ? "dry-run" : "live",
      reason: decision.reason
    });
    this.logger.info("order canceled", {
      orderId: updated.orderId,
      side: updated.side,
      mode: this.config.dryRun ? "dry-run" : "live",
      reason: decision.reason
    });

    const nextOrders = [...currentOrders];
    nextOrders[idx] = updated;
    return nextOrders;
  }

  private async placeDryRunOrder(decision: QuoteDecision): Promise<ActiveOrder> {
    return {
      orderId: `dry-${randomUUID()}`,
      asset: decision.asset,
      tokenId: decision.tokenId || "",
      slotStart: decision.slotStart,
      side: decision.side,
      price: decision.price ?? 0,
      size: decision.size ?? this.config.minOrderSize,
      status: "OPEN",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }

  private async placeLiveOrder(decision: QuoteDecision): Promise<ActiveOrder> {
    if (!decision.tokenId) {
      throw new Error(`Missing tokenId for live order on ${decision.slotStart} ${decision.side}`);
    }

    const client = this.getLiveClient();
    const response = await client.createAndPostOrder(
      {
        tokenID: decision.tokenId,
        price: decision.price ?? 0,
        side: sideToClob(decision.side),
        size: decision.size ?? this.config.minOrderSize
      },
      undefined,
      OrderType.GTC,
      false,
      this.config.livePostOnly
    );

    return {
      orderId: response.orderID || randomUUID(),
      asset: decision.asset,
      tokenId: decision.tokenId,
      slotStart: decision.slotStart,
      side: decision.side,
      price: decision.price ?? 0,
      size: decision.size ?? this.config.minOrderSize,
      status: "OPEN",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }

  private getLiveClient(): ClobClient {
    if (this.liveClient) {
      return this.liveClient;
    }

    const signer = new Wallet(this.config.polygonPrivateKey);
    this.liveClient = new ClobClient(
      this.config.clobUrl,
      137,
      signer,
      {
        key: this.config.polyApiKey,
        secret: this.config.polyApiSecret,
        passphrase: this.config.polyPassphrase
      },
      this.config.polySignatureType,
      this.config.polyAddress,
      undefined,
      true,
      undefined,
      undefined,
      true,
      undefined,
      true
    );

    return this.liveClient;
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
