from PIL import Image, ImageDraw, ImageFont

W, H = 1200, 480
im = Image.new("RGB", (W, H), "#eef3f7")
d = ImageDraw.Draw(im)
font_bold = ImageFont.truetype("C:/Windows/Fonts/arialbd.ttf", 28)
font_word = ImageFont.truetype("C:/Windows/Fonts/arialbd.ttf", 34)
font_small = ImageFont.truetype("C:/Windows/Fonts/arial.ttf", 17)
font_tag = ImageFont.truetype("C:/Windows/Fonts/arialbd.ttf", 12)

def rounded_box(x):
    d.rounded_rectangle((x, 25, x + 360, 445), radius=25, fill="#ffffff", outline="#cbd8e2", width=2)

def wordmark(x, y):
    d.text((x, y), "PV", font=font_word, fill="#102a43")
    pv = d.textlength("PV", font=font_word)
    d.text((x + pv, y), "Intell", font=font_word, fill="#1672b8")
    d.text((x, y + 47), "YOUR SOLAR. ANSWERED.", font=font_tag, fill="#71869a")

def sun_panel(cx, cy, orbit=False):
    d.rounded_rectangle((cx, cy, cx + 74, cy + 74), radius=21, fill="#0b2942")
    d.ellipse((cx + 11, cy + 10, cx + 31, cy + 30), fill="#f6c945")
    panel = [(cx + 21, cy + 38), (cx + 62, cy + 32), (cx + 68, cy + 62), (cx + 15, cy + 68)]
    if orbit:
        d.rounded_rectangle((cx, cy, cx + 74, cy + 74), radius=37, fill="#f6c945")
        panel = [(cx + 14, cy + 39), (cx + 58, cy + 33), (cx + 65, cy + 61), (cx + 10, cy + 67)]
    d.polygon(panel, fill="#176da8")
    for dx in (31, 45): d.line((cx + dx, cy + 36, cx + dx + 3, cy + 65), fill="#bfe6fa", width=2)
    d.line((cx + 16, cy + 49, cx + 65, cy + 43), fill="#bfe6fa", width=2)
    d.line((cx + 13, cy + 59, cx + 67, cy + 52), fill="#bfe6fa", width=2)

for x in (25, 420, 815): rounded_box(x)

sun_panel(55, 70)
wordmark(145, 72)
d.text((55, 210), "A. SUN + PANEL", font=font_bold, fill="#102a43")
d.multiline_text((55, 260), "Simple, clearly solar and crisp\nat small header sizes.", font=font_small, fill="#536b7e", spacing=8)
d.rounded_rectangle((55, 355, 167, 390), radius=17, fill="#f6c945")
d.text((79, 363), "MY PICK", font=font_tag, fill="#102a43")

sun_panel(450, 70, True)
wordmark(540, 72)
d.text((450, 210), "B. SOLAR ORBIT", font=font_bold, fill="#102a43")
d.multiline_text((450, 260), "More playful, with a strong\nstandalone app-icon silhouette.", font=font_small, fill="#536b7e", spacing=8)

d.rounded_rectangle((845, 70, 919, 144), radius=21, fill="#1672b8")
d.text((856, 88), "PV", font=font_word, fill="#ffffff")
d.ellipse((901, 79, 912, 90), fill="#f6c945")
wordmark(935, 72)
d.text((845, 210), "C. PV MONOGRAM", font=font_bold, fill="#102a43")
d.multiline_text((845, 260), "Cleanest tech identity, but less\nobviously solar on its own.", font=font_small, fill="#536b7e", spacing=8)

im.save("E:/PVIntell/visualizations/pvintell-logo-directions.png")
