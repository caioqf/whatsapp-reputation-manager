import { processReputationEvent } from '../../shared/status-engine'
import * as dynamodb from '../../infra/dynamodb'
import * as ses from '../../infra/ses'
import { NormalizedReputationStatus, WhatsAppNumberRecord } from '../../shared/types'

jest.mock('../../infra/dynamodb')
jest.mock('../../infra/ses')
jest.mock('../../shared/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
}))

const mockedDb = dynamodb as jest.Mocked<typeof dynamodb>
const mockedSes = ses as jest.Mocked<typeof ses>

function makeEvent(overrides: Partial<NormalizedReputationStatus> = {}): NormalizedReputationStatus {
  return {
    phoneNumber: '+5511999999999',
    provider: 'gupshup',
    status: 'HIGH',
    rawStatus: 'GREEN',
    source: 'WEBHOOK',
    timestamp: '2024-01-01T00:00:00.000Z',
    ...overrides,
  }
}

function makeRecord(overrides: Partial<WhatsAppNumberRecord> = {}): WhatsAppNumberRecord {
  return {
    phoneNumber: '+5511999999999',
    provider: 'gupshup',
    current_status: 'HIGH',
    last_checked_at: '2024-01-01T00:00:00.000Z',
    last_source: 'WEBHOOK',
    ...overrides,
  }
}

