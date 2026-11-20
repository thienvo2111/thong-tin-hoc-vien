import { z } from 'zod';
import { TRUONG_HO_SO, chuanHoaHoSo, kiemTraHoSo, type TruongHoSo } from '@/lib/hoSoDonVi';

// Issue #63: form Hồ sơ đơn vị — mỗi ô là chuỗi trên form. Chỉ chặn lỗi ĐỊNH DẠNG / độ dài
// (cùng quy tắc với backend); ô bắt buộc để trống vẫn lưu được (nháp, ADR 0015 X4).
export type HoSoDonViForm = Record<TruongHoSo, string>;

const hinh = Object.fromEntries(TRUONG_HO_SO.map((t) => [t.ma, z.string()])) as Record<TruongHoSo, z.ZodString>;

export const hoSoDonViSchema = z.object(hinh).superRefine((v, ctx) => {
  const { loi } = kiemTraHoSo(chuanHoaHoSo(v));
  for (const [field, message] of Object.entries(loi)) {
    ctx.addIssue({ code: 'custom', path: [field], message });
  }
});

/** Form trống (mọi ô ''). */
export function hoSoFormTrong(): HoSoDonViForm {
  return Object.fromEntries(TRUONG_HO_SO.map((t) => [t.ma, ''])) as HoSoDonViForm;
}
