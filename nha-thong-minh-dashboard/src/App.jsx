import { useEffect, useRef, useState, useCallback } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import {
  Thermometer, Droplets, Activity, Lightbulb, Power, Wifi, WifiOff, User, Home, Loader2,
  Info, Clock, Zap, ToggleLeft, AlertTriangle, Cpu, LayoutDashboard, ImageOff, GitBranch, Radio,
  Workflow, X, ListChecks, Plus, Bot, Send, CircuitBoard,
} from 'lucide-react';
import esp32Img from './assets/deviceImage/esp32.jpg';
import dht11Img from './assets/deviceImage/camBienDoAm.jpg';
import pirImg from './assets/deviceImage/camBienChuyenDong.jpg';
import ldrImg from './assets/deviceImage/quangTro.jpg';
import relayImg from './assets/deviceImage/reLay.jpg';
import denLedImg from './assets/deviceImage/denLed.jpg';
import coiChuDongImg from './assets/deviceImage/coiChuDong.jpg';
import dienTroImg from './assets/deviceImage/dienTro.jpg';

const API_BASE = 'http://localhost:3000';
const WS_URL = 'ws://localhost:8081';
const RECONNECT_DELAY_MS = 3000;

// Thả thêm file "versionN.jpg" vào src/assets/deviceImage/ là tự hiện trong trang
// Thiết bị sử dụng — không cần sửa code. Ghi chú cho version mới thì thêm vào VERSION_NOTES.
const versionImageModules = import.meta.glob('./assets/deviceImage/version*.jpg', {
  eager: true,
  import: 'default',
});
const VERSION_IMAGES = Object.entries(versionImageModules)
  .map(([path, src]) => {
    const match = path.match(/version(\d+)\.jpg$/i);
    return { number: match ? Number(match[1]) : 0, src };
  })
  .sort((a, b) => a.number - b.number);

const VERSION_NOTES = {
  1: 'Lắp thử nghiệm đầu tiên trên breadboard: ESP32 + DHT11 + PIR (HC-SR501) + quang trở (LDR) + relay 2 kênh — đấu nối để kiểm tra logic đọc cảm biến và điều khiển relay trước khi lắp cố định.',
  2: 'Bổ sung 2 cơ cấu chấp hành mới đấu trực tiếp qua GPIO: đèn LED chỉ báo chuyển động (GPIO25, qua điện trở hạn dòng) và còi chủ động/chuông cửa (GPIO33) — tự động kêu 0.5s rồi tắt mỗi khi PIR phát hiện chuyển động, song song với relay như phiên bản 1. Thêm "Chế độ thủ công" (switch template, optimistic) qua topic MQTT nha/phongkhach/thucong — khi bật sẽ tạm dừng toàn bộ logic tự động theo chuyển động, cho phép điều khiển đèn/còi trực tiếp qua chatbot AI.',
};

const DEVICE_GROUPS = [
  {
    title: 'Bộ não',
    icon: Cpu,
    items: [
      {
        name: 'ESP32',
        image: esp32Img,
        desc: 'Vi điều khiển trung tâm, có sẵn WiFi + Bluetooth, chạy firmware ESPHome. Chân GPIO đọc/điều khiển toàn bộ cảm biến, gửi dữ liệu qua WiFi.',
        sinceVersion: 1,
      },
    ],
  },
  {
    title: 'Cảm biến (đọc dữ liệu vào)',
    icon: Radio,
    items: [
      { name: 'DHT11', image: dht11Img, desc: 'Đo nhiệt độ + độ ẩm.', sinceVersion: 1 },
      { name: 'PIR / HC-SR501', image: pirImg, desc: 'Phát hiện chuyển động bằng hồng ngoại.', sinceVersion: 1 },
      {
        name: 'Quang trở / LDR (HW-072)', image: ldrImg,
        desc: 'Đo độ sáng, báo On/Off theo ngưỡng sáng-tối (chỉnh được bằng chiết áp nhỏ trên module).',
        sinceVersion: 1,
      },
    ],
  },
  {
    title: 'Cơ cấu chấp hành (điều khiển ra)',
    icon: ToggleLeft,
    items: [
      {
        name: 'Module relay 2 kênh (5V)', image: relayImg,
        desc: 'Đóng vai trò công tắc điện tử, cho ESP32 bật/tắt được thiết bị điện thật (đèn, quạt...) dù bản thân ESP32 chỉ chạy điện áp thấp 3.3V.',
        sinceVersion: 1,
      },
      {
        name: 'Đèn LED chỉ báo chuyển động', image: denLedImg,
        desc: 'LED đỏ đấu qua điện trở hạn dòng vào GPIO25. Tự bật khi PIR phát hiện chuyển động (nếu chưa bật Chế độ thủ công), hoặc điều khiển trực tiếp qua chatbot ("bật/tắt đèn").',
        sinceVersion: 2,
      },
      {
        name: 'Còi chủ động / Chuông cửa', image: coiChuDongImg,
        desc: 'Còi chủ động 5V đấu vào GPIO33. Tự kêu 0.5 giây rồi tắt mỗi khi phát hiện chuyển động, hoặc điều khiển thủ công qua chatbot ("bật/tắt còi").',
        sinceVersion: 2,
      },
    ],
  },
  {
    title: 'Linh kiện hỗ trợ',
    icon: CircuitBoard,
    items: [
      {
        name: 'Điện trở 220Ω / 1kΩ', image: dienTroImg,
        desc: 'Điện trở hạn dòng cho LED và các mạch phụ trợ khác trên breadboard, tránh cháy linh kiện khi cấp điện áp từ GPIO.',
        sinceVersion: 2,
      },
    ],
  },
];

const TOPIC_TO_KEY = {
  'nha/phongkhach/nhietdo/state': 'nhietdo',
  'nha/phongkhach/doam/state': 'doam',
  'nha/phongkhach/chuyendong/state': 'chuyendong',
  'nha/phongkhach/anhsang/state': 'anhsang',
  'nha/phongkhach/relay/state': 'relay',
  'nha/phongkhach/thucong/state': 'thucong',
};

