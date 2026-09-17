import crypto from 'crypto';
import {
  getPool,
  query,
  inMemoryDb,
  KycProfileRecord,
  KycDocumentRecord,
  UserRecord,
  AuditLogRecord,
} from '../db/client';
import { KycProfileInput, KycReviewInput } from '../middleware/validation';
import { StorageService } from './storage.service';
import { NotificationService } from './notification.service';

export interface KycProfileWithDetails extends KycProfileRecord {
  user?: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    country: string;
  };
  documents?: (KycDocumentRecord & { download_url?: string; storage_key?: string })[];
}

export class KycService {
  /**
   * Helper to write an audit log entry for KYC events
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
        [auditId, actorId, action, 'kyc', targetId, JSON.stringify(details), sanitizedIp, sanitizedUserAgent, now]
      );
    } else {
      const record: AuditLogRecord = {
        id: auditId,
        actor_id: actorId,
        action,
        entity_type: 'kyc',
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
   * Retrieves KYC profile for a user
   */
  public static async getProfileByUserId(userId: string): Promise<KycProfileWithDetails | null> {
    const pool = getPool();

    if (pool) {
      const profiles = await query<KycProfileRecord>(
        `SELECT * FROM kyc_profiles WHERE user_id = $1 LIMIT 1`,
        [userId]
      );
      const documents = await query<KycDocumentRecord>(
        `SELECT * FROM kyc_documents WHERE user_id = $1 ORDER BY created_at DESC`,
        [userId]
      );
      // Generate secure download URLs for attached documents
      const docsWithUrls = await Promise.all(
        documents.map(async (doc) => ({
          ...doc,
          storage_key: doc.object_key,
          download_url: await StorageService.getDownloadUrl(doc.object_key),
        }))
      );

      if (profiles.length === 0) {
        if (documents.length === 0) return null;
        return {
          id: '',
          user_id: userId,
          first_name: '',
          last_name: '',
          date_of_birth: '',
          nationality: '',
          country_of_residence: '',
          address_line1: '',
          city: '',
          postal_code: '',
          id_document_type: 'passport',
          id_document_number: '',
          id_expiry_date: null,
          status: 'pending',
          rejection_reason: null,
          admin_notes: null,
          submitted_at: null,
          reviewed_at: null,
          reviewed_by: null,
          created_at: new Date(),
          updated_at: new Date(),
          documents: docsWithUrls,
        } as any;
      }

      const profile = profiles[0];

      return {
        ...profile,
        documents: docsWithUrls,
      };
    } else {
      let profile = inMemoryDb.kycProfiles.get(userId);
      if (!profile) {
        // Check by user_id across values
        for (const p of inMemoryDb.kycProfiles.values()) {
          if (p.user_id === userId) {
            profile = p;
            break;
          }
        }
      }

      const documents = Array.from(inMemoryDb.kycDocuments.values())
        .filter((d) => d.user_id === userId)
        .sort((a, b) => b.created_at.getTime() - a.created_at.getTime());

      const docsWithUrls = await Promise.all(
        documents.map(async (doc) => ({
          ...doc,
          storage_key: doc.object_key,
          download_url: await StorageService.getDownloadUrl(doc.object_key),
        }))
      );

      if (!profile) {
        if (documents.length === 0) return null;
        return {
          id: '',
          user_id: userId,
          first_name: '',
          last_name: '',
          date_of_birth: '',
          nationality: '',
          country_of_residence: '',
          address_line1: '',
          city: '',
          postal_code: '',
          id_document_type: 'passport',
          id_document_number: '',
          id_expiry_date: null,
          status: 'pending',
          rejection_reason: null,
          admin_notes: null,
          submitted_at: null,
          reviewed_at: null,
          reviewed_by: null,
          created_at: new Date(),
          updated_at: new Date(),
          documents: docsWithUrls,
        } as any;
      }

      return {
        ...profile,
        documents: docsWithUrls,
      };
    }
  }

