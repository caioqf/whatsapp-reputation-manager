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

export type WhatsAppNumberRecord = {
  phoneNumber: string
  provider: string
  current_status: ReputationStatus
  last_checked_at: string
  last_source: 'WEBHOOK' | 'POLLING'
  last_alert_status?: ReputationStatus
}

export type ReputationEventRecord = {
  phoneNumber: string
  timestamp: string
  provider: string
  old_status: ReputationStatus | null
  new_status: ReputationStatus
  source: 'WEBHOOK' | 'POLLING'
  rawPayload?: unknown
}
