import { Injectable } from '@nestjs/common';
import { Prisma, khoa_boi_duong, lop_hoc } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ScopeService } from '../auth/scope/scope.service';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { normalizeNfcName } from '../common/utils/normalize-text.util';
import { paginate } from '../common/dto/pagination-query.dto';
import {
  ConflictAppException,
  ForbiddenAppException,
  NotFoundAppException,
  ValidationException,
} from '../common/exceptions/app.exceptions';
import { CreateKhoaBoiDuongDto } from './dto/create-khoa-boi-duong.dto';
import { UpdateKhoaBoiDuongDto } from './dto/update-khoa-boi-duong.dto';
import { QueryKhoaBoiDuongDto } from './dto/query-khoa-boi-duong.dto';
import { DuyetKhoaDto } from './dto/duyet-khoa.dto';
import { CreateGiaiDoanDto } from './dto/create-giai-doan.dto';
import { CreateLopHocDto } from './dto/create-lop-hoc.dto';
import { CreateLichHocDto } from './dto/create-lich-hoc.dto';
import { CreateNhanSuDto } from './dto/create-nhan-su.dto';
import { PhanLopHocVienRowDto } from './dto/phan-lop-row.dto';
import { RowBuildResult } from '../import/import.types';

type LopHocVoiKhoa = lop_hoc & { khoa: khoa_boi_duong };

