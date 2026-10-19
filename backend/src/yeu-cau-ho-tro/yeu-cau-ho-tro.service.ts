import { Injectable } from '@nestjs/common';
import { Prisma, yeu_cau_ho_tro } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ThongBaoService } from '../thong-bao/thong-bao.service';
import { NhatKyService } from '../nhat-ky/nhat-ky.service';
import {
  HoTroHocVienScopeService,
  LopHoTroRef,
} from '../ho-tro-hoc-vien/ho-tro-hoc-vien-scope.service';
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
import {
  QueryYeuCauHoTroDto,
  QueryYeuCauHoTroHoTroDto,
} from './dto/query-yeu-cau-ho-tro.dto';
import {
  SO_NGAY_HOI_LAI,
  SO_NGAY_TU_DONG_DONG,
} from './yeu-cau-ho-tro.constants';

// ADR 0003 H14: học viên không thấy họ tên cán bộ trả lời.
export const KY_TEN_BAN_TO_CHUC = 'Ban tổ chức (HCMUE)';
// ADR 0011 P3: người trả lời chỉ liên quan học viên qua lớp được gắn.
export const kyTenLop = (tenLop: string) => `Hỗ trợ lớp ${tenLop}`;

export type YeuCauHoTroResponse = yeu_cau_ho_tro & {
  // Tên hiển thị của vấn đề: tinh_huong (ticket mới) hoặc tên loại vấn đề (ticket cũ).
  chu_de: string;
  da_dong_hieu_luc: boolean;
};

export type YeuCauHoTroHocVienResponse = Omit<
  YeuCauHoTroResponse,
  'tra_loi_boi' | 'sua_tra_loi_boi'
> & { nguoi_tra_loi_hien_thi: string | null };

type CoLoaiVanDe = { loai_van_de: { ten: string } | null };

const INCLUDE_LOAI_VAN_DE = {
  loai_van_de: true,
} satisfies Prisma.yeu_cau_ho_troInclude;

// Phía học viên: đủ dữ liệu để ký tên "Cụm hỗ trợ N" / "Hỗ trợ lớp X" thay
// họ tên cán bộ.
const INCLUDE_HOC_VIEN = {
  loai_van_de: true,
  tra_loi_boi_user: {
    select: {
      vai_tro: true,
      phan_cong_ho_tro: { select: { cum_id: true } },
      phan_cong_ho_tro_lop: { select: { lop_id: true } },
    },
  },
  hoc_vien: {
    select: {
      dang_ky_hoc: {
        select: { cum: { select: { id: true, ten_cum: true } } },
        orderBy: { ngay_dang_ky: 'desc' },
      },
    },
  },
} satisfies Prisma.yeu_cau_ho_troInclude;

type YeuCauHoTroHocVienRow = Prisma.yeu_cau_ho_troGetPayload<{
  include: typeof INCLUDE_HOC_VIEN;
}>;

// Phía quan_tri / người hỗ trợ: tên học viên, người trả lời, mọi cụm của học
// viên (ADR 0011: người hỗ trợ lớp cũng cần biết học viên thuộc cụm nào).
const INCLUDE_XU_LY = {
  loai_van_de: true,
  hoc_vien: {
    select: {
      ho_ten: true,
      dang_ky_hoc: {
        where: { cum_id: { not: null } },
        select: { cum: { select: { ten_cum: true } } },
      },
    },
  },
  tra_loi_boi_user: { select: { ho_ten: true } },
} satisfies Prisma.yeu_cau_ho_troInclude;

type YeuCauHoTroXuLyRow = Prisma.yeu_cau_ho_troGetPayload<{
  include: typeof INCLUDE_XU_LY;
}>;

export type YeuCauHoTroQuanTriResponse = YeuCauHoTroResponse & {
  hoi_lai: boolean;
  hoc_vien_ho_ten: string;
  nguoi_tra_loi_ten: string | null;
  ten_cum: string[];
  da_sua_boi_quan_tri: boolean;
};

