import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { KhoaBoiDuongController } from './khoa-boi-duong.controller';
import { LopHocController } from './lop-hoc.controller';
import { DangKyHocController } from './dang-ky-hoc.controller';
import { KhoaBoiDuongService } from './khoa-boi-duong.service';

// Dịch vụ Khóa bồi dưỡng & Lớp học — xem docs/api-contract.md mục 3. Export
// service ra để HocVienModule (hook auto-tạo dang_ky_hoc khi hồ sơ da_duyet)
// và ImportModule (phan_lop_hoc_vien) tái dùng — không import ngược lại
// HocVienModule/ImportModule để tránh vòng lặp phụ thuộc module.
@Module({
  imports: [AuthModule],
  controllers: [KhoaBoiDuongController, LopHocController, DangKyHocController],
  providers: [KhoaBoiDuongService],
  exports: [KhoaBoiDuongService],
})
export class KhoaBoiDuongModule {}
