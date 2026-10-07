#!/usr/bin/env python3
"""Genera los iconos PWA de Monitoring Lab con PIL (diseño geométrico original).

Dibujo: fondo azul noche con degradado sutil, retícula de puntos tenues y una
línea de pulso verde (latido de monitorización) con un punto final brillante.
Sin copiar ningún diseño existente.
"""
import math
import os
from PIL import Image, ImageDraw

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'public', 'icons')

BG_TOP = (17, 26, 48)      # #111a30
BG_BOTTOM = (9, 14, 28)    # #090e1c
GRID = (46, 62, 96)
PULSE = (34, 197, 94)      # verde operativo
PULSE_GLOW = (34, 197, 94)


def rounded_bg(size, radius_ratio=0.22):
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    # degradado vertical dentro de un rounded rect (máscara)
    mask = Image.new('L', (size, size), 0)
    md = ImageDraw.Draw(mask)
    md.rounded_rectangle([0, 0, size, size], radius=int(size * radius_ratio), fill=255)
    grad = Image.new('RGBA', (size, size))
    gd = ImageDraw.Draw(grad)
    for y in range(size):
        t = y / size
        c = tuple(int(BG_TOP[i] + (BG_BOTTOM[i] - BG_TOP[i]) * t) for i in range(3)) + (255,)
        gd.line([(0, y), (size, y)], fill=c)
    img.paste(grad, (0, 0), mask)
    return img, ImageDraw.Draw(img)


def draw_grid(d, size):
    step = size / 8
    r = max(1, size // 160)
    for i in range(1, 8):
        for j in range(1, 8):
            x, y = i * step, j * step
            d.ellipse([x - r, y - r, x + r, y + r], fill=GRID + (110,))


def pulse_points(size):
    # línea de pulso: plana, pico, plana, pico grande, plana
    w, h = size, size
    cy = h * 0.56
    amp = h * 0.20
    pts = []
    n = 120
    for i in range(n + 1):
        x = w * 0.10 + (w * 0.80) * (i / n)
        t = i / n
        y = cy
        # dos picos gaussianos
        y -= amp * math.exp(-((t - 0.38) ** 2) / 0.0012)
        y -= amp * 1.5 * math.exp(-((t - 0.62) ** 2) / 0.0009)
        pts.append((x, y))
    return pts


def draw_icon(size, rounded=True, out_name=None):
    img, d = rounded_bg(size) if rounded else (Image.new('RGBA', (size, size), BG_TOP + (255,)), None)
    if not rounded:
        d = ImageDraw.Draw(img)
    draw_grid(d, size)
    pts = pulse_points(size)
    lw = max(3, size // 42)
    # halo
    d.line(pts, fill=PULSE_GLOW + (70,), width=lw * 3, joint='curve')
    d.line(pts, fill=PULSE + (255,), width=lw, joint='curve')
    # punto final brillante
    ex, ey = pts[-1]
    pr = max(4, size // 34)
    d.ellipse([ex - pr * 2, ey - pr * 2, ex + pr * 2, ey + pr * 2], fill=PULSE + (60,))
    d.ellipse([ex - pr, ey - pr, ex + pr, ey + pr], fill=(255, 255, 255, 255))
    img = img.convert('RGB')
    name = out_name or f'icon-{size}.png'
    img.save(os.path.join(OUT, name), 'PNG')
    print('generado', name, f'{size}x{size}')


def main():
    os.makedirs(OUT, exist_ok=True)
    draw_icon(192)
    draw_icon(512)
    draw_icon(512, out_name='icon-maskable-512.png')
    draw_icon(180, out_name='icon-180.png')   # apple-touch-icon
    draw_icon(32, out_name='favicon-32.png')
    print('OK ->', OUT)


if __name__ == '__main__':
    main()
