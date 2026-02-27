import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  ScanCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb'
import { WhatsAppNumberRecord, ReputationEventRecord } from '../shared/types'

const client = new DynamoDBClient({})
export const docClient = DynamoDBDocumentClient.from(client)

const TABLE_WHATSAPP_NUMBERS = process.env.TABLE_WHATSAPP_NUMBERS!
const TABLE_REPUTATION_EVENTS = process.env.TABLE_REPUTATION_EVENTS!

export async function getWhatsAppNumber(phoneNumber: string): Promise<WhatsAppNumberRecord | null> {
  const result = await docClient.send(
    new GetCommand({
      TableName: TABLE_WHATSAPP_NUMBERS,
      Key: { phoneNumber },
    }),
  )
  return (result.Item as WhatsAppNumberRecord) ?? null
}

export async function putWhatsAppNumber(record: WhatsAppNumberRecord): Promise<void> {
  await docClient.send(
    new PutCommand({
      TableName: TABLE_WHATSAPP_NUMBERS,
      Item: record,
    }),
  )
}

export async function updateLastCheckedAt(phoneNumber: string, last_checked_at: string): Promise<void> {
  await docClient.send(
    new UpdateCommand({
      TableName: TABLE_WHATSAPP_NUMBERS,
      Key: { phoneNumber },
      UpdateExpression: 'SET last_checked_at = :ts',
      ExpressionAttributeValues: { ':ts': last_checked_at },
    }),
  )
}

export async function putReputationEvent(record: ReputationEventRecord): Promise<void> {
  await docClient.send(
    new PutCommand({
      TableName: TABLE_REPUTATION_EVENTS,
      Item: record,
    }),
  )
}

export async function getAllActiveNumbers(): Promise<WhatsAppNumberRecord[]> {
  const result = await docClient.send(
    new ScanCommand({
      TableName: TABLE_WHATSAPP_NUMBERS,
    }),
  )
  return (result.Items as WhatsAppNumberRecord[]) ?? []
}
