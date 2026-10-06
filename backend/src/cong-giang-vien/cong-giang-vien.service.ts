import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundAppException } from '../common/exceptions/app.exceptions';
import { khoangNgayVn } from '../common/utils/khoang-ngay-vn.util';
import { TrangLopService } from '../trang-lop/trang-lop.service';

// ADR 0004 G8 (issue #20): cổng giảng viên — CHỈ ĐỌC. Phạm vi = lớp có ≥ 1
// buổi giảng viên được phân công, truy vấn động mỗi request (bỏ phân công
// có hiệu lực ngay). Ngoài phạm vi → 404.
function boKhoaDot<T extends { lop_id: string; giai_doan_id: string }>(
  x: T,
): Omit<T, 'lop_id' | 'giai_doan_id'> {
  const { lop_id: _l, giai_doan_id: _g, ...r } = x;
  void _l;
  void _g;
  return r;
}

@Injectable()
export class CongGiangVienService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly trangLopService: TrangLopService,
  ) {}

  private async giangVienIdCuaToi(nguoiDungId: string): Promise<string> {
    const nd = await this.prisma.nguoi_dung.findUnique({
      where: { id: nguoiDungId },
      select: { giang_vien_id: true },
    });
    if (!nd?.giang_vien_id)
      throw new NotFoundAppException('Không tìm thấy hồ sơ giảng viên');
    return nd.giang_vien_id;
  }

  async trangLop(nguoiDungId: string, lopId: string, gdId: string) {
    const gvId = await this.giangVienIdCuaToi(nguoiDungId);
    const day = await this.prisma.lich_hoc_lop.count({
      where: { lop_id: lopId, phan_cong: { some: { giang_vien_id: gvId } } },
    });
    if (!day) throw new NotFoundAppException('Không tìm thấy lớp học');
    return this.trangLopService.layTrangLop(lopId, gdId, {
      vai_tro: 'giang_vien',
      giang_vien_id: gvId,
    });
  }

  /** Buổi mình dạy trong khoảng ngày (mặc định 60 ngày tới), kèm hậu cần của mình, thực địa, nhóm hỗ trợ GV. */
  async lichDay(
    nguoiDungId: string,
    query: { tu_ngay?: string; den_ngay?: string },
  ) {
    const gvId = await this.giangVienIdCuaToi(nguoiDungId);
    const { tu, den } = khoangNgayVn(query, 60);
    const buoi = await this.prisma.lich_hoc_lop.findMany({
      where: {
        phan_cong: { some: { giang_vien_id: gvId } },
        thoi_gian_ket_thuc: { gte: tu },
        thoi_gian_bat_dau: { lte: den },
      },
      select: {
        id: true,
        buoi_so: true,
        thoi_gian_bat_dau: true,
        thoi_gian_ket_thuc: true,
        dia_diem_hoac_link: true,
        phong: true,
        trang_thai: true,
        lop_id: true,
        giai_doan_id: true,
        lop: {
          select: {
            id: true,
            ten_lop: true,
            loai_lop: true,
            khoa: { select: { id: true, ma_khoa: true, ten_khoa: true } },
          },
        },
        giai_doan: {
          select: {
            id: true,
            thu_tu: true,
            ten_giai_doan: true,
            hinh_thuc: true,
          },
        },
        diem_hoc: {
          select: {
            ten: true,
            dia_chi: true,
            nguoi_lien_he: true,
            sdt_lien_he: true,
          },
        },
        phan_cong: {
          select: {
            vai_tro: true,
            giang_vien: { select: { id: true, ho_ten: true } },
          },
          orderBy: { created_at: 'asc' },
        },
      },
      orderBy: [{ thoi_gian_bat_dau: 'asc' }, { buoi_so: 'asc' }],
      take: 300,
    });

    const capDot = [
      ...new Map(
        buoi.map((b) => [
          `${b.lop_id}|${b.giai_doan_id}`,
          { lop_id: b.lop_id, giai_doan_id: b.giai_doan_id },
        ]),
      ).values(),
    ];
    const khoaIds = [...new Set(buoi.map((b) => b.lop.khoa.id))];
    const [hauCan, thucDia, nhom] = capDot.length
      ? await Promise.all([
          this.prisma.hau_can_giang_vien.findMany({
            where: { giang_vien_id: gvId, OR: capDot },
            select: {
              lop_id: true,
              giai_doan_id: true,
              noi_o_ten: true,
              noi_o_dia_chi: true,
              nhan_phong: true,
              tra_phong: true,
              phuong_tien: true,
              don_luc: true,
              diem_don: true,
              lien_he_don: true,
              ghi_chu: true,
            },
          }),
          this.prisma.nhan_su_thuc_dia.findMany({
            where: { OR: capDot },
            select: {
              lop_id: true,
              giai_doan_id: true,
              ho_ten: true,
              so_dien_thoai: true,
              nhiem_vu: true,
            },
            orderBy: { created_at: 'asc' },
          }),
          this.prisma.phan_cong_ho_tro_gv.findMany({
            where: { khoa_id: { in: khoaIds } },
            select: {
              khoa_id: true,
              nguoi_dung: { select: { ho_ten: true, email: true } },
            },
            orderBy: { created_at: 'asc' },
          }),
        ])
      : [[], [], []];

    const cungDot = (
      x: { lop_id: string; giai_doan_id: string },
      b: { lop_id: string; giai_doan_id: string },
    ) => x.lop_id === b.lop_id && x.giai_doan_id === b.giai_doan_id;
    return buoi.map(({ phan_cong, lop_id, giai_doan_id, ...b }) => {
      const dot = { lop_id, giai_doan_id };
      const hc = hauCan.find((h) => cungDot(h, dot));
      return {
        ...b,
        vai_tro:
          phan_cong.find((p) => p.giang_vien.id === gvId)?.vai_tro ?? null,
        giang_vien_khac: phan_cong
          .filter((p) => p.giang_vien.id !== gvId)
          .map((p) => ({ ho_ten: p.giang_vien.ho_ten, vai_tro: p.vai_tro })),
        hau_can: hc ? boKhoaDot(hc) : null,
        thuc_dia: thucDia
          .filter((t) => cungDot(t, dot))
          .map(({ ho_ten, so_dien_thoai, nhiem_vu }) => ({
            ho_ten,
            so_dien_thoai,
            nhiem_vu,
          })),
        nhom_ho_tro_gv: nhom
          .filter((n) => n.khoa_id === b.lop.khoa.id)
          .map((n) => n.nguoi_dung),
      };
    });
  }
}
