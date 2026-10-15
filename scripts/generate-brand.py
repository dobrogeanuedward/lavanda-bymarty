"""LAVANDA: original vector lettering and illustration, derived from Martina's sketch.

The primary lettering, flask and open circle are drawn here as original paths.
Ancillary text is outlined from URW Base 35 fonts installed on this build host.
The exported SVGs are self-contained and need no fonts at runtime.
"""
from pathlib import Path
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen

ROOT=Path(__file__).resolve().parent.parent / "public" / "brand"
GLYPHS={
'L':'M5 9 17 4 13 143 63 124 66 135 1 158Z',
'A':'M0 157 32 0 43 3 82 154 69 159 38 30 13 158ZM19 107 64 94 67 104 16 119Z',
'V':'M0 2 12 0 47 137 81 4 93 0 52 161 40 164Z',
'N':'M0 157 5 0 17 0 78 130 78 5 89 1 91 157 78 164 18 32 13 155Z',
'D':'M0 159 9 0 21 0 16 143C65 134 78 45 25 11L28 0C92 27 100 143 0 159Z',
}
LETTERS=[('L',0,-2),('A',70,2),('V',159,0),('A',252,-3),('N',344,1),('D',445,-1),('A',539,3)]

def wordmark(color='#000'):
 return '<g fill="'+color+'">'+''.join(f'<path transform="translate({x} {dy})" d="{GLYPHS[ch]}"/>' for ch,x,dy in LETTERS)+'</g>'

def svg(w,h,body,title,desc):
 return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" role="img" aria-labelledby="title desc"><title id="title">{title}</title><desc id="desc">{desc}</desc>{body}</svg>\n'

def write(name,w,h,body,title='LAVANDA',desc='Marchio LAVANDA tratto dalla bozza di Martina: lettering originale, bottiglia e cerchio aperto.'):
 (ROOT/name).write_text(svg(w,h,body,title,desc),encoding='utf-8')

def outlined(text,size,x,y,color,font='sans',align='left'):
 path=('/usr/share/fonts/opentype/urw-base35/NimbusSansNarrow-Regular.otf' if font=='sans' else '/usr/share/fonts/opentype/urw-base35/Z003-MediumItalic.otf')
 font_obj=TTFont(path)
 glyphset=font_obj.getGlyphSet();cmap=font_obj.getBestCmap();units=font_obj['head'].unitsPerEm
 commands=[];cursor=0
 for letter in text:
  name=cmap[ord(letter)];pen=SVGPathPen(glyphset);glyphset[name].draw(pen)
  commands.append(f'<path transform="translate({cursor} 0)" d="{pen.getCommands()}"/>')
  cursor+=font_obj['hmtx'].metrics[name][0]
 scale=size/units
 offset=cursor*scale/2 if align=='center' else 0
 return f'<g fill="{color}" transform="translate({x-offset:.3f} {y}) scale({scale:.6f} {-scale:.6f})">'+''.join(commands)+'</g>'

def flask(color='#000',accent=None,simple=False):
 base=f'''<g stroke="{color}" fill="none" stroke-linecap="round" stroke-linejoin="round">
 <path stroke-width="5" d="M58 11Q98 2 140 9L134 46Q99 52 65 46ZM50 49Q102 39 146 49Q151 54 146 59Q104 69 50 59Q44 54 50 49Z"/>
 <path stroke-width="4" d="m70 14 4 28m9-29 2 29m11-29v30m12-31-2 31m14-30-3 29m14-28-4 27"/>
 <path stroke-width="5" d="m61 64 15 45m58-45-15 45M76 129C64 152 43 166 40 194C34 229 69 251 102 251C138 251 168 235 164 207C161 180 141 152 123 130"/>
 <path stroke-width="4" d="M46 203C70 221 90 207 95 184C91 208 100 223 112 210C122 199 119 187 116 177C135 206 155 198 156 192"/>
 </g>'''
 if not simple:
  base+=f'<g fill="{color}"><circle cx="97" cy="89" r="2.5"/><circle cx="107" cy="226" r="2.4"/><circle cx="75" cy="220" r="1.8"/><circle cx="128" cy="213" r="1.6"/></g>'
 if accent:
  base=f'<g stroke="{accent}" stroke-width="3.5" fill="none" stroke-linecap="round"><path d="M48 196C40 222 72 245 105 244C124 244 144 238 153 227M54 51Q99 44 147 53M66 65l12 40m54-39-14 40"/></g>'+base
 return base

