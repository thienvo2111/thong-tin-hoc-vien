import { Module } from '@nestjs/common';
import { YeuCauHoTroController } from './yeu-cau-ho-tro.controller';
import { YeuCauHoTroService } from './yeu-cau-ho-tro.service';
import { ThongBaoModule } from '../thong-bao/thong-bao.module';

@Module({
  imports: [ThongBaoModule],
  controllers: [YeuCauHoTroController],
  providers: [YeuCauHoTroService],
})
export class YeuCauHoTroModule {}
