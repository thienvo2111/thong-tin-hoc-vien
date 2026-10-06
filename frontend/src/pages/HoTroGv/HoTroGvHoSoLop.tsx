import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Alert, Anchor, Badge, Button, Container, Group, Paper, SimpleGrid, Skeleton, Stack, Table, Tabs, Text, Title } from '@mantine/core';
import { ModalPhanCongBuoi } from '@/pages/Admin/ModalPhanCongBuoi';
import { KhungThucDia, ModalSuaBuoiGv, TheHauCan } from './VanHanhLop';
import { KhungBangKiem } from './KhungBangKiem';
import { useTrangLopGv, type TrangLop } from '@/api/hoTroGv';
import { thongDiepLoiChung } from '@/lib/loiApi';
import { dinhDangGio, dinhDangNgay, dinhDangNgayGio } from '@/lib/ngay';

const NHAN_VAI_TRO = { giang_vien: 'Giảng viên', ho_tro: 'Hỗ trợ' } as const;
const NHAN_DOI_TUONG: Record<string, string> = { giao_vien: 'Giáo viên', can_bo_quan_ly: 'CBQL' };
const NHAN_MUC: Record<string, string> = { co_ban: 'Cơ bản', thanh_thao: 'Thành thạo', nang_cao: 'Nâng cao' };

/** Hồ sơ chuẩn bị lớp (ADR 0004 G5): L2 bản đọc; L3 (issue #16) sửa buổi có lý do, phân công giảng viên,
 * hậu cần, thực địa. Bảng kiểm/biểu mẫu thêm ở các lát sau. */
export default function HoTroGvHoSoLop() {
  const { lopId = '', gdId = '' } = useParams();
  const { data, isLoading, isError, error } = useTrangLopGv(lopId, gdId);

  return (
    <Container size="xl" py="lg">
      <Stack gap="md">
        <Anchor component={Link} to={`/ho-tro-gv/lop/${lopId}`} fz="sm">
          ← Các đợt của lớp
        </Anchor>
        {isLoading && <Skeleton height={200} />}
        {isError && <Alert color="red">{thongDiepLoiChung(error)}</Alert>}
        {data && <NoiDung d={data} />}
      </Stack>
    </Container>
  );
}

