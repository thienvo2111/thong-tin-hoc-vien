import { z } from 'zod';

// Issue #55: Cổng đơn vị chỉ đăng nhập bằng tên tài khoản (không MOET/SĐT). Kiểm trong superRefine để lỗi 2 ô hiện cùng lúc.
export const dangNhapCongDonViSchema = z
  .object({ ten_dang_nhap: z.string().trim(), mat_khau: z.string() })
  .superRefine((v, ctx) => {
    if (!v.ten_dang_nhap) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['ten_dang_nhap'], message: 'Vui lòng nhập tên tài khoản' });
    }
    if (!v.mat_khau)
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['mat_khau'], message: 'Vui lòng nhập mật khẩu' });
  });

export type DangNhapCongDonViForm = z.infer<typeof dangNhapCongDonViSchema>;
