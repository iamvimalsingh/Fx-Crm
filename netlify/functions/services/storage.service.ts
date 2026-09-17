import crypto from 'crypto';
import path from 'path';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export interface StorageUploadResult {
  objectKey: string;
  originalFilename: string;
  mimeType: string;
  fileSize: number;
  url: string;
}

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
]);

const FORBIDDEN_EXTENSIONS = new Set([
  '.exe',
  '.dll',
  '.bat',
  '.cmd',
  '.sh',
  '.php',
  '.phtml',
  '.pl',
  '.py',
  '.rb',
  '.cgi',
  '.js',
  '.ts',
  '.vbs',
  '.jar',
  '.war',
  '.html',
  '.htm',
  '.svg',
  '.jsp',
  '.asp',
  '.aspx',
]);

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

// In-memory persistent object store adapter for local development/testing when S3 credentials are unset
const testStorageBucket: Map<string, { buffer: Buffer; mimeType: string }> = new Map();

export class StorageService {
  private static s3Client: S3Client | null = null;

  /**
   * Checks if persistent object storage credentials are configured
   */
  public static isConfigured(): boolean {
    return Boolean(
      process.env.AWS_BUCKET &&
      process.env.AWS_ACCESS_KEY_ID &&
      process.env.AWS_SECRET_ACCESS_KEY
    );
  }

  /**
   * Environment-driven S3 client initialization
   */
  private static getS3Client(): { client: S3Client; bucket: string } | null {
    const bucket = process.env.AWS_BUCKET;
    const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
    const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
    const region = process.env.AWS_DEFAULT_REGION || 'us-east-1';
    const endpoint = process.env.AWS_ENDPOINT;

    if (!bucket || !accessKeyId || !secretAccessKey) {
      return null;
    }

    if (!this.s3Client) {
      this.s3Client = new S3Client({
        region,
        credentials: {
          accessKeyId,
          secretAccessKey,
        },
        endpoint: endpoint || undefined,
        forcePathStyle: !!endpoint,
      });
    }

    return { client: this.s3Client, bucket };
  }

  /**
   * Sanitizes a user-supplied filename, stripping directory traversal and malicious characters
   */
  public static sanitizeFilename(rawFilename: string): string {
    const base = path.basename(rawFilename).trim();
    // Remove control characters, slashes, null bytes, backticks, quotes
    const sanitized = base.replace(/[^a-zA-Z0-9._-]/g, '_');
    return sanitized || 'document.dat';
  }

  /**
   * Validates document file properties: size, MIME, extension, security rules
   */
  public static validateDocument(
    rawFilename: string,
    mimeType: string,
    fileBuffer: Buffer
  ): { safeFilename: string; ext: string } {
    if (!rawFilename || rawFilename.length > 255) {
      throw new Error('Invalid filename length');
    }

    const safeFilename = this.sanitizeFilename(rawFilename);
    const ext = path.extname(safeFilename).toLowerCase();

    if (FORBIDDEN_EXTENSIONS.has(ext)) {
      throw new Error(`Executable and script files (${ext}) are strictly prohibited`);
    }

    if (!ALLOWED_MIME_TYPES.has(mimeType)) {
      throw new Error(`Unsupported document MIME type (${mimeType}). Allowed: JPEG, PNG, WebP, PDF`);
    }

    if (fileBuffer.length === 0) {
      throw new Error('Uploaded file cannot be empty');
    }

    if (fileBuffer.length > MAX_FILE_SIZE_BYTES) {
      throw new Error(`Uploaded file exceeds 10MB limit (size: ${(fileBuffer.length / (1024 * 1024)).toFixed(2)}MB)`);
    }

    // Inspect initial magic bytes for MIME safety
    if (mimeType === 'application/pdf') {
      const header = fileBuffer.subarray(0, 4).toString('utf-8');
      if (!header.startsWith('%PDF')) {
        throw new Error('File content does not match PDF signature');
      }
    } else if (mimeType === 'image/jpeg') {
      if (fileBuffer[0] !== 0xff || fileBuffer[1] !== 0xd8) {
        throw new Error('File content does not match JPEG signature');
      }
    } else if (mimeType === 'image/png') {
      const pngHeader = [0x89, 0x50, 0x4e, 0x47];
      const match = pngHeader.every((b, i) => fileBuffer[i] === b);
      if (!match) {
        throw new Error('File content does not match PNG signature');
      }
    }

    return { safeFilename, ext };
  }

