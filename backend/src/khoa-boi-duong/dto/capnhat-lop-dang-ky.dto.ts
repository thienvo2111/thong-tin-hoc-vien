import { IsEnum, IsUUID } from 'class-validator';
import { loai_lop_hoc } from '@prisma/client';

// Body của PATCH /dang-ky-hoc/{id}/lop — QĐ10 (mo-rong-nls-an-giang.md,
// 2026-09-30): thao tác thủ công, gán/đổi lớp của MỘT loại lớp cho một đăng
// ký học (upsert — tạo mới nếu đăng ký chưa có lớp loại này, cập nhật nếu
// đã có). Chuẩn bị cho màn hình admin sửa tay (task frontend riêng sau).
export class CapNhatLopDangKyDto {
  @IsEnum(loai_lop_hoc)
  loai_lop: loai_lop_hoc;

  @IsUUID()
  lop_id: string;
}
