import WebSocket from "ws";
import type { AppConfig } from "../config.js";
import { Logger } from "../logger.js";
import type { MarketSnapshot } from "../types.js";

export class MarketDataClient {
  private ws: WebSocket | null = null;
  private snapshots = new Map<string, MarketSnapshot>();
  private tokenIndex = new Map<string, { key: string; side: "YES" | "NO" }>();
  private reconnectDelayMs = 1_000;

  constructor(
    private readonly config: AppConfig,
    private readonly logger: Logger
  ) {}

  async start(initialSnapshots: MarketSnapshot[]): Promise<void> {
    this.setSnapshots(initialSnapshots);
    this.logger.info("market data client ready", {
      asset: this.config.asset,
      wsUrl: this.config.wsUrl,
      markets: initialSnapshots.length
    });
    this.connect();
  }

  setSnapshots(nextSnapshots: MarketSnapshot[]): void {
    this.snapshots = new Map(
      nextSnapshots.map((snapshot) => {
        const existing = this.snapshots.get(this.snapshotKey(snapshot));
        return [
          this.snapshotKey(snapshot),
          existing
            ? {
                ...snapshot,
                bestBidYes: existing.bestBidYes,
                bestAskYes: existing.bestAskYes,
                bestBidNo: existing.bestBidNo,
                bestAskNo: existing.bestAskNo,
                updatedAt: existing.updatedAt
              }
            : snapshot
        ];
      })
    );
    this.rebuildTokenIndex();
    this.subscribeCurrentTokens();
  }

  currentSnapshots(): MarketSnapshot[] {
    return [...this.snapshots.values()].sort((a, b) => a.slotEpoch - b.slotEpoch);
  }

  private connect(): void {
    this.ws = new WebSocket(this.config.wsUrl);

    this.ws.on("open", () => {
      this.logger.info("polymarket ws connected", { url: this.config.wsUrl });
      this.reconnectDelayMs = 1_000;
      this.subscribeCurrentTokens();
    });

    this.ws.on("message", (raw) => {
      const text = raw.toString().trim();
      if (!text || (text[0] !== "{" && text[0] !== "[")) {
        return;
      }

      try {
        const payload = JSON.parse(text) as unknown;
        const events = Array.isArray(payload) ? payload : [payload];
        for (const event of events) {
          this.handleEvent(event);
        }
      } catch (error) {
        this.logger.warn("polymarket ws parse error", {
          error: error instanceof Error ? error.message : String(error)
        });
      }
    });

    this.ws.on("close", () => {
      this.logger.warn("polymarket ws closed", { reconnectDelayMs: this.reconnectDelayMs });
      setTimeout(() => this.connect(), this.reconnectDelayMs);
      this.reconnectDelayMs = Math.min(this.reconnectDelayMs * 2, 30_000);
    });

    this.ws.on("error", (error) => {
      this.logger.warn("polymarket ws error", {
        error: error instanceof Error ? error.message : String(error)
      });
    });
  }

  private subscribeCurrentTokens(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    const tokenIds = [...this.tokenIndex.keys()];
    if (tokenIds.length === 0) {
      return;
    }

    this.ws.send(JSON.stringify({ type: "market", assets_ids: tokenIds }));
  }

  private handleEvent(event: unknown): void {
    if (!event || typeof event !== "object") {
      return;
    }

    const payload = event as {
      event_type?: string;
      asset_id?: string;
      bids?: Array<{ price?: string | number }>;
      buys?: Array<{ price?: string | number }>;
      asks?: Array<{ price?: string | number }>;
      sells?: Array<{ price?: string | number }>;
    };

    if (!payload.event_type || !payload.asset_id) {
      return;
    }

    if (payload.event_type !== "book" && payload.event_type !== "price_change") {
      return;
    }

    const tokenInfo = this.tokenIndex.get(payload.asset_id);
    if (!tokenInfo) {
      return;
    }

    const snapshot = this.snapshots.get(tokenInfo.key);
    if (!snapshot) {
      return;
    }

    const bids = payload.bids || payload.buys || [];
    const asks = payload.asks || payload.sells || [];
    const bestBid = this.extractBid(bids);
    const bestAsk = this.extractAsk(asks);

    this.snapshots.set(
      tokenInfo.key,
      tokenInfo.side === "YES"
        ? {
            ...snapshot,
            bestBidYes: bestBid ?? snapshot.bestBidYes,
            bestAskYes: bestAsk ?? snapshot.bestAskYes,
            updatedAt: new Date().toISOString()
          }
        : {
            ...snapshot,
            bestBidNo: bestBid ?? snapshot.bestBidNo,
            bestAskNo: bestAsk ?? snapshot.bestAskNo,
            updatedAt: new Date().toISOString()
          }
    );
  }

  private extractBid(levels: Array<{ price?: string | number }>): number | null {
    const last = levels[levels.length - 1];
    const price = Number(last?.price);
    return Number.isFinite(price) ? price : null;
  }

  private extractAsk(levels: Array<{ price?: string | number }>): number | null {
    const first = levels[0];
    const price = Number(first?.price);
    return Number.isFinite(price) ? price : null;
  }

  private rebuildTokenIndex(): void {
    this.tokenIndex.clear();
    for (const snapshot of this.snapshots.values()) {
      const key = this.snapshotKey(snapshot);
      this.tokenIndex.set(snapshot.tokenIdYes, { key, side: "YES" });
      this.tokenIndex.set(snapshot.tokenIdNo, { key, side: "NO" });
    }
  }

  private snapshotKey(snapshot: MarketSnapshot): string {
    return `${snapshot.asset}_${snapshot.slotEpoch}`;
  }
}
