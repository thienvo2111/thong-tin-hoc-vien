// Sinh bản Word "Hướng dẫn sử dụng hệ thống Bồi dưỡng Năng lực số dành cho học viên" theo thể thức
// văn bản kèm theo công văn (Nghị định 30/2020/NĐ-CP, Phụ lục I), lấy ĐÚNG nội dung trang /huong-dan
// (frontend/src/content/huongDan.ts) — không gõ lại nội dung ở đây; sửa hướng dẫn thì sửa file đó.
//
// Chạy (từ gốc repo):
//   NODE_PATH="$(npm root -g)" node scripts/huong-dan/tao-docx.mjs \
//     [--khoa "khóa bồi dưỡng tại ..."] [--cong-van "123/ĐHSP-..."] [--ngay "ngày 06 tháng 10 năm 2026"]
// Thiếu --cong-van/--ngay thì để dấu chấm cho văn thư điền (không tự đặt số, ngày).
// Cần: gói `docx` (npm i -g docx); esbuild có sẵn trong frontend/node_modules.
// Ảnh: docs/huong-dan-hoc-vien-img/<hinh>-{pc,phone}.png (cùng bộ ảnh với frontend/src/assets/huong-dan).
// Kết quả: docs/huong-dan-hoc-vien.docx
// Thêm --quan-tri: sinh bản hướng dẫn trang quản trị từ frontend/src/content/huongDanQuanTri.ts
// -> docs/huong-dan-quan-tri.docx (cùng thể thức, không có hình minh họa).

import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const IMG = path.join(ROOT, 'docs/huong-dan-hoc-vien-img');
const QUAN_TRI = process.argv.includes('--quan-tri');
const OUT = path.join(ROOT, QUAN_TRI ? 'docs/huong-dan-quan-tri.docx' : 'docs/huong-dan-hoc-vien.docx');

const tham = process.argv.slice(2);
const doc = (ten, macDinh) => {
  const i = tham.indexOf(ten);
  return i >= 0 ? tham[i + 1] : macDinh;
};
const KHOA = doc('--khoa', '');
const CONG_VAN = doc('--cong-van', '……/ĐHSP-……');
const NGAY = doc('--ngay', `ngày …… tháng …… năm ${new Date().getFullYear()}`);

// 1) Biên dịch huongDan.ts + nhomZaloTheoCum.ts (phụ lục, dữ liệu riêng của khóa) thành module tạm rồi nạp.
const { build } = require(path.join(ROOT, 'frontend/node_modules/esbuild'));
const tmp = path.join(os.tmpdir(), `huong-dan-${process.pid}.mjs`);
await build({
  stdin: {
    contents: "export * from './huongDan'; export * from './nhomZaloTheoCum'; export * from './huongDanQuanTri';",
    resolveDir: path.join(ROOT, 'frontend/src/content'),
    loader: 'ts',
  },
  bundle: true,
  format: 'esm',
  platform: 'node',
  outfile: tmp,
  alias: { '@': path.join(ROOT, 'frontend/src') },
  logLevel: 'error',
});
const { huongDan, NHAN_NHOM_LOI, DANH_SACH_PHAN_THEO_THU_TU, nhomZaloTheoCum, huongDanQuanTri, TOM_TAT_PHU_LUC_ZALO } = await import(pathToFileURL(tmp).href);
fs.rmSync(tmp, { force: true });

const {
  Document, Packer, Paragraph, TextRun, ImageRun, Table, TableRow, TableCell, WidthType, ShadingType,
  AlignmentType, BorderStyle, Header, PageNumber, LevelFormat, VerticalAlign, TableLayoutType, HeadingLevel,
} = require('docx');

// ---- Thể thức (NĐ 30/2020, Phụ lục I) ----
const FONT = 'Times New Roman';
const CO = 28; // cỡ chữ thân bài 14 (half-point)
const CO_BANG = 24; // bảng 12
const MM = (mm) => Math.round((mm * 1440) / 25.4);
const LE = { top: MM(20), bottom: MM(20), left: MM(30), right: MM(15) };
const W = 11906 - LE.left - LE.right; // bề rộng vùng in (DXA)
const LUI_DAU_DONG = 567; // 1 cm
const DOAN = { before: 0, after: 120, line: 288 }; // sau đoạn 6 pt, giãn dòng 1,2
const LA_MA = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV', 'XV'];

