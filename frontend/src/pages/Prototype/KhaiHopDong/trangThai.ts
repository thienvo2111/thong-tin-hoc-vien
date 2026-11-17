// PROTOTYPE — ticket #48. Trạng thái dùng chung cho mọi phương án (chỉ trong bộ nhớ).
import { useState } from 'react';
import { danhSachMau, dot, hoSoDaKhai, kiemTraNgayQd, NGUONG, NHOM_HO_SO, NHOM_HOP_DONG, tongSuat, type DongDanhSach } from './duLieu';

export function useKhaiHopDong() {
  const [ds, setDs] = useState<DongDanhSach[]>(danhSachMau);
  const [hoSo, setHoSo] = useState<Record<string, string>>({ ...hoSoDaKhai });
  const [hd, setHd] = useState<Record<string, string>>({});
  const [diemTrucTiep, setDiemTrucTiep] = useState(false);
  const [daXacNhanDs, setDaXacNhanDs] = useState(false);
  const [daNop, setDaNop] = useState(false);

  const suat = tongSuat(ds);
  const giaTri = Math.round(suat * dot.donGia);
  const canQd = giaTri >= NGUONG;

  const loiHoSo: Record<string, string> = {};
  NHOM_HO_SO.forEach((nhom, i) => {
    if (i === 3 && !diemTrucTiep) return;
    nhom.truong.forEach((t) => {
      const loi = t.kiemTra ? t.kiemTra(hoSo[t.key] ?? '') : !hoSo[t.key]?.trim() && i === 3 ? 'Bắt buộc' : null;
      if (loi) loiHoSo[t.key] = loi;
    });
  });
  const loiHd: Record<string, string> = {};
  NHOM_HOP_DONG.forEach((t) => {
    const loi = t.kiemTra?.(hd[t.key] ?? '');
    if (loi) loiHd[t.key] = loi;
  });
  if (canQd) {
    if (!hd.soQd?.trim()) loiHd.soQd = 'Bắt buộc khi hợp đồng từ 50 triệu';
    const l = kiemTraNgayQd(hd.ngayQd ?? '');
    if (l) loiHd.ngayQd = l;
  }

  const moiDongDongY = ds.every((d) => d.yKien === 'dong_y');
  const dsSanSang = moiDongDongY;
  const coTheNop = daXacNhanDs && !Object.keys(loiHoSo).length && !Object.keys(loiHd).length && !daNop;

  const datYKien = (id: string, yKien: DongDanhSach['yKien'], deNghi?: string) =>
    setDs((cu) => cu.map((d) => (d.id === id ? { ...d, yKien, deNghi } : d)));
  const dongYTatCa = () => setDs((cu) => cu.map((d) => (d.yKien ? d : { ...d, yKien: 'dong_y' })));

  return {
    ds, hoSo, hd, diemTrucTiep, daXacNhanDs, daNop, suat, giaTri, canQd, loiHoSo, loiHd, dsSanSang, coTheNop,
    setHoSo: (k: string, v: string) => setHoSo((c) => ({ ...c, [k]: v })),
    setHd: (k: string, v: string) => setHd((c) => ({ ...c, [k]: v })),
    setDiemTrucTiep, datYKien, dongYTatCa,
    xacNhanDs: () => dsSanSang && setDaXacNhanDs(true),
    nop: () => coTheNop && setDaNop(true),
  };
}

export type KhaiHopDong = ReturnType<typeof useKhaiHopDong>;
