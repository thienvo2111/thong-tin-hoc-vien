import { useState } from 'react';
import { Alert, Badge, Button, Group, Modal, Stack, Text } from '@mantine/core';
import { useVaoHocZoom } from '@/api/hocVien';
import type { DiemDanhZoomBuoi, KetQuaVaoHoc, LichHocLopToi, TrangThaiDiemDanh } from '@/api/types';
import { dinhDangGio, ngayIsoVn } from '@/lib/ngay';
import { chuanHoaLienKet } from '@/lib/lienKet';
import { thongDiepLoiChung } from '@/lib/loiApi';
import { StatusBanner } from '@/components/StatusBanner';

// ADR 0005 (issue #24): tự điểm danh lớp Zoom bằng cú bấm. Mọi mốc (mo/dong/pha) do máy chủ tính.

const PHUT_MS = 60 * 1000;

function soPhut(tu: string, den: string): number {
  return Math.round((Date.parse(den) - Date.parse(tu)) / PHUT_MS);
}

function dinhDangKhoang(phut: number): string {
  return phut % 60 === 0 ? `${phut / 60} giờ` : `${phut} phút`;
}

/** Khung vàng đầu danh sách buổi Zoom — số phút mở trước/đóng sau lấy từ cấu hình khóa (qua mo/dong). */
export function CanhBaoDiemDanhZoom({ buoi }: { buoi: LichHocLopToi & { diem_danh_zoom: DiemDanhZoomBuoi } }) {
  const truoc = soPhut(buoi.diem_danh_zoom.mo, buoi.thoi_gian_bat_dau);
  const sau = soPhut(buoi.thoi_gian_bat_dau, buoi.diem_danh_zoom.dong);
  return (
    <Alert color="yellow" variant="light" data-testid="canh-bao-diem-danh-zoom">
      <Text size="sm">
        ⚠️ <b>Bắt buộc điểm danh từng buổi.</b> Mỗi buổi học, hãy bấm nút <i>Điểm danh &amp; vào Zoom</i> của đúng
        buổi đó (mở trước giờ học {truoc} phút, đóng sau giờ bắt đầu {dinhDangKhoang(sau)}). Vào Zoom bằng link khác
        hoặc ở lại phòng từ buổi trước sẽ <b>không được ghi nhận</b> và bị tính vắng.
      </Text>
    </Alert>
  );
}

const NHAN_VANG: Partial<Record<TrangThaiDiemDanh, { nhan: string; mau: string }>> = {
  vang: { nhan: 'Vắng', mau: 'red' },
  vang_co_phep: { nhan: 'Vắng có phép', mau: 'yellow' },
};

/** Nhãn trạng thái điểm danh của 1 buổi Zoom. */
export function NhanDiemDanhZoom({ dz }: { dz: DiemDanhZoomBuoi }) {
  const vang = dz.trang_thai ? NHAN_VANG[dz.trang_thai] : undefined;
  if (vang) return <Badge size="sm" color={vang.mau}>{vang.nhan}</Badge>;
  if (dz.trang_thai === 'co_mat') {
    return (
      <Badge size="sm" color="green" style={{ textTransform: 'none' }}>
        {dz.tu_diem_danh_luc ? `✅ Đã điểm danh ${dinhDangGio(dz.tu_diem_danh_luc)}` : 'Có mặt'}
      </Badge>
    );
  }
  const theoPha = {
    chua_mo: { nhan: `Điểm danh mở lúc ${dinhDangGio(dz.mo)}`, mau: 'gray' },
    dang_mo: { nhan: 'Đang mở điểm danh', mau: 'blue' },
    da_dong: { nhan: 'Đã đóng điểm danh', mau: 'gray' },
  }[dz.pha];
  return (
    <Badge size="sm" variant="light" color={theoPha.mau} style={{ textTransform: 'none' }}>
      {theoPha.nhan}
    </Badge>
  );
}

