import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ScopeService } from '../auth/scope/scope.service';
import { ForbiddenAppException } from '../common/exceptions/app.exceptions';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';

/** Chương trình đơn vị đang tham gia — mở rộng được (vd. thêm `hsg` sau). */
export interface ChuongTrinhCuaToi {
  nls: boolean;
}

// Issue #70 / ADR 0015 P1: nhóm menu NLS trên Cổng đơn vị chỉ hiện khi phạm vi của đơn vị
// (trường: chính nó; Phòng/Sở: cả cây con) có ít nhất 1 học viên NLS.
@Injectable()
export class ToiChuongTrinhService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: ScopeService,
  ) {}

  async cuaToi(user: AuthenticatedUser): Promise<ChuongTrinhCuaToi> {
    if (!user.don_vi_id) {
      throw new ForbiddenAppException(
        'Tài khoản chưa gắn đơn vị — liên hệ HCMUE để được gắn đơn vị',
      );
    }
    const phamVi = await this.scope.getAccessibleDonViIds(user);
    if (phamVi === 'ALL') {
      // Controller chỉ cho truong/phong_vhxh/so_gddt — không bao giờ tới đây.
      throw new ForbiddenAppException('Không có quyền');
    }
    // EXISTS: chỉ cần 1 dòng, không đếm cả bảng hoc_vien.
    const hv = await this.prisma.hoc_vien.findFirst({
      where: { don_vi_cong_tac_id: { in: phamVi } },
      select: { id: true },
    });
    return { nls: hv !== null };
  }
}