  /**
   * Retrieves KYC profile by profile ID (Admin or owner)
   */
  public static async getProfileById(profileId: string): Promise<KycProfileWithDetails | null> {
    const pool = getPool();

    if (pool) {
      const profiles = await query<KycProfileRecord>(
        `SELECT * FROM kyc_profiles WHERE id = $1 LIMIT 1`,
        [profileId]
      );
      if (profiles.length === 0) return null;
      const profile = profiles[0];

      const users = await query<UserRecord>(
        `SELECT id, first_name, last_name, email, country FROM users WHERE id = $1 LIMIT 1`,
        [profile.user_id]
      );

      const documents = await query<KycDocumentRecord>(
        `SELECT * FROM kyc_documents WHERE profile_id = $1 OR user_id = $2 ORDER BY created_at DESC`,
        [profile.id, profile.user_id]
      );

      const docsWithUrls = await Promise.all(
        documents.map(async (doc) => ({
          ...doc,
          storage_key: doc.object_key,
          download_url: await StorageService.getDownloadUrl(doc.object_key),
        }))
      );

      return {
        ...profile,
        user: users[0] ? {
          id: users[0].id,
          first_name: users[0].first_name,
          last_name: users[0].last_name,
          email: users[0].email,
          country: users[0].country,
        } : undefined,
        documents: docsWithUrls,
      };
    } else {
      const profile = inMemoryDb.kycProfiles.get(profileId) ||
        Array.from(inMemoryDb.kycProfiles.values()).find((p) => p.id === profileId);
      if (!profile) return null;

      const user = inMemoryDb.users.get(profile.user_id);
      const documents = Array.from(inMemoryDb.kycDocuments.values())
        .filter((d) => d.profile_id === profile.id || d.user_id === profile.user_id)
        .sort((a, b) => b.created_at.getTime() - a.created_at.getTime());

      const docsWithUrls = await Promise.all(
        documents.map(async (doc) => ({
          ...doc,
          storage_key: doc.object_key,
          download_url: await StorageService.getDownloadUrl(doc.object_key),
        }))
      );

      return {
        ...profile,
        user: user ? {
          id: user.id,
          first_name: user.first_name,
          last_name: user.last_name,
          email: user.email,
          country: user.country,
        } : undefined,
        documents: docsWithUrls,
      };
    }
  }

