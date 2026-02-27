"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.publishReputationEvent = publishReputationEvent;
const client_sqs_1 = require("@aws-sdk/client-sqs");
const client = new client_sqs_1.SQSClient({});
const QUEUE_URL = process.env.SQS_QUEUE_URL;
async function publishReputationEvent(event) {
    await client.send(new client_sqs_1.SendMessageCommand({
        QueueUrl: QUEUE_URL,
        MessageBody: JSON.stringify(event),
    }));
}
//# sourceMappingURL=sqs.js.map