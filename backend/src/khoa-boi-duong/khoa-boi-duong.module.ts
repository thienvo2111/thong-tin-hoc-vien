import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { KhoaBoiDuongController } from './khoa-boi-duong.controller';
import { LopHocController } from './lop-hoc.controller';
import { DangKyHocController } from './dang-ky-hoc.controller';
import { KhoaBoiDuongService } from './khoa-boi-duong.service';

// Dịch vụ Khóa bồi dưỡng & Lớp học — xem docs/api-contract.md mục 3. Export
// service ra để ImportModule tái dùng (import phan_lop_hoc_vien — nguồn duy
// nhất gán dang_ky_hoc.khoa_id/lop_id, xem
// KhoaBoiDuongService.resolvePhanLopRow/commitPhanLop) — không import ngược
// lại ImportModule để tránh vòng lặp phụ thuộc module.
@Module({
  imports: [AuthModule],
  controllers: [KhoaBoiDuongController, LopHocController, DangKyHocController],
  providers: [KhoaBoiDuongService],
  exports: [KhoaBoiDuongService],
})
export class KhoaBoiDuongModule {}
