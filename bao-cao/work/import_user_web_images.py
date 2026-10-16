import json,base64
from pathlib import Path
from PIL import Image

session=Path('C:/Users/ADMIN/.codex/sessions/2026/10/15/rollout-2026-10-15T17-58-00-01a13f36-3a81-75c2-9d66-20f9278b3e91.jsonl')
out=Path('bao-cao/work/images')
target=None
for line in session.open(encoding='utf-8'):
    item=json.loads(line)
    p=item.get('payload',{})
    if item.get('type')=='response_item' and p.get('role')=='user':
        content=p.get('content',[])
        if any(c.get('type')=='input_text' and 'kĩ hơn phần mạng' in c.get('text','') for c in content):
            target=content
assert target is not None,'Latest user attachments were not found in this task session'
images=[c for c in target if c.get('type')=='input_image']
assert len(images)==4,len(images)
for name,content in zip(['dashboard','overview','habits','chatbot'],images):
    data=content['image_url'].split(',',1)[1]
    file=out/f'web-{name}-user.png'
    file.write_bytes(base64.b64decode(data))
    print(file.name,Image.open(file).size)

Image.open(out/'web-dashboard-user.png').crop((198,72,1664,1021)).save(out/'web-dashboard.png')
Image.open(out/'web-dashboard-user.png').crop((236,582,1240,1017)).save(out/'web-chart.png')
Image.open(out/'web-dashboard-user.png').crop((236,373,1240,562)).save(out/'web-controls.png')
Image.open(out/'web-overview-user.png').crop((174,76,1720,1032)).save(out/'web-overview.png')
Image.open(out/'web-habits-user.png').crop((165,75,1720,882)).save(out/'web-habits.png')
Image.open(out/'web-chatbot-user.png').crop((163,77,1719,1028)).save(out/'web-chatbot.png')
Image.open(out/'mqtt-topics-user.png').crop((0,0,650,380)).save(out/'mqtt-topics-focused.png')
print('Saved original attachments and clean crops; screenshot contents are unchanged.')
