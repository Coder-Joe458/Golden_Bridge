const MASK_PLACEHOLDER = "***";

const maskSegment = (segment: string): string => {
  if (!segment.length) return MASK_PLACEHOLDER;
  const first = segment[0];
  return `${first}${MASK_PLACEHOLDER}`;
};

export function maskName(name: string | null | undefined): string | null {
  if (!name) return null;
  const parts = name.split(/\s+/).filter(Boolean);
  if (!parts.length) {
    return MASK_PLACEHOLDER;
  }
  return parts.map(maskSegment).join(" ");
}

export function maskEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  const [local, domain] = email.split("@");
  if (!domain) return MASK_PLACEHOLDER;
  if (!local) return `***@${domain}`;
  const prefix = `${local[0]}${MASK_PLACEHOLDER}`;
  return `${prefix}@${domain}`;
}

export function maskPhoneNumber(phoneNumber: string | null | undefined): string | null {
  if (!phoneNumber) return null;
  return phoneNumber.replace(/\d/g, "*");
}

type BorrowerInfo = {
  id: string;
  name: string | null;
  email: string | null;
  phoneNumber: string | null;
};

export function maskBorrowerContact<T extends BorrowerInfo>(borrower: T | null | undefined): T | null | undefined {
  if (!borrower) return borrower;
  return {
    ...borrower,
    name: maskName(borrower.name),
    email: maskEmail(borrower.email),
    phoneNumber: maskPhoneNumber(borrower.phoneNumber)
  };
}
