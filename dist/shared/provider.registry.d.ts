import { ReputationProvider } from './provider.interface';
export declare class ProviderRegistry {
    private readonly providers;
    constructor();
    get(name: string): ReputationProvider | undefined;
    all(): ReputationProvider[];
    allPolling(): ReputationProvider[];
    allWebhook(): ReputationProvider[];
}
export declare const registry: ProviderRegistry;
