"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = handler;
const status_engine_1 = require("../shared/status-engine");
const provider_registry_1 = require("../shared/provider.registry");
const logger_1 = require("../shared/logger");
async function handler(event) {
    const batchItemFailures = [];
    for (const record of event.Records) {
        try {
            await processRecord(record);
        }
        catch (err) {
            logger_1.logger.error({ messageId: record.messageId, err }, 'processing_error');
            batchItemFailures.push({ itemIdentifier: record.messageId });
        }
    }
    return { batchItemFailures };
}
async function processRecord(record) {
    logger_1.logger.info({ messageId: record.messageId }, 'processing_record');
    const message = JSON.parse(record.body);
    const normalized = isRawWebhook(message) ? normalize(message) : message;
    await (0, status_engine_1.processReputationEvent)(normalized);
    logger_1.logger.info({ messageId: record.messageId, phoneNumber: normalized.phoneNumber }, 'record_processed');
}
function isRawWebhook(message) {
    return message.source === 'WEBHOOK' && !('phoneNumber' in message);
}
function normalize(message) {
    const provider = provider_registry_1.registry.get(message.provider);
    if (!provider) {
        throw new Error(`Provider not found or not enabled: ${message.provider}`);
    }
    if (!provider.supportsWebhook()) {
        throw new Error(`Provider does not support webhooks: ${message.provider}`);
    }
    return provider.parseWebhook(message.rawPayload);
}
//# sourceMappingURL=handler.js.map