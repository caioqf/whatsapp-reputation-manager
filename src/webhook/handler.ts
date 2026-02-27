import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda'

// TODO: implement webhook flow
// Responsibilities:
//   - Validate request signature per provider
//   - Identify provider from path/header
//   - Call provider.parseWebhook(payload)
//   - Publish NormalizedReputationStatus to SQS
//   - Return HTTP 200 immediately
export async function handler(_event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  throw new Error('Webhook handler not yet implemented')
}
