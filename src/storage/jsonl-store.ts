import fs from "node:fs";
import path from "node:path";

export class JsonlStore {
  constructor(private readonly runtimeDir: string) {}

  ensureRuntimeDir(): void {
    fs.mkdirSync(this.runtimeDir, { recursive: true });
  }

  append(fileName: string, payload: unknown): void {
    this.ensureRuntimeDir();
    const target = path.join(this.runtimeDir, fileName);
    fs.appendFileSync(target, `${JSON.stringify(payload)}\n`);
  }

  writeJson(fileName: string, payload: unknown): void {
    this.ensureRuntimeDir();
    const target = path.join(this.runtimeDir, fileName);
    fs.writeFileSync(target, JSON.stringify(payload, null, 2));
  }
}
