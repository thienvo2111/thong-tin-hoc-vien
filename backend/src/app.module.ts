import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { HocVienModule } from './hoc-vien/hoc-vien.module';
import { KhoaBoiDuongModule } from './khoa-boi-duong/khoa-boi-duong.module';
import { DanhMucModule } from './danh-muc/danh-muc.module';
import { ImportModule } from './import/import.module';
import { BaoCaoModule } from './bao-cao/bao-cao.module';
import { ThongBaoModule } from './thong-bao/thong-bao.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    HocVienModule,
    KhoaBoiDuongModule,
    DanhMucModule,
    ImportModule,
    BaoCaoModule,
    ThongBaoModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
