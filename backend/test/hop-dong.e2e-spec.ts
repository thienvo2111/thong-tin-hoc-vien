import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import * as ExcelJS from 'exceljs';
import { createTestApp } from './utils/test-app';
import {
  prisma,
  taoDonViTest,
  taoNguoiDungTest,
  uniqueSuffix,
  xoaDonViTest,
  xoaNguoiDungTest,
} from './utils/test-data';

// Issue #64 / ADR 0015 M5, S4–S6, X4, X5: hợp đồng — nháp Phần 3–4, Nộp kèm điều kiện chặn, bản chụp hồ sơ,
// khóa danh sách sau khi nộp, Quản trị xem / Mở lại. Các test chạy TUẦN TỰ trên cùng dữ liệu.
// Mọi tên, MST, STK, SĐT, số QĐ đều BỊA — không có thông tin thật.
describe('Hợp đồng - nháp, nộp, khóa, mở lại - Cổng đơn vị (e2e)', () => {
  let app: INestApplication;
  let fixture: Awaited<ReturnType<typeof taoDonViTest>>;
  type NguoiDungTest = Awaited<ReturnType<typeof taoNguoiDungTest>>;
  const nguoiDung: NguoiDungTest[] = [];
  type VaiTro = 'quanTri' | 'truongA' | 'truongB' | 'so';
  const token = {} as Record<VaiTro, string>;
  const userId = {} as Record<VaiTro, string>;
  const tenDangNhap = {} as Record<VaiTro, string>;

  const suf = uniqueSuffix();
  const MAT_KHAU = 'MatKhau123';
  const donViIds: string[] = [];
  const dotIds: string[] = [];
  const deNghiIds: string[] = [];
  const ids = {} as Record<'so' | 'tA' | 'tB', string>;
  const ten = {} as Record<'tA' | 'tB', string>;
  // dHsg: A (An, Bình ½, Chi = 2,5 suất) + B (Em, Giang); dNguong: chỉ A (Hà, 1 suất); dChiB: chỉ B.
  const dot = {} as Record<'dHsg' | 'dNguong' | 'dChiB', string>;
  const dongId: Record<string, string> = {};

  const http = () => request(app.getHttpServer());
  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });
  const urlHd = (dotId: string) => `/cong-don-vi/truong/dot/${dotId}/hop-dong`;
  const urlDs = (dotId: string) => `/cong-don-vi/truong/dot/${dotId}/danh-sach`;
  const urlQt = (dotId: string, duoi: string) =>
    `/cong-don-vi/dot-trien-khai/${dotId}/${duoi}`;
  const urlHdQt = (dotId: string, donViId: string) =>
    urlQt(dotId, `hop-dong/${donViId}`);
  const urlDongQt = (id: string) => `/cong-don-vi/danh-sach-tham-gia/${id}`;

  const QD_TU = '2026-11-01';
  const QD_DEN = '2026-11-30';
  const HO_SO = {
    ten_truong: 'Trường THCS Bịa Hợp Đồng',
    dia_chi: 'Ấp Bịa, xã Thử, tỉnh Giả',
    ma_so_thue: '0000000001',
    nguoi_dai_dien: 'Người Đại Diện Bịa',
    sdt_dai_dien: '0900000001',
    email_hoa_don: `hoadon-${suf}@mau.test`,
    so_tai_khoan: '0000111122223333',
    ngan_hang: 'Ngân hàng Giả',
    chi_nhanh: 'Chi nhánh Giả',
    kho_bac: 'Kho bạc Giả',
    mst_kho_bac: '0000000001-001',
    ma_qhns: '7654321',
    ma_nguon: '13',
    ht_ho_ten: 'Hiệu Trưởng Bịa',
    ht_so_tai_khoan: '9999888877776666',
    ht_ngan_hang: 'Ngân hàng Giả – CN Thử',
    kt_ho_ten: 'Kế Toán Bịa',
    kt_sdt: '0900000002',
    kt_so_tai_khoan: '5555444433332222',
    kt_ngan_hang: 'Ngân hàng Giả – CN Thử',
    dau_moi_csvc: 'Đầu Mối Bịa 0900000003',
  };
  const HAU_CAN = {
    muc_dap_ung_csvc: 'Phòng máy Bịa',
    luu_tru: 'Nhà khách Bịa 0900000004',
    di_chuyen: 'Xe khách Bịa 0900000005',
  };
  const PHAN_3 = {
    nguoi_nhan: 'Người Nhận Bịa',
    sdt_nguoi_nhan: '0900000009',
    dia_chi_nhan: 'Số 1, đường Bịa, ấp Thử, xã Giả, tỉnh Mẫu',
    ghi_chu: 'Gọi trước khi gửi',
  };
  const PHAN_4 = { so_qd: '12/QĐ-BIA', ngay_qd: '2026-11-15' };

  async function dangNhap(ten_dang_nhap: string) {
    const res = await http()
      .post('/auth/dang-nhap')
      .send({ ten_dang_nhap, mat_khau: MAT_KHAU })
      .expect(200);
    return res.body.token as string;
  }

  async function taoTaiKhoan(
    vaiTro: VaiTro,
    vai_tro: 'quan_tri' | 'truong' | 'so_gddt',
    don_vi_id: string,
  ) {
    const u = await taoNguoiDungTest({
      vai_tro,
      don_vi_id,
      mat_khau: MAT_KHAU,
    });
    nguoiDung.push(u);
    token[vaiTro] = await dangNhap(u.ten_dang_nhap);
    userId[vaiTro] = u.nguoiDung.id;
    tenDangNhap[vaiTro] = u.ten_dang_nhap;
  }

  async function taoDonVi(
    tenDv: string,
    loai: 'so_gddt' | 'truong',
    cha: string | null,
  ) {
    const dv = await prisma.don_vi_cong_tac.create({
      data: {
        ma_don_vi: `HDBD-${uniqueSuffix()}`,
        ten_don_vi: tenDv,
        loai_don_vi: loai,
        dia_ban_id: fixture.diaDanhXa.id,
        don_vi_cha_id: cha,
        trang_thai: 'active',
      },
    });
    donViIds.push(dv.id);
    return dv.id;
  }

  async function taoDot(tenDot: string, don_gia: number) {
    const d = await prisma.dot_trien_khai.create({
      data: {
        chuong_trinh: 'hsg',
        ten: `${tenDot} ${suf}`,
        don_gia,
        ngay_qd_tu: new Date(`${QD_TU}T00:00:00Z`),
        ngay_qd_den: new Date(`${QD_DEN}T00:00:00Z`),
        han_nop: new Date('2026-12-31T16:59:59Z'),
        so_gddt_id: ids.so,
      },
    });
    dotIds.push(d.id);
    return d.id;
  }

  const dong = (don_vi_id: string, tenNguoi: string, nua = false) => ({
    don_vi_id,
    ho_ten: `GV Bịa ${tenNguoi} ${suf}`,
    ngay_sinh: '1991-03-04',
    lop: 'Toán 9',
    giai_doan: nua ? 'chi_gd1' : 'ca_hai',
  });

  const nap = (dotId: string, ds: unknown[]) =>
    http()
      .post(urlQt(dotId, 'danh-sach/nap'))
      .set(auth(token.quanTri))
      .send({ dong: ds });

  const getHd = (vaiTro: VaiTro, dotId: string) =>
    http().get(urlHd(dotId)).set(auth(token[vaiTro]));
  const putHd = (vaiTro: VaiTro, dotId: string, body: unknown) =>
    http()
      .put(urlHd(dotId))
      .set(auth(token[vaiTro]))
      .send(body as object);
  const nop = (vaiTro: VaiTro, dotId: string) =>
    http()
      .post(`${urlHd(dotId)}/nop`)
      .set(auth(token[vaiTro]));
  const moLai = (dotId: string, donViId: string, body?: object) => {
    const req = http()
      .post(`${urlHdQt(dotId, donViId)}/mo-lai`)
      .set(auth(token.quanTri));
    return body ? req.send(body) : req;
  };
  const putHoSo = (body: object) =>
    http().put('/cong-don-vi/ho-so-don-vi').set(auth(token.truongA)).send(body);
  const xacNhanDanhSach = async (vaiTro: VaiTro, dotId: string) => {
    await http()
      .post(`${urlDs(dotId)}/dong-y-tat-ca`)
      .set(auth(token[vaiTro]))
      .expect(200);
    await http()
      .post(`${urlDs(dotId)}/xac-nhan`)
      .set(auth(token[vaiTro]))
      .expect(200);
  };

  const hopDong = (dotId: string, don_vi_id: string) =>
    prisma.hop_dong_boi_duong.findUniqueOrThrow({
      where: {
        dot_trien_khai_id_don_vi_id: { dot_trien_khai_id: dotId, don_vi_id },
      },
    });
  const maLyDo = (body: { error: { fields: { field: string }[] } }) =>
    body.error.fields.map((f) => f.field);
  const nhatKy = (hanh_dong: string, dotId: string) =>
    prisma.nhat_ky_hoat_dong.findMany({
      where: {
        hanh_dong,
        chi_tiet: { path: ['dot_trien_khai_id'], equals: dotId },
      },
      orderBy: { thoi_gian: 'asc' },
    });
  const tenDong = async (dotId: string, don_vi_id: string) =>
    (
      await prisma.danh_sach_tham_gia.findMany({
        where: { dot_trien_khai_id: dotId, don_vi_id },
        select: { ho_ten: true },
        orderBy: { ho_ten: 'asc' },
      })
    ).map((d) => d.ho_ten);

  async function ghiIdDong(vaiTro: VaiTro, dotId: string) {
    const res = await http()
      .get(urlDs(dotId))
      .set(auth(token[vaiTro]))
      .expect(200);
    for (const d of res.body.dong as { id: string; ho_ten: string }[]) {
      dongId[d.ho_ten.split(' ')[2]] = d.id;
    }
  }

  async function taoExcel(dongExcel: unknown[][]): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    const sh = wb.addWorksheet('DS');
    sh.addRow([`DANH SÁCH THỬ ${suf}`]);
    sh.addRow([
      'Họ và tên',
      'Ngày sinh',
      'Giới tính',
      'Mã gốc',
      'Lớp',
      'Mã trường',
      'Tên trường',
      'Giai đoạn tham gia',
      'Ghi chú',
    ]);
    dongExcel.forEach((d) => sh.addRow(d));
    return Buffer.from(await wb.xlsx.writeBuffer());
  }

  const capNhatDot = (id: string, data: object) =>
    prisma.dot_trien_khai.update({ where: { id }, data });

  beforeAll(async () => {
    app = await createTestApp({ raiseThrottlerLimit: true });
    fixture = await taoDonViTest('hdbd');
    ids.so = await taoDonVi(`Sở thử hợp đồng ${suf}`, 'so_gddt', null);
    ten.tA = `Trường A Hợp Đồng Bịa ${suf}`;
    ten.tB = `Trường B Hợp Đồng Bịa ${suf}`;
    ids.tA = await taoDonVi(ten.tA, 'truong', ids.so);
    ids.tB = await taoDonVi(ten.tB, 'truong', ids.so);
    dot.dHsg = await taoDot('HSG hợp đồng', 1_000_000);
    dot.dNguong = await taoDot('HSG ngưỡng', 50_000_000);
    dot.dChiB = await taoDot('HSG chỉ B', 1_000_000);

    await taoTaiKhoan('quanTri', 'quan_tri', fixture.donVi.id);
    await taoTaiKhoan('truongA', 'truong', ids.tA);
    await taoTaiKhoan('truongB', 'truong', ids.tB);
    await taoTaiKhoan('so', 'so_gddt', ids.so);

    const r1 = await nap(dot.dHsg, [
      dong(ids.tA, 'An'),
      dong(ids.tA, 'Bình', true),
      dong(ids.tA, 'Chi'),
      dong(ids.tB, 'Em'),
      dong(ids.tB, 'Giang'),
    ]);
    expect(r1.status).toBe(200);
    expect((await nap(dot.dNguong, [dong(ids.tA, 'Hà')])).status).toBe(200);
    expect((await nap(dot.dChiB, [dong(ids.tB, 'Khoa')])).status).toBe(200);
    await ghiIdDong('truongA', dot.dHsg);
    await ghiIdDong('truongB', dot.dHsg);
    await ghiIdDong('truongA', dot.dNguong);
  });

  afterAll(async () => {
    // Chỉ xóa đúng các dòng file này tạo (theo id đợt / đơn vị / id đã ghi; mảng rỗng thì bỏ qua).
    // nhat_ky_hoat_dong chỉ cho thêm (trigger chặn xóa) — để nguyên.
    if (deNghiIds.length > 0) {
      await prisma.de_nghi_sua_danh_sach.deleteMany({
        where: { id: { in: deNghiIds } },
      });
    }
    if (dotIds.length > 0) {
      await prisma.de_nghi_sua_danh_sach.deleteMany({
        where: { dot_trien_khai_id: { in: dotIds } },
      });
      await prisma.danh_sach_tham_gia.deleteMany({
        where: { dot_trien_khai_id: { in: dotIds } },
      });
      await prisma.hop_dong_boi_duong.deleteMany({
        where: { dot_trien_khai_id: { in: dotIds } },
      });
      await prisma.dot_trien_khai.deleteMany({ where: { id: { in: dotIds } } });
    }
    for (const id of [ids.tA, ids.tB]) {
      if (id)
        await prisma.ho_so_don_vi.deleteMany({ where: { don_vi_id: id } });
    }
    for (const u of nguoiDung) {
      if (u?.nguoiDung.id) await xoaNguoiDungTest(u.nguoiDung.id);
    }
    for (const id of [...donViIds].reverse()) {
      await prisma.don_vi_cong_tac.deleteMany({ where: { id } });
    }
    if (fixture) {
      await xoaDonViTest(
        [fixture.donVi.id],
        [fixture.diaDanhXa.id, fixture.diaDanhTinh.id],
      );
    }
    await prisma.$disconnect();
    await app.close();
  });

  describe('Phân quyền', () => {
    it('401 khi không có token', async () => {
      await http().get(urlHd(dot.dHsg)).expect(401);
      await http().put(urlHd(dot.dHsg)).send({}).expect(401);
      await http()
        .post(`${urlHd(dot.dHsg)}/nop`)
        .expect(401);
      await http().get(urlHdQt(dot.dHsg, ids.tA)).expect(401);
      await http()
        .post(`${urlHdQt(dot.dHsg, ids.tA)}/mo-lai`)
        .send({ ly_do: 'x' })
        .expect(401);
    });

    it('so_gddt → 403 trên mọi endpoint mới; quan_tri → 403 trên endpoint của trường', async () => {
      expect((await getHd('so', dot.dHsg)).status).toBe(403);
      expect((await putHd('so', dot.dHsg, {})).status).toBe(403);
      expect((await nop('so', dot.dHsg)).status).toBe(403);
      await http()
        .get(urlHdQt(dot.dHsg, ids.tA))
        .set(auth(token.so))
        .expect(403);
      await http()
        .post(`${urlHdQt(dot.dHsg, ids.tA)}/mo-lai`)
        .set(auth(token.so))
        .send({ ly_do: 'x' })
        .expect(403);
      expect((await getHd('quanTri', dot.dHsg)).status).toBe(403);
    });

    it('truong → 403 trên endpoint Quản trị (xem, mở lại)', async () => {
      await http()
        .get(urlHdQt(dot.dHsg, ids.tA))
        .set(auth(token.truongA))
        .expect(403);
      await http()
        .post(`${urlHdQt(dot.dHsg, ids.tA)}/mo-lai`)
        .set(auth(token.truongA))
        .send({ ly_do: 'x' })
        .expect(403);
    });

    it('trường A không xem/sửa/nộp được đợt chỉ B có hợp đồng → 404', async () => {
      expect((await getHd('truongA', dot.dChiB)).status).toBe(404);
      expect((await putHd('truongA', dot.dChiB, PHAN_3)).status).toBe(404);
      expect((await nop('truongA', dot.dChiB)).status).toBe(404);
      const hd = await hopDong(dot.dChiB, ids.tB);
      expect(hd.nguoi_nhan).toBeNull();
    });

    it('Quản trị xem trường không có hợp đồng trong đợt → 404', async () => {
      await http()
        .get(urlHdQt(dot.dChiB, ids.tA))
        .set(auth(token.quanTri))
        .expect(404);
    });
  });

  describe('Nháp Phần 3–4 (X4)', () => {
    it('GET khi chưa làm gì → số liệu tạm tính + lý do chặn', async () => {
      const res = await getHd('truongA', dot.dHsg).expect(200);
      expect(res.body).toMatchObject({
        dot: {
          id: dot.dHsg,
          chuong_trinh: 'hsg',
          don_gia: 1_000_000,
          ngay_qd_tu: QD_TU,
          ngay_qd_den: QD_DEN,
        },
        trang_thai_danh_sach: 'cho_xac_nhan',
        trang_thai_hop_dong: 'chua_nop',
        phan_3: {
          nguoi_nhan: null,
          sdt_nguoi_nhan: null,
          dia_chi_nhan: null,
          ghi_chu: null,
        },
        phan_4: { so_qd: null, ngay_qd: null },
        diem_hoc_truc_tiep: false,
        so_nguoi: 3,
        tong_suat: 2.5,
        don_gia: 1_000_000,
        gia_tri: 2_500_000,
        can_phan_4: false,
        ho_so_tinh_trang: { du: false, so_thieu: 20 },
        chuyen_khoan: null,
        co_the_nop: false,
        nop_luc: null,
        ban_chup_ho_so: null,
      });
      expect(res.body.ly_do_chan.map((l: { ma: string }) => l.ma)).toEqual([
        'danh_sach_chua_xac_nhan',
        'ho_so_chua_du',
        'phan_3_chua_du',
      ]);
    });

    it('PUT Phần 3 một phần → 200, lưu; nhật ký chỉ tên trường đổi', async () => {
      const res = await putHd('truongA', dot.dHsg, {
        nguoi_nhan: '  Người Nhận Bịa ',
        sdt_nguoi_nhan: '0900 000.009',
      }).expect(200);
      expect(res.body.phan_3).toEqual({
        nguoi_nhan: 'Người Nhận Bịa',
        sdt_nguoi_nhan: '0900000009',
        dia_chi_nhan: null,
        ghi_chu: null,
      });
      const hd = await hopDong(dot.dHsg, ids.tA);
      expect(hd.nguoi_nhan).toBe('Người Nhận Bịa');
      expect(hd.sdt_nguoi_nhan).toBe('0900000009');
      const nk = await nhatKy('luu_nhap_hop_dong', dot.dHsg);
      expect(nk).toHaveLength(1);
      expect(nk[0].nguoi_dung_id).toBe(userId.truongA);
      expect(nk[0].chi_tiet).toEqual({
        dot_trien_khai_id: dot.dHsg,
        don_vi_id: ids.tA,
        truong_thay_doi: ['nguoi_nhan', 'sdt_nguoi_nhan'],
      });
      expect(JSON.stringify(nk[0].chi_tiet)).not.toContain('Người Nhận');
    });

    it('PUT y hệt → 200, không thêm nhật ký', async () => {
      await putHd('truongA', dot.dHsg, {
        nguoi_nhan: 'Người Nhận Bịa',
        sdt_nguoi_nhan: '0900000009',
      }).expect(200);
      expect(await nhatKy('luu_nhap_hop_dong', dot.dHsg)).toHaveLength(1);
    });

    it('SĐT sai → 400 field sdt_nguoi_nhan, không lưu', async () => {
      const res = await putHd('truongA', dot.dHsg, {
        ...PHAN_3,
        sdt_nguoi_nhan: '12345',
      }).expect(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.fields).toEqual([
        { field: 'sdt_nguoi_nhan', message: 'SĐT gồm 10 số, bắt đầu bằng 0' },
      ]);
      expect((await hopDong(dot.dHsg, ids.tA)).dia_chi_nhan).toBeNull();
    });

    it('khóa lạ / kiểu sai / ngày QĐ sai → 400 theo field', async () => {
      const res = await putHd('truongA', dot.dHsg, {
        trang_thai_hop_dong: 'da_nop',
        diem_hoc_truc_tiep: 'co',
        ngay_qd: '31/12/2026',
      }).expect(400);
      const fields = (res.body.error.fields as { field: string }[])
        .map((f) => f.field)
        .sort();
      expect(fields).toEqual([
        'diem_hoc_truc_tiep',
        'ngay_qd',
        'trang_thai_hop_dong',
      ]);
      expect((await hopDong(dot.dHsg, ids.tA)).trang_thai_hop_dong).toBe(
        'chua_nop',
      );
    });

    it('Nộp khi danh sách chưa xác nhận, hồ sơ chưa khai, Phần 3 thiếu → 400 kèm danh sách lý do', async () => {
      const res = await nop('truongA', dot.dHsg).expect(400);
      expect(res.body.error).toMatchObject({
        code: 'VALIDATION_ERROR',
        message: 'Chưa nộp được hợp đồng',
      });
      expect(res.body.error.fields).toEqual([
        {
          field: 'danh_sach_chua_xac_nhan',
          message: 'Danh sách chưa được xác nhận',
        },
        {
          field: 'ho_so_chua_du',
          message: 'Hồ sơ đơn vị còn thiếu 20 mục',
        },
        {
          field: 'phan_3_chua_du',
          message: 'Phần 3 (người nhận bản giấy hợp đồng) còn thiếu hoặc sai',
        },
      ]);
      expect((await hopDong(dot.dHsg, ids.tA)).trang_thai_hop_dong).toBe(
        'chua_nop',
      );
    });
  });

  describe('Từng điều kiện chặn — đợt ngưỡng (A: 1 suất)', () => {
    beforeAll(async () => {
      await putHoSo(HO_SO).expect(200);
      await xacNhanDanhSach('truongA', dot.dNguong);
      await putHd('truongA', dot.dNguong, PHAN_3).expect(200);
    });

    it('giá trị = 50.000.000 → cần Phần 4: thiếu số + ngày QĐ', async () => {
      const get = await getHd('truongA', dot.dNguong).expect(200);
      expect(get.body).toMatchObject({ gia_tri: 50_000_000, can_phan_4: true });
      const res = await nop('truongA', dot.dNguong).expect(400);
      expect(maLyDo(res.body)).toEqual(['thieu_so_qd', 'thieu_ngay_qd']);
    });

    it('chỉ thiếu số QĐ → thieu_so_qd', async () => {
      await putHd('truongA', dot.dNguong, {
        ...PHAN_3,
        ngay_qd: PHAN_4.ngay_qd,
      }).expect(200);
      expect(maLyDo((await nop('truongA', dot.dNguong)).body)).toEqual([
        'thieu_so_qd',
      ]);
    });

    it('chỉ thiếu ngày QĐ → thieu_ngay_qd', async () => {
      await putHd('truongA', dot.dNguong, {
        ...PHAN_3,
        so_qd: PHAN_4.so_qd,
      }).expect(200);
      expect(maLyDo((await nop('truongA', dot.dNguong)).body)).toEqual([
        'thieu_ngay_qd',
      ]);
    });

    it.each(['2026-10-31', '2026-12-01'])(
      'ngày QĐ %s (lệch 1 ngày ngoài khoảng) → ngay_qd_ngoai_khoang',
      async (ngay_qd) => {
        await putHd('truongA', dot.dNguong, {
          ...PHAN_3,
          so_qd: PHAN_4.so_qd,
          ngay_qd,
        }).expect(200);
        const res = await nop('truongA', dot.dNguong).expect(400);
        expect(res.body.error.fields).toEqual([
          {
            field: 'ngay_qd_ngoai_khoang',
            message: 'Ngày QĐ phải từ 01/11/2026 đến 30/11/2026',
          },
        ]);
      },
    );

    it('đợt chưa cấu hình khoảng ngày QĐ → dot_chua_cau_hinh_ngay_qd', async () => {
      await putHd('truongA', dot.dNguong, { ...PHAN_3, ...PHAN_4 }).expect(200);
      await capNhatDot(dot.dNguong, { ngay_qd_tu: null, ngay_qd_den: null });
      const res = await nop('truongA', dot.dNguong).expect(400);
      expect(maLyDo(res.body)).toEqual(['dot_chua_cau_hinh_ngay_qd']);
      await capNhatDot(dot.dNguong, {
        ngay_qd_tu: new Date(`${QD_TU}T00:00:00Z`),
        ngay_qd_den: new Date(`${QD_DEN}T00:00:00Z`),
      });
    });

    it('đợt chưa có đơn giá → chua_co_don_gia, không xét Phần 4', async () => {
      await putHd('truongA', dot.dNguong, PHAN_3).expect(200);
      await capNhatDot(dot.dNguong, { don_gia: null });
      const get = await getHd('truongA', dot.dNguong).expect(200);
      expect(get.body).toMatchObject({ gia_tri: null, can_phan_4: false });
      expect(maLyDo((await nop('truongA', dot.dNguong)).body)).toEqual([
        'chua_co_don_gia',
      ]);
      await capNhatDot(dot.dNguong, { don_gia: 50_000_000 });
    });

    it('hồ sơ thiếu 1 mục → ho_so_chua_du', async () => {
      await putHd('truongA', dot.dNguong, { ...PHAN_3, ...PHAN_4 }).expect(200);
      await putHoSo({ ...HO_SO, ma_nguon: null }).expect(200);
      expect((await nop('truongA', dot.dNguong)).body.error.fields).toEqual([
        { field: 'ho_so_chua_du', message: 'Hồ sơ đơn vị còn thiếu 1 mục' },
      ]);
      await putHoSo(HO_SO).expect(200);
    });

    it('điểm học trực tiếp, hậu cần chưa đủ → thieu_hau_can; đủ hậu cần → hết chặn', async () => {
      await putHd('truongA', dot.dNguong, {
        ...PHAN_3,
        ...PHAN_4,
        diem_hoc_truc_tiep: true,
      }).expect(200);
      expect(maLyDo((await nop('truongA', dot.dNguong)).body)).toEqual([
        'thieu_hau_can',
      ]);
      await putHoSo({ ...HO_SO, ...HAU_CAN }).expect(200);
      const get = await getHd('truongA', dot.dNguong).expect(200);
      expect(get.body).toMatchObject({ co_the_nop: true, ly_do_chan: [] });
      await putHoSo(HO_SO).expect(200);
    });

    it('Phần 3 thiếu người nhận → phan_3_chua_du', async () => {
      await putHd('truongA', dot.dNguong, {
        ...PHAN_3,
        ...PHAN_4,
        nguoi_nhan: '',
      }).expect(200);
      expect(maLyDo((await nop('truongA', dot.dNguong)).body)).toEqual([
        'phan_3_chua_du',
      ]);
    });

    it('danh sách bỏ xác nhận → danh_sach_chua_xac_nhan', async () => {
      await putHd('truongA', dot.dNguong, { ...PHAN_3, ...PHAN_4 }).expect(200);
      await http()
        .put(`${urlDs(dot.dNguong)}/${dongId['Hà']}/y-kien`)
        .set(auth(token.truongA))
        .send({ y_kien: null })
        .expect(200);
      expect(maLyDo((await nop('truongA', dot.dNguong)).body)).toEqual([
        'danh_sach_chua_xac_nhan',
      ]);
      await xacNhanDanhSach('truongA', dot.dNguong);
    });

    it.each([
      ['= từ', QD_TU],
      ['= đến', QD_DEN],
    ])('ngày QĐ %s → nộp được (rồi Quản trị mở lại)', async (_, ngay_qd) => {
      await putHd('truongA', dot.dNguong, {
        ...PHAN_3,
        so_qd: PHAN_4.so_qd,
        ngay_qd,
      }).expect(200);
      const res = await nop('truongA', dot.dNguong).expect(200);
      expect(res.body).toMatchObject({
        trang_thai_hop_dong: 'da_nop',
        phan_4: { so_qd: PHAN_4.so_qd, ngay_qd },
        gia_tri: 50_000_000,
      });
      await moLai(dot.dNguong, ids.tA, { ly_do: 'Thử biên ngày QĐ' }).expect(
        200,
      );
    });

    it('giá trị = 49.999.999 → không cần Phần 4, nộp được khi Phần 4 trống', async () => {
      await capNhatDot(dot.dNguong, { don_gia: 49_999_999 });
      await putHd('truongA', dot.dNguong, PHAN_3).expect(200);
      const get = await getHd('truongA', dot.dNguong).expect(200);
      expect(get.body).toMatchObject({
        gia_tri: 49_999_999,
        can_phan_4: false,
        co_the_nop: true,
      });
      const res = await nop('truongA', dot.dNguong).expect(200);
      expect(res.body.trang_thai_hop_dong).toBe('da_nop');
      const hd = await hopDong(dot.dNguong, ids.tA);
      expect(Number(hd.gia_tri_luc_nop)).toBe(49_999_999);
      await moLai(dot.dNguong, ids.tA, { ly_do: 'Thử ngưỡng' }).expect(200);
      await capNhatDot(dot.dNguong, { don_gia: 50_000_000 });
      expect((await nop('truongA', dot.dNguong)).status).toBe(400);
    });
  });

  describe('Nộp (M5) — luồng chính đợt HSG', () => {
    it('xác nhận danh sách + Phần 3 đủ → nộp 200, đã nộp, bản chụp đầy đủ', async () => {
      await xacNhanDanhSach('truongA', dot.dHsg);
      await putHd('truongA', dot.dHsg, PHAN_3).expect(200);
      const truocLuc = new Date();
      const res = await nop('truongA', dot.dHsg).expect(200);
      expect(res.body).toMatchObject({
        trang_thai_hop_dong: 'da_nop',
        co_the_nop: false,
        ly_do_chan: [{ ma: 'da_nop', thong_diep: 'Hợp đồng đã nộp' }],
        so_nguoi: 3,
        tong_suat: 2.5,
        don_gia: 1_000_000,
        gia_tri: 2_500_000,
        chuyen_khoan: { stk: 'HCMUE7654321' },
        ho_so_tinh_trang: { du: true, so_thieu: 0 },
      });
      expect(res.body.ban_chup_ho_so).toMatchObject({
        ...HO_SO,
        stk_chuyen_khoan: 'HCMUE7654321',
        don_vi_tiep_nhan: 'Trường Đại học Sư phạm Thành phố Hồ Chí Minh',
        ngan_hang_tiep_nhan: 'Ngân hàng TMCP Đại Chúng Việt Nam (PVcomBank)',
      });
      expect(res.body.ban_chup_ho_so.chup_luc).toEqual(expect.any(String));
      const hd = await hopDong(dot.dHsg, ids.tA);
      expect(hd.trang_thai_hop_dong).toBe('da_nop');
      expect(hd.nop_boi).toBe(userId.truongA);
      expect(hd.nop_luc!.getTime()).toBeGreaterThanOrEqual(
        truocLuc.getTime() - 1000,
      );
      expect(hd.so_nguoi_luc_nop).toBe(3);
      expect(Number(hd.tong_suat_luc_nop)).toBe(2.5);
      expect(hd.don_gia_luc_nop).toBe(1_000_000);
      expect(Number(hd.gia_tri_luc_nop)).toBe(2_500_000);
      expect(hd.thao_tac_cuoi_boi).toBe(userId.truongA);
      const nk = await nhatKy('nop_hop_dong', dot.dHsg);
      expect(nk).toHaveLength(1);
      expect(nk[0].chi_tiet).toEqual({
        dot_trien_khai_id: dot.dHsg,
        don_vi_id: ids.tA,
        hop_dong_id: hd.id,
        so_nguoi: 3,
        tong_suat: 2.5,
        gia_tri: 2_500_000,
      });
    });

    it('đổi đơn giá đợt sau khi nộp → số liệu vẫn lấy từ bản chụp', async () => {
      await capNhatDot(dot.dHsg, { don_gia: 2_000_000 });
      const res = await getHd('truongA', dot.dHsg).expect(200);
      expect(res.body).toMatchObject({
        dot: { don_gia: 2_000_000 },
        don_gia: 1_000_000,
        gia_tri: 2_500_000,
      });
      await capNhatDot(dot.dHsg, { don_gia: 1_000_000 });
    });

    it('trường sửa hồ sơ sau khi nộp → 200 nhưng bản chụp hợp đồng không đổi (T2/M5)', async () => {
      await putHoSo({ ...HO_SO, ma_qhns: '1112223' }).expect(200);
      const res = await getHd('truongA', dot.dHsg).expect(200);
      expect(res.body.ban_chup_ho_so.ma_qhns).toBe('7654321');
      expect(res.body.chuyen_khoan.stk).toBe('HCMUE7654321');
      const hd = await hopDong(dot.dHsg, ids.tA);
      expect(
        (hd.ban_chup_ho_so as { ma_qhns: string; stk_chuyen_khoan: string })
          .stk_chuyen_khoan,
      ).toBe('HCMUE7654321');
    });

    it('trường xem danh sách: trang_thai_hop_dong da_nop; thẻ đợt lấy số liệu lúc nộp', async () => {
      const ds = await http()
        .get(urlDs(dot.dHsg))
        .set(auth(token.truongA))
        .expect(200);
      expect(ds.body.trang_thai_hop_dong).toBe('da_nop');
      const the = await http()
        .get('/cong-don-vi/truong/dot')
        .set(auth(token.truongA))
        .expect(200);
      const theHsg = the.body.find(
        (t: { dot: { id: string } }) => t.dot.id === dot.dHsg,
      );
      expect(theHsg).toMatchObject({
        trang_thai_hop_dong: 'da_nop',
        gia_tri_tam_tinh: 2_500_000,
      });
    });

    it('Quản trị xem: đủ bản chụp (STK Phần 5 không che ở API), người nộp', async () => {
      const res = await http()
        .get(urlHdQt(dot.dHsg, ids.tA))
        .set(auth(token.quanTri))
        .expect(200);
      expect(res.body).toMatchObject({
        don_vi: { id: ids.tA, ten: ten.tA },
        trang_thai_hop_dong: 'da_nop',
        nop_boi: { ten_dang_nhap: tenDangNhap.truongA },
        ho_so_hien_tai: null,
        phan_3: PHAN_3,
      });
      expect(res.body.ban_chup_ho_so.ht_so_tai_khoan).toBe(
        HO_SO.ht_so_tai_khoan,
      );
    });

    it('Quản trị xem trường chưa nộp: hồ sơ hiện tại, không bản chụp', async () => {
      const res = await http()
        .get(urlHdQt(dot.dHsg, ids.tB))
        .set(auth(token.quanTri))
        .expect(200);
      expect(res.body).toMatchObject({
        trang_thai_hop_dong: 'chua_nop',
        ban_chup_ho_so: null,
        ho_so_hien_tai: null,
        nop_boi: null,
        so_nguoi: 2,
      });
    });

    it('danh sách Quản trị: tong_hop có trang_thai_hop_dong từng trường', async () => {
      const res = await http()
        .get(urlQt(dot.dHsg, 'danh-sach'))
        .set(auth(token.quanTri))
        .expect(200);
      const theoTruong = Object.fromEntries(
        res.body.tong_hop.map(
          (t: { don_vi_id: string; trang_thai_hop_dong: string }) => [
            t.don_vi_id,
            t.trang_thai_hop_dong,
          ],
        ),
      );
      expect(theoTruong).toEqual({ [ids.tA]: 'da_nop', [ids.tB]: 'chua_nop' });
    });
  });

  describe('Khóa sau khi nộp (X5)', () => {
    const DA_NOP_TRUONG = 'Hợp đồng đã nộp — danh sách chỉ xem';
    const DA_NOP_QT =
      'Trường đã nộp hợp đồng — Mở lại hợp đồng trước khi sửa danh sách';

    it('trường: lưu nháp / nộp lại → 409', async () => {
      const put = await putHd('truongA', dot.dHsg, PHAN_3).expect(409);
      expect(put.body.error).toMatchObject({
        code: 'CONFLICT',
        message: 'Hợp đồng đã nộp — liên hệ HCMUE nếu cần mở lại',
      });
      await nop('truongA', dot.dHsg).expect(409);
    });

    it('trường: ý kiến / đồng ý tất cả / xác nhận / gửi đề nghị → 409', async () => {
      const yk = await http()
        .put(`${urlDs(dot.dHsg)}/${dongId.An}/y-kien`)
        .set(auth(token.truongA))
        .send({ y_kien: 'khong_dong_y' })
        .expect(409);
      expect(yk.body.error.message).toBe(DA_NOP_TRUONG);
      await http()
        .post(`${urlDs(dot.dHsg)}/dong-y-tat-ca`)
        .set(auth(token.truongA))
        .expect(409);
      await http()
        .post(`${urlDs(dot.dHsg)}/xac-nhan`)
        .set(auth(token.truongA))
        .expect(409);
      await http()
        .post(`/cong-don-vi/truong/dot/${dot.dHsg}/de-nghi`)
        .set(auth(token.truongA))
        .send({ loai: 'them', gia_tri: { ho_ten: 'GV Bịa Mới' } })
        .expect(409);
      const dongAn = await prisma.danh_sach_tham_gia.findUniqueOrThrow({
        where: { id: dongId.An },
      });
      expect(dongAn.y_kien_truong).toBe('dong_y');
    });

    it('Quản trị sửa / thêm / xóa dòng của trường đã nộp → 409', async () => {
      const sua = await http()
        .patch(urlDongQt(dongId.An))
        .set(auth(token.quanTri))
        .send({ lop: 'Văn 9', ly_do: 'Thử khóa' })
        .expect(409);
      expect(sua.body.error.message).toBe(DA_NOP_QT);
      await http()
        .post(urlQt(dot.dHsg, 'danh-sach'))
        .set(auth(token.quanTri))
        .send({ ...dong(ids.tA, 'Mới'), ly_do: 'Thử khóa' })
        .expect(409);
      await http()
        .delete(urlDongQt(dongId.Chi))
        .set(auth(token.quanTri))
        .send({ ly_do: 'Thử khóa' })
        .expect(409);
      expect(await tenDong(dot.dHsg, ids.tA)).toHaveLength(3);
    });

    it('Quản trị chuyển dòng sang/ra khỏi trường đã nộp → 409', async () => {
      await http()
        .patch(urlDongQt(dongId.Em))
        .set(auth(token.quanTri))
        .send({ don_vi_id: ids.tA, ly_do: 'Thử chuyển' })
        .expect(409);
      await http()
        .patch(urlDongQt(dongId.An))
        .set(auth(token.quanTri))
        .send({ don_vi_id: ids.tB, ly_do: 'Thử chuyển' })
        .expect(409);
      expect(await tenDong(dot.dHsg, ids.tB)).toHaveLength(2);
    });

    it('Quản trị Áp dụng / Từ chối đề nghị của trường đã nộp → 409', async () => {
      // Không tạo được qua API (nộp cần hết đề nghị chờ) — chèn thẳng 1 đề nghị chờ để thử khóa.
      const dn = await prisma.de_nghi_sua_danh_sach.create({
        data: {
          dot_trien_khai_id: dot.dHsg,
          don_vi_id: ids.tA,
          loai: 'them',
          gia_tri: { ho_ten: 'GV Bịa Đề Nghị', giai_doan: 'ca_hai' },
          gui_boi: userId.truongA,
        },
      });
      deNghiIds.push(dn.id);
      const ap = await http()
        .post(`/cong-don-vi/de-nghi-sua/${dn.id}/ap-dung`)
        .set(auth(token.quanTri))
        .expect(409);
      expect(ap.body.error.message).toBe(DA_NOP_QT);
      await http()
        .post(`/cong-don-vi/de-nghi-sua/${dn.id}/tu-choi`)
        .set(auth(token.quanTri))
        .send({ ly_do: 'Thử khóa' })
        .expect(409);
      expect(
        (
          await prisma.de_nghi_sua_danh_sach.findUniqueOrThrow({
            where: { id: dn.id },
          })
        ).trang_thai,
      ).toBe('cho');
      await prisma.de_nghi_sua_danh_sach.delete({ where: { id: dn.id } });
    });

    it('xem trước nạp đánh dấu trường đã nộp', async () => {
      const buf = await taoExcel([
        [`GV Bịa X ${suf}`, '', '', '', '', '', ten.tA, 'Cả 2', ''],
        [`GV Bịa Y ${suf}`, '', '', '', '', '', ten.tB, 'Cả 2', ''],
      ]);
      const res = await http()
        .post(urlQt(dot.dHsg, 'danh-sach/xem-truoc'))
        .set(auth(token.quanTri))
        .attach('file', buf, 'ds.xlsx')
        .expect(200);
      expect(
        res.body.dong.map((d: { don_vi_id: string; da_nop: boolean }) => [
          d.don_vi_id,
          d.da_nop,
        ]),
      ).toEqual([
        [ids.tA, true],
        [ids.tB, false],
      ]);
      expect(res.body.truong_da_nop).toEqual([
        { don_vi_id: ids.tA, ten_don_vi: ten.tA },
      ]);
    });

    it('nạp có trường đã nộp → 409 nêu tên trường, KHÔNG nạp gì (B giữ nguyên)', async () => {
      const truocB = await tenDong(dot.dHsg, ids.tB);
      const res = await nap(dot.dHsg, [
        dong(ids.tA, 'Nạp'),
        dong(ids.tB, 'Nạp'),
      ]).expect(409);
      expect(res.body.error.code).toBe('CONFLICT');
      expect(res.body.error.message).toContain(ten.tA);
      expect(res.body.error.message).not.toContain(ten.tB);
      expect(await tenDong(dot.dHsg, ids.tB)).toEqual(truocB);
      expect(await tenDong(dot.dHsg, ids.tA)).toHaveLength(3);
    });

    it('trường B chưa nộp vẫn sửa được (trường + Quản trị)', async () => {
      await http()
        .patch(urlDongQt(dongId.Em))
        .set(auth(token.quanTri))
        .send({ lop: 'Lý 9', ly_do: 'B chưa nộp' })
        .expect(200);
      await http()
        .put(`${urlDs(dot.dHsg)}/${dongId.Em}/y-kien`)
        .set(auth(token.truongB))
        .send({ y_kien: 'dong_y' })
        .expect(200);
      await putHd('truongB', dot.dHsg, { nguoi_nhan: 'Người B Bịa' }).expect(
        200,
      );
    });
  });

  describe('Mở lại hợp đồng (X5)', () => {
    it.each([
      ['không có body', undefined],
      ['lý do trống', { ly_do: '   ' }],
      ['lý do quá 500 ký tự', { ly_do: 'a'.repeat(501) }],
    ])('%s → 400, vẫn đã nộp', async (_, body) => {
      const res = await moLai(dot.dHsg, ids.tA, body).expect(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect((await hopDong(dot.dHsg, ids.tA)).trang_thai_hop_dong).toBe(
        'da_nop',
      );
    });

    it('trường chưa nộp → 409', async () => {
      const res = await moLai(dot.dHsg, ids.tB, { ly_do: 'Thử' }).expect(409);
      expect(res.body.error.message).toBe('Hợp đồng chưa nộp');
    });

    it('có lý do → chưa nộp, xóa bản chụp, giữ Phần 3; nhật ký có bản chụp cũ', async () => {
      const truoc = await hopDong(dot.dHsg, ids.tA);
      const res = await moLai(dot.dHsg, ids.tA, {
        ly_do: 'Trường cần sửa danh sách',
      }).expect(200);
      expect(res.body).toMatchObject({
        trang_thai_hop_dong: 'chua_nop',
        ban_chup_ho_so: null,
        nop_luc: null,
        nop_boi: null,
        phan_3: PHAN_3,
      });
      expect(res.body.ho_so_hien_tai.ma_qhns).toBe('1112223');
      const hd = await hopDong(dot.dHsg, ids.tA);
      expect(hd).toMatchObject({
        trang_thai_hop_dong: 'chua_nop',
        nop_luc: null,
        nop_boi: null,
        ban_chup_ho_so: null,
        so_nguoi_luc_nop: null,
        tong_suat_luc_nop: null,
        don_gia_luc_nop: null,
        gia_tri_luc_nop: null,
        nguoi_nhan: PHAN_3.nguoi_nhan,
        thao_tac_cuoi_boi: userId.quanTri,
      });
      const nk = await nhatKy('mo_lai_hop_dong', dot.dHsg);
      expect(nk).toHaveLength(1);
      expect(nk[0].nguoi_dung_id).toBe(userId.quanTri);
      expect(nk[0].chi_tiet).toMatchObject({
        dot_trien_khai_id: dot.dHsg,
        don_vi_id: ids.tA,
        hop_dong_id: hd.id,
        ly_do: 'Trường cần sửa danh sách',
        ban_chup_cu: {
          so_nguoi: 3,
          tong_suat: 2.5,
          don_gia: 1_000_000,
          gia_tri: 2_500_000,
          nop_luc: truoc.nop_luc!.toISOString(),
          nop_boi: userId.truongA,
          phan_3: PHAN_3,
          phan_4: { so_qd: null, ngay_qd: null },
          diem_hoc_truc_tiep: false,
          ban_chup_ho_so: {
            ma_qhns: '7654321',
            stk_chuyen_khoan: 'HCMUE7654321',
          },
        },
      });
    });

    it('sau Mở lại: Quản trị sửa dòng được → danh sách về Chờ xác nhận → nộp bị chặn', async () => {
      await http()
        .patch(urlDongQt(dongId.An))
        .set(auth(token.quanTri))
        .send({ lop: 'Văn 9', ly_do: 'Sau mở lại' })
        .expect(200);
      expect((await hopDong(dot.dHsg, ids.tA)).trang_thai_danh_sach).toBe(
        'cho_xac_nhan',
      );
      expect(maLyDo((await nop('truongA', dot.dHsg)).body)).toEqual([
        'danh_sach_chua_xac_nhan',
      ]);
    });

    it('trường xác nhận lại → nộp lại được, bản chụp mới theo hồ sơ hiện tại', async () => {
      await xacNhanDanhSach('truongA', dot.dHsg);
      const res = await nop('truongA', dot.dHsg).expect(200);
      expect(res.body.trang_thai_hop_dong).toBe('da_nop');
      expect(res.body.ban_chup_ho_so.ma_qhns).toBe('1112223');
      expect(res.body.chuyen_khoan.stk).toBe('HCMUE1112223');
      expect(await nhatKy('nop_hop_dong', dot.dHsg)).toHaveLength(2);
    });
  });
});
