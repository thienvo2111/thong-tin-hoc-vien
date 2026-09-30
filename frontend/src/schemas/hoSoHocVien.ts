import { z } from 'zod';
import dayjs from 'dayjs';

// Phản ánh validation-checklist.md — backend vẫn là nguồn quyết định cuối cùng (CLAUDE.md).
// Áp dụng cho M4 (bổ sung hồ sơ import_moet / sửa hồ sơ) — các trường bắt buộc "khi tự bổ sung".

const chiChuVietCoDau = /^[A-Za-zÀ-ỹ]+(\s[A-Za-zÀ-ỹ]+)*$/; // # 2, 5: chỉ chữ + khoảng trắng đơn

export const hoTenSchema = z
  .string()
  .trim()
  .min(1, 'Vui lòng nhập họ và tên')
  .regex(chiChuVietCoDau, 'Họ tên chỉ gồm chữ cái và khoảng trắng');

export const cccdSchema = z
  .string()
  .regex(/^\d{12}$/, 'Phải gồm đúng 12 chữ số');

export const soDienThoaiSchema = z
  .string()
  .regex(/^0\d{9}$/, 'Số điện thoại phải gồm đúng 10 chữ số, bắt đầu bằng 0 (không khoảng trắng, dấu chấm)');

export const emailSchema = z.string().email('Email không đúng định dạng');

const NAM_HIEN_TAI = dayjs().year();

export const trinhDoChuyenMonEnum = z.enum(['trung_cap', 'cao_dang', 'dai_hoc', 'thac_si', 'tien_si', 'khac']);
export const capGiangDayEnum = z.enum(['mam_non', 'tieu_hoc', 'thcs', 'thpt']);

export const hoSoHocVienSchema = z
  .object({
    ho_ten: hoTenSchema,
    ngay_sinh: z.coerce.number().int().min(1).max(31),
    thang_sinh: z.coerce.number().int().min(1).max(12),
    nam_sinh: z.coerce.number().int().min(1940).max(NAM_HIEN_TAI),
    gioi_tinh: z.enum(['nam', 'nu', 'khac']).nullable().optional(),
    so_dinh_danh_ca_nhan: cccdSchema,
    // Sửa 2026-09-30: "Nơi sinh" đổi từ Select ràng buộc dia_danh sang ô nhập
    // tự do (giấy khai sinh có thể ghi theo địa giới hành chính cũ).
    noi_sinh: z.string().trim().min(1, 'Vui lòng nhập nơi sinh'),
    // Thêm 2026-09-30: "Cư trú" — tùy chọn, dùng địa giới hành chính hiện tại
    // (không bắt buộc, backend đã validate khớp tỉnh/phường-xã).
    cu_tru_tinh_id: z.string().nullable().optional(),
    cu_tru_phuong_xa_id: z.string().nullable().optional(),
    don_vi_cong_tac_id: z.string().min(1, 'Vui lòng chọn đơn vị công tác'),
    chuc_vu: z.string().trim().optional(),
    so_dien_thoai_lien_he: soDienThoaiSchema,
    email_lien_he: emailSchema,
    trinh_do_chuyen_mon: trinhDoChuyenMonEnum,
    trinh_do_chuyen_mon_khac: z.string().trim().optional(),
    chuyen_mon: z.array(z.string().trim().min(1)).min(1, 'Cần ít nhất 1 chuyên môn'),
    cap_giang_day: capGiangDayEnum.nullable().optional(),
    mon_giang_day_id: z.string().nullable().optional(),
  })
  .superRefine((data, ctx) => {
    // # 11: tổ hợp ngày/tháng/năm phải là ngày thực tế
    const ngayThuc = dayjs(`${data.nam_sinh}-${data.thang_sinh}-${data.ngay_sinh}`, 'YYYY-M-D', true);
    if (!ngayThuc.isValid()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['ngay_sinh'], message: 'Ngày/tháng/năm sinh không phải ngày thực tế' });
    } else if (dayjs().diff(ngayThuc, 'year') < 15) {
      // # 12: tuổi tối thiểu — mặc định 15, xác nhận lại với nghiệp vụ (xem README/ghi chú improvise)
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['nam_sinh'], message: 'Tuổi chưa đủ điều kiện tham gia chương trình' });
    }
    // # 23: chọn "khác" bắt buộc mô tả
    if (data.trinh_do_chuyen_mon === 'khac' && !data.trinh_do_chuyen_mon_khac?.trim()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['trinh_do_chuyen_mon_khac'], message: 'Vui lòng mô tả trình độ chuyên môn' });
    }
    // # 26: mon_giang_day_id chỉ áp dụng khi có cap_giang_day — nếu không có cap_giang_day, field bị ẩn ở UI nên bỏ qua ở đây
  });

