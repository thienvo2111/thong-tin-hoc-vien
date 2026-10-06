import { Module } from '@nestjs/common';
import { TrangLopModule } from '../trang-lop/trang-lop.module';
import { CongGiangVienController } from './cong-giang-vien.controller';
import { CongGiangVienService } from './cong-giang-vien.service';

// ADR 0004 G8 (issue #20): cổng giảng viên chỉ đọc.
@Module({
  imports: [TrangLopModule],
  controllers: [CongGiangVienController],
  providers: [CongGiangVienService],
})
export class CongGiangVienModule {}
