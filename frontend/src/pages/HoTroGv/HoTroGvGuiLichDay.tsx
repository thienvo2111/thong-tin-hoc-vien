import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Alert,
  Badge,
  Button,
  Checkbox,
  Container,
  Group,
  Modal,
  NativeSelect,
  Skeleton,
  Stack,
  Table,
  Text,
  Title,
  Tooltip,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  useDanhSachEmailLichDay,
  useGuiEmailLichDay,
  useKhoaCuaToiGv,
  useXemTruocEmailLichDay,
  type DongGiangVienEmail,
  type GiaiDoanChon,
  type LyDoBoQua,
} from '@/api/emailLichDay';
import { NHAN_NHAC } from '@/api/nhacLich';
import { thongDiepLoiChung } from '@/lib/loiApi';
import { dinhDangNgayGio } from '@/lib/ngay';

const NHAN_BO_QUA: Record<LyDoBoQua, string> = {
  khong_co_email: 'chưa có email',
  khong_co_buoi: 'không có buổi trong giai đoạn',
  loi_he_thong: 'lỗi hệ thống, thử lại sau',
};

/** Giai đoạn chưa kết thúc sớm nhất; hết thì giai đoạn cuối. */
function giaiDoanMacDinh(ds: GiaiDoanChon[]): string | null {
  const homNay = new Date().toISOString().slice(0, 10);
  return (ds.find((g) => g.thoi_gian_ket_thuc.slice(0, 10) >= homNay) ?? ds[ds.length - 1])?.id ?? null;
}

const coTheGui = (g: DongGiangVienEmail) => !!g.email?.trim();

function OEmailCuoi({ g }: { g: DongGiangVienEmail }) {
  const e = g.email_cuoi;
  if (!e) return <Text fz="sm" c="dimmed">—</Text>;
  if (e.trang_thai === 'cho_gui') return <Badge variant="light" color="blue">Đang chờ gửi</Badge>;
  if (e.trang_thai === 'that_bai') {
    return (
      <Tooltip label={e.loi ?? 'Gửi thất bại'}>
        <Badge variant="light" color="red">Lỗi</Badge>
      </Tooltip>
    );
  }
  return <Text fz="sm">Đã gửi {dinhDangNgayGio(e.gui_luc)}</Text>;
}

