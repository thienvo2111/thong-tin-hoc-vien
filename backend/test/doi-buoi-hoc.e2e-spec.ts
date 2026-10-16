import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import * as bcrypt from 'bcryptjs';
import { createTestApp } from './utils/test-app';
import { TrangLopService } from '../src/trang-lop/trang-lop.service';
import { KhoaBoiDuongService } from '../src/khoa-boi-duong/khoa-boi-duong.service';
import { DoiBuoiHocQueryService } from '../src/doi-buoi-hoc/doi-buoi-hoc-query.service';
import {
  prisma,
  taoDonViTest,
  uniqueSuffix,
  xoaNguoiDungTest,
  xoaDonViTest,
} from './utils/test-data';

const GIO = 3600 * 1000;
const NGAY = 24 * GIO;
const MAT_KHAU = 'MatKhau123';

// ADR 0007: học viên đề nghị đổi buổi học; hỗ trợ cụm duyệt. Lớp B có
// P = 1 học viên được phân, si_so_toi_da = P + 2 = 3.
describe('Đổi buổi học (e2e)', () => {
  let app: INestApplication;
  const suf = uniqueSuffix();
  let dv: Awaited<ReturnType<typeof taoDonViTest>>;
  const nguoiDungIds: string[] = [];
  const hocVienIds: string[] = [];
  let khoaId: string;
  let maKhoa: string;
  let gdId: string;
  const buoi: Record<'a' | 'b' | 'd' | 'e' | 'x' | 'f' | 'g' | 'h', string> = {
    a: '',
    b: '',
    d: '',
    e: '',
    x: '',
    f: '',
    g: '',
    h: '',
  };
  const lop: Record<'a' | 'b', string> = { a: '', b: '' };
  const hv: Record<string, { id: string; dk: string; moet: string }> = {};
  const tk: Record<string, string> = {};
  const deNghi: Record<string, string> = {};

  const http = () => request(app.getHttpServer());
  const auth = (ai: string) => ({ Authorization: `Bearer ${tk[ai]}` });

  async function dangNhap(tenDangNhap: string): Promise<string> {
    const res = await http()
      .post('/auth/dang-nhap')
      .send({ ten_dang_nhap: tenDangNhap, mat_khau: MAT_KHAU })
      .expect(200);
    return res.body.token;
  }

  async function taoHoTro() {
    const nd = await prisma.nguoi_dung.create({
      data: {
        ho_ten: 'ND ho tro',
        ten_dang_nhap: `dbh-ht-${suf}`.toLowerCase(),
        email: `dbh-ht-${suf}@x.vn`.toLowerCase(),
        vai_tro: 'ho_tro_hoc_vien',
        mat_khau_hash: await bcrypt.hash(MAT_KHAU, 4),
        phai_doi_mat_khau: false,
      },
    });
    nguoiDungIds.push(nd.id);
    tk.ht = await dangNhap(nd.ten_dang_nhap);
    return nd;
  }

  async function taoHocVien(
    ma: string,
    cumId: string,
    gdId: string,
    lopId: string,
    coTaiKhoan: boolean,
  ) {
    const moet = `DB${ma}${suf}`.slice(0, 20);
    const h = await prisma.hoc_vien.create({
      data: {
        nguon_tao: 'import_moet',
        ma_dinh_danh_moet: moet,
        ho_ten: `HV ${ma}`,
        ngay_sinh: 1,
        thang_sinh: 1,
        nam_sinh: 1990,
        don_vi_cong_tac_id: dv.donVi.id,
        trang_thai: 'nhap',
      },
    });
    hocVienIds.push(h.id);
    const dk = await prisma.dang_ky_hoc.create({
      data: {
        hoc_vien_id: h.id,
        khoa_id: khoaId,
        trang_thai: 'da_duyet',
        cum_id: cumId,
      },
    });
    await prisma.phan_lop_giai_doan.create({
      data: { dang_ky_hoc_id: dk.id, giai_doan_id: gdId, lop_id: lopId },
    });
    hv[ma] = { id: h.id, dk: dk.id, moet };
    if (!coTaiKhoan) return;
    const nd = await prisma.nguoi_dung.create({
      data: {
        ho_ten: h.ho_ten,
        ten_dang_nhap: `dbh-${ma}-${suf}`.toLowerCase(),
        vai_tro: 'hoc_vien',
        hoc_vien_id: h.id,
        mat_khau_hash: await bcrypt.hash(MAT_KHAU, 4),
        phai_doi_mat_khau: false,
      },
    });
    nguoiDungIds.push(nd.id);
    tk[ma] = await dangNhap(nd.ten_dang_nhap);
  }

  const gui = (ai: string) =>
    http().post('/hoc-vien/toi/doi-buoi').set(auth(ai)).send({
      lich_nguon_id: buoi.a,
      lich_de_nghi_id: buoi.b,
      ly_do: 'Trùng lịch công tác',
    });
  const duyet = (id: string) =>
    http().post(`/doi-buoi-hoc/${id}/duyet`).set(auth('ht')).send({});

  beforeAll(async () => {
    app = await createTestApp({ raiseThrottlerLimit: true });
    dv = await taoDonViTest('dbh');
    maKhoa = `DBH-${suf}`.slice(0, 30);
    khoaId = (
      await prisma.khoa_boi_duong.create({
        data: {
          ma_khoa: maKhoa,
          ten_khoa: 'Khóa đổi buổi',
          don_vi_dat_hang_id: dv.donVi.id,
          thoi_gian_bat_dau: new Date('2026-01-01'),
          thoi_gian_ket_thuc: new Date('2027-12-31'),
          trang_thai: 'da_duyet',
          so_buoi_doi_toi_da: 2,
        },
      })
    ).id;
    gdId = (
      await prisma.giai_doan_khoa.create({
        data: {
          khoa_id: khoaId,
          thu_tu: 1,
          ten_giai_doan: 'Trực tiếp',
          hinh_thuc: 'truc_tiep',
          thoi_gian_bat_dau: new Date('2026-01-01'),
          thoi_gian_ket_thuc: new Date('2027-12-31'),
        },
      })
    ).id;
    const taoLop = async (ten: string, siSo?: number) => {
      const lop = await prisma.lop_hoc.create({
        data: {
          khoa_id: khoaId,
          loai_lop: 'truc_tiep',
          muc_nang_luc: 'co_ban',
          trang_thai: 'active',
          ten_lop: ten,
          si_so_toi_da: siSo,
        },
      });
      const bd = new Date(Date.now() + 2 * NGAY);
      const lich = await prisma.lich_hoc_lop.create({
        data: {
          lop_id: lop.id,
          giai_doan_id: gdId,
          buoi_so: 1,
          thoi_gian_bat_dau: bd,
          thoi_gian_ket_thuc: new Date(bd.getTime() + 3 * GIO),
        },
      });
      return { lopId: lop.id, lichId: lich.id };
    };
    const a = await taoLop('Lớp A');
    const b = await taoLop('Lớp B', 3);
    buoi.a = a.lichId;
    buoi.b = b.lichId;
    lop.a = a.lopId;
    lop.b = b.lopId;

    const cum = await prisma.cum_hoc_vien.create({
      data: { khoa_id: khoaId, ten_cum: 'Cụm DBH' },
    });
    for (const ma of ['hv1', 'hv2', 'hv3'])
      await taoHocVien(ma, cum.id, gdId, a.lopId, true);
    await taoHocVien('p1', cum.id, gdId, b.lopId, false);

    // (d) chứng minh advisory lock: lớp D còn đúng 1 chỗ (1/2), lớp X không
    // giới hạn; HV4, HV5 ở lớp E (tách khỏi lớp A để không đổi số đếm (a)).
    const d = await taoLop('Lớp D', 2);
    const e = await taoLop('Lớp E');
    const x = await taoLop('Lớp X');
    buoi.d = d.lichId;
    buoi.e = e.lichId;
    buoi.x = x.lichId;
    await taoHocVien('p2', cum.id, gdId, d.lopId, false);
    for (const ma of ['hv4', 'hv5'])
      await taoHocVien(ma, cum.id, gdId, e.lopId, true);

    // (e) đổi lại (D11): HV6 ở lớp F; G, H là 2 buổi tương đương riêng.
    const f = await taoLop('Lớp F');
    const g = await taoLop('Lớp G', 10);
    const h = await taoLop('Lớp H', 10);
    buoi.f = f.lichId;
    buoi.g = g.lichId;
    buoi.h = h.lichId;
    await taoHocVien('hv6', cum.id, gdId, f.lopId, true);
    const ht = await taoHoTro();
    await prisma.phan_cong_ho_tro.create({
      data: { nguoi_dung_id: ht.id, cum_id: cum.id },
    });
  });

  // Mỗi bước độc lập và chỉ chạy khi id đã có: deleteMany với id undefined
  // trong Prisma KHÔNG có bộ lọc và sẽ xóa sạch bảng dev.
  afterAll(async () => {
    const buoc = async (fn: () => Promise<unknown>) => {
      try {
        await fn();
      } catch (e) {
        console.error('Dọn dữ liệu e2e đổi buổi lỗi:', e);
      }
    };
    if (khoaId) {
      await buoc(() =>
        prisma.dang_ky_hoc.deleteMany({ where: { khoa_id: khoaId } }),
      );
      await buoc(() =>
        prisma.khoa_boi_duong.deleteMany({ where: { id: khoaId } }),
      );
    }
    for (const id of nguoiDungIds) await buoc(() => xoaNguoiDungTest(id));
    if (hocVienIds.length)
      await buoc(() =>
        prisma.hoc_vien.deleteMany({ where: { id: { in: hocVienIds } } }),
      );
    if (dv)
      await buoc(() =>
        xoaDonViTest([dv.donVi.id], [dv.diaDanhXa.id, dv.diaDanhTinh.id]),
      );
    await buoc(() => prisma.$disconnect());
    if (app) await buoc(() => app.close());
  });

  it('(a) HV1 gửi đề nghị → hỗ trợ cụm duyệt khi buổi B còn chỗ', async () => {
    const res = await gui('hv1').expect(201);
    expect(res.body.id).toBeDefined();
    deNghi.hv1 = res.body.id;
    await duyet(deNghi.hv1).expect(200);
    const dong = await prisma.doi_buoi_hoc.findUniqueOrThrow({
      where: { id: deNghi.hv1 },
    });
    expect(dong.trang_thai).toBe('da_duyet');
  });

  it('(a) trang lớp B buổi 1 có HV1 với nhãn "Từ lớp A"; lớp A ghi đổi ra', async () => {
    const trangLop = app.get(TrangLopService);
    const b = await trangLop.layTrangLop(lop.b, gdId, { vai_tro: 'quan_tri' });
    // Danh sách lớp gốc không đổi (P = 1); người đổi vào ở danh sách riêng.
    expect(b.hoc_vien.map((h) => h.dang_ky_hoc_id)).toEqual([hv.p1.dk]);
    const hv1 = b.hoc_vien_doi_vao.find((h) => h.dang_ky_hoc_id === hv.hv1.dk);
    expect(hv1?.doi_buoi).toEqual({ [buoi.b]: { loai: 'vao', lop: 'Lớp A' } });
    expect(b.buoi[0]).toMatchObject({ id: buoi.b, si_so: 2 });

    const a = await trangLop.layTrangLop(lop.a, gdId, { vai_tro: 'quan_tri' });
    const hv1A = a.hoc_vien.find((h) => h.dang_ky_hoc_id === hv.hv1.dk);
    expect(hv1A?.doi_buoi).toEqual({ [buoi.a]: { loai: 'ra', lop: 'Lớp B' } });
    expect(a.hoc_vien).toHaveLength(3);
    expect(a.hoc_vien_doi_vao).toEqual([]);
  });

  it('(a) nạp điểm danh HV1 ở buổi B không ghi_chu → không lỗi, không cảnh báo học bù', async () => {
    const kq = await app.get(KhoaBoiDuongService).resolveDiemDanhRow({
      ma_dinh_danh_moet: hv.hv1.moet,
      ma_khoa: maKhoa,
      ten_lop: 'Lớp B',
      loai_lop: 'truc_tiep',
      giai_doan_thu_tu: '1',
      buoi_so: '1',
      trang_thai: 'co_mat',
      nguon: 'ky_ten',
    });
    expect(kq.error).toBeUndefined();
    expect(kq.canhBao).toBeUndefined();
    expect(kq.dto).toMatchObject({
      dang_ky_hoc_id: hv.hv1.dk,
      lich_hoc_id: buoi.b,
    });
  });

  it('(b) duyệt theo thứ tự gửi: HV3 bị giữ chỗ cho HV2; duyệt song song → đúng 1 thành công, 1 xung đột', async () => {
    deNghi.hv2 = (await gui('hv2').expect(201)).body.id;
    deNghi.hv3 = (await gui('hv3').expect(201)).body.id;
    await duyet(deNghi.hv3).expect(409);

    const [r2, r3] = await Promise.all([duyet(deNghi.hv2), duyet(deNghi.hv3)]);
    const maLoi = [r2.status, r3.status].sort();
    expect(maLoi).toEqual([200, 409]);
    const daDuyet = await prisma.doi_buoi_hoc.count({
      where: { trang_thai: 'da_duyet', lich_chot_id: buoi.b },
    });
    expect(daDuyet).toBe(2);
  });

  it('(d) lock theo buổi chốt: R1 (đề nghị X, chốt D) và R2 (đề nghị D) duyệt song song khi D còn 1 chỗ → đúng 1 thành công', async () => {
    const guiTu = (ai: string, dich: string) =>
      http().post('/hoc-vien/toi/doi-buoi').set(auth(ai)).send({
        lich_nguon_id: buoi.e,
        lich_de_nghi_id: dich,
        ly_do: 'Trùng lịch công tác',
      });
    // R1 gửi trước R2: không đề nghị nào chờ vào D trước R1 hay R2, nên cả hai
    // qua được kiểm giữ chỗ; chỉ khóa doi_buoi:<D> ngăn cả hai cùng đọc 1/2.
    const r1 = (await guiTu('hv4', buoi.x).expect(201)).body.id as string;
    const r2 = (await guiTu('hv5', buoi.d).expect(201)).body.id as string;

    const [k1, k2] = await Promise.all([
      http()
        .post(`/doi-buoi-hoc/${r1}/duyet`)
        .set(auth('ht'))
        .send({ lich_chot_id: buoi.d }),
      duyet(r2),
    ]);
    expect([k1.status, k2.status].sort()).toEqual([200, 409]);
    const vaoD = await prisma.doi_buoi_hoc.count({
      where: { trang_thai: 'da_duyet', lich_chot_id: buoi.d },
    });
    expect(vaoD).toBe(1);
    const phanLopD = await prisma.phan_lop_giai_doan.count({
      where: { lop: { lich_hoc: { some: { id: buoi.d } } } },
    });
    expect(phanLopD + vaoD).toBeLessThanOrEqual(2);
  });

  it('(c) HV2 (đã duyệt sang B) gửi lại đúng buổi B → 400 đang học buổi này', async () => {
    // D11: đã có bản đã duyệt → đây là đổi lại; đích trùng buổi chốt hiện tại.
    const res = await gui('hv2').expect(400);
    expect(res.body.error.message).toBe('Thầy/Cô đang học buổi này rồi');
  });

  it('(e) đổi lại: HV6 đã duyệt F→G, gửi đổi lại sang H, duyệt → bản cũ bị thay, sĩ số G giảm H tăng', async () => {
    const guiHv6 = (dich: string) =>
      http().post('/hoc-vien/toi/doi-buoi').set(auth('hv6')).send({
        lich_nguon_id: buoi.f,
        lich_de_nghi_id: dich,
        ly_do: 'Trùng lịch công tác',
      });
    const siSo = async () => {
      const m = await app
        .get(DoiBuoiHocQueryService)
        .siSoBuoi([buoi.g, buoi.h], new Date());
      return [m.get(buoi.g)?.si_so, m.get(buoi.h)?.si_so];
    };
    const cu = (await guiHv6(buoi.g).expect(201)).body.id as string;
    await duyet(cu).expect(200);
    expect(await siSo()).toEqual([1, 0]);

    const moi = (await guiHv6(buoi.h).expect(201)).body.id as string;
    // Đã có 1 đề nghị chờ cho buổi nguồn → gửi thêm bị unique chặn.
    await guiHv6(buoi.h).expect(409);
    const tongQuan = await http()
      .get('/hoc-vien/toi/doi-buoi')
      .query({ khoa_id: khoaId })
      .set(auth('hv6'))
      .expect(200);
    expect(tongQuan.body.so_luot_da_dung).toBe(1);
    const dnMoi = tongQuan.body.de_nghi.find((d: { id: string }) => d.id === moi);
    expect(dnMoi.doi_lai_tu.id).toBe(buoi.g);

    await duyet(moi).expect(200);
    const [dongCu, dongMoi] = await Promise.all([
      prisma.doi_buoi_hoc.findUniqueOrThrow({ where: { id: cu } }),
      prisma.doi_buoi_hoc.findUniqueOrThrow({ where: { id: moi } }),
    ]);
    expect(dongCu).toMatchObject({
      trang_thai: 'da_huy',
      ghi_chu_xu_ly: 'Đã thay bằng đề nghị đổi lại',
      nguoi_xu_ly: null,
    });
    expect(dongMoi).toMatchObject({ trang_thai: 'da_duyet', lich_chot_id: buoi.h });
    expect(await siSo()).toEqual([0, 1]);
  });
});
