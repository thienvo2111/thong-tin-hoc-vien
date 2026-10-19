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
  /**
   * Spec đổi buổi (R7): dòng ở buổi chốt của đổi buổi đã duyệt, còn hiệu lực —
   * tính THAY buổi nguồn (lớp, giai đoạn, buổi số của buổi nguồn).
   */
  doi_tu?: { lop_id: string; giai_doan_id: string; buoi_so: number };
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
  for (const goc of dong) {
    const d = goc.doi_tu ? { ...goc, ...goc.doi_tu } : goc;
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

/** phan_lop_giai_doan → dang_ky_hoc_id → (giai_doan_id → lop_id hiện tại). */
export function lopHienTaiTheoDangKy(
  phanLop: readonly {
    dang_ky_hoc_id: string;
    giai_doan_id: string;
    lop_id: string;
  }[],
): Map<string, Map<string, string>> {
  const kq = new Map<string, Map<string, string>>();
  for (const p of phanLop) {
    const m = kq.get(p.dang_ky_hoc_id) ?? new Map<string, string>();
    m.set(p.giai_doan_id, p.lop_id);
    kq.set(p.dang_ky_hoc_id, m);
  }
  return kq;
}

/** Dòng diem_danh (kèm buổi) → đầu vào tinhChuyenCan; doiTu theo `${dang_ky_hoc_id}|${lich_hoc_id}`. */
export function dongDiemDanhBuoi(
  d: {
    dang_ky_hoc_id: string;
    lich_hoc_id: string;
    trang_thai: TrangThaiDiemDanh;
    lich_hoc: {
      lop_id: string;
      giai_doan_id: string;
      buoi_so: number;
      lop: { loai_lop: string };
    };
  },
  doiTu: ReadonlyMap<string, DongDiemDanhBuoi['doi_tu']>,
): DongDiemDanhBuoi {
  return {
    lop_id: d.lich_hoc.lop_id,
    loai_lop: d.lich_hoc.lop.loai_lop,
    giai_doan_id: d.lich_hoc.giai_doan_id,
    buoi_so: d.lich_hoc.buoi_so,
    trang_thai: d.trang_thai,
    doi_tu: doiTu.get(`${d.dang_ky_hoc_id}|${d.lich_hoc_id}`),
  };
}

/**
 * Dòng gốc mà tinhChuyenCan đã chọn cho khóa k (để lấy nhãn/lớp của dòng):
 * dòng ĐẦU TIÊN cùng khóa, cùng lớp (sau doi_tu) và cùng trạng thái — đúng
 * dòng mà vòng lặp của tinhChuyenCan giữ lại khi hòa.
 */
export function dongDuocChon<D extends DongDiemDanhBuoi>(
  dong: readonly D[],
  k: string,
  kq: KetQuaBuoi,
): D | undefined {
  return dong.find((goc) => {
    const d = goc.doi_tu ? { ...goc, ...goc.doi_tu } : goc;
    return (
      khoaBuoi(d.giai_doan_id, d.buoi_so) === k &&
      d.lop_id === kq.lop_id &&
      d.trang_thai === kq.trang_thai
    );
  });
}