describe('processReputationEvent', () => {
  beforeEach(() => {
    mockedDb.getWhatsAppNumber.mockResolvedValue(null)
    mockedDb.putWhatsAppNumber.mockResolvedValue(undefined)
    mockedDb.putReputationEvent.mockResolvedValue(undefined)
    mockedDb.updateLastCheckedAt.mockResolvedValue(undefined)
    mockedSes.sendAlertEmail.mockResolvedValue(undefined)
  })

  describe('novo número (sem registro no DynamoDB)', () => {
    it('persiste o número e o evento com old_status null', async () => {
      await processReputationEvent(makeEvent({ status: 'HIGH' }))

      expect(mockedDb.putWhatsAppNumber).toHaveBeenCalledWith(
        expect.objectContaining({ current_status: 'HIGH', phoneNumber: '+5511999999999' }),
      )
      expect(mockedDb.putReputationEvent).toHaveBeenCalledWith(
        expect.objectContaining({ old_status: null, new_status: 'HIGH' }),
      )
    })

    it('não envia alerta para status HIGH', async () => {
      await processReputationEvent(makeEvent({ status: 'HIGH' }))

      expect(mockedSes.sendAlertEmail).not.toHaveBeenCalled()
    })

    it('não envia alerta para status MEDIUM', async () => {
      await processReputationEvent(makeEvent({ status: 'MEDIUM' }))

      expect(mockedSes.sendAlertEmail).not.toHaveBeenCalled()
    })

    it('envia alerta quando o primeiro status já é LOW', async () => {
      await processReputationEvent(makeEvent({ status: 'LOW' }))

      expect(mockedSes.sendAlertEmail).toHaveBeenCalledWith(
        expect.objectContaining({ newStatus: 'LOW', previousStatus: null }),
      )
    })

    it('envia alerta quando o primeiro status já é BLOCKED', async () => {
      await processReputationEvent(makeEvent({ status: 'BLOCKED' }))

      expect(mockedSes.sendAlertEmail).toHaveBeenCalledWith(
        expect.objectContaining({ newStatus: 'BLOCKED', previousStatus: null }),
      )
    })

    it('grava last_alert_status no número após enviar alerta', async () => {
      await processReputationEvent(makeEvent({ status: 'LOW' }))

      const calls = mockedDb.putWhatsAppNumber.mock.calls
      const lastCall = calls[calls.length - 1][0]
      expect(lastCall.last_alert_status).toBe('LOW')
    })
  })

  describe('status inalterado', () => {
    it('atualiza apenas last_checked_at', async () => {
      mockedDb.getWhatsAppNumber.mockResolvedValue(makeRecord({ current_status: 'HIGH' }))

      await processReputationEvent(makeEvent({ status: 'HIGH' }))

      expect(mockedDb.updateLastCheckedAt).toHaveBeenCalledTimes(1)
      expect(mockedDb.putReputationEvent).not.toHaveBeenCalled()
      expect(mockedSes.sendAlertEmail).not.toHaveBeenCalled()
    })

    it('não sobrescreve o número quando o status é igual', async () => {
      mockedDb.getWhatsAppNumber.mockResolvedValue(makeRecord({ current_status: 'MEDIUM' }))

      await processReputationEvent(makeEvent({ status: 'MEDIUM' }))

      expect(mockedDb.putWhatsAppNumber).not.toHaveBeenCalled()
    })
  })

  describe('transição de status', () => {
    it('persiste evento com old_status e new_status corretos', async () => {
      mockedDb.getWhatsAppNumber.mockResolvedValue(makeRecord({ current_status: 'HIGH' }))

      await processReputationEvent(makeEvent({ status: 'MEDIUM' }))

      expect(mockedDb.putReputationEvent).toHaveBeenCalledWith(
        expect.objectContaining({ old_status: 'HIGH', new_status: 'MEDIUM' }),
      )
    })

    it('atualiza current_status no número', async () => {
      mockedDb.getWhatsAppNumber.mockResolvedValue(makeRecord({ current_status: 'HIGH' }))

      await processReputationEvent(makeEvent({ status: 'MEDIUM' }))

      expect(mockedDb.putWhatsAppNumber).toHaveBeenCalledWith(
        expect.objectContaining({ current_status: 'MEDIUM' }),
      )
    })

    it('não envia alerta em transição HIGH → MEDIUM', async () => {
      mockedDb.getWhatsAppNumber.mockResolvedValue(makeRecord({ current_status: 'HIGH' }))

      await processReputationEvent(makeEvent({ status: 'MEDIUM' }))

      expect(mockedSes.sendAlertEmail).not.toHaveBeenCalled()
    })

    it('envia alerta em transição HIGH → LOW', async () => {
      mockedDb.getWhatsAppNumber.mockResolvedValue(makeRecord({ current_status: 'HIGH' }))

      await processReputationEvent(makeEvent({ status: 'LOW' }))

      expect(mockedSes.sendAlertEmail).toHaveBeenCalledWith(
        expect.objectContaining({ previousStatus: 'HIGH', newStatus: 'LOW' }),
      )
    })

    it('envia alerta em transição MEDIUM → BLOCKED', async () => {
      mockedDb.getWhatsAppNumber.mockResolvedValue(makeRecord({ current_status: 'MEDIUM' }))

      await processReputationEvent(makeEvent({ status: 'BLOCKED' }))

      expect(mockedSes.sendAlertEmail).toHaveBeenCalledWith(
        expect.objectContaining({ previousStatus: 'MEDIUM', newStatus: 'BLOCKED' }),
      )
    })

    it('não envia alerta em recuperação LOW → HIGH', async () => {
      mockedDb.getWhatsAppNumber.mockResolvedValue(makeRecord({ current_status: 'LOW' }))

      await processReputationEvent(makeEvent({ status: 'HIGH' }))

      expect(mockedSes.sendAlertEmail).not.toHaveBeenCalled()
    })

    it('não envia alerta duplicado se last_alert_status já é igual ao novo status', async () => {
      mockedDb.getWhatsAppNumber.mockResolvedValue(
        makeRecord({ current_status: 'MEDIUM', last_alert_status: 'LOW' }),
      )

      await processReputationEvent(makeEvent({ status: 'LOW' }))

      expect(mockedSes.sendAlertEmail).not.toHaveBeenCalled()
    })

    it('envia alerta se status muda para LOW diferente do last_alert_status', async () => {
      mockedDb.getWhatsAppNumber.mockResolvedValue(
        makeRecord({ current_status: 'MEDIUM', last_alert_status: 'BLOCKED' }),
      )

      await processReputationEvent(makeEvent({ status: 'LOW' }))

      expect(mockedSes.sendAlertEmail).toHaveBeenCalledTimes(1)
    })

    it('grava last_alert_status ao enviar alerta em transição', async () => {
      mockedDb.getWhatsAppNumber.mockResolvedValue(makeRecord({ current_status: 'HIGH' }))

      await processReputationEvent(makeEvent({ status: 'LOW' }))

      expect(mockedDb.putWhatsAppNumber).toHaveBeenCalledWith(
        expect.objectContaining({ last_alert_status: 'LOW' }),
      )
    })
  })
})