/** Đã có mặt ở buổi khác cùng ngày (giờ VN) mà buổi này chưa có dòng -> nhắc vẫn phải bấm. */
export function canNhacCungNgay(buoi: LichHocLopToi, dsBuoi: LichHocLopToi[]): boolean {
  if (!buoi.diem_danh_zoom || buoi.diem_danh_zoom.trang_thai) return false;
  const ngay = ngayIsoVn(buoi.thoi_gian_bat_dau);
  return dsBuoi.some(
    (b) =>
      b.id !== buoi.id &&
      b.diem_danh_zoom?.trang_thai === 'co_mat' &&
      ngayIsoVn(b.thoi_gian_bat_dau) === ngay,
  );
}

/** Nút "Điểm danh & vào Zoom": POST rồi mở hộp thoại; Zoom mở bằng cú bấm thứ 2 (cùng tab). */
export function NutDiemDanhZoom({ buoi }: { buoi: LichHocLopToi }) {
  const vaoHoc = useVaoHocZoom();
  const [ketQua, setKetQua] = useState<KetQuaVaoHoc | null>(null);
  return (
    <Stack gap={6} mt={6}>
      {vaoHoc.isError && <StatusBanner loai="error">{thongDiepLoiChung(vaoHoc.error)}</StatusBanner>}
      <Button
        size="xs"
        style={{ alignSelf: 'flex-start' }}
        loading={vaoHoc.isPending}
        onClick={() => vaoHoc.mutate(buoi.id, { onSuccess: setKetQua })}
      >
        Điểm danh &amp; vào Zoom
      </Button>
      <Modal
        opened={ketQua !== null}
        onClose={() => setKetQua(null)}
        title={`Buổi ${buoi.buoi_so}`}
        centered
      >
        {ketQua && <NoiDungKetQua ketQua={ketQua} buoiSo={buoi.buoi_so} dong={() => setKetQua(null)} />}
      </Modal>
    </Stack>
  );
}

function NoiDungKetQua({ ketQua, buoiSo, dong }: { ketQua: KetQuaVaoHoc; buoiSo: number; dong: () => void }) {
  if (ketQua.ket_qua === 'chua_mo') {
    return (
      <Stack gap="md">
        <Text>⏳ Chưa đến thời gian điểm danh — mở lúc {dinhDangGio(ketQua.mo)}.</Text>
        <Group justify="flex-end">
          <Button variant="default" onClick={dong}>
            Đóng
          </Button>
        </Group>
      </Stack>
    );
  }
  const { thongDiep, nhanNut } = noiDungDaMo(ketQua, buoiSo);
  const href = chuanHoaLienKet(ketQua.link);
  return (
    <Stack gap="md">
      <Text>{thongDiep}</Text>
      {!href && <Text size="sm">Link: {ketQua.link}</Text>}
      <Group justify="flex-end">
        <Button variant="default" onClick={dong}>
          Đóng
        </Button>
        {/* Cùng tab, không target=_blank/window.open — trình duyệt Zalo/Safari iOS chặn cửa sổ mới. */}
        {href && (
          <Button component="a" href={href}>
            {nhanNut}
          </Button>
        )}
      </Group>
    </Stack>
  );
}

function noiDungDaMo(
  ketQua: Exclude<KetQuaVaoHoc, { ket_qua: 'chua_mo' }>,
  buoiSo: number,
): { thongDiep: string; nhanNut: string } {
  switch (ketQua.ket_qua) {
    case 'da_ghi_nhan':
      return { thongDiep: `✅ Đã điểm danh buổi ${buoiSo} lúc ${dinhDangGio(ketQua.luc)}.`, nhanNut: 'Mở phòng Zoom' };
    case 'da_co':
      return { thongDiep: `ℹ️ Bạn đã điểm danh buổi này lúc ${dinhDangGio(ketQua.luc)}.`, nhanNut: 'Mở phòng Zoom' };
    case 'qua_gio':
      return {
        thongDiep: `⚠️ Đã quá thời gian điểm danh (đóng lúc ${dinhDangGio(ketQua.dong)}) nên lượt vào này không được ghi nhận.`,
        nhanNut: 'Vẫn vào Zoom',
      };
  }
}
