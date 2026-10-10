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
import { NhatKyService } from '../nhat-ky/nhat-ky.service';
import { DiemHocService, DIEM_HOC_TOM_TAT } from '../diem-hoc/diem-hoc.service';
import { LichHocThayDoiService } from './lich-hoc-thay-doi.service';
import { PhanCongGiangDayService } from '../giang-vien/phan-cong-giang-day.service';
import { DonViScope, ScopeService } from '../auth/scope/scope.service';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { ThongBaoService } from '../thong-bao/thong-bao.service';
import { normalizeNfcName } from '../common/utils/normalize-text.util';
import { paginate } from '../common/dto/pagination-query.dto';
import {
  ConflictAppException,
  DieuChinhMucDongException,
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
  canhBaoChongCuaSoDiemDanh,
  demBuoiZoomThieuLink,
} from './util/canh-bao-buoi-hoc.util';
import { DiemDanhRowDto } from './dto/diem-danh-row.dto';
import { KetQuaGiaiDoanRowDto } from './dto/ket-qua-giai-doan-row.dto';
import { RowBuildResult } from '../import/import.types';
import { resolveHocVienImportRow } from '../import/util/hoc-vien-resolver.util';
import { parseVnDateTime } from '../common/utils/vn-datetime.util';
import {
  LOAI_BAI_DAU_VAO,
  duocChonMuc,
  mucDanhGiaLamMoc,
  mucHocHieuLuc,
} from './util/muc-hoc.util';
import { ThangMucService, nhanMucGoc } from '../sso/thang-muc.service';
import {
  apDungDiemDanhZoom,
  diemDanhZoomCuaBuoi,
  giauLinkZoomCuaKhoa,
} from './util/diem-danh-zoom.util';
import { khoaBuoi, tinhChuyenCan } from '../common/utils/chuyen-can.util';
import {
  DongChiaLop,
  buildDanhSachChiaLopWorkbook,
} from './util/danh-sach-chia-lop-excel.util';

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
const NHAN_MUC: Record<string, string> = {
  co_ban: 'Cơ bản',
  thanh_thao: 'Thành thạo',
  nang_cao: 'Nâng cao',
};
const NHAN_KET_QUA_HOC: Record<string, string> = {
  dang_hoc: 'Đang học',
  dat: 'Đạt',
  khong_dat: 'Không đạt',
  vang: 'Vắng',
};
const nhanMuc = (m: string | null) => (m && NHAN_MUC[m]) || '(chưa có)';
const nhanKetQuaHoc = (k: string | null) =>
  (k && NHAN_KET_QUA_HOC[k]) || '(chưa có)';

