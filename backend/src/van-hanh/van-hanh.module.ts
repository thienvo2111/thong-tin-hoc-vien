import { Module } from '@nestjs/common';
import { BangKiemModule } from '../bang-kiem/bang-kiem.module';
import { VanHanhController } from './van-hanh.controller';
import { VanHanhService } from './van-hanh.service';

// ADR 0004 G15 (issue #22): Quản trị giám sát vận hành.
@Module({
  imports: [BangKiemModule],
  controllers: [VanHanhController],
  providers: [VanHanhService],
})
export class VanHanhModule {}
