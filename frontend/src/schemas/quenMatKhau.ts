import { z } from 'zod';

export const quenMatKhauSchema = z.object({
  ten_dang_nhap: z.string().trim().min(1, 'Vui lòng nhập mã định danh'),
});

export type QuenMatKhauForm = z.infer<typeof quenMatKhauSchema>;
