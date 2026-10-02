import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

export const CHE_DO_HOC_VIEN = ['khao_sat', 'dang_nhap'] as const;
export type CheDoHocVien = (typeof CHE_DO_HOC_VIEN)[number];

export class LienKetKhaoSatDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  nhan: string;

  // Chuỗi rỗng = chưa có đường dẫn (trang chủ hiện nút bị khóa "đang cập nhật").
  @IsString()
  @MaxLength(1000)
  @ValidateIf((o: LienKetKhaoSatDto) => o.url !== '')
  @IsUrl(
    { protocols: ['http', 'https'], require_protocol: true },
    { message: 'Đường dẫn phải bắt đầu bằng http:// hoặc https://' },
  )
  url: string;
}

export class PhieuKhaoSatDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  ten: string;

  @IsString()
  @MaxLength(1000)
  mo_ta: string;

  // Nhiều đường dẫn khi tách phiếu theo đối tượng (giáo viên / cán bộ quản lý).
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(5)
  @ValidateNested({ each: true })
  @Type(() => LienKetKhaoSatDto)
  lien_ket: LienKetKhaoSatDto[];
}

// PUT /cau-hinh-khao-sat (quan_tri) — ghi đè toàn bộ cấu hình.
export class CauHinhKhaoSatDto {
  @IsIn(CHE_DO_HOC_VIEN)
  che_do_hoc_vien: CheDoHocVien;

  @IsBoolean()
  danh_gia_dau_vao_trong_cong: boolean;

  @IsBoolean()
  hien_khao_sat: boolean;

  // Thứ tự mảng = thứ tự học viên làm phiếu.
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => PhieuKhaoSatDto)
  phieu: PhieuKhaoSatDto[];
}
