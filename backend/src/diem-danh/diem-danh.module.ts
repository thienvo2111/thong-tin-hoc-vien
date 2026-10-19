import { Module } from '@nestjs/common';
import { HoTroGiangVienModule } from '../ho-tro-giang-vien/ho-tro-giang-vien.module';
import { DiemDanhController } from './diem-danh.controller';
import { DiemDanhService } from './diem-danh.service';
import { DoiBuoiHocQueryModule } from '../doi-buoi-hoc/doi-buoi-hoc-query.module';

// ADR 0005 Z7 (issue #26): sửa nhanh điểm danh cho Quản trị + hỗ trợ GV.
@Module({
  imports: [HoTroGiangVienModule, DoiBuoiHocQueryModule],
  controllers: [DiemDanhController],
  providers: [DiemDanhService],
  // ADR 0010: ghi tay dùng chung cho điểm danh bổ sung (Tình hình đi học).
  exports: [DiemDanhService],
})
export class DiemDanhModule {}
