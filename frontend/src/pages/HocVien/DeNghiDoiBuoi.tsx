import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Badge,
  Box,
  Button,
  Center,
  Container,
  Group,
  Loader,
  Paper,
  Radio,
  Select,
  Stack,
  Text,
  Textarea,
  Title,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useKhoaHocToi } from '@/api/hocVien';
import {
  useGuiDoiBuoi,
  useHuyDoiBuoi,
  useLuaChonDoiBuoi,
  useSuaDoiBuoi,
  useTongQuanDoiBuoi,
  type BuoiTomTat,
  type DeNghiHocVien,
  type LichTomTat,
  type LuaChonBuoi,
  type TongQuanDoiBuoi,
} from '@/api/doiBuoi';
import { ApiError } from '@/api/client';
import { StatusBanner } from '@/components/StatusBanner';
import { dinhDangGio, dinhDangNgayGio } from '@/lib/ngay';
import { thongDiepLoiXungDot } from '@/lib/loiApi';

const LY_DO_TOI_THIEU = 5;
const LY_DO_TOI_DA = 500;
const KHOA_TAT = 'Khóa học chưa mở đề nghị đổi buổi';

const NHAN_TRANG_THAI: Record<DeNghiHocVien['trang_thai'], string> = {
  cho_duyet: 'Đang chờ duyệt',
  da_duyet: 'Đã duyệt',
  tu_choi: 'Bị từ chối',
  da_huy: 'Đã hủy',
};

function nhanBuoi(l: LichTomTat | BuoiTomTat | null | undefined): string {
  if (!l) return 'Buổi học';
  return `${l.lop.ten_lop} · Buổi ${l.buoi_so} · ${dinhDangNgayGio(l.thoi_gian_bat_dau)}`;
}

/** Trang ẩn /de-nghi-doi-buoi — người hỗ trợ gửi link qua Zalo; không có mục menu. */
export default function DeNghiDoiBuoi() {
  const [params] = useSearchParams();
  const { data: dsKhoa, isLoading, isError, error } = useKhoaHocToi();
  const [khoaChon, setKhoaChon] = useState<string | null>(params.get('khoa'));

  const khoaId = timKhoaId(dsKhoa, khoaChon);

  return (
    <Container size="sm" py="xl">
      <Stack gap="lg">
        <Title order={1} size="h2">
          Đề nghị đổi buổi học
        </Title>

        {isLoading && (
          <Center py="xl">
            <Loader />
          </Center>
        )}
        {isError && <StatusBanner loai="error">{thongDiepLoiXungDot(error)}</StatusBanner>}
        {dsKhoa && dsKhoa.length === 0 && (
          <StatusBanner loai="info">Thầy/Cô chưa được ghi danh vào khóa bồi dưỡng nào.</StatusBanner>
        )}
        {dsKhoa && dsKhoa.length > 1 && (
          <Select
            label="Khóa học"
            allowDeselect={false}
            data={dsKhoa.map((d) => ({
              value: d.khoa_id,
              label: d.khoa.ten_khoa,
            }))}
            value={khoaId ?? null}
            onChange={setKhoaChon}
          />
        )}
        {khoaId && <KhoiDoiBuoi key={khoaId} khoaId={khoaId} lichBanDau={params.get('lich')} />}
      </Stack>
    </Container>
  );
}

/** `?khoa=` hợp lệ > khóa duy nhất > khóa duy nhất đã bật đổi buổi. Nhiều khóa không rõ → phải chọn. */
function timKhoaId(ds: ReturnType<typeof useKhoaHocToi>['data'], chon: string | null): string | undefined {
  if (!ds || ds.length === 0) return undefined;
  if (chon && ds.some((d) => d.khoa_id === chon)) return chon;
  if (ds.length === 1) return ds[0].khoa_id;
  const bat = ds.filter((d) => (d.khoa.so_buoi_doi_toi_da ?? 0) > 0);
  return bat.length === 1 ? bat[0].khoa_id : undefined;
}

