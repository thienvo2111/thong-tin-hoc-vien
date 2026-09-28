import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { validationExceptionFactory } from './common/pipes/validation-exception-factory';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  // T1: lấy đúng IP người gọi thật sau reverse proxy (X-Forwarded-For) —
  // ThrottlerGuard (giới hạn 10 request/phút/IP) đọc req.ip, mặc định trỏ
  // vào IP của proxy nếu không bật cờ này.
  app.set('trust proxy', 1);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      exceptionFactory: validationExceptionFactory,
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
