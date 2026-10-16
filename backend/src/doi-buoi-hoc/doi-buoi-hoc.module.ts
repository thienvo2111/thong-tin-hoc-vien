import { Module } from '@nestjs/common';
import { DoiBuoiHocQueryModule } from './doi-buoi-hoc-query.module';
import { DoiBuoiHocHocVienController } from './doi-buoi-hoc-hoc-vien.controller';
import { DoiBuoiHocService } from './doi-buoi-hoc.service';

// Đề nghị đổi buổi học (spec 2026-10-16). PrismaModule/NhatKyModule là global.
@Module({
  imports: [DoiBuoiHocQueryModule],
  controllers: [DoiBuoiHocHocVienController],
  providers: [DoiBuoiHocService],
  exports: [DoiBuoiHocService],
})
export class DoiBuoiHocModule {}
