import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { UnauthorizedAppException } from '../../common/exceptions/app.exceptions';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { JwtPayload } from '../interfaces/jwt-payload.interface';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractToken(request);
    if (!token) {
      throw new UnauthorizedAppException('Thiếu token xác thực');
    }

    let payload: JwtPayload;
    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(token);
    } catch {
      throw new UnauthorizedAppException('Token không hợp lệ hoặc đã hết hạn');
    }

    const nguoiDung = await this.prisma.nguoi_dung.findUnique({
      where: { id: payload.sub },
    });
    if (!nguoiDung || nguoiDung.trang_thai !== 'active') {
      throw new UnauthorizedAppException(
        'Tài khoản không tồn tại hoặc đã bị vô hiệu hóa',
      );
    }

    (request as Request & { user: unknown }).user = {
      id: nguoiDung.id,
      ten_dang_nhap: nguoiDung.ten_dang_nhap,
      vai_tro: nguoiDung.vai_tro,
      don_vi_id: nguoiDung.don_vi_id,
      hoc_vien_id: nguoiDung.hoc_vien_id,
      phai_doi_mat_khau: nguoiDung.phai_doi_mat_khau,
    };
    return true;
  }

  private extractToken(request: Request): string | undefined {
    const header = request.headers.authorization;
    if (!header) return undefined;
    const [type, token] = header.split(' ');
    return type === 'Bearer' ? token : undefined;
  }
}
