// ADR 0005 Z8 (issue #27): chuyên cần của 1 đăng ký theo (giai_doan, buoi_so)
// — hàm DUY NHẤT dùng cho dashboard và trang lớp học viên. Chuyển lớp không
// xóa điểm danh lớp cũ; chế độ theo khóa quyết định có tính lớp cũ hay không.

import { TrangThaiDiemDanh } from './diem-danh-bao-vang.util';

export type CheDoChuyenCan = 'theo_lop_hien_tai' | 'cong_nhan_lop_cu';

export interface DongDiemDanhBuoi {
  lop_id: string;
  loai_lop: string;
  giai_doan_id: string;
  buoi_so: number;
  trang_thai: TrangThaiDiemDanh;
}

export interface KetQuaBuoi {
  trang_thai: TrangThaiDiemDanh;
  lop_id: string;
  tu_lop_cu: boolean;
}

const HANG: Record<TrangThaiDiemDanh, number> = {
  co_mat: 3,
  vang_co_phep: 2,
  vang: 1,
};

export const khoaBuoi = (giaiDoanId: string, buoiSo: number) =>
  `${giaiDoanId}|${buoiSo}`;

/**
 * lopHienTai: giai_doan_id → lop_id hiện tại (phan_lop_giai_doan) của đăng ký.
 * Trả map khoaBuoi(giai_doan_id, buoi_so) → kết quả; buổi không có dòng hợp lệ
 * thì không có khóa.
 */
export function tinhChuyenCan(
  lopHienTai: ReadonlyMap<string, string>,
  dong: readonly DongDiemDanhBuoi[],
  cheDo: CheDoChuyenCan,
): Map<string, KetQuaBuoi> {
  const kq = new Map<string, KetQuaBuoi>();
  for (const d of dong) {
    const hienTai = lopHienTai.get(d.giai_doan_id);
    const tuLopCu = d.lop_id !== hienTai;
    // Z8 chỉ áp cho lớp Zoom: dòng trực tiếp (vd học bù) luôn tính như trước.
    const tinh =
      d.loai_lop === 'truc_tiep' || cheDo === 'cong_nhan_lop_cu' || !tuLopCu;
    if (!tinh) continue;
    const k = khoaBuoi(d.giai_doan_id, d.buoi_so);
    const cu = kq.get(k);
    // Hòa hạng: ưu tiên dòng của lớp hiện tại.
    const tot =
      !cu ||
      HANG[d.trang_thai] > HANG[cu.trang_thai] ||
      (HANG[d.trang_thai] === HANG[cu.trang_thai] && cu.tu_lop_cu && !tuLopCu);
    if (tot) {
      kq.set(k, {
        trang_thai: d.trang_thai,
        lop_id: d.lop_id,
        tu_lop_cu: tuLopCu,
      });
    }
  }
  return kq;
}
