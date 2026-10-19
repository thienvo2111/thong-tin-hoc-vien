import { Module } from '@nestjs/common';
import { DiemDanhModule } from '../diem-danh/diem-danh.module';
import { DoiBuoiHocQueryModule } from '../doi-buoi-hoc/doi-buoi-hoc-query.module';
import { TinhHinhDiHocController } from './tinh-hinh-di-hoc.controller';
import { TinhHinhDiHocService } from './tinh-hinh-di-hoc.service';

// ADR 0010: Tình hình đi học + điểm danh bổ sung. Controller ở đây là phần
// của Quản trị (/thong-ke/di-hoc); phần người hỗ trợ nằm ở
// HoTroHocVienController và dùng lại service này.
@Module({
  imports: [DiemDanhModule, DoiBuoiHocQueryModule],
  controllers: [TinhHinhDiHocController],
  providers: [TinhHinhDiHocService],
  exports: [TinhHinhDiHocService],
})
export class TinhHinhDiHocModule {}
