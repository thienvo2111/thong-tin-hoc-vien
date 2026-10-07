import * as nodemailer from 'nodemailer';
import {
  docDanhSachTaiKhoan,
  guiEmail,
  HetHanMucGuiEmailError,
  laDiaChiKhongGiaoDuoc,
  laLoiHetHanMuc,
  resetMailTransporterForTest,
} from './mailer.util';

// Yêu cầu: SMTP thật KHÔNG BAO GIỜ gửi tới tên miền dành riêng (RFC 2606/
// 6761) — chặn trước khi mở kết nối SMTP. Địa chỉ thật vẫn đi tiếp.
describe('laDiaChiKhongGiaoDuoc', () => {
  it.each([
    'e2e-truong-65d11388@test.local',
    'a@b.test',
    'x@example.example',
    'y@foo.invalid',
    'z@dev.localhost',
    '  HOA@TRUONG.LOCAL  ',
    'Tên <a@b.local>',
  ])('%s -> chặn', (email) => {
    expect(laDiaChiKhongGiaoDuoc(email)).toBe(true);
  });

  it.each([
    'thien.vpt@gmail.com',
    'boiduongnls@hcmue.edu.vn',
    'a@localtest.vn',
    'a@test.com',
    '',
  ])('%s -> cho qua', (email) => {
    expect(laDiaChiKhongGiaoDuoc(email)).toBe(false);
  });
});

describe('guiEmail — nhánh SMTP thật (tên miền dành riêng)', () => {
  const cu = { host: process.env.SMTP_HOST, port: process.env.SMTP_PORT };
  const thu = (to: string) => ({ to, subject: 's', html: '<p>x</p>' });

  beforeEach(() => {
    // Không có gì lắng nghe cổng 1 -> địa chỉ hợp lệ sẽ lỗi ECONNREFUSED,
    // chứng minh bộ chặn chỉ chặn tên miền dành riêng.
    process.env.SMTP_HOST = '127.0.0.1';
    process.env.SMTP_PORT = '1';
    resetMailTransporterForTest();
  });

  afterAll(() => {
    if (cu.host === undefined) delete process.env.SMTP_HOST;
    else process.env.SMTP_HOST = cu.host;
    if (cu.port === undefined) delete process.env.SMTP_PORT;
    else process.env.SMTP_PORT = cu.port;
    resetMailTransporterForTest();
  });

  it('người nhận .local -> bị chặn trước khi kết nối', async () => {
    await expect(guiEmail(thu('a@test.local'))).rejects.toThrow(
      'tên miền dành riêng',
    );
  });

  it('nhiều người nhận, chỉ 1 địa chỉ dành riêng -> vẫn chặn cả thư', async () => {
    await expect(
      guiEmail(thu('thien.vpt@gmail.com, b@x.test')),
    ).rejects.toThrow('b@x.test');
  });

  it('địa chỉ thật -> đi tiếp tới bước kết nối SMTP', async () => {
    await expect(guiEmail(thu('thien.vpt@gmail.com'))).rejects.toThrow(
      /ECONNREFUSED/,
    );
  });
});

// 2026-10-07: xoay vòng nhiều tài khoản gửi (SMTP_ACCOUNTS).
describe('docDanhSachTaiKhoan', () => {
  const cu = process.env.SMTP_ACCOUNTS;
  afterAll(() => {
    if (cu === undefined) delete process.env.SMTP_ACCOUNTS;
    else process.env.SMTP_ACCOUNTS = cu;
  });

  it('trống -> [] (dùng SMTP_USER/SMTP_PASS như cũ)', () => {
    process.env.SMTP_ACCOUNTS = '';
    expect(docDanhSachTaiKhoan()).toEqual([]);
  });

  it('nhiều tài khoản; mật khẩu ứng dụng có dấu cách / dấu ":" giữ nguyên', () => {
    process.env.SMTP_ACCOUNTS =
      ' a@hcmue.edu.vn:abcd efgh ijkl mnop , b@hcmue.edu.vn:x:y ,';
    expect(docDanhSachTaiKhoan()).toEqual([
      { user: 'a@hcmue.edu.vn', pass: 'abcd efgh ijkl mnop' },
      { user: 'b@hcmue.edu.vn', pass: 'x:y' },
    ]);
  });

  it('thiếu ":" -> báo lỗi cấu hình', () => {
    process.env.SMTP_ACCOUNTS = 'a@hcmue.edu.vn';
    expect(() => docDanhSachTaiKhoan()).toThrow('SMTP_ACCOUNTS sai định dạng');
  });
});