function KhoiDoiBuoi({ khoaId, lichBanDau }: { khoaId: string; lichBanDau: string | null }) {
  const { data, isLoading, isError, error } = useTongQuanDoiBuoi(khoaId);

  if (isLoading)
    return (
      <Center py="xl">
        <Loader />
      </Center>
    );
  if (isError) {
    // Khóa tắt (403) không phải sự cố: thông báo nhẹ, không lỗi đỏ.
    if (error instanceof ApiError && error.status === 403) return <StatusBanner loai="info">{KHOA_TAT}</StatusBanner>;
    return <StatusBanner loai="error">{thongDiepLoiXungDot(error)}</StatusBanner>;
  }
  if (!data) return null;
  return <NoiDung tongQuan={data} lichBanDau={lichBanDau} />;
}

function NoiDung({ tongQuan, lichBanDau }: { tongQuan: TongQuanDoiBuoi; lichBanDau: string | null }) {
  const [dangSua, setDangSua] = useState<DeNghiHocVien | null>(null);
  const conLai = Math.max(0, tongQuan.so_buoi_doi_toi_da - tongQuan.so_luot_da_dung);
  const choDuyet = tongQuan.de_nghi.filter((d) => d.trang_thai === 'cho_duyet');
  const daXuLy = tongQuan.de_nghi.filter((d) => d.trang_thai !== 'cho_duyet');

  return (
    <Stack gap="lg">
      <Text size="sm" fw={600}>
        Còn {conLai}/{tongQuan.so_buoi_doi_toi_da} lượt đổi
      </Text>

      {choDuyet.map((d) => (
        <DongDeNghi key={d.id} deNghi={d} onSua={() => setDangSua(d)} />
      ))}

      {dangSua || conLai > 0 ? (
        <FormDoiBuoi
          key={dangSua?.id ?? 'moi'}
          tongQuan={tongQuan}
          dangSua={dangSua}
          lichBanDau={lichBanDau}
          onXong={() => setDangSua(null)}
        />
      ) : (
        <StatusBanner loai="info">Thầy/Cô đã dùng hết lượt đổi buổi của khóa này.</StatusBanner>
      )}

      {daXuLy.length > 0 && (
        <Stack gap="xs">
          <Text fw={700} size="sm">
            Đề nghị đã xử lý
          </Text>
          {daXuLy.map((d) => (
            <Paper key={d.id} withBorder radius="md" p="sm">
              <Group gap="xs">
                <Badge variant="light">{NHAN_TRANG_THAI[d.trang_thai]}</Badge>
                <Text size="sm">
                  {nhanBuoi(d.buoi_nguon)}
                  {d.buoi_chot ? ` → ${nhanBuoi(d.buoi_chot)}` : ''}
                </Text>
              </Group>
              {d.ghi_chu_xu_ly && (
                <Text size="sm" c="dimmed" mt={4}>
                  {d.ghi_chu_xu_ly}
                </Text>
              )}
            </Paper>
          ))}
        </Stack>
      )}
    </Stack>
  );
}

