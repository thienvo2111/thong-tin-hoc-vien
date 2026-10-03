import { Injectable } from '@nestjs/common';
import { Prisma, yeu_cau_ho_tro } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ThongBaoService } from '../thong-bao/thong-bao.service';
import {
  ConflictAppException,
  ForbiddenAppException,
  NotFoundAppException,
  ValidationException,
} from '../common/exceptions/app.exceptions';
import { paginate } from '../common/dto/pagination-query.dto';
import { TaoYeuCauHoTroDto } from './dto/tao-yeu-cau-ho-tro.dto';
import { DanhGiaYeuCauHoTroDto } from './dto/danh-gia-yeu-cau-ho-tro.dto';
import { TraLoiYeuCauHoTroDto } from './dto/tra-loi-yeu-cau-ho-tro.dto';
import { QueryYeuCauHoTroDto } from './dto/query-yeu-cau-ho-tro.dto';
import { SO_NGAY_HOI_LAI, SO_NGAY_TU_DONG_DONG } from './yeu-cau-ho-tro.constants';

export type YeuCauHoTroResponse = yeu_cau_ho_tro & {
  // Tên hiển thị của vấn đề: tinh_huong (ticket mới) hoặc tên loại vấn đề (ticket cũ).
  chu_de: string;
  da_dong_hieu_luc: boolean;
};

type CoLoaiVanDe = { loai_van_de: { ten: string } | null };

const INCLUDE_LOAI_VAN_DE = { loai_van_de: true } satisfies Prisma.yeu_cau_ho_troInclude;

// Phía quan_tri cần thêm tên học viên + người trả lời để tra cứu/đánh giá lịch sử xử lý.
const INCLUDE_QUAN_TRI = {
  loai_van_de: true,
  hoc_vien: { select: { ho_ten: true } },
  tra_loi_boi_user: { select: { ho_ten: true } },
} satisfies Prisma.yeu_cau_ho_troInclude;

type YeuCauHoTroQuanTriRow = Prisma.yeu_cau_ho_troGetPayload<{ include: typeof INCLUDE_QUAN_TRI }>;

export type YeuCauHoTroQuanTriResponse = YeuCauHoTroResponse & {
  hoi_lai: boolean;
  hoc_vien_ho_ten: string;
  nguoi_tra_loi_ten: string | null;
};

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
    const created = await this.prisma.yeu_cau_ho_tro.create({
      data: {
        hoc_vien_id: hocVienId,
        tinh_huong: dto.tinh_huong.trim().normalize('NFC'),
        noi_dung_hoi: dto.noi_dung_hoi.trim().normalize('NFC'),
      },
      include: INCLUDE_LOAI_VAN_DE,
    });

    return this.toResponse(created);
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

  // ---------------------------------------------------------------------
  // Phía quan_tri (/yeu-cau-ho-tro...)
  // ---------------------------------------------------------------------

  async danhSachQuanTri(query: QueryYeuCauHoTroDto) {
    const page = query.page ?? 1;
    const pageSize = query.page_size ?? 20;
    const where: Prisma.yeu_cau_ho_troWhereInput = {};
    if (query.trang_thai) where.trang_thai = query.trang_thai;
    if (query.loai_van_de_id) where.loai_van_de_id = query.loai_van_de_id;

    const [data, total] = await Promise.all([
      this.prisma.yeu_cau_ho_tro.findMany({
        where,
        include: INCLUDE_QUAN_TRI,
        orderBy: { thoi_gian_tao: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.yeu_cau_ho_tro.count({ where }),
    ]);
    const data_voi_hoi_lai = await Promise.all(data.map((d) => this.voiHoiLai(d)));
    return paginate(data_voi_hoi_lai, total, page, pageSize);
  }

  async chiTietQuanTri(id: string) {
    const yeuCau = await this.prisma.yeu_cau_ho_tro.findUnique({
      where: { id },
      include: INCLUDE_QUAN_TRI,
    });
    if (!yeuCau) throw new NotFoundAppException('Không tìm thấy yêu cầu hỗ trợ');
    return this.voiHoiLai(yeuCau);
  }

  async traLoi(
    id: string,
    nguoiTraLoiId: string,
    dto: TraLoiYeuCauHoTroDto,
  ): Promise<YeuCauHoTroResponse> {
    const yeuCau = await this.prisma.yeu_cau_ho_tro.findUnique({
      where: { id },
      include: INCLUDE_LOAI_VAN_DE,
    });
    if (!yeuCau) throw new NotFoundAppException('Không tìm thấy yêu cầu hỗ trợ');
    if (yeuCau.trang_thai === 'da_dong') {
      throw new ConflictAppException('Ticket đã đóng, không thể trả lời thêm');
    }

    const updated = await this.prisma.yeu_cau_ho_tro.update({
      where: { id },
      data: {
        noi_dung_tra_loi: dto.noi_dung_tra_loi,
        trang_thai: 'da_phan_hoi',
        thoi_gian_phan_hoi: new Date(),
        tra_loi_boi: nguoiTraLoiId,
      },
      include: INCLUDE_LOAI_VAN_DE,
    });

    await this.thongBao.guiYeuCauHoTroTraLoi(id);
    return this.toResponse(updated);
  }

  // Quyết định #8: "hỏi lại" = có >= 1 ticket KHÁC của CÙNG học viên, CÙNG
  // tinh_huong (ticket cũ không có tinh_huong: CÙNG loai_van_de_id), tạo trong SO_NGAY_HOI_LAI ngày SAU khi ticket này được
  // trả lời (dấu hiệu câu trả lời chưa giải quyết được vấn đề).
  private async voiHoiLai(yeuCauDayDu: YeuCauHoTroQuanTriRow): Promise<YeuCauHoTroQuanTriResponse> {
    const { hoc_vien, tra_loi_boi_user, ...yeuCau } = yeuCauDayDu;
    const response = {
      ...this.toResponse(yeuCau),
      hoc_vien_ho_ten: hoc_vien.ho_ten,
      nguoi_tra_loi_ten: tra_loi_boi_user?.ho_ten ?? null,
    };
    if (!yeuCau.thoi_gian_phan_hoi) return { ...response, hoi_lai: false };

    const han = new Date(yeuCau.thoi_gian_phan_hoi);
    han.setDate(han.getDate() + SO_NGAY_HOI_LAI);

    const soLuong = await this.prisma.yeu_cau_ho_tro.count({
      where: {
        id: { not: yeuCau.id },
        hoc_vien_id: yeuCau.hoc_vien_id,
        ...(yeuCau.tinh_huong
          ? { tinh_huong: yeuCau.tinh_huong }
          : { loai_van_de_id: yeuCau.loai_van_de_id }),
        thoi_gian_tao: { gt: yeuCau.thoi_gian_phan_hoi, lte: han },
      },
    });
    return { ...response, hoi_lai: soLuong > 0 };
  }

  private toResponse(yeuCau: yeu_cau_ho_tro & CoLoaiVanDe): YeuCauHoTroResponse {
    const { loai_van_de, ...rest } = yeuCau;
    return {
      ...rest,
      chu_de: rest.tinh_huong ?? loai_van_de?.ten ?? 'Khác',
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
