import { z } from 'zod';
import { soChuSo } from '@/lib/kieuDangNhap';

export const kieuDangNhapSchema = z.enum(['ma', 'sdt']);

// Spec 2026-10-09 Q-C: kiểm tra ô nhập theo chế độ — mã: không rỗng; SĐT: 9–12 chữ số sau khi bỏ ký tự lạ.
// Backend vẫn quyết định (chuẩn hóa +84/84/thiếu số 0 ở server).
export function kiemTraTenDangNhap(
  v: { kieu_dang_nhap: 'ma' | 'sdt'; ten_dang_nhap: string },
  ctx: z.RefinementCtx,
) {
  const path = ['ten_dang_nhap'];
  if (v.kieu_dang_nhap === 'ma') {
    if (!v.ten_dang_nhap) ctx.addIssue({ code: z.ZodIssueCode.custom, path, message: 'Vui lòng nhập mã định danh' });
    return;
  }
  if (!v.ten_dang_nhap) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path, message: 'Vui lòng nhập số điện thoại' });
    return;
  }
  const n = soChuSo(v.ten_dang_nhap);
  if (n < 9 || n > 12) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path, message: 'Số điện thoại phải có từ 9 đến 12 chữ số' });
  }
}

export const dangNhapSchema = z
  .object({
    kieu_dang_nhap: kieuDangNhapSchema,
    ten_dang_nhap: z.string().trim(),
    // Kiểm trong superRefine (không dùng .min) để lỗi 2 ô hiện cùng lúc — zod bỏ qua superRefine khi field lỗi.
    mat_khau: z.string(),
  })
  .superRefine((v, ctx) => {
    kiemTraTenDangNhap(v, ctx);
    if (!v.mat_khau) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['mat_khau'], message: 'Vui lòng nhập mật khẩu' });
  });

export type DangNhapForm = z.infer<typeof dangNhapSchema>;
