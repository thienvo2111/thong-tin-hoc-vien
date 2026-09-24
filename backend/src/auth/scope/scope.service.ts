import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthenticatedUser } from '../interfaces/jwt-payload.interface';

export type DonViScope = 'ALL' | string[];

// Phân quyền scope-based — docs/api-contract.md mục "Quy ước chung > Phân
// quyền scope-based". KHÔNG có bảng ACL riêng: phạm vi suy ra từ việc đi
// XUỐNG cây don_vi_cong_tac.don_vi_cha_id, tìm mọi đơn vị con (trực tiếp +
// gián tiếp) của don_vi_id của người gọi — không phải đi lên.
//
//   quan_tri    -> toàn hệ thống
//   so_gddt     -> đơn vị mình + mọi đơn vị con trong cây (Phòng VHXH, Trường...)
//   phong_vhxh  -> đơn vị mình + đơn vị con trong cây (thực tế là Trường
//                  MN/TH/THCS trên địa bàn xã mình, vì đó là cách cây được
//                  thiết lập — không cần logic riêng theo dia_ban_id)
//   truong      -> chỉ đơn vị mình
//   hoc_vien    -> không có phạm vi theo don_vi (xem hồ sơ qua hoc_vien_id
//                  riêng, dùng canAccessHocSo)
@Injectable()
export class ScopeService {
  constructor(private readonly prisma: PrismaService) {}

  async getAccessibleDonViIds(caller: {
    vai_tro: AuthenticatedUser['vai_tro'];
    don_vi_id: string | null;
  }): Promise<DonViScope> {
    if (caller.vai_tro === 'quan_tri') {
      return 'ALL';
    }
    if (!caller.don_vi_id) {
      return [];
    }
    if (caller.vai_tro === 'truong') {
      return [caller.don_vi_id];
    }
    if (caller.vai_tro === 'so_gddt' || caller.vai_tro === 'phong_vhxh') {
      return this.collectDescendantIds(caller.don_vi_id);
    }
    // hoc_vien: không quản lý don_vi nào.
    return [];
  }

  async canAccessDonVi(
    caller: { vai_tro: AuthenticatedUser['vai_tro']; don_vi_id: string | null },
    targetDonViId: string,
  ): Promise<boolean> {
    const scope = await this.getAccessibleDonViIds(caller);
    if (scope === 'ALL') return true;
    return scope.includes(targetDonViId);
  }

  // Phạm vi hồ sơ học viên: quan_tri/so_gddt/phong_vhxh/truong xét theo
  // don_vi_cong_tac_id của hồ sơ (canAccessDonVi); hoc_vien chỉ xem hồ sơ
  // của chính mình.
  canAccessHocSo(
    caller: {
      vai_tro: AuthenticatedUser['vai_tro'];
      hoc_vien_id: string | null;
    },
    targetHocVienId: string,
  ): boolean {
    if (caller.vai_tro !== 'hoc_vien') {
      throw new Error(
        'canAccessHocSo chỉ dùng cho vai_tro=hoc_vien, các vai trò khác dùng canAccessDonVi',
      );
    }
    return caller.hoc_vien_id === targetHocVienId;
  }

  private async collectDescendantIds(rootId: string): Promise<string[]> {
    const visited = new Set<string>([rootId]);
    let frontier = [rootId];
    while (frontier.length > 0) {
      const children = await this.prisma.don_vi_cong_tac.findMany({
        where: { don_vi_cha_id: { in: frontier } },
        select: { id: true },
      });
      const newIds = children.map((c) => c.id).filter((id) => !visited.has(id));
      if (newIds.length === 0) break;
      newIds.forEach((id) => visited.add(id));
      frontier = newIds;
    }
    return Array.from(visited);
  }
}
