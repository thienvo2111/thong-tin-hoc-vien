import { Injectable } from '@nestjs/common';
import { Prisma, giang_vien } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { paginate } from '../common/dto/pagination-query.dto';
import { normalizeNfcName } from '../common/utils/normalize-text.util';
import {
  ConflictAppException,
  NotFoundAppException,
  ValidationException,
} from '../common/exceptions/app.exceptions';
import {
  CreateGiangVienDto,
  LichDayQueryDto,
  QueryGiangVienDto,
  UpdateGiangVienDto,
  XacNhanGioDto,
} from './dto/giang-vien.dto';
import { chuanHoaEmail, chuanHoaSoDienThoai } from './lien-he.util';

// T11 (issue #3): danh mục giảng viên — dữ liệu cá nhân, chỉ quan_tri (người
// hỗ trợ giảng viên thêm ở L3, ADR 0004 G12).
@Injectable()
export class GiangVienService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: QueryGiangVienDto) {
    const page = query.page ?? 1;
    const pageSize = query.page_size ?? 20;
    const dieuKien: Prisma.giang_vienWhereInput[] = [];
    if (query.trang_thai) dieuKien.push({ trang_thai: query.trang_thai });
    if (query.khoa_id) {
      dieuKien.push({
        phan_cong: { some: { lich_hoc: { lop: { khoa_id: query.khoa_id } } } },
      });
    }
    const q = query.q?.trim();
    if (q) {
      dieuKien.push({
        OR: [
          { ho_ten: { contains: q, mode: 'insensitive' } },
          { so_dien_thoai: { contains: q } },
          { email: { contains: q, mode: 'insensitive' } },
          { don_vi_cong_tac: { contains: q, mode: 'insensitive' } },
        ],
      });
    }
    const where: Prisma.giang_vienWhereInput = { AND: dieuKien };
    const [data, total] = await Promise.all([
      this.prisma.giang_vien.findMany({
        where,
        include: {
          _count: { select: { phan_cong: true } },
          // ADR 0004 G8 (issue #20): trạng thái tài khoản cổng giảng viên.
          tai_khoan: {
            select: {
              ten_dang_nhap: true,
              trang_thai: true,
              phai_doi_mat_khau: true,
              dang_nhap_lan_cuoi: true,
            },
          },
        },
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: [{ trang_thai: 'asc' }, { ho_ten: 'asc' }],
      }),
      this.prisma.giang_vien.count({ where }),
    ]);
    return paginate(
      data.map(({ _count, ...gv }) => ({ ...gv, so_buoi: _count.phan_cong })),
      total,
      page,
      pageSize,
    );
  }

  async create(dto: CreateGiangVienDto, caller: AuthenticatedUser) {
    const lienHe = await this.chuanHoaVaKiemTraLienHe(
      dto.so_dien_thoai,
      dto.email,
    );
    return this.prisma.giang_vien.create({
      data: {
        ho_ten: normalizeNfcName(dto.ho_ten),
        so_dien_thoai: lienHe.so_dien_thoai,
        email: lienHe.email,
        don_vi_cong_tac: dto.don_vi_cong_tac?.trim() || undefined,
        ghi_chu: dto.ghi_chu?.trim() || undefined,
        tao_boi: caller.id,
      },
    });
  }

  async update(id: string, dto: UpdateGiangVienDto): Promise<giang_vien> {
    const cu = await this.prisma.giang_vien.findUnique({ where: { id } });
    if (!cu) throw new NotFoundAppException('Không tìm thấy giảng viên');
    if (!Object.values(dto).some((v) => v !== undefined)) {
      throw new ValidationException(
        'Body rỗng — phải có ít nhất 1 trường hợp lệ để sửa',
      );
    }
    let soDienThoai: string | undefined;
    let email: string | null | undefined;
    if (dto.so_dien_thoai !== undefined || dto.email !== undefined) {
      const lienHe = await this.chuanHoaVaKiemTraLienHe(
        dto.so_dien_thoai ?? cu.so_dien_thoai,
        dto.email === undefined
          ? (cu.email ?? undefined)
          : (dto.email ?? undefined),
        id,
      );
      soDienThoai = lienHe.so_dien_thoai;
      email = dto.email === null ? null : lienHe.email;
    }
    return this.prisma.giang_vien.update({
      where: { id },
      data: {
        ho_ten:
          dto.ho_ten !== undefined ? normalizeNfcName(dto.ho_ten) : undefined,
        so_dien_thoai: soDienThoai,
        email,
        don_vi_cong_tac: dto.don_vi_cong_tac,
        ghi_chu: dto.ghi_chu,
        trang_thai: dto.trang_thai,
      },
    });
  }

  // GET /giang-vien/{id}/lich-day — mọi buổi được phân công, sắp theo giờ.
  async lichDay(id: string, query: LichDayQueryDto) {
    const gv = await this.prisma.giang_vien.findUnique({ where: { id } });
    if (!gv) throw new NotFoundAppException('Không tìm thấy giảng viên');
    const khoang: Prisma.DateTimeFilter = {};
    if (query.tu_ngay) khoang.gte = new Date(query.tu_ngay);
    if (query.den_ngay) khoang.lte = new Date(query.den_ngay);
    const dsPhanCong = await this.prisma.phan_cong_giang_day.findMany({
      where: {
        giang_vien_id: id,
        ...(query.tu_ngay || query.den_ngay
          ? { lich_hoc: { thoi_gian_bat_dau: khoang } }
          : {}),
      },
      include: {
        lich_hoc: {
          include: {
            giai_doan: {
              select: { id: true, ten_giai_doan: true, hinh_thuc: true },
            },
            lop: {
              select: {
                id: true,
                ten_lop: true,
                loai_lop: true,
                khoa: { select: { id: true, ma_khoa: true, ten_khoa: true } },
              },
            },
            diem_hoc: { select: { id: true, ten: true, dia_chi: true } },
          },
        },
      },
      orderBy: { lich_hoc: { thoi_gian_bat_dau: 'asc' } },
    });
    return { giang_vien: gv, phan_cong: dsPhanCong };
  }

  // PATCH /giang-vien/phan-cong/{id}/xac-nhan-gio — chốt/bỏ chốt giờ dạy.
  async xacNhanGio(
    phanCongId: string,
    dto: XacNhanGioDto,
    caller: AuthenticatedUser,
  ) {
    const pc = await this.prisma.phan_cong_giang_day.findUnique({
      where: { id: phanCongId },
    });
    if (!pc) throw new NotFoundAppException('Không tìm thấy phân công');
    const soGio = dto.so_gio ?? (pc.so_gio == null ? null : Number(pc.so_gio));
    if (dto.da_xac_nhan_gio && soGio == null) {
      throw new ValidationException('Chưa có số giờ để xác nhận', [
        { field: 'so_gio', message: 'Bắt buộc khi xác nhận giờ' },
      ]);
    }
    return this.prisma.phan_cong_giang_day.update({
      where: { id: phanCongId },
      data: dto.da_xac_nhan_gio
        ? {
            so_gio: soGio ?? undefined,
            da_xac_nhan_gio: true,
            xac_nhan_luc: new Date(),
            nguoi_xac_nhan_id: caller.id,
          }
        : {
            da_xac_nhan_gio: false,
            xac_nhan_luc: null,
            nguoi_xac_nhan_id: null,
          },
    });
  }

  /**
   * Chuẩn hóa + kiểm tra định dạng/trùng SĐT, email — dùng chung nhập tay và
   * import. boQuaId: chính giảng viên đang sửa.
   */
  async chuanHoaVaKiemTraLienHe(
    sdtRaw: string,
    emailRaw: string | undefined,
    boQuaId?: string,
  ): Promise<{ so_dien_thoai: string; email: string | undefined }> {
    const soDienThoai = chuanHoaSoDienThoai(sdtRaw);
    if (!soDienThoai) {
      throw new ValidationException('Số điện thoại không đúng định dạng', [
        {
          field: 'so_dien_thoai',
          message: 'Phải là 10 số đầu 0, hoặc +84...',
        },
      ]);
    }
    const email = chuanHoaEmail(emailRaw);
    if (email === null) {
      throw new ValidationException('Email không đúng định dạng', [
        { field: 'email', message: 'Email không đúng định dạng' },
      ]);
    }
    const trung = await this.prisma.giang_vien.findFirst({
      where: {
        id: boQuaId ? { not: boQuaId } : undefined,
        OR: [{ so_dien_thoai: soDienThoai }, ...(email ? [{ email }] : [])],
      },
    });
    if (trung) {
      const truong =
        trung.so_dien_thoai === soDienThoai ? 'so_dien_thoai' : 'email';
      throw new ConflictAppException(
        `${truong === 'email' ? 'Email' : 'Số điện thoại'} đã dùng cho giảng viên "${trung.ho_ten}"`,
        [{ field: truong, message: 'Đã tồn tại' }],
      );
    }
    return { so_dien_thoai: soDienThoai, email };
  }
}
