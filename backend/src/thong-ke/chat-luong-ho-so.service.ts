import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { buildChatLuongHoSoWorkbook } from '../bao-cao/util/report-excel.util';
import { ThongKeScopeService } from './thong-ke-scope.service';
import { ThongKeQueryDto } from './dto/thong-ke-query.dto';
import { mucThieuHoSo } from './ho-so-thieu';
import { moTaBieuMau } from './mo-ta-bieu-mau';
import {
  ChatLuongHoSoDong,
  ChatLuongHoSoResult,
  DemChatLuongHoSo,
  DongHoSoHocVien,
} from './thong-ke.types';

const demTrong = (): DemChatLuongHoSo => ({
  so_hv: 0,
  thieu_doi_tuong: 0,
  thieu_cap: 0,
  thieu_email: 0,
  thieu_sdt: 0,
  du_ho_so: 0,
  ty_le_du: null,
});

function them(d: DemChatLuongHoSo, thieu: string[]) {
  d.so_hv += 1;
  if (thieu.includes('Đối tượng')) d.thieu_doi_tuong += 1;
  if (thieu.includes('Cấp giảng dạy')) d.thieu_cap += 1;
  if (thieu.includes('Email')) d.thieu_email += 1;
  if (thieu.includes('SĐT')) d.thieu_sdt += 1;
  if (thieu.length === 0) d.du_ho_so += 1;
}

const chot = (d: DemChatLuongHoSo) => {
  d.ty_le_du = d.so_hv === 0 ? null : d.du_ho_so / d.so_hv;
};

/** Đầu vào đã khử trùng theo hoc_vien_id. */
export function tongHopChatLuongHoSo(
  rows: DongHoSoHocVien[],
): ChatLuongHoSoResult {
  const tong = demTrong();
  const truong = new Map<string, ChatLuongHoSoDong>();
  for (const r of rows) {
    const thieu = mucThieuHoSo(r);
    let t = truong.get(r.don_vi_id);
    if (!t) {
      t = {
        ...demTrong(),
        don_vi_id: r.don_vi_id,
        ten_don_vi: r.ten_don_vi,
        ten_don_vi_cha: r.ten_don_vi_cha,
      };
      truong.set(r.don_vi_id, t);
    }
    them(tong, thieu);
    them(t, thieu);
  }
  chot(tong);
  const theoTruong = [...truong.values()].sort((a, b) =>
    a.ten_don_vi.localeCompare(b.ten_don_vi, 'vi'),
  );
  theoTruong.forEach(chot);
  return { tong, theo_truong: theoTruong };
}

@Injectable()
export class ChatLuongHoSoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: ThongKeScopeService,
  ) {}

  async danhSach(
    user: AuthenticatedUser,
    q: ThongKeQueryDto,
  ): Promise<ChatLuongHoSoResult> {
    const phamVi = await this.scope.resolve(user, q);
    const rows = phamVi.rong ? [] : await this.layHocVien(phamVi.where);
    return tongHopChatLuongHoSo(rows);
  }

  async xuatExcel(
    user: AuthenticatedUser,
    q: ThongKeQueryDto,
  ): Promise<Buffer> {
    const phamVi = await this.scope.resolve(user, q);
    const rows = phamVi.rong ? [] : await this.layHocVien(phamVi.where);
    return buildChatLuongHoSoWorkbook(
      tongHopChatLuongHoSo(rows),
      rows.filter((r) => mucThieuHoSo(r).length > 0),
      await moTaBieuMau(this.prisma, q, phamVi.rong),
    );
  }

  private async layHocVien(
    where: Prisma.dang_ky_hocWhereInput,
  ): Promise<DongHoSoHocVien[]> {
    const dks = await this.prisma.dang_ky_hoc.findMany({
      where,
      select: {
        hoc_vien_id: true,
        hoc_vien: {
          select: {
            id: true,
            ho_ten: true,
            doi_tuong: true,
            cap_giang_day: true,
            email_lien_he: true,
            so_dien_thoai_lien_he: true,
            don_vi_cong_tac_id: true,
            don_vi_cong_tac: {
              select: {
                ten_don_vi: true,
                don_vi_cha: { select: { ten_don_vi: true } },
              },
            },
          },
        },
      },
    });
    const theoHv = new Map<string, DongHoSoHocVien>();
    for (const d of dks) {
      if (theoHv.has(d.hoc_vien_id)) continue;
      const h = d.hoc_vien;
      theoHv.set(d.hoc_vien_id, {
        hoc_vien_id: d.hoc_vien_id,
        ho_ten: h.ho_ten,
        doi_tuong: h.doi_tuong,
        cap_giang_day: h.cap_giang_day,
        email: h.email_lien_he,
        so_dien_thoai: h.so_dien_thoai_lien_he,
        don_vi_id: h.don_vi_cong_tac_id,
        ten_don_vi: h.don_vi_cong_tac.ten_don_vi,
        ten_don_vi_cha: h.don_vi_cong_tac.don_vi_cha?.ten_don_vi ?? null,
      });
    }
    return [...theoHv.values()];
  }
}
