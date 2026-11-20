import type { GiaiDoanThamGia } from '@/api/danhSachThamGia';
import type { BanChupDong, GiaTriDeNghi, LoaiDeNghi, TrangThaiDeNghi } from '@/api/truongDanhSach';
import { dinhDangNgayLich } from '@/lib/ngayLich';
import { NHAN_GIAI_DOAN } from './danhSachThamGiaNhan';

// Issue #62 / ADR 0015 X2: nhãn + tóm tắt đề nghị, dùng chung màn trường và hàng đợi Quản trị.
export const NHAN_LOAI_DE_NGHI: Record<LoaiDeNghi, string> = {
  sua: 'Sửa thông tin',
  them: 'Thêm người',
  bot: 'Bớt người',
};

export const TRANG_THAI_DE_NGHI: Record<TrangThaiDeNghi, { nhan: string; mau: string }> = {
  cho: { nhan: 'Chờ xử lý', mau: 'yellow' },
  da_ap_dung: { nhan: 'Đã áp dụng', mau: 'green' },
  tu_choi: { nhan: 'Từ chối', mau: 'red' },
};

export type TruongDeNghi = keyof GiaTriDeNghi;

export const NHAN_TRUONG_DE_NGHI: Record<TruongDeNghi, string> = {
  ho_ten: 'Họ tên',
  ngay_sinh: 'Ngày sinh',
  gioi_tinh: 'Giới tính',
  lop: 'Lớp/môn',
  giai_doan: 'Giai đoạn',
};

const THU_TU: TruongDeNghi[] = ['ho_ten', 'ngay_sinh', 'gioi_tinh', 'lop', 'giai_doan'];

/** Giá trị 1 trường để hiển thị; trống → '—'. */
export function hienThiGiaTri(k: TruongDeNghi, v: string | null | undefined): string {
  if (v === null || v === undefined || v === '') return '—';
  if (k === 'ngay_sinh') return dinhDangNgayLich(v);
  if (k === 'giai_doan') return NHAN_GIAI_DOAN[v as GiaiDoanThamGia] ?? v;
  return v;
}

export interface DongThayDoi {
  truong: TruongDeNghi;
  nhan: string;
  cu: string;
  moi: string;
}

/** "Hiện tại → Đề nghị" cho các trường có trong gia_tri, theo thứ tự cố định. */
export function thayDoiDeNghi(giaTri: GiaTriDeNghi, hienTai: BanChupDong | null): DongThayDoi[] {
  return THU_TU.filter((k) => k in giaTri).map((k) => ({
    truong: k,
    nhan: NHAN_TRUONG_DE_NGHI[k],
    cu: hienThiGiaTri(k, hienTai ? hienTai[k] : null),
    moi: hienThiGiaTri(k, giaTri[k]),
  }));
}

/** Giá trị đề nghị thêm người / bản chụp dòng → các cặp nhãn – giá trị có dữ liệu. */
export function moTaNguoi(v: GiaTriDeNghi | BanChupDong): { nhan: string; giaTri: string }[] {
  return THU_TU.filter((k) => k === 'ho_ten' || (v[k] !== null && v[k] !== undefined && v[k] !== '')).map((k) => ({
    nhan: NHAN_TRUONG_DE_NGHI[k],
    giaTri: hienThiGiaTri(k, v[k]),
  }));
}
