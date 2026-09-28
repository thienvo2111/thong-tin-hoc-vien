import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
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
import { ValidateModule } from './validate/validate.module';
import { NguoiDungModule } from './nguoi-dung/nguoi-dung.module';
import { DotXacNhanModule } from './dot-xac-nhan/dot-xac-nhan.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // T1 (mo-rong-nls-an-giang.md): 10 request/phút/IP. Module này là
    // @Global() nên ThrottlerGuard dùng được ở bất kỳ controller nào chỉ cần
    // @UseGuards(ThrottlerGuard) — KHÔNG đăng ký làm APP_GUARD toàn cục, chỉ
    // áp thủ công cho POST /auth/dang-nhap và GET /hoc-vien/kiem-tra-trung
    // (xem 2 controller đó) để không ảnh hưởng các endpoint còn lại.
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60000, limit: 10 }]),
    PrismaModule,
    AuthModule,
    HocVienModule,
    KhoaBoiDuongModule,
    DanhMucModule,
    ImportModule,
    BaoCaoModule,
    ThongBaoModule,
    ValidateModule,
    NguoiDungModule,
    DotXacNhanModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
