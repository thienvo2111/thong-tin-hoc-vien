import { Transform } from 'class-transformer';
import {
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { themSchemeNeuThieu } from '../util/lien-ket.util';

// Body của POST /khoa-boi-duong/{id}/cum — QĐ10 (mo-rong-nls-an-giang.md,
// 2026-09-30): cụm học viên (nhóm Zalo hỗ trợ theo địa lý), độc lập với cây
// đơn vị công tác và độc lập với 3 loại lớp.
export class CreateCumHocVienDto {
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  ten_cum: string;

  // Admin có thể chỉ nhập "zalo.me/g/abc" (thiếu scheme) — trình duyệt sẽ hiểu
  // href như vậy là đường dẫn TƯƠNG ĐỐI trong app, không phải link ngoài, nên
  // tự thêm "https://" trước khi lưu.
  @IsOptional()
  @Transform(({ value }) => themSchemeNeuThieu(value))
  @IsString()
  @MaxLength(500)
  @ValidateIf((o: CreateCumHocVienDto) => o.link_zalo !== undefined && o.link_zalo !== '')
  @IsUrl(
    { protocols: ['http', 'https'], require_protocol: true },
    { message: 'Link Zalo không hợp lệ (ví dụ: https://zalo.me/g/abc)' },
  )
  link_zalo?: string;

  @IsOptional()
  @IsString()
  ghi_chu?: string;
}
