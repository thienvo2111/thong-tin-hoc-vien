// Chuyển 1 file Markdown đơn giản (tài liệu hướng dẫn trong docs/) sang Word, cùng phông/khổ với tao-docx.mjs.
// Hỗ trợ: # ## ###, đoạn văn, danh sách 1. / - (lồng 1 cấp bằng thụt 2–3 dấu cách), bảng |...|,
// trích dẫn >, khối ``` ```, **đậm**, *nghiêng*, `mã`. Không hỗ trợ ảnh/link markdown phức tạp.
//
// Chạy (từ gốc repo):
//   NODE_PATH="$(npm root -g)" node scripts/huong-dan/md-sang-docx.mjs docs/a.md [docs/b.md ...]
// Kết quả: cùng tên, đuôi .docx, cạnh file .md.

import { createRequire } from 'node:module';
import fs from 'node:fs';

const require = createRequire(import.meta.url);
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType,
  BorderStyle, ShadingType, LevelFormat, AlignmentType, TableLayoutType,
} = require('docx');

const FONT = 'Times New Roman';
const CO = 26; // 13pt
const TRANG_RONG = 11906 - 1701 - 1134; // A4, lề trái 3cm, phải 2cm (DXA)

// **đậm**, *nghiêng*, `mã` → TextRun[]
function runs(text, them = {}) {
  const out = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g;
  let i = 0;
  for (const m of text.matchAll(re)) {
    if (m.index > i) out.push(new TextRun({ text: text.slice(i, m.index), ...them }));
    const t = m[0];
    if (t.startsWith('**')) out.push(new TextRun({ text: t.slice(2, -2), bold: true, ...them }));
    else if (t.startsWith('`')) out.push(new TextRun({ text: t.slice(1, -1), font: 'Consolas', ...them }));
    else out.push(new TextRun({ text: t.slice(1, -1), italics: true, ...them }));
    i = m.index + t.length;
  }
  if (i < text.length) out.push(new TextRun({ text: text.slice(i), ...them }));
  return out;
}

const VIEN = { style: BorderStyle.SINGLE, size: 4, color: '000000' };
const VIEN_DU = { top: VIEN, bottom: VIEN, left: VIEN, right: VIEN };

function bang(dong) {
  const tach = (l) => l.trim().replace(/^\||\|$/g, '').split('|').map((x) => x.trim());
  const dau = tach(dong[0]);
  const than = dong.slice(2).map(tach);
  const n = dau.length;
  // Cột đầu hẹp hơn khi bảng 2 cột (nhãn | giải thích)
  const cot = n === 2 ? [Math.round(TRANG_RONG * 0.35), TRANG_RONG - Math.round(TRANG_RONG * 0.35)]
    : Array.from({ length: n }, (_, k) => (k < n - 1 ? Math.floor(TRANG_RONG / n) : TRANG_RONG - Math.floor(TRANG_RONG / n) * (n - 1)));
  const o = (t, i, laDau) => new TableCell({
    width: { size: cot[i], type: WidthType.DXA }, borders: VIEN_DU,
    shading: laDau ? { type: ShadingType.CLEAR, fill: 'E7EEF7', color: 'auto' } : undefined,
    margins: { top: 60, bottom: 60, left: 100, right: 100 },
    children: [new Paragraph({ spacing: { before: 0, after: 0 }, children: runs(t ?? '', { size: 24, ...(laDau ? { bold: true } : {}) }) })],
  });
  return new Table({
    width: { size: TRANG_RONG, type: WidthType.DXA }, columnWidths: cot, layout: TableLayoutType.FIXED,
    rows: [
      new TableRow({ tableHeader: true, children: dau.map((t, i) => o(t, i, true)) }),
      ...than.map((r) => new TableRow({ children: dau.map((_, i) => o(r[i], i, false)) })),
    ],
  });
}

