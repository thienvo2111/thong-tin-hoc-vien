// Ngữ cảnh request cho nhật ký hoạt động: IP, thiết bị, người đang đăng nhập — để
// NhatKyService.ghi() tự lấy, không phải truyền qua chữ ký của mọi service.
//
// Middleware mở AsyncLocalStorage cho cả request (chạy TRƯỚC guard nên chưa có user);
// interceptor toàn cục chạy SAU guard, gắn user vào CÙNG đối tượng store.
import { AsyncLocalStorage } from 'async_hooks';
import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import type { vai_tro_nguoi_dung } from '@prisma/client';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';

export interface NguCanhNhatKy {
  ip: string | null;
  thietBi: string | null;
  nguoiDung: { id: string; vai_tro: vai_tro_nguoi_dung } | null;
}

export const nguCanhNhatKy = new AsyncLocalStorage<NguCanhNhatKy>();

export function nhatKyMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  const store: NguCanhNhatKy = {
    // 'trust proxy' đã bật ở main.ts -> req.ip là IP thật sau Nginx.
    ip: req.ip ?? null,
    thietBi: req.get('user-agent')?.slice(0, 300) ?? null,
    nguoiDung: null,
  };
  nguCanhNhatKy.run(store, () => next());
}

@Injectable()
export class NhatKyInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler) {
    const store = nguCanhNhatKy.getStore();
    const user = context
      .switchToHttp()
      .getRequest<{ user?: AuthenticatedUser }>().user;
    if (store && user) {
      store.nguoiDung = { id: user.id, vai_tro: user.vai_tro };
    }
    return next.handle();
  }
}
