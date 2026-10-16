import { Module } from '@nestjs/common';
import { TrangLopService } from './trang-lop.service';
import { DoiBuoiHocQueryModule } from '../doi-buoi-hoc/doi-buoi-hoc-query.module';

// ADR 0004 G9 (issue #15): Trang lớp dùng chung cho các khu (hỗ trợ GV, giảng viên…).
@Module({
  imports: [DoiBuoiHocQueryModule],
  providers: [TrangLopService],
  exports: [TrangLopService],
})
export class TrangLopModule {}