function chuyen(md) {
  const dong = md.replace(/\r/g, '').split('\n');
  const ra = [];
  let soDs = 0; // mỗi danh sách đánh số dùng 1 instance riêng để đánh lại từ 1
  let dsHienTai = null;
  for (let i = 0; i < dong.length; i++) {
    const l = dong[i];
    if (!l.trim()) { dsHienTai = null; continue; }
    if (l.startsWith('```')) {
      const khoi = [];
      for (i++; i < dong.length && !dong[i].startsWith('```'); i++) khoi.push(dong[i]);
      for (const k of khoi) ra.push(new Paragraph({
        spacing: { before: 0, after: 0 }, shading: { type: ShadingType.CLEAR, fill: 'F2F2F2', color: 'auto' },
        indent: { left: 284 }, children: [new TextRun({ text: k || ' ', size: 24 })],
      }));
      ra.push(new Paragraph({ children: [] }));
      continue;
    }
    if (l.trim().startsWith('|')) {
      const b = [];
      for (; i < dong.length && dong[i].trim().startsWith('|'); i++) b.push(dong[i]);
      i--;
      ra.push(bang(b), new Paragraph({ children: [] }));
      continue;
    }
    if (/^---+\s*$/.test(l)) {
      ra.push(new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '999999', space: 1 } }, children: [] }));
      continue;
    }
    let m;
    if ((m = l.match(/^(#{1,3})\s+(.*)$/))) {
      const muc = [HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3][m[1].length - 1];
      ra.push(new Paragraph({ heading: muc, alignment: m[1].length === 1 ? AlignmentType.CENTER : AlignmentType.LEFT, children: runs(m[2]) }));
      continue;
    }
    if ((m = l.match(/^>\s?(.*)$/))) {
      ra.push(new Paragraph({ indent: { left: 284 }, border: { left: { style: BorderStyle.SINGLE, size: 12, color: '1F4E79', space: 8 } }, children: runs(m[1], { italics: true }) }));
      continue;
    }
    if ((m = l.match(/^(\s*)(\d+)\.\s+(.*)$/))) {
      if (!dsHienTai) dsHienTai = `so-${soDs++}`;
      ra.push(new Paragraph({ numbering: { reference: 'so', level: 0, instance: soDs }, children: runs(m[3]) }));
      continue;
    }
    if ((m = l.match(/^(\s*)-\s+(.*)$/))) {
      ra.push(new Paragraph({ numbering: { reference: 'cham', level: m[1].length >= 2 ? 1 : 0 }, children: runs(m[2]) }));
      continue;
    }
    if (/^\s{2,}\S/.test(l)) { // dòng nối tiếp của mục danh sách
      ra.push(new Paragraph({ indent: { left: 720 }, children: runs(l.trim()) }));
      continue;
    }
    ra.push(new Paragraph({ children: runs(l) }));
  }
  return ra;
}

for (const f of process.argv.slice(2)) {
  const doc = new Document({
    styles: {
      default: { document: { run: { font: FONT, size: CO }, paragraph: { spacing: { after: 100, line: 300 } } } },
      paragraphStyles: [
        { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', run: { font: FONT, size: 30, bold: true, color: '1F4E79' }, paragraph: { spacing: { before: 120, after: 240 }, outlineLevel: 0 } },
        { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', run: { font: FONT, size: 28, bold: true, color: '1F4E79' }, paragraph: { spacing: { before: 240, after: 120 }, outlineLevel: 1 } },
        { id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', run: { font: FONT, size: 26, bold: true }, paragraph: { spacing: { before: 180, after: 80 }, outlineLevel: 2 } },
      ],
    },
    numbering: {
      config: [
        { reference: 'so', levels: [{ level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
        { reference: 'cham', levels: [
          { level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } },
          { level: 1, format: LevelFormat.BULLET, text: '–', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 1080, hanging: 360 } } } },
        ] },
      ],
    },
    sections: [{
      properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1134, bottom: 1134, left: 1701, right: 1134 } } },
      children: chuyen(fs.readFileSync(f, 'utf8')),
    }],
  });
  const ra = f.replace(/\.md$/, '.docx');
  fs.writeFileSync(ra, await Packer.toBuffer(doc));
  console.log('Đã ghi', ra);
}