// "Phần N" trong nội dung web (trên web là liên kết bấm được) -> "xem mục <La Mã>" trong văn bản giấy.
const laMa = (n) => LA_MA[Number(n) - 1] ?? n;
const doiPhan = (t) =>
  t
    // Công cụ tính mật khẩu chỉ có trên web.
    .replace(/dùng công cụ ở Phần (\d+)/g, (_, n) => `xem cách viết mật khẩu ở mục ${laMa(n)}`)
    .replace(/\(Phần (\d+)\)/g, (_, n) => `(xem mục ${laMa(n)})`)
    .replace(/Phần (\d+)/g, (_, n) => `mục ${laMa(n)}`)
    // Văn bản hành chính không dùng biểu tượng cảm xúc (📝, 🔒…) có trong bản web.
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]\s?/gu, '')
    .replace(/\(\s*,\s*/g, '(')
    .replace(/\(\s*\)/g, '');

// Markup giống TextMarkup: **đậm**, *nghiêng*, [[Nút giao diện]] -> “Nút” in đậm.
function runs(text, base = {}) {
  const t0 = doiPhan(text);
  const out = [];
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*|\[\[[^\]]+\]\])/g;
  let last = 0, m;
  while ((m = re.exec(t0))) {
    if (m.index > last) out.push(new TextRun({ text: t0.slice(last, m.index), ...base }));
    const t = m[0];
    if (t.startsWith('**')) out.push(new TextRun({ text: t.slice(2, -2), bold: true, ...base }));
    else if (t.startsWith('[[')) out.push(new TextRun({ text: `“${t.slice(2, -2)}”`, bold: true, ...base }));
    else out.push(new TextRun({ text: t.slice(1, -1), italics: true, ...base }));
    last = m.index + t.length;
  }
  if (last < t0.length) out.push(new TextRun({ text: t0.slice(last), ...base }));
  return out;
}

const thanBai = (text, opt = {}) => new Paragraph({
  alignment: AlignmentType.JUSTIFIED, spacing: DOAN, indent: { firstLine: LUI_DAU_DONG }, ...opt, children: runs(text),
});
const giua = (children, after = 0) => new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after, line: 240 }, indent: { firstLine: 0 }, children });
const rong = (after = 0) => new Paragraph({ spacing: { after, line: 240 }, indent: { firstLine: 0 }, children: [] });

// Tiêu đề mục: "I. TÊN MỤC" in hoa, đậm; tiêu đề tiểu mục "1. Tên" đậm.
const tieuDeMuc = (so, ten) => new Paragraph({
  heading: HeadingLevel.HEADING_1, keepNext: true, alignment: AlignmentType.JUSTIFIED,
  spacing: { before: 240, after: 120, line: 288 }, indent: { firstLine: LUI_DAU_DONG },
  children: [new TextRun({ text: `${LA_MA[so - 1]}. ${ten.toUpperCase()}`, bold: true })],
});
const tieuDeTieuMuc = (ten) => new Paragraph({
  heading: HeadingLevel.HEADING_2, keepNext: true, alignment: AlignmentType.JUSTIFIED,
  spacing: { before: 120, after: 120, line: 288 }, indent: { firstLine: LUI_DAU_DONG },
  children: [new TextRun({ text: ten, bold: true })],
});

// Các bước: khoản đánh số 1., 2., ... (khớp số tròn đỏ trong hình)
const cacBuoc = (ds) => ds.map((t, i) => new Paragraph({
  alignment: AlignmentType.JUSTIFIED, spacing: DOAN, indent: { firstLine: LUI_DAU_DONG },
  children: [new TextRun({ text: `Bước ${i + 1}. `, bold: true }), ...runs(t)],
}));

// Lưu ý: đoạn văn thường, nhãn in đậm nghiêng — không hộp màu (chữ đen theo thể thức).
// Tiêu đề lưu ý mang tính nhắc việc trên web -> diễn đạt cho văn bản giấy.
const TIEU_DE_BAN_IN = { 'Việc cần làm ngay bây giờ': 'Thứ tự các việc cần làm' };
const luuY = (g0) => {
  const g = { ...g0, tieuDe: TIEU_DE_BAN_IN[g0.tieuDe] ?? g0.tieuDe };
  const ds = Array.isArray(g.noiDung) ? g.noiDung : [g.noiDung];
  return ds.map((t, i) => new Paragraph({
    alignment: AlignmentType.JUSTIFIED, spacing: DOAN, indent: { firstLine: LUI_DAU_DONG },
    children: [...(i === 0 ? [new TextRun({ text: `Lưu ý – ${g.tieuDe}${/[?!:]$/.test(g.tieuDe) ? "" : ":"} `, bold: true, italics: true })] : []), ...runs(t)],
  }));
};

