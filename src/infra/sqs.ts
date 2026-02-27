import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs'
import { NormalizedReputationStatus } from '../shared/types'

const client = new SQSClient({})
const QUEUE_URL = process.env.SQS_QUEUE_URL!

export async function publishReputationEvent(event: NormalizedReputationStatus): Promise<void> {
  await client.send(
    new SendMessageCommand({
      QueueUrl: QUEUE_URL,
      MessageBody: JSON.stringify(event),
    }),
  )
}
