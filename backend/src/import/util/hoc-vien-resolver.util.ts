import { hoc_vien } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

// "Bộ giải định danh học viên dùng chung" (mo-rong-nls-an-giang.md mục 2,
// quy tắc chung #3) — dùng cho mọi import có cột học viên: nhận
// so_dinh_danh_ca_nhan và/hoặc ma_dinh_danh_moet; phải có ít nhất 1; nếu có
// cả 2 thì phải trỏ cùng một hồ sơ, không thì là dòng lỗi. T15 (import
// tai_khoan_vle) dùng resolver này đầu tiên; T3 (khoa-boi-duong.service.ts
// #resolvePhanLopRow) retrofit phan_lop_hoc_vien sang dùng chung ở đây —
// trước đó chỉ tra theo so_dinh_danh_ca_nhan, khiến học viên import_moet
// chưa có CCCD (đa số, xem T4) không ghi danh được (QĐ1).
export interface HocVienResolverInput {
  so_dinh_danh_ca_nhan?: string;
  ma_dinh_danh_moet?: string;
}

export interface HocVienResolverResult {
  hocVien?: hoc_vien;
  error?: string;
}

export async function resolveHocVienImportRow(
  prisma: PrismaService,
  raw: HocVienResolverInput,
): Promise<HocVienResolverResult> {
  const sdd = raw.so_dinh_danh_ca_nhan?.trim() || undefined;
  const maMoet = raw.ma_dinh_danh_moet?.trim() || undefined;
  if (!sdd && !maMoet) {
    return {
      error:
        'Phải có ít nhất 1 trong 2 cột "so_dinh_danh_ca_nhan"/"ma_dinh_danh_moet"',
    };
  }

  let bySdd: hoc_vien | null = null;
  let byMoet: hoc_vien | null = null;

  if (sdd) {
    bySdd = await prisma.hoc_vien.findUnique({
      where: { so_dinh_danh_ca_nhan: sdd },
    });
    if (!bySdd) {
      return {
        error: `Số định danh cá nhân "${sdd}" không tồn tại (chưa có hồ sơ học viên)`,
      };
    }
  }
  if (maMoet) {
    byMoet = await prisma.hoc_vien.findUnique({
      where: { ma_dinh_danh_moet: maMoet },
    });
    if (!byMoet) {
      return {
        error: `Mã định danh MOET "${maMoet}" không tồn tại (chưa có hồ sơ học viên)`,
      };
    }
  }
  if (bySdd && byMoet && bySdd.id !== byMoet.id) {
    return {
      error: `so_dinh_danh_ca_nhan "${sdd}" và ma_dinh_danh_moet "${maMoet}" trỏ tới 2 hồ sơ học viên khác nhau`,
    };
  }

  return { hocVien: (bySdd ?? byMoet) as hoc_vien };
}
