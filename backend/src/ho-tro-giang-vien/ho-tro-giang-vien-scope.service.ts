import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundAppException } from '../common/exceptions/app.exceptions';

// ADR 0004 G3 (issue #14): phạm vi người hỗ trợ giảng viên = mọi lớp của các
// khóa có trong phan_cong_ho_tro_gv. Điểm DUY NHẤT đọc bảng phân công — các
// service khác chỉ dùng API cấp lớp/khóa dưới đây, để sau này thu hẹp về lớp
// (thêm lop_id NULL) chỉ phải sửa file này. Truy vấn động mỗi request (gỡ
// phân công có hiệu lực ngay), không nằm trong JWT. Ngoài phạm vi → 404.
@Injectable()
export class HoTroGiangVienScopeService {
  constructor(private readonly prisma: PrismaService) {}

  private async khoaIdsCuaToi(nguoiDungId: string): Promise<string[]> {
    const rows = await this.prisma.phan_cong_ho_tro_gv.findMany({
      where: { nguoi_dung_id: nguoiDungId },
      select: { khoa_id: true },
    });
    return rows.map((r) => r.khoa_id);
  }

  /** Điều kiện lọc lop_hoc trong phạm vi (không phân công → không khớp lớp nào). */
  async whereLopTrongPhamVi(
    nguoiDungId: string,
  ): Promise<Prisma.lop_hocWhereInput> {
    return { khoa_id: { in: await this.khoaIdsCuaToi(nguoiDungId) } };
  }

  async lopIdsCuaToi(nguoiDungId: string): Promise<string[]> {
    const rows = await this.prisma.lop_hoc.findMany({
      where: await this.whereLopTrongPhamVi(nguoiDungId),
      select: { id: true },
    });
    return rows.map((r) => r.id);
  }

  async damBaoLopTrongPhamVi(nguoiDungId: string, lopId: string) {
    const co = await this.prisma.lop_hoc.count({
      where: {
        AND: [{ id: lopId }, await this.whereLopTrongPhamVi(nguoiDungId)],
      },
    });
    if (!co) throw new NotFoundAppException('Không tìm thấy lớp học');
  }

  async damBaoKhoaTrongPhamVi(nguoiDungId: string, khoaId: string) {
    if (!(await this.khoaIdsCuaToi(nguoiDungId)).includes(khoaId)) {
      throw new NotFoundAppException('Không tìm thấy khóa bồi dưỡng');
    }
  }
}
