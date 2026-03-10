import { SQSEvent, SQSRecord, SQSBatchResponse } from 'aws-lambda'
import { NormalizedReputationStatus, RawWebhookMessage, SqsMessage } from '../shared/types'
import { processReputationEvent } from '../shared/status-engine'
import { registry } from '../shared/provider.registry'
import { logger } from '../shared/logger'

export async function handler(event: SQSEvent): Promise<SQSBatchResponse> {
  const batchItemFailures: SQSBatchResponse['batchItemFailures'] = []

  for (const record of event.Records) {
    try {
      await processRecord(record)
    } catch (err) {
      logger.error({ messageId: record.messageId, err }, 'processing_error')
      batchItemFailures.push({ itemIdentifier: record.messageId })
    }
  }

  return { batchItemFailures }
}

async function processRecord(record: SQSRecord): Promise<void> {
  logger.info({ messageId: record.messageId }, 'processing_record')

  const message = JSON.parse(record.body) as SqsMessage
  const normalized = isRawWebhook(message) ? normalize(message) : message

  await processReputationEvent(normalized)

  logger.info({ messageId: record.messageId, phoneNumber: normalized.phoneNumber }, 'record_processed')
}

function isRawWebhook(message: SqsMessage): message is RawWebhookMessage {
  return message.source === 'WEBHOOK' && !('phoneNumber' in message)
}

function normalize(message: RawWebhookMessage): NormalizedReputationStatus {
  const provider = registry.get(message.provider)

  if (!provider) {
    throw new Error(`Provider not found or not enabled: ${message.provider}`)
  }

  if (!provider.supportsWebhook()) {
    throw new Error(`Provider does not support webhooks: ${message.provider}`)
  }

  return provider.parseWebhook(message.rawPayload)
}
