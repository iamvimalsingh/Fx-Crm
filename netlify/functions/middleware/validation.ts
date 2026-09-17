import { z } from 'zod';

export const RegisterSchema = z.object({
  email: z
    .string()
    .min(1, 'Email is required')
    .email('Invalid email address')
    .max(255)
    .transform((val) => val.trim().toLowerCase()),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(100)
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  first_name: z
    .string()
    .trim()
    .min(1, 'First name cannot be empty')
    .max(100),
  last_name: z
    .string()
    .trim()
    .min(1, 'Last name cannot be empty')
    .max(100),
  country: z.string().trim().max(100).default('US'),
  phone: z.string().trim().max(50).optional().nullable(),
  preferred_currency: z.enum(['USD', 'EUR', 'GBP']).default('USD'),
});

export const LoginSchema = z.object({
  email: z
    .string()
    .min(1, 'Email is required')
    .email('Invalid email address')
    .transform((val) => val.trim().toLowerCase()),
  password: z.string().min(1, 'Password cannot be empty'),
});

export const ForgotPasswordSchema = z.object({
  email: z
    .string()
    .min(1, 'Email is required')
    .email('Invalid email address')
    .transform((val) => val.trim().toLowerCase()),
});

export const ResetPasswordSchema = z.object({
  token: z.string().min(10, 'Reset token is required'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(100)
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
});

export type RegisterInput = z.infer<typeof RegisterSchema>;
export type LoginInput = z.infer<typeof LoginSchema>;
export type ForgotPasswordInput = z.infer<typeof ForgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof ResetPasswordSchema>;

// Financial Module Schemas
export const CreateDepositSchema = z.object({
  payment_method_id: z.string().optional().nullable(),
  payment_method_name: z.string().max(255).optional().nullable(),
  amount: z
    .string()
    .min(1, 'Amount is required')
    .refine((val) => !isNaN(Number(val)) && Number(val) > 0, {
      message: 'Deposit amount must be a positive number greater than 0',
    }),
  currency: z.string().default('USD'),
  client_notes: z.string().max(500).optional().nullable(),
  proof_file_path: z
    .string()
    .max(255)
    .refine(
      (val) =>
        !val.includes('..') &&
        !val.includes('\0') &&
        !val.startsWith('/') &&
        !val.startsWith('\\'),
      {
        message: 'Invalid file path: path traversal sequences are strictly prohibited',
      }
    )
    .optional()
    .nullable(),
});

export const ApproveDepositSchema = z.object({
  admin_notes: z.string().max(500).optional().nullable(),
});

export const RejectDepositSchema = z.object({
  rejection_reason: z.string().min(3, 'Rejection reason is required').max(500),
  admin_notes: z.string().max(500).optional().nullable(),
});

export const CreateWithdrawalSchema = z.object({
  payment_method_id: z.string().optional().nullable(),
  amount: z
    .string()
    .min(1, 'Amount is required')
    .refine((val) => !isNaN(Number(val)) && Number(val) > 0, {
      message: 'Withdrawal amount must be a positive number greater than 0',
    }),
  currency: z.string().default('USD'),
  payout_details: z.record(z.string(), z.any()).refine((val) => Object.keys(val).length > 0, {
    message: 'Payout destination details (bank info or wallet address) are required',
  }),
  client_notes: z.string().max(500).optional().nullable(),
});

export const ApproveWithdrawalSchema = z.object({
  admin_notes: z.string().max(500).optional().nullable(),
});

export const RejectWithdrawalSchema = z.object({
  rejection_reason: z.string().min(3, 'Rejection reason is required').max(500),
  admin_notes: z.string().max(500).optional().nullable(),
});

export const ManualAdjustmentSchema = z.object({
  user_id: z.string().min(1, 'User ID is required'),
  type: z.enum(['adjustment_credit', 'adjustment_debit']),
  amount: z
    .string()
    .min(1, 'Amount is required')
    .refine((val) => !isNaN(Number(val)) && Number(val) > 0, {
      message: 'Adjustment amount must be greater than 0',
    }),
  description: z.string().min(3, 'Adjustment description / justification is required'),
});

export type CreateDepositInput = z.infer<typeof CreateDepositSchema>;
export type ApproveDepositInput = z.infer<typeof ApproveDepositSchema>;
export type RejectDepositInput = z.infer<typeof RejectDepositSchema>;
export type CreateWithdrawalInput = z.infer<typeof CreateWithdrawalSchema>;
export type ApproveWithdrawalInput = z.infer<typeof ApproveWithdrawalSchema>;
export type RejectWithdrawalInput = z.infer<typeof RejectWithdrawalSchema>;
export type ManualAdjustmentInput = z.infer<typeof ManualAdjustmentSchema>;

// Account Transfer Schemas (Wallet <-> Trading Account Transfers)
export const CreateAccountTransferSchema = z.object({
  trading_account_id: z.string().min(1, 'Trading account ID is required'),
  direction: z.enum(['wallet_to_trading', 'trading_to_wallet'], {
    message: 'Direction must be wallet_to_trading or trading_to_wallet',
  }),
  amount: z
    .string()
    .min(1, 'Amount is required')
    .refine((val) => !isNaN(Number(val)) && Number(val) > 0, {
      message: 'Transfer amount must be a positive number greater than 0',
    }),
  currency: z.string().optional().default('USD'),
  client_notes: z.string().max(500).optional().nullable(),
});

export const ApproveAccountTransferSchema = z.object({
  admin_notes: z.string().max(500).optional().nullable(),
});

export const RejectAccountTransferSchema = z.object({
  rejection_reason: z.string().min(1, 'Rejection reason is required').max(500),
  admin_notes: z.string().max(500).optional().nullable(),
});

export type CreateAccountTransferInput = z.input<typeof CreateAccountTransferSchema>;
export type ApproveAccountTransferInput = z.infer<typeof ApproveAccountTransferSchema>;
export type RejectAccountTransferInput = z.infer<typeof RejectAccountTransferSchema>;

// Trading Account Registry Schemas (Strictly isolated from financial ledger)
export const RegisterTradingAccountSchema = z.object({
  platform: z.string().min(1, 'Trading platform is required').max(50),
  account_type: z.enum(['standard', 'raw_spread', 'pro', 'islamic']).default('standard'),
  currency: z.string().min(3).max(10).default('USD'),
  leverage: z.string().min(1).max(20).default('1:100'),
  nickname: z.string().max(100).optional().nullable(),
  is_demo: z.boolean().default(false),
  server_name: z.string().max(100).optional().nullable(),
});

export const LinkTradingAccountSchema = z.object({
  account_number: z
    .string()
    .min(4, 'Account number must be at least 4 characters')
    .max(50),
  platform: z.string().min(1, 'Trading platform is required').max(50),
  server_name: z.string().min(1, 'Trading server name is required').max(100),
  account_type: z.enum(['standard', 'raw_spread', 'pro', 'islamic']).default('standard'),
  currency: z.string().min(3).max(10).default('USD'),
  leverage: z.string().min(1).max(20).default('1:100'),
  nickname: z.string().max(100).optional().nullable(),
  investor_notes: z.string().max(500).optional().nullable(),
});

export const UpdateTradingAccountNicknameSchema = z.object({
  nickname: z.string().max(100).optional().nullable(),
});

export const RequestLeverageChangeSchema = z.object({
  requested_leverage: z.string().min(1).max(20),
  reason: z.string().max(300).optional().nullable(),
});

export const ApproveTradingAccountSchema = z.object({
  account_number: z.string().max(50).optional().nullable(),
  server_name: z.string().max(100).optional().nullable(),
  group_tier: z.string().max(100).optional().nullable(),
  admin_notes: z.string().max(500).optional().nullable(),
});

export const RejectTradingAccountSchema = z.object({
  rejection_reason: z.string().min(3, 'Rejection reason is required').max(500),
  admin_notes: z.string().max(500).optional().nullable(),
});

export const UpdateTradingAccountStatusSchema = z.object({
  status: z.enum(['pending_approval', 'active', 'read_only', 'disabled', 'archived']),
  admin_notes: z.string().max(500).optional().nullable(),
});

export const AdminUpdateTradingAccountMetadataSchema = z.object({
  account_number: z.string().min(3).max(50).optional(),
  password: z.string().min(1).max(100).optional().nullable(),
  platform: z.string().min(1).max(50).optional(),
  server_name: z.string().max(100).optional().nullable(),
  currency: z.string().min(3).max(10).optional(),
  leverage: z.string().max(20).optional(),
  balance: z.string().max(30).optional(),
  status: z.enum(['pending_approval', 'active', 'read_only', 'disabled', 'archived']).optional(),
  terminal_url: z.string().max(500).optional().nullable(),
  group_tier: z.string().max(100).optional().nullable(),
  account_type: z.enum(['standard', 'raw_spread', 'pro', 'islamic']).optional(),
  admin_notes: z.string().max(500).optional().nullable(),
  nickname: z.string().max(100).optional().nullable(),
});

export type RegisterTradingAccountInput = z.infer<typeof RegisterTradingAccountSchema>;
export type LinkTradingAccountInput = z.infer<typeof LinkTradingAccountSchema>;
export type UpdateTradingAccountNicknameInput = z.infer<typeof UpdateTradingAccountNicknameSchema>;
export type RequestLeverageChangeInput = z.infer<typeof RequestLeverageChangeSchema>;
export type ApproveTradingAccountInput = z.infer<typeof ApproveTradingAccountSchema>;
export type RejectTradingAccountInput = z.infer<typeof RejectTradingAccountSchema>;
export type UpdateTradingAccountStatusInput = z.infer<typeof UpdateTradingAccountStatusSchema>;
export type AdminUpdateTradingAccountMetadataInput = z.infer<typeof AdminUpdateTradingAccountMetadataSchema>;

// --- KYC Schemas ---
export const KycProfileSchema = z.object({
  first_name: z.string().trim().min(1, 'First name is required').max(100),
  last_name: z.string().trim().min(1, 'Last name is required').max(100),
  date_of_birth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date of birth must be YYYY-MM-DD format'),
  nationality: z.string().trim().min(2, 'Nationality is required').max(50),
  country: z.string().trim().min(2, 'Country is required').max(50),
  address_line1: z.string().trim().min(3, 'Address is required').max(255),
  address_line2: z.string().trim().max(255).optional().nullable(),
  city: z.string().trim().min(1, 'City is required').max(100),
  state_province: z.string().trim().max(100).optional().nullable(),
  postal_code: z.string().trim().min(2, 'Postal code is required').max(30),
  id_type: z.enum(['passport', 'national_id', 'drivers_license', 'residence_permit']),
  id_number: z.string().trim().min(3, 'ID number is required').max(100),
});

export const KycReviewSchema = z.object({
  status: z.enum(['approved', 'rejected', 'under_review']),
  rejection_reason: z.string().max(500).optional().nullable(),
  admin_notes: z.string().max(500).optional().nullable(),
});

export const KycDocumentUploadSchema = z.object({
  document_type: z.preprocess((val) => {
    if (typeof val !== 'string') return 'other';
    const v = val.toLowerCase().trim();
    if (v === 'national_id' || v === 'drivers_license') return 'id_front';
    return v;
  }, z.enum(['id_front', 'id_back', 'passport', 'proof_of_address', 'other'])),
  original_filename: z.string().min(1).max(255),
  mime_type: z.preprocess((val) => {
    if (typeof val === 'string' && ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'].includes(val)) {
      return val;
    }
    return val;
  }, z.enum(['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])),
  file_size: z.number().int().positive().max(10 * 1024 * 1024, 'Maximum document size is 10MB'),
  file_base64: z.string().min(1, 'File content is required'),
});

export type KycProfileInput = z.infer<typeof KycProfileSchema>;
export type KycReviewInput = z.infer<typeof KycReviewSchema>;
export type KycDocumentUploadInput = z.infer<typeof KycDocumentUploadSchema>;

// --- Support Ticket Schemas ---
export const CreateSupportTicketSchema = z.object({
  subject: z.string().trim().min(3, 'Subject must be at least 3 characters').max(255),
  category: z.preprocess((val) => {
    if (typeof val !== 'string') return 'general';
    const c = val.toLowerCase().trim();
    if (c === 'account' || c === 'other') return 'general';
    if (c === 'deposit' || c === 'withdrawal') return 'deposit_withdrawal';
    if (c === 'kyc') return 'verification_kyc';
    return c;
  }, z.enum(['general', 'deposit_withdrawal', 'trading', 'verification_kyc', 'technical'])).default('general'),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  message: z.string().trim().min(5, 'Message must be at least 5 characters').max(5000),
  attachments: z
    .array(
      z.object({
        original_filename: z.string().min(1).max(255),
        mime_type: z.preprocess((val) => {
          if (typeof val === 'string' && ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'].includes(val)) {
            return val;
          }
          return val;
        }, z.enum(['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])),
        file_size: z.number().int().positive().max(10 * 1024 * 1024),
        file_base64: z.string().min(1),
      })
    )
    .optional()
    .default([]),
});

export const ReplySupportTicketSchema = z.object({
  message: z.string().trim().min(1, 'Reply message cannot be empty').max(5000),
  is_internal: z.boolean().optional().default(false),
  attachments: z
    .array(
      z.object({
        original_filename: z.string().min(1).max(255),
        mime_type: z.preprocess((val) => {
          if (typeof val === 'string' && ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'].includes(val)) {
            return val;
          }
          return val;
        }, z.enum(['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])),
        file_size: z.number().int().positive().max(10 * 1024 * 1024),
        file_base64: z.string().min(1),
      })
    )
    .optional()
    .default([]),
});

export const UpdateTicketStatusSchema = z.object({
  status: z.enum(['open', 'in_progress', 'waiting_for_client', 'resolved', 'closed']),
  admin_notes: z.string().max(500).optional().nullable(),
});

export type CreateSupportTicketInput = z.infer<typeof CreateSupportTicketSchema>;
export type ReplySupportTicketInput = z.infer<typeof ReplySupportTicketSchema>;
export type UpdateTicketStatusInput = z.infer<typeof UpdateTicketStatusSchema>;


