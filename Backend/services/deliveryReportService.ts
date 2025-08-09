import DeliveryReport, { IDeliveryReport } from '../models/DeliveryReport';

export interface CreateDeliveryReportData {
  messageId: string;
  srcAddr: string;
  destAddr: string;
  channel: string;
  eventType: 'SENT' | 'DELIVERED' | 'READ' | 'FAILED';
  cause: string;
  errorCode: string;
  eventTs: Date;
  hsmTemplateId?: string;
  conversation?: any;
  pricing?: any;
  noOfFrags?: number;
  internalStatus: 'sent' | 'delivered' | 'read' | 'failed';
}

export class DeliveryReportService {
  
  /**
   * Create a new delivery report
   */
  static async createDeliveryReport(data: CreateDeliveryReportData): Promise<IDeliveryReport> {
    const deliveryReport = new DeliveryReport(data);
    return await deliveryReport.save();
  }

  /**
   * Get delivery reports for a specific message
   */
  static async getDeliveryReportsByMessageId(messageId: string): Promise<IDeliveryReport[]> {
    return await DeliveryReport.find({ messageId })
      .sort({ eventTs: 1 }) // Oldest first to show timeline
      .exec();
  }

  /**
   * Get latest delivery report for a message
   */
  static async getLatestDeliveryReport(messageId: string): Promise<IDeliveryReport | null> {
    return await DeliveryReport.findOne({ messageId })
      .sort({ eventTs: -1 }) // Latest first
      .exec();
  }

  /**
   * Get delivery reports for a phone number (for analytics)
   */
  static async getDeliveryReportsByPhone(
    phoneNumber: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<IDeliveryReport[]> {
    return await DeliveryReport.find({ destAddr: phoneNumber })
      .sort({ eventTs: -1 })
      .limit(limit)
      .skip(offset)
      .exec();
  }

  /**
   * Get delivery report statistics
   */
  static async getDeliveryStats(phoneNumber?: string): Promise<{
    total: number;
    sent: number;
    delivered: number;
    read: number;
    failed: number;
    successRate: number;
  }> {
    const matchQuery = phoneNumber ? { destAddr: phoneNumber } : {};
    
    const stats = await DeliveryReport.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: '$internalStatus',
          count: { $sum: 1 }
        }
      }
    ]);

    const result = {
      total: 0,
      sent: 0,
      delivered: 0,
      read: 0,
      failed: 0,
      successRate: 0
    };

    stats.forEach(stat => {
      result.total += stat.count;
      result[stat._id as keyof typeof result] = stat.count;
    });

    // Calculate success rate (delivered + read / total)
    if (result.total > 0) {
      result.successRate = ((result.delivered + result.read) / result.total) * 100;
    }

    return result;
  }

  /**
   * Clean up old delivery reports (optional - for maintenance)
   */
  static async cleanupOldReports(daysOld: number = 90): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);
    
    const result = await DeliveryReport.deleteMany({
      createdAt: { $lt: cutoffDate }
    });
    
    return result.deletedCount || 0;
  }

  /**
   * Check if a delivery report already exists (to prevent duplicates)
   */
  static async reportExists(
    messageId: string, 
    eventType: string, 
    eventTs: Date
  ): Promise<boolean> {
    const existing = await DeliveryReport.findOne({
      messageId,
      eventType,
      eventTs
    });
    
    return !!existing;
  }
}