const SENSOR_META = {
  nhietdo: { label: 'Nhiệt độ', unit: '°C', icon: Thermometer, soft: 'bg-warning-soft', tint: 'text-warning' },
  doam: { label: 'Độ ẩm', unit: '%', icon: Droplets, soft: 'bg-secondary-soft', tint: 'text-secondary' },
  chuyendong: {
    label: 'Chuyển động', icon: Activity, soft: 'bg-primary-soft', tint: 'text-primary',
    boolLabels: ['Không có', 'Phát hiện'],
  },
  anhsang: {
    label: 'Ánh sáng', icon: Lightbulb, soft: 'bg-aqua-soft', tint: 'text-[#12839c]',
    // Cực tính GPIO34 (binary_sensor "Ánh sáng phòng khách") đang bị đảo trong firmware ESPHome
    // (thiếu `inverted: true`, khác với relay đã có) — nhãn đảo ngược tạm ở đây để khớp thực tế.
    // Sau khi thêm inverted: true vào YAML và nạp lại firmware, đổi lại thành ['Tắt', 'Bật'].
    boolLabels: ['Bật', 'Tắt'],
  },
};

const CHART_RANGE_OPTIONS = [
  { label: '20 điểm', value: 20 },
  { label: '50 điểm', value: 50 },
];

const CAU_HOI_GOI_Y = [
  "What's the temperature and humidity right now?",
  'Any suggestions for me at the moment?',
  'Are there any unusual readings today?',
  "What habits have I recorded so far?",
];

