import { ReputationStatus } from '../shared/types';
export type AlertEmailParams = {
    phoneNumber: string;
    provider: string;
    previousStatus: ReputationStatus | null;
    newStatus: ReputationStatus;
    timestamp: string;
};
export declare function sendAlertEmail(params: AlertEmailParams): Promise<void>;