@Injectable()
export class KhoaBoiDuongService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scopeService: ScopeService,
    private readonly thongBaoService: ThongBaoService,
    private readonly nhatKy: NhatKyService,
    private readonly diemHocService: DiemHocService,
    private readonly lichHocThayDoi: LichHocThayDoiService,
    private readonly phanCongGiangDay: PhanCongGiangDayService,
    private readonly thangMuc: ThangMucService,
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

  // Dùng cho route con của buổi (phân công giảng viên) — 404 nếu buổi
  // không thuộc lớp.
  async layLichHocTrongLop(lopId: string, lichHocId: string) {
    await this.getLopOrThrow(lopId);
    return this.getLichHocTrongLopOrThrow(lopId, lichHocId);
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

  // Rule 🔴 T10 (issue #2): buổi thuộc giai đoạn hinh_thuc='truc_tiep' phải
  // có điểm học.
  private assertDiemHocChoGiaiDoan(
    giaiDoan: { hinh_thuc: string },
    diemHocId: string | null,
  ) {
    if (giaiDoan.hinh_thuc === 'truc_tiep' && !diemHocId) {
      throw new ValidationException(
        'Buổi học thuộc giai đoạn trực tiếp phải có điểm học',
        [{ field: 'diem_hoc_id', message: 'Bắt buộc với giai đoạn trực tiếp' }],
      );
    }
  }

  // Rule 🟡 T10: cảnh báo vượt số phòng của điểm học — không chặn.
  private canhBaoSoPhong(lich: {
    diem_hoc_id: string | null;
    lop_id: string;
    thoi_gian_bat_dau: Date;
    thoi_gian_ket_thuc: Date;
  }): Promise<string[]> {
    if (!lich.diem_hoc_id) return Promise.resolve([]);
    return this.diemHocService.canhBaoVuotSoPhong({
      diem_hoc_id: lich.diem_hoc_id,
      lop_id: lich.lop_id,
      bat_dau: lich.thoi_gian_bat_dau,
      ket_thuc: lich.thoi_gian_ket_thuc,
    });
  }

  // ADR 0005 §9 (issue #28): lớp Zoom — cửa sổ điểm danh chồng buổi khác
  // cùng lớp -> cảnh báo, không chặn. Tính theo cấu hình khóa kể cả khi khóa
  // chưa bật (Quản trị chuẩn bị lịch trước).
  private async canhBaoChongCuaSo(
    lop: {
      id: string;
      loai_lop: loai_lop_hoc;
      khoa: {
        diem_danh_mo_truoc_phut: number;
        diem_danh_dong_sau_phut: number;
      };
    },
    buoi: { giai_doan_id: string; buoi_so: number; thoi_gian_bat_dau: Date },
  ): Promise<string[]> {
    if (lop.loai_lop !== 'zoom') return [];
    const khac = await this.prisma.lich_hoc_lop.findMany({
      where: {
        lop_id: lop.id,
        NOT: { giai_doan_id: buoi.giai_doan_id, buoi_so: buoi.buoi_so },
      },
      select: { buoi_so: true, thoi_gian_bat_dau: true },
    });
    return canhBaoChongCuaSoDiemDanh(buoi.thoi_gian_bat_dau, khac, lop.khoa);
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
          mo_dieu_chinh_muc: dto.mo_dieu_chinh_muc,
          bat_diem_danh_zoom_luc: this.mocBatDiemDanhZoom(
            dto.bat_diem_danh_zoom,
            khoa.bat_diem_danh_zoom_luc,
          ),
          diem_danh_mo_truoc_phut: dto.diem_danh_mo_truoc_phut,
          diem_danh_dong_sau_phut: dto.diem_danh_dong_sau_phut,
          che_do_chuyen_can: dto.che_do_chuyen_can,
        },
      });
    } catch (e) {
      throw this.mapUniqueViolation(e, 'Mã khóa đã tồn tại');
    }
  }

  // ADR 0005 Z6: chỉ chốt vắng buổi bắt đầu sau mốc bật — gửi bật khi đang
  // bật phải giữ mốc cũ, nếu không các buổi đã qua sẽ thoát khỏi diện chốt.
  private mocBatDiemDanhZoom(
    bat: boolean | undefined,
    mocHienTai: Date | null,
  ): Date | null | undefined {
    if (bat === undefined) return undefined;
    if (!bat) return null;
    return mocHienTai ?? new Date();
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
    if (dangKy.ket_qua !== updated.ket_qua) {
      await this.nhatKy.ghi({
        hanh_dong: 'cap_nhat_ket_qua_hoc',
        hoc_vien_id: dangKy.hoc_vien_id,
        mo_ta: `${dangKy.khoa.ten_khoa}: ${nhanKetQuaHoc(dangKy.ket_qua)} → ${nhanKetQuaHoc(updated.ket_qua)}`,
      });
    }
    await this.thongBaoService.guiDangKyHocKetQua(id);
    return updated;
  }

  // ---------------------------------------------------------------------
  // GET /khoa-boi-duong, GET /khoa-boi-duong/{id}
  // ---------------------------------------------------------------------
  async findAll(query: QueryKhoaBoiDuongDto, caller: AuthenticatedUser) {
    const page = query.page ?? 1;
    const pageSize = query.page_size ?? 20;
    // AND riêng từng điều kiện (thay vì gộp field trực tiếp vào where) để
    // điều kiện "q" (tìm theo tên/mã) không thể vô tình ĐÈ/mở rộng điều
    // kiện phạm vi xem (id ∈ getKhoaIdsXemDuoc) — cả hai đều dùng OR nội bộ
    // nên gộp field sẽ mất 1 trong 2 OR.
    const and: Prisma.khoa_boi_duongWhereInput[] = [];

    if (caller.vai_tro === 'hoc_vien') {
      // Học viên chỉ xem khóa đã duyệt, không giới hạn theo đơn vị đặt hàng
      // (api-contract.md mục 3: "Học viên (chỉ khóa đã da_duyet)").
      and.push({ trang_thai: 'da_duyet' });
    } else {
      // Spec mục 5 (R1 ∪ R2): id ∈ getKhoaIdsXemDuoc. don_vi_dat_hang_id là
      // BỘ LỌC THUẦN giao với tập xem được — không còn 403 khi ngoài scope.
      const khoaIdsXemDuoc = await this.scopeService.getKhoaIdsXemDuoc(caller);
      if (khoaIdsXemDuoc !== 'ALL') {
        and.push({ id: { in: khoaIdsXemDuoc } });
      }
      if (query.don_vi_dat_hang_id) {
        and.push({ don_vi_dat_hang_id: query.don_vi_dat_hang_id });
      }
      if (query.trang_thai) and.push({ trang_thai: query.trang_thai });
    }

    if (query.q) {
      and.push({
        OR: [
          { ten_khoa: { contains: query.q, mode: 'insensitive' } },
          { ma_khoa: { contains: query.q, mode: 'insensitive' } },
        ],
      });
    }

    const where: Prisma.khoa_boi_duongWhereInput =
      and.length > 0 ? { AND: and } : {};

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
            lich_hoc: {
              include: {
                giai_doan: true,
                diem_hoc: { select: DIEM_HOC_TOM_TAT },
                // T11: không kèm SĐT/email giảng viên (khóa xem được bởi Sở/Phòng/Trường).
                phan_cong: {
                  select: {
                    id: true,
                    vai_tro: true,
                    so_gio: true,
                    da_xac_nhan_gio: true,
                    giang_vien: { select: { id: true, ho_ten: true } },
                  },
                  orderBy: { created_at: 'asc' },
                },
              },
            },
          },
        },
        // QĐ10 (mo-rong-nls-an-giang.md, 2026-09-30): trả kèm danh sách cụm
        // học viên của khóa bên cạnh giai đoạn/lớp đã có.
        cum_hoc_vien: {
          orderBy: { ten_cum: 'asc' },
          include: {
            phan_cong_ho_tro: {
              select: { nguoi_dung: { select: { id: true, ho_ten: true } } },
              orderBy: { created_at: 'asc' },
            },
          },
        },
      },
    });
    if (!khoa) throw new NotFoundAppException('Không tìm thấy khóa bồi dưỡng');

    // pham_vi_hoc_vien ('toan_bo' | 'don_vi'): học viên luôn xem khóa đã
    // duyệt với phạm vi "toàn bộ" (giữ hành vi hiện có — họ chỉ xem thông
    // tin công khai của khóa, không có khái niệm "phạm vi học viên" riêng).
    // Vai trò khác: R1/R2 (spec mục 5) qua getHocVienScopeTrongKhoa.
    let hocVienScope: DonViScope;
    if (caller.vai_tro === 'hoc_vien') {
      if (khoa.trang_thai !== 'da_duyet') {
        throw new ForbiddenAppException(
          'Khóa này chưa được duyệt, chưa thể xem',
        );
      }
      hocVienScope = 'ALL';
    } else {
      const khoaIdsXemDuoc = await this.scopeService.getKhoaIdsXemDuoc(caller);
      if (khoaIdsXemDuoc !== 'ALL' && !khoaIdsXemDuoc.includes(khoa.id)) {
        throw new ForbiddenAppException(
          'Khóa này nằm ngoài phạm vi quyền của tài khoản hiện tại',
        );
      }
      hocVienScope = await this.scopeService.getHocVienScopeTrongKhoa(
        caller,
        khoa,
      );
    }
    const phamViHocVien: 'toan_bo' | 'don_vi' =
      hocVienScope === 'ALL' ? 'toan_bo' : 'don_vi';

    // Sĩ số hiện tại = số đăng ký khác nhau đang được gán vào lớp ở bất kỳ
    // giai đoạn nào (1 học viên học cùng lớp ở 2 giai đoạn chỉ tính 1), chỉ
    // tính học viên thuộc hocVienScope (R2: caller chỉ đếm đơn vị của mình).
    const capLopDangKy = await this.prisma.phan_lop_giai_doan.groupBy({
      by: ['lop_id', 'dang_ky_hoc_id'],
      where: {
        lop: { khoa_id: id },
        ...(hocVienScope === 'ALL'
          ? {}
          : {
              dang_ky_hoc: {
                hoc_vien: { don_vi_cong_tac_id: { in: hocVienScope } },
              },
            }),
      },
    });
    const siSoTheoLop = new Map<string, number>();
    for (const r of capLopDangKy) {
      siSoTheoLop.set(r.lop_id, (siSoTheoLop.get(r.lop_id) ?? 0) + 1);
    }
    return {
      ...khoa,
      pham_vi_hoc_vien: phamViHocVien,
      // ADR 0003 H4/H14: người hỗ trợ của cụm chỉ Quản trị thấy (học viên
      // không thấy họ tên cán bộ).
      cum_hoc_vien: khoa.cum_hoc_vien.map(({ phan_cong_ho_tro, ...cum }) =>
        caller.vai_tro === 'quan_tri'
          ? { ...cum, nguoi_ho_tro: phan_cong_ho_tro.map((p) => p.nguoi_dung) }
          : cum,
      ),
      // ADR 0005 Z4: học viên không nhận link buổi/giai đoạn Zoom khi khóa bật.
      ...(caller.vai_tro === 'hoc_vien' ? giauLinkZoomCuaKhoa(khoa) : {}),
      lop_hoc: khoa.lop_hoc.map((l) => ({
        ...(caller.vai_tro === 'hoc_vien' && apDungDiemDanhZoom(l, khoa)
          ? {
              ...l,
              lich_hoc: l.lich_hoc.map((b) => ({
                ...b,
                dia_diem_hoac_link: null,
              })),
            }
          : l),
        si_so_hien_tai: siSoTheoLop.get(l.id) ?? 0,
      })),
      // ADR 0004 G3: nhóm hỗ trợ giảng viên — chỉ Quản trị thấy.
      ...(caller.vai_tro === 'quan_tri'
        ? { nhom_ho_tro_gv: await this.nhomHoTroGv(khoa.id) }
        : {}),
      // ADR 0005 §9 (issue #28): cảnh báo vận hành — chỉ Quản trị.
      ...(caller.vai_tro === 'quan_tri'
        ? {
            so_buoi_zoom_thieu_link: demBuoiZoomThieuLink(
              khoa.lop_hoc,
              new Date(),
            ),
          }
        : {}),
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
  // PUT /khoa-boi-duong/{id}/cum/{cumId}/nguoi-ho-tro — ADR 0003 H3/H4: thay
  // TOÀN BỘ người hỗ trợ của cụm (rỗng = gỡ hết). Chỉ nhận ho_tro_hoc_vien.
  // ---------------------------------------------------------------------
  // PUT /khoa-boi-duong/{id}/nhom-ho-tro-gv — ADR 0004 G3: thay TOÀN BỘ
  // nhóm người hỗ trợ giảng viên của khóa (rỗng = gỡ hết). Chỉ nhận tài
  // khoản ho_tro_giang_vien đang hoạt động.
  async ganNhomHoTroGv(khoaId: string, nguoiDungIds: string[]) {
    const khoa = await this.prisma.khoa_boi_duong.findUnique({
      where: { id: khoaId },
      select: { id: true },
    });
    if (!khoa) throw new NotFoundAppException('Không tìm thấy khóa bồi dưỡng');
    const ids = [...new Set(nguoiDungIds)];
    const hopLe = await this.prisma.nguoi_dung.count({
      where: {
        id: { in: ids },
        vai_tro: 'ho_tro_giang_vien',
        trang_thai: 'active',
      },
    });
    if (hopLe !== ids.length) {
      throw new ValidationException(
        'Chỉ phân công được tài khoản người hỗ trợ giảng viên đang hoạt động',
        [
          {
            field: 'nguoi_dung_ids',
            message: 'Có tài khoản không phải người hỗ trợ giảng viên',
          },
        ],
      );
    }
    await this.prisma.$transaction([
      this.prisma.phan_cong_ho_tro_gv.deleteMany({
        where: { khoa_id: khoaId, nguoi_dung_id: { notIn: ids } },
      }),
      this.prisma.phan_cong_ho_tro_gv.createMany({
        data: ids.map((nguoi_dung_id) => ({ nguoi_dung_id, khoa_id: khoaId })),
        skipDuplicates: true,
      }),
    ]);
    return { khoa_id: khoaId, nhom_ho_tro_gv: await this.nhomHoTroGv(khoaId) };
  }

  private async nhomHoTroGv(khoaId: string) {
    const rows = await this.prisma.phan_cong_ho_tro_gv.findMany({
      where: { khoa_id: khoaId },
      select: { nguoi_dung: { select: { id: true, ho_ten: true } } },
      orderBy: { created_at: 'asc' },
    });
    return rows.map((r) => r.nguoi_dung);
  }

  async ganNguoiHoTroCum(
    khoaId: string,
    cumId: string,
    nguoiDungIds: string[],
  ) {
    await this.getCumTrongKhoaOrThrow(khoaId, cumId);
    const ids = [...new Set(nguoiDungIds)];
    const hopLe = await this.prisma.nguoi_dung.count({
      where: { id: { in: ids }, vai_tro: 'ho_tro_hoc_vien' },
    });
    if (hopLe !== ids.length) {
      throw new ValidationException(
        'Chỉ phân công được tài khoản người hỗ trợ học viên',
        [
          {
            field: 'nguoi_dung_ids',
            message: 'Có tài khoản không phải người hỗ trợ học viên',
          },
        ],
      );
    }
    await this.prisma.$transaction([
      this.prisma.phan_cong_ho_tro.deleteMany({
        where: { cum_id: cumId, nguoi_dung_id: { notIn: ids } },
      }),
      this.prisma.phan_cong_ho_tro.createMany({
        data: ids.map((nguoi_dung_id) => ({ nguoi_dung_id, cum_id: cumId })),
        skipDuplicates: true,
      }),
    ]);
    const rows = await this.prisma.phan_cong_ho_tro.findMany({
      where: { cum_id: cumId },
      select: { nguoi_dung: { select: { id: true, ho_ten: true } } },
      orderBy: { created_at: 'asc' },
    });
    return { cum_id: cumId, nguoi_ho_tro: rows.map((r) => r.nguoi_dung) };
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
    this.assertDiemHocChoGiaiDoan(giaiDoan, dto.diem_hoc_id ?? null);
    if (dto.diem_hoc_id) {
      await this.diemHocService.layDiemHocDangHoatDong(dto.diem_hoc_id);
    }

    try {
      const lich = await this.prisma.lich_hoc_lop.create({
        data: {
          lop_id: lopId,
          giai_doan_id: dto.giai_doan_id,
          buoi_so: dto.buoi_so ?? 1,
          thoi_gian_bat_dau: new Date(dto.thoi_gian_bat_dau),
          thoi_gian_ket_thuc: new Date(dto.thoi_gian_ket_thuc),
          dia_diem_hoac_link: dto.dia_diem_hoac_link,
          diem_hoc_id: dto.diem_hoc_id,
          phong: dto.phong?.trim() || undefined,
        },
      });
      return {
        ...lich,
        canh_bao: [
          ...(await this.canhBaoSoPhong(lich)),
          ...(await this.canhBaoChongCuaSo(lop, lich)),
        ],
      };
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
    const { ly_do, ...thayDoi } = dto;
    this.assertCoTruongSua(thayDoi);

    if (dto.thoi_gian_bat_dau || dto.thoi_gian_ket_thuc) {
      const batDau =
        dto.thoi_gian_bat_dau ?? lich.thoi_gian_bat_dau.toISOString();
      const ketThuc =
        dto.thoi_gian_ket_thuc ?? lich.thoi_gian_ket_thuc.toISOString();
      this.assertThoiGianHopLe(batDau, ketThuc, 'lịch học', false);
      // T11: giờ mới không được làm giảng viên của buổi trùng giờ buổi khác.
      const xungDot = await this.phanCongGiangDay.xungDotKhiDoiGio(lich.id, {
        thoi_gian_bat_dau: new Date(batDau),
        thoi_gian_ket_thuc: new Date(ketThuc),
      });
      if (xungDot) {
        throw new ValidationException(xungDot, [
          { field: 'thoi_gian_bat_dau', message: 'Giảng viên bị trùng giờ' },
        ]);
      }
    }
    // T10: buổi giai đoạn truc_tiep phải có điểm học sau khi sửa. Ngoại lệ:
    // PATCH chỉ đổi trang_thai (vận hành) trên buổi cũ chưa có điểm học.
    const chiDoiTrangThai = Object.entries(thayDoi).every(
      ([k, v]) => k === 'trang_thai' || v === undefined,
    );
    if (!chiDoiTrangThai) {
      const giaiDoan = await this.prisma.giai_doan_khoa.findUniqueOrThrow({
        where: { id: lich.giai_doan_id },
      });
      const diemHocSau =
        dto.diem_hoc_id !== undefined ? dto.diem_hoc_id : lich.diem_hoc_id;
      this.assertDiemHocChoGiaiDoan(giaiDoan, diemHocSau);
    }
    if (dto.diem_hoc_id && dto.diem_hoc_id !== lich.diem_hoc_id) {
      await this.diemHocService.layDiemHocDangHoatDong(dto.diem_hoc_id);
    }

    try {
      const capNhat = await this.lichHocThayDoi.capNhat(
        lich,
        {
          thoi_gian_bat_dau: dto.thoi_gian_bat_dau
            ? new Date(dto.thoi_gian_bat_dau)
            : undefined,
          thoi_gian_ket_thuc: dto.thoi_gian_ket_thuc
            ? new Date(dto.thoi_gian_ket_thuc)
            : undefined,
          dia_diem_hoac_link: dto.dia_diem_hoac_link,
          diem_hoc_id: dto.diem_hoc_id,
          phong:
            dto.phong === undefined ? undefined : dto.phong?.trim() || null,
          buoi_so: dto.buoi_so,
          trang_thai: dto.trang_thai,
        },
        { ly_do: ly_do?.trim(), nguon: 'sua_tay' },
      );
      return {
        ...capNhat,
        canh_bao: [
          ...(await this.canhBaoSoPhong(capNhat)),
          ...(await this.canhBaoChongCuaSo(lop, capNhat)),
        ],
      };
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
  // Dùng chung cho GET /hoc-vien/toi/khoa-hoc, GET /hoc-vien/{id}/khoa-hoc VÀ
  // chi tiết học viên của người hỗ trợ (ADR 0003 — nơi gọi tự kiểm phạm vi).
  // giauLinkZoom (chỉ GET /hoc-vien/toi/khoa-hoc — ADR 0005 Z4): buổi lớp Zoom
  // của khóa đã bật điểm danh -> không trả link, thay bằng diem_danh_zoom.
  async khoaHocTheoHocVienId(
    hocVienId: string,
    { giauLinkZoom = false }: { giauLinkZoom?: boolean } = {},
  ) {
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
                  include: {
                    giai_doan: true,
                    diem_hoc: { select: DIEM_HOC_TOM_TAT },
                    // T11: học viên chỉ thấy họ tên + vai trò giảng viên.
                    phan_cong: {
                      select: {
                        vai_tro: true,
                        giang_vien: { select: { ho_ten: true } },
                      },
                      orderBy: { created_at: 'asc' },
                    },
                  },
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
    // Mốc điều chỉnh mức khi quản trị chưa chốt muc_dau_vao (2026-10-09) —
    // bài khảo sát gắn theo học viên nên chỉ tra 1 lần cho mọi đăng ký.
    const baiDauVao = dangKyList.some((dk) => !dk.muc_dau_vao)
      ? await this.baiDauVaoCuaHocVien(hocVienId)
      : null;
    // Mức quy đổi chỉ để XẾP LỚP; học viên vẫn xem kết quả theo mã/nhãn thang khảo sát.
    const mucGocDanhGia = baiDauVao?.muc_goc ?? null;
    const nhanMucGocDanhGia = mucGocDanhGia
      ? nhanMucGoc(mucGocDanhGia, await this.thangMuc.thang())
      : null;
    const [diemDanhList, ketQuaGiaiDoanList] = dangKyIds.length
      ? await Promise.all([
          this.prisma.diem_danh.findMany({
            where: { dang_ky_hoc_id: { in: dangKyIds } },
            select: {
              dang_ky_hoc_id: true,
              lich_hoc_id: true,
              trang_thai: true,
              tu_diem_danh_luc: true,
              lich_hoc: {
                select: {
                  lop_id: true,
                  giai_doan_id: true,
                  buoi_so: true,
                  lop: { select: { ten_lop: true, loai_lop: true } },
                },
              },
            },
          }),
          this.prisma.ket_qua_giai_doan.findMany({
            where: { dang_ky_hoc_id: { in: dangKyIds } },
          }),
        ])
      : [[], []];

    const diemDanhMap = new Map(
      diemDanhList.map((d) => [`${d.dang_ky_hoc_id}|${d.lich_hoc_id}`, d]),
    );
    const tenLopDiemDanh = new Map(
      diemDanhList.map((d) => [d.lich_hoc.lop_id, d.lich_hoc.lop.ten_lop]),
    );
    const now = new Date();
    // ADR 0004 G4 (issue #16): người hỗ trợ thực địa của các đợt học viên được
    // phân lớp (lớp × giai đoạn) — học viên thấy họ tên + SĐT.
    const capDot = dangKyList.flatMap((dk) =>
      dk.phan_lop_giai_doan.map((p) => ({
        lop_id: p.lop.id,
        giai_doan_id: p.giai_doan_id,
      })),
    );
    const dsThucDia = capDot.length
      ? await this.prisma.nhan_su_thuc_dia.findMany({
          where: { OR: capDot },
          select: {
            lop_id: true,
            giai_doan_id: true,
            ho_ten: true,
            so_dien_thoai: true,
            nhiem_vu: true,
          },
          orderBy: { created_at: 'asc' },
        })
      : [];

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
      const mocDanhGia = mucDanhGiaLamMoc(dk.muc_dau_vao, baiDauVao);
      // ADR 0005 Z8 (issue #27): buổi chưa có dòng ở lớp hiện tại nhưng đã có
      // ở lớp cũ cùng giai đoạn, cùng buoi_so — chỉ để hiển thị, mọi chế độ.
      const chuyenCanLopCu = tinhChuyenCan(
        new Map(phan_lop_giai_doan.map((p) => [p.giai_doan_id, p.lop_id])),
        diemDanhList
          .filter((d) => d.dang_ky_hoc_id === dk.id)
          .map((d) => ({
            lop_id: d.lich_hoc.lop_id,
            loai_lop: d.lich_hoc.lop.loai_lop,
            giai_doan_id: d.lich_hoc.giai_doan_id,
            buoi_so: d.lich_hoc.buoi_so,
            trang_thai: d.trang_thai,
          })),
        'cong_nhan_lop_cu',
      );
      return {
        ...rest,
        muc_danh_gia: mocDanhGia.muc,
        nguon_muc_danh_gia: mocDanhGia.nguon,
        muc_goc_danh_gia:
          mocDanhGia.nguon === 'khao_sat' ? mucGocDanhGia : null,
        nhan_muc_goc_danh_gia:
          mocDanhGia.nguon === 'khao_sat' ? nhanMucGocDanhGia : null,
        khoa: khoaGon,
        giai_doan: dsGiaiDoan.map((gd) => {
          const lop = phan_lop_giai_doan.find(
            (p) => p.giai_doan_id === gd.id,
          )?.lop;
          const giauLink =
            giauLinkZoom && !!lop && apDungDiemDanhZoom(lop, khoa);
          const lichHocGd = lop
            ? lop.lich_hoc.filter((b) => b.giai_doan_id === gd.id)
            : [];
          return {
            id: gd.id,
            thu_tu: gd.thu_tu,
            ten_giai_doan: gd.ten_giai_doan,
            hinh_thuc: gd.hinh_thuc,
            thoi_gian_bat_dau: gd.thoi_gian_bat_dau,
            thoi_gian_ket_thuc: gd.thoi_gian_ket_thuc,
            link_hoac_dia_diem:
              giauLink && lichHocGd.length > 0 ? null : gd.link_hoac_dia_diem,
            huong_dan: gd.huong_dan,
            lop: lop
              ? {
                  ...lop,
                  lich_hoc: lichHocGd.map(({ phan_cong, ...b }) => {
                    const dd = diemDanhMap.get(`${dk.id}|${b.id}`) ?? null;
                    const lopCu = dd
                      ? undefined
                      : chuyenCanLopCu.get(khoaBuoi(gd.id, b.buoi_so));
                    return {
                      ...b,
                      giang_vien: phan_cong.map((p) => ({
                        ho_ten: p.giang_vien.ho_ten,
                        vai_tro: p.vai_tro,
                      })),
                      trang_thai_diem_danh: dd?.trang_thai ?? null,
                      ...(lopCu?.tu_lop_cu
                        ? {
                            diem_danh_lop_cu: {
                              trang_thai: lopCu.trang_thai,
                              ten_lop: tenLopDiemDanh.get(lopCu.lop_id) ?? '',
                            },
                          }
                        : {}),
                      ...(giauLink
                        ? {
                            dia_diem_hoac_link: null,
                            diem_danh_zoom: diemDanhZoomCuaBuoi(
                              b,
                              khoa,
                              dd,
                              now,
                            ),
                          }
                        : {}),
                    };
                  }),
                }
              : null,
            tien_do: tienDoMap.get(`${dk.id}|${gd.id}`) ?? null,
            thuc_dia: lop
              ? dsThucDia
                  .filter(
                    (t) => t.lop_id === lop.id && t.giai_doan_id === gd.id,
                  )
                  .map(({ ho_ten, so_dien_thoai, nhiem_vu }) => ({
                    ho_ten,
                    so_dien_thoai,
                    nhiem_vu,
                  }))
              : [],
          };
        }),
      };
    });
  }

  async khoaHocCuaToi(caller: AuthenticatedUser) {
    const hocVienId = this.assertHocVienId(caller);
    return this.khoaHocTheoHocVienId(hocVienId, { giauLinkZoom: true });
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

    const cu = await this.prisma.phan_lop_giai_doan.findUnique({
      where: {
        dang_ky_hoc_id_giai_doan_id: {
          dang_ky_hoc_id: dangKyHocId,
          giai_doan_id: giaiDoanId,
        },
      },
      include: { lop: { select: { ten_lop: true } } },
    });

    if (lopId === null) {
      await this.prisma.phan_lop_giai_doan.deleteMany({
        where: { dang_ky_hoc_id: dangKyHocId, giai_doan_id: giaiDoanId },
      });
      if (cu) {
        await this.ghiPhanLop(
          dangKy,
          giaiDoan,
          cu.lop.ten_lop,
          null,
          'thu_cong',
        );
      }
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
    if (cu?.lop_id !== lopId) {
      await this.ghiPhanLop(
        dangKy,
        giaiDoan,
        cu?.lop.ten_lop ?? null,
        lop.ten_lop,
        'thu_cong',
      );
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
    const updated = await this.prisma.dang_ky_hoc.update({
      where: { id },
      data: { cum_id: cumId },
    });
    await this.ghiDoiCum(dangKy, dangKy.cum_id, cumId);
    return updated;
  }

  // ---------------------------------------------------------------------
  // Điều chỉnh mức lớp học (2026-10-08): học viên tự chọn khi khóa mở công
  // tắc (PUT /hoc-vien/toi/khoa-hoc/{khoaId}/muc-hoc); Quản trị sửa hộ bỏ qua
  // công tắc (PATCH /dang-ky-hoc/{id}/muc-hoc). Cả 2 vẫn áp quy tắc ≤ mức
  // đánh giá. Chọn bằng mức đánh giá -> lưu NULL.
  // ---------------------------------------------------------------------
  async chonMucHoc(
    caller: AuthenticatedUser,
    khoaId: string,
    muc: muc_nang_luc | null,
  ) {
    const hocVienId = this.assertHocVienId(caller);
    const dangKy = await this.prisma.dang_ky_hoc.findUnique({
      where: {
        hoc_vien_id_khoa_id: { hoc_vien_id: hocVienId, khoa_id: khoaId },
      },
      include: { khoa: true },
    });
    if (!dangKy) throw new NotFoundAppException('Không tìm thấy đăng ký học');
    if (!dangKy.khoa.mo_dieu_chinh_muc) throw new DieuChinhMucDongException();
    return this.luuMucHoc(dangKy, muc);
  }

  async capNhatMucHocDangKy(id: string, muc: muc_nang_luc | null) {
    const dangKy = await this.getDangKyOrThrow(id);
    return this.luuMucHoc(dangKy, muc);
  }

  private async luuMucHoc(
    dangKy: {
      id: string;
      hoc_vien_id: string;
      muc_dau_vao: muc_nang_luc | null;
      muc_hoc_chon: muc_nang_luc | null;
      muc_hoc_chon_luc: Date | null;
      khoa_id: string;
      khoa: { ten_khoa: string };
    },
    muc: muc_nang_luc | null,
  ) {
    // Mốc = mức quản trị chốt ?? mức quy đổi từ bài đánh giá đầu vào (2026-10-09).
    const { muc: mucDanhGia } = await this.mucDanhGiaCuaDangKy(dangKy);
    if (!mucDanhGia) {
      throw new ValidationException('Chưa có kết quả đánh giá đầu vào', [
        { field: 'muc', message: 'Chưa có kết quả đánh giá đầu vào' },
      ]);
    }
    if (muc && !duocChonMuc(mucDanhGia, muc)) {
      throw new ValidationException(
        'Chỉ được chọn mức đánh giá hoặc thấp hơn 1 mức',
        [
          {
            field: 'muc',
            message: 'Chỉ được chọn mức đánh giá hoặc thấp hơn 1 mức',
          },
        ],
      );
    }
    const mucMoi = muc === mucDanhGia ? null : muc;
    let luc = dangKy.muc_hoc_chon_luc;
    // Chỉ ghi thời điểm + nhật ký khi giá trị thật sự đổi (lưu lại cùng mức thì giữ nguyên).
    if (mucMoi !== dangKy.muc_hoc_chon) {
      luc = new Date();
      await this.prisma.dang_ky_hoc.update({
        where: { id: dangKy.id },
        data: { muc_hoc_chon: mucMoi, muc_hoc_chon_luc: luc },
      });
      const mucCu = mucHocHieuLuc(dangKy.muc_hoc_chon, mucDanhGia);
      const mucHoc = mucMoi ?? mucDanhGia;
      await this.nhatKy.ghi({
        hanh_dong: 'dieu_chinh_muc_hoc',
        hoc_vien_id: dangKy.hoc_vien_id,
        mo_ta: `${dangKy.khoa.ten_khoa}: ${nhanMuc(mucCu)} → ${nhanMuc(mucHoc)}`,
        chi_tiet: { khoa_id: dangKy.khoa_id, muc_cu: mucCu, muc_moi: mucHoc },
      });
    }
    return {
      muc_dau_vao: dangKy.muc_dau_vao,
      muc_hoc_chon: mucMoi,
      muc_hoc: mucMoi ?? mucDanhGia,
      muc_hoc_chon_luc: luc,
    };
  }

  // Mức đánh giá làm mốc của 1 đăng ký: muc_dau_vao (chốt) ?? bài khảo sát
  // đầu vào đã hoàn thành (quy đổi M1..M4). KHÔNG ghi ngược vào muc_dau_vao.
  async mucDanhGiaCuaDangKy(dangKy: {
    hoc_vien_id: string;
    muc_dau_vao: muc_nang_luc | null;
  }) {
    if (dangKy.muc_dau_vao) return mucDanhGiaLamMoc(dangKy.muc_dau_vao, null);
    return mucDanhGiaLamMoc(
      null,
      await this.baiDauVaoCuaHocVien(dangKy.hoc_vien_id),
    );
  }

  private baiDauVaoCuaHocVien(hocVienId: string) {
    return this.prisma.ket_qua_khao_sat.findUnique({
      where: {
        hoc_vien_id_loai: { hoc_vien_id: hocVienId, loai: LOAI_BAI_DAU_VAO },
      },
      select: { trang_thai: true, muc: true, muc_goc: true },
    });
  }

  // Nhật ký phân lớp / đổi cụm — dựng câu mô tả lúc ghi vì tên lớp/cụm có thể đổi về sau.
  private async ghiPhanLop(
    dangKy: { hoc_vien_id: string; khoa: { ten_khoa: string } },
    giaiDoan: { thu_tu: number; ten_giai_doan: string },
    lopCu: string | null,
    lopMoi: string | null,
    nguon: 'thu_cong' | 'nhap_file',
  ) {
    await this.nhatKy.ghi({
      hanh_dong: 'phan_lop',
      hoc_vien_id: dangKy.hoc_vien_id,
      mo_ta:
        `${dangKy.khoa.ten_khoa} — GĐ${giaiDoan.thu_tu} "${giaiDoan.ten_giai_doan}": ` +
        `${lopCu ?? '(chưa có lớp)'} → ${lopMoi ?? '(gỡ lớp)'}` +
        (nguon === 'nhap_file' ? ' (nhập file)' : ''),
    });
  }

  private async ghiDoiCum(
    dangKy: { hoc_vien_id: string; khoa: { ten_khoa: string } },
    cumCuId: string | null,
    cumMoiId: string | null,
    nguon: 'thu_cong' | 'nhap_file' = 'thu_cong',
  ) {
    if (cumCuId === cumMoiId) return;
    const ids = [cumCuId, cumMoiId].filter((x): x is string => !!x);
    const cums = await this.prisma.cum_hoc_vien.findMany({
      where: { id: { in: ids } },
      select: { id: true, ten_cum: true },
    });
    const ten = (id: string | null) =>
      id ? (cums.find((c) => c.id === id)?.ten_cum ?? id) : '(chưa có cụm)';
    await this.nhatKy.ghi({
      hanh_dong: 'doi_cum',
      hoc_vien_id: dangKy.hoc_vien_id,
      mo_ta:
        `${dangKy.khoa.ten_khoa}: ${ten(cumCuId)} → ${ten(cumMoiId)}` +
        (nguon === 'nhap_file' ? ' (nhập file)' : ''),
    });
  }

  // Export "Danh sách chia lớp" (2026-10-09, quan_tri only) — Excel đọc được
  // bởi readPhanLopWorkbook (cột "GĐ<n> - <tên>"/ten_cum để trống có chủ ý,
  // xem danh-sach-chia-lop-excel.util.ts) để chia lớp ngoài hệ thống rồi
  // nhập lại thẳng qua import phan_lop_hoc_vien.
  async xuatDanhSachChiaLop(
    khoaId: string,
  ): Promise<{ buffer: Buffer; maKhoa: string }> {
    const khoa = await this.prisma.khoa_boi_duong.findUnique({
      where: { id: khoaId },
      select: {
        ma_khoa: true,
        giai_doan: {
          where: { trang_thai: 'active' },
          orderBy: { thu_tu: 'asc' },
          select: { id: true, thu_tu: true, ten_giai_doan: true },
        },
        lop_hoc: {
          select: {
            ten_lop: true,
            loai_lop: true,
            muc_nang_luc: true,
            si_so_toi_da: true,
          },
          orderBy: { ten_lop: 'asc' },
        },
      },
    });
    if (!khoa) throw new NotFoundAppException('Không tìm thấy khóa bồi dưỡng');

    const dangKyList = await this.prisma.dang_ky_hoc.findMany({
      where: { khoa_id: khoaId },
      select: {
        muc_dau_vao: true,
        muc_hoc_chon: true,
        muc_hoc_chon_luc: true,
        cum: { select: { ten_cum: true } },
        phan_lop_giai_doan: {
          select: {
            giai_doan_id: true,
            lop: { select: { ten_lop: true, loai_lop: true } },
          },
        },
        hoc_vien: {
          select: {
            ho_ten: true,
            ma_dinh_danh_moet: true,
            trang_thai: true,
            doi_tuong: true,
            cap_giang_day: true,
            don_vi_cong_tac: {
              select: {
                ten_don_vi: true,
                don_vi_cha: { select: { ten_don_vi: true } },
              },
            },
            ket_qua_khao_sat: {
              where: { loai: LOAI_BAI_DAU_VAO },
              select: {
                trang_thai: true,
                muc: true,
                muc_goc: true,
                diem: true,
                diem_toi_da: true,
                hoan_thanh_luc: true,
              },
            },
          },
        },
      },
    });

    const thang = await this.thangMuc.thang();
    const rows: DongChiaLop[] = dangKyList.map((dk) => {
      const bai = dk.hoc_vien.ket_qua_khao_sat[0];
      return {
        ho_ten: dk.hoc_vien.ho_ten,
        ma_dinh_danh_moet: dk.hoc_vien.ma_dinh_danh_moet,
        trang_thai_ho_so: dk.hoc_vien.trang_thai,
        doi_tuong: dk.hoc_vien.doi_tuong,
        cap_giang_day: dk.hoc_vien.cap_giang_day,
        ten_truong: dk.hoc_vien.don_vi_cong_tac.ten_don_vi,
        ten_don_vi_quan_ly:
          dk.hoc_vien.don_vi_cong_tac.don_vi_cha?.ten_don_vi ?? null,
        bai_dau_vao: bai
          ? {
              trang_thai: bai.trang_thai,
              muc: bai.muc,
              muc_goc: bai.muc_goc,
              diem: bai.diem === null ? null : Number(bai.diem),
              diem_toi_da: bai.diem_toi_da === null ? null : Number(bai.diem_toi_da),
              hoan_thanh_luc: bai.hoan_thanh_luc,
            }
          : null,
        muc_dau_vao: dk.muc_dau_vao,
        muc_hoc_chon: dk.muc_hoc_chon,
        muc_hoc_chon_luc: dk.muc_hoc_chon_luc,
        ten_cum: dk.cum?.ten_cum ?? null,
        phan_lop: dk.phan_lop_giai_doan.map((p) => ({
          giai_doan_id: p.giai_doan_id,
          ten_lop: p.lop.ten_lop,
          loai_lop: p.lop.loai_lop,
        })),
      };
    });

    const buffer = await buildDanhSachChiaLopWorkbook(
      khoa.ma_khoa,
      khoa.giai_doan,
      khoa.lop_hoc,
      rows,
      thang,
    );
    return { buffer, maKhoa: khoa.ma_khoa };
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
    let mucDauVao:
      | Promise<{
          muc_danh_gia: muc_nang_luc | null;
          muc_hoc_chon: muc_nang_luc | null;
        } | null>
      | undefined;
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
            select: { muc_dau_vao: true, muc_hoc_chon: true },
          })
          .then(async (dk) =>
            dk
              ? {
                  muc_hoc_chon: dk.muc_hoc_chon,
                  muc_danh_gia: (
                    await this.mucDanhGiaCuaDangKy({
                      hoc_vien_id: hocVien.id,
                      muc_dau_vao: dk.muc_dau_vao,
                    })
                  ).muc,
                }
              : null,
          );
        // So với mức học hiệu lực (muc_hoc_chon ?? mốc đánh giá, 2026-10-09).
        const dk = await mucDauVao;
        const muc = dk ? mucHocHieuLuc(dk.muc_hoc_chon, dk.muc_danh_gia) : null;
        if (dk && muc && muc !== lop.muc_nang_luc) {
          const dieuChinh = dk.muc_hoc_chon
            ? ` (học viên tự điều chỉnh từ "${dk.muc_danh_gia}")`
            : '';
          canhBaoList.push(
            `Học viên "${ma}" có mức học "${muc}"${dieuChinh} khác mức năng lực "${lop.muc_nang_luc}" của lớp "${lop.ten_lop}" — kiểm tra lại phân lớp`,
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
    const dangKyCu = await this.prisma.dang_ky_hoc.findUnique({
      where: {
        hoc_vien_id_khoa_id: {
          hoc_vien_id: dto.hoc_vien_id,
          khoa_id: dto.khoa_id,
        },
      },
      select: {
        cum_id: true,
        phan_lop_giai_doan: {
          select: {
            giai_doan_id: true,
            lop_id: true,
            lop: { select: { ten_lop: true } },
          },
        },
      },
    });
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
    await this.ghiNhatKyNhapPhanLop(dto, dangKyCu);

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
  private async ghiNhatKyNhapPhanLop(
    dto: PhanLopHocVienRowDto,
    dangKyCu: {
      cum_id: string | null;
      phan_lop_giai_doan: {
        giai_doan_id: string;
        lop_id: string;
        lop: { ten_lop: string };
      }[];
    } | null,
  ) {
    const lopCu = new Map(
      (dangKyCu?.phan_lop_giai_doan ?? []).map((p) => [p.giai_doan_id, p]),
    );
    const doi = dto.gan.filter(
      (g) => (lopCu.get(g.giai_doan_id)?.lop_id ?? null) !== g.lop_id,
    );
    const doiCum =
      dto.cum_id !== undefined && (dangKyCu?.cum_id ?? null) !== dto.cum_id;
    if (doi.length === 0 && !doiCum) return;

    const [khoa, giaiDoans, lops] = await Promise.all([
      this.prisma.khoa_boi_duong.findUnique({
        where: { id: dto.khoa_id },
        select: { ten_khoa: true },
      }),
      this.prisma.giai_doan_khoa.findMany({
        where: { id: { in: doi.map((g) => g.giai_doan_id) } },
        select: { id: true, thu_tu: true, ten_giai_doan: true },
      }),
      this.prisma.lop_hoc.findMany({
        where: { id: { in: doi.flatMap((g) => (g.lop_id ? [g.lop_id] : [])) } },
        select: { id: true, ten_lop: true },
      }),
    ]);
    const chuThe = {
      hoc_vien_id: dto.hoc_vien_id,
      khoa: { ten_khoa: khoa?.ten_khoa ?? '' },
    };
    for (const g of doi) {
      const gd = giaiDoans.find((x) => x.id === g.giai_doan_id);
      if (!gd) continue;
      const tenLopMoi = g.lop_id
        ? (lops.find((l) => l.id === g.lop_id)?.ten_lop ?? g.lop_id)
        : null;
      await this.ghiPhanLop(
        chuThe,
        gd,
        lopCu.get(g.giai_doan_id)?.lop.ten_lop ?? null,
        tenLopMoi,
        'nhap_file',
      );
    }
    if (doiCum) {
      await this.ghiDoiCum(
        chuThe,
        dangKyCu?.cum_id ?? null,
        dto.cum_id ?? null,
        'nhap_file',
      );
    }
  }

  async commitKetQuaDanhGia(dto: KetQuaDanhGiaRowDto): Promise<void> {
    const cu = await this.prisma.dang_ky_hoc.findUnique({
      where: {
        hoc_vien_id_khoa_id: {
          hoc_vien_id: dto.hoc_vien_id,
          khoa_id: dto.khoa_id,
        },
      },
      select: {
        muc_dau_vao: true,
        muc_dau_ra: true,
        muc_hoc_chon: true,
        khoa: { select: { ten_khoa: true } },
      },
    });
    // Mức tự chọn chỉ giữ khi vẫn THẤP HƠN ĐÚNG 1 mức so với mức đánh giá mới —
    // bằng/cao hơn hoặc thấp hơn quá 1 mức thì reset về học theo mức đánh giá.
    const resetMucChon =
      dto.loai === 'dau_vao' &&
      !!cu?.muc_hoc_chon &&
      (cu.muc_hoc_chon === dto.muc || !duocChonMuc(dto.muc, cu.muc_hoc_chon));
    await this.prisma.dang_ky_hoc.update({
      where: {
        hoc_vien_id_khoa_id: {
          hoc_vien_id: dto.hoc_vien_id,
          khoa_id: dto.khoa_id,
        },
      },
      data:
        dto.loai === 'dau_vao'
          ? {
              muc_dau_vao: dto.muc,
              ...(resetMucChon
                ? { muc_hoc_chon: null, muc_hoc_chon_luc: null }
                : {}),
            }
          : { muc_dau_ra: dto.muc },
    });
    const mucCu =
      (dto.loai === 'dau_vao' ? cu?.muc_dau_vao : cu?.muc_dau_ra) ?? null;
    if (mucCu !== dto.muc) {
      await this.nhatKy.ghi({
        hanh_dong: 'cap_nhat_muc_danh_gia',
        hoc_vien_id: dto.hoc_vien_id,
        mo_ta:
          `${cu?.khoa.ten_khoa ?? ''} — ${dto.loai === 'dau_vao' ? 'Đầu vào' : 'Đầu ra'}: ` +
          `${nhanMuc(mucCu)} → ${nhanMuc(dto.muc)} (nhập file)`,
      });
    }
  }

  // ---------------------------------------------------------------------
  // Import lop_va_lich_hoc (T6, mo-rong-nls-an-giang.md — gọi từ
  // ImportService) — mỗi dòng = 1 buổi học. Cột file: ma_khoa, ten_lop,
  // nhom_hoc_vien (tùy chọn, 1-20), muc_nang_luc (tùy chọn), si_so_toi_da
  // (tùy chọn), giai_doan_thu_tu, buoi_so, bat_dau, ket_thuc (dd/mm/yyyy
  // hh:mm giờ VN, quy tắc chung #4), dia_diem_hoac_link (tùy chọn),
  // phong (tùy chọn), ma_diem_hoc (T10, issue #2 — bắt buộc với buổi thuộc
  // giai đoạn truc_tiep, trừ khi buổi đã tồn tại và đã có điểm học: ô trống
  // = giữ điểm học/phòng hiện có).
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
      phong?: string;
      ma_diem_hoc?: string;
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
    const phong = raw.phong?.trim() || undefined;
    if (phong && phong.length > 100) {
      return { error: 'Cột "phong" tối đa 100 ký tự' };
    }

    // T10: tra điểm học; buổi giai đoạn truc_tiep phải có điểm học sau khi
    // ghi (ô trống chỉ hợp lệ khi buổi đã tồn tại và đã có điểm học).
    const tenLopChuan = normalizeNfcName(tenLop);
    const lopCu = await this.prisma.lop_hoc.findUnique({
      where: {
        khoa_id_loai_lop_ten_lop: {
          khoa_id: khoa.id,
          loai_lop: loaiLop,
          ten_lop: tenLopChuan,
        },
      },
      select: { id: true },
    });
    let diemHocId: string | undefined;
    const maDiemHoc = raw.ma_diem_hoc?.trim();
    if (maDiemHoc) {
      const diemHoc = await this.prisma.diem_hoc.findUnique({
        where: { ma_diem_hoc: maDiemHoc },
      });
      if (!diemHoc || diemHoc.trang_thai !== 'active') {
        return {
          error: `Điểm học "${maDiemHoc}" không tồn tại hoặc đã ngừng hoạt động`,
        };
      }
      diemHocId = diemHoc.id;
    } else if (giaiDoan.hinh_thuc === 'truc_tiep') {
      const lichCu = lopCu
        ? await this.prisma.lich_hoc_lop.findUnique({
            where: {
              lop_id_giai_doan_id_buoi_so: {
                lop_id: lopCu.id,
                giai_doan_id: giaiDoan.id,
                buoi_so: buoiSo,
              },
            },
            select: { diem_hoc_id: true },
          })
        : null;
      if (!lichCu?.diem_hoc_id) {
        return {
          error:
            'Buổi thuộc giai đoạn trực tiếp phải có "ma_diem_hoc" (điểm học)',
        };
      }
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

    // T11: buổi đã có phân công giảng viên — giờ mới không được trùng buổi
    // khác của giảng viên đó.
    if (lopCu) {
      const lichTonTai = await this.prisma.lich_hoc_lop.findUnique({
        where: {
          lop_id_giai_doan_id_buoi_so: {
            lop_id: lopCu.id,
            giai_doan_id: giaiDoan.id,
            buoi_so: buoiSo,
          },
        },
        select: { id: true },
      });
      const xungDot = lichTonTai
        ? await this.phanCongGiangDay.xungDotKhiDoiGio(lichTonTai.id, {
            thoi_gian_bat_dau: batDau,
            thoi_gian_ket_thuc: ketThuc,
          })
        : null;
      if (xungDot) return { error: xungDot };
    }

    const canhBaoPhong = diemHocId
      ? await this.diemHocService.canhBaoVuotSoPhong({
          diem_hoc_id: diemHocId,
          lop_id: lopCu?.id ?? '00000000-0000-0000-0000-000000000000',
          bat_dau: batDau,
          ket_thuc: ketThuc,
        })
      : [];
    // Chỉ so với buổi đã lưu của lớp — các dòng khác trong cùng file chưa có.
    const canhBaoChong = lopCu
      ? await this.canhBaoChongCuaSo(
          { id: lopCu.id, loai_lop: loaiLop, khoa },
          {
            giai_doan_id: giaiDoan.id,
            buoi_so: buoiSo,
            thoi_gian_bat_dau: batDau,
          },
        )
      : [];

    return {
      dto: {
        khoa_id: khoa.id,
        ten_lop: tenLopChuan,
        loai_lop: loaiLop,
        nhom_hoc_vien: nhomHocVien,
        muc_nang_luc: mucNangLuc,
        si_so_toi_da: siSoToiDa,
        giai_doan_id: giaiDoan.id,
        buoi_so: buoiSo,
        thoi_gian_bat_dau: batDau,
        thoi_gian_ket_thuc: ketThuc,
        dia_diem_hoac_link: diaDiemHoacLink,
        diem_hoc_id: diemHocId,
        phong,
      },
      canhBao:
        [
          canhBaoBuoiHocGiaiDoan(
            loaiLop,
            { bat_dau: batDau, ket_thuc: ketThuc },
            giaiDoan,
          ),
          ...canhBaoPhong,
          ...canhBaoChong,
        ]
          .filter(Boolean)
          .join('; ') || undefined,
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

    // Buổi đã có → đi qua LichHocThayDoiService (chỉ đổi cap_nhat_luc + ghi
    // nhật ký khi giờ/địa điểm thật sự đổi — chạy lại file y nguyên không
    // làm "cần nhắc lại" giả).
    const lichCu = await this.prisma.lich_hoc_lop.findUnique({
      where: {
        lop_id_giai_doan_id_buoi_so: {
          lop_id: lop.id,
          giai_doan_id: dto.giai_doan_id,
          buoi_so: dto.buoi_so,
        },
      },
    });
    if (!lichCu) {
      await this.prisma.lich_hoc_lop.create({
        data: {
          lop_id: lop.id,
          giai_doan_id: dto.giai_doan_id,
          buoi_so: dto.buoi_so,
          thoi_gian_bat_dau: dto.thoi_gian_bat_dau,
          thoi_gian_ket_thuc: dto.thoi_gian_ket_thuc,
          dia_diem_hoac_link: dto.dia_diem_hoac_link,
          diem_hoc_id: dto.diem_hoc_id,
          phong: dto.phong,
        },
      });
      return;
    }
    await this.lichHocThayDoi.capNhat(
      lichCu,
      {
        thoi_gian_bat_dau: dto.thoi_gian_bat_dau,
        thoi_gian_ket_thuc: dto.thoi_gian_ket_thuc,
        dia_diem_hoac_link: dto.dia_diem_hoac_link,
        diem_hoc_id: dto.diem_hoc_id,
        phong: dto.phong,
      },
      { nguon: 'import' },
    );
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
      // ADR 0005 Z3: import luôn ghi đè trạng thái/nguồn nhưng GIỮ
      // tu_diem_danh_luc (không liệt kê ở đây); xóa nguoi_sua vì dòng không
      // còn là bản sửa tay.
      update: {
        trang_thai: dto.trang_thai,
        nguon: dto.nguon,
        ghi_chu: dto.ghi_chu,
        nguon_import_id: importId,
        cap_nhat_luc: new Date(),
        nguoi_sua: null,
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
