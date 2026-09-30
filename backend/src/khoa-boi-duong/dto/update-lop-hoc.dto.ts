import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  MaxLength,
  MinLength,
} from 'class-validator';
import { loai_lop_hoc, muc_nang_luc, trang_thai_active } from '@prisma/client';

// Body của PATCH /khoa-boi-duong/{id}/lop/{lopId} — sửa một phần (partial),
// docs/api-contract.md mục 3. Thêm 2026-09-30. Không có khoa_id — không cho
// đổi khóa cha của lớp qua endpoint này. Đổi loai_lop khi lớp đang có đăng ký
// (dang_ky_hoc_lop) KHÔNG bị chặn — service trả kèm canh_bao trong response,
// xem KhoaBoiDuongService.capNhatLop.
export class UpdateLopHocDto {
  @IsOptional()
  @IsEnum(loai_lop_hoc)
  loai_lop?: loai_lop_hoc;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  ten_lop?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  si_so_toi_da?: number;

  // Khớp chk_lop_hoc_nhom (1-20) — xem prisma/schema.prisma comment tại
  // lop_hoc.nhom_hoc_vien.
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  nhom_hoc_vien?: number;

  @IsOptional()
  @IsEnum(muc_nang_luc)
  muc_nang_luc?: muc_nang_luc;

  @IsOptional()
  @IsEnum(trang_thai_active)
  trang_thai?: trang_thai_active;
}
