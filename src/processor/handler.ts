import { SQSEvent, SQSRecord, SQSBatchResponse } from 'aws-lambda'
import { NormalizedReputationStatus } from '../shared/types'
import { processReputationEvent } from '../shared/status-engine'
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

  const event = JSON.parse(record.body) as NormalizedReputationStatus
  await processReputationEvent(event)

  logger.info({ messageId: record.messageId, phoneNumber: event.phoneNumber }, 'record_processed')
}
