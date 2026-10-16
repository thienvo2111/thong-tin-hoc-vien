import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { daBatDau, LichTomTat, tinhSiSoBuoi } from './doi-buoi-hoc.rules';

export type Db = PrismaService | Prisma.TransactionClient;

interface LopRef {
  id: string;
  ten_lop: string;
}

interface BanGhiDaDuyet {
  dang_ky_hoc_id: string;
  lich_nguon_id: string;
  lich_chot_id: string | null;
  lich_nguon: { lop_id: string; giai_doan_id: string };
}

interface SiSo {
  si_so: number;
  si_so_toi_da: number | null;
  so_cho_duyet: number;
}

interface DieuChinh {
  ra: { dang_ky_hoc_id: string; lop_chot: LopRef }[];
  vao: {
    dang_ky_hoc_id: string;
    lich_nguon_id: string;
    lop_nguon: LopRef;
  }[];
}

const LICH_TOM_TAT_SELECT = {
  id: true,
  lop_id: true,
  giai_doan_id: true,
  buoi_so: true,
  thoi_gian_bat_dau: true,
  lop: {
    select: {
      khoa_id: true,
      loai_lop: true,
      muc_nang_luc: true,
      trang_thai: true,
      si_so_toi_da: true,
      ten_lop: true,
    },
  },
} satisfies Prisma.lich_hoc_lopSelect;

const LOP_REF_SELECT = { select: { id: true, ten_lop: true } };

@Injectable()
export class DoiBuoiHocQueryService {
  constructor(private readonly prisma: PrismaService) {}

  async lichTomTat(
    ids: string[],
    db: Db = this.prisma,
  ): Promise<Map<string, LichTomTat>> {
    const unique = [...new Set(ids)];
    if (unique.length === 0) return new Map();
    const rows = await db.lich_hoc_lop.findMany({
      where: { id: { in: unique } },
      select: LICH_TOM_TAT_SELECT,
    });
    return new Map(rows.map((r) => [r.id, r as LichTomTat]));
  }

  async siSoBuoi(
    lichIds: string[],
    now: Date,
    db: Db = this.prisma,
  ): Promise<Map<string, SiSo>> {
    const lichMap = await this.lichTomTat(lichIds, db);
    const result = new Map<string, SiSo>();
    if (lichMap.size === 0) return result;
    const ids = [...lichMap.keys()];
    const lich = [...lichMap.values()];

    const [phanLop, daDuyetRaw, choDuyet] = await Promise.all([
      db.phan_lop_giai_doan.groupBy({
        by: ['lop_id', 'giai_doan_id'],
        where: {
          OR: lich.map((l) => ({
            lop_id: l.lop_id,
            giai_doan_id: l.giai_doan_id,
          })),
        },
        _count: { _all: true },
      }),
      this.layDaDuyet(
        { OR: [{ lich_nguon_id: { in: ids } }, { lich_chot_id: { in: ids } }] },
        db,
      ),
      db.doi_buoi_hoc.groupBy({
        by: ['lich_de_nghi_id'],
        where: { lich_de_nghi_id: { in: ids }, trang_thai: 'cho_duyet' },
        _count: { _all: true },
      }),
    ]);
    const daDuyet = await this.locHieuLuc(daDuyetRaw, db);

    const demPhanLop = new Map(
      phanLop.map((g) => [`${g.lop_id}|${g.giai_doan_id}`, g._count._all]),
    );
    const demCho = new Map(
      choDuyet.map((g) => [g.lich_de_nghi_id, g._count._all]),
    );
    for (const l of lich) {
      result.set(l.id, {
        si_so: tinhSiSoBuoi({
          so_phan_lop: demPhanLop.get(`${l.lop_id}|${l.giai_doan_id}`) ?? 0,
          so_doi_ra: daDuyet.filter((d) => d.lich_nguon_id === l.id).length,
          so_doi_vao: daDuyet.filter((d) => d.lich_chot_id === l.id).length,
        }),
        si_so_toi_da: l.lop.si_so_toi_da,
        so_cho_duyet: daBatDau(l, now) ? 0 : (demCho.get(l.id) ?? 0),
      });
    }
    return result;
  }

