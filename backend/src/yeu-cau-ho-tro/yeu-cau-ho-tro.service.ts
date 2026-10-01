import { Injectable } from '@nestjs/common';
import { Prisma, yeu_cau_ho_tro } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ThongBaoService } from '../thong-bao/thong-bao.service';
import {
  ForbiddenAppException,
  NotFoundAppException,
  ValidationException,
} from '../common/exceptions/app.exceptions';
import { TaoYeuCauHoTroDto } from './dto/tao-yeu-cau-ho-tro.dto';
import { DanhGiaYeuCauHoTroDto } from './dto/danh-gia-yeu-cau-ho-tro.dto';
import { SO_NGAY_TU_DONG_DONG } from './yeu-cau-ho-tro.constants';

export type YeuCauHoTroResponse = yeu_cau_ho_tro & {
  loai_van_de_ten: string;
  da_dong_hieu_luc: boolean;
};

const INCLUDE_LOAI_VAN_DE = { loai_van_de: true } satisfies Prisma.yeu_cau_ho_troInclude;

@Injectable()
export class YeuCauHoTroService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly thongBao: ThongBaoService,
  ) {}

  // ---------------------------------------------------------------------
  // Phía học viên (GET/POST /yeu-cau-ho-tro/toi...)
  // ---------------------------------------------------------------------

  async taoCuaToi(
    hocVienId: string,
    dto: TaoYeuCauHoTroDto,
  ): Promise<YeuCauHoTroResponse> {
    const loaiVanDe = await this.prisma.loai_van_de_ho_tro.findUniqueOrThrow({
      where: { id: dto.loai_van_de_id },
    });

    const created = await this.prisma.yeu_cau_ho_tro.create({
      data: {
        hoc_vien_id: hocVienId,
        loai_van_de_id: dto.loai_van_de_id,
        noi_dung_hoi: dto.noi_dung_hoi,
      },
    });

    return this.toResponse({ ...created, loai_van_de: loaiVanDe });
  }

  async danhSachCuaToi(hocVienId: string): Promise<YeuCauHoTroResponse[]> {
    const data = await this.prisma.yeu_cau_ho_tro.findMany({
      where: { hoc_vien_id: hocVienId },
      include: INCLUDE_LOAI_VAN_DE,
      orderBy: { thoi_gian_tao: 'desc' },
    });
    return data.map((d) => this.toResponse(d));
  }

  async chiTietCuaToi(hocVienId: string, id: string): Promise<YeuCauHoTroResponse> {
    const yeuCau = await this.timVaKiemTraChuSoHuu(hocVienId, id);
    return this.toResponse(yeuCau);
  }

  async dongCuaToi(hocVienId: string, id: string): Promise<YeuCauHoTroResponse> {
    const yeuCau = await this.timVaKiemTraChuSoHuu(hocVienId, id);
    if (yeuCau.trang_thai === 'cho_xu_ly') {
      throw new ValidationException('Ticket chưa được trả lời, chưa thể đóng');
    }

    const updated =
      yeuCau.trang_thai === 'da_dong'
        ? yeuCau
        : await this.prisma.yeu_cau_ho_tro.update({
            where: { id },
            data: { trang_thai: 'da_dong', thoi_gian_dong: new Date() },
            include: INCLUDE_LOAI_VAN_DE,
          });

    return this.toResponse(updated);
  }

  async danhGiaCuaToi(
    hocVienId: string,
    id: string,
    dto: DanhGiaYeuCauHoTroDto,
  ): Promise<YeuCauHoTroResponse> {
    const yeuCau = await this.timVaKiemTraChuSoHuu(hocVienId, id);
    if (yeuCau.trang_thai === 'cho_xu_ly') {
      throw new ValidationException('Ticket chưa được trả lời, chưa thể đánh giá');
    }

    const updated = await this.prisma.yeu_cau_ho_tro.update({
      where: { id },
      data: { danh_gia: dto.danh_gia },
      include: INCLUDE_LOAI_VAN_DE,
    });
    return this.toResponse(updated);
  }

  private async timVaKiemTraChuSoHuu(hocVienId: string, id: string) {
    const yeuCau = await this.prisma.yeu_cau_ho_tro.findUnique({
      where: { id },
      include: INCLUDE_LOAI_VAN_DE,
    });
    if (!yeuCau) throw new NotFoundAppException('Không tìm thấy yêu cầu hỗ trợ');
    if (yeuCau.hoc_vien_id !== hocVienId) {
      throw new ForbiddenAppException('Không có quyền truy cập yêu cầu hỗ trợ này');
    }
    return yeuCau;
  }

  private toResponse(
    yeuCau: yeu_cau_ho_tro & { loai_van_de: { ten: string } },
  ): YeuCauHoTroResponse {
    const { loai_van_de, ...rest } = yeuCau;
    return {
      ...rest,
      loai_van_de_ten: loai_van_de.ten,
      da_dong_hieu_luc: this.tinhDaDongHieuLuc(rest),
    };
  }

  private tinhDaDongHieuLuc(yeuCau: Pick<yeu_cau_ho_tro, 'trang_thai' | 'thoi_gian_phan_hoi'>): boolean {
    if (yeuCau.trang_thai === 'da_dong') return true;
    if (yeuCau.trang_thai !== 'da_phan_hoi' || !yeuCau.thoi_gian_phan_hoi) return false;
    const han = new Date(yeuCau.thoi_gian_phan_hoi);
    han.setDate(han.getDate() + SO_NGAY_TU_DONG_DONG);
    return han.getTime() < Date.now();
  }
}
