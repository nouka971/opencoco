# OpenCoco

Clean-room TypeScript scaffold for a Polymarket BTC 15m market maker.

## What is included

- Strict boot-time config validation
- Modular architecture: market-data, strategy, risk, execution, reconciliation
- JSONL observability for quote decisions, orders, fills, and bot status
- PM2 process config
- GitHub Actions deployment workflow for a hardened VPS

## Quick start

```bash
npm install
cp .env.example .env
npm run dev
```

## Runtime files

The bot writes local structured artifacts under `runtime/`:

- `quote-decisions.jsonl`
- `orders.jsonl`
- `fills.jsonl`
- `reconciliation.jsonl`
- `bot-status.json`

## Security posture

- Keep `.env` only on the VPS
- Never commit secrets
- Treat legacy infra as compromised until rebuilt
- Use a fresh wallet and fresh Polymarket credentials