  async dieuChinhTheoBuoi(lichIds: string[]): Promise<Map<string, DieuChinh>> {
    const result = new Map<string, DieuChinh>();
    for (const id of lichIds) result.set(id, { ra: [], vao: [] });
    if (lichIds.length === 0) return result;

    const raw = await this.prisma.doi_buoi_hoc.findMany({
      where: {
        trang_thai: 'da_duyet',
        OR: [
          { lich_nguon_id: { in: lichIds } },
          { lich_chot_id: { in: lichIds } },
        ],
      },
      select: {
        dang_ky_hoc_id: true,
        lich_nguon_id: true,
        lich_chot_id: true,
        lich_nguon: {
          select: { lop_id: true, giai_doan_id: true, lop: LOP_REF_SELECT },
        },
        lich_chot: { select: { lop: LOP_REF_SELECT } },
      },
    });
    for (const r of await this.locHieuLuc(raw, this.prisma)) {
      if (!r.lich_chot_id || !r.lich_chot) continue;
      result.get(r.lich_nguon_id)?.ra.push({
        dang_ky_hoc_id: r.dang_ky_hoc_id,
        lop_chot: r.lich_chot.lop,
      });
      result.get(r.lich_chot_id)?.vao.push({
        dang_ky_hoc_id: r.dang_ky_hoc_id,
        lich_nguon_id: r.lich_nguon_id,
        lop_nguon: r.lich_nguon.lop,
      });
    }
    return result;
  }

  async doiBuoiDaDuyetCuaDangKy(
    dangKyIds: string[],
  ): Promise<
    { dang_ky_hoc_id: string; lich_nguon_id: string; lich_chot_id: string }[]
  > {
    if (dangKyIds.length === 0) return [];
    const raw = await this.layDaDuyet(
      { dang_ky_hoc_id: { in: dangKyIds } },
      this.prisma,
    );
    const hieuLuc = await this.locHieuLuc(raw, this.prisma);
    return hieuLuc.flatMap((r) =>
      r.lich_chot_id
        ? [
            {
              dang_ky_hoc_id: r.dang_ky_hoc_id,
              lich_nguon_id: r.lich_nguon_id,
              lich_chot_id: r.lich_chot_id,
            },
          ]
        : [],
    );
  }

  private layDaDuyet(
    where: Prisma.doi_buoi_hocWhereInput,
    db: Db,
  ): Promise<BanGhiDaDuyet[]> {
    return db.doi_buoi_hoc.findMany({
      where: { ...where, trang_thai: 'da_duyet' },
      select: {
        dang_ky_hoc_id: true,
        lich_nguon_id: true,
        lich_chot_id: true,
        lich_nguon: { select: { lop_id: true, giai_doan_id: true } },
      },
    });
  }

  // Bản ghi da_duyet chỉ hiệu lực khi phân lớp HIỆN TẠI của đăng ký ở giai
  // đoạn buổi nguồn vẫn là lớp của buổi nguồn (Quản trị có thể import phân lớp lại).
  private async locHieuLuc<T extends BanGhiDaDuyet>(
    rows: T[],
    db: Db,
  ): Promise<T[]> {
    if (rows.length === 0) return [];
    const hienTai = await db.phan_lop_giai_doan.findMany({
      where: {
        OR: rows.map((r) => ({
          dang_ky_hoc_id: r.dang_ky_hoc_id,
          giai_doan_id: r.lich_nguon.giai_doan_id,
        })),
      },
      select: { dang_ky_hoc_id: true, giai_doan_id: true, lop_id: true },
    });
    const lopHienTai = new Map(
      hienTai.map((p) => [`${p.dang_ky_hoc_id}|${p.giai_doan_id}`, p.lop_id]),
    );
    return rows.filter(
      (r) =>
        lopHienTai.get(`${r.dang_ky_hoc_id}|${r.lich_nguon.giai_doan_id}`) ===
        r.lich_nguon.lop_id,
    );
  }
}
