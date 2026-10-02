import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  IsUrl,
  MaxLength,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

export const CHE_DO_HOC_VIEN = ['khao_sat', 'dang_nhap'] as const;
export type CheDoHocVien = (typeof CHE_DO_HOC_VIEN)[number];

// Kênh làm bài đánh giá đầu vào ở M6: 'sso' = chuyển sang hệ thống khảo sát
// bằng mã dùng một lần (chỉ cần hồ sơ đầy đủ); 'vle' = luồng T15 cũ (đợt 2 +
// đã xác nhận + tài khoản VLE). Cấu hình lưu trước 2026-10-02 không có trường
// này -> coi là 'vle' (giữ nguyên hành vi cũ).
export const KENH_DANH_GIA = ['sso', 'vle'] as const;
export type KenhDanhGia = (typeof KENH_DANH_GIA)[number];

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

  @IsIn(KENH_DANH_GIA)
  kenh_danh_gia: KenhDanhGia;

  // Mở khảo sát đầu ra (SSO target 'dau-ra'). Thiếu = false (cấu hình trước 2026-10-02).
  @IsOptional()
  @IsBoolean()
  khao_sat_dau_ra_mo?: boolean;

  // Thứ tự mảng = thứ tự học viên làm phiếu.
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => PhieuKhaoSatDto)
  phieu: PhieuKhaoSatDto[];
}

// PUT /cau-hinh-khao-sat/khoa/:khoaId (quan_tri) — cấu hình riêng của 1 khóa.
// tinh_id: tỉnh hiển thị ở ô "Chọn tỉnh/thành" trang chủ (null = không hiện ở
// trang chủ, chỉ áp dụng cho học viên đã ghi danh khóa).
export class CauHinhKhaoSatKhoaDto extends CauHinhKhaoSatDto {
  @IsOptional()
  @ValidateIf((o: CauHinhKhaoSatKhoaDto) => o.tinh_id !== null)
  @IsUUID()
  tinh_id?: string | null;
}
