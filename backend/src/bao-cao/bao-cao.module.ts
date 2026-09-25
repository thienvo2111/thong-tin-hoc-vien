import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { BaoCaoController } from './bao-cao.controller';
import { BaoCaoService } from './bao-cao.service';

// Dịch vụ Báo cáo — xem docs/api-contract.md mục 7.
@Module({
  imports: [AuthModule],
  controllers: [BaoCaoController],
  providers: [BaoCaoService],
})
export class BaoCaoModule {}
