import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { Public } from './auth/decorators/public.decorator';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  // Route mặc định của Nest CLI, dùng làm health-check — không phải endpoint
  // nghiệp vụ trong api-contract.md nên để công khai, không cần Authorization.
  @Public()
  @Get()
  getHello(): string {
    return this.appService.getHello();
  }
}
