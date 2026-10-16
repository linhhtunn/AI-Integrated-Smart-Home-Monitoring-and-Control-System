require('dotenv').config();
const mqtt = require('mqtt');
const mysql = require('mysql2/promise');
const WebSocket = require('ws');
const wss = new WebSocket.Server({ port: 8081 });

wss.on('connection', () => {
  console.log('Dashboard mới kết nối qua WebSocket');
});

function broadcast(data) {
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(data));
    }
  });
}

function kiemTraGoiY(topic, giaTri) {
  const goiYs = [];
  const gt = parseFloat(giaTri);

  if (topic === 'nha/phongkhach/nhietdo/state') {
    if (gt > 33) goiYs.push({ muc: 'canh_bao', noi_dung: `Nhiệt độ ${gt}°C khá cao - nên bật quạt hoặc điều hòa` });
    else if (gt > 30) goiYs.push({ muc: 'goi_y', noi_dung: `Nhiệt độ ${gt}°C hơi nóng - cân nhắc bật quạt` });
  }

  if (topic === 'nha/phongkhach/doam/state') {
    if (gt < 40) goiYs.push({ muc: 'goi_y', noi_dung: `Độ ẩm ${gt}% khá thấp - có thể cân nhắc bật phun sương hoặc máy tạo ẩm` });
    else if (gt > 80) goiYs.push({ muc: 'goi_y', noi_dung: `Độ ẩm ${gt}% khá cao - nên mở cửa sổ thông gió nếu thời tiết cho phép` });
  }

  return goiYs;
}

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

const goiYTruocDo = {};

const client = mqtt.connect('mqtt://localhost:1883');

client.on('connect', () => {
  console.log('Connected to MQTT broker');
  client.subscribe('nha/phongkhach/#');
});

client.on('message', async (topic, message) => {
  const giaTri = message.toString();
  console.log(`${topic}: ${giaTri}`);
  await pool.query(
    'INSERT INTO cam_bien_data (topic, gia_tri) VALUES (?, ?)',
    [topic, giaTri]
  );
  broadcast({ topic, gia_tri: giaTri });

  const goiYs = kiemTraGoiY(topic, giaTri);
  const noiDungMoi = goiYs[0]?.noi_dung || null;
  if (noiDungMoi !== goiYTruocDo[topic]) {
    goiYs.forEach((g) => {
      console.log(`[${g.muc.toUpperCase()}] ${g.noi_dung}`);
      broadcast({ type: 'canh_bao', message: g.noi_dung, muc: g.muc });
    });
    goiYTruocDo[topic] = noiDungMoi;
  }
});

const express = require('express');
const cors = require('cors');
const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/lichsu/:loai', async (req, res) => {
  const topicMap = {
    nhietdo: 'nha/phongkhach/nhietdo/state',
    doam: 'nha/phongkhach/doam/state',
    chuyendong: 'nha/phongkhach/chuyendong/state',
    anhsang: 'nha/phongkhach/anhsang/state',
    relay: 'nha/phongkhach/relay/state',
  };
  const topic = topicMap[req.params.loai];
  if (!topic) return res.status(404).json({ error: 'Không tìm thấy loại dữ liệu này' });

  const [rows] = await pool.query(
    'SELECT gia_tri, thoi_gian FROM cam_bien_data WHERE topic = ? ORDER BY thoi_gian DESC LIMIT 50',
    [topic]
  );
  res.json(rows);
});

app.post('/api/relay', (req, res) => {
  const { trang_thai } = req.body;
  if (!['ON', 'OFF'].includes(trang_thai)) {
    return res.status(400).json({ error: 'trang_thai phải là ON hoặc OFF' });
  }
  client.publish('nha/phongkhach/relay/set', trang_thai);
  res.json({ message: `Đã gửi lệnh ${trang_thai} tới relay` });
});

