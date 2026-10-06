import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { HocVienModule } from '../hoc-vien/hoc-vien.module';
import { BaoCaoController } from './bao-cao.controller';
import { BaoCaoService } from './bao-cao.service';
import { GioDayService } from './gio-day.service';

// Dịch vụ Báo cáo — xem docs/api-contract.md mục 7. T15 (mo-rong-nls-an-
// giang.md): import HocVienModule để tái dùng HocVienService.danhGiaDayDu()
// (T9) cho GET /bao-cao/dieu-kien-danh-gia — không phụ thuộc ngược (HocVien
// Module không import BaoCaoModule) nên không vòng lặp.
@Module({
  imports: [AuthModule, HocVienModule],
  controllers: [BaoCaoController],
  providers: [BaoCaoService, GioDayService],
})
export class BaoCaoModule {}
