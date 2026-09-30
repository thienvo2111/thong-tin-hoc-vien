import { z } from 'zod';

// Độ phức tạp cơ bản kiểm tra được phía client (≥8 ký tự, có chữ và số, 2 ô trùng nhau) — cùng mức với
// M2 (schemas/doiMatKhau.ts). "Khác mật khẩu cũ"/"khác ngày sinh" chỉ backend kiểm tra được (không biết
// ngày sinh/hash cũ ở màn công khai này) — hiển thị qua lỗi field trả về từ POST /auth/dat-lai-mat-khau.
export const datLaiMatKhauSchema = z
  .object({
    mat_khau_moi: z.string(),
    nhap_lai: z.string(),
  })
  .superRefine((data, ctx) => {
    if (data.mat_khau_moi.length < 8) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['mat_khau_moi'], message: 'Mật khẩu mới phải có ít nhất 8 ký tự' });
    }
    if (!/[A-Za-zÀ-ỹ]/.test(data.mat_khau_moi) || !/[0-9]/.test(data.mat_khau_moi)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['mat_khau_moi'], message: 'Mật khẩu mới phải có cả chữ và số' });
    }
    if (data.mat_khau_moi !== data.nhap_lai) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['nhap_lai'], message: 'Hai ô mật khẩu chưa trùng nhau' });
    }
  });

export type DatLaiMatKhauForm = z.infer<typeof datLaiMatKhauSchema>;
