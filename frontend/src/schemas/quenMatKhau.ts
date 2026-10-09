import { z } from 'zod';
import { kiemTraTenDangNhap, kieuDangNhapSchema } from './dangNhap';

export const quenMatKhauSchema = z
  .object({
    kieu_dang_nhap: kieuDangNhapSchema,
    ten_dang_nhap: z.string().trim(),
  })
  .superRefine(kiemTraTenDangNhap);

export type QuenMatKhauForm = z.infer<typeof quenMatKhauSchema>;
