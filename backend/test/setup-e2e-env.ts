// Chạy TRƯỚC mọi file e2e (setupFiles trong jest-e2e.json).
//
// Nạp backend/.env.test (nếu có) với override: true để e2e chạy trên DB
// riêng thong_tin_hoc_vien_test, không đụng DB dev thong_tin_hoc_vien_ddh
// trong backend/.env — ConfigModule.forRoot KHÔNG ghi đè biến process.env đã
// có, nên phải override ở đây, trước khi Nest khởi động.
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

const envTestPath = path.resolve(__dirname, '../.env.test');
if (fs.existsSync(envTestPath)) {
  dotenv.config({ path: envTestPath, override: true });
}

// Để trống SMTP_HOST để mailer.util dùng Ethereal thay vì SMTP thật trong
// .env/.env.test — ConfigModule.forRoot KHÔNG ghi đè biến đã có trong
// process.env, kể cả chuỗi rỗng, nên giá trị này thắng.
process.env.SMTP_HOST = '';