app.get('/api/bat-thuong', async (req, res) => {
  const ketQua = { bat_thuong: [] };

  const [ngayDauTien] = await pool.query('SELECT MIN(thoi_gian) as ngay_dau FROM cam_bien_data');
  const soNgayCoData = ngayDauTien[0].ngay_dau
    ? Math.floor((Date.now() - new Date(ngayDauTien[0].ngay_dau)) / 86400000)
    : 0;

  if (soNgayCoData < 3) {
    return res.json({ bat_thuong: [], ghi_chu: 'Chưa đủ dữ liệu lịch sử (cần tối thiểu 3 ngày) để so sánh chính xác' });
  }

  const [nhietDoTB] = await pool.query(
    `SELECT AVG(CAST(gia_tri AS DECIMAL(5,2))) as tb FROM cam_bien_data
     WHERE topic = 'nha/phongkhach/nhietdo/state' AND thoi_gian >= DATE_SUB(NOW(), INTERVAL 7 DAY)`
  );
  const [nhietDoMoiNhat] = await pool.query(
    `SELECT gia_tri FROM cam_bien_data WHERE topic = 'nha/phongkhach/nhietdo/state' ORDER BY thoi_gian DESC LIMIT 1`
  );
  if (nhietDoTB[0].tb && nhietDoMoiNhat[0]) {
    const chenhLech = Math.abs(parseFloat(nhietDoMoiNhat[0].gia_tri) - nhietDoTB[0].tb);
    if (chenhLech > 3) {
      ketQua.bat_thuong.push(`Nhiệt độ hiện tại (${nhietDoMoiNhat[0].gia_tri}°C) lệch ${chenhLech.toFixed(1)}°C so với trung bình 7 ngày qua (${nhietDoTB[0].tb.toFixed(1)}°C)`);
    }
  }

  const gioHienTai = new Date().getHours();
  const [motionLichSu] = await pool.query(
    `SELECT COUNT(*) as so_lan FROM cam_bien_data
     WHERE topic = 'nha/phongkhach/chuyendong/state' AND gia_tri = 'ON' AND HOUR(thoi_gian) = ?
     AND thoi_gian >= DATE_SUB(NOW(), INTERVAL 7 DAY) AND thoi_gian < CURDATE()`,
    [gioHienTai]
  );
  const [motionHomNay] = await pool.query(
    `SELECT COUNT(*) as so_lan FROM cam_bien_data
     WHERE topic = 'nha/phongkhach/chuyendong/state' AND gia_tri = 'ON'
     AND thoi_gian >= CURDATE() AND HOUR(thoi_gian) = ?`,
    [gioHienTai]
  );
  if (motionLichSu[0].so_lan === 0 && motionHomNay[0].so_lan > 0) {
    ketQua.bat_thuong.push(`Phát hiện chuyển động lúc ${gioHienTai}h - khung giờ này 7 ngày qua chưa từng ghi nhận chuyển động`);
  }

  res.json(ketQua);
});

app.get('/api/thoi-quen', async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM thoi_quen_nguoi_dung ORDER BY ngay_tao DESC');
  const gomNhom = {};
  rows.forEach((r) => {
    if (!gomNhom[r.danh_muc]) gomNhom[r.danh_muc] = [];
    gomNhom[r.danh_muc].push({ id: r.id, noi_dung: r.noi_dung });
  });
  res.json(gomNhom);
});

app.post('/api/thoi-quen', async (req, res) => {
  const { danh_muc, noi_dung } = req.body;
  if (!danh_muc?.trim() || !noi_dung?.trim()) {
    return res.status(400).json({ error: 'danh_muc và noi_dung không được để trống' });
  }
  if (danh_muc.trim().length > 50) {
    return res.status(400).json({ error: 'Tên danh mục quá dài (tối đa 50 ký tự)' });
  }
  const [result] = await pool.query(
    'INSERT INTO thoi_quen_nguoi_dung (danh_muc, noi_dung) VALUES (?, ?)',
    [danh_muc.trim(), noi_dung.trim()]
  );
  res.json({ id: result.insertId, danh_muc: danh_muc.trim(), noi_dung: noi_dung.trim() });
});

