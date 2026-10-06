import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { IsOptional, Matches } from 'class-validator';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundAppException } from '../common/exceptions/app.exceptions';
import { khoangNgayVn } from '../common/utils/khoang-ngay-vn.util';
import { TrangLopService } from '../trang-lop/trang-lop.service';
import { HoTroGiangVienScopeService } from './ho-tro-giang-vien-scope.service';
import { VanHanhLopService } from './van-hanh-lop.service';
import {
  LuuHauCanDto,
  SuaBuoiHoTroGvDto,
  ThucDiaDto,
} from './dto/van-hanh-lop.dto';
import { PhanCongBuoiDto } from '../giang-vien/dto/giang-vien.dto';
import {
  CreateGiangVienDto,
  QueryGiangVienDto,
  UpdateGiangVienDto,
} from '../giang-vien/dto/giang-vien.dto';
import { GiangVienService } from '../giang-vien/giang-vien.service';
import {
  CreateDiemHocDto,
  QueryDiemHocDto,
  UpdateDiemHocDto,
} from '../diem-hoc/dto/diem-hoc.dto';
import { DiemHocService } from '../diem-hoc/diem-hoc.service';
import { ForbiddenAppException } from '../common/exceptions/app.exceptions';
import { BangKiemService } from '../bang-kiem/bang-kiem.service';
import { DanhDauMucDto } from '../bang-kiem/bang-kiem.controller';
import { IsInt, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

// Ngưng/gộp danh mục là việc của Quản trị (ADR 0004 G12).
function chanNgung(dto: { trang_thai?: unknown }) {
  if (dto.trang_thai !== undefined) {
    throw new ForbiddenAppException('Chỉ Quản trị được ngưng danh mục');
  }
}

const NGAY = /^\d{4}-\d{2}-\d{2}$/;

export class ViecCanLamQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(90)
  so_ngay?: number;
}

const MOT_NGAY_MS = 24 * 3600 * 1000;

export class LichDayQueryDto {
  @IsOptional()
  @Matches(NGAY, { message: 'Định dạng YYYY-MM-DD' })
  tu_ngay?: string;

  @IsOptional()
  @Matches(NGAY, { message: 'Định dạng YYYY-MM-DD' })
  den_ngay?: string;
}