def emblem(color='#000',accent=None):
 a=f'<path d="M143 47C118 5 59 4 24 41C-9 77 1 128 37 151C75 176 127 165 147 126" fill="none" stroke="{color}" stroke-width="5.5" stroke-linecap="round"/>'
 if accent:a=f'<path d="M139 42C112 4 57 1 20 41C-12 78-1 129 35 154C75 182 132 166 149 131" fill="none" stroke="{accent}" stroke-width="3.5" stroke-linecap="round"/>'+a
 return a+f'<g transform="translate(17 18) scale(.55)">{flask(color,accent,True)}</g>'

def sign(color='#000',accent=None):
 a=f'''<g fill="none" stroke="{color}" stroke-linecap="round" stroke-linejoin="round"><path stroke-width="6" d="M584 207C563 207 565 184 579 186C592 188 589 198 584 197M584 207H801M657 203 686 167 720 205"/><path stroke-width="5" d="M603 235 792 232 794 411 601 419ZM619 210v25m154-25v23"/></g>'''
 if accent:a=f'<path d="M609 424 799 416 797 244" fill="none" stroke="{accent}" stroke-width="5" stroke-linecap="round"/>'+a
 a+=outlined('La bottega',39,697,282,color,align='center')+outlined('della',39,697,330,color,align='center')+outlined('speziale',43,697,381,color,align='center')
 a+=outlined('Aperto',63,695,474,color,'script','center')
 return a

for name,color,accent in [('logo.svg','#000','#FF1685'),('logo-inverse.svg','#fff','#FF1685'),('logo-mono.svg','#000',None)]:
 body=f'<g transform="translate(8 11)">{emblem(color,accent)}</g><g transform="translate(219 9) scale(1.34)">{wordmark(color)}</g>'
 write(name,1080,230,body)
for name,color in [('wordmark.svg','#000'),('wordmark-inverse.svg','#fff')]:
 write(name,655,185,'<g transform="translate(12 10)">'+wordmark(color)+'</g>',desc='LAVANDA: lettering originale a tracciati, alto, angolare e volutamente vivo.')
for name,color,accent in [('emblem.svg','#000','#FF1685'),('emblem-inverse.svg','#fff','#FF1685'),('emblem-mono.svg','#000',None)]:
 write(name,165,178,f'<g transform="translate(8 4)">{emblem(color,accent)}</g>')
for name,color,accent in [('logo-bottega.svg','#000','#FF1685'),('logo-bottega-mono.svg','#000',None),('logo-bottega-inverse.svg','#fff','#FF1685')]:
 arc=f'<path d="M591 142C492 7 282-15 131 111C-23 239-7 460 126 586C269 722 506 683 597 537" fill="none" stroke="{color}" stroke-width="8" stroke-linecap="round"/>'
 if accent:arc=f'<path d="M580 125C479-10 272-19 121 109C-34 243-17 469 124 596C267 731 511 698 609 545" fill="none" stroke="{accent}" stroke-width="5" stroke-linecap="round"/>'+arc
 body=arc+'<defs><mask id="lettering-clearance"><rect width="830" height="790" fill="white"/><rect x="61" y="250" width="550" height="160" fill="black"/></mask></defs>'+f'<g mask="url(#lettering-clearance)"><g transform="translate(156 47) scale(2.05)">{flask(color,accent)}</g></g>'
 body+=f'<g transform="translate(72 264) scale(.82)">{wordmark(color)}</g>'+sign(color,accent)
 body+=outlined('Strega di quartiere',76,368,743,color,'script','center')
 if accent:body+=f'<path d="M156 761C272 744 451 758 565 749" stroke="{accent}" stroke-width="4" fill="none" stroke-linecap="round"/>'
 write(name,830,790,'<g transform="translate(7 10)">'+body+'</g>',desc='Marchio completo dalla bozza di Martina: cerchio aperto, bottiglia con tappo, LAVANDA, insegna La bottega della speziale, Aperto, Strega di quartiere.')
write('favicon.svg',64,64,'<rect width="64" height="64" rx="32" fill="#FF1685"/><g transform="translate(5 4) scale(.32)">'+emblem('#000')+'</g>')
print('Generated current LAVANDA vector identity from Martina sketch.')
