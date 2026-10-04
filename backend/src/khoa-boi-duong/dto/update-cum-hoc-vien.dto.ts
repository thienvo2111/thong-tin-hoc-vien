import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { trang_thai_active } from '@prisma/client';
import { themSchemeNeuThieu } from '../util/lien-ket.util';

// Body của PATCH /khoa-boi-duong/{id}/cum/{cumId} — sửa một phần (partial),
// docs/api-contract.md mục 3. Thêm 2026-09-30. Không có khoa_id — không cho
// đổi khóa cha của cụm qua endpoint này.
export class UpdateCumHocVienDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  ten_cum?: string;

  // Xem create-cum-hoc-vien.dto.ts — tự thêm "https://" nếu thiếu scheme.
  @IsOptional()
  @Transform(({ value }) => themSchemeNeuThieu(value))
  @IsString()
  @MaxLength(500)
  @ValidateIf((o: UpdateCumHocVienDto) => o.link_zalo !== undefined && o.link_zalo !== '')
  @IsUrl(
    { protocols: ['http', 'https'], require_protocol: true },
    { message: 'Link Zalo không hợp lệ (ví dụ: https://zalo.me/g/abc)' },
  )
  link_zalo?: string;

  @IsOptional()
  @IsString()
  ghi_chu?: string;

  @IsOptional()
  @IsEnum(trang_thai_active)
  trang_thai?: trang_thai_active;
}
