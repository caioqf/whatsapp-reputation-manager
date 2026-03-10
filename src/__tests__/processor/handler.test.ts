import { SQSEvent, SQSRecord } from 'aws-lambda'
import { handler } from '../../processor/handler'
import * as statusEngine from '../../shared/status-engine'
import { registry } from '../../shared/provider.registry'
import { NormalizedReputationStatus, RawWebhookMessage } from '../../shared/types'
import { ReputationProvider } from '../../shared/provider.interface'

jest.mock('../../shared/status-engine')
jest.mock('../../shared/provider.registry', () => ({
  registry: { get: jest.fn() },
}))
jest.mock('../../shared/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
}))

const mockedEngine = statusEngine as jest.Mocked<typeof statusEngine>
const mockedRegistryGet = registry.get as jest.Mock

function makeSqsEvent(bodies: string[]): SQSEvent {
  return {
    Records: bodies.map(
      (body, i) =>
        ({
          messageId: `msg-${i}`,
          receiptHandle: '',
          body,
          attributes: {} as SQSRecord['attributes'],
          messageAttributes: {},
          md5OfBody: '',
          eventSource: 'aws:sqs',
          eventSourceARN: 'arn:aws:sqs:us-east-1:123456789:queue',
          awsRegion: 'us-east-1',
        }) as SQSRecord,
    ),
  }
}

function makeNormalized(overrides: Partial<NormalizedReputationStatus> = {}): NormalizedReputationStatus {
  return {
    phoneNumber: '+5511999999999',
    provider: 'gupshup',
    status: 'HIGH',
    rawStatus: 'GREEN',
    source: 'POLLING',
    timestamp: '2024-01-01T00:00:00.000Z',
    ...overrides,
  }
}

function makeProvider(overrides: Partial<ReputationProvider> = {}): ReputationProvider {
  return {
    name: 'gupshup',
    supportsWebhook: () => true,
    supportsPolling: () => true,
    parseWebhook: jest.fn(),
    fetchReputation: jest.fn(),
    ...overrides,
  }
}

describe('ReputationProcessor handler', () => {
  beforeEach(() => {
    mockedEngine.processReputationEvent.mockResolvedValue(undefined)
  })

  describe('mensagem normalizada (polling)', () => {
    it('processa direto sem chamar o registry', async () => {
      const message = makeNormalized({ source: 'POLLING' })

      const result = await handler(makeSqsEvent([JSON.stringify(message)]))

      expect(mockedEngine.processReputationEvent).toHaveBeenCalledWith(message)
      expect(mockedRegistryGet).not.toHaveBeenCalled()
      expect(result.batchItemFailures).toHaveLength(0)
    })
  })

  describe('mensagem bruta de webhook (RawWebhookMessage)', () => {
    it('normaliza via provider.parseWebhook antes de processar', async () => {
      const rawMessage: RawWebhookMessage = {
        source: 'WEBHOOK',
        provider: 'gupshup',
        rawPayload: { phoneNumber: '+5511999999999', phoneQualityRating: 'GREEN' },
      }
      const normalized = makeNormalized({ source: 'WEBHOOK' })
      const provider = makeProvider({ parseWebhook: jest.fn().mockReturnValue(normalized) })

      mockedRegistryGet.mockReturnValue(provider)

      const result = await handler(makeSqsEvent([JSON.stringify(rawMessage)]))

      expect(mockedRegistryGet).toHaveBeenCalledWith('gupshup')
      expect(provider.parseWebhook).toHaveBeenCalledWith(rawMessage.rawPayload)
      expect(mockedEngine.processReputationEvent).toHaveBeenCalledWith(normalized)
      expect(result.batchItemFailures).toHaveLength(0)
    })

    it('adiciona à batchItemFailures quando o provider não existe', async () => {
      const rawMessage: RawWebhookMessage = {
        source: 'WEBHOOK',
        provider: 'unknown',
        rawPayload: {},
      }
      mockedRegistryGet.mockReturnValue(undefined)

      const result = await handler(makeSqsEvent([JSON.stringify(rawMessage)]))

      expect(result.batchItemFailures).toEqual([{ itemIdentifier: 'msg-0' }])
    })

    it('adiciona à batchItemFailures quando o provider não suporta webhook', async () => {
      const rawMessage: RawWebhookMessage = {
        source: 'WEBHOOK',
        provider: 'example',
        rawPayload: {},
      }
      mockedRegistryGet.mockReturnValue(makeProvider({ supportsWebhook: () => false }))

      const result = await handler(makeSqsEvent([JSON.stringify(rawMessage)]))

      expect(result.batchItemFailures).toEqual([{ itemIdentifier: 'msg-0' }])
    })
  })

  describe('tratamento de falhas', () => {
    it('retorna batchItemFailures para a mensagem que falhou', async () => {
      mockedEngine.processReputationEvent.mockRejectedValue(new Error('DynamoDB timeout'))

      const result = await handler(makeSqsEvent([JSON.stringify(makeNormalized())]))

      expect(result.batchItemFailures).toEqual([{ itemIdentifier: 'msg-0' }])
    })

    it('processa falhas parciais corretamente — só a mensagem com erro vai ao DLQ', async () => {
      mockedEngine.processReputationEvent
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('timeout'))
        .mockResolvedValueOnce(undefined)

      const result = await handler(
        makeSqsEvent([
          JSON.stringify(makeNormalized()),
          JSON.stringify(makeNormalized()),
          JSON.stringify(makeNormalized()),
        ]),
      )

      expect(result.batchItemFailures).toEqual([{ itemIdentifier: 'msg-1' }])
      expect(mockedEngine.processReputationEvent).toHaveBeenCalledTimes(3)
    })

    it('retorna batchItemFailures vazio quando tudo é processado com sucesso', async () => {
      const result = await handler(
        makeSqsEvent([
          JSON.stringify(makeNormalized()),
          JSON.stringify(makeNormalized()),
        ]),
      )

      expect(result.batchItemFailures).toHaveLength(0)
    })
  })
})
