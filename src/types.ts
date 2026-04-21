export type Side = "YES" | "NO";

export type DecisionAction = "PLACE" | "REPLACE" | "CANCEL" | "KEEP" | "SKIP" | "BLOCK";

export interface MarketSnapshot {
  asset: string;
  slug: string;
  conditionId: string;
  tokenIdYes: string;
  tokenIdNo: string;
  slotStart: string;
  slotEnd: string;
  bestBidYes: number | null;
  bestAskYes: number | null;
  bestBidNo: number | null;
  bestAskNo: number | null;
  tickSize: number;
  updatedAt: string;
}

export interface QuoteIntent {
  asset: string;
  slotStart: string;
  side: Side;
  price: number;
  size: number;
  reason: string;
}

export interface QuoteDecision {
  asset: string;
  slotStart: string;
  side: Side;
  action: DecisionAction;
  price?: number;
  size?: number;
  existingOrderId?: string;
  reason: string;
  createdAt: string;
}

export interface ActiveOrder {
  orderId: string;
  asset: string;
  slotStart: string;
  side: Side;
  price: number;
  size: number;
  status: "OPEN" | "CANCELED" | "FILLED" | "REPLACED";
  createdAt: string;
  updatedAt: string;
}

export interface FillRecord {
  fillId: string;
  asset: string;
  slotStart: string;
  side: Side;
  price: number;
  size: number;
  cost: number;
  createdAt: string;
}

export interface RiskExposure {
  totalUsd: number;
  yesUsd: number;
  noUsd: number;
}

export interface HealthStatus {
  name: string;
  version: string;
  asset: string;
  liveMode: "dry-run" | "live";
  startedAt: string;
  lastCycleAt: string | null;
  lastReconcileAt: string | null;
  marketSnapshots: number;
  openOrders: number;
  lastError: string | null;
}