const KHONG = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
const KHONG_VIEN = { top: KHONG, bottom: KHONG, left: KHONG, right: KHONG };
const VIEN = { style: BorderStyle.SINGLE, size: 4, color: '000000' };
const VIEN_DU = { top: VIEN, bottom: VIEN, left: VIEN, right: VIEN };

function bang(cot, tieuDe, hang) {
  const tong = cot.reduce((a, b) => a + b, 0);
  const o = (t, w, dau) => new TableCell({
    width: { size: w, type: WidthType.DXA }, borders: VIEN_DU,
    shading: dau ? { type: ShadingType.CLEAR, fill: 'E7E6E6', color: 'auto' } : undefined,
    margins: { top: 40, bottom: 40, left: 80, right: 80 }, verticalAlign: dau ? VerticalAlign.CENTER : VerticalAlign.TOP,
    children: (Array.isArray(t) ? t : [t]).map((x) => new Paragraph({
      alignment: dau ? AlignmentType.CENTER : AlignmentType.LEFT, spacing: { after: 40, line: 264 }, indent: { firstLine: 0 },
      children: runs(x, { size: CO_BANG, ...(dau ? { bold: true } : {}) }),
    })),
  });
  return [new Table({
    width: { size: tong, type: WidthType.DXA }, columnWidths: cot, layout: TableLayoutType.FIXED,
    rows: [new TableRow({ tableHeader: true, cantSplit: true, children: tieuDe.map((t, i) => o(t, cot[i], true)) }),
      ...hang.map((h) => new TableRow({ cantSplit: true, children: h.map((t, i) => o(t, cot[i], false)) }))],
  }), rong(120)];
}
function bangTuDong(b) {
  const n = b.cot.length;
  const dau = Math.round(W * (n >= 3 ? 0.3 : 0.32));
  const con = Math.floor((W - dau) / (n - 1));
  const cot = [dau, ...Array(n - 1).fill(con)];
  cot[n - 1] += W - cot.reduce((a, c) => a + c, 0);
  return bang(cot, b.cot, b.hang);
}

// ---- Hình minh họa ----
let soHinh = 0;
function anh(file, rongPx) {
  const buf = fs.readFileSync(path.join(IMG, file));
  const w = buf.readUInt32BE(16), h = buf.readUInt32BE(20);
  return new ImageRun({ type: 'png', data: buf, transformation: { width: rongPx, height: Math.round((h * rongPx) / w) } });
}
const chuThich = (t) => new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 60, after: 160, line: 240 }, indent: { firstLine: 0 }, children: [new TextRun({ text: t, italics: true, size: 24 })] });

function minhHoa(hinh, ten) {
  soHinh++;
  return [
    new Paragraph({ alignment: AlignmentType.CENTER, keepNext: true, spacing: { before: 120, line: 240 }, indent: { firstLine: 0 }, children: [anh(`${hinh}-pc.png`, 520)] }),
    chuThich(`Hình ${soHinh}a. ${ten} (giao diện máy tính)`),
    new Paragraph({ alignment: AlignmentType.CENTER, keepNext: true, spacing: { line: 240 }, indent: { firstLine: 0 }, children: [anh(`${hinh}-phone.png`, 200)] }),
    chuThich(`Hình ${soHinh}b. ${ten} (giao diện điện thoại)`),
  ];
}

// ---------------- NỘI DUNG ----------------
const c = [];

