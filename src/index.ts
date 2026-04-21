import { loadConfig } from "./config.js";
import { Logger } from "./logger.js";
import { OpenCocoBot } from "./orchestrator/bot.js";

async function main(): Promise<void> {
  const config = loadConfig();
  const logger = new Logger(config.logLevel);
  const bot = new OpenCocoBot(config, logger);

  await bot.start();
  await bot.runCycle();
  await bot.reconcile();

  const cycleMs = 15_000;
  setInterval(() => {
    bot.runCycle().catch((error) => {
      logger.error("scheduled cycle failed", {
        error: error instanceof Error ? error.message : String(error)
      });
    });
  }, cycleMs);

  setInterval(() => {
    bot.reconcile().catch((error) => {
      logger.error("scheduled reconcile failed", {
        error: error instanceof Error ? error.message : String(error)
      });
    });
  }, 60_000);
}

main().catch((error) => {
  const message = error instanceof Error ? error.stack || error.message : String(error);
  console.error(message);
  process.exit(1);
});
