import { z } from 'zod';

// Issue #66 / ADR 0015 T3: form "Gia hạn riêng" 1 trường (Quản trị). Lý do bắt buộc (≤ 500 như backend LyDoDto);
// chọn ngày trừ khi "Bỏ hạn riêng". "Từ hôm nay trở đi" do ô ngày (minDate) + server kiểm.
export const hanRiengSchema = z
  .object({
    bo_han_rieng: z.boolean(),
    han_rieng: z.date().nullable(),
    ly_do: z.string().trim().min(1, 'Nhập lý do gia hạn').max(500, 'Lý do tối đa 500 ký tự'),
  })
  .superRefine((v, ctx) => {
    if (!v.bo_han_rieng && v.han_rieng === null) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['han_rieng'], message: 'Chọn ngày hạn riêng' });
    }
  });

export type HanRiengForm = z.infer<typeof hanRiengSchema>;
