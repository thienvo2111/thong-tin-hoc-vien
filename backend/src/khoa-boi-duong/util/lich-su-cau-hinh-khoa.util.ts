import { formatVnDateTime } from '../../common/utils/vn-datetime.util';

// Lịch sử cấu hình khóa (ADR 0014 — bổ sung nhật ký): mỗi lần PATCH khóa ghi
// nhat_ky_hoat_dong 'cap_nhat_cau_hinh_khoa' với chi_tiet.thay_doi chỉ gồm
// trường thực sự đổi. Giá trị lưu dạng JSON thô (Date -> ISO); nhãn hiển thị
// dựng lúc đọc.

export type GiaTriCauHinh = string | number | boolean | null;

export interface ThayDoiCauHinh {
  truong: string;
  truoc: GiaTriCauHinh;
  sau: GiaTriCauHinh;
}

export const NHAN_TRUONG_CAU_HINH: Record<string, string> = {
  ma_khoa: 'Mã khóa',
  ten_khoa: 'Tên khóa',
  dia_diem: 'Địa điểm',
  don_vi_dat_hang_id: 'Đơn vị đặt hàng',
  thoi_gian_bat_dau: 'Ngày bắt đầu',
  thoi_gian_ket_thuc: 'Ngày kết thúc',
  mo_dieu_chinh_muc: 'Học viên tự điều chỉnh mức',
  so_buoi_doi_toi_da: 'Số buổi đổi tối đa',
  so_buoi_hoc_bu_toi_da: 'Số buổi học bù tối đa',
  bat_diem_danh_zoom_luc: 'Tự điểm danh lớp Zoom',
  diem_danh_mo_truoc_phut: 'Mở điểm danh trước giờ học (phút)',
  diem_danh_dong_sau_phut: 'Đóng điểm danh sau giờ bắt đầu (phút)',
  che_do_chuyen_can: 'Chế độ chuyên cần khi chuyển lớp',
};

// Khớp nhãn màn Cấu hình điểm danh Zoom (frontend CauHinhDiemDanhZoom).
export const NHAN_CHE_DO_CHUYEN_CAN: Record<string, string> = {
  theo_lop_hien_tai: 'Theo lớp hiện tại (học lại các buổi ở lớp mới)',
  cong_nhan_cung_muc: 'Công nhận buổi đã có mặt ở lớp cũ cùng mức',
  cong_nhan_lop_cu: 'Công nhận buổi đã có mặt ở lớp cũ (bất kể mức)',
};

function chuanHoa(v: unknown): GiaTriCauHinh {
  if (v instanceof Date) return v.toISOString();
  if (v === undefined) return null;
  return v as GiaTriCauHinh;
}

export function soSanhCauHinhKhoa(
  truoc: Record<string, unknown>,
  sau: Record<string, unknown>,
): ThayDoiCauHinh[] {
  return Object.keys(NHAN_TRUONG_CAU_HINH).flatMap((truong) => {
    const a = chuanHoa(truoc[truong]);
    const b = chuanHoa(sau[truong]);
    return a === b ? [] : [{ truong, truoc: a, sau: b }];
  });
}

// @db.Date lưu nửa đêm UTC -> lấy ngày theo UTC.
function ngay(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getUTCDate())}/${p(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`;
}

export function hienThiGiaTriCauHinh(
  truong: string,
  v: GiaTriCauHinh,
  tenDonVi: ReadonlyMap<string, string> = new Map(),
): string {
  switch (truong) {
    case 'che_do_chuyen_can':
      return v === null
        ? '(trống)'
        : (NHAN_CHE_DO_CHUYEN_CAN[String(v)] ?? String(v));
    case 'mo_dieu_chinh_muc':
      return v ? 'Bật' : 'Tắt';
    case 'bat_diem_danh_zoom_luc':
      return v ? `Bật (từ ${formatVnDateTime(new Date(String(v)))})` : 'Tắt';
    case 'thoi_gian_bat_dau':
    case 'thoi_gian_ket_thuc':
      return v === null ? '(trống)' : ngay(String(v));
    case 'don_vi_dat_hang_id':
      return v === null ? '(trống)' : (tenDonVi.get(String(v)) ?? String(v));
    default:
      return v === null || v === '' ? '(trống)' : String(v);
  }
}
