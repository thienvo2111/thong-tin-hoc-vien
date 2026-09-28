import { Module } from '@nestjs/common';
import { NguoiDungController } from './nguoi-dung.controller';
import { NguoiDungService } from './nguoi-dung.service';

@Module({
  controllers: [NguoiDungController],
  providers: [NguoiDungService],
})
export class NguoiDungModule {}
