import crypto from 'crypto';
import {
  getPool,
  query,
  inMemoryDb,
  SupportTicketRecord,
  SupportTicketMessageRecord,
  SupportTicketAttachmentRecord,
  UserRecord,
  AuditLogRecord,
} from '../db/client';
import {
  CreateSupportTicketInput,
  ReplySupportTicketInput,
  UpdateTicketStatusInput,
} from '../middleware/validation';
import { StorageService } from './storage.service';
import { NotificationService } from './notification.service';

export interface SupportTicketWithDetails extends SupportTicketRecord {
  user?: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
  };
  messages?: (SupportTicketMessageRecord & {
    sender_name?: string;
    attachments?: (SupportTicketAttachmentRecord & { download_url?: string })[];
  })[];
  attachments?: (SupportTicketAttachmentRecord & { download_url?: string })[];
}

export class SupportService {
  /**
   * Helper to write an audit log entry for Support events
   */
  public static async recordAuditLog(
    actorId: string | null,
    action: string,
    targetId: string,
    details: Record<string, any>,
    ip?: string,
    userAgent?: string
  ): Promise<void> {
    const pool = getPool();
    const now = new Date();
    const auditId = crypto.randomUUID();
    const sanitizedIp = ip ? String(ip).split(',')[0].trim().substring(0, 100) : null;
    const sanitizedUserAgent = userAgent ? String(userAgent).substring(0, 500) : null;

    if (pool) {
      await query(
        `INSERT INTO audit_logs (id, actor_id, action, entity_type, entity_id, details, ip_address, user_agent, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [auditId, actorId, action, 'support_ticket', targetId, JSON.stringify(details), sanitizedIp, sanitizedUserAgent, now]
      );
    } else {
      const record: AuditLogRecord = {
        id: auditId,
        actor_id: actorId,
        action,
        entity_type: 'support_ticket',
        entity_id: targetId,
        details,
        ip_address: sanitizedIp,
        user_agent: sanitizedUserAgent,
        created_at: now,
      };
      inMemoryDb.auditLogs.unshift(record);
    }
  }

  /**
   * Generates a unique, professional ticket reference number (e.g., TKT-7K9A-402)
   */
  private static generateTicketNumber(): string {
    const prefix = 'TKT';
    const randCode = Math.random().toString(36).substring(2, 6).toUpperCase();
    const suffix = Math.floor(100 + Math.random() * 900);
    return `${prefix}-${randCode}-${suffix}`;
  }

  /**
   * CLIENT: Create a new support ticket with initial message and optional attachments
   */
  public static async createTicket(
    userId: string,
    input: CreateSupportTicketInput,
    ip?: string,
    userAgent?: string
  ): Promise<SupportTicketRecord> {
    const pool = getPool();
    const ticketId = crypto.randomUUID();
    const ticketNo = this.generateTicketNumber();
    const now = new Date();

    const ticketRecord: SupportTicketRecord = {
      id: ticketId,
      ticket_no: ticketNo,
      user_id: userId,
      subject: input.subject,
      category: input.category,
      priority: input.priority,
      status: 'open',
      last_reply_at: now,
      resolved_at: null,
      closed_at: null,
      assigned_to: null,
      created_at: now,
      updated_at: now,
    };

    const messageId = crypto.randomUUID();
    const messageRecord: SupportTicketMessageRecord = {
      id: messageId,
      ticket_id: ticketId,
      sender_id: userId,
      sender_role: 'client',
      message: input.message,
      is_internal: false,
      created_at: now,
    };

    // Process attachments
    const attachmentRecords: SupportTicketAttachmentRecord[] = [];
    if (input.attachments && input.attachments.length > 0) {
      for (const att of input.attachments) {
        const buffer = Buffer.from(att.file_base64, 'base64');
        const uploadRes = await StorageService.uploadDocument(
          userId,
          buffer,
          att.original_filename,
          att.mime_type,
          'support'
        );
        attachmentRecords.push({
          id: crypto.randomUUID(),
          ticket_id: ticketId,
          message_id: messageId,
          user_id: userId,
          object_key: uploadRes.objectKey,
          original_filename: uploadRes.originalFilename,
          mime_type: uploadRes.mimeType,
          file_size: uploadRes.fileSize,
          created_at: now,
        });
      }
    }

    if (pool) {
      // 1. Insert ticket
      await query(
        `INSERT INTO support_tickets (id, ticket_no, user_id, subject, category, priority, status, last_reply_at, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          ticketRecord.id,
          ticketRecord.ticket_no,
          ticketRecord.user_id,
          ticketRecord.subject,
          ticketRecord.category,
          ticketRecord.priority,
          ticketRecord.status,
          ticketRecord.last_reply_at,
          ticketRecord.created_at,
          ticketRecord.updated_at,
        ]
      );

      // 2. Insert initial message
      await query(
        `INSERT INTO support_ticket_messages (id, ticket_id, sender_id, sender_role, message, is_internal, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          messageRecord.id,
          messageRecord.ticket_id,
          messageRecord.sender_id,
          messageRecord.sender_role,
          messageRecord.message,
          messageRecord.is_internal,
          messageRecord.created_at,
        ]
      );

      // 3. Insert attachments
      for (const att of attachmentRecords) {
        await query(
          `INSERT INTO support_ticket_attachments (id, ticket_id, message_id, user_id, object_key, original_filename, mime_type, file_size, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            att.id,
            att.ticket_id,
            att.message_id,
            att.user_id,
            att.object_key,
            att.original_filename,
            att.mime_type,
            att.file_size,
            att.created_at,
          ]
        );
      }
    } else {
      inMemoryDb.supportTickets.set(ticketRecord.id, ticketRecord);
      inMemoryDb.supportMessages.push(messageRecord);
      for (const att of attachmentRecords) {
        inMemoryDb.supportAttachments.push(att);
      }
    }

