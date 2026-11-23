import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DotTrienKhaiController } from './dot-trien-khai.controller';
import { DotTrienKhaiService } from './dot-trien-khai.service';
import {
  DanhSachThamGiaController,
  DongDanhSachThamGiaController,
} from './danh-sach-tham-gia.controller';
import { DanhSachThamGiaService } from './danh-sach-tham-gia.service';
import { TruongDanhSachController } from './truong-danh-sach.controller';
import { TruongDanhSachService } from './truong-danh-sach.service';
import { DeNghiSuaController } from './de-nghi-sua.controller';
import { DeNghiSuaService } from './de-nghi-sua.service';
import { HoSoDonViController } from './ho-so-don-vi.controller';
import { HoSoDonViService } from './ho-so-don-vi.service';
import {
  HopDongQuanTriController,
  HopDongTruongController,
} from './hop-dong.controller';
import { HopDongService } from './hop-dong.service';
import { HopDongDotController } from './hop-dong-dot.controller';
import { HopDongDotService } from './hop-dong-dot.service';
import { TienDoDotController } from './tien-do-dot.controller';
import { TienDoDotService } from './tien-do-dot.service';

// ADR 0015: mọi API của Cổng đơn vị (tiền tố /cong-don-vi). PrismaService và
// NhatKyService là @Global() nên không cần import module. AuthModule cho
// ScopeService (trường trong phạm vi Sở của đợt, issue #58).
@Module({
  imports: [AuthModule],
  controllers: [
    DotTrienKhaiController,
    DanhSachThamGiaController,
    DongDanhSachThamGiaController,
    TruongDanhSachController,
    DeNghiSuaController,
    HoSoDonViController,
    HopDongTruongController,
    // Trước HopDongQuanTriController: /hop-dong/xuat-khtc không được rơi vào /hop-dong/:donViId.
    HopDongDotController,
    HopDongQuanTriController,
    TienDoDotController,
  ],
  providers: [
    DotTrienKhaiService,
    DanhSachThamGiaService,
    TruongDanhSachService,
    DeNghiSuaService,
    HoSoDonViService,
    HopDongService,
    HopDongDotService,
    TienDoDotService,
  ],
})
export class CongDonViModule {}
