import { z } from 'zod';

// Form "Sửa trường" — khớp UpdateDonViCongTacDto (ma_don_vi 1–30, ten_don_vi 1–255). Mã bắt buộc ở đây:
// mục đích chính là bổ sung mã để cấp tài khoản trường (tên đăng nhập = mã viết thường) → không khoảng trắng.
export const suaTruongSchema = z.object({
  ma_don_vi: z
    .string()
    .trim()
    .min(1, 'Nhập mã đơn vị')
    .max(30, 'Mã đơn vị tối đa 30 ký tự')
    .regex(/^\S+$/, 'Mã đơn vị không được có khoảng trắng'),
  ten_don_vi: z.string().trim().min(1, 'Nhập tên trường').max(255, 'Tên trường tối đa 255 ký tự'),
});

export type SuaTruongForm = z.infer<typeof suaTruongSchema>;
