import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtAuthGuard } from './jwt-auth.guard';
import { PrismaService } from '../../prisma/prisma.service';
import { UnauthorizedAppException } from '../../common/exceptions/app.exceptions';

// Gap 1 (2026-09-28): xác nhận JwtAuthGuard tra token_thu_hoi trên MỌI
// request đã xác thực, và — quan trọng không kém — KHÔNG chặn nhầm token còn
// hợp lệ (chưa bị thu hồi). Đây là bug class dễ gặp nhất khi thêm cơ chế
// revocation, nên test cả 2 chiều tường minh.
describe('JwtAuthGuard — thu hồi token', () => {
  let guard: JwtAuthGuard;
  let jwtService: { verifyAsync: jest.Mock };
  let prisma: {
    token_thu_hoi: { findUnique: jest.Mock };
    nguoi_dung: { findUnique: jest.Mock };
  };
  let reflector: { getAllAndOverride: jest.Mock };

  const payload = {
    sub: 'user-1',
    ten_dang_nhap: 'test@x.com',
    vai_tro: 'truong' as const,
    don_vi_id: 'don-vi-1',
    hoc_vien_id: null,
    jti: 'jti-123',
    iat: 1_700_000_000,
    exp: 1_700_100_000,
  };

  function buildContext(headers: Record<string, string> = {}): {
    context: ExecutionContext;
    request: { headers: Record<string, string>; user?: unknown };
  } {
    const request: { headers: Record<string, string>; user?: unknown } = {
      headers,
    };
    const context = {
      switchToHttp: () => ({ getRequest: () => request }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as unknown as ExecutionContext;
    return { context, request };
  }

  beforeEach(() => {
    jwtService = { verifyAsync: jest.fn().mockResolvedValue(payload) };
    prisma = {
      token_thu_hoi: { findUnique: jest.fn() },
      nguoi_dung: {
        findUnique: jest.fn().mockResolvedValue({
          id: payload.sub,
          ten_dang_nhap: payload.ten_dang_nhap,
          vai_tro: payload.vai_tro,
          don_vi_id: payload.don_vi_id,
          hoc_vien_id: payload.hoc_vien_id,
          phai_doi_mat_khau: false,
          trang_thai: 'active',
        }),
      },
    };
    reflector = { getAllAndOverride: jest.fn().mockReturnValue(false) };
    guard = new JwtAuthGuard(
      jwtService as never,
      prisma as unknown as PrismaService,
      reflector as unknown as Reflector,
    );
  });

  it('token CHƯA bị thu hồi -> cho qua, gắn jti/exp vào request.user', async () => {
    prisma.token_thu_hoi.findUnique.mockResolvedValue(null);
    const { context, request } = buildContext({
      authorization: 'Bearer token-hop-le',
    });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(prisma.token_thu_hoi.findUnique).toHaveBeenCalledWith({
      where: { jti: payload.jti },
    });
    expect(request.user).toMatchObject({
      id: payload.sub,
      jti: payload.jti,
      exp: payload.exp,
    });
  });

  it('token ĐÃ bị thu hồi -> 401, không tới bước tra nguoi_dung', async () => {
    prisma.token_thu_hoi.findUnique.mockResolvedValue({
      jti: payload.jti,
      nguoi_dung_id: payload.sub,
      het_han: new Date(payload.exp * 1000),
      thu_hoi_luc: new Date(),
    });
    const { context } = buildContext({ authorization: 'Bearer token-cu' });

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedAppException,
    );
    expect(prisma.nguoi_dung.findUnique).not.toHaveBeenCalled();
  });
});
