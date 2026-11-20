import { z } from 'zod';
import { chuanHoaNhapHopDong, kiemTraPhan3, type NhapHopDong } from '@/lib/hopDong';
import { ngaySangChuoi } from '@/lib/ngayLich';

// Issue #64: form Phần 3–4 hợp đồng. Chỉ chặn lỗi ĐỊNH DẠNG / độ dài (cùng quy tắc với backend);
// ô bắt buộc để trống vẫn lưu nháp được (ADR 0015 X4) — điều kiện Nộp do backend trả ly_do_chan.
export const hopDongSchema = z
  .object({
    nguoi_nhan: z.string(),
    sdt_nguoi_nhan: z.string(),
    dia_chi_nhan: z.string(),
    ghi_chu: z.string(),
    so_qd: z.string(),
    ngay_qd: z.date().nullable(),
    diem_hoc_truc_tiep: z.boolean(),
  })
  .superRefine((v, ctx) => {
    const { loi } = kiemTraPhan3(formSangNhap(v));
    for (const [field, message] of Object.entries(loi)) {
      ctx.addIssue({ code: 'custom', path: [field], message });
    }
  });

export type HopDongForm = z.infer<typeof hopDongSchema>;

/** Form → thân PUT (ô trống = null, ngày 'YYYY-MM-DD'). */
export function formSangNhap(v: HopDongForm): NhapHopDong {
  return chuanHoaNhapHopDong({ ...v, ngay_qd: v.ngay_qd ? ngaySangChuoi(v.ngay_qd) : null });
}
