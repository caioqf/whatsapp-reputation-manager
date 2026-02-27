# WhatsApp Reputation Monitor

AWS SAM project for monitoring WhatsApp phone number reputation across multiple providers.

## Architecture

- **PollingOrchestrator** (Lambda): triggered by EventBridge, fetches reputation from providers, publishes to SQS
- **ReputationProcessor** (Lambda): consumes SQS, runs the status engine, persists to DynamoDB, sends SES alerts
- **WebhookHandler** (Lambda): *not yet implemented* — receives provider webhooks via API Gateway

## Project Structure

```
src/
├── shared/         # Types, interfaces, status engine, logger
├── providers/      # Provider adapters (Gupshup, Example)
├── infra/          # AWS SDK clients (DynamoDB, SQS, SES)
├── polling/        # PollingOrchestrator Lambda handler
├── processor/      # ReputationProcessor Lambda handler
└── webhook/        # WebhookHandler stub (not yet implemented)
```

## Setup

```bash
npm install
npm run build
```

## Deploy

```bash
sam build
sam deploy --guided
```

Required parameters on first deploy:

| Parameter              | Description                              |
|------------------------|------------------------------------------|
| `AlertRecipients`      | Comma-separated alert email addresses    |
| `SesFromEmail`         | Verified SES sender email                |
| `ProvidersEnabled`     | Comma-separated provider names (e.g. `gupshup`) |
| `GupshupApiKey`        | Gupshup API key                         |
| `GupshupPartnerToken`  | Gupshup partner token                   |

## Local invoke

```bash
sam local invoke PollingOrchestratorFunction --event events/schedule.json
```

## Adding a new provider

1. Create `src/providers/your-provider.ts` implementing `ReputationProvider`
2. Register it in `src/shared/provider.registry.ts`
3. Add its name to `PROVIDERS_ENABLED` env var

## Notes

- Idempotency: duplicate SQS messages with the same `phoneNumber + timestamp` key will overwrite identically in DynamoDB (no side effects)
- For strict deduplication in high-throughput scenarios, migrate `ReputationEventsQueue` to a FIFO queue
- Polling interval defaults to every 15 minutes (configurable via `PollingScheduleExpression` parameter)
