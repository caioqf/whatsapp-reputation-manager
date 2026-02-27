import axios from 'axios'
import { ReputationProvider } from '../shared/provider.interface'
import { NormalizedReputationStatus, ReputationStatus } from '../shared/types'

// Maps Gupshup quality rating color codes to the canonical model
const STATUS_MAP: Record<string, ReputationStatus> = {
  GREEN: 'HIGH',
  YELLOW: 'MEDIUM',
  RED: 'LOW',
  BLOCKED: 'BLOCKED',
  FLAGGED: 'LOW',
  BANNED: 'BLOCKED',
}

type GupshupWebhookPayload = {
  payload?: {
    phoneNumber?: string
    phoneQualityRating?: string
  }
  phoneNumber?: string
  phoneQualityRating?: string
}

type GupshupHealthResponse = {
  phone?: {
    quality_score?: {
      color_code?: string
    }
  }
  qualityScore?: string
}

export class GupshupProvider implements ReputationProvider {
  readonly name = 'gupshup'

  private readonly apiKey = process.env.GUPSHUP_API_KEY ?? ''
  private readonly partnerToken = process.env.GUPSHUP_PARTNER_TOKEN ?? ''
  private readonly baseUrl =
    process.env.GUPSHUP_BASE_URL ?? 'https://partner.gupshup.io/partner/app'

  supportsWebhook(): boolean {
    return true
  }

  supportsPolling(): boolean {
    return true
  }

  parseWebhook(payload: unknown): NormalizedReputationStatus {
    const p = payload as GupshupWebhookPayload
    const phoneNumber = p?.payload?.phoneNumber ?? p?.phoneNumber ?? ''
    const rawStatus = p?.payload?.phoneQualityRating ?? p?.phoneQualityRating ?? ''

    return {
      phoneNumber,
      provider: this.name,
      status: this.normalizeStatus(rawStatus),
      rawStatus,
      source: 'WEBHOOK',
      timestamp: new Date().toISOString(),
      rawPayload: payload,
    }
  }

  async fetchReputation(phoneNumber: string): Promise<NormalizedReputationStatus> {
    const response = await axios.get<GupshupHealthResponse>(
      `${this.baseUrl}/${phoneNumber}/health`,
      {
        headers: {
          apikey: this.apiKey,
          token: this.partnerToken,
        },
      },
    )

    const rawStatus =
      response.data?.phone?.quality_score?.color_code ?? response.data?.qualityScore ?? ''

    return {
      phoneNumber,
      provider: this.name,
      status: this.normalizeStatus(rawStatus),
      rawStatus,
      source: 'POLLING',
      timestamp: new Date().toISOString(),
      rawPayload: response.data,
    }
  }

  private normalizeStatus(raw: string): ReputationStatus {
    const upper = (raw ?? '').toUpperCase()
    return STATUS_MAP[upper] ?? 'MEDIUM'
  }
}
