import { z } from 'zod';

// Form sửa/thêm 1 dòng danh sách tham gia (issue #59, ADR 0015 S2/S3/X3). Ô chữ trống = null khi gửi.
// Suất là chuỗi '1' | '0.5' cho Select; lý do bắt buộc.
export const dongDanhSachSchema = z.object({
  don_vi_id: z
    .string()
    .nullable()
    .refine((v) => !!v, 'Chọn trường'),
  ho_ten: z.string().trim().min(1, 'Nhập họ tên').max(255, 'Họ tên tối đa 255 ký tự'),
  ngay_sinh: z.date().nullable(),
  gioi_tinh: z.string().trim().max(20, 'Giới tính tối đa 20 ký tự'),
  ma_goc: z.string().trim().max(50, 'Mã gốc tối đa 50 ký tự'),
  lop: z.string().trim().max(100, 'Lớp tối đa 100 ký tự'),
  giai_doan: z.enum(['ca_hai', 'chi_gd1', 'chi_gd2']),
  ty_le_suat: z.enum(['1', '0.5']),
  ghi_chu: z.string().trim().max(2000, 'Ghi chú tối đa 2000 ký tự'),
  ly_do: z.string().trim().min(1, 'Nhập lý do').max(500, 'Lý do tối đa 500 ký tự'),
});

export type DongDanhSachForm = z.infer<typeof dongDanhSachSchema>;
