import { z } from 'zod';

/** Điều kiện mật khẩu mới — dùng cả cho zod validate lẫn checklist tích xanh thời gian thực (M2). */
export function dieuKienMatKhau(matKhauMoi: string, matKhauCu: string, nhapLai: string, ngaySinhDdmmyyyy?: string) {
  return {
    duDoDai: matKhauMoi.length >= 8,
    coChuVaSo: /[A-Za-zÀ-ỹ]/.test(matKhauMoi) && /[0-9]/.test(matKhauMoi),
    khacNgaySinh: !ngaySinhDdmmyyyy || matKhauMoi !== ngaySinhDdmmyyyy,
    haiOTrungNhau: matKhauMoi.length > 0 && matKhauMoi === nhapLai,
    khacMatKhauCu: matKhauMoi.length === 0 || matKhauCu.length === 0 || matKhauMoi !== matKhauCu,
  };
}

export function taoDoiMatKhauSchema(ngaySinhDdmmyyyy?: string) {
  return z
    .object({
      mat_khau_cu: z.string().min(1, 'Vui lòng nhập mật khẩu hiện tại'),
      mat_khau_moi: z.string(),
      nhap_lai: z.string(),
    })
    .superRefine((data, ctx) => {
      const dk = dieuKienMatKhau(data.mat_khau_moi, data.mat_khau_cu, data.nhap_lai, ngaySinhDdmmyyyy);
      if (!dk.duDoDai) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['mat_khau_moi'], message: 'Mật khẩu mới phải có ít nhất 8 ký tự' });
      }
      if (!dk.coChuVaSo) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['mat_khau_moi'], message: 'Mật khẩu mới phải có cả chữ và số' });
      }
      if (!dk.khacNgaySinh) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['mat_khau_moi'], message: 'Mật khẩu mới không được trùng ngày sinh' });
      }
      if (!dk.khacMatKhauCu) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['mat_khau_moi'], message: 'Mật khẩu mới phải khác mật khẩu hiện tại' });
      }
      if (!dk.haiOTrungNhau) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['nhap_lai'], message: 'Hai ô mật khẩu chưa trùng nhau' });
      }
    });
}

export type DoiMatKhauForm = z.infer<ReturnType<typeof taoDoiMatKhauSchema>>;
