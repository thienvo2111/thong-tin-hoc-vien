import { Module } from '@nestjs/common';
import { GiangVienController } from './giang-vien.controller';
import { GiangVienService } from './giang-vien.service';
import { PhanCongGiangDayService } from './phan-cong-giang-day.service';
import { GiangVienImportService } from './giang-vien-import.service';

// T11 (issue #3): giảng viên + phân công giảng dạy. Export 2 service để
// KhoaBoiDuongModule (phân công tay, đổi giờ buổi) và ImportModule (import
// giang_vien/phan_cong_giang_day) dùng chung đúng 1 bộ luật.
@Module({
  controllers: [GiangVienController],
  providers: [
    GiangVienService,
    PhanCongGiangDayService,
    GiangVienImportService,
  ],
  exports: [GiangVienService, PhanCongGiangDayService, GiangVienImportService],
})
export class GiangVienModule {}
