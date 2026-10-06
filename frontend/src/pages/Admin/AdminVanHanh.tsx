import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Alert, Anchor, Badge, Container, Group, Paper, SimpleGrid, Skeleton, Stack, Text, Title } from '@mantine/core';
import { useVanHanh, type VanHanh } from '@/api/vanHanh';
import { thongDiepLoiChung } from '@/lib/loiApi';
import { dinhDangNgay, dinhDangNgayGio } from '@/lib/ngay';
import { AdminPageHeader } from './AdminPageHeader';

const NHAN_VAI_TRO: Record<string, string> = {
  quan_tri: 'Quản trị',
  ho_tro_giang_vien: 'Hỗ trợ GV',
  ho_tro_hoc_vien: 'Hỗ trợ HV',
};

const NHAN_TRUONG: Record<string, string> = {
  thoi_gian_bat_dau: 'Bắt đầu',
  thoi_gian_ket_thuc: 'Kết thúc',
  dia_diem_hoac_link: 'Địa điểm',
  diem_hoc_id: 'Điểm học',
  phong: 'Phòng',
};

const khoaLink = (khoaId: string) => `/admin/khoa-boi-duong/${khoaId}`;

function giaTri(truong: string, v: string | null | undefined): string {
  if (v == null || v === '') return '—';
  if (truong.startsWith('thoi_gian')) return dinhDangNgayGio(v);
  if (truong === 'diem_hoc_id') return 'đã đổi';
  return v;
}

/** Màn giám sát vận hành (ADR 0004 G15, issue #22) — Quản trị theo dõi, không làm thay người hỗ trợ. */
export default function AdminVanHanh() {
  const { data, isLoading, isError, error } = useVanHanh();
  return (
    <>
      <AdminPageHeader title="Vận hành" />
      <Container size="xl" py="lg" px={{ base: 'md', md: 28 }}>
        <Stack gap="md">
          <Text fz="sm" c="dimmed">
            Theo dõi việc của người hỗ trợ giảng viên và người hỗ trợ học viên. Mỗi khối dẫn sang màn xử lý tương ứng.
          </Text>
          {isLoading && <Skeleton height={240} />}
          {isError && <Alert color="red">{thongDiepLoiChung(error)}</Alert>}
          {data && <NoiDung d={data} />}
        </Stack>
      </Container>
    </>
  );
}

function Khoi({ tieuDe, so, mau, children }: { tieuDe: string; so: number; mau: string; children: ReactNode }) {
  return (
    <Paper withBorder radius={12} p="md">
      <Group justify="space-between" mb="xs">
        <Title order={5}>{tieuDe}</Title>
        <Badge color={so > 0 ? mau : 'green'} variant="light" aria-label={`${tieuDe}: ${so}`}>
          {so}
        </Badge>
      </Group>
      {so === 0 ? (
        <Text fz="sm" c="dimmed">
          Không có.
        </Text>
      ) : (
        <Stack gap={8}>{children}</Stack>
      )}
    </Paper>
  );
}

