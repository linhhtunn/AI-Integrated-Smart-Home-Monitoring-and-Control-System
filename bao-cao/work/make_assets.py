from PIL import Image, ImageDraw, ImageFont, ImageOps
from pathlib import Path
import math

OUT=Path('bao-cao/work/images'); OUT.mkdir(exist_ok=True)
FONT='C:/Windows/Fonts/arial.ttf'; BOLD='C:/Windows/Fonts/arialbd.ttf'
def ft(n=30,b=False):return ImageFont.truetype(BOLD if b else FONT,n)
def canvas(w,h):
    im=Image.new('RGB',(w,h),'white');return im,ImageDraw.Draw(im)
def txt(d,xy,text,n=30,b=False,fill='#17293b',anchor='mm'):
    d.multiline_text(xy,text,font=ft(n,b),fill=fill,anchor=anchor,align='center',spacing=12)
def box(d,xy,text,n=30,fill='#eff4f8'):
    d.rounded_rectangle(xy,18,fill=fill,outline='#526b82',width=3)
    txt(d,((xy[0]+xy[2])/2,(xy[1]+xy[3])/2),text,n)
def arrow(d,a,b,label=None):
    d.line([a,b],fill='#294d70',width=4)
    ang=math.atan2(b[1]-a[1],b[0]-a[0]);p1=(b[0]-18*math.cos(ang-.45),b[1]-18*math.sin(ang-.45));p2=(b[0]-18*math.cos(ang+.45),b[1]-18*math.sin(ang+.45));d.polygon([b,p1,p2],fill='#294d70')
    if label:txt(d,((a[0]+b[0])/2,(a[1]+b[1])/2-27),label,24)

im,d=canvas(1600,960)
txt(d,(800,45),'KIẾN TRÚC HỆ THỐNG NHÀ THÔNG MINH',38,True)
box(d,(35,140,430,335),'DHT11   PIR   LDR\nGPIO4   GPIO27   GPIO34',30)
box(d,(35,440,430,620),'ESP32 và ESPHome\nWiFi 2,4 GHz',34)
box(d,(35,735,430,910),'Relay     LED     Còi\nGPIO26   GPIO25   GPIO33',30)
arrow(d,(230,335),(230,440));arrow(d,(230,620),(230,735))
box(d,(600,440,980,620),'Mosquitto MQTT\nTCP 1883',34)
arrow(d,(430,495),(600,495),'state →')
arrow(d,(600,560),(430,560),'← set')
box(d,(1120,420,1560,655),'Backend Node.js\nExpress 3000\nWebSocket 8081',32)
arrow(d,(980,495),(1120,495),'MQTT')
arrow(d,(1120,575),(980,575))
box(d,(1120,115,1560,285),'Dashboard React\nREST và WebSocket',32)
arrow(d,(1280,420),(1280,285),'REST')
arrow(d,(1450,420),(1450,285),'WS')
box(d,(575,760,970,910),'MySQL 8\nLịch sử và thói quen',30)
box(d,(1120,760,1560,910),'Ollama\nllama3.1:latest',32)
arrow(d,(1210,655),(970,760),'SQL')
arrow(d,(1350,655),(1350,760),'HTTP 11434')
im.save(OUT/'architecture.png')

