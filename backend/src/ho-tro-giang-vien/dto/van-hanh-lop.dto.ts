import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

// ADR 0004 G12 (issue #16): người hỗ trợ GV sửa giờ/điểm học/phòng của buổi
// chưa diễn ra — BẮT BUỘC lý do. Không đổi buổi số/trạng thái/xóa buổi.
export class SuaBuoiHoTroGvDto {
  @IsOptional()
  @IsDateString()
  thoi_gian_bat_dau?: string;

  @IsOptional()
  @IsDateString()
  thoi_gian_ket_thuc?: string;

  @IsOptional()
  @IsUUID()
  diem_hoc_id?: string;

  // null = xóa phòng.
  @IsOptional()
  @IsString()
  @MaxLength(100)
  phong?: string | null;

  @IsString()
  @MinLength(5, { message: 'Lý do tối thiểu 5 ký tự' })
  @MaxLength(500)
  ly_do!: string;
}

const NGAY = /^\d{4}-\d{2}-\d{2}$/;

// PUT .../hau-can/{giangVienId} — gửi cap_nhat_luc đã đọc (bỏ trống khi
// chưa có bản ghi) để chặn ghi đè khi 2 người cùng sửa.
export class LuuHauCanDto {
  @IsOptional()
  @IsDateString()
  cap_nhat_luc?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  noi_o_ten?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  noi_o_dia_chi?: string | null;

  @IsOptional()
  @Matches(NGAY, { message: 'Định dạng YYYY-MM-DD' })
  nhan_phong?: string | null;

  @IsOptional()
  @Matches(NGAY, { message: 'Định dạng YYYY-MM-DD' })
  tra_phong?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  phuong_tien?: string | null;

  @IsOptional()
  @IsDateString()
  don_luc?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  diem_don?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  lien_he_don?: string | null;

  @IsOptional()
  @IsString()
  ghi_chu?: string | null;

  @IsOptional()
  @IsBoolean()
  da_xac_nhan_noi_o?: boolean;

  @IsOptional()
  @IsBoolean()
  da_xac_nhan_di_chuyen?: boolean;
}

export class ThucDiaMucDto {
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  ho_ten!: string;

  @IsString()
  @MaxLength(20)
  so_dien_thoai!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  nhiem_vu?: string;

  @IsOptional()
  @IsString()
  ghi_chu?: string;
}

// PUT .../thuc-dia — thay toàn bộ người hỗ trợ thực địa của đợt.
export class ThucDiaDto {
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => ThucDiaMucDto)
  nhan_su!: ThucDiaMucDto[];
}