  /**
   * Submits or updates KYC profile information
   */
  public static async submitProfile(
    userId: string,
    input: KycProfileInput,
    ip?: string,
    userAgent?: string
  ): Promise<KycProfileRecord> {
    const pool = getPool();
    const existing = await this.getProfileByUserId(userId);

    // If profile is already approved, changes require admin reset
    if (existing && existing.status === 'approved') {
      throw new Error('Your identity verification is already approved. Contact support to update verified details.');
    }

    const now = new Date();

    if (existing) {
      // Update existing profile and return to pending for review
      const updatedStatus: 'pending' = 'pending';

      if (pool) {
        const rows = await query<KycProfileRecord>(
          `UPDATE kyc_profiles
           SET first_name = $1, last_name = $2, date_of_birth = $3, nationality = $4, country = $5,
               address_line1 = $6, address_line2 = $7, city = $8, state_province = $9, postal_code = $10,
               id_type = $11, id_number = $12, status = $13, rejection_reason = NULL, submitted_at = $14, updated_at = $14
           WHERE id = $15
           RETURNING *`,
          [
            input.first_name,
            input.last_name,
            input.date_of_birth,
            input.nationality,
            input.country,
            input.address_line1,
            input.address_line2 || null,
            input.city,
            input.state_province || null,
            input.postal_code,
            input.id_type,
            input.id_number,
            updatedStatus,
            now,
            existing.id,
          ]
        );
        const record = rows[0];
        await this.recordAuditLog(userId, 'KYC_PROFILE_RESUBMITTED', record.id, { status: updatedStatus }, ip, userAgent);
        await NotificationService.createNotification(
          userId,
          'KYC Verification Resubmitted',
          'Your updated identity verification application has been submitted for review.',
          'kyc_status',
          { profile_id: record.id, status: updatedStatus }
        );
        return record;
      } else {
        existing.first_name = input.first_name;
        existing.last_name = input.last_name;
        existing.date_of_birth = input.date_of_birth;
        existing.nationality = input.nationality;
        existing.country = input.country;
        existing.address_line1 = input.address_line1;
        existing.address_line2 = input.address_line2 || null;
        existing.city = input.city;
        existing.state_province = input.state_province || null;
        existing.postal_code = input.postal_code;
        existing.id_type = input.id_type;
        existing.id_number = input.id_number;
        existing.status = updatedStatus;
        existing.rejection_reason = null;
        existing.submitted_at = now;
        existing.updated_at = now;

        inMemoryDb.kycProfiles.set(existing.id, existing);
        inMemoryDb.kycProfiles.set(userId, existing);
        await this.recordAuditLog(userId, 'KYC_PROFILE_RESUBMITTED', existing.id, { status: updatedStatus }, ip, userAgent);
        await NotificationService.createNotification(
          userId,
          'KYC Verification Resubmitted',
          'Your updated identity verification application has been submitted for review.',
          'kyc_status',
          { profile_id: existing.id, status: updatedStatus }
        );
        return existing;
      }
    } else {
      // Create fresh KYC profile
      const profileId = crypto.randomUUID();
      const record: KycProfileRecord = {
        id: profileId,
        user_id: userId,
        status: 'pending',
        first_name: input.first_name,
        last_name: input.last_name,
        date_of_birth: input.date_of_birth,
        nationality: input.nationality,
        country: input.country,
        address_line1: input.address_line1,
        address_line2: input.address_line2 || null,
        city: input.city,
        state_province: input.state_province || null,
        postal_code: input.postal_code,
        id_type: input.id_type,
        id_number: input.id_number,
        rejection_reason: null,
        admin_notes: null,
        submitted_at: now,
        reviewed_at: null,
        reviewed_by: null,
        created_at: now,
        updated_at: now,
      };

      if (pool) {
        const rows = await query<KycProfileRecord>(
          `INSERT INTO kyc_profiles (id, user_id, status, first_name, last_name, date_of_birth, nationality, country,
                                     address_line1, address_line2, city, state_province, postal_code, id_type, id_number,
                                     submitted_at, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
           RETURNING *`,
          [
            record.id,
            record.user_id,
            record.status,
            record.first_name,
            record.last_name,
            record.date_of_birth,
            record.nationality,
            record.country,
            record.address_line1,
            record.address_line2,
            record.city,
            record.state_province,
            record.postal_code,
            record.id_type,
            record.id_number,
            record.submitted_at,
            record.created_at,
            record.updated_at,
          ]
        );
        await this.recordAuditLog(userId, 'KYC_PROFILE_SUBMITTED', record.id, { status: 'pending' }, ip, userAgent);
        await NotificationService.createNotification(
          userId,
          'KYC Verification Submitted',
          'Your identity verification application has been submitted and is currently pending review.',
          'kyc_status',
          { profile_id: record.id, status: 'pending' }
        );
        return rows[0];
      } else {
        inMemoryDb.kycProfiles.set(record.id, record);
        inMemoryDb.kycProfiles.set(userId, record);
        await this.recordAuditLog(userId, 'KYC_PROFILE_SUBMITTED', record.id, { status: 'pending' }, ip, userAgent);
        await NotificationService.createNotification(
          userId,
          'KYC Verification Submitted',
          'Your identity verification application has been submitted and is currently pending review.',
          'kyc_status',
          { profile_id: record.id, status: 'pending' }
        );
        return record;
      }
    }
  }

