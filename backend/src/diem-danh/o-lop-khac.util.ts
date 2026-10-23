import { TrangThaiDiemDanh } from '../common/utils/diem-danh-bao-vang.util';
import { khoaBuoi } from '../common/utils/chuyen-can.util';
import { KetQuaChuyenCanSlot } from '../doi-buoi-hoc/nap-chuyen-can';
import { nhanCoKetQua } from '../ho-tro-hoc-vien/diem-danh-lop-buoi.util';

// ADR 0014 (bổ sung): bảng điểm danh lớp và trang lớp hiện buổi được công
// nhận từ lớp khác (lớp cũ trước khi chuyển / học bù) theo tinhChuyenCan —
// chỉ đọc, không ghi đè dòng của lớp cũ. Nấc theo_lop_hien_tai với lớp Zoom
// không cho kết quả nên không hiện; lớp trực tiếp luôn tính.

export interface OLopKhac {
  trang_thai: TrangThaiDiemDanh;
  /** Nhãn như ADR 0010 T7: "Có mặt – ở lớp X" / "Vắng có phép – ở lớp X". */
  nhan: string;
  nguon: string;
  ghi_chu: null;
  cap_nhat_luc: null;
  nguoi_sua: null;
  tu_diem_danh_luc: Date | null;
  nguon_tinh: 'lop_khac';
  lop_tinh: { id: string; ten_lop: string };
  sua_duoc: false;
}

/**
 * lich_hoc_id → ô lớp khác, cho các buổi của lớp đang xem mà học viên chưa
 * có ô (coO trả true = đã có dòng tại buổi hoặc có đổi buổi ở buổi đó).
 */
export function oLopKhacTheoBuoi(
  buoi: readonly { id: string; giai_doan_id: string; buoi_so: number }[],
  ketQua: ReadonlyMap<string, KetQuaChuyenCanSlot> | undefined,
  coO: (lichHocId: string) => boolean,
): Record<string, OLopKhac> {
  const kq: Record<string, OLopKhac> = {};
  if (!ketQua) return kq;
  for (const b of buoi) {
    if (coO(b.id)) continue;
    const r = ketQua.get(khoaBuoi(b.giai_doan_id, b.buoi_so));
    if (!r?.tu_lop_cu) continue;
    kq[b.id] = {
      trang_thai: r.trang_thai,
      nhan: nhanCoKetQua(r),
      nguon: r.dong.nguon,
      ghi_chu: null,
      cap_nhat_luc: null,
      nguoi_sua: null,
      tu_diem_danh_luc: r.dong.tu_diem_danh_luc,
      nguon_tinh: 'lop_khac',
      lop_tinh: { id: r.dong.lop_id, ten_lop: r.dong.ten_lop },
      sua_duoc: false,
    };
  }
  return kq;
}
