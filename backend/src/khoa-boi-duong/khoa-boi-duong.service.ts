import { Injectable } from '@nestjs/common';
import {
  Prisma,
  khoa_boi_duong,
  lop_hoc,
  loai_lop_hoc,
  hinh_thuc_giai_doan,
  muc_nang_luc,
  trang_thai_diem_danh,
  nguon_diem_danh,
} from '@prisma/client';
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
import { CreateGiaiDoanDto } from './dto/create-giai-doan.dto';
import { UpdateGiaiDoanDto } from './dto/update-giai-doan.dto';
import { CreateLopHocDto } from './dto/create-lop-hoc.dto';
import { UpdateLopHocDto } from './dto/update-lop-hoc.dto';
import { CreateLichHocDto } from './dto/create-lich-hoc.dto';
import { UpdateLichHocDto } from './dto/update-lich-hoc.dto';
import { CreateNhanSuDto } from './dto/create-nhan-su.dto';
import { CreateCumHocVienDto } from './dto/create-cum-hoc-vien.dto';
import { UpdateCumHocVienDto } from './dto/update-cum-hoc-vien.dto';
import { CapNhatCumDangKyDto } from './dto/capnhat-cum-dang-ky.dto';
import { PhanLopHocVienRowDto } from './dto/phan-lop-row.dto';
import { KetQuaDangKyDto } from './dto/ket-qua-dang-ky.dto';
import { KetQuaDanhGiaRowDto } from './dto/ket-qua-danh-gia-row.dto';
import { LopVaLichHocRowDto } from './dto/lop-va-lich-hoc-row.dto';
import { NhanSuLopRowDto } from './dto/nhan-su-lop-row.dto';
import {
  canhBaoBuoiHocGiaiDoan,
  canhBaoLoaiLopGiaiDoan,
} from './util/canh-bao-buoi-hoc.util';
import { DiemDanhRowDto } from './dto/diem-danh-row.dto';
import { KetQuaGiaiDoanRowDto } from './dto/ket-qua-giai-doan-row.dto';
import { RowBuildResult } from '../import/import.types';
import { resolveHocVienImportRow } from '../import/util/hoc-vien-resolver.util';
import { parseVnDateTime } from '../common/utils/vn-datetime.util';

type LopHocVoiKhoa = lop_hoc & { khoa: khoa_boi_duong };

// Bộ nhớ đệm cho 1 lượt import phan_lop_hoc_vien (preview hoặc xác nhận —
// ImportService tạo mới mỗi lượt, như dupKeys): ~9.000 học viên cùng vài chục
// lớp -> tra lớp theo tên và cảnh báo (lớp, giai đoạn) chỉ 1 lần thay vì mỗi
// dòng. Lưu Promise để các dòng chạy tuần tự dùng lại ngay kết quả.
export interface BoNhoPhanLop {
  lopTheoTen: Map<string, Promise<lop_hoc[]>>;
  canhBaoGan: Map<string, Promise<string | undefined>>;
}

export function taoBoNhoPhanLop(): BoNhoPhanLop {
  return { lopTheoTen: new Map(), canhBaoGan: new Map() };
}