/** ADR 0009: gửi email lịch giảng dạy theo giai đoạn – khóa, chỉ khi bấm nút. */
export default function HoTroGvGuiLichDay() {
  const [params, setParams] = useSearchParams();
  const khoaQ = useKhoaCuaToiGv();
  const khoaId = params.get('khoa') ?? khoaQ.data?.[0]?.id ?? null;
  const khoa = khoaQ.data?.find((k) => k.id === khoaId);
  const gdId = params.get('gd') ?? (khoa ? giaiDoanMacDinh(khoa.giai_doan) : null);

  const dsQ = useDanhSachEmailLichDay(khoaId, gdId);
  const gui = useGuiEmailLichDay(khoaId, gdId);
  const [chon, setChon] = useState<Set<string>>(new Set());
  const [xemId, setXemId] = useState<string | null>(null);
  const [xacNhan, setXacNhan] = useState(false);
  const xem = useXemTruocEmailLichDay(khoaId, gdId, xemId);
  // Khóa đồng bộ: isPending của mutation chỉ cập nhật ở lần render sau, bấm đúp vẫn lọt.
  const dangGui = useRef(false);
  const gvs = useMemo(() => dsQ.data?.giang_vien ?? [], [dsQ.data]);

  // Mỗi lần tải danh sách: tích sẵn người có email mà chưa nhắc / cần nhắc lại.
  useEffect(() => {
    setChon(new Set(gvs.filter((g) => coTheGui(g) && g.trang_thai_nhac !== 'da_nhac').map((g) => g.id)));
  }, [gvs]);

  const doiThamSo = (khoa: string, gd: string | null) =>
    setParams(gd ? { khoa, gd } : { khoa }, { replace: true });

  const bat = (id: string) =>
    setChon((s) => {
      const moi = new Set(s);
      if (moi.has(id)) moi.delete(id);
      else moi.add(id);
      return moi;
    });

  const tenGd = khoa?.giai_doan.find((g) => g.id === gdId)?.ten_giai_doan ?? '';

  function guiNgay() {
    if (dangGui.current) return;
    dangGui.current = true;
    gui.mutate([...chon], {
      onSettled: () => {
        dangGui.current = false;
      },
      onSuccess: (kq) => {
        setXacNhan(false);
        const boQua = kq.bo_qua.length
          ? ` Bỏ qua ${kq.bo_qua.length}: ${kq.bo_qua.map((b) => `${b.ho_ten} (${NHAN_BO_QUA[b.ly_do]})`).join(', ')}.`
          : '';
        notifications.show({
          color: kq.bo_qua.length ? 'yellow' : 'green',
          message: `Đã xếp hàng ${kq.da_xep_hang} email — sẽ gửi dần trong vài phút.${boQua}`,
          autoClose: kq.bo_qua.length ? false : 6000,
        });
      },
      onError: (err) => notifications.show({ color: 'red', message: thongDiepLoiChung(err) }),
    });
  }

  return (
    <Container size="lg" py="lg">
      <Stack gap="md">
        <Title order={3}>Gửi lịch dạy qua email</Title>
        {khoaQ.isLoading && <Skeleton height={60} />}
        {khoaQ.isError && <Alert color="red">{thongDiepLoiChung(khoaQ.error)}</Alert>}
        {khoaQ.data && khoaQ.data.length === 0 && (
          <Text c="dimmed">Thầy/Cô chưa được phân công vào nhóm hỗ trợ giảng viên của khóa nào.</Text>
        )}
        {khoaQ.data && khoaQ.data.length > 0 && (
          <Group gap="sm" align="flex-end" wrap="wrap">
            <NativeSelect
              label="Khóa bồi dưỡng"
              value={khoaId ?? ''}
              onChange={(e) => doiThamSo(e.currentTarget.value, null)}
              data={khoaQ.data.map((k) => ({ value: k.id, label: `${k.ma_khoa} – ${k.ten_khoa}` }))}
              w={{ base: '100%', sm: 360 }}
            />
            <NativeSelect
              label="Giai đoạn"
              value={gdId ?? ''}
              onChange={(e) => khoaId && doiThamSo(khoaId, e.currentTarget.value)}
              data={(khoa?.giai_doan ?? []).map((g) => ({ value: g.id, label: `${g.thu_tu}. ${g.ten_giai_doan}` }))}
              w={{ base: '100%', sm: 280 }}
            />
          </Group>
        )}

        {dsQ.isLoading && <Skeleton height={160} />}
        {dsQ.isError && <Alert color="red">{thongDiepLoiChung(dsQ.error)}</Alert>}
        {dsQ.data && gvs.length === 0 && (
          <Text c="dimmed" ta="center" py="lg">
            Giai đoạn này chưa phân công giảng viên
          </Text>
        )}

        {gvs.length > 0 && (
          <>
            <Table.ScrollContainer minWidth={720}>
              <Table verticalSpacing="sm" striped>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th w={40} />
                    <Table.Th>Giảng viên</Table.Th>
                    <Table.Th>Email</Table.Th>
                    <Table.Th>Buổi / lớp</Table.Th>
                    <Table.Th>Trạng thái nhắc</Table.Th>
                    <Table.Th>Email gần nhất</Table.Th>
                    <Table.Th />
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {gvs.map((g) => (
                    <Table.Tr key={g.id}>
                      <Table.Td>
                        <Checkbox
                          aria-label={`Chọn ${g.ho_ten}`}
                          checked={chon.has(g.id)}
                          disabled={!coTheGui(g)}
                          onChange={() => bat(g.id)}
                        />
                      </Table.Td>
                      <Table.Td>
                        <Text fz="sm" fw={600}>{g.ho_ten}</Text>
                      </Table.Td>
                      <Table.Td>
                        {coTheGui(g) ? (
                          <Text fz="sm">{g.email}</Text>
                        ) : (
                          <Text fz="xs" c="red">Chưa có email — cập nhật ở Danh mục giảng viên</Text>
                        )}
                      </Table.Td>
                      <Table.Td>
                        <Text fz="sm">{g.so_buoi} buổi · {g.so_lop} lớp</Text>
                      </Table.Td>
                      <Table.Td>
                        <Badge variant="light" color={NHAN_NHAC[g.trang_thai_nhac].mau}>
                          {NHAN_NHAC[g.trang_thai_nhac].nhan}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        <OEmailCuoi g={g} />
                      </Table.Td>
                      <Table.Td>
                        <Button variant="subtle" size="xs" onClick={() => setXemId(g.id)}>
                          Xem trước
                        </Button>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>
            <Group justify="flex-end">
              <Button disabled={chon.size === 0} onClick={() => setXacNhan(true)}>
                Gửi email ({chon.size})
              </Button>
            </Group>
          </>
        )}
      </Stack>

      <Modal opened={!!xemId} onClose={() => setXemId(null)} title="Xem trước email" size="xl">
        {xem.isLoading && <Skeleton height={300} />}
        {xem.isError && <Alert color="red">{thongDiepLoiChung(xem.error)}</Alert>}
        {xem.data && (
          <Stack gap="xs">
            <Text fz="sm">
              <b>Tiêu đề:</b> {xem.data.tieu_de}
            </Text>
            <Text fz="sm" c="dimmed">
              Gửi tới: {xem.data.email ?? 'chưa có email'}
              {xem.data.la_cap_nhat ? ' · Bản cập nhật' : ''}
            </Text>
            <iframe
              title="Nội dung email"
              sandbox=""
              srcDoc={xem.data.html}
              style={{ width: '100%', height: 560, border: '1px solid var(--mantine-color-gray-3)', borderRadius: 8 }}
            />
          </Stack>
        )}
      </Modal>

      <Modal opened={xacNhan} onClose={() => !gui.isPending && setXacNhan(false)} title="Xác nhận gửi email">
        <Stack gap="md">
          <Text fz="sm">
            Gửi lịch giảng dạy {tenGd} cho {chon.size} giảng viên? Email sẽ vào hàng đợi và gửi dần trong vài phút.
          </Text>
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setXacNhan(false)} disabled={gui.isPending}>
              Hủy
            </Button>
            <Button onClick={guiNgay} loading={gui.isPending}>
              Gửi
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Container>
  );
}