// Khối đầu văn bản: tên cơ quan (trái) — Quốc hiệu, tiêu ngữ (phải).
const traiW = Math.round(W * 0.4), phaiW = W - traiW;
const gachDuoi = (oW, rongPct) => new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 0, line: 240 }, indent: { firstLine: 0, left: Math.round((oW * (1 - rongPct)) / 2), right: Math.round((oW * (1 - rongPct)) / 2) }, border: { top: { style: BorderStyle.SINGLE, size: 6, color: '000000', space: 1 } }, children: [] });
c.push(new Table({
  width: { size: W, type: WidthType.DXA }, columnWidths: [traiW, phaiW], layout: TableLayoutType.FIXED,
  rows: [new TableRow({ children: [
    new TableCell({ width: { size: traiW, type: WidthType.DXA }, borders: KHONG_VIEN, children: [
      giua([new TextRun({ text: 'BỘ GIÁO DỤC VÀ ĐÀO TẠO', size: 26 })]),
      giua([new TextRun({ text: 'TRƯỜNG ĐẠI HỌC SƯ PHẠM', size: 26, bold: true })]),
      giua([new TextRun({ text: 'THÀNH PHỐ HỒ CHÍ MINH', size: 26, bold: true })]),
      gachDuoi(traiW, 0.35),
    ] }),
    new TableCell({ width: { size: phaiW, type: WidthType.DXA }, borders: KHONG_VIEN, children: [
      giua([new TextRun({ text: 'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM', size: 24, bold: true })]),
      giua([new TextRun({ text: 'Độc lập - Tự do - Hạnh phúc', size: 28, bold: true })]),
      gachDuoi(phaiW, 0.55),
    ] }),
  ] })],
}));

c.push(
  rong(240),
  giua([new TextRun({ text: 'HƯỚNG DẪN', bold: true, size: CO })], 0),
  giua([new TextRun({ text: QUAN_TRI ? 'Sử dụng trang quản trị hệ thống Bồi dưỡng Năng lực số' : 'Sử dụng hệ thống Bồi dưỡng Năng lực số dành cho học viên', bold: true, size: CO })], 0),
  ...(KHOA ? [giua([new TextRun({ text: KHOA.charAt(0).toUpperCase() + KHOA.slice(1), bold: true, size: CO })], 0)] : []),
  giua([new TextRun({ text: `(Kèm theo Công văn số ${CONG_VAN} ${NGAY}`, italics: true, size: CO })], 0),
  giua([new TextRun({ text: 'của Trường Đại học Sư phạm Thành phố Hồ Chí Minh)', italics: true, size: CO })], 0),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 240, line: 240 }, indent: { firstLine: 0, left: 3400, right: 3400 }, border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '000000', space: 1 } }, children: [] }),
);

// Bản quản trị: tiêu đề tiểu mục + các bước, bảng, lưu ý của 1 mục (dùng chung cho phần và tiểu mục).
function mucQuanTri(m) {
  if (m.buoc) c.push(...cacBuoc(m.buoc));
  (m.bang ?? []).forEach((b) => c.push(...bangTuDong(b)));
  (m.ghiChu ?? []).forEach((g) => c.push(...luuY(g)));
}
function noiDungQuanTri() {
  const qt = huongDanQuanTri;
  c.push(
    thanBai(qt.gioiThieu),
    thanBai(`Mỗi mục ghi rõ phạm vi áp dụng: **mọi tài khoản** vào trang quản trị (Quản trị, Sở GD&ĐT, Phòng Văn hóa – Xã hội, Trường) hoặc **chỉ tài khoản Quản trị**. Bản trực tuyến, có tìm kiếm nhanh, ở mục “Hướng dẫn” trong trang quản trị (**${huongDan.hero.diaChi}/admin/huong-dan**).`),
  );
  let so = 1;
  c.push(tieuDeMuc(so++, 'Quy trình vận hành một khóa bồi dưỡng'), thanBai('Áp dụng: chỉ tài khoản Quản trị. Các bước nên làm theo đúng thứ tự:'), ...cacBuoc(qt.quyTrinh));
  qt.parts.forEach((phan) => {
    c.push(tieuDeMuc(so++, phan.tieuDe), thanBai(phan.moTa));
    c.push(thanBai(`Áp dụng: ${phan.vaiTro === 'quan_tri' ? 'chỉ tài khoản Quản trị' : 'mọi tài khoản vào trang quản trị'}.${phan.manHinh ? ` Màn hình: menu **${phan.manHinh.nhan}** (địa chỉ ${huongDan.hero.diaChi}${phan.manHinh.duongDan}).` : ''}`));
    mucQuanTri(phan);
    (phan.muc ?? []).forEach((m) => {
      if (m.tieuDe) c.push(tieuDeTieuMuc(m.tieuDe));
      mucQuanTri(m);
    });
  });
  c.push(tieuDeMuc(so++, 'Hỏi đáp thường gặp'),
    ...bang([Math.round(W * 0.36), W - Math.round(W * 0.36)], ['Câu hỏi', 'Trả lời'],
      qt.hoiDap.map((h) => [`${h.hoi}${h.vaiTro === 'quan_tri' ? ' *(Quản trị)*' : ''}`, h.dap])),
    thanBai(`Trong quá trình sử dụng, nếu có vướng mắc, liên hệ email **${huongDan.hero.email}** để được hỗ trợ./.`, { spacing: { ...DOAN, before: 120 } }),
  );
}

