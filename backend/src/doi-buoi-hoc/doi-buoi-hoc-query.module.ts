import { Module } from '@nestjs/common';
import { DoiBuoiHocQueryService } from './doi-buoi-hoc-query.service';

@Module({
  providers: [DoiBuoiHocQueryService],
  exports: [DoiBuoiHocQueryService],
})
export class DoiBuoiHocQueryModule {}
