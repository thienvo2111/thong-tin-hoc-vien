import { Module } from '@nestjs/common';
import { CauHinhKhaoSatController } from './cau-hinh-khao-sat.controller';
import { CauHinhKhaoSatService } from './cau-hinh-khao-sat.service';

@Module({
  controllers: [CauHinhKhaoSatController],
  providers: [CauHinhKhaoSatService],
  exports: [CauHinhKhaoSatService],
})
export class CauHinhKhaoSatModule {}
