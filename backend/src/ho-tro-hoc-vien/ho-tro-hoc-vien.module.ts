import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { HocVienModule } from '../hoc-vien/hoc-vien.module';
import { KhoaBoiDuongModule } from '../khoa-boi-duong/khoa-boi-duong.module';
import { HoTroHocVienController } from './ho-tro-hoc-vien.controller';
import { HoTroHocVienScopeService } from './ho-tro-hoc-vien-scope.service';
import { HoTroHocVienService } from './ho-tro-hoc-vien.service';
import { VanHanhHocVienService } from './van-hanh-hoc-vien.service';
import { NhacLichModule } from '../nhac-lich/nhac-lich.module';
import { DoiBuoiHocQueryModule } from '../doi-buoi-hoc/doi-buoi-hoc-query.module';
import { TinhHinhDiHocModule } from '../tinh-hinh-di-hoc/tinh-hinh-di-hoc.module';

// ADR 0003: người hỗ trợ học viên theo cụm.
@Module({
  imports: [
    AuthModule,
    HocVienModule,
    KhoaBoiDuongModule,
    NhacLichModule,
    DoiBuoiHocQueryModule,
    TinhHinhDiHocModule,
  ],
  controllers: [HoTroHocVienController],
  providers: [
    HoTroHocVienScopeService,
    HoTroHocVienService,
    VanHanhHocVienService,
  ],
  exports: [HoTroHocVienScopeService],
})
export class HoTroHocVienModule {}
