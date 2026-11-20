import { useMemo, useState } from 'react';
import { Alert, Badge, Button, FileInput, Group, Modal, Paper, Select, Stack, Table, Text, Title } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  taiMauDanhSach,
  useNapDanhSach,
  useTruongTrongPhamVi,
  useXemTruocDanhSach,
  type DongNap,
  type DongXemTruoc,
  type KetQuaXemTruoc,
} from '@/api/danhSachThamGia';
import { thongDiepLoiChung, thongDiepLoiXungDot } from '@/lib/loiApi';
import { dinhDangNgayLich } from '@/lib/ngayLich';
import { taiFileTuBlob } from '@/lib/taiFile';
import { NHAN_GIAI_DOAN, dinhDangSuat } from './danhSachThamGiaNhan';

const CAN_CHON_TAY = new Set(['khong_khop', 'nhieu_ket_qua']);

/** Dòng bị chặn: có lỗi dữ liệu hoặc không có trường (M6) — không bao giờ gửi đi. */
function biChan(d: DongXemTruoc) {
  return d.loi.length > 0 || d.trang_thai_khop === 'thieu_truong';
}

function TrangThai({ dong }: { dong: DongXemTruoc }) {
  if (dong.loi.length > 0) return <Badge color="red">Lỗi</Badge>;
  switch (dong.trang_thai_khop) {
    case 'khop_ma':
      return <Badge color="green">Khớp mã</Badge>;
    case 'khop_ten':
      return (
        <Badge color="green" variant="light">
          Khớp tên
        </Badge>
      );
    case 'thieu_truong':
      return <Badge color="red">Thiếu trường</Badge>;
    default:
      return <Badge color="yellow">Chọn trường</Badge>;
  }
}

const nfc = (s: string | null) => (s === null ? null : s.normalize('NFC'));

function thanhDongNap(d: DongXemTruoc, donViId: string): DongNap {
  return {
    so_dong: d.so_dong,
    don_vi_id: donViId,
    ho_ten: d.ho_ten.normalize('NFC'),
    ngay_sinh: d.ngay_sinh,
    gioi_tinh: nfc(d.gioi_tinh),
    ma_goc: nfc(d.ma_goc),
    lop: nfc(d.lop),
    // Dòng không lỗi luôn có giai đoạn + suất (backend đã quy đổi).
    giai_doan: d.giai_doan ?? 'ca_hai',
    ty_le_suat: d.ty_le_suat ?? 1,
    ghi_chu: nfc(d.ghi_chu),
  };
}

/** Nạp Excel danh sách HSG (issue #58, ADR 0015 T7): xem trước → chọn trường tay dòng không khớp → xác nhận. */
export function NapDanhSachHsg({ dotId }: { dotId: string }) {
  const [file, setFile] = useState<File | null>(null);
  const [xemTruoc, setXemTruoc] = useState<KetQuaXemTruoc | null>(null);
  const [chonTay, setChonTay] = useState<Record<number, string | null>>({});
  const [moXacNhan, setMoXacNhan] = useState(false);
  const truong = useTruongTrongPhamVi(dotId);
  const xemTruocMut = useXemTruocDanhSach();
  const napMut = useNapDanhSach();

  const luaChonTruong = useMemo(
    () =>
      (truong.data ?? []).map((t) => ({
        value: t.id,
        label: t.ma_don_vi ? `${t.ten_don_vi} (${t.ma_don_vi})` : t.ten_don_vi,
      })),
    [truong.data],
  );

  const dongNap = useMemo(() => {
    if (!xemTruoc) return [];
    return xemTruoc.dong.flatMap((d) => {
      const donViId = d.don_vi_id ?? chonTay[d.so_dong] ?? null;
      return biChan(d) || !donViId ? [] : [thanhDongNap(d, donViId)];
    });
  }, [xemTruoc, chonTay]);
  const soTruong = new Set(dongNap.map((d) => d.don_vi_id)).size;
  // Issue #64 / X5: trường đã nộp hợp đồng (kể cả chọn tay) → server từ chối cả lần nạp.
  const truongDaNop = (xemTruoc?.truong_da_nop ?? []).filter((t) => dongNap.some((d) => d.don_vi_id === t.don_vi_id));
  const soBoQua = (xemTruoc?.dong.length ?? 0) - dongNap.length;

  function taiMau() {
    taiMauDanhSach(dotId)
      .then((blob) => taiFileTuBlob(blob, 'mau-danh-sach-tham-gia-hsg.xlsx'))
      .catch((err) => notifications.show({ color: 'red', message: thongDiepLoiChung(err) }));
  }

  function chonFile(f: File | null) {
    setFile(f);
    setXemTruoc(null);
    setChonTay({});
  }

  function guiXemTruoc() {
    if (!file) return;
    xemTruocMut.mutate(
      { dotId, file },
      {
        onSuccess: (kq) => {
          setXemTruoc(kq);
          setChonTay({});
        },
      },
    );
  }

  function nap() {
    napMut.mutate(
      { dotId, dong: dongNap },
      {
        onSuccess: (kq) => {
          setMoXacNhan(false);
          chonFile(null);
          notifications.show({
            color: 'green',
            message: `Đã nạp ${kq.so_dong} dòng cho ${kq.so_truong} trường (tổng ${dinhDangSuat(kq.tong_suat)} suất)`,
          });
        },
      },
    );
  }

  return (
    <Paper withBorder radius="md" p="md">
      <Stack gap="sm">
        <Title order={2} size="h4">
          Nạp danh sách HSG
        </Title>
        <Text fz="sm" c="dimmed">
          Trường khớp theo mã trường trước, rồi theo tên, chỉ trong phạm vi Sở của đợt. Nạp lại chỉ thay danh sách của
          các trường có trong file.
        </Text>
        <Group gap="sm" align="flex-end" wrap="wrap">
          <Button variant="default" onClick={taiMau}>
            Tải file mẫu
          </Button>
          <FileInput
            label="File Excel"
            placeholder="Chọn file .xlsx"
            accept=".xlsx"
            value={file}
            onChange={chonFile}
            clearable
            w={{ base: '100%', sm: 280 }}
          />
          <Button onClick={guiXemTruoc} disabled={!file} loading={xemTruocMut.isPending}>
            Xem trước
          </Button>
        </Group>
        {xemTruocMut.isError && <Alert color="red">{thongDiepLoiChung(xemTruocMut.error)}</Alert>}
        {xemTruoc && (
          <BangXemTruoc
            ketQua={xemTruoc}
            chonTay={chonTay}
            luaChonTruong={luaChonTruong}
            onChon={(soDong, id) => setChonTay((cu) => ({ ...cu, [soDong]: id }))}
          />
        )}
        {truongDaNop.length > 0 && (
          <Alert color="orange" title="Có trường đã nộp hợp đồng">
            {truongDaNop.map((t) => t.ten_don_vi).join(', ')} đã nộp hợp đồng — nạp sẽ bị từ chối. Mở lại hợp đồng của
            các trường này trước, hoặc bỏ các dòng đó khỏi file.
          </Alert>
        )}
        {xemTruoc && (
          <Group justify="space-between" wrap="wrap" gap="sm">
            <Text fz="sm" fw={600}>
              Sẽ nạp {dongNap.length} dòng cho {soTruong} trường, bỏ qua {soBoQua} dòng.
            </Text>
            <Button onClick={() => setMoXacNhan(true)} disabled={dongNap.length === 0}>
              Xác nhận nạp
            </Button>
          </Group>
        )}
      </Stack>
      <Modal opened={moXacNhan} onClose={() => setMoXacNhan(false)} title="Xác nhận nạp danh sách">
        <Stack gap="sm">
          <Text fz="sm">
            Nạp {dongNap.length} dòng cho {soTruong} trường. Danh sách hiện có của {soTruong} trường này trong đợt sẽ bị
            thay thế; trường không có trong file giữ nguyên.
          </Text>
          {napMut.isError && <Alert color="red">{thongDiepLoiXungDot(napMut.error)}</Alert>}
          <Group justify="flex-end" gap="sm">
            <Button variant="default" onClick={() => setMoXacNhan(false)}>
              Hủy
            </Button>
            <Button onClick={nap} loading={napMut.isPending}>
              Nạp
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Paper>
  );
}

