import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { ForbiddenAppException } from '../common/exceptions/app.exceptions';
import { locDoiTuong, ThongKeScopeService } from './thong-ke-scope.service';
import { ChiSoXepHang, XepHangQueryDto } from './dto/thong-ke-query.dto';
import { XepHangDong, XepHangResult } from './thong-ke.types';

const SO_HV_TOI_THIEU = 5;
const SO_DONG = 10;
const TONG_SO_TOI_THIEU_TRUNG_BINH = 3;

interface DonViNut {
  id: string;
  ten_don_vi: string;
  don_vi_cha_id: string | null;
  loai_don_vi: string;
}

interface DangKyRow {
  hoc_vien_id: string;
  ket_qua: string | null;
  hoc_vien: {
    don_vi_cong_tac_id: string | null;
    nguoi_dung_account: { dang_nhap_lan_cuoi: Date | null } | null;
    ket_qua_khao_sat: { id: string }[];
  };
}

interface NhomDem {
  hv: Set<string>;
  truyCap: Set<string>;
  khaoSat: Set<string>;
  luot: number;
  dat: number;
}

@Injectable()
export class XepHangService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: ThongKeScopeService,
  ) {}

  async xepHang(
    user: AuthenticatedUser,
    q: XepHangQueryDto,
  ): Promise<XepHangResult> {
    if (user.vai_tro === 'ho_tro_hoc_vien') {
      throw new ForbiddenAppException('Không có quyền xem xếp hạng đơn vị');
    }
    // Luôn resolve trước: kiểm quyền/hình dạng bộ lọc cho mọi vai trò.
    const phamVi = await this.scope.resolve(user, q);
    const laTruong = user.vai_tro === 'truong';
    if (phamVi.rong) return laTruong ? viTriRong() : bangRong();

    const nut = await this.prisma.don_vi_cong_tac.findMany({
      select: {
        id: true,
        ten_don_vi: true,
        don_vi_cha_id: true,
        loai_don_vi: true,
      },
    });
    const byId = new Map(nut.map((n) => [n.id, n]));

    if (laTruong) return this.viTri(user, q, nut, byId);

    if (user.vai_tro === 'quan_tri' && !q.don_vi_id) {
      return bang(await this.quanTriToanCuc(phamVi.where, nut, byId, q));
    }
    const nhom = truongTrongCay(nut, q.don_vi_id ?? user.don_vi_id);
    const dong = await this.tinh(phamVi.where, nhom, byId, q.chi_so);
    return bang(dong);
  }

  // Quản trị toàn cục: xếp theo Sở/Phòng gốc; xuống cấp trường khi có khoa_id
  // hoặc khi ≤ 1 nhóm gốc đủ học viên (không có gì để so sánh ở cấp gốc).
  private async quanTriToanCuc(
    where: Prisma.dang_ky_hocWhereInput,
    nut: DonViNut[],
    byId: Map<string, DonViNut>,
    q: XepHangQueryDto,
  ): Promise<XepHangDong[]> {
    const truong = new Set(
      nut.filter((n) => n.loai_don_vi === 'truong').map((n) => n.id),
    );
    if (q.khoa_id) return this.tinh(where, truong, byId, q.chi_so);
    const goc = new Set(nut.filter(laNhomGoc).map((n) => n.id));
    const dongGoc = await this.tinh(where, goc, byId, q.chi_so);
    if (dongGoc.length > 1) return dongGoc;
    return this.tinh(where, truong, byId, q.chi_so);
  }

  // Trường: chỉ trả số tổng hợp, tuyệt đối không trả id/tên đơn vị khác.
  private async viTri(
    user: AuthenticatedUser,
    q: XepHangQueryDto,
    nut: DonViNut[],
    byId: Map<string, DonViNut>,
  ): Promise<XepHangResult> {
    const cha = user.don_vi_id ? byId.get(user.don_vi_id)?.don_vi_cha_id : null;
    if (!cha) return viTriRong();
    const nhom = truongTrongCay(nut, cha);
    if (nhom.size === 0) return viTriRong();
    // Tập so sánh nằm ngoài phạm vi thường của trường nên không dùng where scope.
    const where: Prisma.dang_ky_hocWhereInput = {
      AND: [
        q.khoa_id ? { khoa_id: q.khoa_id } : {},
        { hoc_vien: { don_vi_cong_tac_id: { in: [...nhom].sort() } } },
        ...(q.doi_tuong ? [locDoiTuong(q.doi_tuong)] : []),
      ],
    };
    const dong = await this.tinh(where, nhom, byId, q.chi_so);
    const xep = sapXep(dong);
    const chiSoMinh = xep.findIndex((d) => d.don_vi_id === user.don_vi_id);
    return {
      kieu: 'vi_tri',
      thu_hang: chiSoMinh >= 0 ? thuHang(xep, chiSoMinh) : null,
      tong_so: xep.length,
      gia_tri: chiSoMinh >= 0 ? xep[chiSoMinh].gia_tri : null,
      // Nhóm < 3 trường: trung bình để lộ giá trị trường còn lại.
      trung_binh:
        xep.length >= TONG_SO_TOI_THIEU_TRUNG_BINH
          ? xep.reduce((s, d) => s + d.gia_tri, 0) / xep.length
          : null,
    };
  }

  private async tinh(
    where: Prisma.dang_ky_hocWhereInput,
    nhom: Set<string>,
    byId: Map<string, DonViNut>,
    chiSo: ChiSoXepHang,
  ): Promise<XepHangDong[]> {
    const rows = (await this.prisma.dang_ky_hoc.findMany({
      where,
      select: {
        hoc_vien_id: true,
        ket_qua: true,
        hoc_vien: {
          select: {
            don_vi_cong_tac_id: true,
            nguoi_dung_account: { select: { dang_nhap_lan_cuoi: true } },
            ket_qua_khao_sat: {
              where: { loai: 'danh-gia', trang_thai: 'hoan_thanh' },
              select: { id: true },
            },
          },
        },
      },
    })) as DangKyRow[];

    const cache = new Map<string, string | null>();
    const dem = new Map<string, NhomDem>();
    for (const r of rows) {
      const dvId = r.hoc_vien.don_vi_cong_tac_id;
      if (!dvId) continue;
      const g = nhomCua(dvId, nhom, byId, cache);
      if (!g) continue;
      let d = dem.get(g);
      if (!d) {
        d = {
          hv: new Set(),
          truyCap: new Set(),
          khaoSat: new Set(),
          luot: 0,
          dat: 0,
        };
        dem.set(g, d);
      }
      d.hv.add(r.hoc_vien_id);
      if (r.hoc_vien.nguoi_dung_account?.dang_nhap_lan_cuoi) {
        d.truyCap.add(r.hoc_vien_id);
      }
      if (r.hoc_vien.ket_qua_khao_sat.length > 0) d.khaoSat.add(r.hoc_vien_id);
      d.luot += 1;
      if (r.ket_qua === 'dat') d.dat += 1;
    }

    const dong: XepHangDong[] = [];
    for (const [id, d] of dem) {
      if (d.hv.size < SO_HV_TOI_THIEU) continue;
      const tu =
        chiSo === 'truy_cap'
          ? d.truyCap.size / d.hv.size
          : chiSo === 'khao_sat'
            ? d.khaoSat.size / d.hv.size
            : d.dat / d.luot;
      dong.push({
        don_vi_id: id,
        ten_don_vi: byId.get(id)?.ten_don_vi ?? '',
        so_hv: d.hv.size,
        gia_tri: tu,
      });
    }
    return dong;
  }
}

