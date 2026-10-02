import { Module } from '@nestjs/common';
import { HocVienModule } from '../hoc-vien/hoc-vien.module';
import { SsoController } from './sso.controller';
import { SsoService } from './sso.service';

@Module({
  imports: [HocVienModule],
  controllers: [SsoController],
  providers: [SsoService],
})
export class SsoModule {}
