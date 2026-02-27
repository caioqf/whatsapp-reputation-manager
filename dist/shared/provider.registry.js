"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registry = exports.ProviderRegistry = void 0;
const gupshup_provider_1 = require("../providers/gupshup.provider");
const example_provider_1 = require("../providers/example.provider");
const AVAILABLE_PROVIDERS = {
    gupshup: () => new gupshup_provider_1.GupshupProvider(),
    example: () => new example_provider_1.ExampleProvider(),
};
class ProviderRegistry {
    providers;
    constructor() {
        this.providers = new Map();
        const enabled = (process.env.PROVIDERS_ENABLED ?? '')
            .split(',')
            .map((p) => p.trim())
            .filter(Boolean);
        for (const name of enabled) {
            const factory = AVAILABLE_PROVIDERS[name];
            if (factory) {
                this.providers.set(name, factory());
            }
        }
    }
    get(name) {
        return this.providers.get(name);
    }
    all() {
        return Array.from(this.providers.values());
    }
    allPolling() {
        return this.all().filter((p) => p.supportsPolling());
    }
    allWebhook() {
        return this.all().filter((p) => p.supportsWebhook());
    }
}
exports.ProviderRegistry = ProviderRegistry;
exports.registry = new ProviderRegistry();
//# sourceMappingURL=provider.registry.js.map