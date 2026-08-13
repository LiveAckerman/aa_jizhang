#!/usr/bin/env python3
"""
生成微信小程序 tabBar 图标（线性风格 PNG）
不使用 emoji，纯几何绘制。
普通态：灰色 #8091a5    选中态：品牌色 #4097a9
输出尺寸 81x81（微信推荐）
"""
from PIL import Image, ImageDraw
import os

SIZE = 162  # 2x 绘制后缩放，抗锯齿更好
OUT_DIR = os.path.join(os.path.dirname(__file__), '..', 'packages', 'miniapp', 'assets', 'tabbar')
os.makedirs(OUT_DIR, exist_ok=True)

NORMAL = (128, 145, 165, 255)   # #8091a5
ACTIVE = (64, 151, 169, 255)    # #4097a9
LINE_W = 9


def new_canvas():
    img = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
    return img, ImageDraw.Draw(img)


def save(img, name):
    final = img.resize((81, 81), Image.LANCZOS)
    path = os.path.join(OUT_DIR, name)
    final.save(path)
    print(f'saved {path}')


def draw_book(color):
    """账本图标：一本翻开的书"""
    img, d = new_canvas()
    # 书本轮廓（圆角矩形）
    d.rounded_rectangle([36, 40, 126, 122], radius=12, outline=color, width=LINE_W)
    # 中间书脊
    d.line([81, 46, 81, 116], fill=color, width=LINE_W)
    return img


def draw_chart(color):
    """统计图标：柱状图"""
    img, d = new_canvas()
    # 三根高度不同的柱子
    d.rounded_rectangle([40, 90, 62, 126], radius=6, outline=color, width=LINE_W)
    d.rounded_rectangle([70, 62, 92, 126], radius=6, outline=color, width=LINE_W)
    d.rounded_rectangle([100, 44, 122, 126], radius=6, outline=color, width=LINE_W)
    return img


def draw_user(color):
    """我的图标：人形"""
    img, d = new_canvas()
    # 头部
    d.ellipse([61, 38, 101, 78], outline=color, width=LINE_W)
    # 身体（半圆肩部）
    d.arc([46, 86, 116, 150], start=180, end=360, fill=color, width=LINE_W)
    return img


ICONS = {
    'book': draw_book,
    'chart': draw_chart,
    'user': draw_user,
}

for name, fn in ICONS.items():
    save(fn(NORMAL), f'{name}.png')
    save(fn(ACTIVE), f'{name}-active.png')

print('tabBar icons generated.')