// ADR 0004 (issue #14, #15): khu người hỗ trợ giảng viên. Tiền tố API
// /ho-tro-giang-vien (trang frontend ở /ho-tro-gv — không trùng tiền tố).
// Mọi endpoint kiểm phạm vi qua HoTroGiangVienScopeService trước.
@Roles('ho_tro_giang_vien')
@Controller('ho-tro-giang-vien')
export class HoTroGiangVienController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: HoTroGiangVienScopeService,
    private readonly trangLop: TrangLopService,
    private readonly vanHanh: VanHanhLopService,
    private readonly giangVien: GiangVienService,
    private readonly diemHoc: DiemHocService,
    private readonly bangKiem: BangKiemService,
  ) {}

  // ---------------- L4 (issue #17): bảng kiểm + Việc cần làm ----------------
  @Get('lop/:lopId/giai-doan/:gdId/bang-kiem')
  async bangKiemDot(
    @Param('lopId', ParseUUIDPipe) lopId: string,
    @Param('gdId', ParseUUIDPipe) gdId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.damBaoDotTrucTiep(user, lopId, gdId);
    return this.bangKiem.danhGiaDot(lopId, gdId);
  }

  @Put('lop/:lopId/giai-doan/:gdId/bang-kiem/:mucId')
  async danhDauMuc(
    @Param('lopId', ParseUUIDPipe) lopId: string,
    @Param('gdId', ParseUUIDPipe) gdId: string,
    @Param('mucId', ParseUUIDPipe) mucId: string,
    @Body() dto: DanhDauMucDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.damBaoDotTrucTiep(user, lopId, gdId);
    return this.bangKiem.danhDauThuCong(user, lopId, gdId, mucId, dto);
  }

  // Đợt trực tiếp trong phạm vi có buổi đầu từ hôm nay tới so_ngay ngày tới
  // (mặc định 21), kèm màu bảng kiểm — sắp theo buổi đầu.
  @Get('viec-can-lam')
  viecCanLam(
    @Query() query: ViecCanLamQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.dsViecCanLam(user, query.so_ngay ?? 21);
  }

  @Get('viec-can-lam/dem')
  async demViecCanLam(@CurrentUser() user: AuthenticatedUser) {
    const ds = await this.dsViecCanLam(user, 21);
    return { do: ds.filter((d) => d.mau === 'do').length };
  }

  private async dsViecCanLam(user: AuthenticatedUser, soNgay: number) {
    const bayGio = new Date();
    const cuoi = new Date(bayGio.getTime() + soNgay * MOT_NGAY_MS);
    const buoi = await this.prisma.lich_hoc_lop.findMany({
      where: {
        lop: await this.scope.whereLopTrongPhamVi(user.id),
        giai_doan: { hinh_thuc: 'truc_tiep' },
        thoi_gian_bat_dau: { gte: bayGio, lte: cuoi },
      },
      select: { lop_id: true, giai_doan_id: true },
      distinct: ['lop_id', 'giai_doan_id'],
    });
    const ds = await Promise.all(
      buoi.map(async ({ lop_id, giai_doan_id }) => {
        const dg = await this.bangKiem.danhGiaDot(lop_id, giai_doan_id, bayGio);
        return {
          lop: dg.lop,
          giai_doan: dg.giai_doan,
          buoi_dau: dg.buoi_dau,
          mau: dg.mau,
          so_qua_han: dg.muc.filter((m) => m.trang_thai === 'qua_han').length,
          so_chua_dat: dg.muc.filter((m) => m.trang_thai !== 'dat').length,
          muc_chua_dat: dg.muc
            .filter((m) => m.trang_thai !== 'dat')
            .map((m) => ({ ten: m.ten, trang_thai: m.trang_thai, han: m.han })),
        };
      }),
    );
    return ds.sort(
      (a, b) => (a.buoi_dau?.getTime() ?? 0) - (b.buoi_dau?.getTime() ?? 0),
    );
  }

  private async damBaoDotTrucTiep(
    user: AuthenticatedUser,
    lopId: string,
    gdId: string,
  ) {
    await this.scope.damBaoLopTrongPhamVi(user.id, lopId);
    const gd = await this.prisma.giai_doan_khoa.findUnique({
      where: { id: gdId },
      select: { hinh_thuc: true },
    });
    if (gd?.hinh_thuc !== 'truc_tiep') {
      throw new NotFoundAppException('Không tìm thấy đợt học trực tiếp');
    }
  }

  // ---------------- L3 (issue #16): vận hành lớp/đợt ----------------
  @Patch('lich-hoc/:id')
  suaBuoi(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SuaBuoiHoTroGvDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.vanHanh.suaBuoi(user, id, dto);
  }

  @Put('lich-hoc/:id/giang-vien')
  phanCongBuoi(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PhanCongBuoiDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.vanHanh.phanCongBuoi(user, id, dto.phan_cong);
  }

  @Put('lop/:lopId/giai-doan/:gdId/hau-can/:giangVienId')
  luuHauCan(
    @Param('lopId', ParseUUIDPipe) lopId: string,
    @Param('gdId', ParseUUIDPipe) gdId: string,
    @Param('giangVienId', ParseUUIDPipe) giangVienId: string,
    @Body() dto: LuuHauCanDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.vanHanh.luuHauCan(user, lopId, gdId, giangVienId, dto);
  }

  @Put('lop/:lopId/giai-doan/:gdId/thuc-dia')
  thayThucDia(
    @Param('lopId', ParseUUIDPipe) lopId: string,
    @Param('gdId', ParseUUIDPipe) gdId: string,
    @Body() dto: ThucDiaDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.vanHanh.thayThucDia(user, lopId, gdId, dto.nhan_su);
  }

  // Danh mục: tạo/sửa được, KHÔNG ngưng/gộp (Quản trị). Tìm trùng trước khi tạo
  // bằng chính danh sách có q (SĐT/email/tên).
  @Get('diem-hoc')
  dsDiemHoc(
    @Query() query: QueryDiemHocDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.diemHoc.findAll(query, user);
  }

  @Post('diem-hoc')
  taoDiemHoc(
    @Body() dto: CreateDiemHocDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.diemHoc.create(dto, user);
  }

  @Patch('diem-hoc/:id')
  suaDiemHoc(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDiemHocDto,
  ) {
    chanNgung(dto);
    return this.diemHoc.update(id, dto);
  }

  @Get('giang-vien')
  dsGiangVien(@Query() query: QueryGiangVienDto) {
    return this.giangVien.findAll(query);
  }

  @Post('giang-vien')
  taoGiangVien(
    @Body() dto: CreateGiangVienDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.giangVien.create(dto, user);
  }

  @Patch('giang-vien/:id')
  suaGiangVien(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateGiangVienDto,
  ) {
    chanNgung(dto);
    return this.giangVien.update(id, dto);
  }

  // Lớp trong phạm vi (hiện = mọi lớp của các khóa trong nhóm).
  @Get('lop-cua-toi')
  async lopCuaToi(@CurrentUser() user: AuthenticatedUser) {
    return this.prisma.lop_hoc.findMany({
      where: await this.scope.whereLopTrongPhamVi(user.id),
      select: {
        id: true,
        ten_lop: true,
        loai_lop: true,
        trang_thai: true,
        khoa: { select: { id: true, ma_khoa: true, ten_khoa: true } },
        _count: { select: { lich_hoc: true } },
      },
      orderBy: [
        { khoa: { ma_khoa: 'asc' } },
        { loai_lop: 'asc' },
        { ten_lop: 'asc' },
      ],
    });
  }

  // Các đợt trực tiếp của lớp (giai đoạn truc_tiep có buổi của lớp) — để mở
  // Hồ sơ chuẩn bị lớp.
  @Get('lop/:lopId/dot')
  async dotCuaLop(
    @Param('lopId', ParseUUIDPipe) lopId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.scope.damBaoLopTrongPhamVi(user.id, lopId);
    const lop = await this.prisma.lop_hoc.findUniqueOrThrow({
      where: { id: lopId },
      select: {
        id: true,
        ten_lop: true,
        loai_lop: true,
        khoa: { select: { id: true, ma_khoa: true, ten_khoa: true } },
      },
    });
    const dsGiaiDoan = await this.prisma.giai_doan_khoa.findMany({
      where: {
        khoa_id: lop.khoa.id,
        hinh_thuc: 'truc_tiep',
        lich_hoc: { some: { lop_id: lopId } },
      },
      select: {
        id: true,
        thu_tu: true,
        ten_giai_doan: true,
        thoi_gian_bat_dau: true,
        thoi_gian_ket_thuc: true,
        _count: { select: { lich_hoc: { where: { lop_id: lopId } } } },
      },
      orderBy: { thu_tu: 'asc' },
    });
    return {
      lop,
      dot: dsGiaiDoan.map(({ _count, ...gd }) => ({
        ...gd,
        so_buoi: _count.lich_hoc,
      })),
    };
  }

  // Hồ sơ chuẩn bị lớp (bản đọc) — chỉ giai đoạn trực tiếp, ngoài → 404.
  @Get('lop/:lopId/giai-doan/:gdId')
  async trangLopDot(
    @Param('lopId', ParseUUIDPipe) lopId: string,
    @Param('gdId', ParseUUIDPipe) gdId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.scope.damBaoLopTrongPhamVi(user.id, lopId);
    const gd = await this.prisma.giai_doan_khoa.findUnique({
      where: { id: gdId },
      select: { hinh_thuc: true },
    });
    if (gd?.hinh_thuc !== 'truc_tiep') {
      throw new NotFoundAppException('Không tìm thấy đợt học trực tiếp');
    }
    return this.trangLop.layTrangLop(lopId, gdId, {
      vai_tro: 'ho_tro_giang_vien',
    });
  }

  // Lịch dạy theo ngày của mọi lớp trong phạm vi (mặc định 14 ngày tới).
  @Get('lich-day')
  async lichDay(
    @Query() query: LichDayQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const { tu, den } = khoangNgayVn(query);
    return this.prisma.lich_hoc_lop.findMany({
      where: {
        lop: await this.scope.whereLopTrongPhamVi(user.id),
        thoi_gian_bat_dau: { gte: tu, lte: den },
      },
      select: {
        id: true,
        buoi_so: true,
        thoi_gian_bat_dau: true,
        thoi_gian_ket_thuc: true,
        dia_diem_hoac_link: true,
        phong: true,
        lop: {
          select: {
            id: true,
            ten_lop: true,
            loai_lop: true,
            khoa: { select: { id: true, ma_khoa: true } },
          },
        },
        giai_doan: {
          select: { id: true, ten_giai_doan: true, hinh_thuc: true },
        },
        diem_hoc: { select: { id: true, ten: true, dia_chi: true } },
        phan_cong: {
          select: {
            vai_tro: true,
            giang_vien: { select: { id: true, ho_ten: true } },
          },
          orderBy: { created_at: 'asc' },
        },
      },
      orderBy: [{ thoi_gian_bat_dau: 'asc' }, { buoi_so: 'asc' }],
      take: 500,
    });
  }
}