  /**
   * Uploads and attaches a KYC document (Stored in Persistent Object Storage, metadata in DB)
   */
  public static async uploadDocument(
    userId: string,
    documentType: 'id_front' | 'id_back' | 'passport' | 'proof_of_address' | 'other',
    originalFilename: string,
    mimeType: string,
    fileBuffer: Buffer,
    ip?: string,
    userAgent?: string
  ): Promise<KycDocumentRecord & { download_url: string; storage_key?: string }> {
    // 1. Upload file to persistent object storage
    const storageResult = await StorageService.uploadDocument(
      userId,
      fileBuffer,
      originalFilename,
      mimeType,
      'kyc'
    );

    // 2. Link with user's KYC profile if present
    const profile = await this.getProfileByUserId(userId);
    const pool = getPool();
    const docId = crypto.randomUUID();
    const now = new Date();

    const record: KycDocumentRecord = {
      id: docId,
      profile_id: profile?.id || null,
      user_id: userId,
      document_type: documentType,
      object_key: storageResult.objectKey,
      original_filename: storageResult.originalFilename,
      mime_type: storageResult.mimeType,
      file_size: storageResult.fileSize,
      status: 'pending',
      rejection_reason: null,
      created_at: now,
      updated_at: now,
    };

    if (pool) {
      const rows = await query<KycDocumentRecord>(
        `INSERT INTO kyc_documents (id, profile_id, user_id, document_type, object_key, original_filename,
                                    mime_type, file_size, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         RETURNING *`,
        [
          record.id,
          record.profile_id,
          record.user_id,
          record.document_type,
          record.object_key,
          record.original_filename,
          record.mime_type,
          record.file_size,
          record.status,
          record.created_at,
          record.updated_at,
        ]
      );
      await this.recordAuditLog(
        userId,
        'KYC_DOCUMENT_UPLOADED',
        record.id,
        {
          document_type: documentType,
          original_filename: storageResult.originalFilename,
          mime_type: mimeType,
          file_size: storageResult.fileSize,
        },
        ip,
        userAgent
      );
      return {
        ...rows[0],
        storage_key: record.object_key,
        download_url: storageResult.url,
      };
    } else {
      inMemoryDb.kycDocuments.set(record.id, record);
      await this.recordAuditLog(
        userId,
        'KYC_DOCUMENT_UPLOADED',
        record.id,
        {
          document_type: documentType,
          original_filename: storageResult.originalFilename,
          mime_type: mimeType,
          file_size: storageResult.fileSize,
        },
        ip,
        userAgent
      );
      return {
        ...record,
        storage_key: record.object_key,
        download_url: storageResult.url,
      };
    }
  }

  /**
   * Retrieves single document record (Strict IDOR Protected)
   */
  public static async getDocumentById(
    documentId: string,
    requestingUserId: string,
    isAdmin: boolean = false
  ): Promise<(KycDocumentRecord & { download_url: string }) | null> {
    const pool = getPool();
    let doc: KycDocumentRecord | null = null;

    if (pool) {
      const rows = await query<KycDocumentRecord>(
        `SELECT * FROM kyc_documents WHERE id = $1 LIMIT 1`,
        [documentId]
      );
      if (rows.length > 0) doc = rows[0];
    } else {
      doc = inMemoryDb.kycDocuments.get(documentId) || null;
    }

    if (!doc) return null;

    // IDOR verification
    if (!isAdmin && doc.user_id !== requestingUserId) {
      throw new Error('Unauthorized: You do not have permission to access this document');
    }

    const downloadUrl = await StorageService.getDownloadUrl(doc.object_key);
    return {
      ...doc,
      download_url: downloadUrl,
    };
  }

  /**
   * Deletes a document if status is pending or rejected
   */
  public static async deleteDocument(
    documentId: string,
    userId: string,
    ip?: string,
    userAgent?: string
  ): Promise<boolean> {
    const doc = await this.getDocumentById(documentId, userId, false);
    if (!doc) throw new Error('Document not found');

    if (doc.status === 'approved') {
      throw new Error('Approved identity documents cannot be deleted');
    }

    // Delete from persistent object storage
    await StorageService.deleteDocument(doc.object_key);

    const pool = getPool();
    if (pool) {
      await query(`DELETE FROM kyc_documents WHERE id = $1`, [documentId]);
    } else {
      inMemoryDb.kycDocuments.delete(documentId);
    }

    await this.recordAuditLog(userId, 'KYC_DOCUMENT_DELETED', documentId, { document_type: doc.document_type }, ip, userAgent);
    return true;
  }

