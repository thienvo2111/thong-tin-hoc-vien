import { PrismaService } from '../prisma/prisma.service';
import { DOI_TUONG_LABEL } from '../thong-bao/mau-email/mau-email';
import { ThongKeQueryDto } from './dto/thong-ke-query.dto';
import { donViLoc } from './thong-ke-scope.service';
import { MoTaBieuMau } from './thong-ke.types';

/** Mô tả bộ lọc cho tiêu đề biểu mẫu Excel. Phạm vi rỗng: id chưa được kiểm quyền, không tra cứu tên. */
export async function moTaBieuMau(
  prisma: PrismaService,
  q: ThongKeQueryDto,
  rong: boolean,
): Promise<MoTaBieuMau> {
  const donViIds = donViLoc(q);
  const [khoa, donVi, nhieuDonVi, cum] = await Promise.all([
    !rong && q.khoa_id
      ? prisma.khoa_boi_duong.findUnique({
          where: { id: q.khoa_id },
          select: { ten_khoa: true },
        })
      : null,
    !rong && donViIds.length === 1
      ? prisma.don_vi_cong_tac.findUnique({
          where: { id: donViIds[0] },
          select: { ten_don_vi: true },
        })
      : null,
    !rong && donViIds.length > 1
      ? prisma.don_vi_cong_tac.findMany({
          where: { id: { in: donViIds } },
          select: { ten_don_vi: true },
          orderBy: { ten_don_vi: 'asc' },
        })
      : [],
    !rong && q.cum_id
      ? prisma.cum_hoc_vien.findUnique({
          where: { id: q.cum_id },
          select: { ten_cum: true },
        })
      : null,
  ]);
  let phamVi = 'Toàn bộ phạm vi tài khoản';
  if (donVi) phamVi = `Đơn vị ${donVi.ten_don_vi}`;
  if (nhieuDonVi.length) {
    const ten = nhieuDonVi.map((d) => d.ten_don_vi).join('; ');
    phamVi = `${nhieuDonVi.length} đơn vị: ${ten}`;
  }
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
