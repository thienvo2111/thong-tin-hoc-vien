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
  await prisma.nguoi_dung.deleteMany({ where: { id } });
}

export async function xoaDonViTest(donViIds: string[], diaDanhIds: string[]) {
  await prisma.don_vi_cong_tac.deleteMany({ where: { id: { in: donViIds } } });
  await prisma.dia_danh.deleteMany({ where: { id: { in: diaDanhIds } } });
}
