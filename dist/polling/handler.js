"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = handler;
const dynamodb_1 = require("../infra/dynamodb");
const sqs_1 = require("../infra/sqs");
const provider_registry_1 = require("../shared/provider.registry");
const logger_1 = require("../shared/logger");
async function handler(_event) {
    const numbers = await (0, dynamodb_1.getAllActiveNumbers)();
    logger_1.logger.info({ count: numbers.length }, 'polling_started');
    const byProvider = numbers.reduce((acc, n) => {
        if (!acc[n.provider])
            acc[n.provider] = [];
        acc[n.provider].push(n.phoneNumber);
        return acc;
    }, {});
    for (const [providerName, phoneNumbers] of Object.entries(byProvider)) {
        const provider = provider_registry_1.registry.get(providerName);
        if (!provider || !provider.supportsPolling()) {
            logger_1.logger.warn({ provider: providerName }, 'provider_not_found_or_no_polling_support');
            continue;
        }
        for (const phoneNumber of phoneNumbers) {
            try {
                const event = await provider.fetchReputation(phoneNumber);
                await (0, sqs_1.publishReputationEvent)(event);
                logger_1.logger.info({ phoneNumber, provider: providerName }, 'event_published');
            }
            catch (err) {
                logger_1.logger.error({ phoneNumber, provider: providerName, err }, 'fetch_reputation_error');
            }
        }
    }
    logger_1.logger.info({ count: numbers.length }, 'polling_completed');
}
//# sourceMappingURL=handler.js.map