function DongDeNghi({ deNghi, onSua }: { deNghi: DeNghiHocVien; onSua: () => void }) {
  const huy = useHuyDoiBuoi();
  return (
    <Paper withBorder radius="md" p="md" data-testid="de-nghi-cho-duyet">
      <Stack gap="xs">
        <Group gap="xs">
          <Badge variant="light" color="yellow">
            {NHAN_TRANG_THAI[deNghi.trang_thai]}
          </Badge>
          {deNghi.qua_han && (
            <Badge variant="light" color="red">
              Quá hạn
            </Badge>
          )}
        </Group>
        <Text size="sm">Buổi cần đổi: {nhanBuoi(deNghi.buoi_nguon)}</Text>
        <Text size="sm" c="dimmed">
          Lý do: {deNghi.ly_do}
        </Text>
        {deNghi.thu_tu_hang && (
          <Text size="sm" fw={600}>
            Bạn đang xếp thứ {deNghi.thu_tu_hang.k}
          </Text>
        )}
        {huy.isError && <StatusBanner loai="error">{thongDiepLoiXungDot(huy.error)}</StatusBanner>}
        <Group gap="xs">
          {!deNghi.qua_han && (
            <Button size="xs" variant="default" onClick={onSua}>
              Sửa
            </Button>
          )}
          <Button
            size="xs"
            variant="subtle"
            color="red"
            loading={huy.isPending}
            onClick={() =>
              huy.mutate(deNghi.id, {
                onSuccess: () =>
                  notifications.show({
                    color: 'green',
                    message: 'Đã hủy đề nghị',
                  }),
              })
            }
          >
            Hủy đề nghị
          </Button>
        </Group>
      </Stack>
    </Paper>
  );
}

function FormDoiBuoi({
  tongQuan,
  dangSua,
  lichBanDau,
  onXong,
}: {
  tongQuan: TongQuanDoiBuoi;
  dangSua: DeNghiHocVien | null;
  lichBanDau: string | null;
  onXong: () => void;
}) {
  const [nguonId, setNguonId] = useState<string | null>(dangSua?.lich_nguon_id ?? lichBanDau);
  const [dichId, setDichId] = useState<string | null>(dangSua?.lich_de_nghi_id ?? null);
  const [lyDo, setLyDo] = useState(dangSua?.ly_do ?? '');
  const gui = useGuiDoiBuoi();
  const sua = useSuaDoiBuoi();
  const dangGui = gui.isPending || sua.isPending;
  const loi = gui.error ?? sua.error;

  // Buổi đã có đề nghị hoạt động chỉ đổi qua "Sửa"; giữ lại buổi đang sửa.
  const hoatDong = new Set(
    tongQuan.de_nghi
      .filter((d) => d.trang_thai === 'cho_duyet' || d.trang_thai === 'da_duyet')
      .map((d) => d.lich_nguon_id),
  );
  const buoiNguon = tongQuan.buoi_sap_toi.map((b) => b.lich_nguon);
  const nguonHopLe = buoiNguon.some((b) => b.id === nguonId) ? nguonId : null;
  const lyDoCat = lyDo.trim();
  const lyDoHopLe = lyDoCat.length >= LY_DO_TOI_THIEU && lyDoCat.length <= LY_DO_TOI_DA;

  const { data: luaChon, isLoading, isError, error } = useLuaChonDoiBuoi(nguonHopLe ?? undefined);
  const dichHopLe = luaChon?.some((c) => c.lich.id === dichId && !c.da_du);

  function guiDeNghi() {
    if (!nguonHopLe || !dichId) return;
    const body = {
      lich_nguon_id: nguonHopLe,
      lich_de_nghi_id: dichId,
      ly_do: lyDoCat,
    };
    const opts = {
      onSuccess: () => {
        notifications.show({
          color: 'green',
          message: 'Đã gửi đề nghị đổi buổi',
        });
        setDichId(null);
        setLyDo('');
        onXong();
      },
    };
    if (dangSua) sua.mutate({ id: dangSua.id, ...body }, opts);
    else gui.mutate(body, opts);
  }

  return (
    <Paper withBorder radius="md" p="md">
      <Stack gap="md">
        <Text fw={700}>{dangSua ? 'Sửa đề nghị' : 'Gửi đề nghị mới'}</Text>
        {dangSua && <StatusBanner loai="warning">Sửa sẽ đưa bạn về cuối hàng chờ</StatusBanner>}

        <Select
          label="Buổi không tham gia được"
          placeholder="Chọn buổi"
          allowDeselect={false}
          disabled={!!dangSua}
          data={buoiNguon.map((b) => ({
            value: b.id,
            label: nhanBuoi(b),
            disabled: !dangSua && hoatDong.has(b.id),
          }))}
          value={nguonHopLe}
          onChange={(v) => {
            setNguonId(v);
            setDichId(null);
          }}
        />

        {nguonHopLe && isLoading && <Loader size="sm" />}
        {nguonHopLe && isError && <StatusBanner loai="error">{thongDiepLoiXungDot(error)}</StatusBanner>}
        {luaChon && <DanhSachLuaChon luaChon={luaChon} dichId={dichId} onChon={setDichId} />}

        <Textarea
          label="Lý do"
          required
          autosize
          minRows={3}
          maxLength={LY_DO_TOI_DA}
          value={lyDo}
          onChange={(e) => setLyDo(e.currentTarget.value)}
          description={`${lyDo.length}/${LY_DO_TOI_DA} ký tự (tối thiểu ${LY_DO_TOI_THIEU})`}
        />

        {loi && <StatusBanner loai="error">{thongDiepLoiXungDot(loi)}</StatusBanner>}

        <Group gap="xs">
          <Button loading={dangGui} disabled={!nguonHopLe || !dichHopLe || !lyDoHopLe} onClick={guiDeNghi}>
            {dangSua ? 'Lưu đề nghị' : 'Gửi đề nghị'}
          </Button>
          {dangSua && (
            <Button variant="default" onClick={onXong}>
              Bỏ qua
            </Button>
          )}
        </Group>
      </Stack>
    </Paper>
  );
}

