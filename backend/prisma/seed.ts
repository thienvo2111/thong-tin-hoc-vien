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

// DB CHECK `chk_nguoi_dung_scope` (database-ddl.sql) bắt buộc don_vi_id
// NOT NULL cho MỌI vai_tro <> 'hoc_vien', kể cả quan_tri — dù scope của
// quan_tri là toàn hệ thống, không phụ thuộc đơn vị nào (xem ScopeService).
// Đây là điểm chưa khớp hoàn toàn giữa spec (quan_tri = "toàn hệ thống",
// không đơn vị cụ thể) và constraint DB hiện có — flag lại, không tự sửa
// schema/migration ở lượt này. Workaround: tạo 1 don_vi_cong_tac gốc dùng
// riêng cho việc seed, để thỏa constraint mà không ảnh hưởng danh mục thật.
async function layHoacTaoDonViSeed(): Promise<string> {
  const maDonViSeed = 'SEED-QUANTRI';
  const existing = await prisma.don_vi_cong_tac.findUnique({
    where: { ma_don_vi: maDonViSeed },
  });
  if (existing) return existing.id;

  const maDiaDanhSeed = 'SEED';
  let diaDanh = await prisma.dia_danh.findUnique({
    where: { ma: maDiaDanhSeed },
  });
  if (!diaDanh) {
    diaDanh = await prisma.dia_danh.create({
      data: {
        ma: maDiaDanhSeed,
        ten: '(Địa danh seed — chưa cấu hình)',
        cap: 'tinh_thanh',
      },
    });
  }

  const donVi = await prisma.don_vi_cong_tac.create({
    data: {
      ma_don_vi: maDonViSeed,
      ten_don_vi: 'Đơn vị gốc cho tài khoản quan_tri (seed)',
      loai_don_vi: 'khac',
      dia_ban_id: diaDanh.id,
    },
  });
  return donVi.id;
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
  const donViId = await layHoacTaoDonViSeed();

  await prisma.nguoi_dung.create({
    data: {
      ho_ten: 'Quản trị hệ thống',
      ten_dang_nhap: tenDangNhap,
      email,
      don_vi_id: donViId,
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