function formatTime(isoString) {
  if (!isoString) return '';
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function mergeChartSeries(prev, key, points) {
  const map = new Map(prev.map((p) => [p.time, p]));
  for (const { time, value } of points) {
    const existing = map.get(time) || { time };
    map.set(time, { ...existing, [key]: Number(value) });
  }
  return Array.from(map.values())
    .sort((a, b) => new Date(a.time) - new Date(b.time))
    .slice(-50);
}

export default function App() {
  const [sensors, setSensors] = useState({
    nhietdo: { value: null, time: null },
    doam: { value: null, time: null },
    chuyendong: { value: null, time: null },
    anhsang: { value: null, time: null },
  });
  const [relay, setRelay] = useState({ value: null, pending: false });
  const [wsStatus, setWsStatus] = useState('connecting');
  const [chartData, setChartData] = useState([]);
  const [chartRange, setChartRange] = useState(20);
  const [page, setPage] = useState('dashboard');
  const [danhSachCanhBao, setDanhSachCanhBao] = useState([]);

  const wsRef = useRef(null);
  const reconnectTimerRef = useRef(null);
  const isUnmountedRef = useRef(false);

  // Bước 1: lấy giá trị gần nhất của cả 5 loại dữ liệu ngay khi tải trang
  useEffect(() => {
    const loaiList = ['nhietdo', 'doam', 'chuyendong', 'anhsang', 'relay'];

    loaiList.forEach(async (loai) => {
      try {
        const res = await fetch(`${API_BASE}/api/lichsu/${loai}`);
        if (!res.ok) return;
        const rows = await res.json();
        if (!rows.length) return;

        if (loai === 'relay') {
          setRelay((prev) => ({ ...prev, value: rows[0].gia_tri }));
          return;
        }

        setSensors((prev) => ({
          ...prev,
          [loai]: { value: rows[0].gia_tri, time: rows[0].thoi_gian },
        }));

        if (loai === 'nhietdo' || loai === 'doam') {
          const chronological = [...rows].reverse().map((r) => ({ time: r.thoi_gian, value: r.gia_tri }));
          setChartData((prev) => mergeChartSeries(prev, loai, chronological));
        }
      } catch (err) {
        console.error(`Lỗi tải dữ liệu ban đầu (${loai}):`, err);
      }
    });
  }, []);

  // WebSocket: nhận dữ liệu real-time, tự kết nối lại nếu bị rớt
  useEffect(() => {
    isUnmountedRef.current = false;

    function connect() {
      if (isUnmountedRef.current) return;
      setWsStatus((prev) => (prev === 'connected' ? prev : 'connecting'));

      const socket = new WebSocket(WS_URL);
      wsRef.current = socket;

      socket.onopen = () => {
        setWsStatus('connected');
      };

      socket.onmessage = (event) => {
        let payload;
        try {
          payload = JSON.parse(event.data);
        } catch {
          return;
        }
        if (payload.type === 'canh_bao') {
          const item = { id: Date.now() + Math.random(), message: payload.message, muc: payload.muc };
          setDanhSachCanhBao((prev) => [item, ...prev].slice(0, 5));
          return;
        }

        const key = TOPIC_TO_KEY[payload.topic];
        if (!key) return;

        if (key === 'relay') {
          setRelay({ value: payload.gia_tri, pending: false });
          return;
        }

        const now = new Date().toISOString();
        setSensors((prev) => ({ ...prev, [key]: { value: payload.gia_tri, time: now } }));

        if (key === 'nhietdo' || key === 'doam') {
          setChartData((prev) => mergeChartSeries(prev, key, [{ time: now, value: payload.gia_tri }]));
        }
      };

      socket.onclose = () => {
        wsRef.current = null;
        if (isUnmountedRef.current) return;
        setWsStatus('disconnected');
        reconnectTimerRef.current = setTimeout(connect, RECONNECT_DELAY_MS);
      };

      socket.onerror = () => {
        socket.close();
      };
    }

    connect();

    return () => {
      isUnmountedRef.current = true;
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
      }
    };
  }, []);

  const handleToggleRelay = useCallback(() => {
    setRelay((prev) => {
      if (prev.pending) return prev;
      const next = prev.value === 'ON' ? 'OFF' : 'ON';
      fetch(`${API_BASE}/api/relay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trang_thai: next }),
      }).catch((err) => {
        console.error('Lỗi gửi lệnh relay:', err);
        setRelay((p) => ({ ...p, pending: false }));
      });
      return { ...prev, pending: true };
    });
  }, []);

  return (
    <div className="min-h-screen pb-10 text-ink">
      {danhSachCanhBao.length > 0 && (
        <div className="space-y-0.5">
          {danhSachCanhBao.map((cb) => (
            <CanhBaoBanner
              key={cb.id}
              message={cb.message}
              muc={cb.muc}
              onClose={() => setDanhSachCanhBao((prev) => prev.filter((item) => item.id !== cb.id))}
            />
          ))}
        </div>
      )}
      <Navbar wsStatus={wsStatus} page={page} onNavigate={setPage} />

      {page === 'devices' ? (
        <main className="mx-auto max-w-6xl px-4 pt-5 md:px-6">
          <DevicesPage />
        </main>
      ) : page === 'thoiquen' ? (
        <main className="mx-auto max-w-6xl px-4 pt-5 md:px-6">
          <ThoiQuenPage />
        </main>
      ) : page === 'chatbot' ? (
        <main className="mx-auto max-w-4xl px-4 pt-5 md:px-6">
          <ChatbotPage />
        </main>
      ) : (
        <main className="mx-auto grid max-w-7xl grid-cols-1 gap-5 px-4 pt-5 md:px-6 lg:grid-cols-[1fr_320px] lg:items-start">
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <SensorCard meta={SENSOR_META.nhietdo} data={sensors.nhietdo} />
              <SensorCard meta={SENSOR_META.doam} data={sensors.doam} />
              <SensorCard meta={SENSOR_META.chuyendong} data={sensors.chuyendong} />
              <SensorCard meta={SENSOR_META.anhsang} data={sensors.anhsang} />
            </div>

            <RelayControl relay={relay} onToggle={handleToggleRelay} />

            <CheDoThuCongBadge trangThai={sensors.thucong?.value} />

            <ChartCard data={chartData} range={chartRange} onRangeChange={setChartRange} />

            <ChatBox />
          </div>

          <NotesPanel />
        </main>
      )}
    </div>
  );
}

function CanhBaoBanner({ message, muc, onClose }) {
  const isCanhBao = muc === 'canh_bao';
  const tone = isCanhBao ? 'bg-danger text-white' : 'bg-warning-soft text-warning';
  const buttonHoverTone = isCanhBao ? 'hover:bg-white/20' : 'hover:bg-warning/20';

  return (
    <div className={`flex items-center justify-between gap-3 px-4 py-3 text-sm font-semibold md:px-6 ${tone}`}>
      <div className="flex items-center gap-2">
        <AlertTriangle size={16} />
        <span>{isCanhBao ? 'CẢNH BÁO: ' : 'GỢI Ý: '}{message}</span>
      </div>
      <button
        onClick={onClose}
        aria-label="Đóng cảnh báo"
        className={`flex h-6 w-6 items-center justify-center rounded-full transition ${buttonHoverTone}`}
      >
        <X size={14} />
      </button>
    </div>
  );
}

function Navbar({ wsStatus, page, onNavigate }) {
  return (
    <header className="sticky top-0 z-10 px-4 pt-4 md:px-6">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 rounded-3xl border border-white/70 bg-white/60 px-5 py-3 shadow-[0_8px_30px_rgba(13,71,161,0.08)] backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary text-white shadow-sm">
            <Home size={19} strokeWidth={2} />
          </div>
          <div>
            <div className="text-sm font-bold leading-tight text-ink">Nhà Thông Minh</div>
            <div className="text-xs leading-tight text-muted">Bảng điều khiển vận hành</div>
          </div>
        </div>

        <nav className="inline-flex items-center gap-0.5 rounded-xl border border-white/70 bg-white/70 p-1 text-xs font-semibold">
          <button
            onClick={() => onNavigate('dashboard')}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition ${
              page === 'dashboard' ? 'bg-primary text-white shadow-sm' : 'text-muted hover:text-ink'
            }`}
          >
            <LayoutDashboard size={13} /> Bảng điều khiển
          </button>
          <button
            onClick={() => onNavigate('devices')}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition ${
              page === 'devices' ? 'bg-primary text-white shadow-sm' : 'text-muted hover:text-ink'
            }`}
          >
            <Cpu size={13} /> Thiết bị sử dụng
          </button>
          <button
            onClick={() => onNavigate('thoiquen')}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition ${
              page === 'thoiquen' ? 'bg-primary text-white shadow-sm' : 'text-muted hover:text-ink'
            }`}
          >
            <ListChecks size={13} /> Thói quen
          </button>
          <button
            onClick={() => onNavigate('chatbot')}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition ${
              page === 'chatbot' ? 'bg-primary text-white shadow-sm' : 'text-muted hover:text-ink'
            }`}
          >
            <Bot size={13} /> Trợ lý AI
          </button>
        </nav>

        <div className="flex items-center gap-3">
          <ConnectionBadge status={wsStatus} />
          <div className="hidden items-center gap-2 rounded-full border border-white/70 bg-white/70 py-1 pl-1 pr-3 sm:flex">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary-soft text-primary">
              <User size={14} />
            </div>
            <span className="text-xs font-semibold text-ink">Quản trị viên</span>
          </div>
        </div>
      </div>
    </header>
  );
}

function DevicesPage() {
  const versionOptions = [
    { label: 'Tất cả phiên bản', value: 'all' },
    ...VERSION_IMAGES.map((v) => ({ label: `Phiên bản ${v.number}`, value: v.number })),
  ];
  const [versionFilter, setVersionFilter] = useState('all');

  return (
    <div className="space-y-6 pb-4">
      <div className="rounded-3xl border border-white/70 bg-white/60 p-5 shadow-[0_8px_30px_rgba(13,71,161,0.06)] backdrop-blur-xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-lg font-bold text-ink">Thiết bị sử dụng</div>
            <div className="mt-1 text-sm text-muted">
              Danh mục phần cứng và ảnh lắp đặt thực tế của hệ thống Nhà thông minh, theo từng phiên bản.
            </div>
          </div>
          {VERSION_IMAGES.length > 0 && (
            <SegmentedControl value={versionFilter} onChange={setVersionFilter} options={versionOptions} />
          )}
        </div>
      </div>

      {DEVICE_GROUPS.map((group) => {
        const items = versionFilter === 'all'
          ? group.items
          : group.items.filter((item) => item.sinceVersion <= versionFilter);
        if (items.length === 0) return null;

        return (
          <div key={group.title}>
            <div className="mb-3 flex items-center gap-2 px-1">
              <group.icon size={16} className="text-primary" />
              <span className="text-sm font-bold text-ink">{group.title}</span>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((item) => (
                <DeviceCard key={item.name} item={item} />
              ))}
            </div>
          </div>
        );
      })}

      <VersionHistory filter={versionFilter} />

      <ProjectOverview />
    </div>
  );
}

function DeviceCard({ item }) {
  return (
    <div className="overflow-hidden rounded-3xl border border-white/70 bg-white/60 shadow-[0_8px_30px_rgba(13,71,161,0.06)] backdrop-blur-xl">
      {item.image ? (
        <div className="flex h-56 items-center justify-center bg-slate-100/80 p-3">
          <img src={item.image} alt={item.name} className="h-full w-full object-contain" />
        </div>
      ) : (
        <div className="flex h-56 w-full flex-col items-center justify-center gap-2 bg-primary-soft/60 text-primary">
          <ImageOff size={22} />
          <span className="px-4 text-center text-[11px] font-medium">
            Chưa có ảnh riêng — xem trong ảnh lắp đặt ở mục "Lịch sử phiên bản" bên dưới
          </span>
        </div>
      )}
      <div className="p-4">
        <div className="text-sm font-bold text-ink">{item.name}</div>
        <div className="mt-1 text-xs leading-relaxed text-muted">{item.desc}</div>
      </div>
    </div>
  );
}

function VersionHistory({ filter }) {
  if (VERSION_IMAGES.length === 0) return null;
  const shown = filter === 'all' ? VERSION_IMAGES : VERSION_IMAGES.filter((v) => v.number === filter);

  return (
    <div>
      <div className="mb-3 flex items-center gap-2 px-1">
        <GitBranch size={16} className="text-primary" />
        <span className="text-sm font-bold text-ink">Lịch sử phiên bản lắp đặt</span>
      </div>
      <div className="space-y-5">
        {shown.map(({ number, src }) => (
          <div
            key={number}
            className="overflow-hidden rounded-3xl border border-white/70 bg-white/60 shadow-[0_8px_30px_rgba(13,71,161,0.06)] backdrop-blur-xl"
          >
            <div className="flex items-center justify-center bg-slate-100/80 p-4">
              <img
                src={src}
                alt={`Phiên bản ${number}`}
                className="max-h-130 w-auto max-w-full rounded-xl object-contain"
              />
            </div>
            <div className="p-5">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-soft px-3 py-1 text-xs font-bold text-primary">
                Phiên bản {number}
              </span>
              <p className="mt-3 text-sm leading-relaxed text-muted">
                {VERSION_NOTES[number] || 'Chưa có ghi chú cho phiên bản này.'}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProjectOverview() {
  const steps = [
    'Cảm biến đọc dữ liệu: DHT11 đọc mỗi ~60 giây; PIR (chuyển động) và LDR (ánh sáng) báo ngay khi đổi trạng thái. ESP32 đọc tất cả qua chân GPIO.',
    'ESP32 (firmware ESPHome) publish dữ liệu lên MQTT broker Mosquitto (chạy trong Docker, cổng 1883) theo các topic nha/phongkhach/{nhietdo,doam,chuyendong,anhsang,relay,den,coi,thucong}/state.',
    'ESP32 tự điều khiển relay, đèn LED và còi ngay tại chỗ khi có chuyển động (không cần chờ server): BẬT relay + đèn khi vừa có chuyển động vừa đang "sáng", còi kêu 0.5 giây rồi tự tắt; TẮT relay + đèn ngay khi hết chuyển động — trừ khi "Chế độ thủ công" đang bật, lúc đó toàn bộ logic tự động này tạm dừng để nhường quyền điều khiển thủ công.',
    'Backend Node.js subscribe MQTT: mỗi dữ liệu mới được lưu vào MySQL và broadcast realtime qua WebSocket (cổng 8081) cho dashboard, kèm cơ chế gợi ý/cảnh báo theo ngưỡng — chỉ gửi khi nội dung thay đổi so với lần trước để tránh lặp.',
    'Backend mở REST API (cổng 3000): GET /api/lichsu/:loai (lịch sử), GET /api/bat-thuong (phát hiện bất thường so với 7 ngày qua), GET/POST/DELETE /api/thoi-quen (thói quen người dùng), POST /api/relay và POST /api/che-do-thu-cong (bật/tắt thủ công qua MQTT command topic).',
    'Chatbot AI (POST /api/chatbot): trước tiên thử nhận diện lệnh điều khiển đèn/còi trực tiếp bằng regex (tiếng Việt lẫn tiếng Anh) — nếu khớp thì publish MQTT và trả lời gần như tức thì, không cần chờ AI. Nếu không phải lệnh điều khiển, chuyển sang Ollama (llama3.1, chạy cục bộ) kèm ngữ cảnh cảm biến/bất thường/gợi ý/thói quen thực tế để trả lời câu hỏi tự do bằng tiếng Anh.',
    'Dashboard React: tải giá trị gần nhất qua REST ngay khi mở trang, sau đó cập nhật realtime qua WebSocket. Nút Bật/Tắt chỉ đổi trạng thái khi có xác nhận qua WebSocket, không giả định thành công ngay khi bấm.',
  ];

  return (
    <div className="rounded-3xl border border-white/70 bg-white/60 p-5 shadow-[0_8px_30px_rgba(13,71,161,0.06)] backdrop-blur-xl">
      <div className="mb-4 flex items-center gap-2">
        <Workflow size={16} className="text-primary" />
        <span className="text-sm font-bold text-ink">Tổng quan dự án &amp; luồng hoạt động</span>
      </div>

      <div className="mb-4">
        <div className="text-xs font-bold text-ink">Phiên bản 2 (hiện tại)</div>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          Bổ sung đèn LED chỉ báo chuyển động (GPIO25) và còi chủ động/chuông cửa (GPIO33), tự động hoạt động song
          song với relay mỗi khi PIR phát hiện chuyển động. Thêm "Chế độ thủ công" (switch template optimistic) —
          khi bật sẽ tạm dừng toàn bộ tự động hoá theo cảm biến, cho phép điều khiển đèn/còi trực tiếp qua chatbot
          AI (nhận diện lệnh tức thì bằng regex, hoặc hỏi đáp tự do qua Ollama chạy cục bộ khi không phải là lệnh).
        </p>
      </div>

      <div className="mb-5">
        <div className="text-xs font-bold text-ink">Phiên bản 1</div>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          Lắp thử nghiệm trên breadboard để kiểm tra logic đọc cảm biến và điều khiển relay trước khi lắp cố định:
          ESP32 làm bộ não trung tâm, DHT11 đo nhiệt độ/độ ẩm, PIR HC-SR501 phát hiện chuyển động, quang trở LDR
          đo ánh sáng, và module relay 2 kênh đóng vai trò công tắc điện tử để bật/tắt thiết bị điện thật.
        </p>
      </div>

      <div>
        <div className="mb-3 text-xs font-bold text-ink">Luồng hoạt động từ cảm biến đến dashboard</div>
        <ol className="space-y-3">
          {steps.map((step, i) => (
            <li key={i} className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-bold text-primary">
                {i + 1}
              </span>
              <span className="text-sm leading-relaxed text-muted">{step}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

function ThoiQuenPage() {
  const [gomNhom, setGomNhom] = useState({});
  const [loading, setLoading] = useState(true);
  const [formDanhMuc, setFormDanhMuc] = useState('');
  const [formNoiDung, setFormNoiDung] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/thoi-quen`);
        if (!res.ok) return;
        const data = await res.json();
        setGomNhom(data);
      } catch (err) {
        console.error('Lỗi tải danh sách thói quen:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const danhMucList = Object.keys(gomNhom);

  const handleXoa = async (danhMuc, id) => {
    try {
      const res = await fetch(`${API_BASE}/api/thoi-quen/${id}`, { method: 'DELETE' });
      if (!res.ok) return;
      setGomNhom((prev) => {
        const next = { ...prev };
        const conLai = (next[danhMuc] || []).filter((item) => item.id !== id);
        if (conLai.length === 0) {
          delete next[danhMuc];
        } else {
          next[danhMuc] = conLai;
        }
        return next;
      });
    } catch (err) {
      console.error('Lỗi xóa thói quen:', err);
    }
  };

  const handleThem = async (e) => {
    e.preventDefault();
    const danhMuc = formDanhMuc.trim();
    const noiDung = formNoiDung.trim();
    if (!danhMuc || !noiDung || submitting) return;

    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/api/thoi-quen`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ danh_muc: danhMuc, noi_dung: noiDung }),
      });
      const data = await res.json();
      if (!res.ok) {
        console.error('Lỗi thêm thói quen:', data.error);
        return;
      }
      setGomNhom((prev) => {
        const next = { ...prev };
        const ds = next[data.danh_muc] || [];
        next[data.danh_muc] = [...ds, { id: data.id, noi_dung: data.noi_dung }];
        return next;
      });
      setFormDanhMuc('');
      setFormNoiDung('');
    } catch (err) {
      console.error('Lỗi thêm thói quen:', err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 pb-4">
      <div className="rounded-3xl border border-white/70 bg-white/60 p-5 shadow-[0_8px_30px_rgba(13,71,161,0.06)] backdrop-blur-xl">
        <div className="text-lg font-bold text-ink">Thói quen</div>
        <div className="mt-1 text-sm text-muted">
          Ghi lại thói quen sinh hoạt theo từng danh mục, dùng làm tham chiếu cho việc tự động hoá sau này.
        </div>
      </div>

      {loading ? (
        <div className="rounded-3xl border border-white/70 bg-white/60 p-8 text-center text-sm text-muted shadow-[0_8px_30px_rgba(13,71,161,0.06)] backdrop-blur-xl">
          Đang tải...
        </div>
      ) : danhMucList.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-primary/30 bg-primary-soft/40 p-8 text-center text-sm text-muted">
          Chưa có thói quen nào, thêm mục đầu tiên bên dưới
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {danhMucList.map((danhMuc) => (
            <DanhMucCard
              key={danhMuc}
              danhMuc={danhMuc}
              items={gomNhom[danhMuc]}
              onXoa={(id) => handleXoa(danhMuc, id)}
            />
          ))}
        </div>
      )}

      <form
        onSubmit={handleThem}
        className="flex flex-wrap items-end gap-3 rounded-3xl border border-white/70 bg-white/60 p-5 shadow-[0_8px_30px_rgba(13,71,161,0.06)] backdrop-blur-xl"
      >
        <div className="min-w-40 flex-1">
          <label className="mb-1 block text-xs font-semibold text-muted">Danh mục</label>
          <input
            list="danh-muc-goi-y"
            value={formDanhMuc}
            onChange={(e) => setFormDanhMuc(e.target.value)}
            placeholder="VD: buổi sáng, thư giãn..."
            className="w-full rounded-xl border border-white/70 bg-white/80 px-3 py-2 text-sm text-ink outline-none focus:border-primary"
          />
          <datalist id="danh-muc-goi-y">
            {danhMucList.map((dm) => (
              <option key={dm} value={dm} />
            ))}
          </datalist>
        </div>
        <div className="min-w-55 flex-2">
          <label className="mb-1 block text-xs font-semibold text-muted">Nội dung thói quen</label>
          <input
            value={formNoiDung}
            onChange={(e) => setFormNoiDung(e.target.value)}
            placeholder="VD: Bật đèn phòng khách lúc 18h"
            className="w-full rounded-xl border border-white/70 bg-white/80 px-3 py-2 text-sm text-ink outline-none focus:border-primary"
          />
        </div>
        <button
          type="submit"
          disabled={submitting || !formDanhMuc.trim() || !formNoiDung.trim()}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-white shadow-sm transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="Thêm thói quen"
        >
          <Plus size={18} />
        </button>
      </form>
    </div>
  );
}

function DanhMucCard({ danhMuc, items, onXoa }) {
  return (
    <div className="rounded-3xl border border-white/70 bg-white/60 p-5 shadow-[0_8px_30px_rgba(13,71,161,0.06)] backdrop-blur-xl">
      <div className="mb-3 flex items-center gap-2">
        <ListChecks size={16} className="text-primary" />
        <span className="text-sm font-bold text-ink">{danhMuc}</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {items.map((item) => (
          <span
            key={item.id}
            className="inline-flex items-center gap-1.5 rounded-full bg-primary-soft px-3 py-1.5 text-xs font-semibold text-primary"
          >
            {item.noi_dung}
            <button
              onClick={() => onXoa(item.id)}
              aria-label="Xóa thói quen"
              className="flex h-4 w-4 items-center justify-center rounded-full transition hover:bg-primary/20"
            >
              <X size={11} />
            </button>
          </span>
        ))}
      </div>
    </div>
  );
}

function NotesPanel() {
  const items = [
    {
      icon: Clock,
      tone: 'bg-primary-soft text-primary',
      title: 'Nhiệt độ & Độ ẩm (DHT11)',
      body: 'Đọc mỗi ~60 giây — đây là chu kỳ mặc định của ESPHome cho cảm biến DHT khi YAML không khai báo update_interval riêng.',
    },
    {
      icon: Zap,
      tone: 'bg-secondary-soft text-secondary',
      title: 'Chuyển động & Ánh sáng',
      body: 'Là binary_sensor GPIO, báo ngay khi chân tín hiệu đổi trạng thái (event-driven) — không đọc theo chu kỳ cố định như DHT.',
    },
    {
      icon: ToggleLeft,
      tone: 'bg-aqua-soft text-[#12839c]',
      title: 'Cơ chế Relay',
      body: 'Tự BẬT khi vừa có chuyển động vừa đang "sáng". Tự TẮT ngay khi hết chuyển động, bất kể ánh sáng đang thế nào.',
    },
    {
      icon: AlertTriangle,
      tone: 'bg-warning-soft text-warning',
      title: 'Ánh sáng đang bị đảo cực (tạm vá ở FE)',
      body: 'binary_sensor GPIO34 thiếu inverted: true trong YAML nên tín hiệu ngược thực tế — dashboard này đang tạm đảo nhãn hiển thị để khớp. Sửa triệt để: thêm inverted: true vào "Ánh sáng phòng khách", nạp lại firmware qua ESPHome (đã có OTA, không cần cắm USB), rồi báo để gỡ phần vá tạm này.',
    },
  ];

  return (
    <aside className="space-y-3 rounded-3xl border border-white/70 bg-white/60 p-5 shadow-[0_8px_30px_rgba(13,71,161,0.06)] backdrop-blur-xl lg:sticky lg:top-24">
      <div className="flex items-center gap-2">
        <Info size={16} className="text-primary" />
        <div className="text-sm font-bold text-ink">Ghi chú kỹ thuật</div>
      </div>
      <div className="space-y-4">
        {items.map(({ icon: Icon, tone, title, body }) => (
          <div key={title} className="flex gap-3">
            <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${tone}`}>
              <Icon size={15} />
            </div>
            <div>
              <div className="text-xs font-bold text-ink">{title}</div>
              <div className="mt-0.5 text-xs leading-relaxed text-muted">{body}</div>
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
}

function ConnectionBadge({ status }) {
  const config = {
    connecting: {
      Icon: Loader2, spin: true, dot: 'bg-warning',
      text: 'Đang kết nối...', tone: 'border-warning/30 bg-warning-soft text-warning',
    },
    connected: {
      Icon: Wifi, spin: false, dot: 'bg-secondary',
      text: 'Đã kết nối', tone: 'border-secondary/30 bg-secondary-soft text-secondary',
    },
    disconnected: {
      Icon: WifiOff, spin: false, dot: 'bg-danger',
      text: 'Mất kết nối', tone: 'border-danger/30 bg-danger-soft text-danger',
    },
  }[status];
  const { Icon } = config;

  return (
    <div className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${config.tone}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${config.dot} ${status !== 'connected' ? 'animate-pulse' : ''}`} />
      <Icon size={13} className={config.spin ? 'animate-spin' : ''} />
      {config.text}
    </div>
  );
}

function SensorCard({ meta, data }) {
  const Icon = meta.icon;
  const displayValue = () => {
    if (data.value === null || data.value === undefined) return '--';
    if (meta.boolLabels) return meta.boolLabels[data.value === 'ON' ? 1 : 0];
    return `${data.value}${meta.unit}`;
  };

  return (
    <div className="rounded-3xl border border-white/70 bg-white/60 p-5 shadow-[0_8px_30px_rgba(13,71,161,0.06)] backdrop-blur-xl transition hover:shadow-[0_12px_36px_rgba(13,71,161,0.10)]">
      <div className="flex items-center justify-between">
        <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${meta.soft} ${meta.tint}`}>
          <Icon size={20} strokeWidth={2} />
        </div>
        <span className="text-[11px] font-medium text-muted">
          {data.time ? formatTime(data.time) : '--:--:--'}
        </span>
      </div>
      <div className="mt-4 text-xs font-semibold text-muted">{meta.label}</div>
      <div className="mt-1 text-2xl font-bold text-ink">{displayValue()}</div>
    </div>
  );
}

function RelayControl({ relay, onToggle }) {
  const isOn = relay.value === 'ON';
  const label = relay.pending
    ? 'Đang gửi lệnh...'
    : relay.value === null
      ? 'Chưa rõ trạng thái'
      : isOn ? 'Đang bật' : 'Đang tắt';

  const iconTone = relay.pending
    ? 'bg-warning-soft text-warning'
    : isOn
      ? 'bg-secondary-soft text-secondary'
      : 'bg-primary-soft text-primary';

  const labelTone = relay.pending ? 'text-warning' : isOn ? 'text-secondary' : 'text-ink';

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-white/70 bg-white/60 p-5 shadow-[0_8px_30px_rgba(13,71,161,0.06)] backdrop-blur-xl">
      <div className="flex items-center gap-4">
        <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${iconTone}`}>
          <Power size={22} strokeWidth={2} />
        </div>
        <div>
          <div className="text-xs font-semibold text-muted">Relay phòng khách</div>
          <div className={`mt-0.5 text-lg font-bold ${labelTone}`}>{label}</div>
        </div>
      </div>
      <button
        onClick={onToggle}
        disabled={relay.pending}
        className={`rounded-xl px-6 py-3 text-sm font-bold transition
          ${relay.pending
            ? 'cursor-wait bg-white/70 text-muted'
            : isOn
              ? 'bg-danger text-white shadow-[0_6px_18px_rgba(229,72,77,0.30)] hover:brightness-105'
              : 'bg-secondary text-white shadow-[0_6px_18px_rgba(0,150,136,0.30)] hover:brightness-105'}`}
      >
        {relay.pending ? 'Đang gửi...' : isOn ? 'Tắt' : 'Bật'}
      </button>
    </div>
  );
}

function CheDoThuCongBadge({ trangThai }) {
  const [dangGui, setDangGui] = useState(false);
  const isOn = trangThai === 'ON';

  const handleQuayLai = async () => {
    if (dangGui) return;
    setDangGui(true);
    try {
      await fetch(`${API_BASE}/api/che-do-thu-cong`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trang_thai: 'OFF' }),
      });
    } catch (err) {
      console.error('Lỗi đặt lại chế độ tự động:', err);
    } finally {
      setDangGui(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/70 bg-white/60 px-4 py-3 text-xs shadow-[0_8px_30px_rgba(13,71,161,0.06)] backdrop-blur-xl">
      <div className="flex items-center gap-2">
        <span className={`h-2 w-2 rounded-full ${isOn ? 'bg-warning' : 'bg-secondary'}`} />
        <span className="font-semibold text-muted">
          Chế độ thủ công: <span className={isOn ? 'text-warning' : 'text-ink'}>{isOn ? 'Bật' : 'Tắt'}</span>
        </span>
      </div>
      <button
        onClick={handleQuayLai}
        disabled={dangGui}
        className="rounded-lg border border-white/70 bg-white/80 px-3 py-1.5 font-semibold text-primary transition hover:bg-primary-soft disabled:cursor-not-allowed disabled:opacity-50"
      >
        {dangGui ? 'Đang gửi...' : 'Quay lại tự động'}
      </button>
    </div>
  );
}

function SegmentedControl({ value, onChange, options }) {
  return (
    <div className="inline-flex items-center gap-0.5 rounded-xl border border-white/70 bg-white/70 p-1 text-xs font-semibold">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`rounded-lg px-3 py-1.5 transition ${
            value === opt.value ? 'bg-primary text-white shadow-sm' : 'text-muted hover:text-ink'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function ChartCard({ data, range, onRangeChange }) {
  const sliced = data.slice(-range);

  return (
    <div className="rounded-3xl border border-white/70 bg-white/60 p-5 shadow-[0_8px_30px_rgba(13,71,161,0.06)] backdrop-blur-xl">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm font-bold text-ink">Nhiệt độ &amp; Độ ẩm theo thời gian</div>
          <div className="text-xs text-muted">Dữ liệu realtime từ cảm biến phòng khách</div>
        </div>
        <SegmentedControl value={range} onChange={onRangeChange} options={CHART_RANGE_OPTIONS} />
      </div>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={sliced}>
            <CartesianGrid strokeDasharray="3 3" stroke="#dbe4ee" />
            <XAxis dataKey="time" tickFormatter={formatTime} stroke="#5c6b7a" fontSize={11} />
            <YAxis stroke="#5c6b7a" fontSize={11} />
            <Tooltip
              labelFormatter={formatTime}
              contentStyle={{
                background: 'rgba(255,255,255,0.95)', border: '1px solid #e3edfa',
                borderRadius: 12, color: '#101828',
              }}
            />
            <Legend />
            <Line type="monotone" dataKey="nhietdo" name="Nhiệt độ (°C)" stroke="#f5b300" strokeWidth={2.5} dot={false} connectNulls />
            <Line type="monotone" dataKey="doam" name="Độ ẩm (%)" stroke="#009688" strokeWidth={2.5} dot={false} connectNulls />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function ChatBox() {
  const [cauHoi, setCauHoi] = useState('');
  const [traLoi, setTraLoi] = useState(null);
  const [dangGui, setDangGui] = useState(false);
  const [loi, setLoi] = useState(null);

  const handleGui = async (e) => {
    e.preventDefault();
    const noiDung = cauHoi.trim();
    if (!noiDung || dangGui) return;

    setDangGui(true);
    setLoi(null);
    try {
      const res = await fetch(`${API_BASE}/api/chatbot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cau_hoi: noiDung }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Chatbot phản hồi lỗi');
      setTraLoi(data.tra_loi);
    } catch (err) {
      console.error('Lỗi gọi chatbot:', err);
      setLoi('Không nhận được phản hồi - kiểm tra backend/Ollama có đang chạy không');
    } finally {
      setDangGui(false);
    }
  };

  return (
    <div className="rounded-3xl border border-white/70 bg-white/60 p-5 shadow-[0_8px_30px_rgba(13,71,161,0.06)] backdrop-blur-xl">
      <div className="mb-4 flex items-center gap-2">
        <Bot size={16} className="text-primary" />
        <span className="text-sm font-bold text-ink">Hỏi trợ lý nhà thông minh</span>
      </div>

      <form onSubmit={handleGui} className="flex items-center gap-2">
        <input
          value={cauHoi}
          onChange={(e) => setCauHoi(e.target.value)}
          disabled={dangGui}
          placeholder="Hỏi gì đó về nhà bạn..."
          className="flex-1 rounded-xl border border-white/70 bg-white/80 px-3 py-2 text-sm text-ink outline-none focus:border-primary disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={dangGui || !cauHoi.trim()}
          className="flex shrink-0 items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {dangGui ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
          Gửi
        </button>
      </form>

      <div className="mt-4 min-h-12 rounded-xl bg-primary-soft/40 p-3 text-sm leading-relaxed">
        {dangGui ? (
          <span className="flex items-center gap-2 text-muted">
            <Loader2 size={14} className="animate-spin" /> Đang suy nghĩ...
          </span>
        ) : loi ? (
          <span className="text-danger">{loi}</span>
        ) : traLoi ? (
          <span className="text-ink">{traLoi}</span>
        ) : (
          <span className="text-muted">Câu trả lời sẽ hiện ở đây.</span>
        )}
      </div>
    </div>
  );
}

function ChatbotPage() {
  const [tinNhan, setTinNhan] = useState([]);
  const [cauHoi, setCauHoi] = useState('');
  const [dangGui, setDangGui] = useState(false);
  const cuoiDanhSachRef = useRef(null);

  useEffect(() => {
    cuoiDanhSachRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [tinNhan, dangGui]);

  const guiCauHoi = async (noiDung) => {
    if (!noiDung || dangGui) return;

    setTinNhan((prev) => [...prev, { id: Date.now() + Math.random(), vaiTro: 'user', noiDung }]);
    setCauHoi('');
    setDangGui(true);

    try {
      const res = await fetch(`${API_BASE}/api/chatbot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cau_hoi: noiDung }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Chatbot phản hồi lỗi');
      setTinNhan((prev) => [...prev, { id: Date.now() + Math.random(), vaiTro: 'assistant', noiDung: data.tra_loi }]);
    } catch (err) {
      console.error('Lỗi gọi chatbot:', err);
      setTinNhan((prev) => [
        ...prev,
        {
          id: Date.now() + Math.random(),
          vaiTro: 'assistant',
          loi: true,
          noiDung: 'Không nhận được phản hồi - kiểm tra backend/Ollama có đang chạy không',
        },
      ]);
    } finally {
      setDangGui(false);
    }
  };

  const handleGui = (e) => {
    e.preventDefault();
    guiCauHoi(cauHoi.trim());
  };

  return (
    <div className="flex h-[calc(100vh-140px)] flex-col rounded-3xl border border-white/70 bg-white/60 shadow-[0_8px_30px_rgba(13,71,161,0.06)] backdrop-blur-xl">
      <div className="flex items-center gap-2 border-b border-white/70 px-5 py-4">
        <Bot size={18} className="text-primary" />
        <div>
          <div className="text-sm font-bold text-ink">Trợ lý nhà thông minh</div>
          <div className="text-xs text-muted">Hỏi về nhiệt độ, độ ẩm, cảnh báo, gợi ý và thói quen trong nhà</div>
        </div>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
        {tinNhan.length === 0 && !dangGui ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
            <span className="text-sm text-muted">Hỏi gì đó về ngôi nhà của bạn để bắt đầu trò chuyện</span>
            <div className="flex max-w-lg flex-wrap items-center justify-center gap-2">
              {CAU_HOI_GOI_Y.map((cauHoiGoiY) => (
                <button
                  key={cauHoiGoiY}
                  type="button"
                  onClick={() => guiCauHoi(cauHoiGoiY)}
                  className="rounded-full border border-white/70 bg-white/80 px-3 py-1.5 text-xs font-semibold text-primary transition hover:bg-primary-soft"
                >
                  {cauHoiGoiY}
                </button>
              ))}
            </div>
          </div>
        ) : (
          tinNhan.map((tn) => <TinNhanBubble key={tn.id} tinNhan={tn} />)
        )}

        {dangGui && (
          <div className="flex justify-start">
            <div className="flex items-center gap-2 rounded-2xl rounded-bl-sm border border-white/70 bg-white/80 px-4 py-2.5 text-sm text-muted">
              <Loader2 size={14} className="animate-spin" /> Đang suy nghĩ...
            </div>
          </div>
        )}

        <div ref={cuoiDanhSachRef} />
      </div>

      <form onSubmit={handleGui} className="flex items-center gap-2 border-t border-white/70 p-4">
        <input
          value={cauHoi}
          onChange={(e) => setCauHoi(e.target.value)}
          disabled={dangGui}
          placeholder="Nhắn gì đó..."
          className="flex-1 rounded-xl border border-white/70 bg-white/80 px-4 py-2.5 text-sm text-ink outline-none focus:border-primary disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={dangGui || !cauHoi.trim()}
          className="flex shrink-0 items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {dangGui ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
          Gửi
        </button>
      </form>
    </div>
  );
}

function TinNhanBubble({ tinNhan }) {
  const laNguoiDung = tinNhan.vaiTro === 'user';
  const boi = tinNhan.loi
    ? 'border border-danger/30 bg-danger-soft text-danger'
    : laNguoiDung
      ? 'bg-primary text-white'
      : 'border border-white/70 bg-white/80 text-ink';

  return (
    <div className={`flex ${laNguoiDung ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[75%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${boi} ${
          laNguoiDung ? 'rounded-br-sm' : 'rounded-bl-sm'
        }`}
      >
        {tinNhan.loi && (
          <span className="mb-1 flex items-center gap-1.5 text-xs font-semibold">
            <AlertTriangle size={12} /> Lỗi
          </span>
        )}
        {tinNhan.noiDung}
      </div>
    </div>
  );
}
