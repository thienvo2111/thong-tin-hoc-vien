import { z } from 'zod';

export const taoYeuCauHoTroSchema = z.object({
  tinh_huong: z.string().min(1, 'Thầy/Cô chọn vấn đề đang gặp'),
  noi_dung_hoi: z.string().min(1, 'Thầy/Cô nhập nội dung cần hỗ trợ'),
});

export type TaoYeuCauHoTroForm = z.infer<typeof taoYeuCauHoTroSchema>;