// ADR 0011 P2: phía người hỗ trợ thêm các lớp CỦA TÔI mà học viên thuộc.
export type YeuCauHoTroHoTroResponse = YeuCauHoTroQuanTriResponse & {
  lop_ho_tro: LopHoTroRef[];
};

@Injectable()
export class YeuCauHoTroService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly thongBao: ThongBaoService,
    private readonly scope?: HoTroHocVienScopeService,
    private readonly nhatKy?: NhatKyService,
  ) {}

  // ---------------------------------------------------------------------
  // Phía học viên (GET/POST /yeu-cau-ho-tro/toi...)
  // ---------------------------------------------------------------------

  async taoCuaToi(
    hocVienId: string,
    dto: TaoYeuCauHoTroDto,
  ): Promise<YeuCauHoTroHocVienResponse> {
    const created = await this.prisma.yeu_cau_ho_tro.create({
      data: {
        hoc_vien_id: hocVienId,
        tinh_huong: dto.tinh_huong.trim().normalize('NFC'),
        noi_dung_hoi: dto.noi_dung_hoi.trim().normalize('NFC'),
      },
      include: INCLUDE_HOC_VIEN,
    });
    return this.toResponseHocVien(created);
  }

  async danhSachCuaToi(
    hocVienId: string,
  ): Promise<YeuCauHoTroHocVienResponse[]> {
    const data = await this.prisma.yeu_cau_ho_tro.findMany({
      where: { hoc_vien_id: hocVienId },
      include: INCLUDE_HOC_VIEN,
      orderBy: { thoi_gian_tao: 'desc' },
    });
    return Promise.all(data.map((d) => this.toResponseHocVien(d)));
  }

  async chiTietCuaToi(
    hocVienId: string,
    id: string,
  ): Promise<YeuCauHoTroHocVienResponse> {
    const yeuCau = await this.timVaKiemTraChuSoHuu(hocVienId, id);
    return this.toResponseHocVien(yeuCau);
  }

  async dongCuaToi(
    hocVienId: string,
    id: string,
  ): Promise<YeuCauHoTroHocVienResponse> {
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
            include: INCLUDE_HOC_VIEN,
          });

    return this.toResponseHocVien(updated);
  }

  async danhGiaCuaToi(
    hocVienId: string,
    id: string,
    dto: DanhGiaYeuCauHoTroDto,
  ): Promise<YeuCauHoTroHocVienResponse> {
    const yeuCau = await this.timVaKiemTraChuSoHuu(hocVienId, id);
    if (yeuCau.trang_thai === 'cho_xu_ly') {
      throw new ValidationException(
        'Ticket chưa được trả lời, chưa thể đánh giá',
      );
    }

    const updated = await this.prisma.yeu_cau_ho_tro.update({
      where: { id },
      data: { danh_gia: dto.danh_gia },
      include: INCLUDE_HOC_VIEN,
    });
    return this.toResponseHocVien(updated);
  }

  private async timVaKiemTraChuSoHuu(hocVienId: string, id: string) {
    const yeuCau = await this.prisma.yeu_cau_ho_tro.findUnique({
      where: { id },
      include: INCLUDE_HOC_VIEN,
    });
    if (!yeuCau)
      throw new NotFoundAppException('Không tìm thấy yêu cầu hỗ trợ');
    if (yeuCau.hoc_vien_id !== hocVienId) {
      throw new ForbiddenAppException(
        'Không có quyền truy cập yêu cầu hỗ trợ này',
      );
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
    // ADR 0003 H10: học viên chưa có cụm → ticket chỉ tới Quản trị.
    if (query.chua_co_cum === true) {
      where.hoc_vien = { dang_ky_hoc: { none: { cum_id: { not: null } } } };
    }

    const [data, total] = await Promise.all([
      this.prisma.yeu_cau_ho_tro.findMany({
        where,
        include: INCLUDE_XU_LY,
        orderBy: { thoi_gian_tao: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.yeu_cau_ho_tro.count({ where }),
    ]);
    const data_voi_hoi_lai = await Promise.all(
      data.map((d) => this.voiHoiLai(d)),
    );
    return paginate(data_voi_hoi_lai, total, page, pageSize);
  }

  async chiTietQuanTri(id: string) {
    const yeuCau = await this.prisma.yeu_cau_ho_tro.findUnique({
      where: { id },
      include: INCLUDE_XU_LY,
    });
    if (!yeuCau)
      throw new NotFoundAppException('Không tìm thấy yêu cầu hỗ trợ');
    return this.voiHoiLai(yeuCau);
  }

  async traLoi(
    id: string,
    nguoiTraLoiId: string,
    dto: TraLoiYeuCauHoTroDto,
  ): Promise<YeuCauHoTroResponse> {
    return this.traLoiCoDieuKien(id, nguoiTraLoiId, dto.noi_dung_tra_loi);
  }

  // ADR 0003 H12: chỉ Quản trị — đính chính câu trả lời (kể cả ticket đã đóng).
  async suaTraLoi(
    id: string,
    quanTriId: string,
    dto: TraLoiYeuCauHoTroDto,
  ): Promise<YeuCauHoTroResponse> {
    const yeuCau = await this.prisma.yeu_cau_ho_tro.findUnique({
      where: { id },
    });
    if (!yeuCau)
      throw new NotFoundAppException('Không tìm thấy yêu cầu hỗ trợ');
    if (yeuCau.noi_dung_tra_loi === null) {
      throw new ConflictAppException('Yêu cầu chưa có câu trả lời để sửa');
    }
    const updated = await this.prisma.yeu_cau_ho_tro.update({
      where: { id },
      data: {
        noi_dung_tra_loi: dto.noi_dung_tra_loi,
        thoi_gian_sua_tra_loi: new Date(),
        sua_tra_loi_boi: quanTriId,
        // Câu trả lời mới → học viên đánh giá lại; ticket đã đóng mở lại để phản hồi.
        danh_gia: null,
        trang_thai: 'da_phan_hoi',
        thoi_gian_dong: null,
      },
      include: INCLUDE_LOAI_VAN_DE,
    });
    await this.nhatKy?.ghi({
      hanh_dong: 'sua_tra_loi_ho_tro',
      hoc_vien_id: yeuCau.hoc_vien_id,
      chi_tiet: { yeu_cau_id: id, noi_dung_cu: yeuCau.noi_dung_tra_loi },
    });
    await this.thongBao.guiYeuCauHoTroCapNhatTraLoi(id);
    return this.toResponse(updated);
  }

  // ---------------------------------------------------------------------
  // Phía người hỗ trợ học viên (/ho-tro/yeu-cau-ho-tro...) — ADR 0003 H10–H13.
  // Cụm của ticket tính ĐỘNG từ dang_ky_hoc.cum_id của học viên.
  // ---------------------------------------------------------------------

  async danhSachHoTro(nguoiDungId: string, query: QueryYeuCauHoTroHoTroDto) {
    const page = query.page ?? 1;
    const pageSize = query.page_size ?? 20;
    const phamVi = await this.whereTicketHoTro(nguoiDungId, query);
    if (!phamVi) return paginate([], 0, page, pageSize);
    const where: Prisma.yeu_cau_ho_troWhereInput = { ...phamVi };
    if (query.trang_thai) where.trang_thai = query.trang_thai;

    const [data, total] = await Promise.all([
      this.prisma.yeu_cau_ho_tro.findMany({
        where,
        include: INCLUDE_XU_LY,
        // Hàng chờ: cũ nhất trước; lịch sử: mới nhất trước.
        orderBy: {
          thoi_gian_tao: query.trang_thai === 'cho_xu_ly' ? 'asc' : 'desc',
        },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.yeu_cau_ho_tro.count({ where }),
    ]);
    return paginate(
      await this.voiLopHoTro(
        nguoiDungId,
        await Promise.all(data.map((d) => this.voiHoiLai(d))),
      ),
      total,
      page,
      pageSize,
    );
  }

  async demHoTro(nguoiDungId: string): Promise<{ cho_xu_ly: number }> {
    const phamVi = await this.whereTicketHoTro(nguoiDungId, {});
    if (!phamVi) return { cho_xu_ly: 0 };
    const cho_xu_ly = await this.prisma.yeu_cau_ho_tro.count({
      where: { ...phamVi, trang_thai: 'cho_xu_ly' },
    });
    return { cho_xu_ly };
  }

  async chiTietHoTro(nguoiDungId: string, id: string) {
    await this.damBaoTicketTrongPhamVi(nguoiDungId, id);
    const yeuCau = await this.prisma.yeu_cau_ho_tro.findUniqueOrThrow({
      where: { id },
      include: INCLUDE_XU_LY,
    });
    const truoc = await this.prisma.yeu_cau_ho_tro.findMany({
      where: { hoc_vien_id: yeuCau.hoc_vien_id, id: { not: id } },
      include: INCLUDE_LOAI_VAN_DE,
      orderBy: { thoi_gian_tao: 'desc' },
      take: 10,
    });
    const [chiTiet] = await this.voiLopHoTro(nguoiDungId, [
      await this.voiHoiLai(yeuCau),
    ]);
    return {
      ...chiTiet,
      ticket_truoc: truoc.map((t) => {
        const r = this.toResponse(t);
        return {
          id: r.id,
          chu_de: r.chu_de,
          noi_dung_hoi: r.noi_dung_hoi,
          noi_dung_tra_loi: r.noi_dung_tra_loi,
          trang_thai: r.trang_thai,
          danh_gia: r.danh_gia,
          thoi_gian_tao: r.thoi_gian_tao,
        };
      }),
    };
  }

  async traLoiHoTro(
    nguoiDungId: string,
    id: string,
    dto: TraLoiYeuCauHoTroDto,
  ) {
    await this.damBaoTicketTrongPhamVi(nguoiDungId, id);
    return this.traLoiCoDieuKien(id, nguoiDungId, dto.noi_dung_tra_loi);
  }

  // ---------------------------------------------------------------------

  // ADR 0003 H11: UPDATE có điều kiện trang_thai = 'cho_xu_ly' — 2 người bấm
  // gửi cùng lúc thì đúng 1 người ghi được, người kia nhận 409 (không ghi đè).
  private async traLoiCoDieuKien(
    id: string,
    nguoiTraLoiId: string,
    noiDung: string,
  ): Promise<YeuCauHoTroResponse> {
    const { count } = await this.prisma.yeu_cau_ho_tro.updateMany({
      where: { id, trang_thai: 'cho_xu_ly' },
      data: {
        noi_dung_tra_loi: noiDung,
        trang_thai: 'da_phan_hoi',
        thoi_gian_phan_hoi: new Date(),
        tra_loi_boi: nguoiTraLoiId,
      },
    });
    if (count === 0) {
      const hienTai = await this.prisma.yeu_cau_ho_tro.findUnique({
        where: { id },
      });
      if (!hienTai)
        throw new NotFoundAppException('Không tìm thấy yêu cầu hỗ trợ');
      throw new ConflictAppException(
        hienTai.trang_thai === 'da_dong'
          ? 'Ticket đã đóng, không thể trả lời thêm'
          : 'Yêu cầu này đã có người trả lời',
      );
    }
    await this.thongBao.guiYeuCauHoTroTraLoi(id);
    const updated = await this.prisma.yeu_cau_ho_tro.findUniqueOrThrow({
      where: { id },
      include: INCLUDE_LOAI_VAN_DE,
    });
    return this.toResponse(updated);
  }

  /**
   * ADR 0011 P2: ticket tới người hỗ trợ = học viên có đăng ký trong phạm vi
   * cụm ∪ lớp (HoTroHocVienScopeService). `cum_id` phải là cụm của tôi,
   * `lop_id` phải là lớp được gắn cho tôi (ngoài phạm vi → 404); có cả hai
   * thì cùng 1 đăng ký phải khớp cả hai. null = không thấy ticket nào.
   */
  private async whereTicketHoTro(
    nguoiDungId: string,
    loc: { cum_id?: string; lop_id?: string },
  ): Promise<Prisma.yeu_cau_ho_troWhereInput | null> {
    const scope = this.layScope();
    const and: Prisma.dang_ky_hocWhereInput[] = [];
    if (loc.cum_id) {
      await scope.cumLoc(nguoiDungId, loc.cum_id);
      and.push({ cum_id: loc.cum_id });
    }
    if (loc.lop_id)
      and.push(await scope.whereDangKyCuaLop(nguoiDungId, loc.lop_id));
    const dk =
      and.length > 0
        ? { AND: and }
        : await scope.whereDangKyTrongPhamVi(nguoiDungId);
    return dk ? { hoc_vien: { dang_ky_hoc: { some: dk } } } : null;
  }

  /** 404 nếu ticket không tồn tại hoặc học viên của ticket ngoài phạm vi cụm ∪ lớp. */
  private async damBaoTicketTrongPhamVi(
    nguoiDungId: string,
    id: string,
  ): Promise<void> {
    const phamVi = await this.whereTicketHoTro(nguoiDungId, {});
    const co =
      !!phamVi &&
      (await this.prisma.yeu_cau_ho_tro.count({
        where: { AND: [{ id }, phamVi] },
      })) > 0;
    if (!co) throw new NotFoundAppException('Không tìm thấy yêu cầu hỗ trợ');
  }

  /** Gắn `lop_ho_tro` = các lớp của tôi mà học viên thuộc (phân lớp hoặc đổi buổi vào). */
  private async voiLopHoTro(
    nguoiDungId: string,
    ds: YeuCauHoTroQuanTriResponse[],
  ): Promise<YeuCauHoTroHoTroResponse[]> {
    const scope = this.layScope();
    const lopIds = await scope.lopIdsCuaToi(nguoiDungId);
    const lopTheoHv = await scope.lopCuaHocVien(
      lopIds,
      ds.map((d) => d.hoc_vien_id),
    );
    return ds.map((d) => ({
      ...d,
      lop_ho_tro: lopTheoHv.get(d.hoc_vien_id) ?? [],
    }));
  }

  private layScope(): HoTroHocVienScopeService {
    if (!this.scope)
      throw new Error('HoTroHocVienScopeService chưa được inject');
    return this.scope;
  }

  // Quyết định #8: "hỏi lại" = có >= 1 ticket KHÁC của CÙNG học viên, CÙNG
  // tinh_huong (ticket cũ không có tinh_huong: CÙNG loai_van_de_id), tạo trong SO_NGAY_HOI_LAI ngày SAU khi ticket này được
  // trả lời (dấu hiệu câu trả lời chưa giải quyết được vấn đề).
  private async voiHoiLai(
    yeuCauDayDu: YeuCauHoTroXuLyRow,
  ): Promise<YeuCauHoTroQuanTriResponse> {
    const { hoc_vien, tra_loi_boi_user, ...yeuCau } = yeuCauDayDu;
    const response = {
      ...this.toResponse(yeuCau),
      hoc_vien_ho_ten: hoc_vien.ho_ten,
      nguoi_tra_loi_ten: tra_loi_boi_user?.ho_ten ?? null,
      ten_cum: hoc_vien.dang_ky_hoc.flatMap((d) =>
        d.cum ? [d.cum.ten_cum] : [],
      ),
      da_sua_boi_quan_tri: yeuCau.thoi_gian_sua_tra_loi !== null,
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

  private toResponse(
    yeuCau: yeu_cau_ho_tro & CoLoaiVanDe,
  ): YeuCauHoTroResponse {
    const { loai_van_de, ...rest } = yeuCau;
    return {
      ...rest,
      chu_de: rest.tinh_huong ?? loai_van_de?.ten ?? 'Khác',
      da_dong_hieu_luc: this.tinhDaDongHieuLuc(rest),
    };
  }

  // ADR 0003 H14 + ADR 0011 P3: người hỗ trợ trả lời → (1) tên cụm của học
  // viên mà người đó phụ trách (khóa mới nhất); (2) không giữ cụm nào của học
  // viên nhưng được gắn lớp học viên thuộc (phân lớp hoặc đổi buổi còn hiệu
  // lực vào) → "Hỗ trợ lớp X", X = lớp ở giai đoạn mới nhất (lopCuaHocVien);
  // (3) còn lại → cụm đầu tiên của học viên / Ban tổ chức. Quản trị → Ban tổ
  // chức. Không trả id người trả lời/người sửa cho học viên.
  private async toResponseHocVien(
    row: YeuCauHoTroHocVienRow,
  ): Promise<YeuCauHoTroHocVienResponse> {
    const { tra_loi_boi_user, hoc_vien, ...yeuCau } = row;
    const rest: Partial<YeuCauHoTroResponse> = this.toResponse(yeuCau);
    delete rest.tra_loi_boi;
    delete rest.sua_tra_loi_boi;
    let kyTen: string | null = null;
    if (tra_loi_boi_user?.vai_tro === 'ho_tro_hoc_vien') {
      const cumNguoiTraLoi = new Set(
        tra_loi_boi_user.phan_cong_ho_tro.map((p) => p.cum_id),
      );
      const cums = hoc_vien.dang_ky_hoc.flatMap((d) => (d.cum ? [d.cum] : []));
      const cumChung = cums.find((c) => cumNguoiTraLoi.has(c.id));
      const lopChung = cumChung
        ? undefined
        : await this.lopChungVoiNguoiTraLoi(
            tra_loi_boi_user.phan_cong_ho_tro_lop.map((p) => p.lop_id),
            yeuCau.hoc_vien_id,
          );
      kyTen =
        cumChung?.ten_cum ??
        (lopChung ? kyTenLop(lopChung.ten_lop) : undefined) ??
        cums[0]?.ten_cum ??
        KY_TEN_BAN_TO_CHUC;
    } else if (tra_loi_boi_user) {
      kyTen = KY_TEN_BAN_TO_CHUC;
    }
    return {
      ...rest,
      nguoi_tra_loi_hien_thi: kyTen,
    } as YeuCauHoTroHocVienResponse;
  }

  private async lopChungVoiNguoiTraLoi(
    lopIds: string[],
    hocVienId: string,
  ): Promise<LopHoTroRef | undefined> {
    if (!this.scope || lopIds.length === 0) return undefined;
    const m = await this.scope.lopCuaHocVien(lopIds, [hocVienId]);
    return m.get(hocVienId)?.[0];
  }

  private tinhDaDongHieuLuc(
    yeuCau: Pick<
      yeu_cau_ho_tro,
      'trang_thai' | 'thoi_gian_phan_hoi' | 'thoi_gian_sua_tra_loi'
    >,
  ): boolean {
    if (yeuCau.trang_thai === 'da_dong') return true;
    // ADR 0003 H12: câu trả lời được sửa → hạn tự đóng tính lại từ lúc sửa.
    const moc = yeuCau.thoi_gian_sua_tra_loi ?? yeuCau.thoi_gian_phan_hoi;
    if (yeuCau.trang_thai !== 'da_phan_hoi' || !moc) return false;
    const han = new Date(moc);
    han.setDate(han.getDate() + SO_NGAY_TU_DONG_DONG);
    return han.getTime() < Date.now();
  }
}
