import { ReputationProvider } from '../shared/provider.interface'
import { NormalizedReputationStatus } from '../shared/types'

/**
 * Stub provider for local development and testing.
 * Always returns HIGH status. Does not support webhooks.
 */
export class ExampleProvider implements ReputationProvider {
  readonly name = 'example'

  supportsWebhook(): boolean {
    return false
  }

  supportsPolling(): boolean {
    return true
  }

  parseWebhook(_payload: unknown): NormalizedReputationStatus {
    throw new Error('ExampleProvider does not support webhooks')
  }

  async fetchReputation(phoneNumber: string): Promise<NormalizedReputationStatus> {
    return {
      phoneNumber,
      provider: this.name,
      status: 'HIGH',
      rawStatus: 'active',
      source: 'POLLING',
      timestamp: new Date().toISOString(),
    }
  }
}
