# Production `.env` placement

Put the production file on the VPS at:

`/opt/opencoco/shared/.env`

The current app symlink already points `/opt/opencoco/current/.env` to that shared file.

## Recommended initial contents

```env
NODE_ENV=production
LOG_LEVEL=info

OPENCOCO_ASSET=BTC
OPENCOCO_MARKET_WINDOW_MINUTES=15
OPENCOCO_MAX_ACTIVE_SLOTS=1
OPENCOCO_MIN_PRICE=0.10
OPENCOCO_MAX_PRICE=0.90
OPENCOCO_MIN_ORDER_SIZE=5
OPENCOCO_MAX_SLOT_EXPOSURE_USD=25
OPENCOCO_MAX_SIDE_EXPOSURE_USD=12.5
OPENCOCO_MAX_REPLACEMENTS_PER_MINUTE=24
OPENCOCO_SUM_CHECK_THRESHOLD=0.985
OPENCOCO_DRY_RUN=true
OPENCOCO_REQUIRE_TWO_SIDED_QUOTES=true
OPENCOCO_CANCEL_ALL_ON_BOOT=true
OPENCOCO_LIVE_POST_ONLY=true

POLY_CLOB_URL=https://clob.polymarket.com
POLY_WS_URL=wss://ws-subscriptions-clob.polymarket.com/ws/market
POLY_GAMMA_URL=https://gamma-api.polymarket.com
POLY_SIGNATURE_TYPE=2

POLY_API_KEY=replace_me
POLY_API_SECRET=replace_me
POLY_PASSPHRASE=replace_me
POLY_ADDRESS=replace_me
POLYGON_PRIVATE_KEY=replace_me

OPENCOCO_RUNTIME_DIR=./runtime
OPENCOCO_HEARTBEAT_FILE=./runtime/bot-status.json
```

## What each secret should contain

- `POLY_API_KEY`: the Polymarket CLOB API key derived for the current signer wallet
- `POLY_API_SECRET`: the matching CLOB API secret
- `POLY_PASSPHRASE`: the matching CLOB passphrase
- `POLY_ADDRESS`: the Polymarket profile/proxy address that receives USDC
- `POLYGON_PRIVATE_KEY`: the private key for the signer wallet, with no quotes
- `POLY_SIGNATURE_TYPE=2`: browser wallet / MetaMask style account, which matches your current setup

## Safe rollout order

1. Keep `OPENCOCO_DRY_RUN=true` while validating discovery and websocket data.
2. Restart PM2 and inspect logs.
3. Confirm only one active slot is quoted and both sides remain paired.
4. Only after that, switch to `OPENCOCO_DRY_RUN=false`.
5. Restart again and validate live execution with minimal size.
