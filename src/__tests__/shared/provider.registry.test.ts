import { ProviderRegistry } from '../../shared/provider.registry'

describe('ProviderRegistry', () => {
  const originalEnv = process.env.PROVIDERS_ENABLED

  afterEach(() => {
    process.env.PROVIDERS_ENABLED = originalEnv
  })

  describe('carregamento de providers', () => {
    it('carrega o provider gupshup quando habilitado', () => {
      process.env.PROVIDERS_ENABLED = 'gupshup'
      const registry = new ProviderRegistry()

      expect(registry.get('gupshup')).toBeDefined()
      expect(registry.get('gupshup')?.name).toBe('gupshup')
    })

    it('carrega o provider example quando habilitado', () => {
      process.env.PROVIDERS_ENABLED = 'example'
      const registry = new ProviderRegistry()

      expect(registry.get('example')).toBeDefined()
      expect(registry.get('example')?.name).toBe('example')
    })

    it('carrega múltiplos providers separados por vírgula', () => {
      process.env.PROVIDERS_ENABLED = 'gupshup,example'
      const registry = new ProviderRegistry()

      expect(registry.all()).toHaveLength(2)
    })

    it('ignora providers desconhecidos sem lançar erro', () => {
      process.env.PROVIDERS_ENABLED = 'gupshup,nonexistent'
      const registry = new ProviderRegistry()

      expect(registry.all()).toHaveLength(1)
      expect(registry.get('gupshup')).toBeDefined()
    })

    it('retorna lista vazia quando nenhum provider está habilitado', () => {
      process.env.PROVIDERS_ENABLED = ''
      const registry = new ProviderRegistry()

      expect(registry.all()).toHaveLength(0)
    })

    it('tolera espaços extras na lista de providers', () => {
      process.env.PROVIDERS_ENABLED = ' gupshup , example '
      const registry = new ProviderRegistry()

      expect(registry.get('gupshup')).toBeDefined()
      expect(registry.get('example')).toBeDefined()
    })
  })

  describe('get()', () => {
    it('retorna undefined para provider não registrado', () => {
      process.env.PROVIDERS_ENABLED = 'gupshup'
      const registry = new ProviderRegistry()

      expect(registry.get('unknown')).toBeUndefined()
    })
  })

  describe('allPolling()', () => {
    it('retorna somente providers que suportam polling', () => {
      process.env.PROVIDERS_ENABLED = 'gupshup,example'
      const registry = new ProviderRegistry()

      const pollingProviders = registry.allPolling()

      expect(pollingProviders.length).toBeGreaterThan(0)
      expect(pollingProviders.every((p) => p.supportsPolling())).toBe(true)
    })
  })

  describe('allWebhook()', () => {
    it('retorna somente providers que suportam webhook', () => {
      process.env.PROVIDERS_ENABLED = 'gupshup,example'
      const registry = new ProviderRegistry()

      const webhookProviders = registry.allWebhook()

      expect(webhookProviders.every((p) => p.supportsWebhook())).toBe(true)
    })

    it('exclui o provider example que não suporta webhook', () => {
      process.env.PROVIDERS_ENABLED = 'gupshup,example'
      const registry = new ProviderRegistry()

      const webhookProviders = registry.allWebhook()

      expect(webhookProviders.find((p) => p.name === 'example')).toBeUndefined()
    })
  })
})
