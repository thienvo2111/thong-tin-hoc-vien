import { Module } from '@nestjs/common';
import { NhacLichService } from './nhac-lich.service';

// ADR 0004 G10/G11 (issue #21): tin nhắn nhắc lịch — dùng chung cho khu hỗ
// trợ GV và hỗ trợ HV (mỗi khu tự kiểm phạm vi trước khi gọi).
@Module({
  providers: [NhacLichService],
  exports: [NhacLichService],
})
export class NhacLichModule {}
