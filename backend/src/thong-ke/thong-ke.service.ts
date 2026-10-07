import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { ThongKeQueryDto } from './dto/thong-ke-query.dto';
import { ThongKeScopeService } from './thong-ke-scope.service';
import { ThangMucService, MucThang } from '../sso/thang-muc.service';
import { ValidationException } from '../common/exceptions/app.exceptions';
import {
  ChuyenMucResult,
  KetQuaHocCot,
  KhaoSatResult,
  MucDem,
  PheuCounts,
  PheuResult,
  SoSanhKhoaCot,
} from './thong-ke.types';

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

const soTenKhoa = (a: { ten_khoa: string }, b: { ten_khoa: string }) =>
  a.ten_khoa.localeCompare(b.ten_khoa, 'vi');

@Injectable()
export class ThongKeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: ThongKeScopeService,
    private readonly thangMuc: ThangMucService,
  ) {}

  async pheu(user: AuthenticatedUser, q: ThongKeQueryDto): Promise<PheuResult> {
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

  async khaoSat(
    user: AuthenticatedUser,
    q: ThongKeQueryDto,
  ): Promise<KhaoSatResult> {
    const [{ where, rong }, thang] = await Promise.all([
      this.scope.resolve(user, q),
      this.thangMuc.thang(),
    ]);
    if (rong) return this.khaoSatRong(thang);

    const [{ tham_gia }, nhom] = await Promise.all([
      this.demPheu(where),
      this.prisma.ket_qua_khao_sat.groupBy({
        by: ['loai', 'muc_goc'],
        where: {
          trang_thai: 'hoan_thanh',
          hoc_vien: { dang_ky_hoc: { some: where } },
        },
        _count: { _all: true },
      }),
    ]);

    const theoLoai = (loai: string) => {
      const dong = nhom.filter((n) => n.loai === loai);
      const hoanThanh = dong.reduce((t, n) => t + n._count._all, 0);
      return { dong, hoanThanh, chua_lam: tham_gia - hoanThanh };
    };
    const khoiMuc = (loai: string) => {
      const { dong, hoanThanh, chua_lam } = theoLoai(loai);
      const theo_muc = thang.map((m) => ({
        ...m,
        so_luong: dong
          .filter((n) => n.muc_goc === m.ma)
          .reduce((t, n) => t + n._count._all, 0),
      }));
      const xep = theo_muc.reduce((t, m) => t + m.so_luong, 0);
      return { theo_muc, chua_xep_muc: hoanThanh - xep, chua_lam };
    };

    const kns = theoLoai(LOAI_KY_NANG_SO);
    return {
      ky_nang_so: { hoan_thanh: kns.hoanThanh, chua: kns.chua_lam },
      dau_vao: khoiMuc(LOAI_DAU_VAO),
      dau_ra: khoiMuc(LOAI_DAU_RA),
    };
  }

  async chuyenMuc(
    user: AuthenticatedUser,
    q: ThongKeQueryDto,
  ): Promise<ChuyenMucResult> {
    const [{ where, rong }, thang] = await Promise.all([
      this.scope.resolve(user, q),
      this.thangMuc.thang(),
    ]);
    const rows = rong
      ? []
      : await this.prisma.ket_qua_khao_sat.findMany({
          where: {
            loai: { in: [LOAI_DAU_VAO, LOAI_DAU_RA] },
            trang_thai: 'hoan_thanh',
            hoc_vien: { dang_ky_hoc: { some: where } },
          },
          select: { hoc_vien_id: true, loai: true, muc_goc: true },
        });

    const thuTu = (ma: string | null) => thang.findIndex((m) => m.ma === ma);
    const cap = new Map<string, { vao?: string; ra?: string }>();
    for (const r of rows) {
      if (thuTu(r.muc_goc) < 0 || !r.muc_goc) continue;
      const c = cap.get(r.hoc_vien_id) ?? {};
      if (r.loai === LOAI_DAU_VAO) c.vao = r.muc_goc;
      else c.ra = r.muc_goc;
      cap.set(r.hoc_vien_id, c);
    }

    const dem = new Map<string, number>();
    let tong = 0;
    let tang = 0;
    let giu = 0;
    let giam = 0;
    for (const { vao, ra } of cap.values()) {
      if (!vao || !ra) continue;
      tong++;
      dem.set(`${vao}|${ra}`, (dem.get(`${vao}|${ra}`) ?? 0) + 1);
      const d = thuTu(ra) - thuTu(vao);
      if (d > 0) tang++;
      else if (d < 0) giam++;
      else giu++;
    }

    const o = thang.flatMap((tu) =>
      thang.map((den) => ({
        tu: tu.ma,
        den: den.ma,
        so_luong: dem.get(`${tu.ma}|${den.ma}`) ?? 0,
      })),
    );
    return { thang, o, tong, tang, giu, giam };
  }

  async ketQuaHoc(
    user: AuthenticatedUser,
    q: ThongKeQueryDto,
  ): Promise<KetQuaHocCot[]> {
    const { where, rong } = await this.scope.resolve(user, q);
    if (rong) return [];

    const nhom = await this.prisma.dang_ky_hoc.groupBy({
      by: ['khoa_id', 'ket_qua'],
      where,
      _count: { _all: true },
    });
    const tenKhoa = await this.tenKhoa(nhom.map((n) => n.khoa_id));

    const cot = new Map<string, KetQuaHocCot>();
    for (const n of nhom) {
      const c = cot.get(n.khoa_id) ?? {
        khoa_id: n.khoa_id,
        ten_khoa: tenKhoa.get(n.khoa_id) ?? '',
        dat: 0,
        khong_dat: 0,
        vang: 0,
        dang_hoc: 0,
      };
      c[n.ket_qua ?? 'dang_hoc'] += n._count._all;
      cot.set(n.khoa_id, c);
    }
    return [...cot.values()].sort(soTenKhoa);
  }

  async soSanhKhoa(
    user: AuthenticatedUser,
    q: ThongKeQueryDto,
  ): Promise<SoSanhKhoaCot[]> {
    if (q.khoa_id) {
      throw new ValidationException(
        'So sánh khóa chỉ dùng khi chọn Tất cả khóa',
      );
    }
    const { where, rong } = await this.scope.resolve(user, q);
    if (rong) return [];

    const khoaIds = (
      await this.prisma.dang_ky_hoc.groupBy({ by: ['khoa_id'], where })
    ).map((k) => k.khoa_id);
    const tenKhoa = await this.tenKhoa(khoaIds);

    const cot = await Promise.all(
      khoaIds.map(async (khoa_id): Promise<SoSanhKhoaCot> => {
        const whereKhoa = { AND: [where, { khoa_id }] };
        const [pheu, dat] = await Promise.all([
          this.demPheu(whereKhoa),
          this.prisma.dang_ky_hoc.count({
            where: { AND: [where, { khoa_id, ket_qua: 'dat' }] },
          }),
        ]);
        const tyLe = (tu: number) =>
          pheu.tham_gia > 0 ? tu / pheu.tham_gia : null;
        return {
          khoa_id,
          ten_khoa: tenKhoa.get(khoa_id) ?? '',
          tham_gia: pheu.tham_gia,
          ty_le_truy_cap: tyLe(pheu.da_truy_cap),
          ty_le_dau_vao: tyLe(pheu.danh_gia_dau_vao),
          ty_le_dat: tyLe(dat),
        };
      }),
    );
    return cot.sort(soTenKhoa);
  }

  private async tenKhoa(ids: string[]): Promise<Map<string, string>> {
    const khoa = await this.prisma.khoa_boi_duong.findMany({
      where: { id: { in: ids } },
      select: { id: true, ten_khoa: true },
    });
    return new Map(khoa.map((k) => [k.id, k.ten_khoa]));
  }

  private khaoSatRong(thang: MucThang[]): KhaoSatResult {
    const khoi = () => ({
      theo_muc: thang.map((m): MucDem => ({ ...m, so_luong: 0 })),
      chua_xep_muc: 0,
      chua_lam: 0,
    });
    return {
      ky_nang_so: { hoan_thanh: 0, chua: 0 },
      dau_vao: khoi(),
      dau_ra: khoi(),
    };
  }

  // Cùng điều kiện trang Admin "Hồ sơ chờ duyệt": hoc_vien.trang_thai = cho_duyet.
  private demHoSoChoDuyet(where: Prisma.dang_ky_hocWhereInput) {
    return this.prisma.hoc_vien.count({
      where: { trang_thai: 'cho_duyet', dang_ky_hoc: { some: where } },
    });
  }
}
