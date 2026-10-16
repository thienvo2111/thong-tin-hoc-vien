import { hoc_vien, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { chuanHoaMaMoet } from '../../common/utils/ma-moet.util';
import { chiaLo } from '../../common/utils/theo-lo.util';
import {
  HocVienResolverInput,
  HocVienResolverResult,
  quyetDinhHocVien,
} from './hoc-vien-resolver.util';

// Bản nạp theo lô của resolveHocVienImportRow cho file import lớn: tra toàn
// bộ mã của file bằng vài truy vấn IN/ANY, sau đó giải từng dòng trong bộ nhớ
// — cùng quyetDinhHocVien nên cùng kết quả và câu báo lỗi với bản tra từng
// dòng. Khớp mã MOET mô phỏng đúng timCacHocVienIdTheoMaMoet.
export async function napHocVienTheoLo(
  prisma: PrismaService,
  raws: HocVienResolverInput[],
): Promise<(raw: HocVienResolverInput) => Promise<HocVienResolverResult>> {
  const sdds = new Set<string>();
  const maMoets = new Set<string>();
  for (const r of raws) {
    const sdd = r.so_dinh_danh_ca_nhan?.trim();
    const ma = r.ma_dinh_danh_moet?.trim();
    if (sdd) sdds.add(sdd);
    if (ma) maMoets.add(ma);
  }

  const theoSdd = new Map<string, hoc_vien>();
  for (const lo of chiaLo([...sdds])) {
    const ds = await prisma.hoc_vien.findMany({
      where: { so_dinh_danh_ca_nhan: { in: lo } },
    });
    ds.forEach((hv) => theoSdd.set(hv.so_dinh_danh_ca_nhan as string, hv));
  }

  const ungVien: { id: string; ma_dinh_danh_moet: string }[] = [];
  for (const lo of chiaLo([...maMoets])) {
    const khoa = [...new Set(lo.map(chuanHoaMaMoet))].filter((k) => k !== '');
    ungVien.push(
      ...(await prisma.$queryRaw<{ id: string; ma_dinh_danh_moet: string }[]>(
        Prisma.sql`SELECT id, ma_dinh_danh_moet FROM "hoc_vien"
          WHERE ma_dinh_danh_moet = ANY(${lo}::text[])
             OR ltrim(ma_dinh_danh_moet, '0') = ANY(${khoa}::text[])`,
      )),
    );
  }
  const idsTheoMa = new Map<string, string[]>();
  for (const ma of maMoets) {
    const chinhXac = ungVien.filter((u) => u.ma_dinh_danh_moet === ma);
    const khoa = chuanHoaMaMoet(ma);
    const khop =
      chinhXac.length > 0
        ? chinhXac
        : khoa
          ? ungVien.filter(
              (u) => (u.ma_dinh_danh_moet ?? '').replace(/^0+/, '') === khoa,
            )
          : [];
    idsTheoMa.set(ma, [...new Set(khop.map((u) => u.id))]);
  }

  const theoId = new Map<string, hoc_vien>();
  const ids = [...new Set([...idsTheoMa.values()].flat())];
  for (const lo of chiaLo(ids)) {
    const ds = await prisma.hoc_vien.findMany({ where: { id: { in: lo } } });
    ds.forEach((hv) => theoId.set(hv.id, hv));
  }

  return (raw) =>
    quyetDinhHocVien(raw, {
      theoSdd: async (sdd) => theoSdd.get(sdd) ?? null,
      idsTheoMaMoet: async (ma) => idsTheoMa.get(ma) ?? [],
      theoId: async (id) => theoId.get(id) ?? null,
    });
}
