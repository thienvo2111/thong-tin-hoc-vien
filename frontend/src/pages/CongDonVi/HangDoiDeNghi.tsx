import { useEffect, useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  Group,
  Modal,
  Paper,
  SegmentedControl,
  Select,
  Skeleton,
  Stack,
  Table,
  Text,
  Textarea,
  Title,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useApDungDeNghi, useHangDoiDeNghi, useTuChoiDeNghi, type MucDeNghi } from '@/api/deNghiSua';
import { useDanhSachThamGia } from '@/api/danhSachThamGia';
import type { TrangThaiDeNghi } from '@/api/truongDanhSach';
import { thongDiepLoiXungDot } from '@/lib/loiApi';
import { dinhDangNgayGio } from '@/lib/ngay';
import { NHAN_LOAI_DE_NGHI, TRANG_THAI_DE_NGHI, moTaNguoi, thayDoiDeNghi } from './deNghiNhan';

const LOC_TRANG_THAI = (Object.keys(TRANG_THAI_DE_NGHI) as TrangThaiDeNghi[]).map((value) => ({
  value,
  label: TRANG_THAI_DE_NGHI[value].nhan,
}));

/** Hàng đợi "Đề nghị của trường" của 1 đợt (issue #62, ADR 0015 X2): lọc trạng thái + trường, Áp dụng (xác
 * nhận) / Từ chối (bắt buộc lý do). */
export function HangDoiDeNghi({ dotId }: { dotId: string }) {
  const [trangThai, setTrangThai] = useState<TrangThaiDeNghi>('cho');
  const [donViId, setDonViId] = useState<string | null>(null);
  const { data, isLoading, isError, error } = useHangDoiDeNghi(dotId, trangThai, donViId);
  const { data: danhSach } = useDanhSachThamGia(dotId);
  const [apDung, setApDung] = useState<MucDeNghi | null>(null);
  const [tuChoi, setTuChoi] = useState<MucDeNghi | null>(null);
  const luaChonTruong = (danhSach?.tong_hop ?? []).map((t) => ({ value: t.don_vi_id, label: t.ten_don_vi }));

  return (
    <Paper withBorder radius="md" p="md" component="section" aria-labelledby="tieu-de-de-nghi">
      <Stack gap="sm">
        <Group gap="xs">
          <Title order={2} size="h4" id="tieu-de-de-nghi">
            Đề nghị của trường
          </Title>
          {data && (
            <Badge color={data.so_cho > 0 ? 'yellow' : 'gray'} aria-label={`${data.so_cho} đề nghị chờ xử lý`}>
              {data.so_cho}
            </Badge>
          )}
        </Group>
        <Group gap="sm" align="flex-end" wrap="wrap">
          <SegmentedControl
            aria-label="Lọc trạng thái đề nghị"
            data={LOC_TRANG_THAI}
            value={trangThai}
            onChange={(v) => setTrangThai(v as TrangThaiDeNghi)}
          />
          <Select
            label="Trường"
            placeholder="Tất cả trường"
            data={luaChonTruong}
            value={donViId}
            onChange={setDonViId}
            clearable
            searchable
            miw={220}
            comboboxProps={{ withinPortal: true }}
          />
        </Group>
        {isLoading && <Skeleton height={80} radius="md" />}
        {isError && <Alert color="red">{thongDiepLoiXungDot(error)}</Alert>}
        {data && data.items.length === 0 && <Text c="dimmed">Không có đề nghị nào.</Text>}
        {data && data.items.length > 0 && (
          <Stack component="ul" gap="sm" m={0} p={0} style={{ listStyle: 'none' }} aria-label="Danh sách đề nghị">
            {data.items.map((dn) => (
              <TheDeNghi key={dn.id} dn={dn} onApDung={() => setApDung(dn)} onTuChoi={() => setTuChoi(dn)} />
            ))}
          </Stack>
        )}
      </Stack>
      <ModalApDung dotId={dotId} dn={apDung} onClose={() => setApDung(null)} />
      <ModalTuChoi dotId={dotId} dn={tuChoi} onClose={() => setTuChoi(null)} />
    </Paper>
  );
}

function tenNguoi(dn: MucDeNghi): string {
  return dn.dong_hien_tai?.ho_ten ?? dn.gia_tri_cu?.ho_ten ?? dn.gia_tri.ho_ten ?? '';
}

