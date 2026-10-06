import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BangKiemService } from '../bang-kiem/bang-kiem.service';

const MOT_NGAY_MS = 24 * 3600 * 1000;
const VAI_TRO_HO_TRO = ['ho_tro_hoc_vien', 'ho_tro_giang_vien'] as const;

// ADR 0004 G15 (issue #22): màn "Vận hành" — Quản trị GIÁM SÁT thay vì làm
// thay. Chỉ đọc; mỗi khối là 1 truy vấn độc lập (khối của lát chưa làm — mẫu
// biểu L6 — chưa có). Mỗi dòng mang đủ id để frontend dẫn sang màn xử lý.
@Injectable()
export class VanHanhService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bangKiem: BangKiemService,
  ) {}

  async tongHop(bayGio = new Date()) {
    const bayNgayTruoc = new Date(bayGio.getTime() - 7 * MOT_NGAY_MS);
    const [
      dotDo,
      deNghiCho,
      thayDoiLich,
      khoaChuaNhomGv,
      cumChuaHoTro,
      danhMucMoi,
    ] = await Promise.all([
      this.dotDo(bayGio),
      this.deNghiChoLau(new Date(bayGio.getTime() - 2 * MOT_NGAY_MS)),
      this.thayDoiLich(bayNgayTruoc),
      this.khoaChuaNhomGv(bayGio),
      this.cumChuaHoTro(bayGio),
      this.danhMucMoi(bayNgayTruoc),
    ]);
    return {
      dot_do: dotDo,
      de_nghi_cho_lau: deNghiCho,
      thay_doi_lich: thayDoiLich,
      khoa_chua_nhom_gv: khoaChuaNhomGv,
      cum_chua_ho_tro: cumChuaHoTro,
      danh_muc_moi: danhMucMoi,
    };
  }

  /** Đợt trực tiếp 21 ngày tới có mục bảng kiểm quá hạn, kèm nhóm hỗ trợ GV chịu trách nhiệm. */
  private async dotDo(bayGio: Date) {
    const ds = (await this.bangKiem.dsDotSapToi({}, 21, bayGio)).filter(
      (d) => d.mau === 'do',
    );
    const khoaIds = [...new Set(ds.map((d) => d.lop.khoa.id))];
    const nhom = khoaIds.length
      ? await this.prisma.phan_cong_ho_tro_gv.findMany({
          where: { khoa_id: { in: khoaIds } },
          select: { khoa_id: true, nguoi_dung: { select: { ho_ten: true } } },
        })
      : [];
    return ds.map((d) => ({
      lop: d.lop,
      giai_doan: d.giai_doan,
      buoi_dau: d.buoi_dau,
      so_qua_han: d.so_qua_han,
      muc_qua_han: d.muc_chua_dat
        .filter((m) => m.trang_thai === 'qua_han')
        .map((m) => m.ten),
      nhom_ho_tro_gv: nhom
        .filter((n) => n.khoa_id === d.lop.khoa.id)
        .map((n) => n.nguoi_dung.ho_ten),
    }));
  }

  /** Đề nghị đổi lớp chờ duyệt quá 48 giờ. */
  private async deNghiChoLau(moc: Date) {
    const ds = await this.prisma.de_nghi_doi_lop.findMany({
      where: { trang_thai: 'cho_duyet', tao_luc: { lt: moc } },
      select: {
        id: true,
        tao_luc: true,
        ly_do: true,
        dang_ky_hoc: {
          select: { hoc_vien: { select: { id: true, ho_ten: true } } },
        },
        lop_hien_tai: { select: { ten_lop: true } },
        lop_de_nghi: {
          select: {
            ten_lop: true,
            khoa: { select: { id: true, ma_khoa: true } },
          },
        },
        tao_boi: { select: { ho_ten: true } },
      },
      orderBy: { tao_luc: 'asc' },
      take: 200,
    });
    return ds.map((d) => ({
      id: d.id,
      tao_luc: d.tao_luc,
      ly_do: d.ly_do,
      hoc_vien: d.dang_ky_hoc.hoc_vien,
      tu_lop: d.lop_hien_tai?.ten_lop ?? null,
      den_lop: d.lop_de_nghi.ten_lop,
      khoa: d.lop_de_nghi.khoa,
      nguoi_tao: d.tao_boi?.ho_ten ?? null,
    }));
  }

  /** Thay đổi lịch 7 ngày qua (nhật ký sua_lich_hoc): ai, vai trò, lý do, trước → sau. */
  private async thayDoiLich(tu: Date) {
    const nk = await this.prisma.nhat_ky_hoat_dong.findMany({
      where: { hanh_dong: 'sua_lich_hoc', thoi_gian: { gte: tu } },
      select: {
        id: true,
        thoi_gian: true,
        nguoi_dung_id: true,
        vai_tro: true,
        chi_tiet: true,
      },
      orderBy: { thoi_gian: 'desc' },
      take: 200,
    });
    type ChiTiet = {
      mo_ta?: string;
      lop_id?: string;
      giai_doan_id?: string;
      truoc?: Record<string, unknown>;
      sau?: Record<string, unknown>;
      ly_do?: string | null;
    };
    const ct = nk.map((n) => (n.chi_tiet ?? {}) as ChiTiet);
    const [nguoi, lop] = await Promise.all([
      this.prisma.nguoi_dung.findMany({
        where: {
          id: {
            in: [
              ...new Set(
                nk.map((n) => n.nguoi_dung_id).filter((x): x is string => !!x),
              ),
            ],
          },
        },
        select: { id: true, ho_ten: true },
      }),
      this.prisma.lop_hoc.findMany({
        where: {
          id: {
            in: [
              ...new Set(
                ct.map((c) => c.lop_id).filter((x): x is string => !!x),
              ),
            ],
          },
        },
        select: {
          id: true,
          ten_lop: true,
          khoa: { select: { id: true, ma_khoa: true } },
        },
      }),
    ]);
    return nk.map((n, i) => ({
      id: n.id,
      thoi_gian: n.thoi_gian,
      nguoi: nguoi.find((x) => x.id === n.nguoi_dung_id)?.ho_ten ?? null,
      vai_tro: n.vai_tro,
      mo_ta: ct[i].mo_ta ?? null,
      ly_do: ct[i].ly_do ?? null,
      truoc: ct[i].truoc ?? null,
      sau: ct[i].sau ?? null,
      lop: lop.find((l) => l.id === ct[i].lop_id) ?? null,
      giai_doan_id: ct[i].giai_doan_id ?? null,
    }));
  }

  /** Khóa chưa kết thúc, có giai đoạn trực tiếp nhưng chưa có nhóm hỗ trợ GV. */
  private khoaChuaNhomGv(bayGio: Date) {
    return this.prisma.khoa_boi_duong.findMany({
      where: {
        thoi_gian_ket_thuc: { gte: bayGio },
        giai_doan: { some: { hinh_thuc: 'truc_tiep', trang_thai: 'active' } },
        phan_cong_ho_tro_gv: { none: {} },
      },
      select: {
        id: true,
        ma_khoa: true,
        ten_khoa: true,
        thoi_gian_bat_dau: true,
      },
      orderBy: { thoi_gian_bat_dau: 'asc' },
      take: 200,
    });
  }

  /** Cụm đang hoạt động của khóa chưa kết thúc, chưa có người hỗ trợ học viên, kèm số học viên. */
  private async cumChuaHoTro(bayGio: Date) {
    const ds = await this.prisma.cum_hoc_vien.findMany({
      where: {
        trang_thai: 'active',
        phan_cong_ho_tro: { none: {} },
        khoa: { thoi_gian_ket_thuc: { gte: bayGio } },
      },
      select: {
        id: true,
        ten_cum: true,
        khoa: { select: { id: true, ma_khoa: true } },
        _count: { select: { dang_ky_hoc: true } },
      },
      orderBy: { ten_cum: 'asc' },
      take: 200,
    });
    return ds.map(({ _count, ...c }) => ({
      ...c,
      so_hoc_vien: _count.dang_ky_hoc,
    }));
  }

  /** Điểm học / giảng viên do người hỗ trợ tạo trong 7 ngày qua — để Quản trị rà trùng, gộp. */
  private async danhMucMoi(tu: Date) {
    const doHoTro = { vai_tro: { in: [...VAI_TRO_HO_TRO] } };
    const [diemHoc, giangVien] = await Promise.all([
      this.prisma.diem_hoc.findMany({
        where: { created_at: { gte: tu }, nguoi_tao: doHoTro },
        select: {
          id: true,
          ma_diem_hoc: true,
          ten: true,
          dia_chi: true,
          created_at: true,
          nguoi_tao: { select: { ho_ten: true } },
        },
        orderBy: { created_at: 'desc' },
        take: 200,
      }),
      this.prisma.giang_vien.findMany({
        where: { created_at: { gte: tu }, nguoi_tao: doHoTro },
        select: {
          id: true,
          ho_ten: true,
          so_dien_thoai: true,
          email: true,
          created_at: true,
          nguoi_tao: { select: { ho_ten: true } },
        },
        orderBy: { created_at: 'desc' },
        take: 200,
      }),
    ]);
    return {
      diem_hoc: diemHoc.map(({ nguoi_tao, ...d }) => ({
        ...d,
        nguoi_tao: nguoi_tao?.ho_ten ?? null,
      })),
      giang_vien: giangVien.map(({ nguoi_tao, ...g }) => ({
        ...g,
        nguoi_tao: nguoi_tao?.ho_ten ?? null,
      })),
    };
  }
}
