import { Module } from '@nestjs/common';
import { DotTrienKhaiController } from './dot-trien-khai.controller';
import { DotTrienKhaiService } from './dot-trien-khai.service';

// ADR 0015: mọi API của Cổng đơn vị (tiền tố /cong-don-vi). PrismaService và
// NhatKyService là @Global() nên không cần import module.
@Module({
  controllers: [DotTrienKhaiController],
  providers: [DotTrienKhaiService],
})
export class CongDonViModule {}
