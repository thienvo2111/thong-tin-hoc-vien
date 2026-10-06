import { Controller, Get } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { PrismaService } from '../prisma/prisma.service';
import { HoTroGiangVienScopeService } from './ho-tro-giang-vien-scope.service';

// ADR 0004 (issue #14): khu người hỗ trợ giảng viên. Tiền tố API
// /ho-tro-giang-vien (trang frontend ở /ho-tro-gv — không trùng tiền tố).
@Roles('ho_tro_giang_vien')
@Controller('ho-tro-giang-vien')
export class HoTroGiangVienController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: HoTroGiangVienScopeService,
  ) {}

  // Lớp trong phạm vi (hiện = mọi lớp của các khóa trong nhóm).
  @Get('lop-cua-toi')
  async lopCuaToi(@CurrentUser() user: AuthenticatedUser) {
    return this.prisma.lop_hoc.findMany({
      where: await this.scope.whereLopTrongPhamVi(user.id),
      select: {
        id: true,
        ten_lop: true,
        loai_lop: true,
        trang_thai: true,
        khoa: { select: { id: true, ma_khoa: true, ten_khoa: true } },
        _count: { select: { lich_hoc: true } },
      },
      orderBy: [
        { khoa: { ma_khoa: 'asc' } },
        { loai_lop: 'asc' },
        { ten_lop: 'asc' },
      ],
    });
  }
}
