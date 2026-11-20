import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { randomUUID } from 'crypto';
import { createTestApp } from './utils/test-app';
import {
  prisma,
  taoDonViTest,
  taoNguoiDungTest,
  uniqueSuffix,
  xoaDonViTest,
  xoaNguoiDungTest,
} from './utils/test-data';

// Issue #62 / ADR 0015 X2: trường gửi đề nghị sửa / thêm / bớt người; Quản trị Áp dụng / Từ chối.
// Các test chạy TUẦN TỰ trên cùng dữ liệu (mỗi bước là 1 chuyển trạng thái). Mọi họ tên / mã / tên trường
// đều BỊA — không có PII thật.
describe('Đề nghị sửa danh sách - Cổng đơn vị (e2e)', () => {
  let app: INestApplication;
  let fixture: Awaited<ReturnType<typeof taoDonViTest>>;
  type NguoiDungTest = Awaited<ReturnType<typeof taoNguoiDungTest>>;
  const nguoiDung: NguoiDungTest[] = [];
  type VaiTroTest = 'quanTri' | 'truongA' | 'truongB' | 'so';
  const token = {} as Record<VaiTroTest, string>;
  const userId = {} as Record<'quanTri' | 'truongA' | 'truongB', string>;

  const suf = uniqueSuffix();
  const MAT_KHAU = 'MatKhau123';
  // Thứ tự tạo = thứ tự xóa ngược (con trước cha).
  const donViIds: string[] = [];
  const dotIds: string[] = [];
  const ids = {} as Record<'so' | 'tA' | 'tB', string>;
  // d1: A (An, Bình, Chi, Dung, Em) + B (Hà, Khoa); d2: chỉ B (Lan) — A không có dòng hợp đồng ở d2.
  const dot = {} as Record<'d1' | 'd2', string>;
  // Id dòng theo tên (từ thứ 3 của họ tên, không hậu tố).
  const dongId: Record<string, string> = {};
  // Id đề nghị theo nhãn của bước test.
  const deNghiId: Record<string, string> = {};

  const http = () => request(app.getHttpServer());
  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });
  const urlDs = (dotId: string) => `/cong-don-vi/truong/dot/${dotId}/danh-sach`;
  const urlGui = (dotId: string) => `/cong-don-vi/truong/dot/${dotId}/de-nghi`;
  const urlHangDoi = (dotId: string, qs = '') =>
    `/cong-don-vi/dot-trien-khai/${dotId}/de-nghi${qs}`;
  const urlApDung = (id: string) => `/cong-don-vi/de-nghi-sua/${id}/ap-dung`;
  const urlTuChoi = (id: string) => `/cong-don-vi/de-nghi-sua/${id}/tu-choi`;
  const urlDongQt = (id: string) => `/cong-don-vi/danh-sach-tham-gia/${id}`;
  const urlQt = (dotId: string, duoi: string) =>
    `/cong-don-vi/dot-trien-khai/${dotId}/${duoi}`;

  const gui = (vaiTro: VaiTroTest, body: object, dotId = dot.d1) =>
    http().post(urlGui(dotId)).set(auth(token[vaiTro])).send(body);
  const apDung = (id: string, vaiTro: VaiTroTest = 'quanTri') =>
    http().post(urlApDung(id)).set(auth(token[vaiTro]));
  const tuChoi = (id: string, body: object, vaiTro: VaiTroTest = 'quanTri') =>
    http().post(urlTuChoi(id)).set(auth(token[vaiTro])).send(body);
  const yKien = (vaiTro: VaiTroTest, id: string, y: unknown) =>
    http()
      .put(`${urlDs(dot.d1)}/${id}/y-kien`)
      .set(auth(token[vaiTro]))
      .send({ y_kien: y });
  const xacNhan = (vaiTro: VaiTroTest = 'truongA') =>
    http()
      .post(`${urlDs(dot.d1)}/xac-nhan`)
      .set(auth(token[vaiTro]));
  const dongYTatCa = (vaiTro: VaiTroTest = 'truongA') =>
    http()
      .post(`${urlDs(dot.d1)}/dong-y-tat-ca`)
      .set(auth(token[vaiTro]));
  const xem = (vaiTro: VaiTroTest = 'truongA', dotId = dot.d1) =>
    http().get(urlDs(dotId)).set(auth(token[vaiTro]));
  const hangDoi = (qs = '') =>
    http().get(urlHangDoi(dot.d1, qs)).set(auth(token.quanTri));

  const ten = (t: string) => `GV Bịa ${t} ${suf}`;

  async function dangNhap(ten_dang_nhap: string) {
    const res = await http()
      .post('/auth/dang-nhap')
      .send({ ten_dang_nhap, mat_khau: MAT_KHAU })
      .expect(200);
    return res.body.token as string;
  }

  async function taoTaiKhoan(
    vai_tro: 'quan_tri' | 'truong' | 'so_gddt',
    don_vi_id: string,
  ) {
    const u = await taoNguoiDungTest({
      vai_tro,
      don_vi_id,
      mat_khau: MAT_KHAU,
    });
    nguoiDung.push(u);
    return { token: await dangNhap(u.ten_dang_nhap), id: u.nguoiDung.id };
  }

  async function taoDonVi(
    tenDv: string,
    loai: 'so_gddt' | 'truong',
    cha: string | null,
  ) {
    const dv = await prisma.don_vi_cong_tac.create({
      data: {
        ma_don_vi: `DNS-${uniqueSuffix()}`,
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

  async function taoDot(tenDot: string) {
    const d = await prisma.dot_trien_khai.create({
      data: {
        chuong_trinh: 'hsg',
        ten: `${tenDot} ${suf}`,
        don_gia: 1_000_000,
        han_nop: new Date('2026-12-31T16:59:59Z'),
        so_gddt_id: ids.so,
      },
    });
    dotIds.push(d.id);
    return d.id;
  }

  const dong = (don_vi_id: string, t: string, nua = false) => ({
    don_vi_id,
    ho_ten: ten(t),
    ngay_sinh: '1991-03-04',
    gioi_tinh: 'Nữ',
    lop: 'Toán 9',
    giai_doan: nua ? 'chi_gd1' : 'ca_hai',
  });

  const nap = (dotId: string, ds: unknown[]) =>
    http()
      .post(urlQt(dotId, 'danh-sach/nap'))
      .set(auth(token.quanTri))
      .send({ dong: ds });

  const hopDong = (don_vi_id: string, dotId = dot.d1) =>
    prisma.hop_dong_boi_duong.findUniqueOrThrow({
      where: {
        dot_trien_khai_id_don_vi_id: { dot_trien_khai_id: dotId, don_vi_id },
      },
    });
  const dongDb = (id: string) =>
    prisma.danh_sach_tham_gia.findUnique({ where: { id } });
  const deNghiDb = (id: string) =>
    prisma.de_nghi_sua_danh_sach.findUniqueOrThrow({ where: { id } });

  const nhatKyDeNghi = (hanh_dong: string, id: string) =>
    prisma.nhat_ky_hoat_dong.findMany({
      where: { hanh_dong, chi_tiet: { path: ['de_nghi_id'], equals: id } },
    });

  async function ghiIdDong(vaiTro: VaiTroTest, dotId = dot.d1) {
    const res = await xem(vaiTro, dotId).expect(200);
    for (const d of res.body.dong as { id: string; ho_ten: string }[]) {
      dongId[d.ho_ten.split(' ')[2]] = d.id;
    }
  }

  /** Gửi đề nghị thành công → id đề nghị mới nhất (de_nghi xếp mới nhất trước). */
  async function guiOk(vaiTro: VaiTroTest, body: object) {
    const res = await gui(vaiTro, body);
    expect(res.status).toBe(201);
    return { id: res.body.de_nghi[0].id as string, body: res.body };
  }

  beforeAll(async () => {
    app = await createTestApp({ raiseThrottlerLimit: true });
    fixture = await taoDonViTest('dns');
    ids.so = await taoDonVi(`Sở thử đề nghị ${suf}`, 'so_gddt', null);
    ids.tA = await taoDonVi(`Trường A Thử Đề Nghị ${suf}`, 'truong', ids.so);
    ids.tB = await taoDonVi(`Trường B Thử Đề Nghị ${suf}`, 'truong', ids.so);
    dot.d1 = await taoDot('HSG đề nghị 1');
    dot.d2 = await taoDot('HSG đề nghị 2');

    const qt = await taoTaiKhoan('quan_tri', fixture.donVi.id);
    token.quanTri = qt.token;
    userId.quanTri = qt.id;
    const a = await taoTaiKhoan('truong', ids.tA);
    token.truongA = a.token;
    userId.truongA = a.id;
    const b = await taoTaiKhoan('truong', ids.tB);
    token.truongB = b.token;
    userId.truongB = b.id;
    token.so = (await taoTaiKhoan('so_gddt', ids.so)).token;

    const res = await nap(dot.d1, [
      dong(ids.tA, 'An'),
      dong(ids.tA, 'Bình', true),
      dong(ids.tA, 'Chi'),
      dong(ids.tA, 'Dung'),
      dong(ids.tA, 'Em'),
      dong(ids.tB, 'Hà'),
      dong(ids.tB, 'Khoa'),
    ]);
    expect(res.status).toBe(200);
    expect((await nap(dot.d2, [dong(ids.tB, 'Lan')])).status).toBe(200);
    await ghiIdDong('truongA');
    await ghiIdDong('truongB');
    await ghiIdDong('truongB', dot.d2);
  });

  afterAll(async () => {
    // Chỉ xóa đúng các dòng file này tạo (theo id đợt / id đã ghi; mảng rỗng thì bỏ qua), con trước cha.
    // nhat_ky_hoat_dong chỉ cho thêm (trigger chặn xóa) — để nguyên.
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
      const id = randomUUID();
      await http().post(urlGui(dot.d1)).send({ loai: 'bot' }).expect(401);
      await http().get(urlHangDoi(dot.d1)).expect(401);
      await http().post(urlApDung(id)).expect(401);
      await http().post(urlTuChoi(id)).send({ ly_do: 'x' }).expect(401);
    });

    it('trường → 403 ở hàng đợi / Áp dụng / Từ chối của Quản trị', async () => {
      const id = randomUUID();
      await http().get(urlHangDoi(dot.d1)).set(auth(token.truongA)).expect(403);
      expect((await apDung(id, 'truongA')).status).toBe(403);
      expect((await tuChoi(id, { ly_do: 'x' }, 'truongA')).status).toBe(403);
    });

    it('trường → 403 ở API sửa/thêm/xóa dòng trực tiếp của Quản trị; dòng không đổi', async () => {
      const a = auth(token.truongA);
      await http()
        .patch(urlDongQt(dongId.An))
        .set(a)
        .send({ ly_do: 'x', ho_ten: 'Tự sửa' })
        .expect(403);
      await http()
        .post(urlQt(dot.d1, 'danh-sach'))
        .set(a)
        .send({ ...dong(ids.tA, 'Tự Thêm'), ly_do: 'x' })
        .expect(403);
      await http()
        .delete(urlDongQt(dongId.An))
        .set(a)
        .send({ ly_do: 'x' })
        .expect(403);
      expect((await dongDb(dongId.An))!.ho_ten).toBe(ten('An'));
    });

    it('so_gddt → 403 ở gửi đề nghị và hàng đợi', async () => {
      expect(
        (await gui('so', { loai: 'them', gia_tri: { ho_ten: 'X' } })).status,
      ).toBe(403);
      await http().get(urlHangDoi(dot.d1)).set(auth(token.so)).expect(403);
      expect((await apDung(randomUUID(), 'so')).status).toBe(403);
    });
  });

  describe('Kiểm tra dữ liệu gửi đề nghị (400 / 404) — không tạo gì', () => {
    it.each([
      [
        'bớt không lý do',
        () => ({ loai: 'bot', dong_id: dongId.An }),
        /Nhập lý do bớt người/,
      ],
      [
        'bớt lý do trống',
        () => ({ loai: 'bot', dong_id: dongId.An, ly_do: '   ' }),
        /Nhập lý do bớt người/,
      ],
      [
        'sửa không đổi gì',
        () => ({
          loai: 'sua',
          dong_id: dongId.An,
          gia_tri: { ho_ten: ` ${ten('An')} `, lop: 'Toán 9' },
        }),
        /Không có thay đổi nào so với dòng hiện tại/,
      ],
      [
        'sửa suất',
        () => ({
          loai: 'sua',
          dong_id: dongId.An,
          gia_tri: { ty_le_suat: 0.5 },
        }),
        /Không đề nghị được "ty_le_suat"/,
      ],
      [
        'sửa trường (don_vi_id)',
        () => ({
          loai: 'sua',
          dong_id: dongId.An,
          gia_tri: { don_vi_id: ids.tB },
        }),
        /Không đề nghị được "don_vi_id"/,
      ],
      [
        'sửa ngày sai',
        () => ({
          loai: 'sua',
          dong_id: dongId.An,
          gia_tri: { ngay_sinh: '31/12/1990' },
        }),
        /Ngày sinh phải là ngày dạng YYYY-MM-DD/,
      ],
      [
        'sửa thiếu dong_id',
        () => ({ loai: 'sua', gia_tri: { lop: 'Lý 6' } }),
        /Chọn dòng cần đề nghị/,
      ],
      [
        'thêm kèm dong_id',
        () => ({
          loai: 'them',
          dong_id: dongId.An,
          gia_tri: { ho_ten: ten('Thêm') },
        }),
        /không gắn với dòng/,
      ],
      [
        'thêm thiếu họ tên',
        () => ({ loai: 'them', gia_tri: { lop: 'Lý 6' } }),
        /Họ tên không được trống/,
      ],
      [
        'loại lạ',
        () => ({ loai: 'doi', dong_id: dongId.An }),
        /loai phải là sua, them hoặc bot/,
      ],
      [
        'gia_tri không phải đối tượng',
        () => ({ loai: 'them', gia_tri: 'GV Bịa' }),
        /gia_tri phải là đối tượng/,
      ],
      [
        'lý do quá 500 ký tự',
        () => ({ loai: 'bot', dong_id: dongId.An, ly_do: 'x'.repeat(501) }),
        /Lý do tối đa 500 ký tự/,
      ],
    ])('%s → 400 VALIDATION_ERROR', async (_ten, body, thongDiep) => {
      const res = await gui('truongA', body());
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      const { message, fields = [] } = res.body.error as {
        message: string;
        fields?: { message: string }[];
      };
      expect([message, ...fields.map((f) => f.message)].join(' | ')).toMatch(
        thongDiep,
      );
    });

    it('A đề nghị trên dòng của B → 404; dòng đợt khác → 404', async () => {
      expect(
        (
          await gui('truongA', {
            loai: 'bot',
            dong_id: dongId['Hà'],
            ly_do: 'x',
          })
        ).status,
      ).toBe(404);
      expect(
        (await gui('truongA', { loai: 'bot', dong_id: dongId.Lan, ly_do: 'x' }))
          .status,
      ).toBe(404);
    });

    it('đợt không có dòng hợp đồng của trường / đợt không tồn tại → 404', async () => {
      const them = { loai: 'them', gia_tri: { ho_ten: ten('Lạc') } };
      expect((await gui('truongA', them, dot.d2)).status).toBe(404);
      expect((await gui('truongA', them, randomUUID())).status).toBe(404);
    });

    it('sau các lần lỗi: không có đề nghị, ý kiến + trạng thái không đổi', async () => {
      expect(
        await prisma.de_nghi_sua_danh_sach.count({
          where: { dot_trien_khai_id: { in: dotIds } },
        }),
      ).toBe(0);
      const res = await xem().expect(200);
      expect(res.body).toMatchObject({
        trang_thai_danh_sach: 'cho_xac_nhan',
        de_nghi: [],
        so_de_nghi_cho: 0,
      });
      expect(
        res.body.dong.every(
          (d: { y_kien_truong: unknown }) => d.y_kien_truong === null,
        ),
      ).toBe(true);
    });
  });

  describe('Đề nghị sửa', () => {
    it('gửi → 201, dòng Không đồng ý, Báo sai lệch, chỉ lưu trường đã đổi + bản chụp; nhật ký không PII', async () => {
      const res = await gui('truongA', {
        loai: 'sua',
        dong_id: dongId.An,
        gia_tri: {
          ho_ten: ten('An Sửa'),
          lop: 'Toán 9',
          giai_doan: 'chi_gd2',
        },
        ly_do: 'Sai họ tên (bịa)',
      });
      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        trang_thai_danh_sach: 'bao_sai_lech',
        so_de_nghi_cho: 1,
        co_the_xac_nhan: false,
      });
      const dn = res.body.de_nghi[0];
      deNghiId.suaAn = dn.id;
      expect(dn).toMatchObject({
        loai: 'sua',
        dong_id: dongId.An,
        gia_tri: { ho_ten: ten('An Sửa'), giai_doan: 'chi_gd2' },
        gia_tri_cu: {
          ho_ten: ten('An'),
          ngay_sinh: '1991-03-04',
          gioi_tinh: 'Nữ',
          lop: 'Toán 9',
          giai_doan: 'ca_hai',
          ty_le_suat: 1,
        },
        ly_do: 'Sai họ tên (bịa)',
        trang_thai: 'cho',
        ly_do_tu_choi: null,
        xu_ly_luc: null,
      });
      expect(Object.keys(dn.gia_tri).sort()).toEqual(['giai_doan', 'ho_ten']);
      expect(
        res.body.dong.find((d: { id: string }) => d.id === dongId.An)
          .y_kien_truong,
      ).toBe('khong_dong_y');
      const hd = await hopDong(ids.tA);
      expect(hd.trang_thai_danh_sach).toBe('bao_sai_lech');
      expect(hd.thao_tac_cuoi_boi).toBe(userId.truongA);

      const nk = await nhatKyDeNghi('gui_de_nghi_sua_danh_sach', dn.id);
      expect(nk).toHaveLength(1);
      expect(nk[0].nguoi_dung_id).toBe(userId.truongA);
      expect(nk[0].vai_tro).toBe('truong');
      expect(nk[0].chi_tiet).toEqual({
        dot_trien_khai_id: dot.d1,
        don_vi_id: ids.tA,
        de_nghi_id: dn.id,
        loai: 'sua',
        dong_id: dongId.An,
      });
    });

    it('đề nghị thứ 2 trên cùng dòng → 409; đổi ý kiến dòng đang chờ → 409', async () => {
      const res = await gui('truongA', {
        loai: 'bot',
        dong_id: dongId.An,
        ly_do: 'x',
      });
      expect(res.status).toBe(409);
      expect(res.body.error).toEqual({
        code: 'CONFLICT',
        message: 'Dòng này đã có đề nghị đang chờ HCMUE xử lý',
      });
      for (const y of ['dong_y', null, 'khong_dong_y']) {
        const r = await yKien('truongA', dongId.An, y);
        expect(r.status).toBe(409);
        expect(r.body.error.message).toBe(
          'Dòng đang có đề nghị chờ HCMUE xử lý',
        );
      }
      expect((await dongDb(dongId.An))!.y_kien_truong).toBe('khong_dong_y');
    });

    it('Đồng ý tất cả bỏ qua dòng đang chờ; Xác nhận bị chặn', async () => {
      const res = await dongYTatCa();
      expect(res.status).toBe(200);
      expect(res.body.trang_thai_danh_sach).toBe('bao_sai_lech');
      expect((await dongDb(dongId.An))!.y_kien_truong).toBe('khong_dong_y');
      const xn = await xacNhan();
      expect(xn.status).toBe(400);
      expect(xn.body.error).toMatchObject({
        code: 'VALIDATION_ERROR',
        message: 'Còn 1 dòng chưa Đồng ý',
      });
    });

    it('Quản trị xem hàng đợi (mặc định chờ) + danh sách có cờ đề nghị chờ', async () => {
      const res = await hangDoi();
      expect(res.status).toBe(200);
      expect(res.body.so_cho).toBe(1);
      expect(res.body.items).toHaveLength(1);
      expect(res.body.items[0]).toMatchObject({
        id: deNghiId.suaAn,
        don_vi: { id: ids.tA, ten: `Trường A Thử Đề Nghị ${suf}` },
        loai: 'sua',
        dong_id: dongId.An,
        dong_hien_tai: {
          ho_ten: ten('An'),
          giai_doan: 'ca_hai',
          ty_le_suat: 1,
          y_kien_truong: 'khong_dong_y',
        },
        gia_tri: { ho_ten: ten('An Sửa'), giai_doan: 'chi_gd2' },
        ly_do: 'Sai họ tên (bịa)',
        trang_thai: 'cho',
        gui_boi: { id: userId.truongA },
        xu_ly_boi: null,
      });

      const ds = await http()
        .get(urlQt(dot.d1, 'danh-sach'))
        .set(auth(token.quanTri))
        .expect(200);
      const soCho = Object.fromEntries(
        ds.body.tong_hop.map(
          (t: { don_vi_id: string; so_de_nghi_cho: number }) => [
            t.don_vi_id,
            t.so_de_nghi_cho,
          ],
        ),
      );
      expect(soCho).toEqual({ [ids.tA]: 1, [ids.tB]: 0 });
      const co = ds.body.dong.filter(
        (d: { co_de_nghi_cho: boolean }) => d.co_de_nghi_cho,
      );
      expect(co.map((d: { id: string }) => d.id)).toEqual([dongId.An]);
    });

    it('Áp dụng → dòng đổi đúng trường, suất suy lại theo giai đoạn, Đồng ý; Chờ xác nhận; nhật ký trước/sau', async () => {
      const res = await apDung(deNghiId.suaAn);
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        id: deNghiId.suaAn,
        trang_thai: 'da_ap_dung',
        xu_ly_boi: { id: userId.quanTri },
      });
      const db = await dongDb(dongId.An);
      expect(db).toMatchObject({
        ho_ten: ten('An Sửa'),
        lop: 'Toán 9',
        gioi_tinh: 'Nữ',
        giai_doan: 'chi_gd2',
        y_kien_truong: 'dong_y',
      });
      expect(Number(db!.ty_le_suat)).toBe(0.5);
      const hd = await hopDong(ids.tA);
      expect(hd.trang_thai_danh_sach).toBe('cho_xac_nhan');
      expect(hd.thao_tac_cuoi_boi).toBe(userId.quanTri);

      const nk = await nhatKyDeNghi(
        'ap_dung_de_nghi_sua_danh_sach',
        deNghiId.suaAn,
      );
      expect(nk).toHaveLength(1);
      expect(nk[0].nguoi_dung_id).toBe(userId.quanTri);
      expect(nk[0].chi_tiet).toEqual({
        dot_trien_khai_id: dot.d1,
        don_vi_id: ids.tA,
        de_nghi_id: deNghiId.suaAn,
        loai: 'sua',
        dong_id: dongId.An,
        truoc: {
          ho_ten: ten('An'),
          giai_doan: 'ca_hai',
          ty_le_suat: 1,
          y_kien_truong: 'khong_dong_y',
        },
        sau: {
          ho_ten: ten('An Sửa'),
          giai_doan: 'chi_gd2',
          ty_le_suat: 0.5,
          y_kien_truong: 'dong_y',
        },
      });
    });

    it('Áp dụng / Từ chối lại đề nghị đã xử lý → 409, không đổi gì', async () => {
      const a = await apDung(deNghiId.suaAn);
      expect(a.status).toBe(409);
      expect(a.body.error).toEqual({
        code: 'CONFLICT',
        message: 'Đề nghị đã được xử lý',
      });
      const t = await tuChoi(deNghiId.suaAn, { ly_do: 'muộn' });
      expect(t.status).toBe(409);
      expect((await deNghiDb(deNghiId.suaAn)).trang_thai).toBe('da_ap_dung');
      expect((await apDung(randomUUID())).status).toBe(404);
    });

    it('sau Áp dụng mọi dòng Đồng ý → Xác nhận được', async () => {
      const res = await xacNhan();
      expect(res.status).toBe(200);
      expect(res.body.trang_thai_danh_sach).toBe('da_xac_nhan');
    });

    it('Từ chối: thiếu / trống lý do → 400 VALIDATION_ERROR, đề nghị vẫn chờ', async () => {
      const { id, body } = await guiOk('truongA', {
        loai: 'sua',
        dong_id: dongId['Bình'],
        gia_tri: { lop: 'Lý 8' },
      });
      deNghiId.suaBinh = id;
      expect(body.trang_thai_danh_sach).toBe('bao_sai_lech');
      for (const b of [{}, { ly_do: '' }, { ly_do: '   ' }, { ly_do: 5 }]) {
        const res = await tuChoi(id, b);
        expect(res.status).toBe(400);
        expect(res.body.error.code).toBe('VALIDATION_ERROR');
      }
      expect((await tuChoi(id, { ly_do: 'x'.repeat(501) })).status).toBe(400);
      expect((await deNghiDb(id)).trang_thai).toBe('cho');
    });

    it('Từ chối có lý do → dòng không đổi, về chưa có ý kiến; trường thấy lý do; Chờ xác nhận nhưng chưa Xác nhận được', async () => {
      const res = await tuChoi(deNghiId.suaBinh, {
        ly_do: '  Lớp đúng theo hồ sơ (bịa) ',
      });
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        trang_thai: 'tu_choi',
        ly_do_tu_choi: 'Lớp đúng theo hồ sơ (bịa)',
      });
      const db = await dongDb(dongId['Bình']);
      expect(db).toMatchObject({ lop: 'Toán 9', y_kien_truong: null });

      const ds = await xem().expect(200);
      expect(ds.body).toMatchObject({
        trang_thai_danh_sach: 'cho_xac_nhan',
        so_de_nghi_cho: 0,
        co_the_xac_nhan: false,
        ly_do_khong_xac_nhan: 'Còn 1 dòng chưa Đồng ý',
      });
      expect(ds.body.de_nghi[0]).toMatchObject({
        id: deNghiId.suaBinh,
        trang_thai: 'tu_choi',
        ly_do_tu_choi: 'Lớp đúng theo hồ sơ (bịa)',
      });
      expect(ds.body.de_nghi[0].xu_ly_luc).toEqual(expect.any(String));
      expect((await xacNhan()).status).toBe(400);

      const nk = await nhatKyDeNghi(
        'tu_choi_de_nghi_sua_danh_sach',
        deNghiId.suaBinh,
      );
      expect(nk).toHaveLength(1);
      expect(nk[0].chi_tiet).toEqual({
        dot_trien_khai_id: dot.d1,
        don_vi_id: ids.tA,
        de_nghi_id: deNghiId.suaBinh,
        loai: 'sua',
        dong_id: dongId['Bình'],
        ly_do: 'Lớp đúng theo hồ sơ (bịa)',
      });
      // Hết chờ → trường lại cho ý kiến được.
      expect((await yKien('truongA', dongId['Bình'], 'dong_y')).status).toBe(
        200,
      );
    });
  });

  describe('Đề nghị thêm người', () => {
    it('đề nghị thêm chờ (mọi dòng Đồng ý) → Báo sai lệch, Xác nhận 400 "Còn đề nghị sửa đang chờ"', async () => {
      const { id, body } = await guiOk('truongA', {
        loai: 'them',
        gia_tri: { ho_ten: ten('Mới'), lop: 'Văn 6', giai_doan: 'chi_gd1' },
        ly_do: 'Bổ sung người (bịa)',
      });
      deNghiId.themMoi = id;
      expect(body).toMatchObject({
        trang_thai_danh_sach: 'bao_sai_lech',
        co_the_xac_nhan: false,
        ly_do_khong_xac_nhan: 'Còn đề nghị sửa đang chờ',
      });
      expect(body.de_nghi[0]).toMatchObject({
        loai: 'them',
        dong_id: null,
        gia_tri_cu: null,
        gia_tri: {
          ho_ten: ten('Mới'),
          ngay_sinh: null,
          gioi_tinh: null,
          lop: 'Văn 6',
          giai_doan: 'chi_gd1',
        },
      });
      const xn = await xacNhan();
      expect(xn.status).toBe(400);
      expect(xn.body.error).toMatchObject({
        code: 'VALIDATION_ERROR',
        message: 'Còn đề nghị sửa đang chờ',
      });
    });

    it('Áp dụng → có dòng mới của trường, Đồng ý, đúng suất; đề nghị không gắn dòng; nhật ký có id dòng mới', async () => {
      const res = await apDung(deNghiId.themMoi);
      expect(res.status).toBe(200);
      expect(res.body.dong_id).toBeNull();
      const moi = await prisma.danh_sach_tham_gia.findMany({
        where: { dot_trien_khai_id: dot.d1, ho_ten: ten('Mới') },
      });
      expect(moi).toHaveLength(1);
      expect(moi[0]).toMatchObject({
        don_vi_id: ids.tA,
        lop: 'Văn 6',
        giai_doan: 'chi_gd1',
        y_kien_truong: 'dong_y',
        hoc_vien_id: null,
        ma_goc: null,
        created_by: userId.quanTri,
      });
      expect(Number(moi[0].ty_le_suat)).toBe(0.5);
      dongId['Mới'] = moi[0].id;
      expect((await hopDong(ids.tA)).trang_thai_danh_sach).toBe('cho_xac_nhan');
      const nk = await nhatKyDeNghi(
        'ap_dung_de_nghi_sua_danh_sach',
        deNghiId.themMoi,
      );
      expect(nk[0].chi_tiet).toMatchObject({
        loai: 'them',
        dong_id: moi[0].id,
        truoc: null,
        sau: {
          dong_id: moi[0].id,
          ho_ten: ten('Mới'),
          giai_doan: 'chi_gd1',
          ty_le_suat: 0.5,
          y_kien_truong: 'dong_y',
        },
      });
      expect((await xacNhan()).body.trang_thai_danh_sach).toBe('da_xac_nhan');
    });

    it('Từ chối → không có dòng mới; trạng thái về Chờ xác nhận', async () => {
      const { id } = await guiOk('truongA', {
        loai: 'them',
        gia_tri: { ho_ten: ten('Không Nhận') },
      });
      expect((await hopDong(ids.tA)).trang_thai_danh_sach).toBe('bao_sai_lech');
      const res = await tuChoi(id, { ly_do: 'Không thuộc đối tượng (bịa)' });
      expect(res.status).toBe(200);
      expect(
        await prisma.danh_sach_tham_gia.count({
          where: { dot_trien_khai_id: dot.d1, ho_ten: ten('Không Nhận') },
        }),
      ).toBe(0);
      expect((await hopDong(ids.tA)).trang_thai_danh_sach).toBe('cho_xac_nhan');
      const ds = await xem().expect(200);
      expect(ds.body.co_the_xac_nhan).toBe(true);
    });
  });

  describe('Đề nghị bớt người', () => {
    it('Áp dụng → dòng bị xóa; đề nghị giữ bản chụp, dong_id NULL; nhật ký trước = cả dòng', async () => {
      const { id, body } = await guiOk('truongA', {
        loai: 'bot',
        dong_id: dongId.Chi,
        ly_do: 'Không tham gia học (bịa)',
      });
      expect(body.de_nghi[0].gia_tri).toEqual({});
      const res = await apDung(id);
      expect(res.status).toBe(200);
      expect(await dongDb(dongId.Chi)).toBeNull();
      const dn = await deNghiDb(id);
      expect(dn).toMatchObject({ trang_thai: 'da_ap_dung', dong_id: null });
      expect(dn.gia_tri_cu).toMatchObject({ ho_ten: ten('Chi') });
      expect((await hopDong(ids.tA)).trang_thai_danh_sach).toBe('cho_xac_nhan');
      const nk = await nhatKyDeNghi('ap_dung_de_nghi_sua_danh_sach', id);
      expect(nk[0].chi_tiet).toMatchObject({
        loai: 'bot',
        dong_id: dongId.Chi,
        truoc: { ho_ten: ten('Chi'), don_vi_id: ids.tA, ty_le_suat: 1 },
        sau: null,
      });
    });

    it('Từ chối → dòng vẫn còn, về chưa có ý kiến', async () => {
      const { id } = await guiOk('truongA', {
        loai: 'bot',
        dong_id: dongId.Dung,
        ly_do: 'Nghỉ (bịa)',
      });
      expect((await dongDb(dongId.Dung))!.y_kien_truong).toBe('khong_dong_y');
      expect((await tuChoi(id, { ly_do: 'Vẫn học (bịa)' })).status).toBe(200);
      expect(await dongDb(dongId.Dung)).toMatchObject({
        ho_ten: ten('Dung'),
        y_kien_truong: null,
      });
      expect((await hopDong(ids.tA)).trang_thai_danh_sach).toBe('cho_xac_nhan');
    });
  });

  describe('Phạm vi + bộ lọc hàng đợi', () => {
    it('B gửi đề nghị → A không thấy; hàng đợi lọc theo trường', async () => {
      const { id } = await guiOk('truongB', {
        loai: 'sua',
        dong_id: dongId['Hà'],
        gia_tri: { gioi_tinh: 'Nam' },
      });
      deNghiId.suaHa = id;
      const a = await xem().expect(200);
      expect(a.body.de_nghi.map((d: { id: string }) => d.id)).not.toContain(id);
      expect(a.body.de_nghi).toHaveLength(6);

      const theoB = await hangDoi(`?don_vi_id=${ids.tB}`).expect(200);
      expect(theoB.body.items.map((d: { id: string }) => d.id)).toEqual([id]);
      expect(theoB.body.so_cho).toBe(1);
      const theoA = await hangDoi(`?don_vi_id=${ids.tA}`).expect(200);
      expect(theoA.body.items).toEqual([]);
    });

    it('lọc trạng thái: đã áp dụng (3, mới nhất trước) / từ chối (3) / tham số sai → 400', async () => {
      const ad = await hangDoi('?trang_thai=da_ap_dung').expect(200);
      expect(ad.body.items.map((d: { loai: string }) => d.loai)).toEqual([
        'bot',
        'them',
        'sua',
      ]);
      expect(ad.body.items[0].dong_hien_tai).toBeNull();
      const tc = await hangDoi('?trang_thai=tu_choi').expect(200);
      expect(tc.body.items).toHaveLength(3);
      expect(
        tc.body.items.every(
          (d: { ly_do_tu_choi: string }) => !!d.ly_do_tu_choi,
        ),
      ).toBe(true);
      expect(tc.body.so_cho).toBe(1);
      expect((await hangDoi('?trang_thai=xong')).status).toBe(400);
      expect((await hangDoi('?don_vi_id=abc')).status).toBe(400);
      await http()
        .get(urlHangDoi(randomUUID()))
        .set(auth(token.quanTri))
        .expect(404);
    });
  });

  describe('Quản trị sửa trực tiếp khi có đề nghị chờ', () => {
    it('PATCH dòng đang có đề nghị → được, đề nghị vẫn chờ, trường vẫn Báo sai lệch', async () => {
      const res = await http()
        .patch(urlDongQt(dongId['Hà']))
        .set(auth(token.quanTri))
        .send({ ly_do: 'Sửa lớp (bịa)', lop: 'Toán 7' });
      expect(res.status).toBe(200);
      expect((await deNghiDb(deNghiId.suaHa)).trang_thai).toBe('cho');
      const hd = await hopDong(ids.tB);
      expect(hd.trang_thai_danh_sach).toBe('bao_sai_lech');
      expect(hd.thao_tac_cuoi_boi).toBe(userId.quanTri);
    });

    it('DELETE dòng có đề nghị sửa chờ → tự Từ chối "Quản trị đã xóa dòng này"; Áp dụng sau đó → 409', async () => {
      const { id } = await guiOk('truongA', {
        loai: 'sua',
        dong_id: dongId.Em,
        gia_tri: { lop: 'Sử 9' },
      });
      const res = await http()
        .delete(urlDongQt(dongId.Em))
        .set(auth(token.quanTri))
        .send({ ly_do: 'Trùng (bịa)' });
      expect(res.status).toBe(204);
      const dn = await deNghiDb(id);
      expect(dn).toMatchObject({
        trang_thai: 'tu_choi',
        ly_do_tu_choi: 'Quản trị đã xóa dòng này',
        xu_ly_boi: userId.quanTri,
        dong_id: null,
      });
      expect(dn.xu_ly_luc).not.toBeNull();
      const ap = await apDung(id);
      expect(ap.status).toBe(409);
      expect(ap.body.error.message).toBe('Đề nghị đã được xử lý');
      // Không còn đề nghị chờ / dòng Không đồng ý → Chờ xác nhận.
      expect((await hopDong(ids.tA)).trang_thai_danh_sach).toBe('cho_xac_nhan');
      const nk = await nhatKyDeNghi('tu_choi_de_nghi_sua_danh_sach', id);
      expect(nk).toHaveLength(1);
      expect(nk[0].nguoi_dung_id).toBe(userId.quanTri);
      expect(nk[0].chi_tiet).toEqual({
        dot_trien_khai_id: dot.d1,
        don_vi_id: ids.tA,
        de_nghi_id: id,
        loai: 'sua',
        dong_id: dongId.Em,
        ly_do: 'Quản trị đã xóa dòng này',
      });
    });

    it('nạp lại trường B → tự Từ chối đề nghị sửa (lý do nạp lại), đề nghị thêm người vẫn chờ → Báo sai lệch', async () => {
      const them = await guiOk('truongB', {
        loai: 'them',
        gia_tri: { ho_ten: ten('Bổ Sung B') },
      });
      const res = await nap(dot.d1, [dong(ids.tB, 'Hà'), dong(ids.tB, 'Khoa')]);
      expect(res.status).toBe(200);
      expect(await deNghiDb(deNghiId.suaHa)).toMatchObject({
        trang_thai: 'tu_choi',
        ly_do_tu_choi: 'Quản trị đã nạp lại danh sách của trường',
        xu_ly_boi: userId.quanTri,
      });
      expect((await deNghiDb(them.id)).trang_thai).toBe('cho');
      expect((await hopDong(ids.tB)).trang_thai_danh_sach).toBe('bao_sai_lech');
      // Trường A không bị đụng.
      expect((await hopDong(ids.tA)).trang_thai_danh_sach).toBe('cho_xac_nhan');
      const nk = await nhatKyDeNghi(
        'tu_choi_de_nghi_sua_danh_sach',
        deNghiId.suaHa,
      );
      expect(nk).toHaveLength(1);
      expect(nk[0].chi_tiet).toMatchObject({
        don_vi_id: ids.tB,
        loai: 'sua',
        ly_do: 'Quản trị đã nạp lại danh sách của trường',
      });

      expect((await tuChoi(them.id, { ly_do: 'Trùng (bịa)' })).status).toBe(
        200,
      );
      expect((await hopDong(ids.tB)).trang_thai_danh_sach).toBe('cho_xac_nhan');
      const hangCho = await hangDoi().expect(200);
      expect(hangCho.body.so_cho).toBe(0);
    });
  });

  it('nhật ký gửi đề nghị của trường không chứa họ tên / ngày sinh / giá trị đề nghị', async () => {
    const nk = await prisma.nhat_ky_hoat_dong.findMany({
      where: {
        hanh_dong: 'gui_de_nghi_sua_danh_sach',
        chi_tiet: { path: ['dot_trien_khai_id'], equals: dot.d1 },
      },
    });
    expect(nk.length).toBe(9);
    expect(JSON.stringify(nk.map((n) => n.chi_tiet))).not.toMatch(
      /GV Bịa|1991|Toán|Văn|Nam/,
    );
    for (const n of nk) {
      expect(Object.keys(n.chi_tiet as object).sort()).toEqual([
        'de_nghi_id',
        'don_vi_id',
        'dong_id',
        'dot_trien_khai_id',
        'loai',
      ]);
    }
  });
});