    await this.recordAuditLog(
      userId,
      'SUPPORT_TICKET_CREATED',
      ticketId,
      { ticket_no: ticketNo, category: input.category, priority: input.priority },
      ip,
      userAgent
    );

    return ticketRecord;
  }

  /**
   * CLIENT: List tickets belonging to the client
   */
  public static async listClientTickets(
    userId: string,
    statusFilter?: string,
    page: number = 1,
    limit: number = 20
  ): Promise<{ tickets: SupportTicketRecord[]; total: number }> {
    const pool = getPool();
    const offset = (page - 1) * limit;

    if (pool) {
      let countSql = `SELECT COUNT(*) as count FROM support_tickets WHERE user_id = $1`;
      let dataSql = `SELECT * FROM support_tickets WHERE user_id = $1`;
      const params: any[] = [userId];

      if (statusFilter && statusFilter !== 'all') {
        countSql += ` AND status = $2`;
        dataSql += ` AND status = $2`;
        params.push(statusFilter);
      }

      dataSql += ` ORDER BY last_reply_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
      const dataParams = [...params, limit, offset];

      const countRes = await query<{ count: string }>(countSql, params);
      const total = parseInt(countRes[0]?.count || '0', 10);
      const tickets = await query<SupportTicketRecord>(dataSql, dataParams);

      return { tickets, total };
    } else {
      let tickets = Array.from(inMemoryDb.supportTickets.values()).filter((t) => t.user_id === userId);
      if (statusFilter && statusFilter !== 'all') {
        tickets = tickets.filter((t) => t.status === statusFilter);
      }

      tickets.sort((a, b) => b.last_reply_at.getTime() - a.last_reply_at.getTime());
      const total = tickets.length;
      const paginated = tickets.slice(offset, offset + limit);

      return { tickets: paginated, total };
    }
  }

  /**
   * CLIENT & ADMIN: Get ticket details, messages, and attachments with strict IDOR check
   */
  public static async getTicketDetails(
    ticketId: string,
    requestingUserId: string,
    isAdmin: boolean = false
  ): Promise<SupportTicketWithDetails> {
    const pool = getPool();
    let ticket: SupportTicketRecord | null = null;

    if (pool) {
      const rows = await query<SupportTicketRecord>(
        `SELECT * FROM support_tickets WHERE id = $1 LIMIT 1`,
        [ticketId]
      );
      if (rows.length > 0) ticket = rows[0];
    } else {
      ticket = inMemoryDb.supportTickets.get(ticketId) || null;
    }

    if (!ticket) {
      throw new Error('Support ticket not found');
    }

    // STRICT IDOR ENFORCEMENT: Client can only view their own tickets
    if (!isAdmin && ticket.user_id !== requestingUserId) {
      throw new Error('Unauthorized: You do not have permission to access this ticket');
    }

    // Fetch messages: clients must NEVER see is_internal = true messages!
    let messages: SupportTicketMessageRecord[] = [];
    let attachments: SupportTicketAttachmentRecord[] = [];
    let userRecord: UserRecord | null = null;

    if (pool) {
      const userRows = await query<UserRecord>(
        `SELECT id, first_name, last_name, email FROM users WHERE id = $1 LIMIT 1`,
        [ticket.user_id]
      );
      if (userRows.length > 0) userRecord = userRows[0];

      if (isAdmin) {
        messages = await query<SupportTicketMessageRecord>(
          `SELECT * FROM support_ticket_messages WHERE ticket_id = $1 ORDER BY created_at ASC`,
          [ticketId]
        );
      } else {
        messages = await query<SupportTicketMessageRecord>(
          `SELECT * FROM support_ticket_messages WHERE ticket_id = $1 AND is_internal = false ORDER BY created_at ASC`,
          [ticketId]
        );
      }

      attachments = await query<SupportTicketAttachmentRecord>(
        `SELECT * FROM support_ticket_attachments WHERE ticket_id = $1 ORDER BY created_at ASC`,
        [ticketId]
      );
    } else {
      userRecord = inMemoryDb.users.get(ticket.user_id) || null;
      messages = inMemoryDb.supportMessages
        .filter((m) => m.ticket_id === ticketId && (isAdmin || !m.is_internal))
        .sort((a, b) => a.created_at.getTime() - b.created_at.getTime());

      attachments = inMemoryDb.supportAttachments
        .filter((a) => a.ticket_id === ticketId)
        .sort((a, b) => a.created_at.getTime() - b.created_at.getTime());
    }

    // Generate secure download URLs for attachments
    const attsWithUrls = await Promise.all(
      attachments.map(async (att) => ({
        ...att,
        download_url: await StorageService.getDownloadUrl(att.object_key),
      }))
    );

    // Group attachments by message
    const formattedMessages = messages.map((msg) => {
      const msgAtts = attsWithUrls.filter((a) => a.message_id === msg.id);
      return {
        ...msg,
        sender_name: msg.sender_role === 'admin' ? 'Support Specialist' : userRecord ? `${userRecord.first_name} ${userRecord.last_name}` : 'Client',
        attachments: msgAtts,
      };
    });

    return {
      ...ticket,
      user: userRecord ? {
        id: userRecord.id,
        first_name: userRecord.first_name,
        last_name: userRecord.last_name,
        email: userRecord.email,
      } : undefined,
      messages: formattedMessages,
      attachments: attsWithUrls,
    };
  }

  /**
   * CLIENT: Reply to an existing support ticket
   */
  public static async replyToTicketClient(
    ticketId: string,
    userId: string,
    input: ReplySupportTicketInput,
    ip?: string,
    userAgent?: string
  ): Promise<SupportTicketMessageRecord> {
    const details = await this.getTicketDetails(ticketId, userId, false);

    if (details.status === 'closed') {
      throw new Error('This ticket is closed. Please create a new ticket if you require further assistance.');
    }

    const pool = getPool();
    const messageId = crypto.randomUUID();
    const now = new Date();

    const messageRecord: SupportTicketMessageRecord = {
      id: messageId,
      ticket_id: ticketId,
      sender_id: userId,
      sender_role: 'client',
      message: input.message,
      is_internal: false,
      created_at: now,
    };

    // Client reply updates ticket status to 'in_progress' or 'open' and updates last_reply_at
    const newStatus: 'open' | 'in_progress' = details.status === 'resolved' ? 'in_progress' : details.status === 'waiting_for_client' ? 'in_progress' : details.status;

    if (pool) {
      await query(
        `INSERT INTO support_ticket_messages (id, ticket_id, sender_id, sender_role, message, is_internal, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          messageRecord.id,
          messageRecord.ticket_id,
          messageRecord.sender_id,
          messageRecord.sender_role,
          messageRecord.message,
          messageRecord.is_internal,
          messageRecord.created_at,
        ]
      );

      await query(
        `UPDATE support_tickets
         SET last_reply_at = $1, status = $2, updated_at = $1
         WHERE id = $3`,
        [now, newStatus, ticketId]
      );

      // Handle attachments
      if (input.attachments && input.attachments.length > 0) {
        for (const att of input.attachments) {
          const buffer = Buffer.from(att.file_base64, 'base64');
          const uploadRes = await StorageService.uploadDocument(
            userId,
            buffer,
            att.original_filename,
            att.mime_type,
            'support'
          );
          await query(
            `INSERT INTO support_ticket_attachments (id, ticket_id, message_id, user_id, object_key, original_filename, mime_type, file_size, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
            [
              crypto.randomUUID(),
              ticketId,
              messageId,
              userId,
              uploadRes.objectKey,
              uploadRes.originalFilename,
              uploadRes.mimeType,
              uploadRes.fileSize,
              now,
            ]
          );
        }
      }
    } else {
      inMemoryDb.supportMessages.push(messageRecord);
      const ticket = inMemoryDb.supportTickets.get(ticketId);
      if (ticket) {
        ticket.last_reply_at = now;
        ticket.status = newStatus;
        ticket.updated_at = now;
      }

      if (input.attachments && input.attachments.length > 0) {
        for (const att of input.attachments) {
          const buffer = Buffer.from(att.file_base64, 'base64');
          const uploadRes = await StorageService.uploadDocument(
            userId,
            buffer,
            att.original_filename,
            att.mime_type,
            'support'
          );
          inMemoryDb.supportAttachments.push({
            id: crypto.randomUUID(),
            ticket_id: ticketId,
            message_id: messageId,
            user_id: userId,
            object_key: uploadRes.objectKey,
            original_filename: uploadRes.originalFilename,
            mime_type: uploadRes.mimeType,
            file_size: uploadRes.fileSize,
            created_at: now,
          });
        }
      }
    }

    await this.recordAuditLog(userId, 'SUPPORT_CLIENT_REPLY', ticketId, { message_id: messageId }, ip, userAgent);
    return messageRecord;
  }

  /**
   * ADMIN: List all support tickets with filtering
   */
  public static async listAllTicketsAdmin(
    filters: { status?: string; category?: string; priority?: string; search?: string } = {},
    page: number = 1,
    limit: number = 20
  ): Promise<{ tickets: SupportTicketWithDetails[]; total: number }> {
    const pool = getPool();
    const offset = (page - 1) * limit;

    if (pool) {
      let countSql = `SELECT COUNT(*) as count FROM support_tickets t JOIN users u ON u.id = t.user_id WHERE 1=1`;
      let dataSql = `
        SELECT t.*, u.first_name, u.last_name, u.email,
          (SELECT COUNT(*) FROM support_ticket_messages m WHERE m.ticket_id = t.id) as message_count
        FROM support_tickets t
        JOIN users u ON u.id = t.user_id
        WHERE 1=1
      `;
      const params: any[] = [];

      if (filters.status && filters.status !== 'all') {
        params.push(filters.status);
        countSql += ` AND t.status = $${params.length}`;
        dataSql += ` AND t.status = $${params.length}`;
      }

      if (filters.category && filters.category !== 'all') {
        params.push(filters.category);
        countSql += ` AND t.category = $${params.length}`;
        dataSql += ` AND t.category = $${params.length}`;
      }

      if (filters.priority && filters.priority !== 'all') {
        params.push(filters.priority);
        countSql += ` AND t.priority = $${params.length}`;
        dataSql += ` AND t.priority = $${params.length}`;
      }

      if (filters.search) {
        params.push(`%${filters.search}%`);
        countSql += ` AND (t.ticket_no ILIKE $${params.length} OR t.subject ILIKE $${params.length} OR u.email ILIKE $${params.length})`;
        dataSql += ` AND (t.ticket_no ILIKE $${params.length} OR t.subject ILIKE $${params.length} OR u.email ILIKE $${params.length})`;
      }

      dataSql += ` ORDER BY t.last_reply_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
      const dataParams = [...params, limit, offset];

      const countRes = await query<{ count: string }>(countSql, params);
      const total = parseInt(countRes[0]?.count || '0', 10);
      const rows = await query<any>(dataSql, dataParams);

      const formatted: SupportTicketWithDetails[] = rows.map((r) => ({
        id: r.id,
        ticket_no: r.ticket_no,
        user_id: r.user_id,
        subject: r.subject,
        category: r.category,
        priority: r.priority,
        status: r.status,
        last_reply_at: r.last_reply_at,
        resolved_at: r.resolved_at,
        closed_at: r.closed_at,
        assigned_to: r.assigned_to,
        created_at: r.created_at,
        updated_at: r.updated_at,
        user: {
          id: r.user_id,
          first_name: r.first_name,
          last_name: r.last_name,
          email: r.email,
        },
      }));

      return { tickets: formatted, total };
    } else {
      let tickets = Array.from(inMemoryDb.supportTickets.values());

      if (filters.status && filters.status !== 'all') {
        tickets = tickets.filter((t) => t.status === filters.status);
      }
      if (filters.category && filters.category !== 'all') {
        tickets = tickets.filter((t) => t.category === filters.category);
      }
      if (filters.priority && filters.priority !== 'all') {
        tickets = tickets.filter((t) => t.priority === filters.priority);
      }
      if (filters.search) {
        const q = filters.search.toLowerCase();
        tickets = tickets.filter((t) => {
          const user = inMemoryDb.users.get(t.user_id);
          return (
            t.ticket_no.toLowerCase().includes(q) ||
            t.subject.toLowerCase().includes(q) ||
            user?.email.toLowerCase().includes(q)
          );
        });
      }

      tickets.sort((a, b) => b.last_reply_at.getTime() - a.last_reply_at.getTime());
      const total = tickets.length;
      const paginated = tickets.slice(offset, offset + limit);

      const formatted: SupportTicketWithDetails[] = paginated.map((t) => {
        const user = inMemoryDb.users.get(t.user_id);
        return {
          ...t,
          user: user ? {
            id: user.id,
            first_name: user.first_name,
            last_name: user.last_name,
            email: user.email,
          } : undefined,
        };
      });

      return { tickets: formatted, total };
    }
  }

  /**
   * ADMIN: Reply to a ticket (can be public or internal note)
   */
  public static async replyToTicketAdmin(
    ticketId: string,
    adminId: string,
    input: ReplySupportTicketInput,
    ip?: string,
    userAgent?: string
  ): Promise<SupportTicketMessageRecord> {
    const details = await this.getTicketDetails(ticketId, adminId, true);
    const pool = getPool();
    const messageId = crypto.randomUUID();
    const now = new Date();
    const isInternal = !!input.is_internal;

    const messageRecord: SupportTicketMessageRecord = {
      id: messageId,
      ticket_id: ticketId,
      sender_id: adminId,
      sender_role: 'admin',
      message: input.message,
      is_internal: isInternal,
      created_at: now,
    };

    // Public reply updates status to 'waiting_for_client'; internal note leaves status unchanged
    const newStatus: 'waiting_for_client' | string = isInternal ? details.status : 'waiting_for_client';

    if (pool) {
      await query(
        `INSERT INTO support_ticket_messages (id, ticket_id, sender_id, sender_role, message, is_internal, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          messageRecord.id,
          messageRecord.ticket_id,
          messageRecord.sender_id,
          messageRecord.sender_role,
          messageRecord.message,
          messageRecord.is_internal,
          messageRecord.created_at,
        ]
      );

      await query(
        `UPDATE support_tickets
         SET last_reply_at = $1, status = $2, updated_at = $1
         WHERE id = $3`,
        [now, newStatus, ticketId]
      );

      // Handle attachments
      if (input.attachments && input.attachments.length > 0) {
        for (const att of input.attachments) {
          const buffer = Buffer.from(att.file_base64, 'base64');
          const uploadRes = await StorageService.uploadDocument(
            adminId,
            buffer,
            att.original_filename,
            att.mime_type,
            'support'
          );
          await query(
            `INSERT INTO support_ticket_attachments (id, ticket_id, message_id, user_id, object_key, original_filename, mime_type, file_size, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
            [
              crypto.randomUUID(),
              ticketId,
              messageId,
              adminId,
              uploadRes.objectKey,
              uploadRes.originalFilename,
              uploadRes.mimeType,
              uploadRes.fileSize,
              now,
            ]
          );
        }
      }
    } else {
      inMemoryDb.supportMessages.push(messageRecord);
      const ticket = inMemoryDb.supportTickets.get(ticketId);
      if (ticket) {
        ticket.last_reply_at = now;
        ticket.status = newStatus as any;
        ticket.updated_at = now;
      }

      if (input.attachments && input.attachments.length > 0) {
        for (const att of input.attachments) {
          const buffer = Buffer.from(att.file_base64, 'base64');
          const uploadRes = await StorageService.uploadDocument(
            adminId,
            buffer,
            att.original_filename,
            att.mime_type,
            'support'
          );
          inMemoryDb.supportAttachments.push({
            id: crypto.randomUUID(),
            ticket_id: ticketId,
            message_id: messageId,
            user_id: adminId,
            object_key: uploadRes.objectKey,
            original_filename: uploadRes.originalFilename,
            mime_type: uploadRes.mimeType,
            file_size: uploadRes.fileSize,
            created_at: now,
          });
        }
      }
    }

    await this.recordAuditLog(
      adminId,
      isInternal ? 'SUPPORT_INTERNAL_NOTE_ADDED' : 'SUPPORT_ADMIN_REPLY',
      ticketId,
      { is_internal: isInternal, message_id: messageId },
      ip,
      userAgent
    );

    // Only notify client if reply is public (not internal)
    if (!isInternal) {
      await NotificationService.createNotification(
        details.user_id,
        `New Support Reply: ${details.ticket_no}`,
        `A support specialist has replied to your ticket "${details.subject}".`,
        'support_ticket',
        { ticket_id: ticketId, ticket_no: details.ticket_no }
      );
    }

    return messageRecord;
  }

  /**
   * ADMIN & CLIENT: Update ticket status (e.g. resolve, close, re-open)
   */
  public static async updateTicketStatus(
    ticketId: string,
    actorId: string,
    isAdmin: boolean,
    input: UpdateTicketStatusInput,
    ip?: string,
    userAgent?: string
  ): Promise<SupportTicketRecord> {
    const details = await this.getTicketDetails(ticketId, actorId, isAdmin);

    // Client can only close their own ticket
    if (!isAdmin && input.status !== 'closed') {
      throw new Error('Clients can only mark their tickets as closed');
    }

    const pool = getPool();
    const now = new Date();
    const resolvedAt = input.status === 'resolved' ? now : details.resolved_at;
    const closedAt = input.status === 'closed' ? now : details.closed_at;

    if (pool) {
      const rows = await query<SupportTicketRecord>(
        `UPDATE support_tickets
         SET status = $1, resolved_at = $2, closed_at = $3, updated_at = $4
         WHERE id = $5
         RETURNING *`,
        [input.status, resolvedAt, closedAt, now, ticketId]
      );

      await this.recordAuditLog(
        actorId,
        'SUPPORT_TICKET_STATUS_UPDATED',
        ticketId,
        { previous_status: details.status, new_status: input.status, is_admin: isAdmin },
        ip,
        userAgent
      );

      // Notify client if admin changed status
      if (isAdmin && details.user_id !== actorId) {
        await NotificationService.createNotification(
          details.user_id,
          `Ticket Status Updated: ${details.ticket_no}`,
          `Your support ticket status has been changed to "${input.status.replace('_', ' ')}".`,
          'support_ticket',
          { ticket_id: ticketId, status: input.status, ticket_no: details.ticket_no }
        );
      }

      return rows[0];
    } else {
      const ticket = inMemoryDb.supportTickets.get(ticketId);
      if (!ticket) throw new Error('Ticket not found');

      ticket.status = input.status;
      ticket.resolved_at = resolvedAt;
      ticket.closed_at = closedAt;
      ticket.updated_at = now;

      await this.recordAuditLog(
        actorId,
        'SUPPORT_TICKET_STATUS_UPDATED',
        ticketId,
        { previous_status: details.status, new_status: input.status, is_admin: isAdmin },
        ip,
        userAgent
      );

      if (isAdmin && details.user_id !== actorId) {
        await NotificationService.createNotification(
          details.user_id,
          `Ticket Status Updated: ${details.ticket_no}`,
          `Your support ticket status has been changed to "${input.status.replace('_', ' ')}".`,
          'support_ticket',
          { ticket_id: ticketId, status: input.status, ticket_no: details.ticket_no }
        );
      }

      return ticket;
    }
  }
}
