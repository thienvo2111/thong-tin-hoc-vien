import { Module } from '@nestjs/common';
import { DiemHocModule } from '../diem-hoc/diem-hoc.module';
import { BangKiemController } from './bang-kiem.controller';
import { BangKiemService } from './bang-kiem.service';

// ADR 0004 G5b (issue #17): bảng kiểm chuẩn bị đợt trực tiếp.
@Module({
  imports: [DiemHocModule],
  controllers: [BangKiemController],
  providers: [BangKiemService],
  exports: [BangKiemService],
})
export class BangKiemModule {}
