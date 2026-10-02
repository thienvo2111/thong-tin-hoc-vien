import { z } from 'zod';

// Phản ánh backend cau-hinh-khao-sat.dto.ts + 2 quy tắc nghiệp vụ ở cau-hinh-khao-sat.service.ts.
// Backend vẫn là nguồn quyết định — form luôn hiện thêm lỗi `fields` API trả về.

const urlHopLe = (s: string) => {
  if (s === '') return true;
  try {
    const u = new URL(s);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
};

export const cauHinhKhaoSatSchema = z
  .object({
    che_do_hoc_vien: z.enum(['khao_sat', 'dang_nhap']),
    danh_gia_dau_vao_trong_cong: z.boolean(),
    hien_khao_sat: z.boolean(),
    phieu: z
      .array(
        z.object({
          ten: z.string().trim().min(1, 'Nhập tên phiếu').max(200, 'Tối đa 200 ký tự'),
          mo_ta: z.string().max(1000, 'Tối đa 1000 ký tự'),
          lien_ket: z
            .array(
              z.object({
                nhan: z.string().trim().min(1, 'Nhập nhãn nút').max(100, 'Tối đa 100 ký tự'),
                url: z
                  .string()
                  .trim()
                  .max(1000, 'Tối đa 1000 ký tự')
                  .refine(urlHopLe, 'Đường dẫn phải bắt đầu bằng http:// hoặc https://'),
              }),
            )
            .min(1, 'Cần ít nhất 1 đường dẫn')
            .max(5, 'Tối đa 5 đường dẫn mỗi phiếu'),
        }),
      )
      .max(10, 'Tối đa 10 phiếu'),
  })
  .superRefine((v, ctx) => {
    if (v.che_do_hoc_vien === 'khao_sat' && !v.hien_khao_sat) {
      ctx.addIssue({ code: 'custom', path: ['hien_khao_sat'], message: 'Phải bật khi chế độ là Khảo sát' });
    }
    if (v.hien_khao_sat && v.phieu.length === 0) {
      ctx.addIssue({ code: 'custom', path: ['phieu'], message: 'Cần ít nhất 1 phiếu khi bật hiển thị' });
    }
  });

export type CauHinhKhaoSatForm = z.infer<typeof cauHinhKhaoSatSchema>;
