"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = handler;
const status_engine_1 = require("../shared/status-engine");
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
    const event = JSON.parse(record.body);
    await (0, status_engine_1.processReputationEvent)(event);
    logger_1.logger.info({ messageId: record.messageId, phoneNumber: event.phoneNumber }, 'record_processed');
}
//# sourceMappingURL=handler.js.map