function BangXemTruoc({
  ketQua,
  chonTay,
  luaChonTruong,
  onChon,
}: {
  ketQua: KetQuaXemTruoc;
  chonTay: Record<number, string | null>;
  luaChonTruong: { value: string; label: string }[];
  onChon: (soDong: number, id: string | null) => void;
}) {
  return (
    <Table.ScrollContainer minWidth={960}>
      <Table striped withTableBorder fz="sm" aria-label="Xem trước danh sách">
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Dòng</Table.Th>
            <Table.Th>Trạng thái</Table.Th>
            <Table.Th>Họ tên</Table.Th>
            <Table.Th>Ngày sinh</Table.Th>
            <Table.Th>Lớp</Table.Th>
            <Table.Th>Trường trong file</Table.Th>
            <Table.Th>Trường nạp vào</Table.Th>
            <Table.Th>Giai đoạn</Table.Th>
            <Table.Th>Suất</Table.Th>
            <Table.Th>Ghi chú / lỗi</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {ketQua.dong.map((d) => (
            <Table.Tr key={d.so_dong}>
              <Table.Td>{d.so_dong}</Table.Td>
              <Table.Td>
                <TrangThai dong={d} />
              </Table.Td>
              <Table.Td>{d.ho_ten}</Table.Td>
              <Table.Td>{d.ngay_sinh ? dinhDangNgayLich(d.ngay_sinh) : ''}</Table.Td>
              <Table.Td>{d.lop}</Table.Td>
              <Table.Td>{[d.ma_truong, d.ten_truong].filter(Boolean).join(' – ')}</Table.Td>
              <Table.Td miw={240}>
                {d.loi.length === 0 && CAN_CHON_TAY.has(d.trang_thai_khop) ? (
                  <Select
                    aria-label={`Chọn trường cho dòng ${d.so_dong}`}
                    placeholder="Chọn trường (bỏ trống = không nạp)"
                    data={luaChonTruong}
                    value={chonTay[d.so_dong] ?? null}
                    onChange={(v) => onChon(d.so_dong, v)}
                    searchable
                    clearable
                    size="xs"
                  />
                ) : (
                  <>
                    {d.ten_don_vi_khop ?? ''}
                    {d.da_nop && (
                      <Badge color="orange" variant="light" ml={4}>
                        Đã nộp HĐ
                      </Badge>
                    )}
                  </>
                )}
              </Table.Td>
              <Table.Td>{d.giai_doan ? NHAN_GIAI_DOAN[d.giai_doan] : ''}</Table.Td>
              <Table.Td>{d.ty_le_suat === null ? '' : dinhDangSuat(d.ty_le_suat)}</Table.Td>
              <Table.Td>
                {d.trang_thai_khop === 'thieu_truong' && d.loi.length === 0 && (
                  <Text fz="sm" c="red">
                    Không có mã/tên trường — không nạp
                  </Text>
                )}
                {d.loi.map((l) => (
                  <Text key={l} fz="sm" c="red">
                    {l}
                  </Text>
                ))}
                {d.loi.length === 0 && d.ghi_chu}
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Table.ScrollContainer>
  );
}