// Dịch vụ Khóa bồi dưỡng & Lớp học — docs/api-contract.md mục 3 +
// docs/validation-checklist.md rule #47-52. Trường tạo/sở hữu khóa; Sở/Phòng
// VHXH chỉ duyệt (routing theo don_vi_cha_id của Trường tổ chức — KHÁC hẳn
// routing hồ sơ học viên, vốn theo cap_giang_day, xem hoc-vien.service.ts).
@Injectable()
export class KhoaBoiDuongService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scopeService: ScopeService,
  ) {}

  // ---------------------------------------------------------------------
  // Helpers dùng chung
  // ---------------------------------------------------------------------
  private async getKhoaOrThrow(id: string): Promise<khoa_boi_duong> {
    const khoa = await this.prisma.khoa_boi_duong.findUnique({
      where: { id },
    });
    if (!khoa) throw new NotFoundAppException('Không tìm thấy khóa bồi dưỡng');
    return khoa;
  }

  private async getLopOrThrow(id: string): Promise<LopHocVoiKhoa> {
    const lop = await this.prisma.lop_hoc.findUnique({
      where: { id },
      include: { khoa: true },
    });
    if (!lop) throw new NotFoundAppException('Không tìm thấy lớp học');
    return lop;
  }

  // Rule #47: chỉ Trường tổ chức (chủ khóa) mới thao tác được trên khóa của
  // mình. quan_tri được phép thao tác thay (superuser override, cùng quyết
  // định đã áp dụng cho hoc-vien.service.ts#duyet — flagged trong self-review,
  // không có trong bảng "Ai gọi" của api-contract.md).
  private assertChuKhoa(
    khoa: { don_vi_to_chuc_id: string },
    caller: AuthenticatedUser,
  ) {
    if (caller.vai_tro === 'quan_tri') return;
    if (caller.don_vi_id !== khoa.don_vi_to_chuc_id) {
      throw new ForbiddenAppException(
        'Chỉ Trường tổ chức khóa này mới được thao tác',
      );
    }
  }

  // Rule #49: thoi_gian_ket_thuc >= thoi_gian_bat_dau cho khóa/giai đoạn
  // (allowEqual=true, khớp chk_khoa_thoi_gian/chk_giai_doan_thoi_gian), riêng
  // lịch học lớp bắt buộc > thực sự (allowEqual=false, khớp
  // chk_lich_hoc_thoi_gian) — trả lỗi API rõ ràng thay vì để rơi xuống CHECK
  // constraint thô của DB (cùng nguyên tắc như validateNgayThangNamSinh).
  private assertThoiGianHopLe(
    batDauRaw: string,
    ketThucRaw: string,
    nhan: string,
    allowEqual: boolean,
  ) {
    const batDau = new Date(batDauRaw);
    const ketThuc = new Date(ketThucRaw);
    const hopLe = allowEqual ? ketThuc >= batDau : ketThuc > batDau;
    if (!hopLe) {
      throw new ValidationException(
        `Thời gian kết thúc ${nhan} phải ${allowEqual ? '>=' : '>'} thời gian bắt đầu`,
        [
          {
            field: 'thoi_gian_ket_thuc',
            message: allowEqual
              ? 'Phải lớn hơn hoặc bằng thời gian bắt đầu'
              : 'Phải lớn hơn thời gian bắt đầu',
          },
        ],
      );
    }
  }

  // ---------------------------------------------------------------------
  // POST /khoa-boi-duong, PATCH /khoa-boi-duong/{id}
  // ---------------------------------------------------------------------
  async taoKhoa(dto: CreateKhoaBoiDuongDto, caller: AuthenticatedUser) {
    if (!caller.don_vi_id) {
      throw new ForbiddenAppException(
        'Tài khoản hiện tại không gắn với đơn vị công tác nào',
      );
    }
    this.assertThoiGianHopLe(
      dto.thoi_gian_bat_dau,
      dto.thoi_gian_ket_thuc,
      'khóa',
      true,
    );
    try {
      return await this.prisma.khoa_boi_duong.create({
        data: {
          ma_khoa: dto.ma_khoa.trim(),
          ten_khoa: normalizeNfcName(dto.ten_khoa),
          don_vi_to_chuc_id: caller.don_vi_id,
          dia_diem: dto.dia_diem,
          thoi_gian_bat_dau: new Date(dto.thoi_gian_bat_dau),
          thoi_gian_ket_thuc: new Date(dto.thoi_gian_ket_thuc),
        },
      });
    } catch (e) {
      throw this.mapUniqueViolation(e, 'Mã khóa đã tồn tại');
    }
  }

  async capNhatKhoa(
    id: string,
    dto: UpdateKhoaBoiDuongDto,
    caller: AuthenticatedUser,
  ) {
    const khoa = await this.getKhoaOrThrow(id);
    this.assertChuKhoa(khoa, caller);
    if (khoa.trang_thai !== 'nhap' && khoa.trang_thai !== 'tu_choi') {
      throw new ConflictAppException(
        `Khóa đang ở trạng thái "${khoa.trang_thai}", không thể sửa`,
      );
    }

    const batDau =
      dto.thoi_gian_bat_dau ?? khoa.thoi_gian_bat_dau.toISOString();
    const ketThuc =
      dto.thoi_gian_ket_thuc ?? khoa.thoi_gian_ket_thuc.toISOString();
    this.assertThoiGianHopLe(batDau, ketThuc, 'khóa', true);

    try {
      return await this.prisma.khoa_boi_duong.update({
        where: { id },
        data: {
          ma_khoa: dto.ma_khoa?.trim(),
          ten_khoa: dto.ten_khoa ? normalizeNfcName(dto.ten_khoa) : undefined,
          dia_diem: dto.dia_diem,
          thoi_gian_bat_dau: dto.thoi_gian_bat_dau
            ? new Date(dto.thoi_gian_bat_dau)
            : undefined,
          thoi_gian_ket_thuc: dto.thoi_gian_ket_thuc
            ? new Date(dto.thoi_gian_ket_thuc)
            : undefined,
        },
      });
    } catch (e) {
      throw this.mapUniqueViolation(e, 'Mã khóa đã tồn tại');
    }
  }

  async nopDuyet(id: string, caller: AuthenticatedUser) {
    const khoa = await this.getKhoaOrThrow(id);
    this.assertChuKhoa(khoa, caller);
    if (khoa.trang_thai !== 'nhap' && khoa.trang_thai !== 'tu_choi') {
      throw new ConflictAppException(
        `Khóa đang ở trạng thái "${khoa.trang_thai}", không thể nộp duyệt`,
      );
    }
    return this.prisma.khoa_boi_duong.update({
      where: { id },
      data: { trang_thai: 'cho_duyet' },
    });
  }

  // ---------------------------------------------------------------------
  // POST /khoa-boi-duong/{id}/duyet — routing theo don_vi_cha_id của Trường
  // tổ chức (KHÁC hồ sơ học viên, vốn routing theo cap_giang_day — xem
  // api-contract.md mục 3 "đơn vị duyệt xác định theo don_vi_cha_id của
  // Trường tổ chức"). Escalation (Sở duyệt thay Phòng VHXH) đã có sẵn miễn
  // phí qua ScopeService.canAccessDonVi (đi XUỐNG từ caller) — không cần
  // logic escalation riêng ở đây.
  // ---------------------------------------------------------------------
  async duyet(id: string, dto: DuyetKhoaDto, caller: AuthenticatedUser) {
    const khoa = await this.getKhoaOrThrow(id);
    if (khoa.trang_thai !== 'cho_duyet') {
      throw new ConflictAppException(
        `Khóa đang ở trạng thái "${khoa.trang_thai}", không thể duyệt`,
      );
    }

    const donViDuyet = await this.resolveDonViDuyetKhoa(khoa.don_vi_to_chuc_id);
    const coQuyen = await this.scopeService.canAccessDonVi(
      caller,
      donViDuyet.id,
    );
    if (!coQuyen) {
      throw new ForbiddenAppException(
        'Không có quyền duyệt khóa này — nằm ngoài phạm vi đơn vị duyệt phụ trách',
      );
    }

    const updated = await this.prisma.khoa_boi_duong.update({
      where: { id },
      data: {
        trang_thai: dto.ket_qua,
        nguoi_duyet_id: caller.id,
        cap_duyet_thuc_te: caller.vai_tro,
        ngay_duyet: new Date(),
      },
    });
    this.guiEmailDuyetKhoaStub(id, dto.ket_qua);
    return updated;
  }

  // don_vi_cha_id trực tiếp của Trường tổ chức = đơn vị duyệt (không đi lên
  // nhiều cấp) — theo đúng văn bản api-contract.md, KHÁC với routing hồ sơ
  // học viên (đi theo cây địa lý dia_danh). Nếu Trường chưa được gán
  // don_vi_cha_id trong danh mục, không xác định được đơn vị duyệt — báo lỗi
  // rõ ràng thay vì suy đoán, flagged trong self-review: api-contract.md
  // không nói rõ phải làm gì nếu don_vi_cha_id trống.
  private async resolveDonViDuyetKhoa(
    donViToChucId: string,
  ): Promise<{ id: string }> {
    const truong = await this.prisma.don_vi_cong_tac.findUnique({
      where: { id: donViToChucId },
    });
    if (!truong) {
      throw new NotFoundAppException(
        'Không tìm thấy đơn vị tổ chức khóa trong danh mục',
      );
    }
    if (!truong.don_vi_cha_id) {
      throw new NotFoundAppException(
        'Đơn vị tổ chức khóa chưa được gán đơn vị quản lý cấp trên (don_vi_cha_id) — không xác định được đơn vị duyệt',
      );
    }
    const donViDuyet = await this.prisma.don_vi_cong_tac.findUnique({
      where: { id: truong.don_vi_cha_id },
    });
    if (!donViDuyet) {
      throw new NotFoundAppException(
        'Đơn vị duyệt (don_vi_cha_id của Trường tổ chức) không tồn tại trong danh mục',
      );
    }
    return donViDuyet;
  }

  // TODO: Dịch vụ Thông báo (docs/api-contract.md mục 8, event
  // khoa_boi_duong.duyet) chưa được triển khai — log rõ ràng, cùng mẫu với
  // hoc-vien.service.ts.
  private guiEmailDuyetKhoaStub(khoaId: string, ketQua: string) {
    console.log(
      `[thong-bao:TODO] Gửi email kết quả duyệt khóa (${ketQua}) cho khoa_id=${khoaId} tới Trường tổ chức (event khoa_boi_duong.duyet)`,
    );
  }

  // ---------------------------------------------------------------------
  // GET /khoa-boi-duong, GET /khoa-boi-duong/{id}
  // ---------------------------------------------------------------------
  async findAll(query: QueryKhoaBoiDuongDto, caller: AuthenticatedUser) {
    const page = query.page ?? 1;
    const pageSize = query.page_size ?? 20;
    const where: Prisma.khoa_boi_duongWhereInput = {};

    if (caller.vai_tro === 'hoc_vien') {
      // Học viên chỉ xem khóa đã duyệt, không giới hạn theo đơn vị tổ chức
      // (api-contract.md mục 3: "Học viên (chỉ khóa đã da_duyet)").
      where.trang_thai = 'da_duyet';
    } else {
      const scope = await this.scopeService.getAccessibleDonViIds(caller);
      if (scope !== 'ALL') {
        if (
          query.don_vi_to_chuc_id &&
          !scope.includes(query.don_vi_to_chuc_id)
        ) {
          throw new ForbiddenAppException(
            'Đơn vị tổ chức nằm ngoài phạm vi quyền',
          );
        }
        where.don_vi_to_chuc_id = query.don_vi_to_chuc_id
          ? query.don_vi_to_chuc_id
          : { in: scope };
      } else if (query.don_vi_to_chuc_id) {
        where.don_vi_to_chuc_id = query.don_vi_to_chuc_id;
      }
      if (query.trang_thai) where.trang_thai = query.trang_thai;
    }

    if (query.q) {
      where.OR = [
        { ten_khoa: { contains: query.q, mode: 'insensitive' } },
        { ma_khoa: { contains: query.q, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.khoa_boi_duong.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { created_at: 'desc' },
      }),
      this.prisma.khoa_boi_duong.count({ where }),
    ]);
    return paginate(data, total, page, pageSize);
  }

  async findOne(id: string, caller: AuthenticatedUser) {
    const khoa = await this.prisma.khoa_boi_duong.findUnique({
      where: { id },
      include: {
        giai_doan: { orderBy: { thu_tu: 'asc' } },
        lop_hoc: {
          include: {
            nhan_su: true,
            lich_hoc: { include: { giai_doan: true } },
          },
        },
      },
    });
    if (!khoa) throw new NotFoundAppException('Không tìm thấy khóa bồi dưỡng');

    if (caller.vai_tro === 'hoc_vien') {
      if (khoa.trang_thai !== 'da_duyet') {
        throw new ForbiddenAppException(
          'Khóa này chưa được duyệt, chưa thể xem',
        );
      }
    } else {
      const coQuyen = await this.scopeService.canAccessDonVi(
        caller,
        khoa.don_vi_to_chuc_id,
      );
      if (!coQuyen) {
        throw new ForbiddenAppException(
          'Khóa này nằm ngoài phạm vi quyền của tài khoản hiện tại',
        );
      }
    }
    return khoa;
  }

  // ---------------------------------------------------------------------
  // POST /khoa-boi-duong/{id}/giai-doan — rule #48/#49
  // ---------------------------------------------------------------------
  async themGiaiDoan(
    khoaId: string,
    dto: CreateGiaiDoanDto,
    caller: AuthenticatedUser,
  ) {
    const khoa = await this.getKhoaOrThrow(khoaId);
    this.assertChuKhoa(khoa, caller);
    this.assertThoiGianHopLe(
      dto.thoi_gian_bat_dau,
      dto.thoi_gian_ket_thuc,
      'giai đoạn',
      true,
    );

    try {
      return await this.prisma.giai_doan_khoa.create({
        data: {
          khoa_id: khoaId,
          thu_tu: dto.thu_tu,
          ten_giai_doan: normalizeNfcName(dto.ten_giai_doan),
          hinh_thuc: dto.hinh_thuc,
          thoi_gian_bat_dau: new Date(dto.thoi_gian_bat_dau),
          thoi_gian_ket_thuc: new Date(dto.thoi_gian_ket_thuc),
        },
      });
    } catch (e) {
      throw this.mapUniqueViolation(
        e,
        `Thứ tự ${dto.thu_tu} đã tồn tại trong khóa này`,
        'thu_tu',
      );
    }
  }

  // ---------------------------------------------------------------------
  // POST /khoa-boi-duong/{id}/lop
  // ---------------------------------------------------------------------
  async themLop(
    khoaId: string,
    dto: CreateLopHocDto,
    caller: AuthenticatedUser,
  ) {
    const khoa = await this.getKhoaOrThrow(khoaId);
    this.assertChuKhoa(khoa, caller);
    return this.prisma.lop_hoc.create({
      data: {
        khoa_id: khoaId,
        ten_lop: normalizeNfcName(dto.ten_lop),
        si_so_toi_da: dto.si_so_toi_da,
      },
    });
  }

  // ---------------------------------------------------------------------
  // POST /lop/{id}/lich-hoc — rule #50: giai_doan_id phải cùng khoa_id với
  // lop_id (kiểm tra chéo ở tầng API, DB không ràng buộc được vì 2 FK khác
  // bảng — đúng như validation-checklist.md ghi).
  // ---------------------------------------------------------------------
  async themLichHoc(
    lopId: string,
    dto: CreateLichHocDto,
    caller: AuthenticatedUser,
  ) {
    const lop = await this.getLopOrThrow(lopId);
    this.assertChuKhoa(lop.khoa, caller);

    const giaiDoan = await this.prisma.giai_doan_khoa.findUnique({
      where: { id: dto.giai_doan_id },
    });
    if (!giaiDoan) {
      throw new ValidationException('giai_doan_id không tồn tại', [
        { field: 'giai_doan_id', message: 'Không tồn tại' },
      ]);
    }
    if (giaiDoan.khoa_id !== lop.khoa_id) {
      throw new ValidationException(
        'Giai đoạn không thuộc cùng khóa với lớp (rule #50)',
        [
          {
            field: 'giai_doan_id',
            message: 'Phải thuộc cùng khóa bồi dưỡng với lớp',
          },
        ],
      );
    }
    this.assertThoiGianHopLe(
      dto.thoi_gian_bat_dau,
      dto.thoi_gian_ket_thuc,
      'lịch học',
      false,
    );

    try {
      return await this.prisma.lich_hoc_lop.create({
        data: {
          lop_id: lopId,
          giai_doan_id: dto.giai_doan_id,
          thoi_gian_bat_dau: new Date(dto.thoi_gian_bat_dau),
          thoi_gian_ket_thuc: new Date(dto.thoi_gian_ket_thuc),
          dia_diem_hoac_link: dto.dia_diem_hoac_link,
        },
      });
    } catch (e) {
      throw this.mapUniqueViolation(
        e,
        'Lớp này đã có lịch học cho giai đoạn này',
        'giai_doan_id',
      );
    }
  }

  // ---------------------------------------------------------------------
  // POST/DELETE /lop/{id}/nhan-su
  // ---------------------------------------------------------------------
  async themNhanSu(
    lopId: string,
    dto: CreateNhanSuDto,
    caller: AuthenticatedUser,
  ) {
    const lop = await this.getLopOrThrow(lopId);
    this.assertChuKhoa(lop.khoa, caller);
    return this.prisma.lop_hoc_nhan_su.create({
      data: {
        lop_id: lopId,
        ho_ten: normalizeNfcName(dto.ho_ten),
        vai_tro: dto.vai_tro,
        so_dien_thoai: dto.so_dien_thoai,
      },
    });
  }

  async xoaNhanSu(lopId: string, nhanSuId: string, caller: AuthenticatedUser) {
    const lop = await this.getLopOrThrow(lopId);
    this.assertChuKhoa(lop.khoa, caller);
    const result = await this.prisma.lop_hoc_nhan_su.deleteMany({
      where: { id: nhanSuId, lop_id: lopId },
    });
    if (result.count === 0) {
      throw new NotFoundAppException('Không tìm thấy nhân sự trong lớp này');
    }
    return { da_xoa: true };
  }

  // ---------------------------------------------------------------------
  // GET /hoc-vien/toi/khoa-hoc, GET /hoc-vien/toi/ket-qua
  // ---------------------------------------------------------------------
  private assertHocVienId(caller: AuthenticatedUser): string {
    if (!caller.hoc_vien_id) {
      throw new ForbiddenAppException(
        'Tài khoản hiện tại không gắn với hồ sơ học viên nào',
      );
    }
    return caller.hoc_vien_id;
  }

  async khoaHocCuaToi(caller: AuthenticatedUser) {
    const hocVienId = this.assertHocVienId(caller);
    return this.prisma.dang_ky_hoc.findMany({
      where: { hoc_vien_id: hocVienId },
      include: {
        khoa: true,
        lop: {
          include: {
            nhan_su: true,
            lich_hoc: { include: { giai_doan: true } },
          },
        },
      },
      orderBy: { ngay_dang_ky: 'desc' },
    });
  }

  async ketQuaCuaToi(caller: AuthenticatedUser) {
    const hocVienId = this.assertHocVienId(caller);
    return this.prisma.dang_ky_hoc.findMany({
      where: { hoc_vien_id: hocVienId },
      select: {
        id: true,
        trang_thai: true,
        ket_qua: true,
        ngay_hoan_thanh: true,
        khoa: { select: { id: true, ma_khoa: true, ten_khoa: true } },
        lop: { select: { id: true, ten_lop: true } },
      },
      orderBy: { ngay_dang_ky: 'desc' },
    });
  }

  // ---------------------------------------------------------------------
  // Import phan_lop_hoc_vien (gọi từ ImportService) — cột file:
  // so_dinh_danh_ca_nhan, ma_khoa, ten_lop (ten_lop TÙY CHỌN). Đây là CƠ CHẾ
  // DUY NHẤT gán dang_ky_hoc.khoa_id/lop_id — không có ghi danh/tự động nào
  // khác (đã sửa 2026-09-25, xem docs/api-contract.md mục 5 và
  // validation-checklist.md #45: trước đó có một hook tự tạo dang_ky_hoc khi
  // hồ sơ học viên da_duyet, nhưng không có cơ sở để biết tự động ghi danh
  // vào khóa nào — đã bỏ, không thay bằng suy đoán khác).
  //
  // ten_lop để trống -> chỉ ghi danh (lop_id=NULL, trang_thai=da_duyet); có
  // giá trị -> ghi danh + phân lớp luôn (lop_id, trang_thai=da_phan_lop). Cho
  // phép chạy import 2 lần: ghi danh trước (ten_lop trống), phân lớp sau
  // (chạy lại với ten_lop có giá trị cho học viên đã ghi danh).
  // ---------------------------------------------------------------------
  async resolvePhanLopRow(raw: {
    so_dinh_danh_ca_nhan?: string;
    ma_khoa?: string;
    ten_lop?: string;
  }): Promise<RowBuildResult<PhanLopHocVienRowDto>> {
    const sdd = raw.so_dinh_danh_ca_nhan?.trim();
    if (!sdd) {
      return { error: 'Thiếu cột "so_dinh_danh_ca_nhan"' };
    }
    const hocVien = await this.prisma.hoc_vien.findUnique({
      where: { so_dinh_danh_ca_nhan: sdd },
    });
    if (!hocVien) {
      return {
        error: `Số định danh cá nhân "${sdd}" không tồn tại (chưa có hồ sơ học viên)`,
      };
    }
    if (hocVien.trang_thai !== 'da_duyet') {
      return {
        error: `Số định danh cá nhân "${sdd}" chưa được duyệt (trang_thai hiện tại: "${hocVien.trang_thai}")`,
      };
    }

    const maKhoa = raw.ma_khoa?.trim();
    if (!maKhoa) {
      return { error: 'Thiếu cột "ma_khoa"' };
    }
    const khoa = await this.prisma.khoa_boi_duong.findUnique({
      where: { ma_khoa: maKhoa },
    });
    if (!khoa) {
      return { error: `Khóa "${maKhoa}" không tồn tại` };
    }

    const tenLop = raw.ten_lop?.trim();
    let lopId: string | null = null;
    if (tenLop) {
      const lop = await this.prisma.lop_hoc.findFirst({
        where: { khoa_id: khoa.id, ten_lop: tenLop },
      });
      if (!lop) {
        return {
          error: `Lớp "${tenLop}" không tồn tại trong khóa "${maKhoa}"`,
        };
      }
      lopId = lop.id;
    }

    return {
      dto: {
        hoc_vien_id: hocVien.id,
        khoa_id: khoa.id,
        lop_id: lopId,
      },
    };
  }

  // Không cần bước checkValid riêng: resolvePhanLopRow() (buildDto) đã tra
  // cứu/validate toàn bộ FK + trạng thái hồ sơ; commitPhanLop() là upsert nên
  // không còn ràng buộc "phải có dang_ky_hoc từ trước" để kiểm tra thêm.
  async commitPhanLop(dto: PhanLopHocVienRowDto): Promise<void> {
    const where = {
      hoc_vien_id_khoa_id: {
        hoc_vien_id: dto.hoc_vien_id,
        khoa_id: dto.khoa_id,
      },
    };
    if (dto.lop_id) {
      await this.prisma.dang_ky_hoc.upsert({
        where,
        create: {
          hoc_vien_id: dto.hoc_vien_id,
          khoa_id: dto.khoa_id,
          lop_id: dto.lop_id,
          trang_thai: 'da_phan_lop',
        },
        update: { lop_id: dto.lop_id, trang_thai: 'da_phan_lop' },
      });
    } else {
      // ten_lop trống: chỉ đảm bảo đã ghi danh. Nếu dang_ky_hoc đã tồn tại
      // (kể cả đã da_phan_lop), giữ nguyên — không hạ cấp lại trang_thai/lop_id.
      await this.prisma.dang_ky_hoc.upsert({
        where,
        create: {
          hoc_vien_id: dto.hoc_vien_id,
          khoa_id: dto.khoa_id,
          lop_id: null,
          trang_thai: 'da_duyet',
        },
        update: {},
      });
    }
  }

  // ---------------------------------------------------------------------
  private mapUniqueViolation(
    e: unknown,
    message: string,
    field?: string,
  ): Error {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === 'P2002'
    ) {
      return new ConflictAppException(
        message,
        field ? [{ field, message: 'Đã tồn tại' }] : undefined,
      );
    }
    return e as Error;
  }
}
