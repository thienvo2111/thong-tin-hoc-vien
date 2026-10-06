import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
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
import { YeuCauHoTroModule } from './yeu-cau-ho-tro/yeu-cau-ho-tro.module';
import { CauHinhKhaoSatModule } from './cau-hinh-khao-sat/cau-hinh-khao-sat.module';
import { SsoModule } from './sso/sso.module';
import { NhatKyModule } from './nhat-ky/nhat-ky.module';
import { HoTroHocVienModule } from './ho-tro-hoc-vien/ho-tro-hoc-vien.module';
import { DiemHocModule } from './diem-hoc/diem-hoc.module';
import { GiangVienModule } from './giang-vien/giang-vien.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // M9 (2026-10-01): cần cho @Cron() ở HangDoiEmailProcessor (thong-bao
    // module) — drain hang_doi_email mỗi phút, xem comment đầu file đó.
    ScheduleModule.forRoot(),
    // T1 (mo-rong-nls-an-giang.md): 10 request/phút/IP. Module này là
    // @Global() nên ThrottlerGuard dùng được ở bất kỳ controller nào chỉ cần
    // @UseGuards(ThrottlerGuard) — KHÔNG đăng ký làm APP_GUARD toàn cục, chỉ
    // áp thủ công cho POST /auth/dang-nhap và GET /hoc-vien/kiem-tra-trung
    // (xem 2 controller đó) để không ảnh hưởng các endpoint còn lại.
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60000, limit: 10 }]),
    PrismaModule,
    NhatKyModule,
    HoTroHocVienModule,
    AuthModule,
    HocVienModule,
    KhoaBoiDuongModule,
    DiemHocModule,
    GiangVienModule,
    DanhMucModule,
    ImportModule,
    BaoCaoModule,
    ThongBaoModule,
    ValidateModule,
    NguoiDungModule,
    DotXacNhanModule,
    YeuCauHoTroModule,
    CauHinhKhaoSatModule,
    SsoModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
