import { Module } from '@nestjs/common';
import { TrangLopModule } from '../trang-lop/trang-lop.module';
import { KhoaBoiDuongModule } from '../khoa-boi-duong/khoa-boi-duong.module';
import { GiangVienModule } from '../giang-vien/giang-vien.module';
import { DiemHocModule } from '../diem-hoc/diem-hoc.module';
import { VanHanhLopService } from './van-hanh-lop.service';
import { BangKiemModule } from '../bang-kiem/bang-kiem.module';
import { HoTroGiangVienController } from './ho-tro-giang-vien.controller';
import { HoTroGiangVienScopeService } from './ho-tro-giang-vien-scope.service';

// ADR 0004: người hỗ trợ giảng viên (nhóm theo khóa).
@Module({
  imports: [
    TrangLopModule,
    KhoaBoiDuongModule,
    GiangVienModule,
    DiemHocModule,
    BangKiemModule,
  ],
  controllers: [HoTroGiangVienController],
  providers: [HoTroGiangVienScopeService, VanHanhLopService],
  exports: [HoTroGiangVienScopeService],
})
export class HoTroGiangVienModule {}
