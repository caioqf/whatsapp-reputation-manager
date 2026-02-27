"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExampleProvider = void 0;
/**
 * Stub provider for local development and testing.
 * Always returns HIGH status. Does not support webhooks.
 */
class ExampleProvider {
    name = 'example';
    supportsWebhook() {
        return false;
    }
    supportsPolling() {
        return true;
    }
    parseWebhook(_payload) {
        throw new Error('ExampleProvider does not support webhooks');
    }
    async fetchReputation(phoneNumber) {
        return {
            phoneNumber,
            provider: this.name,
            status: 'HIGH',
            rawStatus: 'active',
            source: 'POLLING',
            timestamp: new Date().toISOString(),
        };
    }
}
exports.ExampleProvider = ExampleProvider;
//# sourceMappingURL=example.provider.js.map