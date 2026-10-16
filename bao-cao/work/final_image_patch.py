from pathlib import Path
from PIL import Image,ImageOps
from zipfile import ZipFile,ZIP_DEFLATED
from io import BytesIO
import hashlib,json

work=Path('bao-cao/work');doc=Path('bao-cao/Bao_cao_He_thong_IoT_Nha_thong_minh.docx')
src=Image.open(work/'images/dashboard.png').crop((95,95,1005,450)).convert('RGB')
src=ImageOps.contain(src,(1310,440));frame=Image.new('RGB',(1310,440),'white')
frame.paste(src,((1310-src.width)//2,(440-src.height)//2));frame.save(work/'images/dashboard-status.png')
replacement=(work/'images/dashboard-status.png').read_bytes()
before={};changed=[];temp=doc.with_suffix('.patched.docx')
with ZipFile(doc) as zin,ZipFile(temp,'w',ZIP_DEFLATED) as zout:
    for item in zin.infolist():
        data=zin.read(item.filename);before[item.filename]=hashlib.sha256(data).hexdigest()
        if item.filename.startswith('word/media/'):
            try:
                if Image.open(BytesIO(data)).size==(1310,440):data=replacement;changed.append(item.filename)
            except Exception:pass
        zout.writestr(item,data)
assert len(changed)==1,changed
with ZipFile(temp) as z:
    assert all(hashlib.sha256(z.read(n)).hexdigest()==h for n,h in before.items() if n not in changed)
temp.replace(doc)
hashes={str(p.name):hashlib.sha256(p.read_bytes()).hexdigest() for p in (work/'qa/pages').glob('page-*.png')}
(work/'qa/prior-render-hashes.json').write_text(json.dumps(hashes),encoding='utf8')
print('Replaced only screenshot image part',changed)