  /**
   * Uploads a document to persistent object storage (AWS S3, Cloudflare R2, or environment adapter)
   */
  public static async uploadDocument(
    userId: string,
    fileBuffer: Buffer,
    rawFilename: string,
    mimeType: string,
    category: 'kyc' | 'support' = 'kyc'
  ): Promise<StorageUploadResult> {
    const { safeFilename } = this.validateDocument(rawFilename, mimeType, fileBuffer);
    const randomId = crypto.randomUUID();
    const timestamp = Date.now();
    const objectKey = `${category}-documents/${userId}/${timestamp}-${randomId}-${safeFilename}`;

    const s3Config = this.getS3Client();

    if (s3Config) {
      const { client, bucket } = s3Config;
      const command = new PutObjectCommand({
        Bucket: bucket,
        Key: objectKey,
        Body: fileBuffer,
        ContentType: mimeType,
        Metadata: {
          'uploader-user-id': userId,
          'original-filename': encodeURIComponent(safeFilename),
          'upload-timestamp': timestamp.toString(),
        },
      });
      await client.send(command);

      const downloadUrl = await this.getDownloadUrl(objectKey);
      return {
        objectKey,
        originalFilename: safeFilename,
        mimeType,
        fileSize: fileBuffer.length,
        url: downloadUrl,
      };
    } else {
      const isProd =
        (process.env.NODE_ENV === 'production' ||
        process.env.APP_ENV === 'production' ||
        process.env.NETLIFY === 'true') &&
        process.env.CRM_TEST_MODE !== 'true';
      if (isProd) {
        throw new Error(
          'Persistent object storage is not configured. Local or in-memory file uploads are strictly prohibited in production.'
        );
      }

      // Development / test storage adapter ONLY
      testStorageBucket.set(objectKey, { buffer: fileBuffer, mimeType });
      return {
        objectKey,
        originalFilename: safeFilename,
        mimeType,
        fileSize: fileBuffer.length,
        url: `/api/documents/preview?key=${encodeURIComponent(objectKey)}`,
      };
    }
  }

  /**
   * Generates a pre-signed or secure download URL for an object key
   */
  public static async getDownloadUrl(objectKey: string, expiresInSeconds: number = 3600): Promise<string> {
    const s3Config = this.getS3Client();
    if (s3Config) {
      const { client, bucket } = s3Config;
      const command = new GetObjectCommand({
        Bucket: bucket,
        Key: objectKey,
      });
      return await getSignedUrl(client, command, { expiresIn: expiresInSeconds });
    } else {
      const isProd =
        (process.env.NODE_ENV === 'production' ||
        process.env.APP_ENV === 'production' ||
        process.env.NETLIFY === 'true') &&
        process.env.CRM_TEST_MODE !== 'true';
      if (isProd) {
        throw new Error('Persistent object storage is not configured in production.');
      }
      return `/api/documents/preview?key=${encodeURIComponent(objectKey)}`;
    }
  }

  /**
   * Deletes an object from persistent object storage
   */
  public static async deleteDocument(objectKey: string): Promise<void> {
    const s3Config = this.getS3Client();
    if (s3Config) {
      const { client, bucket } = s3Config;
      const command = new DeleteObjectCommand({
        Bucket: bucket,
        Key: objectKey,
      });
      await client.send(command);
    } else {
      const isProd =
        (process.env.NODE_ENV === 'production' ||
        process.env.APP_ENV === 'production' ||
        process.env.NETLIFY === 'true') &&
        process.env.CRM_TEST_MODE !== 'true';
      if (isProd) {
        throw new Error('Persistent object storage is not configured in production.');
      }
      testStorageBucket.delete(objectKey);
    }
  }

  /**
   * Test helper to inspect test storage items
   */
  public static getTestFile(objectKey: string): { buffer: Buffer; mimeType: string } | undefined {
    return testStorageBucket.get(objectKey);
  }

  public static clearTestStorage(): void {
    testStorageBucket.clear();
  }
}
