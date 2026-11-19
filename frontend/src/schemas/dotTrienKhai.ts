import { z } from 'zod';

// Form tạo/sửa đợt triển khai (issue #56, ADR 0015 S4/S6/T1). Kiểu vào = kiểu ra (null cho ô trống),
// bắt buộc kiểm bằng refine để react-hook-form giữ được giá trị null của ô chưa chọn.
export const dotTrienKhaiSchema = z
  .object({
    chuong_trinh: z.enum(['nls', 'hsg'], { message: 'Chọn chương trình' }),
    ten: z.string().trim().min(1, 'Nhập tên đợt').max(255, 'Tên đợt tối đa 255 ký tự'),
    so_gddt_id: z
      .string()
      .nullable()
      .refine((v) => !!v, 'Chọn Sở GD&ĐT'),
    don_gia: z.number().int('Đơn giá phải là số nguyên').min(0, 'Đơn giá không được âm').nullable(),
    ngay_qd_tu: z.date().nullable(),
    ngay_qd_den: z.date().nullable(),
    han_nop: z
      .date()
      .nullable()
      // Khai báo ': boolean' để TS không suy ra type predicate (giữ kiểu Date | null cho form).
      .refine((v): boolean => v !== null, 'Chọn hạn nộp'),
  })
  .superRefine((v, ctx) => {
    if ((v.ngay_qd_tu === null) !== (v.ngay_qd_den === null)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [v.ngay_qd_tu === null ? 'ngay_qd_tu' : 'ngay_qd_den'],
        message: 'Nhập cả ngày từ và ngày đến, hoặc để trống cả hai',
      });
    } else if (v.ngay_qd_tu && v.ngay_qd_den && v.ngay_qd_den < v.ngay_qd_tu) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['ngay_qd_den'],
        message: 'Ngày đến phải bằng hoặc sau ngày từ',
      });
    }
  });

export type DotTrienKhaiForm = z.infer<typeof dotTrienKhaiSchema>;
