// Issue #64 / ADR 0015 S5, X4: quy tắc Phần 3–4 hợp đồng — bản sao của
// backend/src/cong-don-vi/quy-tac-hop-dong.ts (NGUONG_PHAN_4, canPhan4, kiemTraPhan3: cùng giới hạn, cùng thông điệp).
// Điều kiện Nộp (lyDoChanNop) chỉ tính ở backend — giao diện hiện ly_do_chan từ API.
// Sửa ở đây thì sửa cả bên backend.
import { LOI_SDT, MAU_SDT, TOI_DA_TEXT, TOI_DA_TEXTAREA, chuanHoaChuoi, loiDoDai } from './hoSoDonVi';

/** S5: giá trị từ 50.000.000 đ (không cộng thuế GTGT) bắt buộc Phần 4. */
export const NGUONG_PHAN_4 = 50_000_000;

export function canPhan4(giaTri: number | null): boolean {
  return giaTri !== null && giaTri >= NGUONG_PHAN_4;
}

/** Phần 3 (người nhận bản giấy) + Phần 4 (QĐ chỉ định thầu) — các ô chữ lưu nháp được. */
export const TRUONG_NHAP_HOP_DONG = [
  'nguoi_nhan',
  'sdt_nguoi_nhan',
  'dia_chi_nhan',
  'ghi_chu',
  'so_qd',
  'ngay_qd',
] as const;
export type TruongNhapHopDong = (typeof TRUONG_NHAP_HOP_DONG)[number];

/** Thân PUT: ô trống = null, ngày 'YYYY-MM-DD'. */
export type NhapHopDong = Record<TruongNhapHopDong, string | null> & { diem_hoc_truc_tiep: boolean };
export type NhapHopDongDauVao = Partial<Record<TruongNhapHopDong, string | null | undefined>> & {
  diem_hoc_truc_tiep?: boolean | null;
};

export const NHAN_TRUONG_HOP_DONG: Record<TruongNhapHopDong, string> = {
  nguoi_nhan: 'Người nhận bản giấy hợp đồng',
  sdt_nguoi_nhan: 'SĐT người nhận',
  dia_chi_nhan: 'Địa chỉ nhận (số, đường, ấp, xã/phường, tỉnh)',
  ghi_chu: 'Ghi chú cho HCMUE',
  so_qd: 'Số QĐ chỉ định thầu',
  ngay_qd: 'Ngày QĐ',
};

const TOI_DA_NHAP: Record<TruongNhapHopDong, number> = {
  nguoi_nhan: TOI_DA_TEXT,
  sdt_nguoi_nhan: TOI_DA_TEXT,
  dia_chi_nhan: TOI_DA_TEXTAREA,
  ghi_chu: TOI_DA_TEXTAREA,
  so_qd: 100,
  ngay_qd: 10,
};

export const LOI_NGAY_QD = 'Ngày QĐ phải là ngày dạng YYYY-MM-DD';

/** 'YYYY-MM-DD' là ngày có thật. */
function laNgay(v: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  if (!m) return false;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3];
}

/** trim (+ NFC), '' → null, SĐT bỏ dấu cách/chấm; khóa vắng → null / false. */
export function chuanHoaNhapHopDong(input: NhapHopDongDauVao): NhapHopDong {
  const kq = { diem_hoc_truc_tiep: input.diem_hoc_truc_tiep === true } as NhapHopDong;
  for (const k of TRUONG_NHAP_HOP_DONG) kq[k] = chuanHoaChuoi(input[k], k === 'sdt_nguoi_nhan');
  return kq;
}

/** X4: lỗi ĐỊNH DẠNG (lưu nháp) — chỉ xét ô có giá trị; thiếu ô bắt buộc không chặn lưu. */
export function kiemTraPhan3(input: NhapHopDongDauVao): { loi: Partial<Record<TruongNhapHopDong, string>> } {
  const loi: Partial<Record<TruongNhapHopDong, string>> = {};
  for (const k of TRUONG_NHAP_HOP_DONG) {
    const v = input[k];
    if (v === null || v === undefined || v === '') continue;
    if (k === 'ngay_qd') {
      if (!laNgay(v)) loi[k] = LOI_NGAY_QD;
    } else if (v.length > TOI_DA_NHAP[k]) {
      loi[k] = loiDoDai(TOI_DA_NHAP[k]);
    } else if (k === 'sdt_nguoi_nhan' && !MAU_SDT.test(v)) {
      loi[k] = LOI_SDT;
    }
  }
  return { loi };
}
