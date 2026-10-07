import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { ThongKeQueryDto } from './dto/thong-ke-query.dto';
import { ThongKeScopeService } from './thong-ke-scope.service';
import { PheuCounts, PheuResult } from './thong-ke.types';

// Loại bài khảo sát = giá trị `target` SSO (xem sso/dto/sso.dto.ts).
const LOAI_KY_NANG_SO = 'khao-sat';
const LOAI_DAU_VAO = 'danh-gia';
const LOAI_DAU_RA = 'dau-ra';

const PHEU_RONG: PheuCounts = {
  tham_gia: 0,
  da_truy_cap: 0,
  khao_sat_ky_nang_so: 0,
  danh_gia_dau_vao: 0,
  danh_gia_dau_ra: 0,
};

@Injectable()
export class ThongKeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: ThongKeScopeService,
  ) {}

  async pheu(
    user: AuthenticatedUser,
    q: ThongKeQueryDto,
  ): Promise<PheuResult> {
    const { where, rong } = await this.scope.resolve(user, q);
    const duyetHoSo = user.vai_tro !== 'ho_tro_hoc_vien';
    if (rong) return { ...PHEU_RONG, ho_so_cho_duyet: duyetHoSo ? 0 : null };

    const [pheu, hoSoChoDuyet] = await Promise.all([
      this.demPheu(where),
      duyetHoSo ? this.demHoSoChoDuyet(where) : Promise.resolve(null),
    ]);
    return { ...pheu, ho_so_cho_duyet: hoSoChoDuyet };
  }

  /** 5 mốc phễu, đếm học viên phân biệt trong phạm vi `where` (dang_ky_hoc). */
  async demPheu(where: Prisma.dang_ky_hocWhereInput): Promise<PheuCounts> {
    const dem = (extra: Prisma.hoc_vienWhereInput = {}) =>
      this.prisma.hoc_vien.count({
        where: { dang_ky_hoc: { some: where }, ...extra },
      });
    const hoanThanh = (loai: string): Prisma.hoc_vienWhereInput => ({
      ket_qua_khao_sat: { some: { loai, trang_thai: 'hoan_thanh' } },
    });

    const [
      tham_gia,
      da_truy_cap,
      khao_sat_ky_nang_so,
      danh_gia_dau_vao,
      danh_gia_dau_ra,
    ] = await Promise.all([
      dem(),
      dem({ nguoi_dung_account: { dang_nhap_lan_cuoi: { not: null } } }),
      dem(hoanThanh(LOAI_KY_NANG_SO)),
      dem(hoanThanh(LOAI_DAU_VAO)),
      dem(hoanThanh(LOAI_DAU_RA)),
    ]);
    return {
      tham_gia,
      da_truy_cap,
      khao_sat_ky_nang_so,
      danh_gia_dau_vao,
      danh_gia_dau_ra,
    };
  }

  // Cùng điều kiện trang Admin "Hồ sơ chờ duyệt": hoc_vien.trang_thai = cho_duyet.
  private demHoSoChoDuyet(where: Prisma.dang_ky_hocWhereInput) {
    return this.prisma.hoc_vien.count({
      where: { trang_thai: 'cho_duyet', dang_ky_hoc: { some: where } },
    });
  }
}
