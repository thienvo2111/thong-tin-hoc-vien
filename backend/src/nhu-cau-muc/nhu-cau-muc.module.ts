import { Module } from '@nestjs/common';
import { DotNhuCauMucController } from './dot-nhu-cau-muc.controller';
import { DotNhuCauMucService } from './dot-nhu-cau-muc.service';
import { NhuCauMucHocVienController } from './nhu-cau-muc-hoc-vien.controller';
import { NhuCauMucHocVienService } from './nhu-cau-muc-hoc-vien.service';

// ADR 0013: đợt thu nhu cầu mức học. Chỉ phụ thuộc PrismaService (@Global()).
@Module({
  controllers: [DotNhuCauMucController, NhuCauMucHocVienController],
  providers: [DotNhuCauMucService, NhuCauMucHocVienService],
  exports: [DotNhuCauMucService],
})
export class NhuCauMucModule {}
