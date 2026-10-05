import { useEffect, useState } from 'react';
import { ActionIcon, Alert, Button, Group, Paper, Skeleton, Stack, Table, Text, TextInput, Title } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { layThangMuc, luuThangMuc, type MucThang } from '@/api/ketQuaKhaoSat';
import { chuanHoaNfc } from '@/lib/nfc';
import { loiFieldsThanhMap, thongDiepLoiChung } from '@/lib/loiApi';
import { dinhDangNgayGio } from '@/lib/ngay';

const MA_HOP_LE = /^[A-Z0-9]{1,10}$/;
const queryKey = ['admin', 'thang-muc-khao-sat'] as const;

/** Thang mức kết quả khảo sát (quan_tri, 2026-10-05): hệ thống khảo sát chỉ gửi MÃ mức (`muc_goc`),
 * cổng tra nhãn ở đây để hiện cho học viên ("M1 – Chưa đạt"). Sửa xong có hiệu lực ngay, kể cả kết
 * quả đã nhận trước đó. Chưa quy đổi sang 3 mức xếp lớp. */
export function TheThangMuc() {
  const qc = useQueryClient();
  const { data, isLoading, isError, error } = useQuery({ queryKey, queryFn: layThangMuc });
  const [dong, setDong] = useState<MucThang[]>([]);

  useEffect(() => {
    if (data) setDong(data.thang);
  }, [data]);

  const luu = useMutation({
    mutationFn: () => luuThangMuc(dong.map((d) => ({ ma: d.ma.trim().toUpperCase(), nhan: chuanHoaNfc(d.nhan.trim()) }))),
    onSuccess: (kq) => {
      qc.setQueryData(queryKey, kq);
      qc.invalidateQueries({ queryKey: ['admin', 'ket-qua-khao-sat'] });
      notifications.show({ color: 'green', message: 'Đã lưu thang mức' });
    },
  });

  const maChuan = dong.map((d) => d.ma.trim().toUpperCase());
  const loiDong = dong.map((d, i) => {
    if (!MA_HOP_LE.test(maChuan[i])) return 'Mã chỉ gồm chữ không dấu và số, tối đa 10 ký tự';
    if (maChuan.indexOf(maChuan[i]) !== i) return 'Mã bị trùng';
    if (!d.nhan.trim() || d.nhan.trim().length > 40) return 'Nhãn 1–40 ký tự';
    return null;
  });
  const coLoi = dong.length === 0 || loiDong.some(Boolean);
  const loiApi = loiFieldsThanhMap(luu.error);

  function sua(i: number, truong: keyof MucThang, giaTri: string) {
    setDong((ds) => ds.map((d, j) => (j === i ? { ...d, [truong]: giaTri } : d)));
  }

  return (
    <Paper withBorder radius="md" p="lg">
      <Stack gap="md">
        <Title order={2} fz={16}>
          Thang mức kết quả khảo sát
        </Title>
        <Text fz="sm" c="dimmed">
          Hệ thống khảo sát gửi về <b>mã mức</b> (trường <code>muc_goc</code>), cổng hiện cho học viên dạng "mã – nhãn".
          Mã không có trong bảng sẽ bị từ chối. Đổi nhãn có hiệu lực ngay với cả kết quả đã nhận.
        </Text>

        {isLoading && <Skeleton height={120} />}
        {isError && <Alert color="red">{thongDiepLoiChung(error)}</Alert>}

        {data && (
          <>
            <Table verticalSpacing="xs" aria-label="Thang mức">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th w={140}>Mã</Table.Th>
                  <Table.Th>Nhãn</Table.Th>
                  <Table.Th>Học viên thấy</Table.Th>
                  <Table.Th w={40} />
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {dong.map((d, i) => (
                  <Table.Tr key={i}>
                    <Table.Td>
                      <TextInput
                        aria-label={`Mã mức dòng ${i + 1}`}
                        value={d.ma}
                        onChange={(e) => sua(i, 'ma', e.currentTarget.value)}
                        error={loiDong[i]?.startsWith('Mã') ? loiDong[i] : undefined}
                      />
                    </Table.Td>
                    <Table.Td>
                      <TextInput
                        aria-label={`Nhãn mức dòng ${i + 1}`}
                        value={d.nhan}
                        onChange={(e) => sua(i, 'nhan', e.currentTarget.value)}
                        error={loiDong[i]?.startsWith('Nhãn') ? loiDong[i] : undefined}
                      />
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">{`${maChuan[i]} – ${d.nhan.trim()}`}</Text>
                    </Table.Td>
                    <Table.Td>
                      <ActionIcon
                        variant="subtle"
                        color="red"
                        aria-label={`Xóa mức dòng ${i + 1}`}
                        onClick={() => setDong((ds) => ds.filter((_, j) => j !== i))}
                      >
                        ✕
                      </ActionIcon>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>

            {(loiApi.muc || (luu.isError && !Object.keys(loiApi).length)) && (
              <Alert color="red">{loiApi.muc ?? thongDiepLoiChung(luu.error)}</Alert>
            )}

            <Group justify="space-between">
              <Button
                variant="default"
                disabled={dong.length >= 10}
                onClick={() => setDong((ds) => [...ds, { ma: '', nhan: '' }])}
              >
                Thêm mức
              </Button>
              <Group gap="sm">
                {data.cap_nhat_luc && (
                  <Text fz="xs" c="dimmed">
                    Cập nhật {dinhDangNgayGio(data.cap_nhat_luc)}
                  </Text>
                )}
                <Button onClick={() => luu.mutate()} loading={luu.isPending} disabled={coLoi}>
                  Lưu thang mức
                </Button>
              </Group>
            </Group>
          </>
        )}
      </Stack>
    </Paper>
  );
}
