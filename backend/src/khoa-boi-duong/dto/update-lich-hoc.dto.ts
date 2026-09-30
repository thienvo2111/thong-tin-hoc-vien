import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MaxLength,
} from 'class-validator';
import { trang_thai_lich_hoc } from '@prisma/client';

// Body của PATCH /lop/{id}/lich-hoc/{lichHocId} — sửa một phần (partial),
// docs/api-contract.md mục 3. Thêm 2026-09-30. Không có giai_doan_id — không
// cho đổi giai đoạn cha của buổi học qua endpoint này. trang_thai chỉ nhận 3
// giá trị đã có của trang_thai_lich_hoc (chua_dien_ra/dang_dien_ra/ket_thuc)
// — KHÔNG có giá trị "hủy/vô hiệu" (xem prisma/schema.prisma), nên endpoint
// này chưa dùng để "hủy" 1 buổi học, chỉ để sửa sai sót giờ/địa điểm/trạng
// thái diễn ra.
export class UpdateLichHocDto {
  @IsOptional()
  @IsDateString()
  thoi_gian_bat_dau?: string;

  @IsOptional()
  @IsDateString()
  thoi_gian_ket_thuc?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  dia_diem_hoac_link?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  buoi_so?: number;

  @IsOptional()
  @IsEnum(trang_thai_lich_hoc)
  trang_thai?: trang_thai_lich_hoc;
}
