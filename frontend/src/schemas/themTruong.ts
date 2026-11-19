import { z } from 'zod';

// Form "Thêm trường" (issue #57) — khớp CreateDonViCongTacDto (backend/src/danh-muc/dto/don-vi-cong-tac.dto.ts).
// tinh_id chỉ để lọc Phường/xã, không gửi lên. Ô chưa chọn = null, bắt buộc kiểm bằng refine (giữ kiểu nullable).
export const themTruongSchema = z.object({
  ten_don_vi: z.string().trim().min(1, 'Nhập tên trường').max(255, 'Tên trường tối đa 255 ký tự'),
  ma_don_vi: z.string().trim().max(30, 'Mã đơn vị tối đa 30 ký tự'),
  tinh_id: z
    .string()
    .nullable()
    .refine((v) => !!v, 'Chọn tỉnh/thành'),
  dia_ban_id: z
    .string()
    .nullable()
    .refine((v) => !!v, 'Chọn phường/xã'),
  // Phạm vi Sở/Phòng suy ra từ cây don_vi_cha_id (backend ScopeService) → bắt buộc, kẻo trường mới
  // nằm ngoài phạm vi mọi Sở và không khớp được khi nạp danh sách đợt (ADR 0015 T7).
  don_vi_cha_id: z
    .string()
    .nullable()
    .refine((v) => !!v, 'Chọn đơn vị quản lý (Sở/Phòng)'),
});

export type ThemTruongForm = z.infer<typeof themTruongSchema>;