function NoiDung({ d }: { d: TrangLop }) {
  const siSo = d.hoc_vien.length;
  const [buoiSua, setBuoiSua] = useState<TrangLop['buoi'][number] | null>(null);
  const [buoiPhanCong, setBuoiPhanCong] = useState<TrangLop['buoi'][number] | null>(null);
  // Giảng viên của đợt (gộp mọi buổi) — mỗi người 1 thẻ hậu cần.
  const giangVienDot = useMemo(() => {
    const m = new Map<string, { id: string; ho_ten: string; so_dien_thoai?: string }>();
    for (const b of d.buoi) for (const g of b.giang_vien) if (!m.has(g.id)) m.set(g.id, g);
    return [...m.values()];
  }, [d.buoi]);
  const bayGio = Date.now();
  return (
    <>
      <div>
        <Title order={3}>
          {d.lop.ten_lop} · GĐ {d.giai_doan.thu_tu} — {d.giai_doan.ten_giai_doan}
        </Title>
        <Text c="dimmed" fz="sm">
          {d.lop.khoa.ma_khoa} — {d.lop.khoa.ten_khoa} · {dinhDangNgay(d.giai_doan.thoi_gian_bat_dau)} – {dinhDangNgay(d.giai_doan.thoi_gian_ket_thuc)}
        </Text>
      </div>
      <Tabs defaultValue="tong-quan">
        <Tabs.List>
          <Tabs.Tab value="tong-quan">Tổng quan</Tabs.Tab>
          <Tabs.Tab value="lich">Lịch & điểm học</Tabs.Tab>
          <Tabs.Tab value="giang-vien">Giảng viên</Tabs.Tab>
          <Tabs.Tab value="hoc-vien">Học viên ({siSo})</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="tong-quan" pt="md">
          <Stack mb="md">
            <KhungBangKiem lopId={d.lop.id} gdId={d.giai_doan.id} />
          </Stack>
          <SimpleGrid cols={{ base: 1, sm: 3 }}>
            <Paper withBorder p="md" radius={12}>
              <Text fz="xs" c="dimmed">
                Số buổi
              </Text>
              <Text fw={700} fz="xl">
                {d.buoi.length}
              </Text>
            </Paper>
            <Paper withBorder p="md" radius={12}>
              <Text fz="xs" c="dimmed">
                Sĩ số
              </Text>
              <Text fw={700} fz="xl">
                {siSo}
                {d.lop.si_so_toi_da ? ` / ${d.lop.si_so_toi_da}` : ''}
              </Text>
            </Paper>
            <Paper withBorder p="md" radius={12}>
              <Text fz="xs" c="dimmed">
                Nhóm hỗ trợ giảng viên
              </Text>
              {d.nhom_ho_tro_gv.map((n) => (
                <Text key={n.ho_ten} fz="sm">
                  {n.ho_ten}
                  {n.email ? ` · ${n.email}` : ''}
                </Text>
              ))}
            </Paper>
          </SimpleGrid>
        </Tabs.Panel>

        <Tabs.Panel value="lich" pt="md">
          <Paper withBorder radius={12} style={{ overflow: 'hidden' }}>
            <Table.ScrollContainer minWidth={640}>
              <Table verticalSpacing="sm">
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Buổi</Table.Th>
                    <Table.Th>Thời gian</Table.Th>
                    <Table.Th>Điểm học</Table.Th>
                    <Table.Th>Phòng</Table.Th>
                    <Table.Th />
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {d.buoi.map((b) => (
                    <Table.Tr key={b.id}>
                      <Table.Td>{b.buoi_so}</Table.Td>
                      <Table.Td style={{ whiteSpace: 'nowrap' }}>
                        {dinhDangNgayGio(b.thoi_gian_bat_dau)}–{dinhDangGio(b.thoi_gian_ket_thuc)}
                      </Table.Td>
                      <Table.Td>
                        {b.diem_hoc ? (
                          <>
                            <Text fz="sm" fw={600}>
                              {b.diem_hoc.ten}
                            </Text>
                            <Text fz="xs" c="dimmed">
                              {b.diem_hoc.dia_chi}
                              {b.diem_hoc.nguoi_lien_he ? ` · ${b.diem_hoc.nguoi_lien_he}` : ''}
                              {b.diem_hoc.sdt_lien_he ? ` (${b.diem_hoc.sdt_lien_he})` : ''}
                            </Text>
                          </>
                        ) : (
                          <Text fz="sm" c="red">
                            Chưa có
                          </Text>
                        )}
                      </Table.Td>
                      <Table.Td>{b.phong ?? '—'}</Table.Td>
                      <Table.Td ta="right" style={{ whiteSpace: 'nowrap' }}>
                        <Button size="xs" variant="subtle" onClick={() => setBuoiPhanCong(b)}>
                          Giảng viên
                        </Button>
                        <Button
                          size="xs"
                          variant="subtle"
                          disabled={new Date(b.thoi_gian_bat_dau).getTime() <= bayGio}
                          title={new Date(b.thoi_gian_bat_dau).getTime() <= bayGio ? 'Buổi đã diễn ra' : undefined}
                          onClick={() => setBuoiSua(b)}
                        >
                          Sửa
                        </Button>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>
          </Paper>
          <Stack mt="md">
            <KhungThucDia lopId={d.lop.id} gdId={d.giai_doan.id} thucDia={d.thuc_dia} />
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="giang-vien" pt="md">
          <Stack gap="sm">
            {giangVienDot.length > 0 && (
              <Text fw={700} fz="sm">
                Hậu cần giảng viên
              </Text>
            )}
            {giangVienDot.map((g) => (
              <TheHauCan
                key={g.id}
                lopId={d.lop.id}
                gdId={d.giai_doan.id}
                giangVien={g}
                hauCan={d.hau_can.find((h) => h.giang_vien_id === g.id)}
              />
            ))}
            <Text fw={700} fz="sm" mt="sm">
              Giảng viên theo buổi
            </Text>
            {d.buoi.map((b) => (
              <Paper key={b.id} withBorder radius={12} p="sm">
                <Text fw={600} fz="sm">
                  Buổi {b.buoi_so} · {dinhDangNgayGio(b.thoi_gian_bat_dau)}
                </Text>
                {b.giang_vien.length === 0 ? (
                  <Text fz="sm" c="red">
                    Chưa phân công giảng viên
                  </Text>
                ) : (
                  b.giang_vien.map((g) => (
                    <Group key={g.id} gap="xs">
                      <Text fz="sm">
                        {g.ho_ten} — {NHAN_VAI_TRO[g.vai_tro]}
                      </Text>
                      {g.so_dien_thoai && (
                        <Anchor href={`tel:${g.so_dien_thoai}`} fz="sm">
                          {g.so_dien_thoai}
                        </Anchor>
                      )}
                      {g.email && (
                        <Text fz="xs" c="dimmed">
                          {g.email}
                        </Text>
                      )}
                    </Group>
                  ))
                )}
              </Paper>
            ))}
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="hoc-vien" pt="md">
          {(d.de_nghi_cho ?? []).length > 0 && (
            <Alert color="yellow" variant="light" mb="sm" title="Đề nghị đổi lớp đang chờ duyệt">
              {(d.de_nghi_cho ?? []).map((x) => (
                <Text key={x.id} fz="sm">
                  {x.ho_ten}: {x.tu_lop ?? 'Chưa phân lớp'} → {x.den_lop} — {x.ly_do}
                </Text>
              ))}
              <Anchor component={Link} to="/ho-tro-gv/de-nghi-doi-lop" fz="sm" fw={600}>
                Mở danh sách đề nghị
              </Anchor>
            </Alert>
          )}
          <Paper withBorder radius={12} style={{ overflow: 'hidden' }}>
            <Table.ScrollContainer minWidth={760}>
              <Table verticalSpacing="xs" fz="sm">
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Họ tên</Table.Th>
                    <Table.Th>Đơn vị</Table.Th>
                    <Table.Th>Đối tượng</Table.Th>
                    <Table.Th>Mức đầu vào</Table.Th>
                    <Table.Th>SĐT</Table.Th>
                    <Table.Th>Cụm · người hỗ trợ</Table.Th>
                    <Table.Th>Báo vắng</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {d.hoc_vien.map((h) => (
                    <Table.Tr key={h.dang_ky_hoc_id}>
                      <Table.Td fw={600}>{h.ho_ten}</Table.Td>
                      <Table.Td>{h.don_vi}</Table.Td>
                      <Table.Td>{h.doi_tuong ? NHAN_DOI_TUONG[h.doi_tuong] ?? h.doi_tuong : '—'}</Table.Td>
                      <Table.Td>{h.muc_dau_vao ? <Badge variant="light">{NHAN_MUC[h.muc_dau_vao] ?? h.muc_dau_vao}</Badge> : '—'}</Table.Td>
                      <Table.Td>{h.so_dien_thoai ?? '—'}</Table.Td>
                      <Table.Td>
                        {h.cum ? (
                          <>
                            {h.cum.ten_cum}
                            {h.cum.nguoi_ho_tro.length > 0 && (
                              <Text fz="xs" c="dimmed">
                                {h.cum.nguoi_ho_tro.map((n) => n.ho_ten).join(', ')}
                              </Text>
                            )}
                          </>
                        ) : (
                          '—'
                        )}
                      </Table.Td>
                      <Table.Td>
                        {Object.entries(h.bao_vang ?? {}).map(([lichId, lyDo]) => (
                          <Badge key={lichId} color="orange" variant="light" title={lyDo} mr={4}>
                            Buổi {d.buoi.find((b) => b.id === lichId)?.buoi_so ?? '?'}: {lyDo}
                          </Badge>
                        ))}
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>
          </Paper>
        </Tabs.Panel>
      </Tabs>

      <ModalSuaBuoiGv buoi={buoiSua} onClose={() => setBuoiSua(null)} />
      <ModalPhanCongBuoi
        khu="ho_tro_gv"
        khoaId={d.lop.khoa.id}
        buoi={
          buoiPhanCong
            ? {
                lop: { id: d.lop.id, ten_lop: d.lop.ten_lop },
                lich: {
                  id: buoiPhanCong.id,
                  buoi_so: buoiPhanCong.buoi_so,
                  thoi_gian_bat_dau: buoiPhanCong.thoi_gian_bat_dau,
                  thoi_gian_ket_thuc: buoiPhanCong.thoi_gian_ket_thuc,
                  phan_cong: buoiPhanCong.giang_vien.map((g) => ({
                    id: g.id,
                    vai_tro: g.vai_tro,
                    so_gio: g.so_gio ?? null,
                    da_xac_nhan_gio: g.da_xac_nhan_gio ?? false,
                    giang_vien: { id: g.id, ho_ten: g.ho_ten },
                  })),
                },
              }
            : null
        }
        onClose={() => setBuoiPhanCong(null)}
      />
    </>
  );
}
