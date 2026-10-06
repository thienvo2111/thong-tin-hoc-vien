import { Module } from '@nestjs/common';
import { YeuCauHoTroController } from './yeu-cau-ho-tro.controller';
import { HoTroYeuCauHoTroController } from './ho-tro-yeu-cau-ho-tro.controller';
import { YeuCauHoTroService } from './yeu-cau-ho-tro.service';
import { ThongBaoModule } from '../thong-bao/thong-bao.module';
import { HoTroHocVienModule } from '../ho-tro-hoc-vien/ho-tro-hoc-vien.module';

@Module({
  imports: [ThongBaoModule, HoTroHocVienModule],
  controllers: [YeuCauHoTroController, HoTroYeuCauHoTroController],
  providers: [YeuCauHoTroService],
})
export class YeuCauHoTroModule {}
