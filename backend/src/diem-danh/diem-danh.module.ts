import { Module } from '@nestjs/common';
import { HoTroGiangVienModule } from '../ho-tro-giang-vien/ho-tro-giang-vien.module';
import { DiemDanhController } from './diem-danh.controller';
import { DiemDanhService } from './diem-danh.service';

// ADR 0005 Z7 (issue #26): sửa nhanh điểm danh cho Quản trị + hỗ trợ GV.
@Module({
  imports: [HoTroGiangVienModule],
  controllers: [DiemDanhController],
  providers: [DiemDanhService],
})
export class DiemDanhModule {}
