import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import {
  ConflictAppException,
  NotFoundAppException,
  ValidationException,
} from '../common/exceptions/app.exceptions';
import { KhoaBoiDuongService } from '../khoa-boi-duong/khoa-boi-duong.service';
import {
  MucPhanCong,
  PhanCongGiangDayService,
} from '../giang-vien/phan-cong-giang-day.service';
import { chuanHoaSoDienThoai } from '../giang-vien/lien-he.util';
import { HoTroGiangVienScopeService } from './ho-tro-giang-vien-scope.service';
import {
  LuuHauCanDto,
  SuaBuoiHoTroGvDto,
  ThucDiaMucDto,
} from './dto/van-hanh-lop.dto';

// ADR 0004 G4/G5/G12 (issue #16): vận hành lớp/đợt của người hỗ trợ giảng
// viên. Tái dùng luật đã có (KhoaBoiDuongService.capNhatLichHoc,
// PhanCongGiangDayService) — ở đây chỉ thêm phạm vi + ràng buộc riêng.
@Injectable()
export class VanHanhLopService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: HoTroGiangVienScopeService,
    private readonly khoaBoiDuong: KhoaBoiDuongService,
    private readonly phanCong: PhanCongGiangDayService,
  ) {}

  private async layBuoiTrongPhamVi(user: AuthenticatedUser, lichHocId: string) {
    const lich = await this.prisma.lich_hoc_lop.findUnique({
      where: { id: lichHocId },
    });
    if (!lich) throw new NotFoundAppException('Không tìm thấy buổi học');
    await this.scope.damBaoLopTrongPhamVi(user.id, lich.lop_id);
    return lich;
  }

  // Đợt (lớp × giai đoạn trực tiếp cùng khóa) trong phạm vi.
  private async damBaoDot(user: AuthenticatedUser, lopId: string, gdId: string) {
    await this.scope.damBaoLopTrongPhamVi(user.id, lopId);
    const co = await this.prisma.giai_doan_khoa.count({
      where: { id: gdId, hinh_thuc: 'truc_tiep', khoa: { lop_hoc: { some: { id: lopId } } } },
    });
    if (!co) throw new NotFoundAppException('Không tìm thấy đợt học trực tiếp');
  }

  // Sửa giờ/điểm học/phòng: chỉ buổi CHƯA diễn ra và CHƯA có điểm danh.
  async suaBuoi(user: AuthenticatedUser, lichHocId: string, dto: SuaBuoiHoTroGvDto) {
    const lich = await this.layBuoiTrongPhamVi(user, lichHocId);
    if (lich.thoi_gian_bat_dau <= new Date()) {
      throw new ValidationException('Buổi học đã hoặc đang diễn ra — không sửa được', [
        { field: 'thoi_gian_bat_dau', message: 'Buổi đã diễn ra' },
      ]);
    }
    const daDiemDanh = await this.prisma.diem_danh.count({
      where: { lich_hoc_id: lichHocId },
    });
    if (daDiemDanh > 0) {
      throw new ValidationException('Buổi học đã có điểm danh — không sửa được');
    }
    return this.khoaBoiDuong.capNhatLichHoc(
      lich.lop_id,
      lichHocId,
      {
        thoi_gian_bat_dau: dto.thoi_gian_bat_dau,
        thoi_gian_ket_thuc: dto.thoi_gian_ket_thuc,
        diem_hoc_id: dto.diem_hoc_id,
        phong: dto.phong,
        ly_do: dto.ly_do.trim(),
      },
      user,
    );
  }

  async phanCongBuoi(user: AuthenticatedUser, lichHocId: string, ds: MucPhanCong[]) {
    await this.layBuoiTrongPhamVi(user, lichHocId);
    return this.phanCong.thayPhanCongBuoi(lichHocId, ds);
  }

  // Hậu cần 1 giảng viên của đợt — giảng viên phải có phân công trong đợt.
  async luuHauCan(
    user: AuthenticatedUser,
    lopId: string,
    gdId: string,
    giangVienId: string,
    dto: LuuHauCanDto,
  ) {
    await this.damBaoDot(user, lopId, gdId);
    const coPhanCong = await this.prisma.phan_cong_giang_day.count({
      where: {
        giang_vien_id: giangVienId,
        lich_hoc: { lop_id: lopId, giai_doan_id: gdId },
      },
    });
    if (!coPhanCong) {
      throw new ValidationException('Giảng viên chưa được phân công buổi nào trong đợt này');
    }
    if (dto.nhan_phong && dto.tra_phong && dto.tra_phong < dto.nhan_phong) {
      throw new ValidationException('Ngày trả phòng phải sau ngày nhận phòng', [
        { field: 'tra_phong', message: 'Trước ngày nhận phòng' },
      ]);
    }
    const { cap_nhat_luc: daDoc, ...truong } = dto;
    const data: Prisma.hau_can_giang_vienUncheckedUpdateInput = {
      ...truong,
      nhan_phong: dto.nhan_phong === undefined ? undefined : dto.nhan_phong ? new Date(dto.nhan_phong) : null,
      tra_phong: dto.tra_phong === undefined ? undefined : dto.tra_phong ? new Date(dto.tra_phong) : null,
      don_luc: dto.don_luc === undefined ? undefined : dto.don_luc ? new Date(dto.don_luc) : null,
      cap_nhat_boi: user.id,
      cap_nhat_luc: new Date(),
    };
    const khoa = { lop_id: lopId, giai_doan_id: gdId, giang_vien_id: giangVienId };
    const cu = await this.prisma.hau_can_giang_vien.findUnique({
      where: { lop_id_giai_doan_id_giang_vien_id: khoa },
    });
    if (!cu) {
      try {
        return await this.prisma.hau_can_giang_vien.create({
          data: { ...khoa, ...(data as Prisma.hau_can_giang_vienUncheckedCreateInput) },
        });
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
          throw new ConflictAppException('Người khác vừa nhập hậu cần này — tải lại để xem');
        }
        throw e;
      }
    }
    // Khóa lạc quan: chỉ ghi khi chưa ai sửa từ lúc người này đọc.
    const kq = await this.prisma.hau_can_giang_vien.updateMany({
      where: {
        id: cu.id,
        cap_nhat_luc: daDoc ? new Date(daDoc) : new Date(0),
      },
      data,
    });
    if (kq.count === 0) {
      throw new ConflictAppException('Người khác vừa sửa hậu cần này — tải lại để xem bản mới');
    }
    return this.prisma.hau_can_giang_vien.findUniqueOrThrow({ where: { id: cu.id } });
  }

  async thayThucDia(user: AuthenticatedUser, lopId: string, gdId: string, ds: ThucDiaMucDto[]) {
    await this.damBaoDot(user, lopId, gdId);
    const dong = ds.map((n, i) => {
      const sdt = chuanHoaSoDienThoai(n.so_dien_thoai);
      if (!sdt) {
        throw new ValidationException(`Số điện thoại dòng ${i + 1} sai định dạng`, [
          { field: 'nhan_su', message: 'SĐT sai định dạng' },
        ]);
      }
      return {
        lop_id: lopId,
        giai_doan_id: gdId,
        ho_ten: n.ho_ten.trim(),
        so_dien_thoai: sdt,
        nhiem_vu: n.nhiem_vu?.trim() || null,
        ghi_chu: n.ghi_chu?.trim() || null,
      };
    });
    await this.prisma.$transaction([
      this.prisma.nhan_su_thuc_dia.deleteMany({ where: { lop_id: lopId, giai_doan_id: gdId } }),
      this.prisma.nhan_su_thuc_dia.createMany({ data: dong }),
    ]);
    return this.prisma.nhan_su_thuc_dia.findMany({
      where: { lop_id: lopId, giai_doan_id: gdId },
      orderBy: { created_at: 'asc' },
    });
  }
}
