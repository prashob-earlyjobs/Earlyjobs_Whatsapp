import Contact, { IContact } from '../models/Contact';

export interface CreateContactData {
  phoneNumber: string;
  name: string;
  email?: string;
  tags?: string[];
  customFields?: Record<string, any>;
  assignedTo?: string;
}

export interface ContactFilters {
  search?: string;
  tags?: string[];
  assignedTo?: string;
  isBlocked?: boolean;
}

export class ContactService {
  static async createContact(contactData: CreateContactData): Promise<IContact> {
    const existingContact = await Contact.findOne({ phoneNumber: contactData.phoneNumber });
    if (existingContact) {
      throw new Error('Contact with this phone number already exists');
    }

    const contact = new Contact(contactData);
    return await contact.save();
  }

  static async getContactById(contactId: string): Promise<IContact | null> {
    return await Contact.findById(contactId).populate('assignedTo', 'name email');
  }

  static async getContactByPhone(phoneNumber: string): Promise<IContact | null> {
    return await Contact.findOne({ phoneNumber }).populate('assignedTo', 'name email');
  }

  static async updateContact(contactId: string, updateData: Partial<IContact>): Promise<IContact | null> {
    return await Contact.findByIdAndUpdate(contactId, updateData, { new: true })
      .populate('assignedTo', 'name email');
  }

  static async getAllContacts(filters: ContactFilters = {}): Promise<IContact[]> {
    const query: any = {};

    if (filters.search) {
      query.$or = [
        { name: { $regex: filters.search, $options: 'i' } },
        { phoneNumber: { $regex: filters.search, $options: 'i' } },
        { email: { $regex: filters.search, $options: 'i' } },
      ];
    }

    if (filters.tags && filters.tags.length > 0) {
      query.tags = { $in: filters.tags };
    }

    if (filters.assignedTo) {
      query.assignedTo = filters.assignedTo;
    }

    if (filters.isBlocked !== undefined) {
      query.isBlocked = filters.isBlocked;
    }

    return await Contact.find(query).populate('assignedTo', 'name email');
  }

  static async deleteContact(contactId: string): Promise<boolean> {
    const result = await Contact.findByIdAndDelete(contactId);
    return !!result;
  }

  static async blockContact(contactId: string): Promise<IContact | null> {
    return await Contact.findByIdAndUpdate(
      contactId, 
      { isBlocked: true }, 
      { new: true }
    );
  }

  static async unblockContact(contactId: string): Promise<IContact | null> {
    return await Contact.findByIdAndUpdate(
      contactId, 
      { isBlocked: false }, 
      { new: true }
    );
  }

  static async assignContact(contactId: string, userId: string): Promise<IContact | null> {
    return await Contact.findByIdAndUpdate(
      contactId,
      { assignedTo: userId },
      { new: true }
    ).populate('assignedTo', 'name email');
  }
} 