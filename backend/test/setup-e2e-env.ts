// Chạy TRƯỚC mọi file e2e (setupFiles trong jest-e2e.json): để trống
// SMTP_HOST để mailer.util dùng Ethereal thay vì SMTP thật trong .env —
// ConfigModule.forRoot KHÔNG ghi đè biến đã có trong process.env, kể cả chuỗi
// rỗng, nên giá trị này thắng .env.
process.env.SMTP_HOST = '';
