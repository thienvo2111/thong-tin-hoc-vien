import { Injectable } from '@nestjs/common';
import { Prisma, dot_xac_nhan } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  ConflictAppException,
  NotFoundAppException,
  ValidationException,
} from '../common/exceptions/app.exceptions';
import { TaoDotXacNhanDto } from './dto/tao-dot-xac-nhan.dto';
import { SuaDotXacNhanDto } from './dto/sua-dot-xac-nhan.dto';
import { QueryDotXacNhanDto } from './dto/query-dot-xac-nhan.dto';

type Tx = Prisma.TransactionClient;

// Dịch vụ Đợt xác nhận — mo-rong-nls-an-giang.md mục T14. Quản lý dot_xac_nhan
// (CRUD quan_tri) + logic "đợt đang mở"/xác nhận dùng chung, được HocVienService
// gọi vào (không phụ thuộc ngược lại — giống cách ThongBaoModule không phụ
// thuộc HocVienModule, xem thong-bao.module.ts).
@Injectable()
export class DotXacNhanService {
  constructor(private readonly prisma: PrismaService) {}

  // ---------------------------------------------------------------------
  // CRUD quan_tri
  // ---------------------------------------------------------------------
  async taoDot(dto: TaoDotXacNhanDto, callerId: string): Promise<dot_xac_nhan> {
    const moLuc = new Date(dto.mo_luc);
    const dongLuc = new Date(dto.dong_luc);
    if (!(dongLuc > moLuc)) {
      throw new ValidationException('dong_luc phải sau mo_luc', [
        { field: 'dong_luc', message: 'Phải sau mo_luc' },
      ]);
    }

    const khoaId = dto.khoa_id ?? null;
    if (khoaId) {
      const khoa = await this.prisma.khoa_boi_duong.findUnique({
        where: { id: khoaId },
      });
      if (!khoa) {
        throw new NotFoundAppException('Không tìm thấy khóa bồi dưỡng');
      }
    }

    await this.kiemTraChongCheo(khoaId, moLuc, dongLuc);

    return this.prisma.dot_xac_nhan.create({
      data: {
        khoa_id: khoaId,
        ten: dto.ten,
        loai: dto.loai,
        mo_luc: moLuc,
        dong_luc: dongLuc,
        created_by: callerId,
      },
    });
  }

  async suaDot(id: string, dto: SuaDotXacNhanDto): Promise<dot_xac_nhan> {
    const existing = await this.prisma.dot_xac_nhan.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundAppException('Không tìm thấy đợt xác nhận');
    }

    const dongLucMoi = new Date(dto.dong_luc);
    if (!(dongLucMoi > existing.mo_luc)) {
      throw new ValidationException('dong_luc phải sau mo_luc', [
        { field: 'dong_luc', message: 'Phải sau mo_luc' },
      ]);
    }

    await this.kiemTraChongCheo(
      existing.khoa_id,
      existing.mo_luc,
      dongLucMoi,
      id,
    );