// Nhóm xếp hạng gốc của quản trị: Sở/Phòng không có đơn vị cha (bỏ trường mồ côi, 'khac').
const laNhomGoc = (n: DonViNut): boolean =>
  n.don_vi_cha_id === null &&
  (n.loai_don_vi === 'so_gddt' || n.loai_don_vi === 'phong_vhxh');

const bangRong = (): XepHangResult => ({
  kieu: 'bang',
  top: [],
  bottom: [],
  tong_so: 0,
});

const viTriRong = (): XepHangResult => ({
  kieu: 'vi_tri',
  thu_hang: null,
  tong_so: 0,
  gia_tri: null,
  trung_binh: null,
});

const sapXep = (dong: XepHangDong[]): XepHangDong[] =>
  [...dong].sort(
    (a, b) =>
      b.gia_tri - a.gia_tri || a.ten_don_vi.localeCompare(b.ten_don_vi, 'vi'),
  );

// Hạng 1-based, đồng hạng khi cùng giá trị.
function thuHang(xep: XepHangDong[], idx: number): number {
  return xep.filter((d) => d.gia_tri > xep[idx].gia_tri).length + 1;
}

function bang(dong: XepHangDong[]): XepHangResult {
  const xep = sapXep(dong);
  const top = xep.slice(0, SO_DONG);
  // Bottom không trùng top: chỉ lấy phần còn lại, tối đa 10, thấp nhất đứng đầu.
  const bottom = xep.slice(Math.max(SO_DONG, xep.length - SO_DONG)).reverse();
  return { kieu: 'bang', top, bottom, tong_so: xep.length };
}

// Mọi đơn vị loai 'truong' trong cây con của goc (kể cả goc).
function truongTrongCay(nut: DonViNut[], goc: string | null): Set<string> {
  if (!goc) return new Set();
  const con = new Map<string, string[]>();
  for (const n of nut) {
    if (!n.don_vi_cha_id) continue;
    const ds = con.get(n.don_vi_cha_id) ?? [];
    ds.push(n.id);
    con.set(n.don_vi_cha_id, ds);
  }
  const loai = new Map(nut.map((n) => [n.id, n.loai_don_vi]));
  const thay = new Set<string>();
  const ketQua = new Set<string>();
  const stack = [goc];
  while (stack.length) {
    const id = stack.pop() as string;
    if (thay.has(id)) continue;
    thay.add(id);
    if (loai.get(id) === 'truong') ketQua.add(id);
    stack.push(...(con.get(id) ?? []));
  }
  return ketQua;
}

// Đi lên từ đơn vị tới tổ tiên (hoặc chính nó) thuộc nhóm; null nếu ngoài nhóm.
function nhomCua(
  id: string,
  nhom: Set<string>,
  byId: Map<string, DonViNut>,
  cache: Map<string, string | null>,
): string | null {
  if (cache.has(id)) return cache.get(id) as string | null;
  const dua = new Set<string>();
  let cur: string | null = id;
  let kq: string | null = null;
  while (cur && !dua.has(cur)) {
    if (nhom.has(cur)) {
      kq = cur;
      break;
    }
    dua.add(cur);
    cur = byId.get(cur)?.don_vi_cha_id ?? null;
  }
  cache.set(id, kq);
  return kq;
}
