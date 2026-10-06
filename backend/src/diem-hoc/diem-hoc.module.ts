import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DiemHocController } from './diem-hoc.controller';
import { DiemHocService } from './diem-hoc.service';

// T10 (issue #2): danh mục điểm học trực tiếp. Export service để
// KhoaBoiDuongModule kiểm điểm học khi gán vào buổi + cảnh báo số phòng.
@Module({
  imports: [AuthModule],
  controllers: [DiemHocController],
  providers: [DiemHocService],
  exports: [DiemHocService],
})
export class DiemHocModule {}
