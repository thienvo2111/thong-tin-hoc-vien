import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Alert,
  Anchor,
  Badge,
  Button,
  Collapse,
  Group,
  List,
  Modal,
  Paper,
  Stack,
  Table,
  Text,
  Title,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useLayTuKhoa, useXemTruocLayTuKhoa, type XemTruocChup } from '@/api/danhSachThamGia';
import type { DotTrienKhai } from '@/api/dotTrienKhai';
import { thongDiepLoiXungDot } from '@/lib/loiApi';
import { dinhDangSuat } from './danhSachThamGiaNhan';

/** Đợt NLS (issue #68, ADR 0015 M3/S3): chụp danh sách từ ghi danh các khóa của đợt — đủ giai đoạn = 1 suất, thiếu =
 * 0,5 (theo phân lớp, không theo điểm danh). Chụp lại chỉ thay trường chưa nộp hợp đồng (X5). */
export function LayDanhSachTuKhoa({ dot }: { dot: DotTrienKhai }) {
  const xemTruocMut = useXemTruocLayTuKhoa();
  const chupMut = useLayTuKhoa();
  const [xemTruoc, setXemTruoc] = useState<XemTruocChup | null>(null);
  const [moXacNhan, setMoXacNhan] = useState(false);
  const coKhoa = dot.khoa.length > 0;
  const soTruongThay = xemTruoc?.truong.filter((t) => !t.da_nop).length ?? 0;

  function guiXemTruoc() {
    xemTruocMut.mutate(dot.id, { onSuccess: setXemTruoc });
  }

  function chup() {
    chupMut.mutate(dot.id, {
      onSuccess: (kq) => {
        setMoXacNhan(false);
        setXemTruoc(null);
        const giu = kq.giu_nguyen_da_nop.length;
        notifications.show({
          color: 'green',
          message:
            `Đã chụp ${kq.so_dong_da_ghi} dòng cho ${kq.so_truong_da_thay} trường` +
            (giu > 0 ? `; giữ nguyên ${giu} trường đã nộp hợp đồng` : ''),
        });
      },
    });
  }

  return (
    <Paper withBorder radius="md" p="md">
      <Stack gap="sm">
        <Title order={2} size="h4">
          Lấy danh sách từ khóa
        </Title>
        <Text fz="sm" c="dimmed">
          Chụp từ ghi danh các khóa NLS của đợt: học đủ giai đoạn = 1 suất, học 1 giai đoạn = 0,5 suất (theo phân lớp,
          không theo điểm danh). Sửa ghi danh sau khi chụp không tự đổi danh sách — chụp lại nếu cần. Trường đã nộp hợp
          đồng giữ nguyên.
        </Text>
        {coKhoa ? (
          <Text fz="sm">
            <Text span c="dimmed" fz="sm">
              Khóa của đợt:{' '}
            </Text>
            {dot.khoa.map((k) => `${k.ma_khoa} – ${k.ten_khoa}`).join('; ')}
          </Text>
        ) : (
          <Alert color="yellow">
            Đợt chưa gắn khóa NLS nào. Gắn khóa ở màn{' '}
            <Anchor component={Link} to="/quan-tri/dot-trien-khai" fz="sm">
              Chương trình / Đợt
            </Anchor>{' '}
            (bấm Sửa đợt).
          </Alert>
        )}
        <Group>
          <Button onClick={guiXemTruoc} disabled={!coKhoa} loading={xemTruocMut.isPending}>
            Xem trước
          </Button>
        </Group>
        {xemTruocMut.isError && (
          <Alert color="red" role="alert">
            {thongDiepLoiXungDot(xemTruocMut.error)}
          </Alert>
        )}
        {xemTruoc && <KetQuaXemTruoc xt={xemTruoc} />}
        {xemTruoc && (
          <Group justify="flex-end">
            <Button onClick={() => setMoXacNhan(true)} disabled={soTruongThay === 0}>
              Chụp danh sách
            </Button>
          </Group>
        )}
      </Stack>
      <Modal opened={moXacNhan} onClose={() => setMoXacNhan(false)} title="Xác nhận chụp danh sách">
        <Stack gap="sm">
          <Text fz="sm">Thay danh sách của {soTruongThay} trường chưa nộp hợp đồng; trường đã nộp giữ nguyên.</Text>
          {chupMut.isError && (
            <Alert color="red" role="alert">
              {thongDiepLoiXungDot(chupMut.error)}
            </Alert>
          )}
          <Group justify="flex-end" gap="sm">
            <Button variant="default" onClick={() => setMoXacNhan(false)}>
              Hủy
            </Button>
            <Button onClick={chup} loading={chupMut.isPending}>
              Chụp
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Paper>
  );
}

