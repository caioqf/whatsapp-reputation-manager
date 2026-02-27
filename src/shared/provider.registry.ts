import { ReputationProvider } from './provider.interface'
import { GupshupProvider } from '../providers/gupshup.provider'
import { ExampleProvider } from '../providers/example.provider'

type ProviderFactory = () => ReputationProvider

const AVAILABLE_PROVIDERS: Record<string, ProviderFactory> = {
  gupshup: () => new GupshupProvider(),
  example: () => new ExampleProvider(),
}

export class ProviderRegistry {
  private readonly providers: Map<string, ReputationProvider>

  constructor() {
    this.providers = new Map()

    const enabled = (process.env.PROVIDERS_ENABLED ?? '')
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean)

    for (const name of enabled) {
      const factory = AVAILABLE_PROVIDERS[name]
      if (factory) {
        this.providers.set(name, factory())
      }
    }
  }

  get(name: string): ReputationProvider | undefined {
    return this.providers.get(name)
  }

  all(): ReputationProvider[] {
    return Array.from(this.providers.values())
  }

  allPolling(): ReputationProvider[] {
    return this.all().filter((p) => p.supportsPolling())
  }

  allWebhook(): ReputationProvider[] {
    return this.all().filter((p) => p.supportsWebhook())
  }
}

export const registry = new ProviderRegistry()
