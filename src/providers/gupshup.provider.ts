import axios from 'axios'
import { ReputationProvider } from '../shared/provider.interface'
import { NormalizedReputationStatus, ReputationStatus } from '../shared/types'

// ─── Webhook payload types (based on Gupshup docs) ────────────────────────────

type GupshupTierEventPayload = {
  event: 'onboarding' | 'upgrade' | 'downgrade' | 'unflagged' | 'flagged'
  oldLimit?: string
  currentLimit?: string
}

type GupshupStatusEventPayload = {
  status:
    | 'ACCOUNT_VIOLATION'
    | 'ACCOUNT_RESTRICTED'
    | 'DISABLE'
    | 'REINSTATE'
    | 'ACCOUNT_VERIFIED'
    | string
  violation_type?: string
  restrictionInfo?: unknown[]
  actionDate?: string
}

type GupshupAccountEvent = {
  app: string
  appId?: string
  phone?: string
  timestamp: number
  version: number
  type: 'account-event'
  payload:
    | { type: 'tier-event'; payload: GupshupTierEventPayload }
    | { type: 'status-event'; payload: GupshupStatusEventPayload }
    | { type: 'review-event' | 'pndn-event' | 'capability-event'; payload: unknown }
}

type GupshupTemplateEvent = {
  app: string
  timestamp: number
  version: number
  type: 'template-event'
  payload: {
    id: string
    elementName: string
    languageCode: string
    type: 'quality-update' | 'status-update' | 'category-update' | string
    quality?: string
  }
}

// ─── Status maps ──────────────────────────────────────────────────────────────

const TIER_EVENT_STATUS_MAP: Record<string, ReputationStatus> = {
  onboarding: 'HIGH',
  upgrade: 'HIGH',
  unflagged: 'HIGH',
  downgrade: 'MEDIUM',
  flagged: 'LOW',
}

const STATUS_EVENT_MAP: Record<string, ReputationStatus> = {
  ACCOUNT_VIOLATION: 'BLOCKED',
  ACCOUNT_RESTRICTED: 'BLOCKED',
  DISABLE: 'BLOCKED',
  REINSTATE: 'HIGH',
  ACCOUNT_VERIFIED: 'HIGH',
}

const TEMPLATE_QUALITY_MAP: Record<string, ReputationStatus> = {
  GREEN: 'HIGH',
  YELLOW: 'MEDIUM',
  RED: 'LOW',
}

// ─── Polling response type ─────────────────────────────────────────────────────

type GupshupHealthResponse = {
  phone?: { quality_score?: { color_code?: string } }
  qualityScore?: string
}

const POLLING_STATUS_MAP: Record<string, ReputationStatus> = {
  GREEN: 'HIGH',
  YELLOW: 'MEDIUM',
  RED: 'LOW',
  BLOCKED: 'BLOCKED',
}

// ─── Provider ─────────────────────────────────────────────────────────────────

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
    const event = payload as { type: string; app: string }

    if (event.type === 'account-event') {
      return this.parseAccountEvent(payload as GupshupAccountEvent)
    }

    if (event.type === 'template-event') {
      return this.parseTemplateEvent(payload as GupshupTemplateEvent)
    }

    throw new Error(`Unsupported Gupshup event type: ${event.type}`)
  }

  async fetchReputation(phoneNumber: string): Promise<NormalizedReputationStatus> {
    const response = await axios.get<GupshupHealthResponse>(
      `${this.baseUrl}/${phoneNumber}/health`,
      { headers: { apikey: this.apiKey, token: this.partnerToken } },
    )

    const rawStatus =
      response.data?.phone?.quality_score?.color_code ?? response.data?.qualityScore ?? ''

    return {
      phoneNumber,
      provider: this.name,
      status: POLLING_STATUS_MAP[(rawStatus ?? '').toUpperCase()] ?? 'MEDIUM',
      rawStatus,
      source: 'POLLING',
      timestamp: new Date().toISOString(),
      rawPayload: response.data,
    }
  }

  // ─── account-event ──────────────────────────────────────────────────────────

  private parseAccountEvent(event: GupshupAccountEvent): NormalizedReputationStatus {
    // phone is present on some events (ACCOUNT_RESTRICTED, REINSTATE)
    // app name is used as identifier when phone is absent (tier-event, ACCOUNT_VIOLATION)
    const identifier = event.phone ?? event.app
    const innerType = event.payload.type

    if (innerType === 'tier-event') {
      return this.parseTierEvent(event, identifier)
    }

    if (innerType === 'status-event') {
      return this.parseStatusEvent(event, identifier)
    }

    throw new Error(`Unsupported account-event inner type: ${innerType}`)
  }

  private parseTierEvent(event: GupshupAccountEvent, identifier: string): NormalizedReputationStatus {
    const p = (event.payload as { type: 'tier-event'; payload: GupshupTierEventPayload }).payload
    const rawStatus = (p.event ?? '').toLowerCase()
    const status = TIER_EVENT_STATUS_MAP[rawStatus]

    if (!status) {
      throw new Error(`Unhandled tier-event value: ${p.event}`)
    }

    return {
      phoneNumber: identifier,
      provider: this.name,
      status,
      rawStatus: p.event,
      source: 'WEBHOOK',
      timestamp: new Date(event.timestamp).toISOString(),
      rawPayload: event,
    }
  }

  private parseStatusEvent(event: GupshupAccountEvent, identifier: string): NormalizedReputationStatus {
    const p = (event.payload as { type: 'status-event'; payload: GupshupStatusEventPayload }).payload
    const rawStatus = (p.status ?? '').toUpperCase()
    const status = STATUS_EVENT_MAP[rawStatus]

    if (!status) {
      throw new Error(`Unhandled status-event status: ${p.status}`)
    }

    return {
      phoneNumber: identifier,
      provider: this.name,
      status,
      rawStatus: p.status,
      source: 'WEBHOOK',
      timestamp: new Date(event.timestamp).toISOString(),
      rawPayload: event,
    }
  }

  // ─── template-event ─────────────────────────────────────────────────────────

  private parseTemplateEvent(event: GupshupTemplateEvent): NormalizedReputationStatus {
    if (event.payload.type !== 'quality-update') {
      throw new Error(`Unsupported template-event type: ${event.payload.type}`)
    }

    const rawQuality = (event.payload.quality ?? '').toUpperCase()
    const status = TEMPLATE_QUALITY_MAP[rawQuality]

    if (!status) {
      throw new Error(`Unhandled template quality value: ${event.payload.quality}`)
    }

    return {
      phoneNumber: event.app,
      provider: this.name,
      status,
      rawStatus: event.payload.quality ?? '',
      source: 'WEBHOOK',
      timestamp: new Date(event.timestamp).toISOString(),
      rawPayload: event,
    }
  }
}
