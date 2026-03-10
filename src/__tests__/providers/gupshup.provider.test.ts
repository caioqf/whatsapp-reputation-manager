import axios from 'axios'
import { GupshupProvider } from '../../providers/gupshup.provider'

jest.mock('axios')
const mockedAxios = axios as jest.Mocked<typeof axios>

// ─── Helpers to build payloads exactly as Gupshup sends them ─────────────────

function makeTierEvent(event: string, phone?: string) {
  return {
    app: 'myApp',
    ...(phone ? { phone } : {}),
    timestamp: 1636986446609,
    version: 2,
    type: 'account-event',
    payload: {
      type: 'tier-event',
      payload: {
        event,
        oldLimit: 'TIER_10K',
        currentLimit: 'TIER_100K',
      },
    },
  }
}

function makeStatusEvent(status: string, phone?: string) {
  return {
    app: 'myApp',
    appId: 'e4c9dbe0-b1ef-4add-97a2-a8fdba0666ad',
    ...(phone ? { phone } : {}),
    timestamp: 1717061550941,
    version: 2,
    type: 'account-event',
    payload: {
      type: 'status-event',
      payload: { status },
    },
  }
}

// ─────────────────────────────────────────────────────────────────────────────

describe('GupshupProvider', () => {
  let provider: GupshupProvider

  beforeEach(() => {
    provider = new GupshupProvider()
  })

  describe('capabilities', () => {
    it('suporta webhook e polling', () => {
      expect(provider.supportsWebhook()).toBe(true)
      expect(provider.supportsPolling()).toBe(true)
    })

    it('tem o nome correto', () => {
      expect(provider.name).toBe('gupshup')
    })
  })

  describe('parseWebhook — tier-event', () => {
    it.each([
      ['onboarding', 'HIGH'],
      ['upgrade', 'HIGH'],
      ['unflagged', 'HIGH'],
      ['downgrade', 'MEDIUM'],
      ['flagged', 'LOW'],
    ])('mapeia tier-event "%s" para status canônico "%s"', (event, expectedStatus) => {
      const result = provider.parseWebhook(makeTierEvent(event))

      expect(result.status).toBe(expectedStatus)
      expect(result.rawStatus).toBe(event)
    })

    it('usa o campo phone como phoneNumber quando presente', () => {
      const result = provider.parseWebhook(makeTierEvent('flagged', '+5511999999999'))

      expect(result.phoneNumber).toBe('+5511999999999')
    })

    it('usa o campo app como phoneNumber quando phone está ausente', () => {
      const result = provider.parseWebhook(makeTierEvent('flagged'))

      expect(result.phoneNumber).toBe('myApp')
    })

    it('define source como WEBHOOK', () => {
      const result = provider.parseWebhook(makeTierEvent('upgrade'))

      expect(result.source).toBe('WEBHOOK')
    })

    it('converte timestamp unix para ISO string', () => {
      const result = provider.parseWebhook(makeTierEvent('upgrade'))

      expect(result.timestamp).toBe(new Date(1636986446609).toISOString())
    })

    it('inclui o rawPayload completo', () => {
      const payload = makeTierEvent('flagged')
      const result = provider.parseWebhook(payload)

      expect(result.rawPayload).toEqual(payload)
    })

    it('lança erro para tier-event desconhecido', () => {
      expect(() => provider.parseWebhook(makeTierEvent('unknown_event'))).toThrow(
        'Unhandled tier-event value',
      )
    })
  })

  describe('parseWebhook — status-event', () => {
    it.each([
      ['ACCOUNT_VIOLATION', 'BLOCKED'],
      ['ACCOUNT_RESTRICTED', 'BLOCKED'],
      ['DISABLE', 'BLOCKED'],
      ['REINSTATE', 'HIGH'],
      ['ACCOUNT_VERIFIED', 'HIGH'],
    ])('mapeia status-event "%s" para status canônico "%s"', (status, expectedStatus) => {
      const result = provider.parseWebhook(makeStatusEvent(status))

      expect(result.status).toBe(expectedStatus)
      expect(result.rawStatus).toBe(status)
    })

    it('usa o campo phone como phoneNumber quando presente (ex: ACCOUNT_RESTRICTED)', () => {
      const payload = {
        app: 'appname',
        timestamp: 1636986446609,
        version: 2,
        type: 'account-event',
        phone: '9180xxxxxxxx',
        payload: {
          type: 'status-event',
          payload: {
            status: 'ACCOUNT_RESTRICTED',
            restrictionInfo: [],
          },
        },
      }

      const result = provider.parseWebhook(payload)

      expect(result.phoneNumber).toBe('9180xxxxxxxx')
      expect(result.status).toBe('BLOCKED')
    })

    it('usa o campo phone como phoneNumber quando presente (ex: REINSTATE)', () => {
      const payload = makeStatusEvent('REINSTATE', '918xxxxxxxxx2')
      const result = provider.parseWebhook(payload)

      expect(result.phoneNumber).toBe('918xxxxxxxxx2')
      expect(result.status).toBe('HIGH')
    })

    it('lança erro para status-event não mapeado', () => {
      expect(() => provider.parseWebhook(makeStatusEvent('UNKNOWN_STATUS'))).toThrow(
        'Unhandled status-event status',
      )
    })
  })

  describe('parseWebhook — template-event (quality-update)', () => {
    function makeTemplateQualityEvent(quality: string) {
      return {
        app: 'testApp',
        timestamp: 1724265081729,
        version: 2,
        type: 'template-event',
        payload: {
          id: '5xxxxxxxx-xxxxxx-xxxxxx-xxxx14',
          elementName: 'test_template',
          languageCode: 'en',
          type: 'quality-update',
          quality,
        },
      }
    }

    it.each([
      ['GREEN', 'HIGH'],
      ['Yellow', 'MEDIUM'],
      ['RED', 'LOW'],
    ])('mapeia template quality "%s" para status canônico "%s"', (quality, expectedStatus) => {
      const result = provider.parseWebhook(makeTemplateQualityEvent(quality))

      expect(result.status).toBe(expectedStatus)
      expect(result.rawStatus).toBe(quality)
    })

    it('usa o campo app como identifier', () => {
      const result = provider.parseWebhook(makeTemplateQualityEvent('GREEN'))

      expect(result.phoneNumber).toBe('testApp')
    })

    it('define source como WEBHOOK', () => {
      const result = provider.parseWebhook(makeTemplateQualityEvent('RED'))

      expect(result.source).toBe('WEBHOOK')
    })

    it('converte timestamp unix para ISO string', () => {
      const result = provider.parseWebhook(makeTemplateQualityEvent('GREEN'))

      expect(result.timestamp).toBe(new Date(1724265081729).toISOString())
    })

    it('lança erro para template-event que não é quality-update', () => {
      const payload = {
        app: 'jeet20',
        timestamp: 1636986446609,
        version: 2,
        type: 'template-event',
        payload: { type: 'status-update', id: 'abc', elementName: 'tmpl', languageCode: 'en' },
      }

      expect(() => provider.parseWebhook(payload)).toThrow('Unsupported template-event type')
    })

    it('lança erro para template quality desconhecida', () => {
      expect(() => provider.parseWebhook(makeTemplateQualityEvent('PURPLE'))).toThrow(
        'Unhandled template quality value',
      )
    })
  })

  describe('parseWebhook — eventos não suportados', () => {
    it('lança erro para tipo de evento desconhecido', () => {
      const payload = { app: 'jeet20', timestamp: 1636986446609, version: 2, type: 'unknown-event' }

      expect(() => provider.parseWebhook(payload)).toThrow('Unsupported Gupshup event type')
    })

    it('lança erro para account-event do tipo review-event', () => {
      const payload = {
        app: 'jeet20',
        timestamp: 1636986446609,
        version: 2,
        type: 'account-event',
        payload: { type: 'review-event', payload: { status: 'approved' } },
      }

      expect(() => provider.parseWebhook(payload)).toThrow('Unsupported account-event inner type')
    })

    it('lança erro para account-event do tipo capability-event', () => {
      const payload = {
        app: 'appname',
        timestamp: 1636986446609,
        version: 2,
        type: 'account-event',
        payload: { type: 'capability-event', payload: { maxDailyConversationPerPhone: 100 } },
      }

      expect(() => provider.parseWebhook(payload)).toThrow('Unsupported account-event inner type')
    })
  })

  describe('fetchReputation (polling)', () => {
    it('mapeia color_code GREEN para HIGH', async () => {
      mockedAxios.get.mockResolvedValue({
        data: { phone: { quality_score: { color_code: 'GREEN' } } },
      })

      const result = await provider.fetchReputation('+5511999999999')

      expect(result.status).toBe('HIGH')
      expect(result.rawStatus).toBe('GREEN')
      expect(result.source).toBe('POLLING')
    })

    it('mapeia color_code RED para LOW', async () => {
      mockedAxios.get.mockResolvedValue({
        data: { phone: { quality_score: { color_code: 'RED' } } },
      })

      const result = await provider.fetchReputation('+5511999999999')

      expect(result.status).toBe('LOW')
    })

    it('usa qualityScore como fallback quando color_code não existe', async () => {
      mockedAxios.get.mockResolvedValue({
        data: { qualityScore: 'BLOCKED' },
      })

      const result = await provider.fetchReputation('+5511999999999')

      expect(result.status).toBe('BLOCKED')
    })

    it('retorna MEDIUM para resposta sem status reconhecível', async () => {
      mockedAxios.get.mockResolvedValue({ data: {} })

      const result = await provider.fetchReputation('+5511999999999')

      expect(result.status).toBe('MEDIUM')
    })

    it('propaga erros HTTP', async () => {
      mockedAxios.get.mockRejectedValue(new Error('Network error'))

      await expect(provider.fetchReputation('+5511999999999')).rejects.toThrow('Network error')
    })
  })
})
