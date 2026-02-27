# WhatsApp Reputation Monitor – AWS SAM Project Specification

## Overview

This document defines the complete technical specification for generating an AWS SAM project using Node.js 20.x (LTS) and TypeScript. The system must implement a multi-provider WhatsApp reputation monitoring service supporting webhook ingestion, polling ingestion, state persistence, and alerting via SES.

Webhook and polling must converge into a single processing pipeline.

---

## DETAILS

It needs to be in CONTAINER IMAGE form

## Architecture Summary

### AWS Services

- API Gateway
- Lambda: WebhookHandler
- Lambda: PollingOrchestrator
- Lambda: ReputationProcessor
- SQS: ReputationEventsQueue
- SQS: ReputationEventsDLQ
- EventBridge Scheduler
- DynamoDB: WhatsAppNumbers
- DynamoDB: ReputationEvents
- Amazon SES
- CloudWatch Logs

---

## System Flows

### Webhook Flow

Provider  
→ API Gateway  
→ Lambda WebhookHandler  
→ SQS ReputationEventsQueue  
→ Lambda ReputationProcessor  
→ DynamoDB  
→ SES (if alert condition met)

---

### Polling Flow

EventBridge Scheduler  
→ Lambda PollingOrchestrator  
→ Provider API  
→ SQS ReputationEventsQueue  
→ Lambda ReputationProcessor  

Webhook and Polling must publish messages to the same SQS queue.

---

## Functional Requirements

1. Support multiple providers via adapter pattern.
2. Normalize all provider responses into a canonical internal model.
3. Persist current reputation state per phone number.
4. Persist reputation change events.
5. Send alert email only when status transitions to LOW or BLOCKED.
6. Prevent duplicate alerts when status remains unchanged.
7. Ensure idempotent processing.
8. Use SQS retry and DLQ for failure handling.
9. Webhook Lambda must respond immediately and not execute business logic.
10. Polling must reuse the same processing pipeline as webhook.

---

## Project Structure

```
whatsapp-reputation-monitor/
│
├── template.yaml
├── samconfig.toml
├── package.json
├── tsconfig.json
├── README.md
│
└── src/
    ├── shared/
    │   ├── types.ts
    │   ├── provider.interface.ts
    │   ├── provider.registry.ts
    │   ├── status-engine.ts
    │   └── logger.ts
    │
    ├── providers/
    │   ├── gupshup.provider.ts
    │   └── example.provider.ts
    │
    ├── webhook/
    │   └── handler.ts
    │
    ├── polling/
    │   └── handler.ts
    │
    ├── processor/
    │   └── handler.ts
    │
    └── infra/
        ├── dynamodb.ts
        ├── ses.ts
        └── sqs.ts
```

---

## Canonical Internal Model

```ts
export type ReputationStatus = 'HIGH' | 'MEDIUM' | 'LOW' | 'BLOCKED'

export type NormalizedReputationStatus = {
  phoneNumber: string
  provider: string
  status: ReputationStatus
  rawStatus: string
  source: 'WEBHOOK' | 'POLLING'
  timestamp: string
  rawPayload?: unknown
}
```

All external payloads must be converted into this model.

---

## Provider Abstraction

```ts
export interface ReputationProvider {
  name: string
  supportsWebhook(): boolean
  supportsPolling(): boolean

  parseWebhook(payload: any): NormalizedReputationStatus
  fetchReputation(phoneNumber: string): Promise<NormalizedReputationStatus>
}
```

Providers must only translate external API data. No business logic allowed inside providers.

A provider registry must dynamically resolve providers by name.

---

## Core Business Logic – Status Engine

```ts
processReputationEvent(event: NormalizedReputationStatus)
```

Responsibilities:

1. Retrieve current state from DynamoDB.
2. Compare existing status with event.status.
3. If unchanged:
   - Update last_checked_at.
4. If changed:
   - Insert record into ReputationEvents table.
   - Update current_status in WhatsAppNumbers.
   - If new status is LOW or BLOCKED:
     - Send email via SES.
5. Ensure idempotency.

Business logic must not live inside Lambda handlers.

---

## DynamoDB Design

### Table: WhatsAppNumbers

Partition Key:
- phoneNumber (string)

Attributes:
- provider
- current_status
- last_checked_at
- last_source
- last_alert_status

---

### Table: ReputationEvents

Partition Key:
- phoneNumber (string)

Sort Key:
- timestamp (string ISO format)

Attributes:
- provider
- old_status
- new_status
- source
- rawPayload

---

## Webhook Lambda Responsibilities

- Validate request signature.
- Identify provider.
- Parse payload using provider.parseWebhook().
- Publish normalized event to SQS.
- Return HTTP 200 immediately.

Must not:
- Access DynamoDB.
- Send email.
- Perform status comparison.

---

## Polling Lambda Responsibilities

Triggered by EventBridge schedule.

- Retrieve active numbers from DynamoDB.
- Group by provider.
- For providers supporting polling:
  - Call provider.fetchReputation().
  - Publish normalized event to SQS.

Must not:
- Update DynamoDB.
- Send alerts.

---

## Reputation Processor Lambda

Triggered by SQS.

Configuration:
- BatchSize: 5
- Timeout: 30 seconds
- Memory: 256 MB
- Architecture: arm64
- DLQ enabled

Responsibilities:
- Parse SQS messages.
- Invoke status engine.
- Log structured output.
- Allow retry through SQS mechanism.

---

## SES Integration

Environment variable:

ALERT_RECIPIENTS=email1@example.com,email2@example.com

Alert email must include:
- Phone number
- Provider
- Previous status
- New status
- Timestamp

---

## template.yaml Requirements

- Runtime: nodejs20.x
- Architecture: arm64
- SQS with DLQ redrive policy
- EventBridge cron rule
- API Gateway route
- DynamoDB tables
- IAM least privilege:
  - DynamoDB read/write
  - SQS send/consume
  - SES send email
  - CloudWatch logs

---

## Environment Variables

- TABLE_WHATSAPP_NUMBERS
- TABLE_REPUTATION_EVENTS
- SQS_QUEUE_URL
- ALERT_RECIPIENTS
- PROVIDERS_ENABLED
- NODE_OPTIONS=--enable-source-maps

---

## package.json Requirements

Dependencies:
- typescript
- @types/aws-lambda
- @aws-sdk/client-dynamodb
- @aws-sdk/lib-dynamodb
- @aws-sdk/client-sqs
- @aws-sdk/client-ses
- axios
- pino

Dev Dependencies:
- ts-node
- @types/node

Scripts:
- build
- sam:build
- sam:deploy
- sam:local

---

## Observability

- Structured JSON logging.
- CloudWatch metrics:
  - events_processed
  - status_transitions
  - alerts_sent
  - processing_errors

---

## Engineering Constraints

1. No business logic inside Lambda handlers.
2. Providers strictly encapsulate external API logic.
3. Webhook and Polling must converge via SQS.
4. Processor is the single state decision point.
5. Idempotency must be guaranteed.
6. Retry and failure handled via SQS and DLQ.
7. Code must be modular and testable.
8. Avoid unnecessary dependencies.

---

## Expected Outcome

A deployable AWS SAM project that:

- Implements event-driven architecture.
- Supports multi-provider reputation ingestion.
- Converges webhook and polling through SQS.
- Persists state in DynamoDB.
- Sends alerts only on state transitions.
- Follows clean architecture and production-grade engineering practices.