import { ReputationProvider } from '../shared/provider.interface';
import { NormalizedReputationStatus } from '../shared/types';
export declare class GupshupProvider implements ReputationProvider {
    readonly name = "gupshup";
    private readonly apiKey;
    private readonly partnerToken;
    private readonly baseUrl;
    supportsWebhook(): boolean;
    supportsPolling(): boolean;
    parseWebhook(payload: unknown): NormalizedReputationStatus;
    fetchReputation(phoneNumber: string): Promise<NormalizedReputationStatus>;
    private normalizeStatus;
}
