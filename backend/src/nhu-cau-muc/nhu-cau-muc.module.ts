import { Module } from '@nestjs/common';
import { DotNhuCauMucController } from './dot-nhu-cau-muc.controller';
import { DotNhuCauMucService } from './dot-nhu-cau-muc.service';

// ADR 0013: đợt thu nhu cầu mức học. Chỉ phụ thuộc PrismaService (@Global()).
@Module({
  controllers: [DotNhuCauMucController],
  providers: [DotNhuCauMucService],
  exports: [DotNhuCauMucService],
})
export class NhuCauMucModule {}
