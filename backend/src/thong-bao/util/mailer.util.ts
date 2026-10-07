import * as nodemailer from 'nodemailer';

// Nguồn SMTP dùng chung cho cả app. Ưu tiên biến môi trường SMTP_HOST/PORT/
// ACCOUNTS hoặc USER/PASS/FROM (xem .env.example) để dễ thay bằng SMTP provider thật khi
// triển khai — nếu KHÔNG có SMTP_HOST, tự tạo 1 tài khoản Ethereal
// (nodemailer.createTestAccount()) để dev/test cục bộ vẫn gửi/nhận thật được
// mà không cần thông tin đăng nhập SMTP thật. Chỉ tạo 1 lần cho cả tiến trình
// (singleton module-level) — Ethereal có giới hạn tốc độ tạo tài khoản, và
// test:e2e chạy --runInBand (1 tiến trình) nên toàn bộ các file *.e2e-spec.ts
// dùng chung 1 tài khoản Ethereal.
// 2026-10-07: XOAY VÒNG nhiều tài khoản gửi (SMTP_ACCOUNTS, xem .env.example)
// — 1 hộp thư Workspace chạm hạn mức ngày của Google (550 5.4.5) làm mọi email
// sau đó thất bại. Mỗi lần gửi lấy tài khoản kế tiếp (round-robin); tài khoản
// báo hết hạn mức thì NGHỈ 1 giờ (Google tính hạn mức theo 24h trượt nên hạn
// mức hồi dần — thử lại mỗi giờ tốn tối đa 1 lần lỗi/tài khoản) và thư được
// gửi lại ngay bằng tài khoản kế tiếp. Mọi tài khoản đều đang nghỉ ->
// HetHanMucGuiEmailError để hàng đợi giữ thư lại (không đốt lượt thử).
// Trạng thái nghỉ chỉ giữ trong bộ nhớ: khởi động lại = thử lại từ đầu, mỗi
// tài khoản tốn thêm tối đa 1 lần lỗi — chấp nhận, không cần bảng DB.
export const THOI_GIAN_NGHI_KHI_HET_HAN_MUC_MS = 60 * 60 * 1000;

export class HetHanMucGuiEmailError extends Error {
  constructor() {
    super('Mọi tài khoản gửi email đều đang hết hạn mức của Google');
    this.name = 'HetHanMucGuiEmailError';
  }
}

/** Lỗi "hết hạn mức gửi trong ngày" của Gmail/Workspace (550 5.4.5). */
export function laLoiHetHanMuc(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  return /5\.4\.5|sending limit exceeded/i.test(msg);
}

interface TaiKhoanGui {
  user: string | undefined;
  from: string;
  transporter: nodemailer.Transporter;
  nghiDen: number;
}

export interface ThuGui {
  to: string;
  subject: string;
  html: string;
}

let poolPromise: Promise<TaiKhoanGui[]> | null = null;
let conTro = 0;

function layPool(): Promise<TaiKhoanGui[]> {
  if (!poolPromise) poolPromise = buildPool();
  return poolPromise;
}

// Chỉ dùng trong test: buộc tạo lại danh sách tài khoản ở lần gọi kế tiếp
// (vd. sau khi thay đổi biến môi trường SMTP_* giữa các test case).
export function resetMailTransporterForTest(): void {
  poolPromise = null;
  conTro = 0;
}

/**
 * Gửi 1 thư, tự xoay vòng tài khoản. Trả về info của nodemailer (dùng cho
 * getTestMessageUrl) + tài khoản đã gửi. Lỗi khác "hết hạn mức" (sai địa chỉ,
 * mất kết nối...) ném ra nguyên trạng — không đổi tài khoản.
 */
export async function guiEmail(
  thu: ThuGui,
): Promise<{ info: nodemailer.SentMessageInfo; taiKhoan: string | undefined }> {
  const pool = await layPool();
  const replyTo = process.env.SMTP_REPLY_TO || undefined;
  for (let i = 0; i < pool.length; i++) {
    const tk = pool[(conTro + i) % pool.length];
    if (tk.nghiDen > Date.now()) continue;
    try {
      const info = await tk.transporter.sendMail({
        ...thu,
        from: tk.from,
        replyTo,
      });
      conTro = (conTro + i + 1) % pool.length;
      return { info, taiKhoan: tk.user };
    } catch (e) {
      if (!laLoiHetHanMuc(e)) throw e;
      tk.nghiDen = Date.now() + THOI_GIAN_NGHI_KHI_HET_HAN_MUC_MS;
      console.warn(
        `[mailer] Tài khoản ${tk.user ?? '(không tên)'} hết hạn mức Google — nghỉ 1 giờ, chuyển tài khoản kế tiếp`,
      );
    }
  }
  throw new HetHanMucGuiEmailError();
}