if (QUAN_TRI) {
  noiDungQuanTri();
} else {
// Phần mở đầu: mục đích, phạm vi, đối tượng, nơi xem bản trực tuyến, đầu mối hỗ trợ.
c.push(
  thanBai(`Hướng dẫn này giúp giáo viên và cán bộ quản lý tham gia khóa bồi dưỡng năng lực số${KHOA ? ` (${KHOA})` : ''} sử dụng hệ thống Bồi dưỡng Năng lực số tại địa chỉ **${huongDan.hero.diaChi}**: đăng nhập, bổ sung hồ sơ, thực hiện khảo sát đầu vào, theo dõi lớp học và xử lý các lỗi thường gặp.`),
  thanBai(`Mỗi thao tác có hình minh họa trên máy tính (hình a) và trên điện thoại (hình b); các số tròn màu đỏ trong hình tương ứng với số thứ tự của bước cần làm. Tên người, mã số trong hình là ví dụ. Bản hướng dẫn trực tuyến, có tra cứu lỗi nhanh, đăng tại **${huongDan.hero.diaChi}/huong-dan**.`),
  thanBai(`Đầu mối hỗ trợ: email **${huongDan.hero.email}**; học viên đã đăng nhập có thể gửi yêu cầu tại mục “Hỗ trợ” trên hệ thống.`),
);

// Cách tìm và tra cứu tài liệu (không đánh số La Mã để giữ đúng các dẫn chiếu "mục III, VI..." trong nội dung).
if (huongDan.cachTraCuu) {
  const tc = huongDan.cachTraCuu;
  c.push(
    new Paragraph({ heading: HeadingLevel.HEADING_1, keepNext: true, alignment: AlignmentType.JUSTIFIED, spacing: { before: 240, after: 120, line: 288 }, indent: { firstLine: LUI_DAU_DONG }, children: [new TextRun({ text: tc.tieuDe.toUpperCase(), bold: true })] }),
    thanBai('Học viên lần đầu vào hệ thống nên mở trang hướng dẫn trực tuyến trước, xem mục lục để biết mỗi việc nằm ở mục nào, rồi làm lần lượt theo các mục. Khi gặp lỗi, tra cứu theo các bước dưới đây.'),
    ...cacBuoc(tc.buoc),
  );
  // Ảnh chụp giao diện thật (scripts/huong-dan: chụp từ trang đang chạy); thiếu ảnh thì bỏ qua.
  const anhTraCuu = [
    ['tra-cuu-trang-chu-pc.png', 520, 'Nút “Hướng dẫn sử dụng” ở đầu trang giới thiệu (giao diện máy tính)'],
    ['tra-cuu-muc-luc-pc.png', 520, 'Trang Hướng dẫn sử dụng: mục lục ở cột bên trái (giao diện máy tính)'],
    ['tra-cuu-muc-luc-phone.png', 200, 'Trang Hướng dẫn sử dụng trên điện thoại: ô “Đi tới phần” để chọn mục'],
  ].filter(([f]) => fs.existsSync(path.join(IMG, f)));
  anhTraCuu.forEach(([f, rong, ten]) => {
    soHinh++;
    c.push(
      new Paragraph({ alignment: AlignmentType.CENTER, keepNext: true, spacing: { before: 120, line: 240 }, indent: { firstLine: 0 }, children: [anh(f, rong)] }),
      chuThich(`Hình ${soHinh}. ${ten}`),
    );
  });
  const tt = (m) => m.tomTat ?? '';
  const hang = [
    ...huongDan.parts.map((p, i) => [LA_MA[i], `**${p.tieuDe}**`, tt(p)]),
    ...DANH_SACH_PHAN_THEO_THU_TU.slice(huongDan.parts.length).map((m, i) => [LA_MA[huongDan.parts.length + i], `**${m.tieuDe}**`, tt(m)]),
    ['Phụ lục', `**${nhomZaloTheoCum.tieuDe.replace(/^Phụ lục:\s*/, '')}**`, TOM_TAT_PHU_LUC_ZALO ?? ''],
  ];
  c.push(
    tieuDeTieuMuc('Mục lục tài liệu và nội dung chính của từng mục'),
    ...bang([1100, 3300, W - 4400], ['Mục', 'Tên mục', 'Nội dung chính'], hang),
  );
}

huongDan.parts.forEach((phan, i) => {
  const so = i + 1;
  c.push(tieuDeMuc(so, phan.tieuDe), thanBai(phan.moTa));
  if (phan.id === 'tong-quan') {
    c.push(...bang([1300, 3000, W - 4300], ['Giai đoạn', 'Nội dung', 'Học viên cần làm'],
      // Bỏ nhãn nhắc việc "Làm ngay" — chỉ có ý nghĩa trên web.
      huongDan.giaiDoan.map((g, j) => [String(j + 1), `**${g.ten}**`, g.moTa])));
  }
  if (phan.id === 'chuan-bi') {
    c.push(...bang([3000, W - 3000], ['Cần chuẩn bị', 'Ghi chú'], huongDan.chuanBi.map((m) => [`**${m.tieuDe}**`, m.moTa])));
  }
  if (phan.hinh) c.push(...minhHoa(phan.hinh, phan.tieuDe));
  if (phan.buoc) c.push(...cacBuoc(phan.buoc));
  if (phan.id === 'dang-nhap') {
    c.push(thanBai('Mật khẩu lần đầu viết liền **ngày (2 chữ số) – tháng (2 chữ số) – năm (4 chữ số)**; thêm số 0 phía trước nếu ngày hoặc tháng chỉ có 1 chữ số.'));
  }
  (phan.bang ?? []).forEach((b) => c.push(...bangTuDong(b)));
  (phan.ghiChu ?? []).forEach((g) => c.push(...luuY(g)));
  if (phan.id === 'tong-quan') c.push(...luuY(huongDan.zaloNote));
});

// Lỗi thường gặp
const soLoi = huongDan.parts.length + 1;
c.push(tieuDeMuc(soLoi, DANH_SACH_PHAN_THEO_THU_TU[soLoi - 1].tieuDe),
  thanBai('Học viên tìm dòng giống với thông báo hoặc tình huống đang gặp, rồi làm theo cột “Cách xử lý”. Chữ trong ngoặc kép là thông báo hiện trên màn hình.'));
Object.entries(NHAN_NHOM_LOI).forEach(([ma, ten], i) => {
  const ds = huongDan.troubleshooting.filter((t) => t.nhom === ma);
  if (!ds.length) return;
  c.push(tieuDeTieuMuc(`${i + 1}. ${ten.charAt(0).toUpperCase()}${ten.slice(1)}`),
    ...bang([Math.round(W * 0.32), Math.round(W * 0.26), W - Math.round(W * 0.32) - Math.round(W * 0.26)], ['Thông báo/tình huống', 'Nguyên nhân', 'Cách xử lý'],
      ds.map((t) => [t.tinhHuong, t.nguyenNhan, t.cachXuLy.map((b, j) => `${j + 1}. ${b}`)])));
});

// Liên hệ
const ct = huongDan.contact;
c.push(tieuDeMuc(soLoi + 1, DANH_SACH_PHAN_THEO_THU_TU[soLoi].tieuDe));
if (ct.gioiThieu ?? ct.moTa) c.push(thanBai(ct.gioiThieu ?? ct.moTa));
c.push(
  thanBai(`Email hỗ trợ: **${ct.email}**. Học viên ghi đủ các thông tin theo mẫu dưới đây để được xử lý nhanh, không phải hỏi lại:`),
  ...ct.mauEmail.filter((d) => d.trim()).map((d) => new Paragraph({
    alignment: AlignmentType.LEFT, spacing: { after: 60, line: 288 }, indent: { firstLine: 0, left: LUI_DAU_DONG * 2 },
    children: runs(/:\s*$/.test(d) ? `${d} ……………………` : d),
  })),
  rong(60),
  ...luuY({ tieuDe: 'Bảo mật', noiDung: 'Cán bộ hỗ trợ không bao giờ hỏi mật khẩu của học viên. Không ghi mật khẩu trong email hay tin nhắn.' }),
  tieuDeTieuMuc('Giữ an toàn tài khoản'),
  ...ct.anToan.map((t) => new Paragraph({ alignment: AlignmentType.JUSTIFIED, spacing: DOAN, indent: { firstLine: LUI_DAU_DONG }, children: [new TextRun('- '), ...runs(t)] })),
  thanBai(`Trong quá trình thực hiện, nếu có vướng mắc, học viên liên hệ qua email **${ct.email}** để được hỗ trợ./.`, { spacing: { ...DOAN, before: 120 } }),
);

// Phụ lục: nhóm Zalo hỗ trợ theo cụm (dữ liệu riêng của khóa — content/nhomZaloTheoCum.ts).
c.push(
  new Paragraph({ pageBreakBefore: true, alignment: AlignmentType.CENTER, spacing: { after: 0, line: 288 }, indent: { firstLine: 0 }, children: [new TextRun({ text: 'PHỤ LỤC', bold: true, size: CO })] }),
  giua([new TextRun({ text: 'DANH SÁCH NHÓM ZALO HỖ TRỢ THEO CỤM', bold: true, size: CO })], 240),
  thanBai(`Học viên tìm tên đơn vị công tác của mình trong bảng dưới đây để tham gia đúng nhóm Zalo của cụm. Bản trực tuyến (có ô tìm theo tên trường, không cần đăng nhập) đăng tại **${huongDan.hero.diaChi}/huong-dan**, mục Phụ lục.`),
  ...nhomZaloTheoCum.luuY.map((t) => new Paragraph({ alignment: AlignmentType.JUSTIFIED, spacing: DOAN, indent: { firstLine: LUI_DAU_DONG }, children: [new TextRun('- '), ...runs(t)] })),
  ...bang([1500, W - 1500 - 3300, 3300], ['Cụm', 'Đơn vị công tác', 'Link tham gia Zalo'],
    nhomZaloTheoCum.cum.map((cm) => [`**${cm.ten}**`, cm.donVi.map((d, j) => `${j + 1}. ${d}`), cm.linkZalo])),
);

}

