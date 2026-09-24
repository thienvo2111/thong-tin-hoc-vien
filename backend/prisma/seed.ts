// Seed dev/test cục bộ: tạo 1 tài khoản quan_tri.
//
// Chưa có luồng tự cấp tài khoản Sở/Phòng VHXH/Trường/QuảnTrị (chỉ Học viên
// tự đăng ký, xem memory dự án) — quan_tri đầu tiên phải được tạo thủ công
// bằng script này để có tài khoản đăng nhập, quản lý danh mục và chạy import.
//
// Chạy: npx prisma db seed  (hoặc npm run seed)
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';

const prisma = new PrismaClient();
const BCRYPT_SALT_ROUNDS = 10;

function sinhMatKhauNgauNhien(): string {
  return crypto.randomBytes(12).toString('base64url');
}

async function main() {
  const tenDangNhap =
    process.env.SEED_QUAN_TRI_TEN_DANG_NHAP ?? 'quantri@thongtinhocvien.local';
  const email = process.env.SEED_QUAN_TRI_EMAIL ?? tenDangNhap;

  const daTonTai = await prisma.nguoi_dung.findUnique({
    where: { ten_dang_nhap: tenDangNhap },
  });
  if (daTonTai) {
    console.log(
      `[seed] Tài khoản quan_tri "${tenDangNhap}" đã tồn tại — bỏ qua, không tạo lại.`,
    );
    return;
  }

  const matKhauTuEnv = process.env.SEED_QUAN_TRI_MAT_KHAU?.trim();
  const matKhau =
    matKhauTuEnv && matKhauTuEnv.length > 0
      ? matKhauTuEnv
      : sinhMatKhauNgauNhien();
  const matKhauHash = await bcrypt.hash(matKhau, BCRYPT_SALT_ROUNDS);

  await prisma.nguoi_dung.create({
    data: {
      ho_ten: 'Quản trị hệ thống',
      ten_dang_nhap: tenDangNhap,
      email,
      don_vi_id: null,
      vai_tro: 'quan_tri',
      mat_khau_hash: matKhauHash,
      phai_doi_mat_khau: true,
    },
  });

  console.log('[seed] Đã tạo tài khoản quan_tri:');
  console.log(`  ten_dang_nhap: ${tenDangNhap}`);
  if (!matKhauTuEnv) {
    console.log(`  mat_khau (tự sinh, chỉ hiện lần này): ${matKhau}`);
    console.log(
      '  -> Đổi mật khẩu qua POST /auth/doi-mat-khau ngay sau khi đăng nhập lần đầu.',
    );
  } else {
    console.log('  mat_khau: lấy từ SEED_QUAN_TRI_MAT_KHAU trong .env');
  }
}

main()
  .catch((err) => {
    console.error('[seed] Lỗi khi seed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