  /**
   * ADMIN: List KYC applications queue
   */
  public static async listProfilesAdmin(
    statusFilter?: string,
    page: number = 1,
    limit: number = 20
  ): Promise<{ profiles: KycProfileWithDetails[]; total: number }> {
    const pool = getPool();
    const offset = (page - 1) * limit;

    if (pool) {
      let countQuery = `SELECT COUNT(*) as count FROM kyc_profiles`;
      let dataQuery = `
        SELECT p.*, u.first_name as u_fname, u.last_name as u_lname, u.email as u_email, u.country as u_country
        FROM kyc_profiles p
        JOIN users u ON u.id = p.user_id
      `;
      const params: any[] = [];

      if (statusFilter && statusFilter !== 'all') {
        countQuery += ` WHERE status = $1`;
        dataQuery += ` WHERE p.status = $1`;
        params.push(statusFilter);
      }

      dataQuery += ` ORDER BY p.submitted_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
      const dataParams = [...params, limit, offset];

      const countRes = await query<{ count: string }>(countQuery, params);
      const total = parseInt(countRes[0]?.count || '0', 10);
      const rows = await query<any>(dataQuery, dataParams);

      const formatted: KycProfileWithDetails[] = rows.map((r) => ({
        id: r.id,
        user_id: r.user_id,
        status: r.status,
        first_name: r.first_name,
        last_name: r.last_name,
        date_of_birth: r.date_of_birth,
        nationality: r.nationality,
        country: r.country,
        address_line1: r.address_line1,
        address_line2: r.address_line2,
        city: r.city,
        state_province: r.state_province,
        postal_code: r.postal_code,
        id_type: r.id_type,
        id_number: r.id_number,
        rejection_reason: r.rejection_reason,
        admin_notes: r.admin_notes,
        submitted_at: r.submitted_at,
        reviewed_at: r.reviewed_at,
        reviewed_by: r.reviewed_by,
        created_at: r.created_at,
        updated_at: r.updated_at,
        user: {
          id: r.user_id,
          first_name: r.u_fname,
          last_name: r.u_lname,
          email: r.u_email,
          country: r.u_country,
        },
      }));

      return { profiles: formatted, total };
    } else {
      let list = Array.from(inMemoryDb.kycProfiles.values());
      // De-duplicate since map stores by both profile ID and user ID
      const uniqueMap = new Map<string, KycProfileRecord>();
      for (const p of list) {
        uniqueMap.set(p.id, p);
      }
      list = Array.from(uniqueMap.values());

      if (statusFilter && statusFilter !== 'all') {
        list = list.filter((p) => p.status === statusFilter);
      }

      list.sort((a, b) => b.submitted_at.getTime() - a.submitted_at.getTime());
      const total = list.length;
      const paginated = list.slice(offset, offset + limit);

      const formatted: KycProfileWithDetails[] = paginated.map((p) => {
        const user = inMemoryDb.users.get(p.user_id);
        return {
          ...p,
          user: user ? {
            id: user.id,
            first_name: user.first_name,
            last_name: user.last_name,
            email: user.email,
            country: user.country,
          } : undefined,
        };
      });

      return { profiles: formatted, total };
    }
  }

  /**
   * ADMIN: Review and approve/reject a KYC application
   */
  public static async reviewProfileAdmin(
    profileId: string,
    adminId: string,
    input: KycReviewInput,
    ip?: string,
    userAgent?: string
  ): Promise<KycProfileRecord> {
    const profile = await this.getProfileById(profileId);
    if (!profile) {
      throw new Error('KYC profile application not found');
    }

    if (input.status === 'rejected' && !input.rejection_reason) {
      throw new Error('A rejection reason is required when rejecting a KYC application');
    }

    const pool = getPool();
    const now = new Date();
    const newStatus = input.status;
    const rejectionReason = input.status === 'rejected' ? input.rejection_reason || 'Identity requirements not met' : null;
    const adminNotes = input.admin_notes || null;

    if (pool) {
      const rows = await query<KycProfileRecord>(
        `UPDATE kyc_profiles
         SET status = $1, rejection_reason = $2, admin_notes = $3, reviewed_at = $4, reviewed_by = $5, updated_at = $4
         WHERE id = $6
         RETURNING *`,
        [newStatus, rejectionReason, adminNotes, now, adminId, profileId]
      );

      // If approved or rejected, update documents status accordingly
      const docStatus = newStatus === 'approved' ? 'approved' : newStatus === 'rejected' ? 'rejected' : 'pending';
      await query(
        `UPDATE kyc_documents
         SET status = $1, rejection_reason = $2, updated_at = $3
         WHERE profile_id = $4 OR user_id = $5`,
        [docStatus, rejectionReason, now, profileId, profile.user_id]
      );

      const action = newStatus === 'approved' ? 'KYC_APPROVED' : newStatus === 'rejected' ? 'KYC_REJECTED' : 'KYC_UNDER_REVIEW';
      await this.recordAuditLog(
        adminId,
        action,
        profileId,
        {
          user_id: profile.user_id,
          status: newStatus,
          rejection_reason: rejectionReason,
        },
        ip,
        userAgent
      );

      // Send real CRM notification to client
      const notifTitle = newStatus === 'approved' ? 'KYC Approved' : newStatus === 'rejected' ? 'KYC Rejected' : 'KYC Under Review';
      const notifMsg = newStatus === 'approved'
        ? 'Congratulations! Your KYC identity verification has been approved. Your account is fully verified.'
        : newStatus === 'rejected'
        ? `Your identity verification was rejected: ${rejectionReason}. Please review the feedback and resubmit.`
        : 'Your identity documents are currently under administrative review.';

      await NotificationService.createNotification(
        profile.user_id,
        notifTitle,
        notifMsg,
        'kyc_status',
        { profile_id: profileId, status: newStatus, rejection_reason: rejectionReason }
      );

      return rows[0];
    } else {
      profile.status = newStatus;
      profile.rejection_reason = rejectionReason;
      profile.admin_notes = adminNotes;
      profile.reviewed_at = now;
      profile.reviewed_by = adminId;
      profile.updated_at = now;

      inMemoryDb.kycProfiles.set(profile.id, profile);
      inMemoryDb.kycProfiles.set(profile.user_id, profile);

      const docStatus = newStatus === 'approved' ? 'approved' : newStatus === 'rejected' ? 'rejected' : 'pending';
      for (const doc of inMemoryDb.kycDocuments.values()) {
        if (doc.profile_id === profile.id || doc.user_id === profile.user_id) {
          doc.status = docStatus;
          doc.rejection_reason = rejectionReason;
          doc.updated_at = now;
        }
      }

      const action = newStatus === 'approved' ? 'KYC_APPROVED' : newStatus === 'rejected' ? 'KYC_REJECTED' : 'KYC_UNDER_REVIEW';
      await this.recordAuditLog(
        adminId,
        action,
        profileId,
        {
          user_id: profile.user_id,
          status: newStatus,
          rejection_reason: rejectionReason,
        },
        ip,
        userAgent
      );

      const notifTitle = newStatus === 'approved' ? 'KYC Approved' : newStatus === 'rejected' ? 'KYC Rejected' : 'KYC Under Review';
      const notifMsg = newStatus === 'approved'
        ? 'Congratulations! Your KYC identity verification has been approved. Your account is fully verified.'
        : newStatus === 'rejected'
        ? `Your identity verification was rejected: ${rejectionReason}. Please review the feedback and resubmit.`
        : 'Your identity documents are currently under administrative review.';

      await NotificationService.createNotification(
        profile.user_id,
        notifTitle,
        notifMsg,
        'kyc_status',
        { profile_id: profileId, status: newStatus, rejection_reason: rejectionReason }
      );

      return profile;
    }
  }
}
