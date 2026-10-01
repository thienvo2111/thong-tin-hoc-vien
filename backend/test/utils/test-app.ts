import { Test, TestingModuleBuilder } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { getOptionsToken } from '@nestjs/throttler';
import { SchedulerRegistry } from '@nestjs/schedule';
import { AppModule } from '../../src/app.module';
import { HttpExceptionFilter } from '../../src/common/filters/http-exception.filter';
import { validationExceptionFactory } from '../../src/common/pipes/validation-exception-factory';

// Bootstrap app y hệt main.ts (cùng global pipe/filter) để test e2e phản
// ánh đúng hành vi thật, chạy trên Postgres cục bộ đã có sẵn (docker compose).
//
// `raiseThrottlerLimit`: mỗi file e2e tự có DI container riêng (module mới
// mỗi lần compile()) nên bộ đếm ThrottlerStorage không chia sẻ GIỮA các
// file — nhưng một vài file cũ (vd auth.e2e-spec.ts) tự nó đã gọi
// /auth/dang-nhap >10 lần trong CÙNG 1 file cho các test không liên quan gì
// tới rate limit (T1). Set true để nới giới hạn trong chính file đó, tránh
// 429 "giả" làm hỏng assertion không liên quan — hành vi rate limit THẬT
// (đúng 10/phút) chỉ cần kiểm chứng ở 1 nơi: test/rate-limit.e2e-spec.ts,
// nơi KHÔNG override option này.
export async function createTestApp(
  opts: { raiseThrottlerLimit?: boolean } = {},
): Promise<INestApplication> {
  let builder: TestingModuleBuilder = Test.createTestingModule({
    imports: [AppModule],
  });
  if (opts.raiseThrottlerLimit) {
    builder = builder
      .overrideProvider(getOptionsToken())
      .useValue([{ name: 'default', ttl: 60000, limit: 100000 }]);
  }
  const moduleRef = await builder.compile();

  const app = moduleRef.createNestApplication();
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      exceptionFactory: validationExceptionFactory,
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());
  await app.init();

  // AppModule co ScheduleModule.forRoot() thiet (@Cron EVERY_MINUTE cua
  // HangDoiEmailProcessor) nen cron THAT van chay nen trong luc test. Neu
  // cron that fire dung luc test cung goi drainHangDoi()/drainHangDoiToanBo()
  // thu cong thi cung 1 dong hang_doi_email bi xu ly 2 lan -> lan 2 ném
  // P2025 (not found) trong ghiKetQua. Dung het cron da dang ky de hang_doi_email
  // CHI duoc xu ly khi test chu dong goi processor.xuLyHangDoi().
  const schedulerRegistry = app.get(SchedulerRegistry, { strict: false });
  for (const job of schedulerRegistry.getCronJobs().values()) {
    job.stop();
  }

  return app;
}