    return this.prisma.dot_xac_nhan.update({
      where: { id },
      data: { dong_luc: dongLucMoi },
    });
  }

  async layDanhSach(query: QueryDotXacNhanDto): Promise<dot_xac_nhan[]> {
    const where: Prisma.dot_xac_nhanWhereInput = {};
    if (query.khoa_id) where.khoa_id = query.khoa_id;
    return this.prisma.dot_xac_nhan.findMany({
      where,
      orderBy: { mo_luc: 'desc' },
    });
  }

  // Rule T14 (🔴 API): các đợt không được chồng thời gian trong CÙNG PHẠM VI
  // (cùng khoa_id — kể cả cùng NULL, coi là 1 phạm vi riêng "áp dụng toàn
  // bộ"), bất kể loại đợt — vì "đợt đang mở" (dotDangMoCuaHocVien) không phân
  // biệt loại, chồng thời gian sẽ khiến không xác định được đợt nào áp dụng.
  private async kiemTraChongCheo(
    khoaId: string | null,
    moLuc: Date,
    dongLuc: Date,
    excludeId?: string,
  ): Promise<void> {
    const existing = await this.prisma.dot_xac_nhan.findMany({
      where: {
        khoa_id: khoaId,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
    });
    const chongCheo = existing.some(
      (d) => d.mo_luc < dongLuc && d.dong_luc > moLuc,
    );
    if (chongCheo) {
      throw new ConflictAppException(
        'Đợt xác nhận chồng thời gian với đợt khác trong cùng phạm vi (khoa_id)',
      );
    }
  }

  // ---------------------------------------------------------------------
  // "Đợt đang mở" của 1 học viên — dùng bởi HocVienService cho toàn bộ quy
  // tắc T14 (PATCH/chuyên môn/xác nhận). = đợt có mo_luc <= now < dong_luc và
  // (khoa_id IS NULL hoặc học viên đã ghi danh khóa đó qua dang_ky_hoc).
  // Nhờ kiemTraChongCheo() ở trên, tối đa 1 đợt khớp trong CÙNG 1 khoa_id
  // scope — nhưng 1 đợt scope NULL (toàn cục) và 1 đợt scope khoa cụ thể vẫn
  // có thể mở đồng thời (2 phạm vi khác nhau); ưu tiên đợt scope NULL vì đó
  // là kịch bản P0 (mục 3 tài liệu: "rút gọn để kịp P0").
  // ---------------------------------------------------------------------
  async dotDangMoCuaHocVien(
    hocVienId: string,
    tx: Tx | PrismaService = this.prisma,
  ): Promise<dot_xac_nhan | null> {
    const now = new Date();
    const candidates = await tx.dot_xac_nhan.findMany({
      where: { mo_luc: { lte: now }, dong_luc: { gt: now } },
    });
    if (candidates.length === 0) return null;

    const toanCuc = candidates.find((d) => d.khoa_id === null);
    if (toanCuc) return toanCuc;

    const theoKhoa = candidates.filter((d) => d.khoa_id !== null);
    if (theoKhoa.length === 0) return null;
    const dangKy = await tx.dang_ky_hoc.findMany({
      where: {
        hoc_vien_id: hocVienId,
        khoa_id: { in: theoKhoa.map((d) => d.khoa_id as string) },
      },
      select: { khoa_id: true },
    });
    const khoaIds = new Set(dangKy.map((d) => d.khoa_id));
    return theoKhoa.find((d) => khoaIds.has(d.khoa_id as string)) ?? null;
  }

  // Đợt sắp mở gần nhất (mo_luc > now) — dùng cho GET /hoc-vien/toi/dot-xac-nhan
  // khi hiện KHÔNG có đợt nào đang mở, để học viên biết đợt tới bắt đầu khi
  // nào. Không lọc theo dang_ky_hoc (học viên đa số chưa ghi danh khóa nào ở
  // P0) — chấp nhận hiển thị cả đợt scope theo khóa mà học viên chưa chắc
  // thuộc về, chỉ mang tính thông báo, không ảnh hưởng quyền sửa.
  async dotSapMoCuaHocVien(): Promise<dot_xac_nhan | null> {
    const now = new Date();
    return this.prisma.dot_xac_nhan.findFirst({
      where: { mo_luc: { gt: now } },
      orderBy: { mo_luc: 'asc' },
    });
  }

  async coXacNhanConHieuLuc(
    dotId: string,
    hocVienId: string,
  ): Promise<boolean> {
    const found = await this.prisma.xac_nhan_ho_so.findFirst({
      where: { dot_id: dotId, hoc_vien_id: hocVienId, con_hieu_luc: true },
    });
    return found !== null;
  }

  // Vô hiệu hóa xác nhận còn hiệu lực (nếu có) cho (dot, hoc_vien) — gọi khi
  // hồ sơ bị sửa tiếp sau khi đã xác nhận (rule T14). Trả về true nếu đã hủy
  // 1 xác nhận (dùng để trả xac_nhan_bi_huy trong response).
  async huyXacNhanNeuCo(
    tx: Tx,
    dotId: string,
    hocVienId: string,
  ): Promise<boolean> {
    const result = await tx.xac_nhan_ho_so.updateMany({
      where: { dot_id: dotId, hoc_vien_id: hocVienId, con_hieu_luc: true },
      data: { con_hieu_luc: false, vo_hieu_luc_luc: new Date() },
    });
    return result.count > 0;
  }

  // Tạo xác nhận mới, tự hủy xác nhận cũ trước (idempotent — học viên bấm
  // "xác nhận" lại khi chưa sửa gì thì chỉ tạo 1 bản chụp mới, không lỗi
  // unique index uq_xac_nhan_con_hieu_luc).
  async taoXacNhan(
    tx: Tx,
    dotId: string,
    hocVienId: string,
    duLieu: Prisma.InputJsonValue,
  ) {
    await this.huyXacNhanNeuCo(tx, dotId, hocVienId);
    return tx.xac_nhan_ho_so.create({
      data: { dot_id: dotId, hoc_vien_id: hocVienId, du_lieu: duLieu },
    });
  }
}
