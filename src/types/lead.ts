/**
 * TypeScript types for CRM lead payloads
 * Matches the exact structure sent by the PHP script
 */

/**
 * Incoming lead payload from PHP script
 * All fields are nullable - we accept anything without validation
 * Field names match the PHP snake_case format exactly
 */
export interface CrmLeadPayload {
  click_id: string | null;
  country: string | null;
  creo: string | null;
  description: string | null;
  domain: string | null;
  email: string | null;
  firstName: string | null;
  ip: string | null;
  lang: string | null;
  lastName: string | null;
  marker: string | null;
  offer: string | null;
  phone: string | null;
  sourcetype: string | null;
}

/**
 * Response for successful lead creation
 */
export interface LeadCreatedResponse {
  ok: true;
  lead_id: string;
  deduplicated: false;
}

/**
 * Response for deduplicated lead (idempotency key match)
 */
export interface LeadDeduplicatedResponse {
  ok: true;
  lead_id: string;
  deduplicated: true;
}

/**
 * Error response
 */
export interface LeadErrorResponse {
  ok: false;
  error: string;
}

/**
 * Union type for all possible responses
 */
export type LeadResponse = LeadCreatedResponse | LeadDeduplicatedResponse | LeadErrorResponse;

/**
 * Type guard to check if value is a valid object (not null, not array)
 */
export function isValidObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Type guard to narrow unknown body to CrmLeadPayload
 * Note: We do minimal validation - just ensure it's an object
 * All fields are optional/nullable, so we accept anything
 */
export function isCrmLeadPayload(body: unknown): body is CrmLeadPayload {
  return isValidObject(body);
}
