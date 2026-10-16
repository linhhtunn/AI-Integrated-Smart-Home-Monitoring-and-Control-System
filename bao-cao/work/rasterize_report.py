"""Use the packaged DOCX rasterizer with the native Word PDF export on Windows."""
import importlib.util
from pathlib import Path
import os
import argparse
from PIL import Image,ImageDraw,ImageFont
from pypdf import PdfReader

parser=argparse.ArgumentParser()
parser.add_argument('--qa',default='qa')
parser.add_argument('--document',default='Bao_cao_He_thong_IoT_Nha_thong_minh.docx')
args=parser.parse_args()
work=Path('bao-cao/work').resolve();qa=work/args.qa
skill=Path('C:/Users/ADMIN/.codex/plugins/cache/openai-primary-runtime/documents/26.1013.11914/skills/documents/render_docx.py')
poppler='C:/Users/ADMIN/.cache/codex-runtimes/codex-primary-runtime/dependencies/native/poppler/Library/bin'
os.environ['PATH']=poppler+os.pathsep+os.environ.get('PATH','')
spec=importlib.util.spec_from_file_location('docx_renderer',skill);r=importlib.util.module_from_spec(spec);spec.loader.exec_module(r)
# LibreOffice is not bundled on this Windows runtime; Word exported and updated the document.
r.convert_to_pdf=lambda *args,**kwargs:(str(qa/'report.pdf'),'Native Word ExportAsFixedFormat')
pages=r.rasterize(str(work.parent/args.document),str(qa/'pages'),120,False,False)
reader=PdfReader(qa/'report.pdf')
records=[]
for i,p in enumerate(reader.pages):
    t=p.extract_text() or '';records.append({'page':i+1,'chars':len(t),'start':t[:110].replace('\n',' '),'end':t[-100:].replace('\n',' ')})
(qa/'page_text.txt').write_text('\n\n'.join(f'PAGE {i+1}\n{p.extract_text()}' for i,p in enumerate(reader.pages)),encoding='utf8')
import json
(qa/'page_summary.json').write_text(json.dumps(records,ensure_ascii=False,indent=2),encoding='utf8')
for batch in range(0,len(pages),9):
    out=Image.new('RGB',(900,1320),'#cbd0d5');draw=ImageDraw.Draw(out)
    for j,p in enumerate(pages[batch:batch+9]):
        im=Image.open(p);im.thumbnail((288,405));x=(j%3)*300+6;y=(j//3)*440+26
        out.paste(im,(x,y));draw.text((x,y-20),f'Page {batch+j+1}',font=ImageFont.truetype('C:/Windows/Fonts/arial.ttf',16),fill='black')
    out.save(qa/f'contact-{batch//9+1}.png')
print(json.dumps(records,ensure_ascii=False))
print('Rendered',len(pages),'pages')
