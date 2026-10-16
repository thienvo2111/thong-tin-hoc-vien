import { Module } from '@nestjs/common';
import { HoTroHocVienModule } from '../ho-tro-hoc-vien/ho-tro-hoc-vien.module';
import { DoiBuoiHocQueryModule } from './doi-buoi-hoc-query.module';
import { DoiBuoiHocController } from './doi-buoi-hoc.controller';
import { DoiBuoiHocHocVienController } from './doi-buoi-hoc-hoc-vien.controller';
import { DoiBuoiHocService } from './doi-buoi-hoc.service';
import { ThongKeDoiBuoiService } from './thong-ke-doi-buoi.service';

// Đề nghị đổi buổi học (spec 2026-10-16). PrismaModule/NhatKyModule là global.
@Module({
  imports: [DoiBuoiHocQueryModule, HoTroHocVienModule],
  controllers: [DoiBuoiHocHocVienController, DoiBuoiHocController],
  providers: [DoiBuoiHocService, ThongKeDoiBuoiService],
  exports: [DoiBuoiHocService],
})
export class DoiBuoiHocModule {}
