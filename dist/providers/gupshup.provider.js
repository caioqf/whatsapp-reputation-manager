"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GupshupProvider = void 0;
const axios_1 = __importDefault(require("axios"));
// Maps Gupshup quality rating color codes to the canonical model
const STATUS_MAP = {
    GREEN: 'HIGH',
    YELLOW: 'MEDIUM',
    RED: 'LOW',
    BLOCKED: 'BLOCKED',
    FLAGGED: 'LOW',
    BANNED: 'BLOCKED',
};
class GupshupProvider {
    name = 'gupshup';
    apiKey = process.env.GUPSHUP_API_KEY ?? '';
    partnerToken = process.env.GUPSHUP_PARTNER_TOKEN ?? '';
    baseUrl = process.env.GUPSHUP_BASE_URL ?? 'https://partner.gupshup.io/partner/app';
    supportsWebhook() {
        return true;
    }
    supportsPolling() {
        return true;
    }
    parseWebhook(payload) {
        const p = payload;
        const phoneNumber = p?.payload?.phoneNumber ?? p?.phoneNumber ?? '';
        const rawStatus = p?.payload?.phoneQualityRating ?? p?.phoneQualityRating ?? '';
        return {
            phoneNumber,
            provider: this.name,
            status: this.normalizeStatus(rawStatus),
            rawStatus,
            source: 'WEBHOOK',
            timestamp: new Date().toISOString(),
            rawPayload: payload,
        };
    }
    async fetchReputation(phoneNumber) {
        const response = await axios_1.default.get(`${this.baseUrl}/${phoneNumber}/health`, {
            headers: {
                apikey: this.apiKey,
                token: this.partnerToken,
            },
        });
        const rawStatus = response.data?.phone?.quality_score?.color_code ?? response.data?.qualityScore ?? '';
        return {
            phoneNumber,
            provider: this.name,
            status: this.normalizeStatus(rawStatus),
            rawStatus,
            source: 'POLLING',
            timestamp: new Date().toISOString(),
            rawPayload: response.data,
        };
    }
    normalizeStatus(raw) {
        const upper = (raw ?? '').toUpperCase();
        return STATUS_MAP[upper] ?? 'MEDIUM';
    }
}
exports.GupshupProvider = GupshupProvider;
//# sourceMappingURL=gupshup.provider.js.map