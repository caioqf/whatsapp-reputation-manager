import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { WhatsAppNumberRecord, ReputationEventRecord } from '../shared/types';
export declare const docClient: DynamoDBDocumentClient;
export declare function getWhatsAppNumber(phoneNumber: string): Promise<WhatsAppNumberRecord | null>;
export declare function putWhatsAppNumber(record: WhatsAppNumberRecord): Promise<void>;
export declare function updateLastCheckedAt(phoneNumber: string, last_checked_at: string): Promise<void>;
export declare function putReputationEvent(record: ReputationEventRecord): Promise<void>;
export declare function getAllActiveNumbers(): Promise<WhatsAppNumberRecord[]>;
