"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendAlertEmail = sendAlertEmail;
const client_ses_1 = require("@aws-sdk/client-ses");
const client = new client_ses_1.SESClient({});
async function sendAlertEmail(params) {
    const recipients = (process.env.ALERT_RECIPIENTS ?? '')
        .split(',')
        .map((e) => e.trim())
        .filter(Boolean);
    if (recipients.length === 0)
        return;
    const fromEmail = process.env.SES_FROM_EMAIL ?? recipients[0];
    const body = [
        `Phone Number : ${params.phoneNumber}`,
        `Provider     : ${params.provider}`,
        `Previous     : ${params.previousStatus ?? 'N/A'}`,
        `New Status   : ${params.newStatus}`,
        `Timestamp    : ${params.timestamp}`,
    ].join('\n');
    await client.send(new client_ses_1.SendEmailCommand({
        Source: fromEmail,
        Destination: { ToAddresses: recipients },
        Message: {
            Subject: {
                Data: `[WhatsApp Reputation Alert] ${params.phoneNumber} → ${params.newStatus}`,
            },
            Body: {
                Text: { Data: body },
            },
        },
    }));
}
//# sourceMappingURL=ses.js.map