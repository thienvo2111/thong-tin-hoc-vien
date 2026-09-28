import { randomUUID } from 'crypto';
import { PrismaClient, vai_tro_nguoi_dung } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

// Chạy thẳng trên Postgres cục bộ (docker compose ở gốc repo) — không mock —
// theo đúng yêu cầu "e2e ... using the already-running Postgres".
export const prisma = new PrismaClient();

export function uniqueSuffix(): string {
  return randomUUID().slice(0, 8);
}

export async function taoDonViTest(prefix: string) {
  const suf = uniqueSuffix();
  const diaDanhTinh = await prisma.dia_danh.create({
    data: {
      ma: `T-${prefix}-${suf}`,
      ten: `Tỉnh test ${suf}`,
      cap: 'tinh_thanh',
    },
  });
  const diaDanhXa = await prisma.dia_danh.create({
    data: {
      ma: `X-${prefix}-${suf}`,
      ten: `Xã test ${suf}`,
      cap: 'phuong_xa_dac_khu',
      parent_id: diaDanhTinh.id,
    },
  });
  const donVi = await prisma.don_vi_cong_tac.create({
    data: {
      ma_don_vi: `DV-${prefix}-${suf}`,
      ten_don_vi: `Đơn vị test ${suf}`,
      loai_don_vi: 'truong',
      dia_ban_id: diaDanhXa.id,
    },
  });
  return { diaDanhTinh, diaDanhXa, donVi };
}

export async function taoNguoiDungTest(params: {
  vai_tro: vai_tro_nguoi_dung;
  don_vi_id: string;
  mat_khau: string;
}) {
  const suf = uniqueSuffix();
  const ten_dang_nhap = `e2e-${params.vai_tro}-${suf}@test.local`;
  // salt rounds thấp trong test để bcrypt không làm chậm suite — không dùng
  // giá trị này ở seed/production (auth.service.ts dùng 10).
  const mat_khau_hash = await bcrypt.hash(params.mat_khau, 4);
  const nguoiDung = await prisma.nguoi_dung.create({
    data: {
      ho_ten: `E2E ${params.vai_tro} ${suf}`,
      ten_dang_nhap,
      email: ten_dang_nhap,
      vai_tro: params.vai_tro,
      don_vi_id: params.don_vi_id,
      mat_khau_hash,
      phai_doi_mat_khau: false,
    },
  });
  return { nguoiDung, mat_khau: params.mat_khau, ten_dang_nhap };
}

export async function xoaNguoiDungTest(id: string) {
  // token_thu_hoi.nguoi_dung_id -> nguoi_dung(id) không có ON DELETE CASCADE
  // (xem docs/database-ddl.sql) — dọn trước để test POST /auth/dang-xuat
  // (ghi token_thu_hoi) không làm vỡ FK ở bước cleanup chung này.
  await prisma.token_thu_hoi.deleteMany({ where: { nguoi_dung_id: id } });
  await prisma.nguoi_dung.deleteMany({ where: { id } });
}

export async function xoaDonViTest(donViIds: string[], diaDanhIds: string[]) {
  await prisma.don_vi_cong_tac.deleteMany({ where: { id: { in: donViIds } } });
  await prisma.dia_danh.deleteMany({ where: { id: { in: diaDanhIds } } });
}

// T14: đợt xác nhận scope TOÀN CỤC (khoa_id=NULL, đúng kịch bản P0 —
// mo-rong-nls-an-giang.md mục 3 "Rút gọn để kịp P0") mở rộng (1 giờ trước ->
// 1 giờ sau `now`) để mọi test PATCH /hoc-vien/toi cho hồ sơ import_moet
// chạy được trong cửa sổ này. LUÔN dọn bằng xoaDotXacNhanTest() ở afterAll
// của MỖI file tạo ra nó — vì scope NULL là TOÀN CỤC, để sót sẽ ảnh hưởng
// các file e2e khác chạy sau trong cùng lượt (jest --runInBand chạy tuần
// tự nên không lo chồng NGANG giữa các file, chỉ cần dọn đúng trước khi file
// tiếp theo bắt đầu).
export async function taoDotXacNhanTest(
  overrides: Partial<{
    loai: 'kiem_tra_bo_sung' | 'xac_nhan_truoc_danh_gia';
    khoa_id: string | null;
    mo_luc: Date;
    dong_luc: Date;
  }> = {},
) {
  const suf = uniqueSuffix();
  const now = new Date();
  return prisma.dot_xac_nhan.create({
    data: {
      ten: `Đợt test ${suf}`,
      loai: overrides.loai ?? 'kiem_tra_bo_sung',
      khoa_id: overrides.khoa_id ?? null,
      mo_luc: overrides.mo_luc ?? new Date(now.getTime() - 60 * 60 * 1000),
      dong_luc: overrides.dong_luc ?? new Date(now.getTime() + 60 * 60 * 1000),
    },
  });
}

export async function xoaDotXacNhanTest(dotIds: string[]) {
  if (dotIds.length === 0) return;
  // lich_su_thay_doi_ho_so.dot_id KHÔNG có ON DELETE CASCADE (nullable, chỉ
  // để audit "sửa trong đợt nào") -> dọn trước để không vỡ FK. xac_nhan_ho_so
  // CÓ CASCADE (xóa dot_xac_nhan tự xóa theo) nên không cần dọn riêng.
  await prisma.lich_su_thay_doi_ho_so.deleteMany({
    where: { dot_id: { in: dotIds } },
  });
  await prisma.dot_xac_nhan.deleteMany({ where: { id: { in: dotIds } } });
}
