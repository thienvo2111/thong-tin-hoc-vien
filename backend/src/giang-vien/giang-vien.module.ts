import { Module } from '@nestjs/common';
import { GiangVienController } from './giang-vien.controller';
import { GiangVienService } from './giang-vien.service';
import { PhanCongGiangDayService } from './phan-cong-giang-day.service';
import { GiangVienImportService } from './giang-vien-import.service';
import { TaiKhoanGiangVienService } from './tai-khoan-giang-vien.service';
import { AuthModule } from '../auth/auth.module';
import { ThongBaoModule } from '../thong-bao/thong-bao.module';

// T11 (issue #3): giảng viên + phân công giảng dạy. Export 2 service để
// KhoaBoiDuongModule (phân công tay, đổi giờ buổi) và ImportModule (import
// giang_vien/phan_cong_giang_day) dùng chung đúng 1 bộ luật.
@Module({
  imports: [AuthModule, ThongBaoModule],
  controllers: [GiangVienController],
  providers: [
    GiangVienService,
    PhanCongGiangDayService,
    GiangVienImportService,
    TaiKhoanGiangVienService,
  ],
  exports: [
    GiangVienService,
    PhanCongGiangDayService,
    GiangVienImportService,
    TaiKhoanGiangVienService,
  ],
})
export class GiangVienModule {}
