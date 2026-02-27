import { NormalizedReputationStatus, ReputationStatus, WhatsAppNumberRecord } from './types'
import {
  getWhatsAppNumber,
  putWhatsAppNumber,
  updateLastCheckedAt,
  putReputationEvent,
} from '../infra/dynamodb'
import { sendAlertEmail } from '../infra/ses'
import { logger } from './logger'

const ALERT_STATUSES: ReputationStatus[] = ['LOW', 'BLOCKED']

function emitMetric(name: string, value = 1): void {
  console.log(
    JSON.stringify({
      _aws: {
        Timestamp: Date.now(),
        CloudWatchMetrics: [
          {
            Namespace: 'WhatsAppReputationMonitor',
            Dimensions: [['service']],
            Metrics: [{ Name: name, Unit: 'Count' }],
          },
        ],
      },
      service: 'reputation-processor',
      [name]: value,
    }),
  )
}

export async function processReputationEvent(event: NormalizedReputationStatus): Promise<void> {
  const existing = await getWhatsAppNumber(event.phoneNumber)
  const now = event.timestamp

  if (!existing) {
    await handleNewNumber(event, now)
    return
  }

  if (existing.current_status === event.status) {
    await updateLastCheckedAt(event.phoneNumber, now)
    logger.info({ phoneNumber: event.phoneNumber, status: event.status }, 'status_unchanged')
    emitMetric('events_processed')
    return
  }

  await handleStatusTransition(event, existing, now)
}

async function handleNewNumber(
  event: NormalizedReputationStatus,
  now: string,
): Promise<void> {
  const record: WhatsAppNumberRecord = {
    phoneNumber: event.phoneNumber,
    provider: event.provider,
    current_status: event.status,
    last_checked_at: now,
    last_source: event.source,
  }

  await putWhatsAppNumber(record)
  await putReputationEvent({
    phoneNumber: event.phoneNumber,
    timestamp: now,
    provider: event.provider,
    old_status: null,
    new_status: event.status,
    source: event.source,
    rawPayload: event.rawPayload,
  })

  logger.info({ phoneNumber: event.phoneNumber, status: event.status }, 'new_number_registered')
  emitMetric('events_processed')

  if (ALERT_STATUSES.includes(event.status)) {
    await sendAlertEmail({
      phoneNumber: event.phoneNumber,
      provider: event.provider,
      previousStatus: null,
      newStatus: event.status,
      timestamp: now,
    })
    await putWhatsAppNumber({ ...record, last_alert_status: event.status })
    logger.info({ phoneNumber: event.phoneNumber, status: event.status }, 'alert_sent')
    emitMetric('alerts_sent')
  }
}

async function handleStatusTransition(
  event: NormalizedReputationStatus,
  existing: WhatsAppNumberRecord,
  now: string,
): Promise<void> {
  const oldStatus = existing.current_status

  await putReputationEvent({
    phoneNumber: event.phoneNumber,
    timestamp: now,
    provider: event.provider,
    old_status: oldStatus,
    new_status: event.status,
    source: event.source,
    rawPayload: event.rawPayload,
  })

  const shouldAlert =
    ALERT_STATUSES.includes(event.status) && existing.last_alert_status !== event.status

  const updatedRecord: WhatsAppNumberRecord = {
    ...existing,
    current_status: event.status,
    last_checked_at: now,
    last_source: event.source,
    provider: event.provider,
    ...(shouldAlert ? { last_alert_status: event.status } : {}),
  }

  await putWhatsAppNumber(updatedRecord)

  logger.info(
    { phoneNumber: event.phoneNumber, oldStatus, newStatus: event.status },
    'status_transition',
  )
  emitMetric('events_processed')
  emitMetric('status_transitions')

  if (shouldAlert) {
    await sendAlertEmail({
      phoneNumber: event.phoneNumber,
      provider: event.provider,
      previousStatus: oldStatus,
      newStatus: event.status,
      timestamp: now,
    })
    logger.info({ phoneNumber: event.phoneNumber, status: event.status }, 'alert_sent')
    emitMetric('alerts_sent')
  }
}