const tep = new Document({
  creator: 'Trường Đại học Sư phạm Thành phố Hồ Chí Minh',
  title: QUAN_TRI ? 'Hướng dẫn sử dụng trang quản trị hệ thống Bồi dưỡng Năng lực số' : 'Hướng dẫn sử dụng hệ thống Bồi dưỡng Năng lực số dành cho học viên',
  styles: {
    default: { document: { run: { font: FONT, size: CO, color: '000000' }, paragraph: { spacing: { line: 288 } } } },
    paragraphStyles: [
      { id: 'Normal', name: 'Normal', quickFormat: true, run: { font: FONT, size: CO, color: '000000' }, paragraph: { alignment: AlignmentType.JUSTIFIED, spacing: { before: 0, after: 120, line: 288 }, indent: { firstLine: LUI_DAU_DONG } } },
      { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: FONT, size: CO, bold: true, color: '000000' }, paragraph: { outlineLevel: 0 } },
      { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: FONT, size: CO, bold: true, color: '000000' }, paragraph: { outlineLevel: 1 } },
    ],
  },
  numbering: { config: [{ reference: 'cham', levels: [{ level: 0, format: LevelFormat.BULLET, text: '-', alignment: AlignmentType.LEFT }] }] },
  sections: [{
    properties: { titlePage: true, page: { size: { width: 11906, height: 16838 }, margin: { ...LE, header: MM(10) } } },
    // Số trang: giữa lề trên, không hiện ở trang thứ nhất (NĐ 30/2020).
    headers: {
      default: new Header({ children: [new Paragraph({ alignment: AlignmentType.CENTER, indent: { firstLine: 0 }, children: [new TextRun({ children: [PageNumber.CURRENT], size: CO })] })] }),
      first: new Header({ children: [new Paragraph({ children: [] })] }),
    },
    children: c,
  }],
});

fs.writeFileSync(OUT, await Packer.toBuffer(tep));
console.log(QUAN_TRI
  ? `Đã ghi ${path.relative(ROOT, OUT)}: ${huongDanQuanTri.parts.length + 2} mục, ${huongDanQuanTri.hoiDap.length} hỏi đáp`
  : `Đã ghi ${path.relative(ROOT, OUT)}: ${huongDan.parts.length + 2} mục, ${huongDan.troubleshooting.length} lỗi thường gặp, ${soHinh} cặp hình, phụ lục ${nhomZaloTheoCum.cum.length} cụm Zalo`);
