from PIL import Image,ImageDraw,ImageFont
from pathlib import Path
import math

OUT=Path('bao-cao/work/images')
def font(n=28,b=False):return ImageFont.truetype('C:/Windows/Fonts/arialbd.ttf' if b else 'C:/Windows/Fonts/arial.ttf',n)
def text(d,xy,t,n=28,b=False,color='#17293b',anchor='mm',align='center'):
    d.multiline_text(xy,t,font=font(n,b),fill=color,anchor=anchor,align=align,spacing=10)
def box(d,rect,title,subtitle='',fill='#edf3f8'):
    d.rounded_rectangle(rect,16,fill=fill,outline='#698399',width=3)
    x=(rect[0]+rect[2])/2;y=(rect[1]+rect[3])/2
    text(d,(x,y-20 if subtitle else y),title,30,True)
    if subtitle:text(d,(x,y+29),subtitle,25)
def arrow(d,a,b,color='#315e82',double=False):
    d.line([a,b],fill=color,width=4)
    for origin,dest in [(a,b)]+([(b,a)] if double else []):
        angle=math.atan2(dest[1]-origin[1],dest[0]-origin[0])
        d.polygon([dest,(dest[0]-17*math.cos(angle-.5),dest[1]-17*math.sin(angle-.5)),(dest[0]-17*math.cos(angle+.5),dest[1]-17*math.sin(angle+.5))],fill=color)

im=Image.new('RGB',(1500,1080),'white');d=ImageDraw.Draw(im)
text(d,(750,48),'MẠNG LAN VÀ CÁC DỊCH VỤ CỦA DỰ ÁN',36,True)
box(d,(35,165,355,325),'ESP32 / ESPHome','WiFi • IP do LAN cấp')
box(d,(35,445,355,595),'Router / WiFi AP','Kết nối IP trong LAN')
arrow(d,(195,325),(195,445),double=True)
d.rounded_rectangle((435,120,1460,1000),22,outline='#416685',width=4,fill='#fafcfe')
text(d,(948,165),'MÁY CHỦ TRONG LAN',32,True)
text(d,(948,210),'IP trong cấu hình firmware: 192.168.0.102',27)
box(d,(485,280,910,415),'Docker: Mosquitto','Host 1883 → container 1883')
arrow(d,(355,520),(462,520))
d.line([(462,520),(462,348),(485,348)],fill='#315e82',width=4)
text(d,(180,715),'ESP32 tìm máy chủ\nbằng IP LAN,\nkhông dùng localhost',27)
box(d,(990,280,1415,415),'Backend Node.js','REST 3000 • WebSocket 8081')
arrow(d,(910,348),(990,348),double=True)
box(d,(485,535,910,670),'MySQL','TCP 3306 • dữ liệu ứng dụng')
box(d,(990,535,1415,670),'Ollama','HTTP 11434 • llama3.1')
arrow(d,(1100,415),(910,535))
arrow(d,(1250,415),(1250,535),double=True)
box(d,(485,800,910,935),'Vite / React','HTTP localhost:5173')
box(d,(990,800,1415,935),'Trình duyệt trên máy chủ','REST + WebSocket')
arrow(d,(910,868),(990,868),double=True)
d.line([(1440,348),(1440,868),(1415,868)],fill='#315e82',width=4)
arrow(d,(1415,348),(1440,348),double=True)
text(d,(750,1040),'Các dịch vụ cùng máy dùng loopback; ESP32 truy cập qua IP LAN.',27)
im.save(OUT/'network-topology.png')

im=Image.new('RGB',(1500,1100),'white');d=ImageDraw.Draw(im)
text(d,(750,48),'LUỒNG TRẠNG THÁI VÀ LUỒNG ĐIỀU KHIỂN',35,True)
lanes=[180,560,940,1320]
for x,title in zip(lanes,['ESP32','Mosquitto','Backend + MySQL','Dashboard']):
    d.rounded_rectangle((x-155,100,x+155,174),14,fill='#e9f0f7',outline='#698399',width=3)
    text(d,(x,136),title,27,True)
    d.line([(x,190),(x,1040)],fill='#c5d0da',width=2)
def msg(y,a,b,label,below=''):
    arrow(d,(lanes[a],y),(lanes[b],y))
    text(d,((lanes[a]+lanes[b])/2,y-30),label,26)
    if below:text(d,((lanes[a]+lanes[b])/2,y+29),below,23,color='#516477')
text(d,(750,225),'A. CẢM BIẾN → ỨNG DỤNG',29,True)
msg(305,0,1,'1. Publish /state','Ví dụ nhietdo/state = 29.9')
msg(420,1,2,'2. Chuyển topic đã đăng ký')
box(d,(780,460,1100,555),'3. Ghi MySQL',fill='#f4f7fa')
msg(615,2,3,'4. WS: topic, gia_tri','Cập nhật thẻ và biểu đồ')
d.rectangle((15,682,1485,690),fill='#eef2f6')
text(d,(750,735),'B. NGƯỜI DÙNG → THIẾT BỊ → PHẢN HỒI',29,True)
msg(810,3,2,'1. POST /api/relay')
msg(905,2,1,'2. Publish relay/set','Payload: ON hoặc OFF')
msg(1000,1,0,'3. ESP32 nhận và tác động')
text(d,(1050,1030),'4. relay/state trở lại theo luồng A',25,True)
text(d,(750,1075),'Trạng thái firmware phản ánh logic đầu ra; xác nhận tải cần quan sát/đo thêm.',24)
im.save(OUT/'network-sequence.png')
print('Created two network diagrams')
