import { Global, MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { NhatKyController } from './nhat-ky.controller';
import { NhatKyService } from './nhat-ky.service';
import { NhatKyInterceptor, nhatKyMiddleware } from './nhat-ky.context';

// @Global: service nghiệp vụ nào cũng inject NhatKyService được mà không phải import module.
@Global()
@Module({
  controllers: [NhatKyController],
  providers: [
    NhatKyService,
    { provide: APP_INTERCEPTOR, useClass: NhatKyInterceptor },
  ],
  exports: [NhatKyService],
})
export class NhatKyModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(nhatKyMiddleware).forRoutes('*');
  }
}
