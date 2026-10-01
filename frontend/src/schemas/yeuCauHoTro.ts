import { z } from 'zod';

export const taoYeuCauHoTroSchema = z.object({
  loai_van_de_id: z.string().min(1, 'Thầy/Cô chọn loại vấn đề'),
  noi_dung_hoi: z.string().min(1, 'Thầy/Cô nhập nội dung cần hỗ trợ'),
});

export type TaoYeuCauHoTroForm = z.infer<typeof taoYeuCauHoTroSchema>;
