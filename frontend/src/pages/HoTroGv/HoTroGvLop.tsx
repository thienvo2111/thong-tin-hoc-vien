import { Link } from 'react-router-dom';
import { Alert, Anchor, Badge, Container, Paper, Skeleton, Stack, Table, Text, Title } from '@mantine/core';
import { useLopCuaToiGv } from '@/api/hoTroGv';
import { thongDiepLoiChung } from '@/lib/loiApi';

const NHAN_LOAI_LOP = { truc_tiep: 'Trực tiếp', zoom: 'Zoom', vle: 'VLE' } as const;

/** Lớp trong phạm vi người hỗ trợ giảng viên (ADR 0004 L1) — hiện = mọi lớp của các khóa trong nhóm. */
export default function HoTroGvLop() {
  const { data, isLoading, isError, error } = useLopCuaToiGv();

  return (
    <Container size="lg" py="lg">
      <Stack gap="md">
        <Title order={3}>Lớp được phân công</Title>
        {isLoading && <Skeleton height={160} />}
        {isError && <Alert color="red">{thongDiepLoiChung(error)}</Alert>}
        {data && data.length === 0 && (
          <Alert color="yellow" variant="light">
            Thầy/Cô chưa được phân công vào nhóm hỗ trợ giảng viên của khóa nào. Liên hệ Quản trị để được phân công.
          </Alert>
        )}
        {data && data.length > 0 && (
          <Paper withBorder radius={14} style={{ overflow: 'hidden' }}>
            <Table.ScrollContainer minWidth={560}>
              <Table verticalSpacing="sm" horizontalSpacing="md">
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Khóa</Table.Th>
                    <Table.Th>Lớp</Table.Th>
                    <Table.Th>Loại</Table.Th>
                    <Table.Th>Số buổi</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {data.map((l) => (
                    <Table.Tr key={l.id}>
                      <Table.Td>
                        <Text fw={600} fz="sm">
                          {l.khoa.ma_khoa}
                        </Text>
                        <Text fz={12} c="dimmed">
                          {l.khoa.ten_khoa}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Anchor component={Link} to={`/ho-tro-gv/lop/${l.id}`} fw={600} fz="sm">
                          {l.ten_lop}
                        </Anchor>
                      </Table.Td>
                      <Table.Td>
                        <Badge variant="light" size="sm">
                          {NHAN_LOAI_LOP[l.loai_lop]}
                        </Badge>
                      </Table.Td>
                      <Table.Td>{l._count.lich_hoc}</Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>
          </Paper>
        )}
      </Stack>
    </Container>
  );
}
