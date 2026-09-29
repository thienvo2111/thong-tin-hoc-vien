import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { validationExceptionFactory } from './common/pipes/validation-exception-factory';

// Đi ngược thư mục từ vị trí file build ra để tìm package.json gốc — không
// hardcode số cấp thư mục vì `nest build` có lúc xuất ra dist/main.js, có
// lúc dist/src/main.js tùy rootDir suy luận được (do có prisma.config.ts ở
// gốc project), nên đường dẫn tương đối cố định dễ vỡ.
function timVersionPackageJson(tuThuMuc: string): string {
  try {
    const noiDung = readFileSync(join(tuThuMuc, 'package.json'), 'utf8');
    return JSON.parse(noiDung).version;
  } catch {
    const thuMucCha = dirname(tuThuMuc);
    if (thuMucCha === tuThuMuc) return '0.0.0';
    return timVersionPackageJson(thuMucCha);
  }
}
const appVersion = timVersionPackageJson(__dirname);

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  // T1: lấy đúng IP người gọi thật sau reverse proxy (X-Forwarded-For) —
  // ThrottlerGuard (giới hạn 10 request/phút/IP) đọc req.ip, mặc định trỏ
  // vào IP của proxy nếu không bật cờ này.
  app.set('trust proxy', 1);

  // CORS_ORIGIN: danh sách origin được phép, phân cách bởi dấu phẩy (vd. FE
  // dev http://localhost:5173). Nếu không đặt: dev/test (NODE_ENV khác
  // 'production') cho phép mọi origin để tiện chạy cục bộ; production thì
  // khóa chặt (không origin nào) để tránh mặc định mở toang khi quên cấu hình.
  const corsOrigin = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map((origin) => origin.trim())
    : process.env.NODE_ENV !== 'production';
  app.enableCors({ origin: corsOrigin });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      exceptionFactory: validationExceptionFactory,
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());

  // P0 (docs/mo-rong-nls-an-giang.md): thao tác quản trị (import, tạo đợt,
  // xuất báo cáo) chạy qua Swagger UI, chưa có giao diện quản trị riêng.
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Thu thập thông tin học viên API')
    .setVersion(appVersion)
    .addBearerAuth()
    .build();
  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api', app, swaggerDocument);

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
