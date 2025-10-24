import { z } from "zod";

export type ContactIdentifier =
  | { type: "email"; value: string; raw: string }
  | { type: "phone"; value: string; raw: string };

const emailSchema = z.string().email();

const MIN_US_PHONE_DIGITS = 10;
const US_COUNTRY_CODE = "1";

export class ContactIdentifierError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ContactIdentifierError";
  }
}

const stripNonDigits = (input: string): string => input.replace(/\D/g, "");

const normalizeUSPhone = (input: string): string | null => {
  const digits = stripNonDigits(input);

  if (digits.length === MIN_US_PHONE_DIGITS) {
    return `+${US_COUNTRY_CODE}${digits}`;
  }

  if (digits.length === MIN_US_PHONE_DIGITS + 1 && digits.startsWith(US_COUNTRY_CODE)) {
    return `+${digits}`;
  }

  return null;
};

export function parseContactIdentifier(input: string): ContactIdentifier {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new ContactIdentifierError("Contact information is required.");
  }

  const email = emailSchema.safeParse(trimmed);
  if (email.success) {
    return {
      type: "email",
      value: email.data.toLowerCase(),
      raw: trimmed
    };
  }

  const normalizedPhone = normalizeUSPhone(trimmed);
  if (normalizedPhone) {
    return {
      type: "phone",
      value: normalizedPhone,
      raw: trimmed
    };
  }

  throw new ContactIdentifierError("Please enter a valid work email or US phone number.");
}

export const formatUSPhoneForDisplay = (phoneNumber: string | null | undefined): string | null => {
  if (!phoneNumber) return null;
  const normalized = normalizeUSPhone(phoneNumber);
  if (!normalized) return phoneNumber;
  const digits = normalized.slice(2); // remove +1
  const area = digits.slice(0, 3);
  const prefix = digits.slice(3, 6);
  const line = digits.slice(6);
  return `(${area}) ${prefix}-${line}`;
};