app.delete('/api/thoi-quen/:id', async (req, res) => {
  await pool.query('DELETE FROM thoi_quen_nguoi_dung WHERE id = ?', [req.params.id]);
  res.json({ message: 'Đã xóa' });
});

async function taoTomTat() {
  const ketQua = {
    du_lieu_hien_tai: { nhiet_do: null, do_am: null },
    bat_thuong: [],
    goi_y: [],
    thoi_quen: [],
  };

  const [nhietDoMoiNhat] = await pool.query(
    `SELECT gia_tri FROM cam_bien_data WHERE topic = 'nha/phongkhach/nhietdo/state' ORDER BY thoi_gian DESC LIMIT 1`
  );
  const [doAmMoiNhat] = await pool.query(
    `SELECT gia_tri FROM cam_bien_data WHERE topic = 'nha/phongkhach/doam/state' ORDER BY thoi_gian DESC LIMIT 1`
  );
  if (nhietDoMoiNhat[0]) ketQua.du_lieu_hien_tai.nhiet_do = nhietDoMoiNhat[0].gia_tri;
  if (doAmMoiNhat[0]) ketQua.du_lieu_hien_tai.do_am = doAmMoiNhat[0].gia_tri;

  if (ketQua.du_lieu_hien_tai.nhiet_do !== null) {
    ketQua.goi_y.push(
      ...kiemTraGoiY('nha/phongkhach/nhietdo/state', ketQua.du_lieu_hien_tai.nhiet_do).map((g) => g.noi_dung)
    );
  }
  if (ketQua.du_lieu_hien_tai.do_am !== null) {
    ketQua.goi_y.push(
      ...kiemTraGoiY('nha/phongkhach/doam/state', ketQua.du_lieu_hien_tai.do_am).map((g) => g.noi_dung)
    );
  }

  const [ngayDauTien] = await pool.query('SELECT MIN(thoi_gian) as ngay_dau FROM cam_bien_data');
  const soNgayCoData = ngayDauTien[0].ngay_dau
    ? Math.floor((Date.now() - new Date(ngayDauTien[0].ngay_dau)) / 86400000)
    : 0;

  if (soNgayCoData >= 3) {
    const [nhietDoTB] = await pool.query(
      `SELECT AVG(CAST(gia_tri AS DECIMAL(5,2))) as tb FROM cam_bien_data
       WHERE topic = 'nha/phongkhach/nhietdo/state' AND thoi_gian >= DATE_SUB(NOW(), INTERVAL 7 DAY)`
    );
    if (nhietDoTB[0].tb && nhietDoMoiNhat[0]) {
      const chenhLech = Math.abs(parseFloat(nhietDoMoiNhat[0].gia_tri) - nhietDoTB[0].tb);
      if (chenhLech > 3) {
        ketQua.bat_thuong.push(
          `Nhiệt độ hiện tại (${nhietDoMoiNhat[0].gia_tri}°C) lệch ${chenhLech.toFixed(1)}°C so với trung bình 7 ngày qua (${nhietDoTB[0].tb.toFixed(1)}°C)`
        );
      }
    }

    const gioHienTai = new Date().getHours();
    const [motionLichSu] = await pool.query(
      `SELECT COUNT(*) as so_lan FROM cam_bien_data
       WHERE topic = 'nha/phongkhach/chuyendong/state' AND gia_tri = 'ON' AND HOUR(thoi_gian) = ?
       AND thoi_gian >= DATE_SUB(NOW(), INTERVAL 7 DAY) AND thoi_gian < CURDATE()`,
      [gioHienTai]
    );
    const [motionHomNay] = await pool.query(
      `SELECT COUNT(*) as so_lan FROM cam_bien_data
       WHERE topic = 'nha/phongkhach/chuyendong/state' AND gia_tri = 'ON'
       AND thoi_gian >= CURDATE() AND HOUR(thoi_gian) = ?`,
      [gioHienTai]
    );
    if (motionLichSu[0].so_lan === 0 && motionHomNay[0].so_lan > 0) {
      ketQua.bat_thuong.push(
        `Phát hiện chuyển động lúc ${gioHienTai}h - khung giờ này 7 ngày qua chưa từng ghi nhận chuyển động`
      );
    }
  }

  const [thoiQuenRows] = await pool.query('SELECT danh_muc, noi_dung FROM thoi_quen_nguoi_dung ORDER BY ngay_tao DESC');
  ketQua.thoi_quen = thoiQuenRows;

  return ketQua;
}