export type HoSoHocVienForm = z.infer<typeof hoSoHocVienSchema>;

/** Phát hiện họ tên chưa viết hoa chữ đầu mỗi từ (#4 — 🟡 cảnh báo, không chặn). */
export function canhBaoChuaVietHoa(hoTen: string): boolean {
  const tu = hoTen.trim().split(/\s+/).filter(Boolean);
  if (tu.length === 0) return false;
  return tu.some((t) => t[0] !== t[0].toLocaleUpperCase('vi'));
}

/** Gợi ý dạng chuẩn hóa: viết hoa chữ đầu mỗi từ. */
export function chuanHoaHoTen(hoTen: string): string {
  return hoTen
    .trim()
    .replace(/\s+/g, ' ')
    .split(' ')
    .map((t) => (t.length > 0 ? t[0].toLocaleUpperCase('vi') + t.slice(1).toLocaleLowerCase('vi') : t))
    .join(' ');
}

/** Phát hiện họ tên có thể đang gõ thiếu dấu tiếng Việt (🟡 cảnh báo, không chặn). */
export function canhBaoThieuDau(hoTen: string): boolean {
  const tu = hoTen.trim().split(/\s+/).filter(Boolean);
  if (tu.length < 2) return false;
  return /^[A-Za-z\s]+$/.test(hoTen.trim());
}

// Danh sách họ phổ biến tiếng Việt (không dấu, viết thường) — dùng để phát hiện khả năng đảo Họ/Tên.
const HO_PHO_BIEN = new Set([
  'nguyen', 'tran', 'le', 'pham', 'hoang', 'huynh', 'phan', 'vu', 'vo', 'dang',
  'bui', 'do', 'ho', 'ngo', 'duong', 'ly', 'dinh', 'doan', 'dao', 'trinh',
  'truong', 'lam', 'phung', 'mai', 'to', 'ta', 'vuong', 'cao', 'luu', 'chau',
  'thai', 'chu', 'kieu', 'quach', 'dam', 'ung', 'au', 'la', 'tang', 'diep',
]);

function boDauChuThuong(tu: string): string {
  return tu
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')
    .toLocaleLowerCase('vi');
}

/** Phát hiện họ tên có thể bị đảo ngược thứ tự Họ ↔ Tên (🟡 cảnh báo, không chặn). */
export function canhBaoDaoTen(hoTen: string): boolean {
  const tu = hoTen.trim().split(/\s+/).filter(Boolean);
  if (tu.length < 2) return false;
  const dauLaHo = HO_PHO_BIEN.has(boDauChuThuong(tu[0]));
  const cuoiLaHo = HO_PHO_BIEN.has(boDauChuThuong(tu[tu.length - 1]));
  return !dauLaHo && cuoiLaHo;
}

/** Gợi ý dạng đảo lại thứ tự: đưa từ cuối lên đầu, giữ nguyên thứ tự các từ còn lại. */
export function guiYDaoTen(hoTen: string): string {
  const tu = hoTen.trim().replace(/\s+/g, ' ').split(' ').filter(Boolean);
  if (tu.length < 2) return hoTen;
  return [tu[tu.length - 1], ...tu.slice(0, tu.length - 1)].join(' ');
}