describe('guiEmail — xoay vòng tài khoản', () => {
  const BIEN = [
    'SMTP_HOST',
    'SMTP_ACCOUNTS',
    'SMTP_USER',
    'SMTP_PASS',
    'SMTP_FROM',
    'SMTP_FROM_NAME',
    'SMTP_REPLY_TO',
  ] as const;
  const cu = Object.fromEntries(BIEN.map((k) => [k, process.env[k]]));
  /** sendMail giả theo từng tài khoản (key = auth.user). */
  let gui: Record<string, jest.Mock>;
  let bayGio: number;

  const thu = { to: 'gv@gmail.com', subject: 's', html: '<p>x</p>' };
  const loiHetHanMuc = () =>
    new Error(
      'Data command failed: 550-5.4.5 Daily user sending limit exceeded.',
    );

  beforeEach(() => {
    for (const k of BIEN) delete process.env[k];
    process.env.SMTP_HOST = 'smtp.gmail.com';
    gui = {};
    jest.spyOn(nodemailer, 'createTransport').mockImplementation(((opts: {
      auth?: { user: string };
    }) => {
      const user = opts.auth?.user ?? '(khong-auth)';
      gui[user] = jest.fn().mockResolvedValue({ messageId: user });
      return { use: jest.fn(), sendMail: (m: unknown) => gui[user](m) };
    }) as never);
    bayGio = Date.parse('2026-10-07T12:00:00Z');
    jest.spyOn(Date, 'now').mockImplementation(() => bayGio);
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    resetMailTransporterForTest();
  });

  afterEach(() => jest.restoreAllMocks());

  afterAll(() => {
    for (const k of BIEN) {
      if (cu[k] === undefined) delete process.env[k];
      else process.env[k] = cu[k];
    }
    resetMailTransporterForTest();
  });

  it('chia lần lượt a -> b -> c -> a; From = địa chỉ của chính tài khoản + tên hiển thị chung; Reply-To chung', async () => {
    process.env.SMTP_ACCOUNTS =
      'a@hcmue.edu.vn:p1,b@hcmue.edu.vn:p2,c@hcmue.edu.vn:p3';
    process.env.SMTP_FROM_NAME = 'Bồi dưỡng NLS – HCMUE';
    process.env.SMTP_REPLY_TO = 'hotro@hcmue.edu.vn';

    const daDung: (string | undefined)[] = [];
    for (let i = 0; i < 4; i++) daDung.push((await guiEmail(thu)).taiKhoan);

    expect(daDung).toEqual([
      'a@hcmue.edu.vn',
      'b@hcmue.edu.vn',
      'c@hcmue.edu.vn',
      'a@hcmue.edu.vn',
    ]);
    expect(gui['b@hcmue.edu.vn'].mock.calls[0][0]).toMatchObject({
      ...thu,
      from: '"Bồi dưỡng NLS – HCMUE" <b@hcmue.edu.vn>',
      replyTo: 'hotro@hcmue.edu.vn',
    });
  });

  it('tài khoản hết hạn mức -> gửi lại NGAY bằng tài khoản kế tiếp; nghỉ 1 giờ rồi được thử lại', async () => {
    process.env.SMTP_ACCOUNTS = 'a@x.vn:p,b@x.vn:p';
    await guiEmail(thu); // khởi tạo, a gửi
    gui['b@x.vn'].mockRejectedValueOnce(loiHetHanMuc());

    expect((await guiEmail(thu)).taiKhoan).toBe('a@x.vn'); // b lỗi -> a gửi thay
    expect((await guiEmail(thu)).taiKhoan).toBe('a@x.vn'); // b đang nghỉ
    expect(gui['b@x.vn']).toHaveBeenCalledTimes(1);

    bayGio += 60 * 60 * 1000 + 1;
    const sau1Gio = [
      (await guiEmail(thu)).taiKhoan,
      (await guiEmail(thu)).taiKhoan,
    ];
    expect(sau1Gio).toContain('b@x.vn');
  });

  it('mọi tài khoản hết hạn mức -> HetHanMucGuiEmailError; đang nghỉ thì không gọi SMTP nữa', async () => {
    process.env.SMTP_ACCOUNTS = 'a@x.vn:p,b@x.vn:p';
    await guiEmail(thu);
    gui['a@x.vn'].mockRejectedValue(loiHetHanMuc());
    gui['b@x.vn'].mockRejectedValue(loiHetHanMuc());

    await expect(guiEmail(thu)).rejects.toBeInstanceOf(HetHanMucGuiEmailError);
    await expect(guiEmail(thu)).rejects.toBeInstanceOf(HetHanMucGuiEmailError);
    expect(gui['a@x.vn']).toHaveBeenCalledTimes(2);
    expect(gui['b@x.vn']).toHaveBeenCalledTimes(1);
  });

  it('lỗi KHÁC hết hạn mức (vd. mất kết nối) -> ném nguyên lỗi, không đổi tài khoản, không cho nghỉ', async () => {
    process.env.SMTP_ACCOUNTS = 'a@x.vn:p,b@x.vn:p';
    await guiEmail(thu); // a
    gui['b@x.vn'].mockRejectedValueOnce(new Error('ECONNRESET'));

    await expect(guiEmail(thu)).rejects.toThrow('ECONNRESET');
    expect(gui['a@x.vn']).toHaveBeenCalledTimes(1);
    expect((await guiEmail(thu)).taiKhoan).toBe('b@x.vn');
  });

  it('không có SMTP_ACCOUNTS -> 1 tài khoản SMTP_USER, From = SMTP_FROM như cấu hình cũ', async () => {
    process.env.SMTP_USER = 'boiduongnls@hcmue.edu.vn';
    process.env.SMTP_PASS = 'p';
    process.env.SMTP_FROM = 'BDNLS <boiduongnls@hcmue.edu.vn>';

    const kq = await guiEmail(thu);

    expect(kq.taiKhoan).toBe('boiduongnls@hcmue.edu.vn');
    expect(gui['boiduongnls@hcmue.edu.vn'].mock.calls[0][0]).toMatchObject({
      from: 'BDNLS <boiduongnls@hcmue.edu.vn>',
      replyTo: undefined,
    });
  });
});

describe('laLoiHetHanMuc', () => {
  it.each([
    ['550-5.4.5 Daily user sending limit exceeded', true],
    ['Daily sending limit exceeded', true],
    ['421 4.7.0 Try again later', false],
    ['ECONNREFUSED', false],
  ])('%s -> %s', (msg, kq) => {
    expect(laLoiHetHanMuc(new Error(msg))).toBe(kq);
  });
});
