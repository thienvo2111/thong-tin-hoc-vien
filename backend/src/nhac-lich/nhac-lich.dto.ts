import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

// ADR 0004 G10 (issue #21): "Đã gửi" — lưu đúng nội dung đã gửi (ảnh chụp).
class GhiNhacCoBan {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @IsUUID('all', { each: true })
  lich_hoc_ids!: string[];

  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  noi_dung!: string;
}

export class GhiNhacGiangVienDto extends GhiNhacCoBan {
  @IsUUID()
  giang_vien_id!: string;
}

export class GhiNhacCumDto extends GhiNhacCoBan {
  @IsUUID()
  cum_id!: string;
}

export class TinNhanCumQueryDto {
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Định dạng YYYY-MM-DD' })
  ngay!: string;
}
