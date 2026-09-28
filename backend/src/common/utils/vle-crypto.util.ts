import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'crypto';

// T15 (mo-rong-nls-an-giang.md): mã hóa mat_khau_tam (tài khoản VLE) ở tầng
// ứng dụng trước khi lưu bytea — DB không bao giờ chứa mật khẩu dạng rõ.
// AES-256-GCM: IV ngẫu nhiên 12 byte MỖI LẦN mã hóa (không tái sử dụng IV
// với cùng 1 khóa — bắt buộc với GCM), auth tag 16 byte xác thực toàn vẹn.
// Lưu gộp [iv(12)][tag(16)][ciphertext] trong 1 cột bytea — không cần bảng
///cột phụ.
//
// VLE_SECRET_KEY (env, xem .env.example) là 1 chuỗi bất kỳ (không bắt buộc
// đúng 32 byte) — băm SHA-256 để luôn ra đúng 32 byte cho AES-256, cùng cách
// làm với JWT_SECRET (auth.module.ts) có giá trị dev mặc định không an toàn
// để không chặn chạy dev cục bộ khi thiếu biến môi trường; BẮT BUỘC đặt giá
// trị riêng khi triển khai thật.
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

function getKey(): Buffer {
  const secret =
    process.env.VLE_SECRET_KEY ?? 'dev-only-insecure-vle-secret-key';
  return createHash('sha256').update(secret).digest();
}

export function encryptVleMatKhau(plainText: string): Buffer {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, getKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(plainText, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ciphertext]);
}

// data: Uint8Array (không chỉ Buffer) — Prisma Client trả cột Bytes? dưới
// dạng Uint8Array<ArrayBuffer>, không phải Buffer (Buffer chỉ là 1 subtype).
export function decryptVleMatKhau(data: Uint8Array): string {
  const iv = data.subarray(0, IV_LENGTH);
  const tag = data.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const ciphertext = data.subarray(IV_LENGTH + TAG_LENGTH);
  const decipher = createDecipheriv(ALGORITHM, getKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString('utf8');
}
