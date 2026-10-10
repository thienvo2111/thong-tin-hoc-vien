import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { ThongKeQueryDto } from './dto/thong-ke-query.dto';
import { ThongKeScopeService } from './thong-ke-scope.service';
import { ThangMucService, MucThang } from '../sso/thang-muc.service';
import { ValidationException } from '../common/exceptions/app.exceptions';
import { HOC_VIEN_PHAI_KHAO_SAT } from '../common/utils/doi-tuong-khao-sat.util';
import {
  CheDoChuyenCan,
  DongDiemDanhBuoi,
  tinhChuyenCan,
} from '../common/utils/chuyen-can.util';
import {
  BuoiChuyenCan,
  ChuyenCanResult,
  ChuyenMucResult,
  KetQuaHocCot,
  KetQuaHocTruongDong,
  KhaoSatResult,
  KhoangVle,
  MucDem,
  PheuCounts,
  PheuResult,
  SoSanhKhoaCot,
  VleKhoang,
} from './thong-ke.types';

// Loại bài khảo sát = giá trị `target` SSO (xem sso/dto/sso.dto.ts).
const LOAI_KY_NANG_SO = 'khao-sat';
const LOAI_DAU_VAO = 'danh-gia';
const LOAI_DAU_RA = 'dau-ra';

const PHEU_RONG: PheuCounts = {
  tham_gia: 0,
  tham_gia_khao_sat: 0,
  da_truy_cap: 0,
  khao_sat_ky_nang_so: 0,
  danh_gia_dau_vao: 0,
  danh_gia_dau_ra: 0,
};

const KHOANG_VLE: KhoangVle[] = ['0-25', '25-50', '50-75', '75-100'];

