import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ScopeService, DonViScope } from '../auth/scope/scope.service';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { HocVienService } from '../hoc-vien/hoc-vien.service';
import {
  ForbiddenAppException,
  NotFoundAppException,
} from '../common/exceptions/app.exceptions';
import { TongHopQueryDto } from './dto/tong-hop-query.dto';
import { XacNhanQueryDto } from './dto/xac-nhan-query.dto';
import { VanHanhQueryDto } from './dto/van-hanh-query.dto';
import {
  CAP_GIANG_DAY,
  CHUA_CO_KET_QUA,
  DieuKienDanhGiaRow,
  KET_QUA_HOC,
  KHONG_XAC_DINH,
  MUC_NANG_LUC,
  SuaTruongMoetRow,
  TRANG_THAI_DANG_KY,
  TRANG_THAI_HO_SO,
  TongHopDiaBanRow,
  TongHopDonViRow,
  TongHopKhoaRow,
  TongHopResult,
  VanHanhResult,
  VanHanhRow,
  VanHanhTong,
  XacNhanRow,
  XuatChoVleRow,
} from './bao-cao.types';

// Dịch vụ Báo cáo — docs/api-contract.md mục 7 CHỈ có 2 dòng mô tả endpoint,
// không mô tả response shape hay field ngày lọc theo report nào. Toàn bộ
// dưới đây là suy luận có lý do, PROVISIONAL (giống GET /auth/toi):
//
// - Trường ngày lọc: theo=don_vi/dia_ban dùng hoc_vien.created_at (thời điểm
//   hồ sơ được tạo — phản ánh "có bao nhiêu hồ sơ phát sinh trong kỳ", đúng ý
//   nghĩa báo cáo tiến độ thu thập dữ liệu). theo=khoa dùng
//   khoa_boi_duong.thoi_gian_bat_dau (báo cáo "khóa nào diễn ra trong kỳ",
//   không phải khóa nào được TẠO trong kỳ — đúng ý nghĩa README "theo dõi
//   tiến độ khóa bồi dưỡng").
// - Nhóm theo=dia_ban dùng dia_ban_id của ĐƠN VỊ CÔNG TÁC (don_vi_cong_tac.
//   dia_ban_id), KHÔNG dùng hoc_vien.phuong_xa_id (nơi cư trú). Lý do:
//   dia_ban_id của đơn vị là NOT NULL, có ngay từ khi tạo don_vi_cong_tac;
//   phuong_xa_id của hoc_vien là optional, thường NULL với hồ sơ
//   nguon_tao='import_moet' chưa bổ sung. Dùng nơi công tác cho ra báo cáo
//   đầy đủ hơn, và khớp với cách phạm vi Phòng VHXH được định nghĩa theo cây
//   don_vi (không theo nơi cư trú của từng học viên).
// - theo=don_vi/dia_ban CHỈ liệt kê nhóm có ít nhất 1 hoc_vien khớp bộ lọc
//   (không liệt kê toàn bộ đơn vị/địa bàn trong phạm vi kèm số 0) — tránh
//   response phình to với hàng loạt dòng toàn số 0. theo=khoa liệt kê TOÀN
//   BỘ khóa trong phạm vi + khớp bộ lọc ngày kể cả khóa 0 đăng ký — vì đây
//   đúng là ý nghĩa "theo dõi tiến độ", khóa chưa có ai đăng ký vẫn là tín
//   hiệu cần thấy.
// - Response shape: { theo, tu_ngay, den_ngay, rows: [...] } — xem
//   bao-cao.types.ts cho shape từng loại row.
@Injectable()
export class BaoCaoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scopeService: ScopeService,
    private readonly hocVienService: HocVienService,
  ) {}

  async tongHop(
    query: TongHopQueryDto,
    user: AuthenticatedUser,
  ): Promise<TongHopResult> {
    const scope = await this.scopeService.getAccessibleDonViIds(user);
    let rows: TongHopResult['rows'];
    if (query.theo === 'don_vi') {
      rows = await this.tongHopTheoDonVi(scope, query);
    } else if (query.theo === 'dia_ban') {
      rows = await this.tongHopTheoDiaBan(scope, query);
    } else {
      rows = await this.tongHopTheoKhoa(scope, query);
    }
    return {
      theo: query.theo,
      tu_ngay: query.tu_ngay ?? null,
      den_ngay: query.den_ngay ?? null,
      rows,
    };
  }

  private hocVienWhere(
    scope: DonViScope,
    query: TongHopQueryDto,
  ): Prisma.hoc_vienWhereInput {
    const where: Prisma.hoc_vienWhereInput = {};
    if (scope !== 'ALL') {
      where.don_vi_cong_tac_id = { in: scope };
    }
    if (query.tu_ngay || query.den_ngay) {
      where.created_at = {};
      if (query.tu_ngay)
        where.created_at.gte = new Date(`${query.tu_ngay}T00:00:00.000Z`);
      if (query.den_ngay)
        where.created_at.lte = new Date(`${query.den_ngay}T23:59:59.999Z`);
    }
    return where;
  }

  private emptyTheoTrangThai(): Record<string, number> {
    return Object.fromEntries(TRANG_THAI_HO_SO.map((t) => [t, 0]));
  }

  private emptyTheoCapGiangDay(): Record<string, number> {
    return {
      ...Object.fromEntries(CAP_GIANG_DAY.map((c) => [c, 0])),
      [KHONG_XAC_DINH]: 0,
    };
  }

  private async tongHopTheoDonVi(
    scope: DonViScope,
    query: TongHopQueryDto,
  ): Promise<TongHopDonViRow[]> {
    if (scope !== 'ALL' && scope.length === 0) return [];
    const hocViens = await this.prisma.hoc_vien.findMany({
      where: this.hocVienWhere(scope, query),
      select: {
        trang_thai: true,
        cap_giang_day: true,
        don_vi_cong_tac_id: true,
        don_vi_cong_tac: { select: { ten_don_vi: true } },
      },
    });

    const byDonVi = new Map<string, TongHopDonViRow>();
    for (const hv of hocViens) {
      let row = byDonVi.get(hv.don_vi_cong_tac_id);
      if (!row) {
        row = {
          don_vi_id: hv.don_vi_cong_tac_id,
          ten_don_vi: hv.don_vi_cong_tac.ten_don_vi,
          tong_so: 0,
          theo_trang_thai: this.emptyTheoTrangThai(),
          theo_cap_giang_day: this.emptyTheoCapGiangDay(),
        };
        byDonVi.set(hv.don_vi_cong_tac_id, row);
      }
      row.tong_so += 1;
      row.theo_trang_thai[hv.trang_thai] += 1;
      row.theo_cap_giang_day[hv.cap_giang_day ?? KHONG_XAC_DINH] += 1;
    }

    return Array.from(byDonVi.values()).sort((a, b) =>
      a.ten_don_vi.localeCompare(b.ten_don_vi, 'vi'),
    );
  }

  private async tongHopTheoDiaBan(
    scope: DonViScope,
    query: TongHopQueryDto,
  ): Promise<TongHopDiaBanRow[]> {
    if (scope !== 'ALL' && scope.length === 0) return [];
    const hocViens = await this.prisma.hoc_vien.findMany({
      where: this.hocVienWhere(scope, query),
      select: {
        trang_thai: true,
        cap_giang_day: true,
        don_vi_cong_tac: {
          select: { dia_ban_id: true, dia_ban: { select: { ten: true } } },
        },
      },
    });

    const byDiaBan = new Map<string, TongHopDiaBanRow>();
    for (const hv of hocViens) {
      const diaBanId = hv.don_vi_cong_tac.dia_ban_id;
      let row = byDiaBan.get(diaBanId);
      if (!row) {
        row = {
          dia_ban_id: diaBanId,
          ten_dia_ban: hv.don_vi_cong_tac.dia_ban.ten,
          tong_so: 0,
          theo_trang_thai: this.emptyTheoTrangThai(),
          theo_cap_giang_day: this.emptyTheoCapGiangDay(),
        };
        byDiaBan.set(diaBanId, row);
      }
      row.tong_so += 1;
      row.theo_trang_thai[hv.trang_thai] += 1;
      row.theo_cap_giang_day[hv.cap_giang_day ?? KHONG_XAC_DINH] += 1;
    }

    return Array.from(byDiaBan.values()).sort((a, b) =>
      a.ten_dia_ban.localeCompare(b.ten_dia_ban, 'vi'),
    );
  }

  private async tongHopTheoKhoa(
    scope: DonViScope,
    query: TongHopQueryDto,
  ): Promise<TongHopKhoaRow[]> {
    if (scope !== 'ALL' && scope.length === 0) return [];
    const where: Prisma.khoa_boi_duongWhereInput = {};
    if (scope !== 'ALL') {
      where.don_vi_to_chuc_id = { in: scope };
    }
    if (query.tu_ngay || query.den_ngay) {
      where.thoi_gian_bat_dau = {};
      if (query.tu_ngay) where.thoi_gian_bat_dau.gte = new Date(query.tu_ngay);
      if (query.den_ngay)
        where.thoi_gian_bat_dau.lte = new Date(query.den_ngay);
    }

    const khoas = await this.prisma.khoa_boi_duong.findMany({
      where,
      select: {
        id: true,
        ma_khoa: true,
        ten_khoa: true,
        trang_thai: true,
        don_vi_to_chuc: { select: { ten_don_vi: true } },
        dang_ky_hoc: { select: { trang_thai: true, ket_qua: true } },
      },
      orderBy: { ma_khoa: 'asc' },
    });

    return khoas.map((k) => {
      const theo_trang_thai_dang_ky = Object.fromEntries(
        TRANG_THAI_DANG_KY.map((t) => [t, 0]),
      ) as Record<string, number>;
      const theo_ket_qua = {
        ...Object.fromEntries(KET_QUA_HOC.map((kq) => [kq, 0])),
        [CHUA_CO_KET_QUA]: 0,
      } as Record<string, number>;

      for (const dk of k.dang_ky_hoc) {
        theo_trang_thai_dang_ky[dk.trang_thai] += 1;
        theo_ket_qua[dk.ket_qua ?? CHUA_CO_KET_QUA] += 1;
      }

      return {
        khoa_id: k.id,
        ma_khoa: k.ma_khoa,
        ten_khoa: k.ten_khoa,
        don_vi_to_chuc: k.don_vi_to_chuc.ten_don_vi,
        trang_thai_khoa: k.trang_thai,
        tong_dang_ky: k.dang_ky_hoc.length,
        theo_trang_thai_dang_ky,
        theo_ket_qua,
      };
    });
  }

  // -------------------------------------------------------------------
  // T14 — GET /bao-cao/xac-nhan?dot_id=&trang_thai=&don_vi_cong_tac_id=
  // Phạm vi: Trường/Phòng/Sở chỉ thấy giáo viên trong phạm vi đơn vị mình
  // (ScopeService, giống mọi báo cáo khác) — quan_tri thấy toàn bộ.
  // -------------------------------------------------------------------
  async baoCaoXacNhan(
    query: XacNhanQueryDto,
    caller: AuthenticatedUser,
  ): Promise<{ dot_id: string; rows: XacNhanRow[] }> {
    const dot = await this.prisma.dot_xac_nhan.findUnique({
      where: { id: query.dot_id },
    });
    if (!dot) throw new NotFoundAppException('Không tìm thấy đợt xác nhận');

    const scope = await this.scopeService.getAccessibleDonViIds(caller);
    const where: Prisma.hoc_vienWhereInput = { nguon_tao: 'import_moet' };
    if (scope !== 'ALL') {
      if (scope.length === 0) return { dot_id: dot.id, rows: [] };
      where.don_vi_cong_tac_id = { in: scope };
    }
    if (query.don_vi_cong_tac_id) {
      if (scope !== 'ALL' && !scope.includes(query.don_vi_cong_tac_id)) {
        throw new ForbiddenAppException(
          'Đơn vị công tác nằm ngoài phạm vi quyền',
        );
      }
      where.don_vi_cong_tac_id = query.don_vi_cong_tac_id;
    }
    // Đợt gắn 1 khóa cụ thể -> chỉ áp dụng học viên đã ghi danh khóa đó.
    if (dot.khoa_id) {
      where.dang_ky_hoc = { some: { khoa_id: dot.khoa_id } };
    }

    const hocViens = await this.prisma.hoc_vien.findMany({
      where,
      include: {
        nguoi_dung_account: { select: { dang_nhap_lan_cuoi: true } },
        don_vi_cong_tac: { select: { ten_don_vi: true } },
        xac_nhan_ho_so: {
          where: { dot_id: dot.id, con_hieu_luc: true },
          select: { id: true },
        },
      },
      orderBy: { ho_ten: 'asc' },
    });

    const rows: XacNhanRow[] = hocViens.map((hv) => {
      const dangNhapLanCuoi = hv.nguoi_dung_account?.dang_nhap_lan_cuoi ?? null;
      const daXacNhan = hv.xac_nhan_ho_so.length > 0;
      const trangThai: XacNhanRow['trang_thai'] =
        dangNhapLanCuoi === null
          ? 'chua_dang_nhap'
          : daXacNhan
            ? 'da_xac_nhan'
            : 'dang_bo_sung';
      return {
        hoc_vien_id: hv.id,
        ho_ten: hv.ho_ten,
        ma_dinh_danh_moet: hv.ma_dinh_danh_moet,
        don_vi_cong_tac_ten: hv.don_vi_cong_tac.ten_don_vi,
        dang_nhap_lan_cuoi: dangNhapLanCuoi,
        trang_thai: trangThai,
      };
    });

    return {
      dot_id: dot.id,
      rows: query.trang_thai
        ? rows.filter((r) => r.trang_thai === query.trang_thai)
        : rows,
    };
  }

  // T14 — GET /bao-cao/sua-truong-moet?khoa_id= (quan_tri) — danh sách thay
  // đổi trường gốc MOET (la_truong_goc_moet=true) để N1 rà soát.
  async baoCaoSuaTruongMoet(khoaId?: string): Promise<SuaTruongMoetRow[]> {
    const where: Prisma.lich_su_thay_doi_ho_soWhereInput = {
      la_truong_goc_moet: true,
    };
    if (khoaId) where.dot = { khoa_id: khoaId };

    const rows = await this.prisma.lich_su_thay_doi_ho_so.findMany({
      where,
      include: {
        hoc_vien: { select: { ho_ten: true, ma_dinh_danh_moet: true } },
        nguoi_sua: { select: { ho_ten: true } },
      },
      orderBy: { sua_luc: 'desc' },
    });

    return rows.map((r) => ({
      id: r.id,
      hoc_vien_id: r.hoc_vien_id,
      ho_ten_hoc_vien: r.hoc_vien.ho_ten,
      ma_dinh_danh_moet: r.hoc_vien.ma_dinh_danh_moet,
      truong: r.truong,
      gia_tri_cu: r.gia_tri_cu,
      gia_tri_moi: r.gia_tri_moi,
      nguoi_sua: r.nguoi_sua.ho_ten,
      vai_tro_nguoi_sua: r.vai_tro_nguoi_sua,
      sua_luc: r.sua_luc,
    }));
  }

  // T14 — GET /bao-cao/xuat-cho-vle?khoa_id= (quan_tri) — file chuyển Phòng
  // CNTT tạo tài khoản VLE cho tất cả, kèm trạng thái đợt 1 (đợt loại
  // kiem_tra_bo_sung GẦN NHẤT khớp phạm vi khoa_id — improvised: tài liệu
  // không nói rõ chọn đợt 1 nào nếu có nhiều, flagged trong self-review).
  async baoCaoXuatChoVle(khoaId?: string): Promise<XuatChoVleRow[]> {
    const dot1 = await this.prisma.dot_xac_nhan.findFirst({
      where: { loai: 'kiem_tra_bo_sung', khoa_id: khoaId ?? null },
      orderBy: { created_at: 'desc' },
    });

    const where: Prisma.hoc_vienWhereInput = { nguon_tao: 'import_moet' };
    if (khoaId) where.dang_ky_hoc = { some: { khoa_id: khoaId } };

    const hocViens = await this.prisma.hoc_vien.findMany({
      where,
      include: {
        don_vi_cong_tac: { select: { ten_don_vi: true } },
        xac_nhan_ho_so: dot1
          ? {
              where: { dot_id: dot1.id, con_hieu_luc: true },
              select: { id: true },
            }
          : false,
      },
      orderBy: { ho_ten: 'asc' },
    });

    return hocViens.map((hv) => ({
      ma_dinh_danh_moet: hv.ma_dinh_danh_moet,
      ho_ten: hv.ho_ten,
      email: hv.email_lien_he,
      don_vi: hv.don_vi_cong_tac.ten_don_vi,
      trang_thai_dot_1: (dot1 && (hv.xac_nhan_ho_so?.length ?? 0) > 0
        ? 'da_xac_nhan'
        : 'chua_xac_nhan') as XuatChoVleRow['trang_thai_dot_1'],
    }));
  }

  // T15 — GET /bao-cao/dieu-kien-danh-gia?khoa_id= (quan_tri): đủ điều kiện /
  // không đủ (kèm lý do) / đã xem thông tin VLE, dùng cùng logic "đủ điều
  // kiện" với GET /hoc-vien/toi/danh-gia-dau-vao (HocVienService.
  // danhGiaDauVaoCuaToi) — xác nhận còn hiệu lực ở đợt xac_nhan_truoc_
  // danh_gia + day_du (T9). Gọi danhGiaDayDu() TỪNG hồ sơ (N truy vấn) — cùng
  // đánh đổi hiệu năng đã chấp nhận cho GET /hoc-vien?day_du= (api-contract.md
  // mục "Hồ sơ đầy đủ": chấp nhận ở quy mô ~9.000 hồ sơ).
  async baoCaoDieuKienDanhGia(khoaId?: string): Promise<DieuKienDanhGiaRow[]> {
    const where: Prisma.hoc_vienWhereInput = { nguon_tao: 'import_moet' };
    if (khoaId) where.dang_ky_hoc = { some: { khoa_id: khoaId } };

    const hocViens = await this.prisma.hoc_vien.findMany({
      where,
      include: {
        chuyen_mon: true,
        don_vi_cong_tac: { select: { ten_don_vi: true } },
        xac_nhan_ho_so: {
          where: {
            con_hieu_luc: true,
            dot: { loai: 'xac_nhan_truoc_danh_gia' },
          },
          select: { id: true },
        },
        tai_khoan_vle: { select: { lan_dau_xem_luc: true } },
      },
      orderBy: { ho_ten: 'asc' },
    });

    const rows: DieuKienDanhGiaRow[] = [];
    for (const hv of hocViens) {
      const { day_du, thieu } = await this.hocVienService.danhGiaDayDu(hv);
      const daXacNhan = hv.xac_nhan_ho_so.length > 0;
      const duDieuKien = daXacNhan && day_du;
      const lyDo: string[] = [];
      if (!daXacNhan) {
        lyDo.push('Chưa xác nhận hồ sơ ở đợt xác nhận trước đánh giá (đợt 2)');
      }
      if (!day_du) lyDo.push(...thieu.map((t) => t.message));

      rows.push({
        hoc_vien_id: hv.id,
        ho_ten: hv.ho_ten,
        ma_dinh_danh_moet: hv.ma_dinh_danh_moet,
        don_vi_cong_tac_ten: hv.don_vi_cong_tac.ten_don_vi,
        du_dieu_kien: duDieuKien,
        ly_do: duDieuKien ? [] : lyDo,
        da_xem_vle: hv.tai_khoan_vle?.lan_dau_xem_luc != null,
      });
    }
    return rows;
  }

  private emptyTheoMucDauVao(): Record<string, number> {
    return {
      ...Object.fromEntries(MUC_NANG_LUC.map((m) => [m, 0])),
      [KHONG_XAC_DINH]: 0,
    };
  }

  // -------------------------------------------------------------------
  // T7 — GET /bao-cao/van-hanh?khoa_id=&nhom_hoc_vien=&lop_id=. Mỗi dòng =
  // 1 lop_hoc. 2 lớp phạm vi KHÁC NHAU áp dụng đồng thời (T2, QĐ2):
  //  - Phạm vi XEM lớp (khóa nào hiện ra): chủ khóa (don_vi_to_chuc_id
  //    trong scope) HOẶC khóa đang được đơn vị của caller "theo dõi"
  //    (getKhoaIdsTheoDoi) — giống GET /khoa-boi-duong.
  //  - Phạm vi ĐẾM học viên bên trong mỗi lớp: LUÔN theo scope hồ sơ
  //    (getAccessibleDonViIds), KHÔNG mở rộng theo "theo dõi" — đúng ghi chú
  //    T2 "dữ liệu cấp học viên vẫn chỉ gồm học viên trong phạm vi hồ sơ của
  //    họ". Vì vậy 1 lớp có thể hiện ra (do theo dõi khóa) nhưng si_so/
  //    so_co_email/... chỉ đếm đúng phần học viên thuộc phạm vi của caller.
  // -------------------------------------------------------------------
  async baoCaoVanHanh(
    query: VanHanhQueryDto,
    caller: AuthenticatedUser,
  ): Promise<VanHanhResult> {
    const where: Prisma.lop_hocWhereInput = {};

    if (query.khoa_id) {
      const khoa = await this.prisma.khoa_boi_duong.findUnique({
        where: { id: query.khoa_id },
        select: { id: true, don_vi_to_chuc_id: true },
      });
      if (!khoa)
        throw new NotFoundAppException('Không tìm thấy khóa bồi dưỡng');
      if (caller.vai_tro !== 'quan_tri') {
        const coQuyen = await this.scopeService.canAccessDonVi(
          caller,
          khoa.don_vi_to_chuc_id,
        );
        if (!coQuyen) {
          const theoDoiKhoaIds =
            await this.scopeService.getKhoaIdsTheoDoi(caller);
          if (!theoDoiKhoaIds.includes(khoa.id)) {
            throw new ForbiddenAppException(
              'Khóa này nằm ngoài phạm vi quyền của tài khoản hiện tại',
            );
          }
        }
      }
      where.khoa_id = query.khoa_id;
    } else if (caller.vai_tro !== 'quan_tri') {
      const scope = await this.scopeService.getAccessibleDonViIds(caller);
      const scopeIds = scope === 'ALL' ? [] : scope;
      const theoDoiKhoaIds = await this.scopeService.getKhoaIdsTheoDoi(caller);
      if (scopeIds.length === 0 && theoDoiKhoaIds.length === 0) {
        return { khoa_id: null, rows: [], tong: this.emptyVanHanhTong() };
      }
      where.khoa = {
        OR: [
          ...(scopeIds.length > 0
            ? [{ don_vi_to_chuc_id: { in: scopeIds } }]
            : []),
          ...(theoDoiKhoaIds.length > 0
            ? [{ id: { in: theoDoiKhoaIds } }]
            : []),
        ],
      };
    }

    if (query.nhom_hoc_vien !== undefined) {
      where.nhom_hoc_vien = query.nhom_hoc_vien;
    }
    if (query.lop_id) where.id = query.lop_id;

    const hocVienScope =
      caller.vai_tro === 'quan_tri'
        ? 'ALL'
        : await this.scopeService.getAccessibleDonViIds(caller);
    const dangKyHocWhere: Prisma.dang_ky_hocWhereInput | undefined =
      hocVienScope === 'ALL'
        ? undefined
        : { hoc_vien: { don_vi_cong_tac_id: { in: hocVienScope } } };

    const lops = await this.prisma.lop_hoc.findMany({
      where,
      select: {
        id: true,
        ten_lop: true,
        nhom_hoc_vien: true,
        muc_nang_luc: true,
        dang_ky_hoc: {
          where: dangKyHocWhere,
          select: {
            muc_dau_vao: true,
            hoc_vien: { include: { chuyen_mon: true } },
          },
        },
      },
      orderBy: { ten_lop: 'asc' },
    });

    const tong = this.emptyVanHanhTong();
    const rows: VanHanhRow[] = [];
    for (const lop of lops) {
      const row: VanHanhRow = {
        lop_id: lop.id,
        ten_lop: lop.ten_lop,
        nhom_hoc_vien: lop.nhom_hoc_vien,
        muc_nang_luc: lop.muc_nang_luc,
        si_so: 0,
        so_co_email: 0,
        so_ho_so_day_du: 0,
        theo_muc_dau_vao: this.emptyTheoMucDauVao(),
      };
      for (const dk of lop.dang_ky_hoc) {
        row.si_so += 1;
        if (dk.hoc_vien.email_lien_he) row.so_co_email += 1;
        const { day_du } = await this.hocVienService.danhGiaDayDu(dk.hoc_vien);
        if (day_du) row.so_ho_so_day_du += 1;
        const muc = dk.muc_dau_vao ?? KHONG_XAC_DINH;
        row.theo_muc_dau_vao[muc] += 1;
      }
      tong.si_so += row.si_so;
      tong.so_co_email += row.so_co_email;
      tong.so_ho_so_day_du += row.so_ho_so_day_du;
      for (const muc of [...MUC_NANG_LUC, KHONG_XAC_DINH]) {
        tong.theo_muc_dau_vao[muc] += row.theo_muc_dau_vao[muc];
      }
      rows.push(row);
    }

    return { khoa_id: query.khoa_id ?? null, rows, tong };
  }

  private emptyVanHanhTong(): VanHanhTong {
    return {
      si_so: 0,
      so_co_email: 0,
      so_ho_so_day_du: 0,
      theo_muc_dau_vao: this.emptyTheoMucDauVao(),
    };
  }
}