function DanhSachLuaChon({
  luaChon,
  dichId,
  onChon,
}: {
  luaChon: LuaChonBuoi[];
  dichId: string | null;
  onChon: (id: string) => void;
}) {
  if (luaChon.length === 0)
    return <StatusBanner loai="info">Hiện chưa có buổi tương đương nào để đổi sang.</StatusBanner>;
  return (
    <Radio.Group label="Buổi muốn đổi sang" value={dichId ?? ''} onChange={onChon}>
      <Stack gap="xs" mt="xs">
        {luaChon.map((c) => (
          <Radio
            key={c.lich.id}
            value={c.lich.id}
            disabled={c.da_du}
            aria-disabled={c.da_du}
            label={<NhanLuaChon c={c} />}
          />
        ))}
      </Stack>
    </Radio.Group>
  );
}

function NhanLuaChon({ c }: { c: LuaChonBuoi }) {
  return (
    <Box>
      <Text size="sm" fw={600}>
        {c.lich.lop.ten_lop} · Buổi {c.lich.buoi_so}
      </Text>
      <Group gap="xs">
        <Text size="sm" c="dimmed">
          {dinhDangNgayGio(c.lich.thoi_gian_bat_dau)}–{dinhDangGio(c.thoi_gian_ket_thuc)}
        </Text>
        <Text size="sm">{c.si_so_toi_da == null ? c.si_so : `${c.si_so}/${c.si_so_toi_da}`}</Text>
        {c.so_cho_duyet > 0 && (
          <Text size="sm" c="dimmed">
            +{c.so_cho_duyet} đang chờ
          </Text>
        )}
        {c.da_du && (
          <Badge size="sm" color="gray">
            Đã đủ
          </Badge>
        )}
      </Group>
      <DiaDiem c={c} />
    </Box>
  );
}

/** Điểm học + phòng (trực tiếp) hoặc link/địa điểm (VLE); zoom không có. */
function DiaDiem({ c }: { c: LuaChonBuoi }) {
  const ds = [
    c.diem_hoc && `${c.diem_hoc.ten} — ${c.diem_hoc.dia_chi}`,
    c.phong && `phòng ${c.phong}`,
    c.dia_diem_hoac_link,
  ].filter(Boolean);
  if (ds.length === 0) return null;
  return (
    <Text size="sm" c="dimmed" style={{ wordBreak: 'break-all' }}>
      {ds.join(' · ')}
    </Text>
  );
}
