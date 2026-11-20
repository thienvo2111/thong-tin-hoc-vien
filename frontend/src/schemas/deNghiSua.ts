import { z } from 'zod';

// Form đề nghị của trường (issue #62, ADR 0015 X2). che_do: sửa thông tin / bớt người / thêm người.
// Sửa + thêm: họ tên bắt buộc; bớt: lý do bắt buộc. Độ dài theo cột danh_sach_tham_gia (backend vẫn kiểm lại).
export const deNghiSuaSchema = z
  .object({
    che_do: z.enum(['sua', 'bot', 'them']),
    ho_ten: z.string().trim().max(255, 'Họ tên tối đa 255 ký tự'),
    ngay_sinh: z.date().nullable(),
    gioi_tinh: z.string().trim().max(20, 'Giới tính tối đa 20 ký tự'),
    lop: z.string().trim().max(100, 'Lớp/môn tối đa 100 ký tự'),
    giai_doan: z.enum(['ca_hai', 'chi_gd1', 'chi_gd2']),
    ly_do: z.string().trim().max(500, 'Tối đa 500 ký tự'),
  })
  .superRefine((v, ctx) => {
    if (v.che_do !== 'bot' && v.ho_ten === '') {
      ctx.addIssue({ code: 'custom', path: ['ho_ten'], message: 'Nhập họ tên' });
    }
    if (v.che_do === 'bot' && v.ly_do === '') {
      ctx.addIssue({ code: 'custom', path: ['ly_do'], message: 'Nhập lý do' });
    }
  });

export type DeNghiSuaForm = z.infer<typeof deNghiSuaSchema>;
