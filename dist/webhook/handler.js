"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = handler;
// TODO: implement webhook flow
// Responsibilities:
//   - Validate request signature per provider
//   - Identify provider from path/header
//   - Call provider.parseWebhook(payload)
//   - Publish NormalizedReputationStatus to SQS
//   - Return HTTP 200 immediately
async function handler(_event) {
    throw new Error('Webhook handler not yet implemented');
}
//# sourceMappingURL=handler.js.map