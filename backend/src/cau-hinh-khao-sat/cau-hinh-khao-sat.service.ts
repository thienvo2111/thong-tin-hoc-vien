import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ValidationException } from '../common/exceptions/app.exceptions';
import { CauHinhKhaoSatDto } from './dto/cau-hinh-khao-sat.dto';

export const KHOA_CAU_HINH_KHAO_SAT = 'khao_sat_dau_vao';

export interface CauHinhKhaoSat {
  che_do_hoc_vien: CauHinhKhaoSatDto['che_do_hoc_vien'];
  danh_gia_dau_vao_trong_cong: boolean;
  hien_khao_sat: boolean;
  phieu: {
    ten: string;
    mo_ta: string;
    lien_ket: { nhan: string; url: string }[];
  }[];
}

export interface KetQuaCauHinhKhaoSat {
  /** null = quản trị chưa lưu lần nào — frontend dùng giá trị mặc định trong mã nguồn. */
  cau_hinh: CauHinhKhaoSat | null;
  cap_nhat_luc: Date | null;
}

@Injectable()
export class CauHinhKhaoSatService {
  constructor(private readonly prisma: PrismaService) {}

  async layCauHinh(): Promise<KetQuaCauHinhKhaoSat> {
    const row = await this.prisma.cau_hinh_he_thong.findUnique({
      where: { khoa: KHOA_CAU_HINH_KHAO_SAT },
    });
    return {
      cau_hinh: (row?.gia_tri as unknown as CauHinhKhaoSat) ?? null,
      cap_nhat_luc: row?.cap_nhat_luc ?? null,
    };
  }

  async luuCauHinh(
    dto: CauHinhKhaoSatDto,
    nguoiCapNhatId: string,
  ): Promise<KetQuaCauHinhKhaoSat> {
    // Chế độ khảo sát mà ẩn khối khảo sát thì học viên không có chỗ nào để làm.
    if (dto.che_do_hoc_vien === 'khao_sat' && !dto.hien_khao_sat) {
      throw new ValidationException(
        'Chế độ "Khảo sát" cần bật hiển thị khối khảo sát trên trang chủ',
        [
          {
            field: 'hien_khao_sat',
            message: 'Phải bật khi chế độ là Khảo sát',
          },
        ],
      );
    }
    if (dto.hien_khao_sat && dto.phieu.length === 0) {
      throw new ValidationException('Cần ít nhất 1 phiếu khảo sát', [
        { field: 'phieu', message: 'Cần ít nhất 1 phiếu khi bật hiển thị' },
      ]);
    }

    const giaTri: CauHinhKhaoSat = {
      che_do_hoc_vien: dto.che_do_hoc_vien,
      danh_gia_dau_vao_trong_cong: dto.danh_gia_dau_vao_trong_cong,
      hien_khao_sat: dto.hien_khao_sat,
      phieu: dto.phieu.map((p) => ({
        ten: p.ten.trim(),
        mo_ta: p.mo_ta.trim(),
        lien_ket: p.lien_ket.map((lk) => ({
          nhan: lk.nhan.trim(),
          url: lk.url.trim(),
        })),
      })),
    };
    const now = new Date();
    const row = await this.prisma.cau_hinh_he_thong.upsert({
      where: { khoa: KHOA_CAU_HINH_KHAO_SAT },
      create: {
        khoa: KHOA_CAU_HINH_KHAO_SAT,
        gia_tri: giaTri as object,
        cap_nhat_luc: now,
        cap_nhat_boi: nguoiCapNhatId,
      },
      update: {
        gia_tri: giaTri as object,
        cap_nhat_luc: now,
        cap_nhat_boi: nguoiCapNhatId,
      },
    });
    return { cau_hinh: giaTri, cap_nhat_luc: row.cap_nhat_luc };
  }
}