// SMTP_ACCOUNTS="user1:pass1,user2:pass2" — tách ở dấu ":" ĐẦU TIÊN nên mật
// khẩu ứng dụng (16 chữ, có thể có dấu cách) dùng nguyên được. Trống ->
// 1 tài khoản SMTP_USER/SMTP_PASS như trước (tương thích cấu hình cũ).
export function docDanhSachTaiKhoan(): { user: string; pass: string }[] {
  return (process.env.SMTP_ACCOUNTS ?? '')
    .split(',')
    .map((muc) => muc.trim())
    .filter(Boolean)
    .map((muc) => {
      const i = muc.indexOf(':');
      if (i <= 0) {
        throw new Error(
          `SMTP_ACCOUNTS sai định dạng (cần user:matkhau): "${muc.split(':')[0]}"`,
        );
      }
      return { user: muc.slice(0, i).trim(), pass: muc.slice(i + 1).trim() };
    });
}

function taoTransporterSmtp(auth?: { user: string; pass?: string }) {
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth,
  });
  transporter.use('compile', chanDiaChiKhongGiaoDuoc);
  return transporter;
}

async function buildPool(): Promise<TaiKhoanGui[]> {
  if (process.env.SMTP_HOST) {
    const ds = docDanhSachTaiKhoan();
    if (ds.length > 0) {
      // Gmail ghi đè From bằng tài khoản đăng nhập -> mỗi tài khoản gửi bằng
      // chính địa chỉ của nó, chung 1 tên hiển thị để người nhận thấy nhất quán.
      const ten = process.env.SMTP_FROM_NAME;
      console.log(`[mailer] Xoay vòng ${ds.length} tài khoản gửi email`);
      return ds.map(({ user, pass }) => ({
        user,
        from: ten ? `"${ten}" <${user}>` : user,
        transporter: taoTransporterSmtp({ user, pass }),
        nghiDen: 0,
      }));
    }
    const user = process.env.SMTP_USER;
    return [
      {
        user,
        from: process.env.SMTP_FROM ?? user ?? 'no-reply@thongtinhocvien.local',
        transporter: taoTransporterSmtp(
          user ? { user, pass: process.env.SMTP_PASS } : undefined,
        ),
        nghiDen: 0,
      },
    ];
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
  return [
    { user: testAccount.user, from: testAccount.user, transporter, nghiDen: 0 },
  ];
}

export { getTestMessageUrl } from 'nodemailer';

// Tên miền dành riêng (RFC 2606/6761) — không bao giờ nhận được thư. e2e dùng
// CHUNG DB với backend dev nên dòng hang_doi_email tạo bởi test (vd.
// e2e-truong-xxx@test.local) bị cron của backend dev gửi qua Gmail thật ->
// bị trả về hàng loạt, tốn hạn mức và giảm uy tín tài khoản gửi. Chỉ gắn vào
// nhánh SMTP thật; Ethereal vẫn nhận mọi địa chỉ để e2e kiểm tra được.
const TEN_MIEN_DANH_RIENG = /\.(local|test|example|invalid|localhost)$/i;

export function laDiaChiKhongGiaoDuoc(email: string): boolean {
  const tenMien = email.trim().replace(/>$/, '').split('@').pop() ?? '';
  return TEN_MIEN_DANH_RIENG.test(tenMien);
}

function layDiaChi(nguoiNhan: unknown): string[] {
  if (Array.isArray(nguoiNhan)) return nguoiNhan.flatMap(layDiaChi);
  if (typeof nguoiNhan === 'string') return nguoiNhan.split(',');
  if (nguoiNhan && typeof nguoiNhan === 'object' && 'address' in nguoiNhan) {
    return [String((nguoiNhan as { address: unknown }).address)];
  }
  return [];
}

function chanDiaChiKhongGiaoDuoc(
  mail: { data: { to?: unknown } },
  callback: (err?: Error | null) => void,
): void {
  const diaChi = layDiaChi(mail.data.to);
  const bad = diaChi.find(laDiaChiKhongGiaoDuoc);
  callback(
    bad
      ? new Error(
          `Không gửi tới tên miền dành riêng (không có thật): ${bad.trim()}`,
        )
      : null,
  );
}
