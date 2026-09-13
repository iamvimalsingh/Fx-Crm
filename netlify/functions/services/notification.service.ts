import crypto from 'crypto';
import {
  getPool,
  query,
  inMemoryDb,
  NotificationRecord,
} from '../db/client';

export class NotificationService {
  /**
   * Creates a notification for a user in response to a real CRM event
   */
  public static async createNotification(
    userId: string,
    title: string,
    message: string,
    type: 'kyc_status' | 'deposit_status' | 'withdrawal_status' | 'trading_account' | 'support_ticket' | 'system',
    data: Record<string, any> = {}
  ): Promise<NotificationRecord> {
    const pool = getPool();
    const notificationId = crypto.randomUUID();
    const now = new Date();

    const record: NotificationRecord = {
      id: notificationId,
      user_id: userId,
      title,
      message,
      type,
      data,
      is_read: false,
      read_at: null,
      created_at: now,
    };

    if (pool) {
      await query(
        `INSERT INTO notifications (id, user_id, title, message, type, data, is_read, read_at, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          record.id,
          record.user_id,
          record.title,
          record.message,
          record.type,
          JSON.stringify(record.data),
          record.is_read,
          record.read_at,
          record.created_at,
        ]
      );
    } else {
      inMemoryDb.notifications.unshift(record);
    }

    return record;
  }

  /**
   * Fetches user notifications with pagination
   */
  public static async getUserNotifications(
    userId: string,
    limit: number = 20,
    offset: number = 0
  ): Promise<{ notifications: NotificationRecord[]; unreadCount: number }> {
    const pool = getPool();

    if (pool) {
      const rows = await query<NotificationRecord>(
        `SELECT * FROM notifications
         WHERE user_id = $1
         ORDER BY created_at DESC
         LIMIT $2 OFFSET $3`,
        [userId, limit, offset]
      );

      const unreadRows = await query<{ count: string }>(
        `SELECT COUNT(*) as count FROM notifications
         WHERE user_id = $1 AND is_read = false`,
        [userId]
      );

      const unreadCount = parseInt(unreadRows[0]?.count || '0', 10);
      return { notifications: rows, unreadCount };
    } else {
      const userNotifs = inMemoryDb.notifications.filter((n) => n.user_id === userId);
      const unreadCount = userNotifs.filter((n) => !n.is_read).length;
      const paginated = userNotifs.slice(offset, offset + limit);
      return { notifications: paginated, unreadCount };
    }
  }

  /**
   * Marks a specific notification as read (with user ID authorization check)
   */
  public static async markAsRead(notificationId: string, userId: string): Promise<boolean> {
    const pool = getPool();
    const now = new Date();

    if (pool) {
      const res = await query(
        `UPDATE notifications
         SET is_read = true, read_at = $1
         WHERE id = $2 AND user_id = $3
         RETURNING id`,
        [now, notificationId, userId]
      );
      return res.length > 0;
    } else {
      const notif = inMemoryDb.notifications.find((n) => n.id === notificationId && n.user_id === userId);
      if (!notif) {
        return false;
      }
      notif.is_read = true;
      notif.read_at = now;
      return true;
    }
  }

  /**
   * Marks all notifications as read for a user
   */
  public static async markAllAsRead(userId: string): Promise<number> {
    const pool = getPool();
    const now = new Date();

    if (pool) {
      const res = await query(
        `UPDATE notifications
         SET is_read = true, read_at = $1
         WHERE user_id = $2 AND is_read = false
         RETURNING id`,
        [now, userId]
      );
      return res.length;
    } else {
      let count = 0;
      for (const notif of inMemoryDb.notifications) {
        if (notif.user_id === userId && !notif.is_read) {
          notif.is_read = true;
          notif.read_at = now;
          count++;
        }
      }
      return count;
    }
  }
}
