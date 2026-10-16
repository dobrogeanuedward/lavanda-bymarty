"""Outline only LAVANDA and subset its web face; FontTools[woff] is a build-time tool."""
from pathlib import Path
import json
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.transformPen import TransformPen
from fontTools import subset

root=Path(__file__).resolve().parent.parent
font=TTFont(root/'docs/font-sources/trashhand/TrashHand.TTF')
glyphs=font.getGlyphSet(); cmap=font.getBestCmap()
bounds=BoundsPen(glyphs); cursor=0
positions=[]
for char in 'LAVANDA':
 name=cmap[ord(char)];positions.append((name,cursor))
 glyphs[name].draw(TransformPen(bounds,(1,0,0,1,cursor,0)))
 cursor+=font['hmtx'][name][0]
xmin,ymin,xmax,ymax=bounds.bounds
scale=100/(ymax-ymin)
pen=SVGPathPen(glyphs,ntos=lambda value:format(value,'.3f').rstrip('0').rstrip('.') or '0')
for name,cursor in positions:
 glyphs[name].draw(TransformPen(pen,(scale,0,0,-scale,(cursor-xmin)*scale,ymax*scale)))
data={'font':'TrashHand','author':'Luce Avérous','text':'LAVANDA','height':100,'width':round((xmax-xmin)*scale,3),'path':pen.getCommands()}
(root/'scripts/trashhand-wordmark.json').write_text(json.dumps(data,ensure_ascii=False,separators=(',',':'))+'\n')
options=subset.Options();options.flavor='woff2';options.name_IDs=['*'];options.name_legacy=True;options.name_languages=['*'];options.recalc_timestamp=False
subsetter=subset.Subsetter(options=options);subsetter.populate(text='LAVANDAlavanda ');subsetter.subset(font)
font.flavor='woff2';font.save(root/'public/fonts/lavanda-logo.woff2')
print('Logo:',data['width'],'×100; WOFF2:',(root/'public/fonts/lavanda-logo.woff2').stat().st_size,'bytes')
