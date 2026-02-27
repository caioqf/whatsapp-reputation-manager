"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.docClient = void 0;
exports.getWhatsAppNumber = getWhatsAppNumber;
exports.putWhatsAppNumber = putWhatsAppNumber;
exports.updateLastCheckedAt = updateLastCheckedAt;
exports.putReputationEvent = putReputationEvent;
exports.getAllActiveNumbers = getAllActiveNumbers;
const client_dynamodb_1 = require("@aws-sdk/client-dynamodb");
const lib_dynamodb_1 = require("@aws-sdk/lib-dynamodb");
const client = new client_dynamodb_1.DynamoDBClient({});
exports.docClient = lib_dynamodb_1.DynamoDBDocumentClient.from(client);
const TABLE_WHATSAPP_NUMBERS = process.env.TABLE_WHATSAPP_NUMBERS;
const TABLE_REPUTATION_EVENTS = process.env.TABLE_REPUTATION_EVENTS;
async function getWhatsAppNumber(phoneNumber) {
    const result = await exports.docClient.send(new lib_dynamodb_1.GetCommand({
        TableName: TABLE_WHATSAPP_NUMBERS,
        Key: { phoneNumber },
    }));
    return result.Item ?? null;
}
async function putWhatsAppNumber(record) {
    await exports.docClient.send(new lib_dynamodb_1.PutCommand({
        TableName: TABLE_WHATSAPP_NUMBERS,
        Item: record,
    }));
}
async function updateLastCheckedAt(phoneNumber, last_checked_at) {
    await exports.docClient.send(new lib_dynamodb_1.UpdateCommand({
        TableName: TABLE_WHATSAPP_NUMBERS,
        Key: { phoneNumber },
        UpdateExpression: 'SET last_checked_at = :ts',
        ExpressionAttributeValues: { ':ts': last_checked_at },
    }));
}
async function putReputationEvent(record) {
    await exports.docClient.send(new lib_dynamodb_1.PutCommand({
        TableName: TABLE_REPUTATION_EVENTS,
        Item: record,
    }));
}
async function getAllActiveNumbers() {
    const result = await exports.docClient.send(new lib_dynamodb_1.ScanCommand({
        TableName: TABLE_WHATSAPP_NUMBERS,
    }));
    return result.Items ?? [];
}
//# sourceMappingURL=dynamodb.js.map