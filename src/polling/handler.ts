import { ScheduledEvent } from 'aws-lambda'
import { getAllActiveNumbers } from '../infra/dynamodb'
import { publishReputationEvent } from '../infra/sqs'
import { registry } from '../shared/provider.registry'
import { logger } from '../shared/logger'

export async function handler(_event: ScheduledEvent): Promise<void> {
  const numbers = await getAllActiveNumbers()
  logger.info({ count: numbers.length }, 'polling_started')

  const byProvider = numbers.reduce<Record<string, string[]>>((acc, n) => {
    if (!acc[n.provider]) acc[n.provider] = []
    acc[n.provider].push(n.phoneNumber)
    return acc
  }, {})

  for (const [providerName, phoneNumbers] of Object.entries(byProvider)) {
    const provider = registry.get(providerName)

    if (!provider || !provider.supportsPolling()) {
      logger.warn({ provider: providerName }, 'provider_not_found_or_no_polling_support')
      continue
    }

    for (const phoneNumber of phoneNumbers) {
      try {
        const event = await provider.fetchReputation(phoneNumber)
        await publishReputationEvent(event)
        logger.info({ phoneNumber, provider: providerName }, 'event_published')
      } catch (err) {
        logger.error({ phoneNumber, provider: providerName, err }, 'fetch_reputation_error')
      }
    }
  }

  logger.info({ count: numbers.length }, 'polling_completed')
}
