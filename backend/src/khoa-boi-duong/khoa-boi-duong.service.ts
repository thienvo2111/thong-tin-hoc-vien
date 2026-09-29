import { Injectable } from '@nestjs/common';
import { Prisma, khoa_boi_duong, lop_hoc, muc_nang_luc } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ScopeService } from '../auth/scope/scope.service';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { ThongBaoService } from '../thong-bao/thong-bao.service';
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
import { ThemDonViTheoDoiDto } from './dto/them-don-vi-theo-doi.dto';
import { PhanLopHocVienRowDto } from './dto/phan-lop-row.dto';
import { KetQuaDangKyDto } from './dto/ket-qua-dang-ky.dto';
import { KetQuaDanhGiaRowDto } from './dto/ket-qua-danh-gia-row.dto';
import { LopVaLichHocRowDto } from './dto/lop-va-lich-hoc-row.dto';
import { RowBuildResult } from '../import/import.types';
import { resolveHocVienImportRow } from '../import/util/hoc-vien-resolver.util';
import { parseVnDateTime } from '../common/utils/vn-datetime.util';

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
    private readonly thongBaoService: ThongBaoService,
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
  // T2 (QĐ2, 2026-09-29): quan_tri tạo khóa thay cho đơn vị loại 'khac'
  // (vd. HCMUE — không thuộc cây đơn vị An Giang, không có tài khoản 'truong'
  // riêng) hoặc 'truong' bất kỳ; khóa tạo ra được da_duyet NGAY (đơn vị tổ
  // chức khóa đã "được xác thực" bởi chính Quản trị, không cần quy trình
  // nộp duyệt/duyệt như Trường tự tạo). Trường tự gọi endpoint này vẫn theo
  // luồng cũ (trang_thai=nhap, don_vi_to_chuc_id suy từ caller.don_vi_id).
  async taoKhoa(dto: CreateKhoaBoiDuongDto, caller: AuthenticatedUser) {
    this.assertThoiGianHopLe(
      dto.thoi_gian_bat_dau,
      dto.thoi_gian_ket_thuc,
      'khóa',
      true,
    );

    if (caller.vai_tro === 'quan_tri') {
      if (!dto.don_vi_to_chuc_id) {
        throw new ValidationException(
          'Quản trị tạo khóa phải chỉ định đơn vị tổ chức',
          [{ field: 'don_vi_to_chuc_id', message: 'Bắt buộc' }],
        );
      }
      const donVi = await this.prisma.don_vi_cong_tac.findUnique({
        where: { id: dto.don_vi_to_chuc_id },
      });
      if (!donVi || donVi.trang_thai !== 'active') {
        throw new ValidationException(
          'don_vi_to_chuc_id không tồn tại hoặc đã ngừng hoạt động',
          [{ field: 'don_vi_to_chuc_id', message: 'Không hợp lệ' }],
        );
      }
      if (donVi.loai_don_vi !== 'khac' && donVi.loai_don_vi !== 'truong') {
        throw new ValidationException(
          'don_vi_to_chuc_id phải thuộc loại "khac" hoặc "truong"',
          [{ field: 'don_vi_to_chuc_id', message: 'Sai loại đơn vị' }],
        );
      }
      try {
        return await this.prisma.khoa_boi_duong.create({
          data: {
            ma_khoa: dto.ma_khoa.trim(),
            ten_khoa: normalizeNfcName(dto.ten_khoa),
            don_vi_to_chuc_id: donVi.id,
            dia_diem: dto.dia_diem,
            thoi_gian_bat_dau: new Date(dto.thoi_gian_bat_dau),
            thoi_gian_ket_thuc: new Date(dto.thoi_gian_ket_thuc),
            created_by: caller.id,
            trang_thai: 'da_duyet',
            nguoi_duyet_id: caller.id,
            cap_duyet_thuc_te: 'quan_tri',
            ngay_duyet: new Date(),
          },
        });
      } catch (e) {
        throw this.mapUniqueViolation(e, 'Mã khóa đã tồn tại');
      }
    }

    if (!caller.don_vi_id) {
      throw new ForbiddenAppException(
        'Tài khoản hiện tại không gắn với đơn vị công tác nào',
      );
    }
    try {
      return await this.prisma.khoa_boi_duong.create({
        data: {
          ma_khoa: dto.ma_khoa.trim(),
          ten_khoa: normalizeNfcName(dto.ten_khoa),
          don_vi_to_chuc_id: caller.don_vi_id,
          dia_diem: dto.dia_diem,
          thoi_gian_bat_dau: new Date(dto.thoi_gian_bat_dau),
          thoi_gian_ket_thuc: new Date(dto.thoi_gian_ket_thuc),
          created_by: caller.id,
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
    await this.thongBaoService.guiKhoaBoiDuongDuyet(id, dto.ket_qua);
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

  // ---------------------------------------------------------------------
  // PATCH /dang-ky-hoc/{id}/ket-qua — docs/api-contract.md mục 3 (thêm
  // 2026-09-25). Phạm vi theo Trường tổ chức khóa TRỰC TIẾP (khác duyet()
  // khóa ở trên, vốn routing lên don_vi_cha_id của Trường — ở đây chính
  // Trường tổ chức là người nhập kết quả, Phòng VHXH/Sở chỉ escalation lên
  // được nhờ ScopeService.canAccessDonVi đã bao gồm cây con của họ).
  // ---------------------------------------------------------------------
  async capNhatKetQua(
    id: string,
    dto: KetQuaDangKyDto,
    caller: AuthenticatedUser,
  ) {
    const dangKy = await this.prisma.dang_ky_hoc.findUnique({
      where: { id },
      include: { khoa: true },
    });
    if (!dangKy) throw new NotFoundAppException('Không tìm thấy đăng ký học');

    const coQuyen = await this.scopeService.canAccessDonVi(
      caller,
      dangKy.khoa.don_vi_to_chuc_id,
    );
    if (!coQuyen) {
      throw new ForbiddenAppException(
        'Không có quyền cập nhật kết quả — nằm ngoài phạm vi đơn vị tổ chức khóa',
      );
    }

    const updated = await this.prisma.dang_ky_hoc.update({
      where: { id },
      data: {
        ket_qua: dto.ket_qua,
        ngay_hoan_thanh: dto.ngay_hoan_thanh
          ? new Date(dto.ngay_hoan_thanh)
          : undefined,
      },
    });
    await this.thongBaoService.guiDangKyHocKetQua(id);
    return updated;
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
        if (query.don_vi_to_chuc_id) {
          if (!scope.includes(query.don_vi_to_chuc_id)) {
            throw new ForbiddenAppException(
              'Đơn vị tổ chức nằm ngoài phạm vi quyền',
            );
          }
          where.don_vi_to_chuc_id = query.don_vi_to_chuc_id;
        } else {
          // T2 (QĐ2): mở rộng thêm các khóa mà đơn vị của caller đang "theo
          // dõi" (là chính đơn vị theo dõi hoặc nằm dưới nó trong cây) —
          // ngoài phạm vi sở hữu don_vi_to_chuc_id như trước.
          const theoDoiKhoaIds =
            await this.scopeService.getKhoaIdsTheoDoi(caller);
          where.OR =
            theoDoiKhoaIds.length > 0
              ? [
                  { don_vi_to_chuc_id: { in: scope } },
                  { id: { in: theoDoiKhoaIds } },
                ]
              : undefined;
          if (!where.OR) where.don_vi_to_chuc_id = { in: scope };
        }
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
        // T2 (QĐ2): chưa sở hữu don_vi_to_chuc_id — vẫn xem được nếu đơn vị
        // của caller là/nằm dưới một đơn vị đang "theo dõi" khóa này.
        const theoDoiKhoaIds =
          await this.scopeService.getKhoaIdsTheoDoi(caller);
        if (!theoDoiKhoaIds.includes(khoa.id)) {
          throw new ForbiddenAppException(
            'Khóa này nằm ngoài phạm vi quyền của tài khoản hiện tại',
          );
        }
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
  // POST/DELETE /khoa-boi-duong/{id}/don-vi-theo-doi — T2 (QĐ2): chỉ quan_tri
  // (RolesGuard đã chặn ở controller, không cần assertChuKhoa ở đây — khác
  // các thao tác "chủ khóa" khác vì Trường không quản lý danh sách này).
  // ---------------------------------------------------------------------
  async themDonViTheoDoi(khoaId: string, dto: ThemDonViTheoDoiDto) {
    await this.getKhoaOrThrow(khoaId);
    const donVi = await this.prisma.don_vi_cong_tac.findUnique({
      where: { id: dto.don_vi_id },
    });
    if (!donVi) {
      throw new ValidationException('don_vi_id không tồn tại', [
        { field: 'don_vi_id', message: 'Không tồn tại' },
      ]);
    }
    try {
      return await this.prisma.khoa_don_vi_theo_doi.create({
        data: { khoa_id: khoaId, don_vi_id: dto.don_vi_id },
      });
    } catch (e) {
      throw this.mapUniqueViolation(e, 'Đơn vị này đã theo dõi khóa này');
    }
  }

  async xoaDonViTheoDoi(khoaId: string, donViId: string) {
    const result = await this.prisma.khoa_don_vi_theo_doi.deleteMany({
      where: { khoa_id: khoaId, don_vi_id: donViId },
    });
    if (result.count === 0) {
      throw new NotFoundAppException(
        'Không tìm thấy đơn vị theo dõi này trong khóa',
      );
    }
    return { da_xoa: true };
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
          buoi_so: dto.buoi_so ?? 1,
          thoi_gian_bat_dau: new Date(dto.thoi_gian_bat_dau),
          thoi_gian_ket_thuc: new Date(dto.thoi_gian_ket_thuc),
          dia_diem_hoac_link: dto.dia_diem_hoac_link,
        },
      });
    } catch (e) {
      throw this.mapUniqueViolation(
        e,
        'Lớp này đã có lịch học cho giai đoạn và buổi này',
        'buoi_so',
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
            // T6 (mo-rong-nls-an-giang.md): sắp buổi theo giai đoạn, buổi,
            // thời gian, địa điểm/link (nghiệm thu T6).
            lich_hoc: {
              include: { giai_doan: true },
              orderBy: [
                { giai_doan: { thu_tu: 'asc' } },
                { buoi_so: 'asc' },
                { thoi_gian_bat_dau: 'asc' },
                { dia_diem_hoac_link: 'asc' },
              ],
            },
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
  // so_dinh_danh_ca_nhan, ma_dinh_danh_moet (cả 2 TÙY CHỌN — T3, xem
  // resolveHocVienImportRow), ma_khoa, ten_lop (ten_lop TÙY CHỌN). Đây là CƠ
  // CHẾ DUY NHẤT gán dang_ky_hoc.khoa_id/lop_id — không có ghi danh/tự động
  // nào khác (đã sửa 2026-09-25, xem docs/api-contract.md mục 5 và
  // validation-checklist.md #45: trước đó có một hook tự tạo dang_ky_hoc khi
  // hồ sơ học viên da_duyet, nhưng không có cơ sở để biết tự động ghi danh
  // vào khóa nào — đã bỏ, không thay bằng suy đoán khác).
  //
  // ten_lop để trống -> chỉ ghi danh (lop_id=NULL, trang_thai=da_duyet); có
  // giá trị -> ghi danh + phân lớp luôn (lop_id, trang_thai=da_phan_lop). Cho
  // phép chạy import 2 lần: ghi danh trước (ten_lop trống), phân lớp sau
  // (chạy lại với ten_lop có giá trị cho học viên đã ghi danh).
  //
  // T3 (QĐ1, mo-rong-nls-an-giang.md): trước đây chỉ nhận
  // so_dinh_danh_ca_nhan (CCCD) -> học viên import_moet chưa có CCCD (đa số,
  // xem T4) không ghi danh được. Nay dùng resolveHocVienImportRow (mục 2 quy
  // tắc #3) để nhận diện qua ma_dinh_danh_moet, gỡ bỏ chặn đó — "hồ sơ đầy
  // đủ" không còn là điều kiện ghi danh (chuyển sang cổng đánh giá T15 + cấp
  // chứng nhận T13, xem checklist #36d). Check trang_thai='da_duyet' dưới đây
  // GIỮ NGUYÊN — đó là trạng thái duyệt hồ sơ (workflow), không phải "đầy đủ
  // dữ liệu", và với import_moet luôn da_duyet ngay từ lúc import.
  // ---------------------------------------------------------------------
  async resolvePhanLopRow(raw: {
    so_dinh_danh_ca_nhan?: string;
    ma_dinh_danh_moet?: string;
    ma_khoa?: string;
    ten_lop?: string;
  }): Promise<RowBuildResult<PhanLopHocVienRowDto>> {
    const resolved = await resolveHocVienImportRow(this.prisma, {
      so_dinh_danh_ca_nhan: raw.so_dinh_danh_ca_nhan,
      ma_dinh_danh_moet: raw.ma_dinh_danh_moet,
    });
    if (resolved.error || !resolved.hocVien) {
      return { error: resolved.error ?? 'Không xác định được học viên' };
    }
    const hocVien = resolved.hocVien;
    if (hocVien.trang_thai !== 'da_duyet') {
      const ma =
        raw.so_dinh_danh_ca_nhan?.trim() || raw.ma_dinh_danh_moet?.trim();
      return {
        error: `Học viên "${ma}" chưa được duyệt (trang_thai hiện tại: "${hocVien.trang_thai}")`,
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
    // T6 (mo-rong-nls-an-giang.md, QĐ3/QĐ4): lop_hoc.muc_nang_luc khác
    // dang_ky_hoc.muc_dau_vao (đã có từ T5) -> cảnh báo 🟡, KHÔNG chặn dòng —
    // chỉ có ý nghĩa khi CẢ 2 đều đã có giá trị (lớp có mức mục tiêu VÀ học
    // viên đã có kết quả đánh giá đầu vào), nếu không thì không có gì để so.
    let canhBao: string | undefined;
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

      if (lop.muc_nang_luc) {
        const dangKyHienTai = await this.prisma.dang_ky_hoc.findUnique({
          where: {
            hoc_vien_id_khoa_id: { hoc_vien_id: hocVien.id, khoa_id: khoa.id },
          },
        });
        if (
          dangKyHienTai?.muc_dau_vao &&
          dangKyHienTai.muc_dau_vao !== lop.muc_nang_luc
        ) {
          const ma =
            raw.so_dinh_danh_ca_nhan?.trim() || raw.ma_dinh_danh_moet?.trim();
          canhBao = `Học viên "${ma}" có mức đầu vào "${dangKyHienTai.muc_dau_vao}" khác mức năng lực "${lop.muc_nang_luc}" của lớp "${tenLop}" — kiểm tra lại phân lớp`;
        }
      }
    }

    return {
      dto: {
        hoc_vien_id: hocVien.id,
        khoa_id: khoa.id,
        lop_id: lopId,
      },
      canhBao,
    };
  }

  // Không cần bước checkValid riêng: resolvePhanLopRow() (buildDto) đã tra
  // cứu/validate toàn bộ FK + trạng thái hồ sơ; commitPhanLop() là upsert nên
  // không còn ràng buộc "phải có dang_ky_hoc từ trước" để kiểm tra thêm.
  //
  // Trả về hocVienChuaCoEmail để ImportService đếm
  // so_hoc_vien_chua_co_email (T3, QĐ6) trên GET /import/{id} — chỉ nhánh
  // gán lop_id thực sự mới có ý nghĩa (nhánh chỉ ghi danh không gửi email).
  async commitPhanLop(
    dto: PhanLopHocVienRowDto,
  ): Promise<{ hocVienChuaCoEmail: boolean }> {
    const where = {
      hoc_vien_id_khoa_id: {
        hoc_vien_id: dto.hoc_vien_id,
        khoa_id: dto.khoa_id,
      },
    };
    if (dto.lop_id) {
      const dangKy = await this.prisma.dang_ky_hoc.upsert({
        where,
        create: {
          hoc_vien_id: dto.hoc_vien_id,
          khoa_id: dto.khoa_id,
          lop_id: dto.lop_id,
          trang_thai: 'da_phan_lop',
        },
        update: { lop_id: dto.lop_id, trang_thai: 'da_phan_lop' },
      });
      // Event dang_ky_hoc_phan_lop CHỈ kích hoạt ở nhánh gán lop_id thực sự
      // (docs/api-contract.md mục 8) — nhánh else dưới đây (chỉ ghi danh,
      // lop_id vẫn NULL) không gọi.
      const { chuaCoEmail } = await this.thongBaoService.guiDangKyHocPhanLop(
        dangKy.id,
      );
      return { hocVienChuaCoEmail: chuaCoEmail };
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
      return { hocVienChuaCoEmail: false };
    }
  }

  // ---------------------------------------------------------------------
  // Import ket_qua_danh_gia (T5, mo-rong-nls-an-giang.md — gọi từ
  // ImportService) — cột file: so_dinh_danh_ca_nhan, ma_dinh_danh_moet (cả 2
  // TÙY CHỌN, HocVienResolver dùng chung), ma_khoa, loai (dau_vao|dau_ra),
  // muc (co_ban|thanh_thao|nang_cao). Khác với phan_lop_hoc_vien:
  // dang_ky_hoc PHẢI đã tồn tại (học viên đã được ghi danh vào khóa qua T3)
  // — dòng lỗi rõ ràng nếu chưa, không tự tạo dang_ky_hoc ở đây (ghi danh và
  // chấm mức là 2 bước tách biệt theo đúng trình tự vận hành trong spec:
  // import MOET -> ghi danh (T3) -> import ket_qua_danh_gia -> tạo lớp (T6)
  // -> phân lớp).
  async resolveKetQuaDanhGiaRow(raw: {
    so_dinh_danh_ca_nhan?: string;
    ma_dinh_danh_moet?: string;
    ma_khoa?: string;
    loai?: string;
    muc?: string;
  }): Promise<RowBuildResult<KetQuaDanhGiaRowDto>> {
    const resolved = await resolveHocVienImportRow(this.prisma, {
      so_dinh_danh_ca_nhan: raw.so_dinh_danh_ca_nhan,
      ma_dinh_danh_moet: raw.ma_dinh_danh_moet,
    });
    if (resolved.error || !resolved.hocVien) {
      return { error: resolved.error ?? 'Không xác định được học viên' };
    }
    const hocVien = resolved.hocVien;

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

    const loai = raw.loai?.trim();
    if (loai !== 'dau_vao' && loai !== 'dau_ra') {
      return { error: 'Cột "loai" phải là "dau_vao" hoặc "dau_ra"' };
    }

    const muc = raw.muc?.trim();
    if (muc !== 'co_ban' && muc !== 'thanh_thao' && muc !== 'nang_cao') {
      return {
        error: 'Cột "muc" phải là "co_ban", "thanh_thao" hoặc "nang_cao"',
      };
    }

    const dangKy = await this.prisma.dang_ky_hoc.findUnique({
      where: {
        hoc_vien_id_khoa_id: { hoc_vien_id: hocVien.id, khoa_id: khoa.id },
      },
    });
    if (!dangKy) {
      const ma =
        raw.so_dinh_danh_ca_nhan?.trim() || raw.ma_dinh_danh_moet?.trim();
      return {
        error: `Học viên "${ma}" chưa được ghi danh vào khóa "${maKhoa}" — phải chạy ghi danh (import phan_lop_hoc_vien, T3) trước`,
      };
    }

    return {
      dto: { hoc_vien_id: hocVien.id, khoa_id: khoa.id, loai, muc },
    };
  }

  // Upsert theo từng cột (không phải theo dòng): dang_ky_hoc đã tồn tại
  // (đảm bảo bởi resolveKetQuaDanhGiaRow ở trên) nên chỉ update, không cần
  // nhánh create. Chạy lại cùng file đổi "muc" -> ghi đè đúng cột theo "loai"
  // của dòng, không đụng tới cột còn lại (Nghiệm thu T5).
  async commitKetQuaDanhGia(dto: KetQuaDanhGiaRowDto): Promise<void> {
    await this.prisma.dang_ky_hoc.update({
      where: {
        hoc_vien_id_khoa_id: {
          hoc_vien_id: dto.hoc_vien_id,
          khoa_id: dto.khoa_id,
        },
      },
      data:
        dto.loai === 'dau_vao'
          ? { muc_dau_vao: dto.muc }
          : { muc_dau_ra: dto.muc },
    });
  }

  // ---------------------------------------------------------------------
  // Import lop_va_lich_hoc (T6, mo-rong-nls-an-giang.md — gọi từ
  // ImportService) — mỗi dòng = 1 buổi học. Cột file: ma_khoa, ten_lop,
  // nhom_hoc_vien (tùy chọn, 1-20), muc_nang_luc (tùy chọn), si_so_toi_da
  // (tùy chọn), giai_doan_thu_tu, buoi_so, bat_dau, ket_thuc (dd/mm/yyyy
  // hh:mm giờ VN, quy tắc chung #4), dia_diem_hoac_link (tùy chọn),
  // ma_diem_hoc (tùy chọn — T10 "điểm học" CHƯA làm, không có bảng nào để
  // lưu -> đọc cột nhưng BỎ QUA, không báo lỗi vì cột lạ, xem TODO T10).
  //
  // Upsert lớp theo (khoa_id, ten_lop) — uq_lop_ten_trong_khoa (T3); upsert
  // lịch theo (lop_id, giai_doan_id, buoi_so) — uq_lich_hoc_lop_giai_doan_buoi
  // (T6 migration B). dupKeys: Set dùng CHUNG cho cả 1 lượt import (tạo mới ở
  // ImportService trước vòng lặp từng dòng) để phát hiện 2 dòng cùng (lớp,
  // giai đoạn, buổi) TRONG CÙNG FILE — khác voi UNIQUE constraint (chỉ phát
  // hiện được khi đã commit, không có ý nghĩa ở bước preview vì lớp có thể
  // chưa tồn tại).
  // ---------------------------------------------------------------------
  async resolveLopVaLichHocRow(
    raw: {
      ma_khoa?: string;
      ten_lop?: string;
      nhom_hoc_vien?: string;
      muc_nang_luc?: string;
      si_so_toi_da?: string;
      giai_doan_thu_tu?: string;
      buoi_so?: string;
      bat_dau?: string;
      ket_thuc?: string;
      dia_diem_hoac_link?: string;
    },
    dupKeys?: Set<string>,
  ): Promise<RowBuildResult<LopVaLichHocRowDto>> {
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
    if (!tenLop) {
      return { error: 'Thiếu cột "ten_lop"' };
    }

    let nhomHocVien: number | undefined;
    if (raw.nhom_hoc_vien?.trim()) {
      nhomHocVien = Number(raw.nhom_hoc_vien.trim());
      if (
        !Number.isInteger(nhomHocVien) ||
        nhomHocVien < 1 ||
        nhomHocVien > 20
      ) {
        return { error: 'Cột "nhom_hoc_vien" phải là số nguyên từ 1 đến 20' };
      }
    }

    let mucNangLuc: muc_nang_luc | undefined;
    if (raw.muc_nang_luc?.trim()) {
      const m = raw.muc_nang_luc.trim();
      if (m !== 'co_ban' && m !== 'thanh_thao' && m !== 'nang_cao') {
        return {
          error:
            'Cột "muc_nang_luc" phải là "co_ban", "thanh_thao" hoặc "nang_cao"',
        };
      }
      mucNangLuc = m;
    }

    let siSoToiDa: number | undefined;
    if (raw.si_so_toi_da?.trim()) {
      siSoToiDa = Number(raw.si_so_toi_da.trim());
      if (!Number.isInteger(siSoToiDa) || siSoToiDa < 1) {
        return { error: 'Cột "si_so_toi_da" phải là số nguyên dương' };
      }
    }

    const giaiDoanThuTuRaw = raw.giai_doan_thu_tu?.trim();
    if (!giaiDoanThuTuRaw) {
      return { error: 'Thiếu cột "giai_doan_thu_tu"' };
    }
    const giaiDoanThuTu = Number(giaiDoanThuTuRaw);
    if (!Number.isInteger(giaiDoanThuTu)) {
      return { error: 'Cột "giai_doan_thu_tu" phải là số nguyên' };
    }
    const giaiDoan = await this.prisma.giai_doan_khoa.findUnique({
      where: { khoa_id_thu_tu: { khoa_id: khoa.id, thu_tu: giaiDoanThuTu } },
    });
    if (!giaiDoan) {
      return {
        error: `Giai đoạn thứ tự "${giaiDoanThuTu}" không tồn tại trong khóa "${maKhoa}"`,
      };
    }

    const buoiSoRaw = raw.buoi_so?.trim();
    if (!buoiSoRaw) {
      return { error: 'Thiếu cột "buoi_so"' };
    }
    const buoiSo = Number(buoiSoRaw);
    if (!Number.isInteger(buoiSo) || buoiSo < 1) {
      return { error: 'Cột "buoi_so" phải là số nguyên >= 1' };
    }

    const batDau = parseVnDateTime(raw.bat_dau ?? '');
    if (!batDau) {
      return {
        error: 'Cột "bat_dau" sai định dạng — phải là "dd/mm/yyyy hh:mm"',
      };
    }
    const ketThuc = parseVnDateTime(raw.ket_thuc ?? '');
    if (!ketThuc) {
      return {
        error: 'Cột "ket_thuc" sai định dạng — phải là "dd/mm/yyyy hh:mm"',
      };
    }
    if (ketThuc <= batDau) {
      return {
        error: 'Cột "ket_thuc" phải lớn hơn "bat_dau" (rule #49)',
      };
    }

    const diaDiemHoacLink = raw.dia_diem_hoac_link?.trim() || undefined;
    if (diaDiemHoacLink && diaDiemHoacLink.length > 500) {
      return { error: 'Cột "dia_diem_hoac_link" tối đa 500 ký tự' };
    }

    if (dupKeys) {
      const key = `${khoa.id}|${tenLop.toLowerCase()}|${giaiDoan.id}|${buoiSo}`;
      if (dupKeys.has(key)) {
        return {
          error: `Dòng trùng (lớp "${tenLop}", giai đoạn thứ tự "${giaiDoanThuTu}", buổi "${buoiSo}") với dòng khác trong cùng file`,
        };
      }
      dupKeys.add(key);
    }

    return {
      dto: {
        khoa_id: khoa.id,
        ten_lop: normalizeNfcName(tenLop),
        nhom_hoc_vien: nhomHocVien,
        muc_nang_luc: mucNangLuc,
        si_so_toi_da: siSoToiDa,
        giai_doan_id: giaiDoan.id,
        buoi_so: buoiSo,
        thoi_gian_bat_dau: batDau,
        thoi_gian_ket_thuc: ketThuc,
        dia_diem_hoac_link: diaDiemHoacLink,
      },
    };
  }

  // Không cần checkValid riêng: resolveLopVaLichHocRow() (buildDto) đã tra
  // cứu/validate toàn bộ FK + định dạng thời gian + trùng lặp trong file rồi.
  //
  // Upsert theo (khoa_id, ten_lop) rồi (lop_id, giai_doan_id, buoi_so) — chạy
  // lại file sửa giờ 1 buổi chỉ update ĐÚNG buổi đó (nghiệm thu T6), các buổi
  // khác (khác buoi_so/giai_doan_id) không bị đụng tới.
  async commitLopVaLichHoc(dto: LopVaLichHocRowDto): Promise<void> {
    const lop = await this.prisma.lop_hoc.upsert({
      where: {
        khoa_id_ten_lop: { khoa_id: dto.khoa_id, ten_lop: dto.ten_lop },
      },
      create: {
        khoa_id: dto.khoa_id,
        ten_lop: dto.ten_lop,
        nhom_hoc_vien: dto.nhom_hoc_vien,
        muc_nang_luc: dto.muc_nang_luc,
        si_so_toi_da: dto.si_so_toi_da,
      },
      update: {
        nhom_hoc_vien: dto.nhom_hoc_vien,
        muc_nang_luc: dto.muc_nang_luc,
        si_so_toi_da: dto.si_so_toi_da,
      },
    });

    await this.prisma.lich_hoc_lop.upsert({
      where: {
        lop_id_giai_doan_id_buoi_so: {
          lop_id: lop.id,
          giai_doan_id: dto.giai_doan_id,
          buoi_so: dto.buoi_so,
        },
      },
      create: {
        lop_id: lop.id,
        giai_doan_id: dto.giai_doan_id,
        buoi_so: dto.buoi_so,
        thoi_gian_bat_dau: dto.thoi_gian_bat_dau,
        thoi_gian_ket_thuc: dto.thoi_gian_ket_thuc,
        dia_diem_hoac_link: dto.dia_diem_hoac_link,
      },
      update: {
        thoi_gian_bat_dau: dto.thoi_gian_bat_dau,
        thoi_gian_ket_thuc: dto.thoi_gian_ket_thuc,
        dia_diem_hoac_link: dto.dia_diem_hoac_link,
      },
    });
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
