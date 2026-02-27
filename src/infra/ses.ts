import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses'
import { ReputationStatus } from '../shared/types'

const client = new SESClient({})

export type AlertEmailParams = {
  phoneNumber: string
  provider: string
  previousStatus: ReputationStatus | null
  newStatus: ReputationStatus
  timestamp: string
}

export async function sendAlertEmail(params: AlertEmailParams): Promise<void> {
  const recipients = (process.env.ALERT_RECIPIENTS ?? '')
    .split(',')
    .map((e) => e.trim())
    .filter(Boolean)

  if (recipients.length === 0) return

  const fromEmail = process.env.SES_FROM_EMAIL ?? recipients[0]

  const body = [
    `Phone Number : ${params.phoneNumber}`,
    `Provider     : ${params.provider}`,
    `Previous     : ${params.previousStatus ?? 'N/A'}`,
    `New Status   : ${params.newStatus}`,
    `Timestamp    : ${params.timestamp}`,
  ].join('\n')

  await client.send(
    new SendEmailCommand({
      Source: fromEmail,
      Destination: { ToAddresses: recipients },
      Message: {
        Subject: {
          Data: `[WhatsApp Reputation Alert] ${params.phoneNumber} → ${params.newStatus}`,
        },
        Body: {
          Text: { Data: body },
        },
      },
    }),
  )
}
