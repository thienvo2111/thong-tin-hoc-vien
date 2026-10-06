import { Link, useParams } from 'react-router-dom';
import { Alert, Anchor, Container, Paper, Skeleton, Stack, Table, Text, Title } from '@mantine/core';
import { useDotCuaLop } from '@/api/hoTroGv';
import { thongDiepLoiChung } from '@/lib/loiApi';
import { dinhDangNgay } from '@/lib/ngay';

/** Các đợt học trực tiếp của 1 lớp (ADR 0004 L2) — mỗi đợt mở Hồ sơ chuẩn bị lớp. */
export default function HoTroGvDotLop() {
  const { lopId = '' } = useParams();
  const { data, isLoading, isError, error } = useDotCuaLop(lopId);

  return (
    <Container size="lg" py="lg">
      <Stack gap="md">
        <Anchor component={Link} to="/ho-tro-gv" fz="sm">
          ← Danh sách lớp
        </Anchor>
        {isLoading && <Skeleton height={120} />}
        {isError && <Alert color="red">{thongDiepLoiChung(error)}</Alert>}
        {data && (
          <>
            <Title order={3}>
              {data.lop.ten_lop} · {data.lop.khoa.ma_khoa}
            </Title>
            {data.dot.length === 0 ? (
              <Alert color="yellow" variant="light">
                Lớp chưa có buổi học trực tiếp nào.
              </Alert>
            ) : (
              <Paper withBorder radius={14} style={{ overflow: 'hidden' }}>
                <Table verticalSpacing="sm" horizontalSpacing="md">
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Đợt trực tiếp</Table.Th>
                      <Table.Th>Thời gian giai đoạn</Table.Th>
                      <Table.Th>Số buổi</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {data.dot.map((d) => (
                      <Table.Tr key={d.id}>
                        <Table.Td>
                          <Anchor component={Link} to={`/ho-tro-gv/lop/${lopId}/giai-doan/${d.id}`} fw={600}>
                            GĐ {d.thu_tu} — {d.ten_giai_doan}
                          </Anchor>
                        </Table.Td>
                        <Table.Td>
                          <Text fz="sm">
                            {dinhDangNgay(d.thoi_gian_bat_dau)} – {dinhDangNgay(d.thoi_gian_ket_thuc)}
                          </Text>
                        </Table.Td>
                        <Table.Td>{d.so_buoi}</Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </Paper>
            )}
          </>
        )}
      </Stack>
    </Container>
  );
}