// Dịch vụ Khóa bồi dưỡng & Lớp học — docs/api-contract.md mục 3 +
// docs/validation-checklist.md rule #47-52. D1/D6 (2026-10-03-don-vi-dat-
// hang): chỉ quan_tri (HCMUE) ghi; khóa tạo ra da_duyet ngay, không còn luồng
// nộp duyệt/duyệt hay danh sách đơn vị theo dõi.
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

  // Dùng cho các PATCH .../{id}/... (giai-doan, lop, cum) — kiểm tra con
  // (giaiDoanId/lopId/cumId) thực sự thuộc đúng khoaId trên URL, không chỉ
  // tồn tại (tránh 1 tài khoản chủ khóa A sửa nhầm/cố ý con của khóa B bằng
  // cách truyền khoaId của khóa A + id con của khóa B).
  private async getGiaiDoanTrongKhoaOrThrow(
    khoaId: string,
    giaiDoanId: string,
  ) {
    const giaiDoan = await this.prisma.giai_doan_khoa.findUnique({
      where: { id: giaiDoanId },
    });
    if (!giaiDoan || giaiDoan.khoa_id !== khoaId) {
      throw new NotFoundAppException('Không tìm thấy giai đoạn trong khóa này');
    }
    return giaiDoan;
  }

  private async getLopTrongKhoaOrThrow(khoaId: string, lopId: string) {
    const lop = await this.prisma.lop_hoc.findUnique({ where: { id: lopId } });
    if (!lop || lop.khoa_id !== khoaId) {
      throw new NotFoundAppException('Không tìm thấy lớp học trong khóa này');
    }
    return lop;
  }

  private async getCumTrongKhoaOrThrow(khoaId: string, cumId: string) {
    const cum = await this.prisma.cum_hoc_vien.findUnique({
      where: { id: cumId },
    });
    if (!cum || cum.khoa_id !== khoaId) {
      throw new NotFoundAppException(
        'Không tìm thấy cụm học viên trong khóa này',
      );
    }
    return cum;
  }

  private async getLichHocTrongLopOrThrow(lopId: string, lichHocId: string) {
    const lich = await this.prisma.lich_hoc_lop.findUnique({
      where: { id: lichHocId },
    });
    if (!lich || lich.lop_id !== lopId) {
      throw new NotFoundAppException('Không tìm thấy lịch học trong lớp này');
    }
    return lich;
  }

  // Rule mới (2026-09-30): PATCH không cho phép body rỗng/không có trường
  // hợp lệ nào — tránh gọi PATCH "không làm gì cả" (dễ nhầm là đã sửa).
  // ValidationPipe đã whitelist:true (main.ts) nên dto chỉ còn đúng các
  // trường khai báo trong DTO, field lạ đã bị strip từ trước khi tới đây.
  private assertCoTruongSua<T extends object>(dto: T): void {
    const coTruong = Object.values(dto as Record<string, unknown>).some(
      (v) => v !== undefined,
    );
    if (!coTruong) {
      throw new ValidationException(
        'Body rỗng — phải có ít nhất 1 trường hợp lệ để sửa',
      );
    }
  }

  // D1/D2/D6 (spec mục 2+4): validate don_vi_dat_hang_id dùng chung cho
  // taoKhoa (luôn bắt buộc) và capNhatKhoa (chỉ gọi khi dto có truyền giá
  // trị — undefined ở update nghĩa là "không đổi", không phải "thiếu").
  private async validateDonViDatHang(
    id: string | undefined,
  ): Promise<{ id: string }> {
    if (!id) {
      throw new ValidationException('Thiếu đơn vị đặt hàng', [
        { field: 'don_vi_dat_hang_id', message: 'Bắt buộc' },
      ]);
    }
    const donVi = await this.prisma.don_vi_cong_tac.findUnique({
      where: { id },
    });
    if (!donVi || donVi.trang_thai !== 'active') {
      throw new ValidationException(
        'don_vi_dat_hang_id không tồn tại hoặc đã ngừng hoạt động',
        [{ field: 'don_vi_dat_hang_id', message: 'Không hợp lệ' }],
      );
    }
    if (donVi.loai_don_vi === 'phong_vhxh') {
      throw new ValidationException(
        'don_vi_dat_hang_id không được là Phòng VHXH (D2)',
        [{ field: 'don_vi_dat_hang_id', message: 'Sai loại đơn vị' }],
      );
    }
    return donVi;
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
  // D1/D6 (2026-10-03-don-vi-dat-hang): chỉ quan_tri tạo khóa (RolesGuard ở
  // controller) — khóa tạo ra da_duyet NGAY, không còn luồng nộp duyệt/duyệt.
  async taoKhoa(dto: CreateKhoaBoiDuongDto, caller: AuthenticatedUser) {
    this.assertThoiGianHopLe(
      dto.thoi_gian_bat_dau,
      dto.thoi_gian_ket_thuc,
      'khóa',
      true,
    );
    const donVi = await this.validateDonViDatHang(dto.don_vi_dat_hang_id);
    try {
      return await this.prisma.khoa_boi_duong.create({
        data: {
          ma_khoa: dto.ma_khoa.trim(),
          ten_khoa: normalizeNfcName(dto.ten_khoa),
          don_vi_dat_hang_id: donVi.id,
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

  // D6/spec mục 4: quan_tri sửa được ở mọi trạng thái (bỏ ràng buộc chỉ
  // nhap/tu_choi); don_vi_dat_hang_id tùy chọn — chỉ validate lại khi dto có
  // truyền giá trị mới.
  async capNhatKhoa(
    id: string,
    dto: UpdateKhoaBoiDuongDto,
    caller: AuthenticatedUser,
  ) {
    const khoa = await this.getKhoaOrThrow(id);

    let donViId: string | undefined;
    if (dto.don_vi_dat_hang_id !== undefined) {
      donViId = (await this.validateDonViDatHang(dto.don_vi_dat_hang_id)).id;
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
          don_vi_dat_hang_id: donViId,
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

  // ---------------------------------------------------------------------
  // PATCH /dang-ky-hoc/{id}/ket-qua — docs/api-contract.md mục 3 (thêm
  // 2026-09-25). D6 (2026-10-03-don-vi-dat-hang): RolesGuard ở controller
  // đã chặn chỉ quan_tri gọi được — canAccessDonVi() dưới đây vô hại cho
  // quan_tri (scope luôn 'ALL'), giữ nguyên để không động tới logic đã có.
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
      dangKy.khoa.don_vi_dat_hang_id,
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
        if (query.don_vi_dat_hang_id) {
          if (!scope.includes(query.don_vi_dat_hang_id)) {
            throw new ForbiddenAppException(
              'Đơn vị tổ chức nằm ngoài phạm vi quyền',
            );
          }
          where.don_vi_dat_hang_id = query.don_vi_dat_hang_id;
        } else {
          // T2 (QĐ2): mở rộng thêm các khóa mà đơn vị của caller đang "theo
          // dõi" (là chính đơn vị theo dõi hoặc nằm dưới nó trong cây) —
          // ngoài phạm vi sở hữu don_vi_dat_hang_id như trước.
          const theoDoiKhoaIds =
            await this.scopeService.getKhoaIdsTheoDoi(caller);
          where.OR =
            theoDoiKhoaIds.length > 0
              ? [
                  { don_vi_dat_hang_id: { in: scope } },
                  { id: { in: theoDoiKhoaIds } },
                ]
              : undefined;
          if (!where.OR) where.don_vi_dat_hang_id = { in: scope };
        }
      } else if (query.don_vi_dat_hang_id) {
        where.don_vi_dat_hang_id = query.don_vi_dat_hang_id;
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
        // QĐ10 (mo-rong-nls-an-giang.md, 2026-09-30): trả kèm danh sách cụm
        // học viên của khóa bên cạnh giai đoạn/lớp đã có.
        cum_hoc_vien: { orderBy: { ten_cum: 'asc' } },
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
        khoa.don_vi_dat_hang_id,
      );
      if (!coQuyen) {
        // T2 (QĐ2): chưa sở hữu don_vi_dat_hang_id — vẫn xem được nếu đơn vị
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

    // Sĩ số hiện tại = số đăng ký khác nhau đang được gán vào lớp ở bất kỳ
    // giai đoạn nào (1 học viên học cùng lớp ở 2 giai đoạn chỉ tính 1).
    const capLopDangKy = await this.prisma.phan_lop_giai_doan.groupBy({
      by: ['lop_id', 'dang_ky_hoc_id'],
      where: { lop: { khoa_id: id } },
    });
    const siSoTheoLop = new Map<string, number>();
    for (const r of capLopDangKy) {
      siSoTheoLop.set(r.lop_id, (siSoTheoLop.get(r.lop_id) ?? 0) + 1);
    }
    return {
      ...khoa,
      lop_hoc: khoa.lop_hoc.map((l) => ({
        ...l,
        si_so_hien_tai: siSoTheoLop.get(l.id) ?? 0,
      })),
    };
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
          link_hoac_dia_diem: dto.link_hoac_dia_diem?.trim() || null,
          huong_dan: dto.huong_dan?.trim() || null,
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
  // PATCH /khoa-boi-duong/{id}/giai-doan/{giaiDoanId} — sửa một phần. Thêm
  // 2026-09-30.
  // ---------------------------------------------------------------------
  async capNhatGiaiDoan(
    khoaId: string,
    giaiDoanId: string,
    dto: UpdateGiaiDoanDto,
    caller: AuthenticatedUser,
  ) {
    const khoa = await this.getKhoaOrThrow(khoaId);
    const giaiDoan = await this.getGiaiDoanTrongKhoaOrThrow(khoaId, giaiDoanId);
    this.assertCoTruongSua(dto);

    if (dto.thoi_gian_bat_dau || dto.thoi_gian_ket_thuc) {
      const batDau =
        dto.thoi_gian_bat_dau ?? giaiDoan.thoi_gian_bat_dau.toISOString();
      const ketThuc =
        dto.thoi_gian_ket_thuc ?? giaiDoan.thoi_gian_ket_thuc.toISOString();
      this.assertThoiGianHopLe(batDau, ketThuc, 'giai đoạn', true);
    }

    try {
      return await this.prisma.giai_doan_khoa.update({
        where: { id: giaiDoanId },
        data: {
          thu_tu: dto.thu_tu,
          ten_giai_doan: dto.ten_giai_doan
            ? normalizeNfcName(dto.ten_giai_doan)
            : undefined,
          hinh_thuc: dto.hinh_thuc,
          thoi_gian_bat_dau: dto.thoi_gian_bat_dau
            ? new Date(dto.thoi_gian_bat_dau)
            : undefined,
          thoi_gian_ket_thuc: dto.thoi_gian_ket_thuc
            ? new Date(dto.thoi_gian_ket_thuc)
            : undefined,
          trang_thai: dto.trang_thai,
          // undefined = không đổi; null hoặc chuỗi rỗng = xóa.
          link_hoac_dia_diem:
            dto.link_hoac_dia_diem === undefined
              ? undefined
              : dto.link_hoac_dia_diem?.trim() || null,
          huong_dan:
            dto.huong_dan === undefined
              ? undefined
              : dto.huong_dan?.trim() || null,
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
    return this.prisma.lop_hoc.create({
      data: {
        khoa_id: khoaId,
        loai_lop: dto.loai_lop,
        ten_lop: normalizeNfcName(dto.ten_lop),
        si_so_toi_da: dto.si_so_toi_da,
      },
    });
  }

  // ---------------------------------------------------------------------
  // PATCH /khoa-boi-duong/{id}/lop/{lopId} — sửa một phần. Thêm 2026-09-30.
  // Đổi loai_lop khi lớp đang có đăng ký (phan_lop_giai_doan trỏ tới) KHÔNG bị
  // chặn (quyết định tự chọn — flagged trong self-review: yêu cầu không nói
  // rõ nên chặn hay cho phép, chọn "cho phép + cảnh báo" giống cách làm hiện
  // có cho lệch mức năng lực khi import phân lớp, xem resolvePhanLopRow phía
  // trên) — trả kèm canh_bao trong response, KHÔNG tự động sửa/xóa các dòng
  // phan_lop_giai_doan (đổi hộ có thể gây mất dữ liệu ngoài ý muốn).
  // ---------------------------------------------------------------------
  async capNhatLop(
    khoaId: string,
    lopId: string,
    dto: UpdateLopHocDto,
    caller: AuthenticatedUser,
  ) {
    const khoa = await this.getKhoaOrThrow(khoaId);
    const lop = await this.getLopTrongKhoaOrThrow(khoaId, lopId);
    this.assertCoTruongSua(dto);

    let canhBao: string | undefined;
    if (dto.loai_lop && dto.loai_lop !== lop.loai_lop) {
      const soDangKy = (
        await this.prisma.phan_lop_giai_doan.groupBy({
          by: ['dang_ky_hoc_id'],
          where: { lop_id: lopId },
        })
      ).length;
      if (soDangKy > 0) {
        canhBao = `Lớp này đang có ${soDangKy} đăng ký học được phân vào — đổi loại lớp sang "${dto.loai_lop}" không tự cập nhật phân lớp theo giai đoạn, cần rà soát lại`;
      }
    }

    let updated;
    try {
      updated = await this.prisma.lop_hoc.update({
        where: { id: lopId },
        data: {
          loai_lop: dto.loai_lop,
          ten_lop: dto.ten_lop ? normalizeNfcName(dto.ten_lop) : undefined,
          si_so_toi_da: dto.si_so_toi_da,
          nhom_hoc_vien: dto.nhom_hoc_vien,
          muc_nang_luc: dto.muc_nang_luc,
          trang_thai: dto.trang_thai,
        },
      });
    } catch (e) {
      throw this.mapUniqueViolation(
        e,
        'Tên lớp đã tồn tại trong loại lớp này của khóa',
        'ten_lop',
      );
    }
    return canhBao ? { ...updated, canh_bao: canhBao } : updated;
  }

  // ---------------------------------------------------------------------
  // POST /khoa-boi-duong/{id}/cum — QĐ10 (mo-rong-nls-an-giang.md,
  // 2026-09-30): cụm học viên, cùng quyền thao tác với themLop (D6: quan_tri).
  // ---------------------------------------------------------------------
  async themCum(
    khoaId: string,
    dto: CreateCumHocVienDto,
    caller: AuthenticatedUser,
  ) {
    const khoa = await this.getKhoaOrThrow(khoaId);
    try {
      return await this.prisma.cum_hoc_vien.create({
        data: {
          khoa_id: khoaId,
          ten_cum: normalizeNfcName(dto.ten_cum),
          link_zalo: dto.link_zalo,
          ghi_chu: dto.ghi_chu,
        },
      });
    } catch (e) {
      throw this.mapUniqueViolation(
        e,
        'Tên cụm đã tồn tại trong khóa này',
        'ten_cum',
      );
    }
  }

  // ---------------------------------------------------------------------
  // PATCH /khoa-boi-duong/{id}/cum/{cumId} — sửa một phần. Thêm 2026-09-30.
  // ---------------------------------------------------------------------
  async capNhatCum(
    khoaId: string,
    cumId: string,
    dto: UpdateCumHocVienDto,
    caller: AuthenticatedUser,
  ) {
    const khoa = await this.getKhoaOrThrow(khoaId);
    await this.getCumTrongKhoaOrThrow(khoaId, cumId);
    this.assertCoTruongSua(dto);

    try {
      return await this.prisma.cum_hoc_vien.update({
        where: { id: cumId },
        data: {
          ten_cum: dto.ten_cum ? normalizeNfcName(dto.ten_cum) : undefined,
          link_zalo: dto.link_zalo,
          ghi_chu: dto.ghi_chu,
          trang_thai: dto.trang_thai,
        },
      });
    } catch (e) {
      throw this.mapUniqueViolation(
        e,
        'Tên cụm đã tồn tại trong khóa này',
        'ten_cum',
      );
    }
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
  // PATCH /lop/{id}/lich-hoc/{lichHocId} — sửa một phần. Thêm 2026-09-30.
  // Không cho đổi giai_doan_id (xem comment UpdateLichHocDto).
  // ---------------------------------------------------------------------
  async capNhatLichHoc(
    lopId: string,
    lichHocId: string,
    dto: UpdateLichHocDto,
    caller: AuthenticatedUser,
  ) {
    const lop = await this.getLopOrThrow(lopId);
    const lich = await this.getLichHocTrongLopOrThrow(lopId, lichHocId);
    this.assertCoTruongSua(dto);

    if (dto.thoi_gian_bat_dau || dto.thoi_gian_ket_thuc) {
      const batDau =
        dto.thoi_gian_bat_dau ?? lich.thoi_gian_bat_dau.toISOString();
      const ketThuc =
        dto.thoi_gian_ket_thuc ?? lich.thoi_gian_ket_thuc.toISOString();
      this.assertThoiGianHopLe(batDau, ketThuc, 'lịch học', false);
    }

    try {
      return await this.prisma.lich_hoc_lop.update({
        where: { id: lichHocId },
        data: {
          thoi_gian_bat_dau: dto.thoi_gian_bat_dau
            ? new Date(dto.thoi_gian_bat_dau)
            : undefined,
          thoi_gian_ket_thuc: dto.thoi_gian_ket_thuc
            ? new Date(dto.thoi_gian_ket_thuc)
            : undefined,
          dia_diem_hoac_link: dto.dia_diem_hoac_link,
          buoi_so: dto.buoi_so,
          trang_thai: dto.trang_thai,
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

  // Phân lớp theo giai đoạn (spec 2026-10-02 mục 5.1) — THAY ĐỔI CẤU TRÚC
  // RESPONSE: bỏ lop_truc_tiep/lop_zoom/lop_vle/tien_do_giai_doan, thay bằng
  // giai_doan[] (mọi giai đoạn active của khóa, theo thu_tu) — mỗi phần tử
  // kèm lớp được gán ở giai đoạn đó (chỉ buổi thuộc giai đoạn đó) hoặc null,
  // link/hướng dẫn chung của giai đoạn, và tiến độ (ket_qua_giai_doan).
  //
  // Dùng chung cho GET /hoc-vien/toi/khoa-hoc VÀ GET /hoc-vien/{id}/khoa-hoc.
  private async khoaHocTheoHocVienId(hocVienId: string) {
    const dangKyList = await this.prisma.dang_ky_hoc.findMany({
      where: { hoc_vien_id: hocVienId },
      include: {
        khoa: {
          include: {
            giai_doan: {
              where: { trang_thai: 'active' },
              orderBy: { thu_tu: 'asc' },
            },
          },
        },
        cum: true,
        phan_lop_giai_doan: {
          include: {
            lop: {
              include: {
                nhan_su: true,
                lich_hoc: {
                  include: { giai_doan: true },
                  orderBy: [
                    { buoi_so: 'asc' },
                    { thoi_gian_bat_dau: 'asc' },
                    { dia_diem_hoac_link: 'asc' },
                  ],
                },
              },
            },
          },
        },
      },
      orderBy: { ngay_dang_ky: 'desc' },
    });

    // T12: trạng thái điểm danh từng buổi + tiến độ từng giai đoạn — truy
    // vấn RIÊNG rồi map thủ công (Prisma không lọc nested theo field anh em).
    const dangKyIds = dangKyList.map((dk) => dk.id);
    const [diemDanhList, ketQuaGiaiDoanList] = dangKyIds.length
      ? await Promise.all([
          this.prisma.diem_danh.findMany({
            where: { dang_ky_hoc_id: { in: dangKyIds } },
            select: {
              dang_ky_hoc_id: true,
              lich_hoc_id: true,
              trang_thai: true,
            },
          }),
          this.prisma.ket_qua_giai_doan.findMany({
            where: { dang_ky_hoc_id: { in: dangKyIds } },
          }),
        ])
      : [[], []];

    const diemDanhMap = new Map(
      diemDanhList.map((d) => [
        `${d.dang_ky_hoc_id}|${d.lich_hoc_id}`,
        d.trang_thai,
      ]),
    );
    const tienDoMap = new Map(
      ketQuaGiaiDoanList.map((kq) => [
        `${kq.dang_ky_hoc_id}|${kq.giai_doan_id}`,
        {
          ty_le_hoan_thanh:
            kq.ty_le_hoan_thanh == null ? null : Number(kq.ty_le_hoan_thanh),
          diem: kq.diem == null ? null : Number(kq.diem),
        },
      ]),
    );

    return dangKyList.map((dk) => {
      const { phan_lop_giai_doan, khoa, ...rest } = dk;
      const { giai_doan: dsGiaiDoan, ...khoaGon } = khoa;
      return {
        ...rest,
        khoa: khoaGon,
        giai_doan: dsGiaiDoan.map((gd) => {
          const lop = phan_lop_giai_doan.find(
            (p) => p.giai_doan_id === gd.id,
          )?.lop;
          return {
            id: gd.id,
            thu_tu: gd.thu_tu,
            ten_giai_doan: gd.ten_giai_doan,
            hinh_thuc: gd.hinh_thuc,
            thoi_gian_bat_dau: gd.thoi_gian_bat_dau,
            thoi_gian_ket_thuc: gd.thoi_gian_ket_thuc,
            link_hoac_dia_diem: gd.link_hoac_dia_diem,
            huong_dan: gd.huong_dan,
            lop: lop
              ? {
                  ...lop,
                  lich_hoc: lop.lich_hoc
                    .filter((b) => b.giai_doan_id === gd.id)
                    .map((b) => ({
                      ...b,
                      trang_thai_diem_danh:
                        diemDanhMap.get(`${dk.id}|${b.id}`) ?? null,
                    })),
                }
              : null,
            tien_do: tienDoMap.get(`${dk.id}|${gd.id}`) ?? null,
          };
        }),
      };
    });
  }

  async khoaHocCuaToi(caller: AuthenticatedUser) {
    const hocVienId = this.assertHocVienId(caller);
    return this.khoaHocTheoHocVienId(hocVienId);
  }

  // GET /hoc-vien/{id}/khoa-hoc — Thêm 2026-09-30 (QĐ10): admin/Trường/Sở/
  // Phòng xem lại khóa/lớp của 1 học viên cụ thể (chuẩn bị đổi lớp/cụm qua
  // PATCH/DELETE /dang-ky-hoc/{id}/lop, PATCH /dang-ky-hoc/{id}/cum ở trên)
  // — khác GET /hoc-vien/toi/khoa-hoc (chính học viên tự xem). Tái dùng
  // ĐÚNG cơ chế phân quyền của HocVienService.findOne (canAccessDonVi theo
  // don_vi_cong_tac_id của hồ sơ), không tự chế logic phân quyền riêng.
  async khoaHocCuaHocVien(hocVienId: string, caller: AuthenticatedUser) {
    const hocVien = await this.prisma.hoc_vien.findUnique({
      where: { id: hocVienId },
    });
    if (!hocVien) {
      throw new NotFoundAppException('Không tìm thấy hồ sơ học viên');
    }
    const coQuyen = await this.scopeService.canAccessDonVi(
      caller,
      hocVien.don_vi_cong_tac_id,
    );
    if (!coQuyen) {
      throw new ForbiddenAppException(
        'Hồ sơ này nằm ngoài phạm vi quyền của tài khoản hiện tại',
      );
    }
    return this.khoaHocTheoHocVienId(hocVienId);
  }

  async ketQuaCuaToi(caller: AuthenticatedUser) {
    const hocVienId = this.assertHocVienId(caller);
    const list = await this.prisma.dang_ky_hoc.findMany({
      where: { hoc_vien_id: hocVienId },
      select: {
        id: true,
        trang_thai: true,
        ket_qua: true,
        ngay_hoan_thanh: true,
        khoa: { select: { id: true, ma_khoa: true, ten_khoa: true } },
        phan_lop_giai_doan: {
          select: {
            giai_doan: { select: { thu_tu: true, ten_giai_doan: true } },
            lop: { select: { id: true, ten_lop: true } },
          },
          orderBy: { giai_doan: { thu_tu: 'asc' } },
        },
      },
      orderBy: { ngay_dang_ky: 'desc' },
    });

    // Phân lớp theo giai đoạn (spec 2026-10-02): phan_lop thay cho 3 trường
    // lop_truc_tiep/lop_zoom/lop_vle.
    return list.map(({ phan_lop_giai_doan, ...rest }) => ({
      ...rest,
      phan_lop: phan_lop_giai_doan.map((p) => ({
        thu_tu: p.giai_doan.thu_tu,
        ten_giai_doan: p.giai_doan.ten_giai_doan,
        lop: p.lop,
      })),
    }));
  }

  // ---------------------------------------------------------------------
  // PUT /dang-ky-hoc/{id}/giai-doan/{giaiDoanId}/lop, PATCH
  // /dang-ky-hoc/{id}/cum — thao tác thủ công từng đăng ký học một (màn admin
  // chi tiết học viên). D6: chỉ quan_tri (RolesGuard ở controller).
  // ---------------------------------------------------------------------
  private async getDangKyOrThrow(id: string) {
    const dangKy = await this.prisma.dang_ky_hoc.findUnique({
      where: { id },
      include: { khoa: true },
    });
    if (!dangKy) throw new NotFoundAppException('Không tìm thấy đăng ký học');
    return dangKy;
  }

  // Cảnh báo 🟡 khi gán lớp vào giai đoạn: lớp không có buổi nào trong giai
  // đoạn, hoặc loại lớp lệch hình thức — dùng chung gán tay + import.
  async canhBaoGanLopGiaiDoan(
    lop: { id: string; ten_lop: string; loai_lop: loai_lop_hoc },
    giaiDoan: {
      id: string;
      thu_tu: number;
      ten_giai_doan: string;
      hinh_thuc: hinh_thuc_giai_doan;
    },
  ): Promise<string | undefined> {
    const lyDo: string[] = [];
    const soBuoi = await this.prisma.lich_hoc_lop.count({
      where: { lop_id: lop.id, giai_doan_id: giaiDoan.id },
    });
    if (soBuoi === 0) lyDo.push('lớp không có buổi nào trong giai đoạn này');
    const lech = canhBaoLoaiLopGiaiDoan(lop.loai_lop, giaiDoan.hinh_thuc);
    if (lech) lyDo.push(lech);
    if (lyDo.length === 0) return undefined;
    return `Lớp "${lop.ten_lop}" ở giai đoạn ${giaiDoan.thu_tu} "${giaiDoan.ten_giai_doan}": ${lyDo.join('; ')}`;
  }

  // PUT /dang-ky-hoc/{id}/giai-doan/{giaiDoanId}/lop — gán/thay/gỡ lớp của 1
  // giai đoạn. Gán -> da_phan_lop; gỡ KHÔNG đổi trạng thái đăng ký.
  async ganLopGiaiDoan(
    dangKyHocId: string,
    giaiDoanId: string,
    lopId: string | null,
    caller: AuthenticatedUser,
  ) {
    const dangKy = await this.getDangKyOrThrow(dangKyHocId);
    const giaiDoan = await this.prisma.giai_doan_khoa.findUnique({
      where: { id: giaiDoanId },
    });
    if (!giaiDoan || giaiDoan.khoa_id !== dangKy.khoa_id) {
      throw new ValidationException(
        'Giai đoạn không thuộc khóa của đăng ký này',
        [{ field: 'giai_doan_id', message: 'Phải thuộc cùng khóa bồi dưỡng' }],
      );
    }

    if (lopId === null) {
      await this.prisma.phan_lop_giai_doan.deleteMany({
        where: { dang_ky_hoc_id: dangKyHocId, giai_doan_id: giaiDoanId },
      });
      return { phan_lop: null };
    }

    const lop = await this.prisma.lop_hoc.findUnique({ where: { id: lopId } });
    if (!lop || lop.khoa_id !== dangKy.khoa_id) {
      throw new ValidationException('Lớp không thuộc khóa của đăng ký này', [
        { field: 'lop_id', message: 'Phải thuộc cùng khóa bồi dưỡng' },
      ]);
    }
    const phanLop = await this.prisma.phan_lop_giai_doan.upsert({
      where: {
        dang_ky_hoc_id_giai_doan_id: {
          dang_ky_hoc_id: dangKyHocId,
          giai_doan_id: giaiDoanId,
        },
      },
      create: {
        dang_ky_hoc_id: dangKyHocId,
        giai_doan_id: giaiDoanId,
        lop_id: lopId,
      },
      update: { lop_id: lopId },
    });
    if (dangKy.trang_thai !== 'da_phan_lop') {
      await this.prisma.dang_ky_hoc.update({
        where: { id: dangKyHocId },
        data: { trang_thai: 'da_phan_lop' },
      });
    }
    const canhBao = await this.canhBaoGanLopGiaiDoan(lop, giaiDoan);
    return canhBao
      ? { phan_lop: phanLop, canh_bao: canhBao }
      : { phan_lop: phanLop };
  }

  async capNhatCumDangKy(
    id: string,
    dto: CapNhatCumDangKyDto,
    caller: AuthenticatedUser,
  ) {
    const dangKy = await this.getDangKyOrThrow(id);

    const cumId = dto.cum_id ?? null;
    if (cumId) {
      const cum = await this.prisma.cum_hoc_vien.findUnique({
        where: { id: cumId },
      });
      if (!cum) {
        throw new ValidationException('cum_id không tồn tại', [
          { field: 'cum_id', message: 'Không tồn tại' },
        ]);
      }
      if (cum.khoa_id !== dangKy.khoa_id) {
        throw new ValidationException(
          'Cụm không thuộc cùng khóa với đăng ký học này',
          [{ field: 'cum_id', message: 'Phải thuộc cùng khóa bồi dưỡng' }],
        );
      }
    }
    return this.prisma.dang_ky_hoc.update({
      where: { id },
      data: { cum_id: cumId },
    });
  }

  // ---------------------------------------------------------------------
  // Import phan_lop_hoc_vien theo giai đoạn (gọi từ ImportService — spec
  // 2026-10-02-phan-lop-theo-giai-doan mục 4). raw gồm so_dinh_danh_ca_nhan,
  // ma_dinh_danh_moet, ten_cum và key "gd:<thu_tu>" cho mỗi cột giai đoạn có
  // trong file. Ô trống = giữ nguyên; "-" = gỡ; tên lớp = gán/thay. Tên lớp
  // tra trong cả khóa (không theo loại) — trùng tên giữa các loại lớp là lỗi,
  // buộc đổi tên để không phải đoán. Đây vẫn là cơ chế DUY NHẤT tạo
  // dang_ky_hoc (ghi danh) — xem validation-checklist.md #45. Check
  // trang_thai='da_duyet' của hồ sơ giữ nguyên như trước (T3).
  // ---------------------------------------------------------------------
  async resolvePhanLopRow(
    raw: Record<string, string>,
    // giai_doan: các giai đoạn ACTIVE đã nạp sẵn (ImportService.cotPhanLop) —
    // không truyền thì tự truy vấn.
    khoa: {
      id: string;
      ma_khoa: string;
      giai_doan?: {
        id: string;
        thu_tu: number;
        ten_giai_doan: string;
        hinh_thuc: hinh_thuc_giai_doan;
      }[];
    },
    dupKeys?: Set<string>,
    boNho: BoNhoPhanLop = taoBoNhoPhanLop(),
  ): Promise<RowBuildResult<PhanLopHocVienRowDto>> {
    const resolved = await resolveHocVienImportRow(this.prisma, {
      so_dinh_danh_ca_nhan: raw.so_dinh_danh_ca_nhan,
      ma_dinh_danh_moet: raw.ma_dinh_danh_moet,
    });
    if (resolved.error || !resolved.hocVien) {
      return { error: resolved.error ?? 'Không xác định được học viên' };
    }
    const hocVien = resolved.hocVien;
    const ma =
      raw.so_dinh_danh_ca_nhan?.trim() || raw.ma_dinh_danh_moet?.trim() || '';
    if (hocVien.trang_thai !== 'da_duyet') {
      return {
        error: `Học viên "${ma}" chưa được duyệt (trang_thai hiện tại: "${hocVien.trang_thai}")`,
      };
    }
    if (dupKeys) {
      if (dupKeys.has(hocVien.id)) {
        return {
          error: `Dòng trùng học viên "${ma}" với dòng khác trong cùng file`,
        };
      }
      dupKeys.add(hocVien.id);
    }

    const giaiDoanList =
      khoa.giai_doan ??
      (await this.prisma.giai_doan_khoa.findMany({
        where: { khoa_id: khoa.id, trang_thai: 'active' },
        orderBy: { thu_tu: 'asc' },
      }));
    const gan: { giai_doan_id: string; lop_id: string | null }[] = [];
    const canhBaoList: string[] = [];
    // Mức đầu vào của học viên: tra tối đa 1 lần/dòng, chỉ khi có lớp gắn mức.
    let mucDauVao: Promise<muc_nang_luc | null> | undefined;
    for (const gd of giaiDoanList) {
      const o = raw[`gd:${gd.thu_tu}`]?.trim();
      if (!o) continue;
      if (o === '-') {
        gan.push({ giai_doan_id: gd.id, lop_id: null });
        continue;
      }
      const tenLop = normalizeNfcName(o);
      let lopsPromise = boNho.lopTheoTen.get(tenLop);
      if (!lopsPromise) {
        lopsPromise = this.prisma.lop_hoc.findMany({
          where: { khoa_id: khoa.id, ten_lop: tenLop },
        });
        boNho.lopTheoTen.set(tenLop, lopsPromise);
      }
      const lops = await lopsPromise;
      if (lops.length === 0) {
        return {
          error: `GĐ${gd.thu_tu}: lớp "${o}" không tồn tại trong khóa "${khoa.ma_khoa}"`,
        };
      }
      if (lops.length > 1) {
        return {
          error: `GĐ${gd.thu_tu}: tên lớp "${o}" có ở nhiều loại lớp (${lops.map((l) => l.loai_lop).join(', ')}) — đổi tên lớp cho khác nhau`,
        };
      }
      const lop = lops[0];
      gan.push({ giai_doan_id: gd.id, lop_id: lop.id });
      const khoaCanhBao = `${lop.id}|${gd.id}`;
      let cbPromise = boNho.canhBaoGan.get(khoaCanhBao);
      if (!cbPromise) {
        cbPromise = this.canhBaoGanLopGiaiDoan(lop, gd);
        boNho.canhBaoGan.set(khoaCanhBao, cbPromise);
      }
      const cb = await cbPromise;
      if (cb) canhBaoList.push(cb);
      if (lop.muc_nang_luc) {
        mucDauVao ??= this.prisma.dang_ky_hoc
          .findUnique({
            where: {
              hoc_vien_id_khoa_id: {
                hoc_vien_id: hocVien.id,
                khoa_id: khoa.id,
              },
            },
            select: { muc_dau_vao: true },
          })
          .then((dk) => dk?.muc_dau_vao ?? null);
        const muc = await mucDauVao;
        if (muc && muc !== lop.muc_nang_luc) {
          canhBaoList.push(
            `Học viên "${ma}" có mức đầu vào "${muc}" khác mức năng lực "${lop.muc_nang_luc}" của lớp "${lop.ten_lop}" — kiểm tra lại phân lớp`,
          );
        }
      }
    }

    let cumId: string | undefined;
    const tenCum = raw.ten_cum?.trim();
    if (tenCum) {
      // Tên cụm lưu dạng NFC — file Excel từ Mac có thể là NFD.
      const cum = await this.prisma.cum_hoc_vien.findUnique({
        where: {
          khoa_id_ten_cum: {
            khoa_id: khoa.id,
            ten_cum: normalizeNfcName(tenCum),
          },
        },
      });
      if (!cum) {
        return {
          error: `Không tìm thấy cụm học viên "${tenCum}" trong khóa "${khoa.ma_khoa}"`,
        };
      }
      cumId = cum.id;
    }

    return {
      dto: { hoc_vien_id: hocVien.id, khoa_id: khoa.id, cum_id: cumId, gan },
      canhBao: canhBaoList.length ? canhBaoList.join('; ') : undefined,
    };
  }

  // Ghi danh (upsert dang_ky_hoc) + áp từng gán theo giai đoạn. Gán ≥ 1 lớp
  // -> da_phan_lop; gỡ KHÔNG đổi trạng thái; dòng chỉ ghi danh/gán cụm giữ
  // hành vi cũ (không hạ cấp trạng thái, mặc định da_duyet khi tạo mới).
  //
  // Trả về hocVienChuaCoEmail để ImportService đếm so_hoc_vien_chua_co_email
  // (T3, QĐ6). Email dang_ky_hoc_phan_lop chỉ khi dòng gán ≥ 1 lớp TRỰC TIẾP
  // (giữ nguyên trigger cũ).
  async commitPhanLop(
    dto: PhanLopHocVienRowDto,
  ): Promise<{ hocVienChuaCoEmail: boolean }> {
    const coGanLop = dto.gan.some((g) => g.lop_id);
    const dangKy = await this.prisma.dang_ky_hoc.upsert({
      where: {
        hoc_vien_id_khoa_id: {
          hoc_vien_id: dto.hoc_vien_id,
          khoa_id: dto.khoa_id,
        },
      },
      create: {
        hoc_vien_id: dto.hoc_vien_id,
        khoa_id: dto.khoa_id,
        trang_thai: coGanLop ? 'da_phan_lop' : 'da_duyet',
        cum_id: dto.cum_id,
      },
      update: {
        ...(coGanLop ? { trang_thai: 'da_phan_lop' as const } : {}),
        ...(dto.cum_id !== undefined ? { cum_id: dto.cum_id } : {}),
      },
    });

    for (const g of dto.gan) {
      if (g.lop_id === null) {
        await this.prisma.phan_lop_giai_doan.deleteMany({
          where: { dang_ky_hoc_id: dangKy.id, giai_doan_id: g.giai_doan_id },
        });
        continue;
      }
      await this.prisma.phan_lop_giai_doan.upsert({
        where: {
          dang_ky_hoc_id_giai_doan_id: {
            dang_ky_hoc_id: dangKy.id,
            giai_doan_id: g.giai_doan_id,
          },
        },
        create: {
          dang_ky_hoc_id: dangKy.id,
          giai_doan_id: g.giai_doan_id,
          lop_id: g.lop_id,
        },
        update: { lop_id: g.lop_id },
      });
    }

    const lopIds = dto.gan.flatMap((g) => (g.lop_id ? [g.lop_id] : []));
    const coLopTrucTiep =
      lopIds.length > 0 &&
      (await this.prisma.lop_hoc.count({
        where: { id: { in: lopIds }, loai_lop: 'truc_tiep' },
      })) > 0;
    if (coLopTrucTiep) {
      const { chuaCoEmail } = await this.thongBaoService.guiDangKyHocPhanLop(
        dangKy.id,
      );
      return { hocVienChuaCoEmail: chuaCoEmail };
    }
    return { hocVienChuaCoEmail: false };
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
      loai_lop?: string;
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

    // QĐ10 (mo-rong-nls-an-giang.md, 2026-09-30): cột mới, tùy chọn — mặc
    // định "truc_tiep" nếu để trống (hệ quả bắt buộc từ lop_hoc.loai_lop nay
    // NOT NULL; import này chưa được yêu cầu phân biệt loại lớp trước đó).
    const loaiLopRaw = raw.loai_lop?.trim();
    let loaiLop: loai_lop_hoc = 'truc_tiep';
    if (loaiLopRaw) {
      if (
        loaiLopRaw !== 'truc_tiep' &&
        loaiLopRaw !== 'zoom' &&
        loaiLopRaw !== 'vle'
      ) {
        return {
          error: 'Cột "loai_lop" phải là "truc_tiep", "zoom" hoặc "vle"',
        };
      }
      loaiLop = loaiLopRaw;
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
      const key = `${khoa.id}|${loaiLop}|${tenLop.toLowerCase()}|${giaiDoan.id}|${buoiSo}`;
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
        loai_lop: loaiLop,
        nhom_hoc_vien: nhomHocVien,
        muc_nang_luc: mucNangLuc,
        si_so_toi_da: siSoToiDa,
        giai_doan_id: giaiDoan.id,
        buoi_so: buoiSo,
        thoi_gian_bat_dau: batDau,
        thoi_gian_ket_thuc: ketThuc,
        dia_diem_hoac_link: diaDiemHoacLink,
      },
      canhBao: canhBaoBuoiHocGiaiDoan(
        loaiLop,
        { bat_dau: batDau, ket_thuc: ketThuc },
        giaiDoan,
      ),
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
        khoa_id_loai_lop_ten_lop: {
          khoa_id: dto.khoa_id,
          loai_lop: dto.loai_lop,
          ten_lop: dto.ten_lop,
        },
      },
      create: {
        khoa_id: dto.khoa_id,
        loai_lop: dto.loai_lop,
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
  // Import nhan_su_lop (gọi từ ImportService) — mỗi dòng = 1 nhân sự của 1
  // lớp. Cột file: ma_khoa, ten_lop, loai_lop (BẮT BUỘC — như diem_danh, gắn
  // vào lớp sai loại thì không tự phát hiện được), ho_ten, vai_tro,
  // so_dien_thoai (tùy chọn). Lớp PHẢI đã tồn tại — import này không tạo lớp.
  // dupKeys: phát hiện 2 dòng cùng (lớp, họ tên) trong cùng file.
  // ---------------------------------------------------------------------
  async resolveNhanSuLopRow(
    raw: {
      ma_khoa?: string;
      ten_lop?: string;
      loai_lop?: string;
      ho_ten?: string;
      vai_tro?: string;
      so_dien_thoai?: string;
    },
    dupKeys?: Set<string>,
  ): Promise<RowBuildResult<NhanSuLopRowDto>> {
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

    const loaiLop = raw.loai_lop?.trim();
    if (!loaiLop) {
      return { error: 'Thiếu cột "loai_lop"' };
    }
    if (loaiLop !== 'truc_tiep' && loaiLop !== 'zoom' && loaiLop !== 'vle') {
      return {
        error: 'Cột "loai_lop" phải là "truc_tiep", "zoom" hoặc "vle"',
      };
    }

    const lop = await this.prisma.lop_hoc.findUnique({
      where: {
        khoa_id_loai_lop_ten_lop: {
          khoa_id: khoa.id,
          loai_lop: loaiLop,
          ten_lop: normalizeNfcName(tenLop),
        },
      },
    });
    if (!lop) {
      return {
        error: `Lớp "${tenLop}" (${loaiLop}) không tồn tại trong khóa "${maKhoa}"`,
      };
    }

    const hoTenRaw = raw.ho_ten?.trim();
    if (!hoTenRaw) {
      return { error: 'Thiếu cột "ho_ten"' };
    }
    const hoTen = normalizeNfcName(hoTenRaw);
    if (hoTen.length > 255) {
      return { error: 'Cột "ho_ten" tối đa 255 ký tự' };
    }

    const vaiTro = raw.vai_tro?.trim();
    if (!vaiTro) {
      return { error: 'Thiếu cột "vai_tro"' };
    }
    if (vaiTro !== 'giang_vien' && vaiTro !== 'ho_tro') {
      return { error: 'Cột "vai_tro" phải là "giang_vien" hoặc "ho_tro"' };
    }

    const soDienThoai = raw.so_dien_thoai?.trim() || undefined;
    if (soDienThoai && soDienThoai.length > 20) {
      return { error: 'Cột "so_dien_thoai" tối đa 20 ký tự' };
    }

    if (dupKeys) {
      const key = `${lop.id}|${hoTen.toLowerCase()}`;
      if (dupKeys.has(key)) {
        return {
          error: `Dòng trùng (lớp "${tenLop}", họ tên "${hoTen}") với dòng khác trong cùng file`,
        };
      }
      dupKeys.add(key);
    }

    return {
      dto: {
        lop_id: lop.id,
        ho_ten: hoTen,
        vai_tro: vaiTro,
        so_dien_thoai: soDienThoai,
      },
    };
  }

  // lop_hoc_nhan_su không có UNIQUE nào — khớp theo (lop_id, ho_ten không
  // phân biệt hoa thường) để chạy lại file chỉ CẬP NHẬT, không tạo trùng.
  // so_dien_thoai để trống = giữ nguyên số cũ (undefined trong data Prisma).
  async commitNhanSuLop(dto: NhanSuLopRowDto): Promise<void> {
    const daCo = await this.prisma.lop_hoc_nhan_su.findFirst({
      where: {
        lop_id: dto.lop_id,
        ho_ten: { equals: dto.ho_ten, mode: 'insensitive' },
      },
    });
    if (daCo) {
      await this.prisma.lop_hoc_nhan_su.update({
        where: { id: daCo.id },
        data: { vai_tro: dto.vai_tro, so_dien_thoai: dto.so_dien_thoai },
      });
      return;
    }
    await this.prisma.lop_hoc_nhan_su.create({
      data: {
        lop_id: dto.lop_id,
        ho_ten: dto.ho_ten,
        vai_tro: dto.vai_tro,
        so_dien_thoai: dto.so_dien_thoai,
      },
    });
  }

  // ---------------------------------------------------------------------
  // Import diem_danh (T12, mo-rong-nls-an-giang.md — gọi từ ImportService) —
  // điểm danh nhập qua IMPORT EXCEL, KHÔNG có giao diện chấm tay từng buổi.
  // Mỗi dòng = điểm danh của 1 học viên tại 1 buổi cụ thể (lich_hoc_lop) —
  // xác định buổi qua (khoa_id, loai_lop, ten_lop) -> lớp, rồi (lop_id,
  // giai_doan_id, buoi_so) -> buổi. loai_lop BẮT BUỘC ở import này (khác
  // lop_va_lich_hoc không có mặc định an toàn để suy đoán, vì điểm danh phải
  // khớp ĐÚNG 1 buổi cụ thể).
  //
  // Rule 🟡 (mo-rong-nls-an-giang.md mục T12): học viên điểm danh ở buổi của
  // lớp KHÁC lớp mình đang được gán cho đúng loai_lop đó (học bù) -> cảnh báo
  // không chặn dòng, NHƯNG bắt buộc có ghi_chu — thiếu ghi_chu trong trường
  // hợp này là lỗi 🔴 (chặn dòng), theo đúng tinh thần "bắt buộc ghi_chu" của
  // tài liệu.
  // ---------------------------------------------------------------------
  async resolveDiemDanhRow(
    raw: {
      so_dinh_danh_ca_nhan?: string;
      ma_dinh_danh_moet?: string;
      ma_khoa?: string;
      ten_lop?: string;
      loai_lop?: string;
      giai_doan_thu_tu?: string;
      buoi_so?: string;
      trang_thai?: string;
      nguon?: string;
      ghi_chu?: string;
    },
    dupKeys?: Set<string>,
  ): Promise<RowBuildResult<DiemDanhRowDto>> {
    const resolved = await resolveHocVienImportRow(this.prisma, {
      so_dinh_danh_ca_nhan: raw.so_dinh_danh_ca_nhan,
      ma_dinh_danh_moet: raw.ma_dinh_danh_moet,
    });
    if (resolved.error || !resolved.hocVien) {
      return { error: resolved.error ?? 'Không xác định được học viên' };
    }
    const hocVien = resolved.hocVien;
    const ma =
      raw.so_dinh_danh_ca_nhan?.trim() || raw.ma_dinh_danh_moet?.trim();

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

    const dangKy = await this.prisma.dang_ky_hoc.findUnique({
      where: {
        hoc_vien_id_khoa_id: { hoc_vien_id: hocVien.id, khoa_id: khoa.id },
      },
    });
    if (!dangKy) {
      return {
        error: `Học viên "${ma}" chưa được ghi danh vào khóa "${maKhoa}"`,
      };
    }

    const tenLop = raw.ten_lop?.trim();
    if (!tenLop) {
      return { error: 'Thiếu cột "ten_lop"' };
    }

    const loaiLopRaw = raw.loai_lop?.trim();
    if (
      loaiLopRaw !== 'truc_tiep' &&
      loaiLopRaw !== 'zoom' &&
      loaiLopRaw !== 'vle'
    ) {
      return {
        error: 'Cột "loai_lop" phải là "truc_tiep", "zoom" hoặc "vle"',
      };
    }
    const loaiLop: loai_lop_hoc = loaiLopRaw;

    const lop = await this.prisma.lop_hoc.findUnique({
      where: {
        khoa_id_loai_lop_ten_lop: {
          khoa_id: khoa.id,
          loai_lop: loaiLop,
          ten_lop: tenLop,
        },
      },
    });
    if (!lop) {
      return {
        error: `Lớp "${tenLop}" (loại "${loaiLopRaw}") không tồn tại trong khóa "${maKhoa}"`,
      };
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

    const lichHoc = await this.prisma.lich_hoc_lop.findUnique({
      where: {
        lop_id_giai_doan_id_buoi_so: {
          lop_id: lop.id,
          giai_doan_id: giaiDoan.id,
          buoi_so: buoiSo,
        },
      },
    });
    if (!lichHoc) {
      return {
        error: `Không tìm thấy buổi học (lớp "${tenLop}", giai đoạn thứ tự "${giaiDoanThuTu}", buổi "${buoiSo}")`,
      };
    }

    const trangThaiRaw = raw.trang_thai?.trim();
    if (
      trangThaiRaw !== 'co_mat' &&
      trangThaiRaw !== 'vang' &&
      trangThaiRaw !== 'vang_co_phep'
    ) {
      return {
        error: 'Cột "trang_thai" phải là "co_mat", "vang" hoặc "vang_co_phep"',
      };
    }
    const trangThai: trang_thai_diem_danh = trangThaiRaw;

    const nguonRaw = raw.nguon?.trim();
    if (
      nguonRaw !== 'zoom' &&
      nguonRaw !== 'ky_ten' &&
      nguonRaw !== 'qr' &&
      nguonRaw !== 'thu_cong'
    ) {
      return {
        error: 'Cột "nguon" phải là "zoom", "ky_ten", "qr" hoặc "thu_cong"',
      };
    }
    const nguon: nguon_diem_danh = nguonRaw;

    const ghiChu = raw.ghi_chu?.trim() || undefined;

    // Rule 🟡 (phân lớp theo giai đoạn, spec 2026-10-02 mục 4.6): buổi thuộc
    // lớp KHÁC lớp học viên được gán ở ĐÚNG giai đoạn của buổi này (học bù,
    // kể cả khi học viên CHƯA được gán lớp nào ở giai đoạn đó) -> cảnh báo,
    // bắt buộc ghi_chu (thiếu -> lỗi 🔴).
    const phanLop = await this.prisma.phan_lop_giai_doan.findUnique({
      where: {
        dang_ky_hoc_id_giai_doan_id: {
          dang_ky_hoc_id: dangKy.id,
          giai_doan_id: giaiDoan.id,
        },
      },
    });
    let canhBao: string | undefined;
    if (!phanLop || phanLop.lop_id !== lop.id) {
      if (!ghiChu) {
        return {
          error: `Học viên "${ma}" điểm danh ở buổi của lớp "${tenLop}" khác lớp mình đang được gán (học bù) — bắt buộc nhập ghi_chu`,
        };
      }
      canhBao = `Học viên "${ma}" điểm danh ở buổi của lớp "${tenLop}" khác lớp mình đang được gán (học bù)`;
    }

    if (dupKeys) {
      const key = `${dangKy.id}|${lichHoc.id}`;
      if (dupKeys.has(key)) {
        return {
          error: `Dòng trùng (học viên "${ma}", lớp "${tenLop}", buổi "${buoiSo}") với dòng khác trong cùng file`,
        };
      }
      dupKeys.add(key);
    }

    return {
      dto: {
        dang_ky_hoc_id: dangKy.id,
        lich_hoc_id: lichHoc.id,
        trang_thai: trangThai,
        nguon,
        ghi_chu: ghiChu,
      },
      canhBao,
    };
  }

  // Không cần checkValid riêng: resolveDiemDanhRow() (buildDto) đã tra cứu/
  // validate toàn bộ FK + quy tắc học bù rồi.
  //
  // Upsert theo (dang_ky_hoc_id, lich_hoc_id) — chạy lại file ghi đè (nghiệm
  // thu T12), không cộng dồn.
  async commitDiemDanh(dto: DiemDanhRowDto, importId: string): Promise<void> {
    await this.prisma.diem_danh.upsert({
      where: {
        dang_ky_hoc_id_lich_hoc_id: {
          dang_ky_hoc_id: dto.dang_ky_hoc_id,
          lich_hoc_id: dto.lich_hoc_id,
        },
      },
      create: {
        dang_ky_hoc_id: dto.dang_ky_hoc_id,
        lich_hoc_id: dto.lich_hoc_id,
        trang_thai: dto.trang_thai,
        nguon: dto.nguon,
        ghi_chu: dto.ghi_chu,
        nguon_import_id: importId,
      },
      update: {
        trang_thai: dto.trang_thai,
        nguon: dto.nguon,
        ghi_chu: dto.ghi_chu,
        nguon_import_id: importId,
        cap_nhat_luc: new Date(),
      },
    });
  }

  // ---------------------------------------------------------------------
  // Import ket_qua_giai_doan (T12, mo-rong-nls-an-giang.md — gọi từ
  // ImportService) — tiến độ/kết quả theo từng giai đoạn của khóa (vd tiến
  // độ VLE, điểm đánh giá giai đoạn). dang_ky_hoc PHẢI đã tồn tại (học viên
  // đã được ghi danh, T3) — cùng quy tắc như resolveKetQuaDanhGiaRow.
  // ---------------------------------------------------------------------
  async resolveKetQuaGiaiDoanRow(raw: {
    so_dinh_danh_ca_nhan?: string;
    ma_dinh_danh_moet?: string;
    ma_khoa?: string;
    giai_doan_thu_tu?: string;
    ty_le_hoan_thanh?: string;
    diem?: string;
  }): Promise<RowBuildResult<KetQuaGiaiDoanRowDto>> {
    const resolved = await resolveHocVienImportRow(this.prisma, {
      so_dinh_danh_ca_nhan: raw.so_dinh_danh_ca_nhan,
      ma_dinh_danh_moet: raw.ma_dinh_danh_moet,
    });
    if (resolved.error || !resolved.hocVien) {
      return { error: resolved.error ?? 'Không xác định được học viên' };
    }
    const hocVien = resolved.hocVien;
    const ma =
      raw.so_dinh_danh_ca_nhan?.trim() || raw.ma_dinh_danh_moet?.trim();

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

    const dangKy = await this.prisma.dang_ky_hoc.findUnique({
      where: {
        hoc_vien_id_khoa_id: { hoc_vien_id: hocVien.id, khoa_id: khoa.id },
      },
    });
    if (!dangKy) {
      return {
        error: `Học viên "${ma}" chưa được ghi danh vào khóa "${maKhoa}" — phải chạy ghi danh (import phan_lop_hoc_vien, T3) trước`,
      };
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

    let tyLeHoanThanh: number | undefined;
    if (raw.ty_le_hoan_thanh?.trim()) {
      tyLeHoanThanh = Number(raw.ty_le_hoan_thanh.trim());
      if (
        !Number.isFinite(tyLeHoanThanh) ||
        tyLeHoanThanh < 0 ||
        tyLeHoanThanh > 100
      ) {
        return { error: 'Cột "ty_le_hoan_thanh" phải là số từ 0 đến 100' };
      }
    }

    let diem: number | undefined;
    if (raw.diem?.trim()) {
      diem = Number(raw.diem.trim());
      if (!Number.isFinite(diem)) {
        return { error: 'Cột "diem" phải là số' };
      }
    }

    return {
      dto: {
        dang_ky_hoc_id: dangKy.id,
        giai_doan_id: giaiDoan.id,
        ty_le_hoan_thanh: tyLeHoanThanh,
        diem,
      },
    };
  }

  // Không cần checkValid riêng: resolveKetQuaGiaiDoanRow() (buildDto) đã tra
  // cứu/validate toàn bộ FK + phạm vi giá trị rồi.
  //
  // Upsert theo (dang_ky_hoc_id, giai_doan_id) — chạy lại file ghi đè (nghiệm
  // thu T12).
  async commitKetQuaGiaiDoan(
    dto: KetQuaGiaiDoanRowDto,
    importId: string,
  ): Promise<void> {
    await this.prisma.ket_qua_giai_doan.upsert({
      where: {
        dang_ky_hoc_id_giai_doan_id: {
          dang_ky_hoc_id: dto.dang_ky_hoc_id,
          giai_doan_id: dto.giai_doan_id,
        },
      },
      create: {
        dang_ky_hoc_id: dto.dang_ky_hoc_id,
        giai_doan_id: dto.giai_doan_id,
        ty_le_hoan_thanh: dto.ty_le_hoan_thanh,
        diem: dto.diem,
        nguon_import_id: importId,
      },
      update: {
        ty_le_hoan_thanh: dto.ty_le_hoan_thanh,
        diem: dto.diem,
        nguon_import_id: importId,
        cap_nhat_luc: new Date(),
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