function TheDeNghi({ dn, onApDung, onTuChoi }: { dn: MucDeNghi; onApDung: () => void; onTuChoi: () => void }) {
  const tt = TRANG_THAI_DE_NGHI[dn.trang_thai];
  const hienTai = dn.dong_hien_tai ?? dn.gia_tri_cu;
  const nhan = `${NHAN_LOAI_DE_NGHI[dn.loai]}: ${tenNguoi(dn)}`;
  return (
    <Paper component="li" withBorder radius="md" p="sm" aria-label={nhan}>
      <Stack gap="xs">
        <Group justify="space-between" gap="xs" align="flex-start">
          <div>
            <Text fw={600} style={{ overflowWrap: 'anywhere' }}>
              {dn.don_vi.ten}
            </Text>
            <Text size="sm" c="dimmed">
              Gửi lúc {dinhDangNgayGio(dn.gui_luc)} · {dn.gui_boi.ho_ten}
            </Text>
          </div>
          <Group gap={4}>
            <Badge variant="light">{NHAN_LOAI_DE_NGHI[dn.loai]}</Badge>
            <Badge color={tt.mau} variant="light">
              {tt.nhan}
            </Badge>
          </Group>
        </Group>

        {dn.loai === 'sua' && (
          <>
            <Text size="sm">
              Người: <b>{tenNguoi(dn)}</b>
              {!dn.dong_hien_tai && ' (dòng đã bị xóa)'}
            </Text>
            <Table.ScrollContainer minWidth={360}>
              <Table withTableBorder fz="sm">
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Thông tin</Table.Th>
                    <Table.Th>Hiện tại</Table.Th>
                    <Table.Th>Đề nghị</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {thayDoiDeNghi(dn.gia_tri, hienTai).map((t) => (
                    <Table.Tr key={t.truong}>
                      <Table.Td>{t.nhan}</Table.Td>
                      <Table.Td>{t.cu}</Table.Td>
                      <Table.Td fw={600}>{t.moi}</Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>
          </>
        )}
        {dn.loai !== 'sua' && (
          <Text size="sm" style={{ overflowWrap: 'anywhere' }}>
            {dn.loai === 'bot' ? 'Bớt: ' : 'Thêm: '}
            {moTaNguoi(dn.loai === 'bot' ? (hienTai ?? dn.gia_tri) : dn.gia_tri)
              .map((m) => `${m.nhan}: ${m.giaTri}`)
              .join(' · ')}
            {dn.loai === 'bot' && !dn.dong_hien_tai && ' (dòng đã bị xóa)'}
          </Text>
        )}
        {dn.ly_do && (
          <Text size="sm" style={{ overflowWrap: 'anywhere' }}>
            {dn.loai === 'bot' ? 'Lý do của trường' : 'Ghi chú của trường'}: {dn.ly_do}
          </Text>
        )}
        {dn.trang_thai === 'tu_choi' && (
          <Text size="sm" c="red.8" style={{ overflowWrap: 'anywhere' }}>
            Lý do từ chối: {dn.ly_do_tu_choi}
          </Text>
        )}
        {dn.trang_thai !== 'cho' && dn.xu_ly_luc && (
          <Text size="xs" c="dimmed">
            Xử lý lúc {dinhDangNgayGio(dn.xu_ly_luc)}
            {dn.xu_ly_boi ? ` · ${dn.xu_ly_boi.ho_ten}` : ''}
          </Text>
        )}
        {dn.trang_thai === 'cho' && (
          <Group justify="flex-end" gap="xs">
            <Button size="xs" variant="default" color="red" onClick={onTuChoi} aria-label={`Từ chối — ${nhan}`}>
              Từ chối
            </Button>
            <Button size="xs" onClick={onApDung} aria-label={`Áp dụng — ${nhan}`}>
              Áp dụng
            </Button>
          </Group>
        )}
      </Stack>
    </Paper>
  );
}

function ModalApDung({ dotId, dn, onClose }: { dotId: string; dn: MucDeNghi | null; onClose: () => void }) {
  const apDung = useApDungDeNghi(dotId);
  const { reset } = apDung;
  useEffect(() => reset(), [dn, reset]);

  return (
    <Modal opened={!!dn} onClose={onClose} title="Áp dụng đề nghị" centered>
      <Stack gap="sm">
        {apDung.isError && (
          <Alert color="red" role="alert">
            {thongDiepLoiXungDot(apDung.error)}
          </Alert>
        )}
        {dn && (
          <Text size="sm">
            {NHAN_LOAI_DE_NGHI[dn.loai]} <b>{tenNguoi(dn)}</b> ({dn.don_vi.ten}). Danh sách được cập nhật ngay và dòng
            chuyển thành Đồng ý.
          </Text>
        )}
        <Group justify="flex-end" gap="sm">
          <Button variant="default" onClick={onClose}>
            Hủy
          </Button>
          <Button
            loading={apDung.isPending}
            onClick={() =>
              dn &&
              apDung.mutate(dn.id, {
                onSuccess: () => {
                  notifications.show({ color: 'green', message: 'Đã áp dụng đề nghị' });
                  onClose();
                },
              })
            }
          >
            Áp dụng
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

function ModalTuChoi({ dotId, dn, onClose }: { dotId: string; dn: MucDeNghi | null; onClose: () => void }) {
  const tuChoi = useTuChoiDeNghi(dotId);
  const [lyDo, setLyDo] = useState('');
  const [loiLyDo, setLoiLyDo] = useState<string | null>(null);

  const { reset } = tuChoi;
  useEffect(() => {
    setLyDo('');
    setLoiLyDo(null);
    reset();
  }, [dn, reset]);

  function xacNhan() {
    if (!dn) return;
    const ly_do = lyDo.trim().normalize('NFC');
    if (!ly_do) {
      setLoiLyDo('Nhập lý do từ chối');
      return;
    }
    tuChoi.mutate(
      { id: dn.id, ly_do },
      {
        onSuccess: () => {
          notifications.show({ color: 'green', message: 'Đã từ chối đề nghị' });
          onClose();
        },
      },
    );
  }

  return (
    <Modal opened={!!dn} onClose={onClose} title="Từ chối đề nghị" centered>
      <Stack gap="sm">
        {tuChoi.isError && (
          <Alert color="red" role="alert">
            {thongDiepLoiXungDot(tuChoi.error)}
          </Alert>
        )}
        {dn && (
          <Text size="sm">
            {NHAN_LOAI_DE_NGHI[dn.loai]} <b>{tenNguoi(dn)}</b> ({dn.don_vi.ten}). Trường sẽ thấy lý do; dòng về chưa có
            ý kiến.
          </Text>
        )}
        <Textarea
          label="Lý do từ chối"
          required
          autosize
          minRows={2}
          maxLength={500}
          value={lyDo}
          onChange={(e) => {
            setLyDo(e.currentTarget.value);
            setLoiLyDo(null);
          }}
          error={loiLyDo}
        />
        <Group justify="flex-end" gap="sm">
          <Button variant="default" onClick={onClose}>
            Hủy
          </Button>
          <Button color="red" loading={tuChoi.isPending} onClick={xacNhan}>
            Từ chối
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
