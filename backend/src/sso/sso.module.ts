import { Module } from '@nestjs/common';
import { HocVienModule } from '../hoc-vien/hoc-vien.module';
import { SsoController } from './sso.controller';
import { SsoService } from './sso.service';
import { KetQuaKhaoSatService } from './ket-qua-khao-sat.service';
import { ThangMucService } from './thang-muc.service';

@Module({
  imports: [HocVienModule],
  controllers: [SsoController],
  providers: [SsoService, KetQuaKhaoSatService, ThangMucService],
  exports: [KetQuaKhaoSatService, ThangMucService],
})
export class SsoModule {}
