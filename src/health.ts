import type { HealthStatus } from "./types.js";
import { JsonlStore } from "./storage/jsonl-store.js";

export class HealthReporter {
  constructor(private readonly store: JsonlStore) {}

  write(status: HealthStatus): void {
    this.store.writeJson("bot-status.json", status);
  }
}
