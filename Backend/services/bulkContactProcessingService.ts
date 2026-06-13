import { ContactService } from './contactService';
import { normalizePhoneNumber, isValidPhoneNumber } from '../utils/phoneNumber';

export interface BulkContactInput {
  name?: string;
  phoneNumber?: string;
  email?: string;
  tags?: string[];
  [key: string]: any;
}

export interface ProcessedBulkContactData {
  contactId: string;
  name: string;
  phoneNumber: string;
  email?: string;
  [key: string]: any;
}

export interface BulkContactResultEntry {
  name: string;
  phoneNumber: string;
  status: 'ready' | 'excluded';
  error?: string;
  id?: string;
}

export interface BulkContactValidationResult {
  originalData: BulkContactInput;
  isValid: boolean;
  errors: string[];
  normalizedPhoneNumber?: string;
  contactId?: string;
  existingContact?: {
    id: string;
    name: string;
    phoneNumber: string;
  };
}

export interface ProcessBulkContactsResult {
  contactIds: string[];
  contactsData: ProcessedBulkContactData[];
  contactResults: BulkContactResultEntry[];
  validationResults: BulkContactValidationResult[];
  summary: {
    total: number;
    valid: number;
    invalid: number;
  };
}

export async function processBulkContacts(
  contactsData: BulkContactInput[],
  userId?: string
): Promise<ProcessBulkContactsResult> {
  const contactIds: string[] = [];
  const successfulContactsData: ProcessedBulkContactData[] = [];
  const contactResults: BulkContactResultEntry[] = [];
  const validationResults: BulkContactValidationResult[] = [];
  const processedNormalizedPhones = new Set<string>();
  const processedContactIds = new Set<string>();

  for (const contactData of contactsData) {
    const validationEntry: BulkContactValidationResult = {
      originalData: contactData,
      isValid: false,
      errors: [],
    };

    if (!contactData.phoneNumber || !contactData.name) {
      const error = 'Missing phoneNumber or name';
      validationEntry.errors.push(error);
      contactResults.push({
        name: contactData.name || 'Unknown',
        phoneNumber: contactData.phoneNumber || 'Unknown',
        status: 'excluded',
        error,
      });
      validationResults.push(validationEntry);
      continue;
    }

    const normalizedPhone = normalizePhoneNumber(contactData.phoneNumber);

    if (!normalizedPhone || !isValidPhoneNumber(contactData.phoneNumber)) {
      const error = 'Invalid phone number format';
      validationEntry.errors.push(error);
      contactResults.push({
        name: contactData.name,
        phoneNumber: contactData.phoneNumber,
        status: 'excluded',
        error,
      });
      validationResults.push(validationEntry);
      continue;
    }

    validationEntry.normalizedPhoneNumber = normalizedPhone;

    if (processedNormalizedPhones.has(normalizedPhone)) {
      const error = 'Duplicate phone number - already in campaign';
      validationEntry.errors.push(error);
      contactResults.push({
        name: contactData.name,
        phoneNumber: contactData.phoneNumber,
        status: 'excluded',
        error,
      });
      validationResults.push(validationEntry);
      continue;
    }

    try {
      let contact = await ContactService.getContactByPhone(contactData.phoneNumber);

      if (!contact) {
        contact = await ContactService.createContact({
          phoneNumber: contactData.phoneNumber,
          name: contactData.name,
          email: contactData.email,
          tags: contactData.tags || ['bulk-message'],
          assignedTo: userId,
        });
      }

      validationEntry.normalizedPhoneNumber = contact.phoneNumber;
      validationEntry.existingContact = {
        id: (contact._id as any).toString(),
        name: contact.name,
        phoneNumber: contact.phoneNumber,
      };

      if (contact.isBlocked) {
        const error = 'Contact is blocked';
        validationEntry.errors.push(error);
        contactResults.push({
          name: contactData.name,
          phoneNumber: contactData.phoneNumber,
          status: 'excluded',
          error,
        });
        validationResults.push(validationEntry);
        continue;
      }

      const contactId = (contact._id as any).toString();

      if (processedContactIds.has(contactId)) {
        processedNormalizedPhones.add(normalizedPhone);
        const error = 'Duplicate contact - already in campaign';
        validationEntry.errors.push(error);
        contactResults.push({
          name: contactData.name,
          phoneNumber: contactData.phoneNumber,
          status: 'excluded',
          error,
        });
        validationResults.push(validationEntry);
        continue;
      }

      processedNormalizedPhones.add(normalizedPhone);
      processedContactIds.add(contactId);

      contactIds.push(contactId);
      successfulContactsData.push({
        contactId,
        name: contactData.name,
        phoneNumber: contactData.phoneNumber,
        email: contactData.email,
        ...contactData,
      });

      validationEntry.contactId = contactId;
      validationEntry.isValid = true;
      validationResults.push(validationEntry);

      contactResults.push({
        id: contact._id as any,
        name: contact.name,
        phoneNumber: contact.phoneNumber,
        status: 'ready',
      });
    } catch (error: any) {
      validationEntry.errors.push(error.message);
      contactResults.push({
        name: contactData.name,
        phoneNumber: contactData.phoneNumber,
        status: 'excluded',
        error: error.message,
      });
      validationResults.push(validationEntry);
    }
  }

  const validCount = contactIds.length;

  return {
    contactIds,
    contactsData: successfulContactsData,
    contactResults,
    validationResults,
    summary: {
      total: contactsData.length,
      valid: validCount,
      invalid: contactsData.length - validCount,
    },
  };
}
