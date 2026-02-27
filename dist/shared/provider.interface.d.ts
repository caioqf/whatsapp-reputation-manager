import { NormalizedReputationStatus } from './types';
export interface ReputationProvider {
    name: string;
    supportsWebhook(): boolean;
    supportsPolling(): boolean;
    parseWebhook(payload: unknown): NormalizedReputationStatus;
    fetchReputation(phoneNumber: string): Promise<NormalizedReputationStatus>;
}