function phatHienLenh(cauHoi) {
  const cau = cauHoi.toLowerCase();

  const batDen = /(bật|mở).*(đèn)/.test(cau)
    || /(turn on|switch on).*light/.test(cau)
    || /light.*\bon\b/.test(cau);
  if (batDen) return { thiet_bi: 'den', ten: 'light', hanh_dong: 'ON' };

  const tatDen = /tắt.*(đèn)/.test(cau)
    || /(turn off|switch off).*light/.test(cau)
    || /light.*\boff\b/.test(cau);
  if (tatDen) return { thiet_bi: 'den', ten: 'light', hanh_dong: 'OFF' };

  const batCoi = /(bật|kêu).*(còi|chuông)/.test(cau)
    || /(turn on|switch on).*(buzzer|alarm)/.test(cau)
    || /(buzzer|alarm).*\bon\b/.test(cau);
  if (batCoi) return { thiet_bi: 'coi', ten: 'buzzer', hanh_dong: 'ON' };

  const tatCoi = /tắt.*(còi|chuông)/.test(cau)
    || /(turn off|switch off).*(buzzer|alarm)/.test(cau)
    || /(buzzer|alarm).*\boff\b/.test(cau);
  if (tatCoi) return { thiet_bi: 'coi', ten: 'buzzer', hanh_dong: 'OFF' };

  return null;
}

app.post('/api/chatbot', async (req, res) => {
  const { cau_hoi } = req.body;

  const lenh = phatHienLenh(cau_hoi);
  if (lenh) {
    client.publish('nha/phongkhach/thucong/set', 'ON');
    client.publish(`nha/phongkhach/${lenh.thiet_bi}/set`, lenh.hanh_dong);
    const hanhDongChu = lenh.hanh_dong === 'ON' ? 'turned on' : 'turned off';
    return res.json({ tra_loi: `Done — the ${lenh.ten} has been ${hanhDongChu}.` });
  }

  const tomTat = await taoTomTat();
  const context = `Home sensor data (written in Vietnamese, read and understand it,
but always answer in English):
- Current temperature: ${tomTat.du_lieu_hien_tai.nhiet_do}°C
- Current humidity: ${tomTat.du_lieu_hien_tai.do_am}%
- Anomalies detected: ${tomTat.bat_thuong.join('; ') || 'None'}
- Suggestions: ${tomTat.goi_y.join('; ') || 'None'}
- User habits: ${tomTat.thoi_quen.map(t => `[${t.danh_muc}] ${t.noi_dung}`).join('; ') || 'None recorded yet'}`;

  try {
    const response = await fetch('http://localhost:11434/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama3.1:latest',
        messages: [
          { role: 'system', content: `You are a helpful smart home assistant. Always answer in English, in 2-4 short sentences.\n${context}` },
          { role: 'user', content: cau_hoi },
        ],
        stream: false,
      }),
    });
    const data = await response.json();
    res.json({ tra_loi: data.message.content });
  } catch (err) {
    res.status(500).json({ error: 'Ollama không phản hồi - kiểm tra service có đang chạy không' });
  }
});

app.post('/api/che-do-thu-cong', (req, res) => {
  const { trang_thai } = req.body;
  if (!['ON', 'OFF'].includes(trang_thai)) {
    return res.status(400).json({ error: 'trang_thai phải là ON hoặc OFF' });
  }
  client.publish('nha/phongkhach/thucong/set', trang_thai);
  res.json({ message: `Đã đặt Chế độ thủ công: ${trang_thai}` });
});

app.listen(3000, () => {
  console.log('API server đang chạy tại http://localhost:3000');
});
