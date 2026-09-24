import { promises as fs } from 'fs';
import * as path from 'path';

// Lưu file gốc + kết quả preview cục bộ trên đĩa (validation-checklist.md
// #46 "File nguồn gốc lưu lại ở object storage, không chỉ lưu kết quả").
// Chưa tích hợp object storage thật ở lượt này — dùng thư mục cục bộ làm
// nơi lưu trữ tạm, flag lại trong self-review.
const STORAGE_ROOT = path.resolve(process.cwd(), 'storage', 'import');

export interface KetQuaImport {
  danh_sach_loi: { dong: number; ly_do: string }[];
  dong_hop_le: number[];
}

function thuMucImport(importId: string): string {
  return path.join(STORAGE_ROOT, importId);
}

export async function luuFileGoc(
  importId: string,
  buffer: Buffer,
): Promise<string> {
  const dir = thuMucImport(importId);
  await fs.mkdir(dir, { recursive: true });
  const filePath = path.join(dir, 'goc.xlsx');
  await fs.writeFile(filePath, buffer);
  return filePath;
}

export async function docFileGoc(importId: string): Promise<Buffer> {
  return fs.readFile(path.join(thuMucImport(importId), 'goc.xlsx'));
}

export async function luuKetQua(
  importId: string,
  ketQua: KetQuaImport,
): Promise<void> {
  const dir = thuMucImport(importId);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(
    path.join(dir, 'ket-qua.json'),
    JSON.stringify(ketQua, null, 2),
    'utf-8',
  );
}

export async function docKetQua(
  importId: string,
): Promise<KetQuaImport | null> {
  try {
    const raw = await fs.readFile(
      path.join(thuMucImport(importId), 'ket-qua.json'),
      'utf-8',
    );
    return JSON.parse(raw) as KetQuaImport;
  } catch {
    return null;
  }
}

export async function luuFileLoi(
  importId: string,
  buffer: Buffer,
): Promise<void> {
  const dir = thuMucImport(importId);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, 'loi.xlsx'), buffer);
}

export async function docFileLoi(importId: string): Promise<Buffer | null> {
  try {
    return await fs.readFile(path.join(thuMucImport(importId), 'loi.xlsx'));
  } catch {
    return null;
  }
}