function NoiDung({ d }: { d: VanHanh }) {
  return (
    <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="md">
      <Khoi tieuDe="Đợt trực tiếp có mục quá hạn" so={d.dot_do.length} mau="red">
        {d.dot_do.map((x) => (
          <div key={`${x.lop.id}|${x.giai_doan.id}`}>
            <Anchor component={Link} to={khoaLink(x.lop.khoa.id)} fz="sm" fw={600}>
              {x.lop.khoa.ma_khoa} · {x.lop.ten_lop} · GĐ{x.giai_doan.thu_tu}
            </Anchor>
            <Text fz="xs" c="dimmed">
              Buổi đầu {x.buoi_dau ? dinhDangNgayGio(x.buoi_dau) : '—'} · Nhóm hỗ trợ GV:{' '}
              {x.nhom_ho_tro_gv.join(', ') || 'chưa có'}
            </Text>
            <Text fz="xs" c="red">
              Quá hạn: {x.muc_qua_han.join('; ')}
            </Text>
          </div>
        ))}
      </Khoi>

      <Khoi tieuDe="Đề nghị đổi lớp chờ quá 48 giờ" so={d.de_nghi_cho_lau.length} mau="orange">
        {d.de_nghi_cho_lau.map((x) => (
          <div key={x.id}>
            <Text fz="sm" fw={600}>
              {x.hoc_vien.ho_ten}: {x.tu_lop ?? 'Chưa phân lớp'} → {x.den_lop}
            </Text>
            <Text fz="xs" c="dimmed">
              <Anchor component={Link} to={khoaLink(x.khoa.id)} fz="xs">
                {x.khoa.ma_khoa}
              </Anchor>{' '}
              · gửi {dinhDangNgayGio(x.tao_luc)} bởi {x.nguoi_tao ?? '—'} · {x.ly_do}
            </Text>
          </div>
        ))}
      </Khoi>

      <Khoi tieuDe="Thay đổi lịch 7 ngày qua" so={d.thay_doi_lich.length} mau="blue">
        {d.thay_doi_lich.map((x) => (
          <div key={x.id}>
            <Text fz="sm">
              <b>{x.nguoi ?? '—'}</b>
              {x.vai_tro ? ` (${NHAN_VAI_TRO[x.vai_tro] ?? x.vai_tro})` : ''} · {dinhDangNgayGio(x.thoi_gian)}
              {x.lop && (
                <>
                  {' '}
                  ·{' '}
                  <Anchor component={Link} to={khoaLink(x.lop.khoa.id)} fz="sm">
                    {x.lop.khoa.ma_khoa} {x.lop.ten_lop}
                  </Anchor>
                </>
              )}
            </Text>
            <Text fz="xs">Lý do: {x.ly_do ?? '—'}</Text>
            {Object.keys(x.sau ?? {}).map((t) => (
              <Text key={t} fz="xs" c="dimmed">
                {NHAN_TRUONG[t] ?? t}: {giaTri(t, x.truoc?.[t])} → {giaTri(t, x.sau?.[t])}
              </Text>
            ))}
          </div>
        ))}
      </Khoi>

      <Khoi tieuDe="Khóa chưa có nhóm hỗ trợ giảng viên" so={d.khoa_chua_nhom_gv.length} mau="orange">
        {d.khoa_chua_nhom_gv.map((k) => (
          <Anchor key={k.id} component={Link} to={khoaLink(k.id)} fz="sm">
            {k.ma_khoa} — {k.ten_khoa} (bắt đầu {dinhDangNgay(k.thoi_gian_bat_dau)})
          </Anchor>
        ))}
      </Khoi>

      <Khoi tieuDe="Cụm chưa có người hỗ trợ học viên" so={d.cum_chua_ho_tro.length} mau="orange">
        {d.cum_chua_ho_tro.map((c) => (
          <Text key={c.id} fz="sm">
            {c.ten_cum} · {c.khoa.ma_khoa} · {c.so_hoc_vien} học viên —{' '}
            <Anchor component={Link} to="/admin/nguoi-ho-tro" fz="sm">
              Phân công
            </Anchor>
          </Text>
        ))}
      </Khoi>

      <Khoi
        tieuDe="Danh mục do người hỗ trợ tạo (7 ngày)"
        so={d.danh_muc_moi.diem_hoc.length + d.danh_muc_moi.giang_vien.length}
        mau="blue"
      >
        {d.danh_muc_moi.diem_hoc.map((x) => (
          <Text key={x.id} fz="sm">
            📍{' '}
            <Anchor component={Link} to="/admin/diem-hoc" fz="sm">
              {x.ten}
            </Anchor>{' '}
            ({x.ma_diem_hoc}) — {x.nguoi_tao ?? '—'}, {dinhDangNgay(x.created_at)}
          </Text>
        ))}
        {d.danh_muc_moi.giang_vien.map((x) => (
          <Text key={x.id} fz="sm">
            🧑‍🏫{' '}
            <Anchor component={Link} to="/admin/giang-vien" fz="sm">
              {x.ho_ten}
            </Anchor>{' '}
            ({x.so_dien_thoai}) — {x.nguoi_tao ?? '—'}, {dinhDangNgay(x.created_at)}
          </Text>
        ))}
      </Khoi>
    </SimpleGrid>
  );
}
