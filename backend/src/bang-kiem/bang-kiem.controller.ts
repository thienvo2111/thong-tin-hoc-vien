import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { loai_muc_kiem_tra, trang_thai_active } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { Roles } from '../auth/decorators/roles.decorator';
import { BangKiemService } from './bang-kiem.service';

export class LuuMucKiemTraDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  ten?: string;

  @IsOptional()
  @IsString()
  mo_ta?: string | null;

  @IsOptional()
  @IsEnum(loai_muc_kiem_tra)
  loai?: loai_muc_kiem_tra;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  ma_quy_tac?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(365)
  han_truoc_ngay?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  thu_tu?: number;

  @IsOptional()
  @IsEnum(trang_thai_active)
  trang_thai?: trang_thai_active;
}

export class DanhDauMucDto {
  @IsBoolean()
  da_xong!: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  ghi_chu?: string | null;
}

// ADR 0004 G5b (issue #17): cấu hình bảng kiểm — chỉ Quản trị. Bộ mặc định
// (khoa_id NULL) + bộ riêng theo khóa ("Tùy chỉnh cho khóa" = sao chép).
@Roles('quan_tri')
@Controller('bang-kiem')
export class BangKiemController {
  constructor(private readonly service: BangKiemService) {}

  @Get('quy-tac')
  quyTac() {
    return this.service.dsQuyTac();
  }

  @Get('mac-dinh')
  macDinh() {
    return this.service.boCuaKhoa(null, true);
  }

  @Post('mac-dinh/muc')
  themMucMacDinh(@Body() dto: LuuMucKiemTraDto) {
    return this.service.themMuc(null, dto);
  }

  @Get('khoa/:khoaId')
  boCuaKhoa(@Param('khoaId', ParseUUIDPipe) khoaId: string) {
    return this.service.boCuaKhoa(khoaId, true);
  }

  @Post('khoa/:khoaId/tuy-chinh')
  tuyChinh(@Param('khoaId', ParseUUIDPipe) khoaId: string) {
    return this.service.tuyChinhChoKhoa(khoaId);
  }

  @Post('khoa/:khoaId/muc')
  themMucKhoa(
    @Param('khoaId', ParseUUIDPipe) khoaId: string,
    @Body() dto: LuuMucKiemTraDto,
  ) {
    return this.service.themMuc(khoaId, dto);
  }

  @Patch('muc/:id')
  suaMuc(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: LuuMucKiemTraDto,
  ) {
    return this.service.suaMuc(id, dto);
  }
}
