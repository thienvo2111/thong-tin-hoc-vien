import { z } from 'zod';

export const dangNhapSchema = z.object({
  ten_dang_nhap: z.string().trim().min(1, 'Vui lòng nhập mã định danh'),
  mat_khau: z.string().min(1, 'Vui lòng nhập mật khẩu'),
});

export type DangNhapForm = z.infer<typeof dangNhapSchema>;