im,d=canvas(1600,1300)
txt(d,(800,45),'LOGIC SỰ KIỆN TRÊN ESP32',38,True)
txt(d,(400,115),'PIR chuyển sang ON',32,True);txt(d,(1200,115),'PIR chuyển sang OFF',32,True)
box(d,(100,170,700,280),'Chế độ thủ công đang bật?',32)
box(d,(900,170,1500,280),'Chế độ thủ công đang bật?',32)
arrow(d,(400,280),(400,430),'Không');arrow(d,(1200,280),(1200,430),'Không')
box(d,(100,430,700,570),'Bật LED GPIO25\nBật còi GPIO33',32)
box(d,(900,430,1500,570),'Tắt LED GPIO25\nTắt relay GPIO26',32)
arrow(d,(400,570),(400,700))
box(d,(100,700,700,840),'Chờ 500 ms\nTắt còi GPIO33',32)
arrow(d,(400,840),(400,970))
box(d,(100,970,700,1080),'Cảm biến ánh sáng ở ON?',32)
arrow(d,(400,1080),(400,1180),'Có')
box(d,(130,1180,670,1270),'Bật relay GPIO26',32)
box(d,(900,760,1500,1030),'Nếu chế độ thủ công bật\nBỏ qua nhánh tự động\n\nÁnh sáng đổi trạng thái\nChỉ cập nhật cảm biến\nKhông kích relay riêng',28)
txt(d,(800,350),'Nếu Có ở câu hỏi chế độ thủ công thì kết thúc nhánh',25)
im.save(OUT/'automation.png')

im,d=canvas(1600,730)
txt(d,(800,50),'CẤU TRÚC CƠ SỞ DỮ LIỆU',38,True)
box(d,(60,150,770,600),'cam_bien_data\n\nid                 INT PRIMARY KEY\ntopic          VARCHAR 255\ngia_tri        VARCHAR 255\nthoi_gian    DATETIME',31)
box(d,(850,150,1540,600),'thoi_quen_nguoi_dung\n\nid                   INT PRIMARY KEY\ndanh_muc      VARCHAR 50\nnoi_dung        VARCHAR 255\nngay_tao        DATETIME',31)
txt(d,(800,675),'Hai bảng độc lập trong cơ sở dữ liệu nha_thong_minh',28)
im.save(OUT/'database.png')

im,d=canvas(1600,1040)
txt(d,(800,50),'HAI NHÁNH XỬ LÝ CHATBOT',38,True)
box(d,(500,130,1100,245),'POST /api/chatbot\nNhận cau_hoi',32)
arrow(d,(800,245),(800,350))
box(d,(420,350,1180,475),'Nhận diện lệnh đèn hoặc còi bằng regex',30)
arrow(d,(420,415),(240,560),'Khớp');arrow(d,(1180,415),(1360,560),'Không khớp')
box(d,(40,560,740,760),'Publish thucong/set = ON\nPublish den/set hoặc coi/set\nTrả lời đã gửi lệnh',31)
box(d,(860,560,1560,760),'Đọc MySQL\nTạo ngữ cảnh cảm biến\nGợi ý và thói quen',31)
arrow(d,(1210,760),(1210,870))
box(d,(860,870,1560,1010),'Ollama llama3.1:latest\nTrả lời tiếng Anh',32)
txt(d,(390,900),'Nhánh điều khiển không gọi LLM\nPhản hồi HTTP chưa xác nhận\nthiết bị đã thực thi',28)
im.save(OUT/'chatbot-flow.png')

names=[('esp32.jpg','ESP32'),('camBienDoAm.jpg','DHT11'),('camBienChuyenDong.jpg','PIR HC-SR501'),('quangTro.jpg','LDR HW-072'),('reLay.jpg','Relay 2 kênh'),('coiChuDong.jpg','Còi chủ động')]
im,d=canvas(1500,1050)
for i,(name,label) in enumerate(names):
    x=(i%3)*500;y=(i//3)*525
    src=Image.open(Path('nha-thong-minh-dashboard/src/assets/deviceImage')/name).convert('RGB')
    src.thumbnail((445,390))
    im.paste(src,(x+(500-src.width)//2,y+30+(390-src.height)//2))
    txt(d,(x+250,y+465),label,30,True)
im.save(OUT/'components.png')

# A direct crop of the real application screenshot keeps the status cards readable in print.
p=OUT/'dashboard.png'
if p.exists():
    src=Image.open(p).crop((95,95,1005,450)).convert('RGB')
    src=ImageOps.contain(src,(1310,440))
    frame=Image.new('RGB',(1310,440),'white');frame.paste(src,((1310-src.width)//2,(440-src.height)//2))
    frame.save(OUT/'dashboard-status.png')
print('Created report figures')
