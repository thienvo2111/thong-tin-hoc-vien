import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { buildBieuMauDangKyTruyCapWorkbook } from '../bao-cao/util/report-excel.util';
import { DOI_TUONG_LABEL } from '../thong-bao/mau-email/mau-email';
import { ThongKeScopeService } from './thong-ke-scope.service';
import { ThongKeQueryDto } from './dto/thong-ke-query.dto';
import {
  BieuMauDangKyTruyCap,
  CAP_BIEU_MAU,
  CapKey,
  DemDkTc,
  DOI_TUONG_BIEU_MAU,
  DoiTuongKey,
  DongHocVienBieuMau,
  DongTruongBieuMau,
  MoTaBieuMau,
} from './thong-ke.types';

const khoiTao = <K extends string>(khoa: readonly K[]): Record<K, DemDkTc> =>
  Object.fromEntries(khoa.map((k) => [k, { dk: 0, tc: 0 }])) as Record<
    K,
    DemDkTc
  >;

const them = (o: DemDkTc, daTruyCap: boolean) => {
  o.dk += 1;
  if (daTruyCap) o.tc += 1;
};

const chuanDoiTuong = (v: string | null): DoiTuongKey =>
  (DOI_TUONG_BIEU_MAU as readonly string[]).includes(v ?? '')
    ? (v as DoiTuongKey)
    : 'chua_xac_dinh';

const chuanCap = (v: string | null): CapKey =>
  (CAP_BIEU_MAU as readonly string[]).includes(v ?? '')
    ? (v as CapKey)
    : 'chua_xac_dinh';

/** Đầu vào đã khử trùng theo hoc_vien_id. */
export function tongHopDangKyTruyCap(
  rows: DongHocVienBieuMau[],
): BieuMauDangKyTruyCap {
  const tong: DemDkTc = { dk: 0, tc: 0 };
  const maTran = Object.fromEntries(
    DOI_TUONG_BIEU_MAU.map((d) => [d, khoiTao(CAP_BIEU_MAU)]),
  ) as Record<DoiTuongKey, Record<CapKey, DemDkTc>>;
  const truong = new Map<string, DongTruongBieuMau>();

  for (const r of rows) {
    const dt = chuanDoiTuong(r.doi_tuong);
    const cap = chuanCap(r.cap_giang_day);
    let t = truong.get(r.don_vi_id);
    if (!t) {
      t = {
        don_vi_id: r.don_vi_id,
        ten_don_vi: r.ten_don_vi,
        ten_don_vi_cha: r.ten_don_vi_cha,
        tong: { dk: 0, tc: 0 },
        theo_doi_tuong: khoiTao(DOI_TUONG_BIEU_MAU),
        theo_cap: khoiTao(CAP_BIEU_MAU),
      };
      truong.set(r.don_vi_id, t);
    }
    them(tong, r.da_truy_cap);
    them(maTran[dt][cap], r.da_truy_cap);
    them(t.tong, r.da_truy_cap);
    them(t.theo_doi_tuong[dt], r.da_truy_cap);
    them(t.theo_cap[cap], r.da_truy_cap);
  }

  const sapXep = (a: DongTruongBieuMau, b: DongTruongBieuMau) =>
    (a.ten_don_vi_cha ?? '').localeCompare(b.ten_don_vi_cha ?? '', 'vi') ||
    a.ten_don_vi.localeCompare(b.ten_don_vi, 'vi');
  return {
    tong,
    ma_tran: maTran,
    theo_truong: [...truong.values()].sort(sapXep),
  };
}

@Injectable()
export class BieuMauService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: ThongKeScopeService,
  ) {}

  async xuatDangKyTruyCap(
    user: AuthenticatedUser,
    q: ThongKeQueryDto,
  ): Promise<Buffer> {
    const phamVi = await this.scope.resolve(user, q);
    const rows = phamVi.rong ? [] : await this.layHocVien(phamVi.where);
    return buildBieuMauDangKyTruyCapWorkbook(
      tongHopDangKyTruyCap(rows),
      await this.moTa(q),
    );
  }

  private async layHocVien(
    where: Prisma.dang_ky_hocWhereInput,
  ): Promise<DongHocVienBieuMau[]> {
    const dks = await this.prisma.dang_ky_hoc.findMany({
      where,
      select: {
        hoc_vien_id: true,
        hoc_vien: {
          select: {
            doi_tuong: true,
            cap_giang_day: true,
            don_vi_cong_tac_id: true,
            don_vi_cong_tac: {
              select: {
                ten_don_vi: true,
                don_vi_cha: { select: { ten_don_vi: true } },
              },
            },
            nguoi_dung_account: { select: { dang_nhap_lan_cuoi: true } },
          },
        },
      },
    });
    const theoHv = new Map<string, DongHocVienBieuMau>();
    for (const d of dks) {
      if (theoHv.has(d.hoc_vien_id)) continue;
      const h = d.hoc_vien;
      theoHv.set(d.hoc_vien_id, {
        hoc_vien_id: d.hoc_vien_id,
        doi_tuong: h.doi_tuong,
        cap_giang_day: h.cap_giang_day,
        don_vi_id: h.don_vi_cong_tac_id,
        ten_don_vi: h.don_vi_cong_tac.ten_don_vi,
        ten_don_vi_cha: h.don_vi_cong_tac.don_vi_cha?.ten_don_vi ?? null,
        da_truy_cap: h.nguoi_dung_account?.dang_nhap_lan_cuoi != null,
      });
    }
    return [...theoHv.values()];
  }

  private async moTa(q: ThongKeQueryDto): Promise<MoTaBieuMau> {
    const [khoa, donVi, cum] = await Promise.all([
      q.khoa_id
        ? this.prisma.khoa_boi_duong.findUnique({
            where: { id: q.khoa_id },
            select: { ten_khoa: true },
          })
        : null,
      q.don_vi_id
        ? this.prisma.don_vi_cong_tac.findUnique({
            where: { id: q.don_vi_id },
            select: { ten_don_vi: true },
          })
        : null,
      q.cum_id
        ? this.prisma.cum_hoc_vien.findUnique({
            where: { id: q.cum_id },
            select: { ten_cum: true },
          })
        : null,
    ]);
    let phamVi = 'Toàn bộ phạm vi tài khoản';
    if (donVi) phamVi = `Đơn vị ${donVi.ten_don_vi}`;
    if (cum) phamVi = `Cụm ${cum.ten_cum}`;
    let doiTuong = 'Tất cả đối tượng';
    if (q.doi_tuong) {
      doiTuong =
        q.doi_tuong === 'chua_xac_dinh'
          ? 'Chưa xác định'
          : DOI_TUONG_LABEL[q.doi_tuong];
    }
    return {
      khoa: khoa?.ten_khoa ?? 'Tất cả khóa',
      pham_vi: phamVi,
      doi_tuong: doiTuong,
      ngay_xuat: new Date(),
    };
  }
}
