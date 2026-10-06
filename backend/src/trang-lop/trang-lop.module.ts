import { Module } from '@nestjs/common';
import { TrangLopService } from './trang-lop.service';

// ADR 0004 G9 (issue #15): Trang lớp dùng chung cho các khu (hỗ trợ GV, giảng viên…).
@Module({
  providers: [TrangLopService],
  exports: [TrangLopService],
})
export class TrangLopModule {}
