import { PrismaService } from '../prisma/prisma.service';
import { DOI_TUONG_LABEL } from '../thong-bao/mau-email/mau-email';
import { ThongKeQueryDto } from './dto/thong-ke-query.dto';
import { MoTaBieuMau } from './thong-ke.types';

/** Mô tả bộ lọc cho tiêu đề biểu mẫu Excel. Phạm vi rỗng: id chưa được kiểm quyền, không tra cứu tên. */
export async function moTaBieuMau(
  prisma: PrismaService,
  q: ThongKeQueryDto,
  rong: boolean,
): Promise<MoTaBieuMau> {
  const [khoa, donVi, cum] = await Promise.all([
    !rong && q.khoa_id
      ? prisma.khoa_boi_duong.findUnique({
          where: { id: q.khoa_id },
          select: { ten_khoa: true },
        })
      : null,
    !rong && q.don_vi_id
      ? prisma.don_vi_cong_tac.findUnique({
          where: { id: q.don_vi_id },
          select: { ten_don_vi: true },
        })
      : null,
    !rong && q.cum_id
      ? prisma.cum_hoc_vien.findUnique({
          where: { id: q.cum_id },
          select: { ten_cum: true },
        })
      : null,
  ]);
  let phamVi = 'Toàn bộ phạm vi tài khoản';
  if (donVi) phamVi = `Đơn vị ${donVi.ten_don_vi}`;
  if (cum) phamVi = `Cụm ${cum.ten_cum}`;
  let doiTuong = 'Tất cả đối tượng';
  if (q.doi_tuong) {
    doiTuong =
      q.doi_tuong === 'chua_xac_dinh'
        ? 'Chưa xác định'
        : DOI_TUONG_LABEL[q.doi_tuong];
  }
  return {
    khoa: khoa?.ten_khoa ?? 'Tất cả khóa',
    pham_vi: phamVi,
    doi_tuong: doiTuong,
    ngay_xuat: new Date(),
  };
}