// Biên thuộc khoảng trên; 100 thuộc '75-100'.
const khoangVle = (tyLe: number): KhoangVle =>
  KHOANG_VLE[Math.min(3, Math.floor(tyLe / 25))];

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
      tham_gia_khao_sat,
      da_truy_cap,
      khao_sat_ky_nang_so,
      danh_gia_dau_vao,
      danh_gia_dau_ra,
    ] = await Promise.all([
      dem(),
      // Nhân viên chưa triển khai khảo sát -> mẫu số riêng cho 3 tỷ lệ dưới.
      dem(HOC_VIEN_PHAI_KHAO_SAT),
      dem({ nguoi_dung_account: { dang_nhap_lan_cuoi: { not: null } } }),
      dem(hoanThanh(LOAI_KY_NANG_SO)),
      dem(hoanThanh(LOAI_DAU_VAO)),
      dem(hoanThanh(LOAI_DAU_RA)),
    ]);
    return {
      tham_gia,
      tham_gia_khao_sat,
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

    const [{ tham_gia_khao_sat }, nhom] = await Promise.all([
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
      return { dong, hoanThanh, chua_lam: tham_gia_khao_sat - hoanThanh };
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

  async ketQuaHocTheoTruong(
    user: AuthenticatedUser,
    q: ThongKeQueryDto,
  ): Promise<KetQuaHocTruongDong[]> {
    if (!q.khoa_id) {
      throw new ValidationException(
        'Cần chọn một khóa để xem kết quả theo trường',
      );
    }
    const { where, rong } = await this.scope.resolve(user, q);
    if (rong) return [];

    const rows = await this.prisma.dang_ky_hoc.findMany({
      where,
      select: {
        ket_qua: true,
        hoc_vien: {
          select: {
            don_vi_cong_tac_id: true,
            don_vi_cong_tac: { select: { ten_don_vi: true } },
          },
        },
      },
    });
    const dong = new Map<string, KetQuaHocTruongDong>();
    for (const r of rows) {
      const id = r.hoc_vien.don_vi_cong_tac_id;
      if (!id) continue;
      const d = dong.get(id) ?? {
        don_vi_id: id,
        ten_don_vi: r.hoc_vien.don_vi_cong_tac?.ten_don_vi ?? '',
        dat: 0,
        khong_dat: 0,
        vang: 0,
        dang_hoc: 0,
      };
      d[r.ket_qua ?? 'dang_hoc'] += 1;
      dong.set(id, d);
    }
    return [...dong.values()].sort((a, b) =>
      a.ten_don_vi.localeCompare(b.ten_don_vi, 'vi'),
    );
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
        const tyLe = (tu: number, mau: number) => (mau > 0 ? tu / mau : null);
        return {
          khoa_id,
          ten_khoa: tenKhoa.get(khoa_id) ?? '',
          tham_gia: pheu.tham_gia,
          ty_le_truy_cap: tyLe(pheu.da_truy_cap, pheu.tham_gia),
          // Nhân viên chưa triển khai khảo sát -> mẫu số riêng (tham_gia_khao_sat).
          ty_le_dau_vao: tyLe(pheu.danh_gia_dau_vao, pheu.tham_gia_khao_sat),
          ty_le_dat: tyLe(dat, pheu.tham_gia),
        };
      }),
    );
    return cot.sort(soTenKhoa);
  }

  async chuyenCan(
    user: AuthenticatedUser,
    q: ThongKeQueryDto,
  ): Promise<ChuyenCanResult> {
    const { where, rong } = await this.scope.resolve(user, q);
    if (rong) {
      return {
        truc_tiep: q.khoa_id ? [] : null,
        vle: { khoang: this.chiaKhoangVle([]), chua_co_du_lieu: 0 },
      };
    }
    const [truc_tiep, vle] = await Promise.all([
      q.khoa_id ? this.diemDanhTheoBuoi(where) : Promise.resolve(null),
      this.vleTheoKhoang(where),
    ]);
    return { truc_tiep, vle };
  }

  // ADR 0005 Z8 (issue #27): mỗi đăng ký đếm tối đa 1 lần mỗi (giai_doan,
  // buoi_so) — áp tinhChuyenCan theo chế độ của khóa (học viên chuyển lớp có
  // dòng ở cả lớp cũ và lớp mới).
  private async diemDanhTheoBuoi(
    where: Prisma.dang_ky_hocWhereInput,
  ): Promise<BuoiChuyenCan[]> {
    const dsDong = await this.prisma.diem_danh.findMany({
      where: {
        dang_ky_hoc: where,
        lich_hoc: { lop: { loai_lop: { in: ['truc_tiep', 'zoom'] } } },
      },
      select: {
        dang_ky_hoc_id: true,
        trang_thai: true,
        lich_hoc: {
          select: {
            lop_id: true,
            giai_doan_id: true,
            buoi_so: true,
            giai_doan: { select: { thu_tu: true } },
            lop: { select: { loai_lop: true } },
          },
        },
        dang_ky_hoc: {
          select: { khoa: { select: { che_do_chuyen_can: true } } },
        },
      },
    });
    if (dsDong.length === 0) return [];

    const phanLop = await this.prisma.phan_lop_giai_doan.findMany({
      where: { dang_ky_hoc: where },
      select: { dang_ky_hoc_id: true, giai_doan_id: true, lop_id: true },
    });
    const lopHienTai = new Map<string, Map<string, string>>();
    for (const p of phanLop) {
      const m = lopHienTai.get(p.dang_ky_hoc_id) ?? new Map<string, string>();
      m.set(p.giai_doan_id, p.lop_id);
      lopHienTai.set(p.dang_ky_hoc_id, m);
    }

    const thuTuGiaiDoan = new Map<string, number>();
    const theoDangKy = new Map<
      string,
      { cheDo: CheDoChuyenCan; dong: DongDiemDanhBuoi[] }
    >();
    for (const d of dsDong) {
      thuTuGiaiDoan.set(d.lich_hoc.giai_doan_id, d.lich_hoc.giai_doan.thu_tu);
      const nhom = theoDangKy.get(d.dang_ky_hoc_id) ?? {
        cheDo: d.dang_ky_hoc.khoa.che_do_chuyen_can,
        dong: [],
      };
      nhom.dong.push({
        lop_id: d.lich_hoc.lop_id,
        loai_lop: d.lich_hoc.lop.loai_lop,
        giai_doan_id: d.lich_hoc.giai_doan_id,
        buoi_so: d.lich_hoc.buoi_so,
        trang_thai: d.trang_thai,
      });
      theoDangKy.set(d.dang_ky_hoc_id, nhom);
    }

    const cot = new Map<string, BuoiChuyenCan>();
    for (const [dangKyId, { cheDo, dong }] of theoDangKy) {
      const kq = tinhChuyenCan(
        lopHienTai.get(dangKyId) ?? new Map(),
        dong,
        cheDo,
      );
      for (const [khoa, { trang_thai }] of kq) {
        const [giaiDoanId, buoi] = khoa.split('|');
        const thuTu = thuTuGiaiDoan.get(giaiDoanId) ?? 0;
        const buoiSo = Number(buoi);
        const k = `${thuTu}|${buoiSo}`;
        const c = cot.get(k) ?? {
          nhan: `GĐ${thuTu} · Buổi ${buoiSo}`,
          giai_doan_thu_tu: thuTu,
          buoi_so: buoiSo,
          co_mat: 0,
          vang_co_phep: 0,
          vang: 0,
          ty_le_co_mat: null,
        };
        c[trang_thai] += 1;
        cot.set(k, c);
      }
    }
    return [...cot.values()]
      .sort(
        (a, b) =>
          a.giai_doan_thu_tu - b.giai_doan_thu_tu || a.buoi_so - b.buoi_so,
      )
      .map((c) => {
        const tong = c.co_mat + c.vang_co_phep + c.vang;
        return { ...c, ty_le_co_mat: tong > 0 ? c.co_mat / tong : null };
      });
  }

  private async vleTheoKhoang(where: Prisma.dang_ky_hocWhereInput) {
    const [rows, chua_co_du_lieu] = await Promise.all([
      this.prisma.ket_qua_giai_doan.findMany({
        where: { dang_ky_hoc: where, ty_le_hoan_thanh: { not: null } },
        select: { ty_le_hoan_thanh: true },
      }),
      this.prisma.dang_ky_hoc.count({
        where: {
          AND: [
            where,
            {
              ket_qua_giai_doan: { none: { ty_le_hoan_thanh: { not: null } } },
            },
          ],
        },
      }),
    ]);
    const tyLe = rows.map((r) => Number(r.ty_le_hoan_thanh));
    return { khoang: this.chiaKhoangVle(tyLe), chua_co_du_lieu };
  }

  private chiaKhoangVle(tyLe: number[]): VleKhoang[] {
    const dem = new Map<KhoangVle, number>();
    for (const t of tyLe)
      dem.set(khoangVle(t), (dem.get(khoangVle(t)) ?? 0) + 1);
    return KHOANG_VLE.map((khoang) => ({
      khoang,
      so_luong: dem.get(khoang) ?? 0,
    }));
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
