"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.processReputationEvent = processReputationEvent;
const dynamodb_1 = require("../infra/dynamodb");
const ses_1 = require("../infra/ses");
const logger_1 = require("./logger");
const ALERT_STATUSES = ['LOW', 'BLOCKED'];
function emitMetric(name, value = 1) {
    console.log(JSON.stringify({
        _aws: {
            Timestamp: Date.now(),
            CloudWatchMetrics: [
                {
                    Namespace: 'WhatsAppReputationMonitor',
                    Dimensions: [['service']],
                    Metrics: [{ Name: name, Unit: 'Count' }],
                },
            ],
        },
        service: 'reputation-processor',
        [name]: value,
    }));
}
async function processReputationEvent(event) {
    const existing = await (0, dynamodb_1.getWhatsAppNumber)(event.phoneNumber);
    const now = event.timestamp;
    if (!existing) {
        await handleNewNumber(event, now);
        return;
    }
    if (existing.current_status === event.status) {
        await (0, dynamodb_1.updateLastCheckedAt)(event.phoneNumber, now);
        logger_1.logger.info({ phoneNumber: event.phoneNumber, status: event.status }, 'status_unchanged');
        emitMetric('events_processed');
        return;
    }
    await handleStatusTransition(event, existing, now);
}
async function handleNewNumber(event, now) {
    const record = {
        phoneNumber: event.phoneNumber,
        provider: event.provider,
        current_status: event.status,
        last_checked_at: now,
        last_source: event.source,
    };
    await (0, dynamodb_1.putWhatsAppNumber)(record);
    await (0, dynamodb_1.putReputationEvent)({
        phoneNumber: event.phoneNumber,
        timestamp: now,
        provider: event.provider,
        old_status: null,
        new_status: event.status,
        source: event.source,
        rawPayload: event.rawPayload,
    });
    logger_1.logger.info({ phoneNumber: event.phoneNumber, status: event.status }, 'new_number_registered');
    emitMetric('events_processed');
    if (ALERT_STATUSES.includes(event.status)) {
        await (0, ses_1.sendAlertEmail)({
            phoneNumber: event.phoneNumber,
            provider: event.provider,
            previousStatus: null,
            newStatus: event.status,
            timestamp: now,
        });
        await (0, dynamodb_1.putWhatsAppNumber)({ ...record, last_alert_status: event.status });
        logger_1.logger.info({ phoneNumber: event.phoneNumber, status: event.status }, 'alert_sent');
        emitMetric('alerts_sent');
    }
}
async function handleStatusTransition(event, existing, now) {
    const oldStatus = existing.current_status;
    await (0, dynamodb_1.putReputationEvent)({
        phoneNumber: event.phoneNumber,
        timestamp: now,
        provider: event.provider,
        old_status: oldStatus,
        new_status: event.status,
        source: event.source,
        rawPayload: event.rawPayload,
    });
    const shouldAlert = ALERT_STATUSES.includes(event.status) && existing.last_alert_status !== event.status;
    const updatedRecord = {
        ...existing,
        current_status: event.status,
        last_checked_at: now,
        last_source: event.source,
        provider: event.provider,
        ...(shouldAlert ? { last_alert_status: event.status } : {}),
    };
    await (0, dynamodb_1.putWhatsAppNumber)(updatedRecord);
    logger_1.logger.info({ phoneNumber: event.phoneNumber, oldStatus, newStatus: event.status }, 'status_transition');
    emitMetric('events_processed');
    emitMetric('status_transitions');
    if (shouldAlert) {
        await (0, ses_1.sendAlertEmail)({
            phoneNumber: event.phoneNumber,
            provider: event.provider,
            previousStatus: oldStatus,
            newStatus: event.status,
            timestamp: now,
        });
        logger_1.logger.info({ phoneNumber: event.phoneNumber, status: event.status }, 'alert_sent');
        emitMetric('alerts_sent');
    }
}
//# sourceMappingURL=status-engine.js.map