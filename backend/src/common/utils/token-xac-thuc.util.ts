import { createHash, randomBytes } from 'crypto';

// Token dùng 1 lần cho xác minh email liên hệ & quên/đặt lại mật khẩu — CỐ Ý
// KHÔNG dùng JWT (không thu hồi/vô hiệu hóa sớm được, xem ghi chú token_thu_hoi
// trong schema.prisma cho lý do tương tự với token đăng nhập). Token gốc
// (32 byte ngẫu nhiên, hex) chỉ tồn tại trong email gửi đi — DB chỉ lưu
// token_hash (SHA-256 hex) để tra cứu, không bao giờ lưu bản rõ.
export function taoTokenXacThuc(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString('hex');
  return { token, tokenHash: hashTokenXacThuc(token) };
}

export function hashTokenXacThuc(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

// FRONTEND_URL (mới, .env.example) dùng để dựng link trong email xác minh/đặt
// lại mật khẩu — mặc định trùng CORS_ORIGIN dev để không chặn chạy cục bộ khi
// thiếu biến này.
export function layFrontendUrl(): string {
  return process.env.FRONTEND_URL ?? 'http://localhost:5173';
}
