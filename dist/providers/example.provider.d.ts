import { ReputationProvider } from '../shared/provider.interface';
import { NormalizedReputationStatus } from '../shared/types';
/**
 * Stub provider for local development and testing.
 * Always returns HIGH status. Does not support webhooks.
 */
export declare class ExampleProvider implements ReputationProvider {
    readonly name = "example";
    supportsWebhook(): boolean;
    supportsPolling(): boolean;
    parseWebhook(_payload: unknown): NormalizedReputationStatus;
    fetchReputation(phoneNumber: string): Promise<NormalizedReputationStatus>;
}