function KetQuaXemTruoc({ xt }: { xt: XemTruocChup }) {
  const [moNgoai, setMoNgoai] = useState(false);
  const { bo_qua } = xt;
  return (
    <Stack gap="sm">
      <Text fz="sm" fw={600}>
        Bản chụp: {xt.so_dong} người, {xt.so_truong} trường, tổng {dinhDangSuat(xt.tong_suat)} suất từ {xt.so_khoa}{' '}
        khóa.
      </Text>
      <Table.ScrollContainer minWidth={640}>
        <Table striped withTableBorder fz="sm" aria-label="Xem trước lấy danh sách từ khóa">
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Trường</Table.Th>
              <Table.Th>Dòng mới</Table.Th>
              <Table.Th>Dòng hiện có</Table.Th>
              <Table.Th>Tổng suất mới</Table.Th>
              <Table.Th>Ghi chú</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {xt.truong.map((t) => (
              <Table.Tr key={t.don_vi_id}>
                <Table.Td>{t.ma ? `${t.ten} (${t.ma})` : t.ten}</Table.Td>
                <Table.Td>{t.so_dong_moi}</Table.Td>
                <Table.Td>{t.so_dong_cu}</Table.Td>
                <Table.Td>{dinhDangSuat(t.tong_suat_moi)}</Table.Td>
                <Table.Td>
                  <Group gap={4}>
                    {t.da_nop && (
                      <Badge color="orange" variant="light">
                        Đã nộp – giữ nguyên
                      </Badge>
                    )}
                    {t.co_de_nghi_cho && (
                      <Badge color="yellow" variant="light">
                        Có đề nghị chờ
                      </Badge>
                    )}
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>
      <Text fz="sm">
        Bỏ qua: {bo_qua.chua_phan_lop} người chưa phân lớp, {bo_qua.ngoai_pham_vi.length} người ngoài phạm vi,{' '}
        {bo_qua.trung_khoa} người ghi danh nhiều khóa (gộp 1 dòng).
      </Text>
      {bo_qua.ngoai_pham_vi.length > 0 && (
        <Stack gap={4}>
          <Group>
            <Button variant="subtle" size="xs" aria-expanded={moNgoai} onClick={() => setMoNgoai((v) => !v)}>
              {moNgoai ? 'Ẩn' : 'Xem'} {bo_qua.ngoai_pham_vi.length} người ngoài phạm vi
            </Button>
          </Group>
          <Collapse in={moNgoai}>
            <List size="sm" aria-label="Người ngoài phạm vi">
              {bo_qua.ngoai_pham_vi.map((n) => (
                <List.Item key={n.hoc_vien_id}>
                  {n.ho_ten} — {n.don_vi_ten}: {n.ly_do}
                </List.Item>
              ))}
            </List>
          </Collapse>
        </Stack>
      )}
      {xt.truong_bi_xoa.length > 0 && (
        <Alert color="orange" title="Trường sẽ không còn ai trong danh sách">
          {xt.truong_bi_xoa.map((t) => t.ten).join(', ')} đang có danh sách nhưng bản chụp mới không có ai — danh sách
          của các trường này sẽ thành rỗng.
        </Alert>
      )}
    </Stack>
  );
}
