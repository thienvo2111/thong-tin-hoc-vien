import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { ScopeService } from './scope/scope.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';

// Dịch vụ Auth & Phân quyền — docs/api-contract.md mục 1.
// JwtAuthGuard + RolesGuard đăng ký làm guard toàn cục (APP_GUARD) ở đây vì
// mọi endpoint (trừ @Public()) đều cần xác thực theo "Quy ước chung > Auth" —
// các module khác chỉ cần dùng @Public()/@Roles()/@CurrentUser(), không cần
// tự áp guard.
@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET', 'dev-only-insecure-secret'),
        signOptions: {
          // @nestjs/jwt định kiểu expiresIn theo `ms` StringValue, nhưng ta
          // đọc trực tiếp từ env dạng string tự do (vd "8h") — ép kiểu vì
          // giá trị hợp lệ tại runtime, tránh phải thêm phụ thuộc chỉ để enum hóa.
          expiresIn: config.get<string>('JWT_EXPIRES_IN', '8h') as never,
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    ScopeService,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
  exports: [AuthService, ScopeService, JwtModule],
})
export class AuthModule {}
