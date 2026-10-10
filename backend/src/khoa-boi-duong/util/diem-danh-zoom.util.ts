import { loai_lop_hoc, trang_thai_diem_danh } from '@prisma/client';
import { PhaDiemDanh, tinhCuaSoDiemDanh } from './cua-so-diem-danh.util';

type KhoaDiemDanhZoom = {
  bat_diem_danh_zoom_luc: Date | null;
  diem_danh_mo_truoc_phut: number;
  diem_danh_dong_sau_phut: number;
};

// ADR 0005 Z1/Z4 (issue #24): buổi "áp dụng" tự điểm danh khi lớp là Zoom và
// khóa đã bật. Không áp dụng -> mọi hành vi giữ như cũ.
export function apDungDiemDanhZoom(
  lop: { loai_lop: loai_lop_hoc },
  khoa: { bat_diem_danh_zoom_luc: Date | null },
): boolean {
  return lop.loai_lop === 'zoom' && khoa.bat_diem_danh_zoom_luc != null;
}

export interface DiemDanhZoomCuaBuoi {
  co_link: boolean;
  mo: Date;
  dong: Date;
  pha: PhaDiemDanh;
  trang_thai: trang_thai_diem_danh | null;
  tu_diem_danh_luc: Date | null;
}

// Thông tin điểm danh Zoom trả cho học viên ở trang lớp — thay cho link buổi.
export function diemDanhZoomCuaBuoi(
  buoi: { thoi_gian_bat_dau: Date; dia_diem_hoac_link: string | null },
  khoa: KhoaDiemDanhZoom,
  diemDanh: {
    trang_thai: trang_thai_diem_danh;
    tu_diem_danh_luc: Date | null;
  } | null,
  now: Date,
): DiemDanhZoomCuaBuoi {
  const { mo, dong, pha } = tinhCuaSoDiemDanh(buoi, khoa, now);
  return {
    co_link: !!buoi.dia_diem_hoac_link?.trim(),
    mo,
    dong,
    pha,
    trang_thai: diemDanh?.trang_thai ?? null,
    tu_diem_danh_luc: diemDanh?.tu_diem_danh_luc ?? null,
  };
}

// GET /khoa-boi-duong/:id với học viên: giai đoạn có buổi của lớp Zoom (khóa
// đã bật) -> không trả link chung của giai đoạn (link buổi giấu ở nơi gọi).
export function giauLinkZoomCuaKhoa<
  GD extends { id: string; link_hoac_dia_diem: string | null },
>(khoa: {
  bat_diem_danh_zoom_luc: Date | null;
  giai_doan: GD[];
  lop_hoc: { loai_lop: loai_lop_hoc; lich_hoc: { giai_doan_id: string }[] }[];
}): { giai_doan: GD[] } {
  const gdZoom = new Set(
    khoa.lop_hoc
      .filter((l) => apDungDiemDanhZoom(l, khoa))
      .flatMap((l) => l.lich_hoc.map((b) => b.giai_doan_id)),
  );
  return {
    giai_doan: khoa.giai_doan.map((gd) =>
      gdZoom.has(gd.id) ? { ...gd, link_hoac_dia_diem: null } : gd,
    ),
  };
}
