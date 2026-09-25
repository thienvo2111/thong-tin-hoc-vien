import * as nodemailer from 'nodemailer';

// Nguồn SMTP dùng chung cho cả app. Ưu tiên biến môi trường SMTP_HOST/PORT/
// USER/PASS/FROM (xem .env.example) để dễ thay bằng SMTP provider thật khi
// triển khai — nếu KHÔNG có SMTP_HOST, tự tạo 1 tài khoản Ethereal
// (nodemailer.createTestAccount()) để dev/test cục bộ vẫn gửi/nhận thật được
// mà không cần thông tin đăng nhập SMTP thật. Chỉ tạo 1 lần cho cả tiến trình
// (singleton module-level) — Ethereal có giới hạn tốc độ tạo tài khoản, và
// test:e2e chạy --runInBand (1 tiến trình) nên toàn bộ các file *.e2e-spec.ts
// dùng chung 1 tài khoản Ethereal.
let transporterPromise: Promise<{
  transporter: nodemailer.Transporter;
  from: string;
}> | null = null;

export function getMailTransporter(): Promise<{
  transporter: nodemailer.Transporter;
  from: string;
}> {
  if (!transporterPromise) {
    transporterPromise = buildTransporter();
  }
  return transporterPromise;
}

// Chỉ dùng trong test: buộc tạo lại transporter ở lần gọi kế tiếp (vd. sau
// khi thay đổi biến môi trường SMTP_* giữa các test case).
export function resetMailTransporterForTest(): void {
  transporterPromise = null;
}

async function buildTransporter(): Promise<{
  transporter: nodemailer.Transporter;
  from: string;
}> {
  if (process.env.SMTP_HOST) {
    const from =
      process.env.SMTP_FROM ??
      process.env.SMTP_USER ??
      'no-reply@thongtinhocvien.local';
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: process.env.SMTP_SECURE === 'true',
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
    });
    return { transporter, from };
  }

  const testAccount = await nodemailer.createTestAccount();
  console.log(
    `[thong-bao] Không có cấu hình SMTP_HOST — dùng tài khoản Ethereal test: ${testAccount.user} (xem preview URL ở log mỗi lần gửi)`,
  );
  const transporter = nodemailer.createTransport({
    host: testAccount.smtp.host,
    port: testAccount.smtp.port,
    secure: testAccount.smtp.secure,
    auth: { user: testAccount.user, pass: testAccount.pass },
  });
  return { transporter, from: testAccount.user };
}

export { getTestMessageUrl } from 'nodemailer';
