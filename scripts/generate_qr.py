#!/usr/bin/env python3
"""Generate QR poster (PDF A4) and standalone QR (PNG 1024) for taipan-tkd.ru.

Run from repo root:  python scripts/generate_qr.py
Outputs:
  frontend/public/qr-cabinet.png  (1024x1024 PNG)
  frontend/public/qr-cabinet.pdf  (A4 poster)
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

import qrcode
from PIL import Image
from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas

URL = "https://taipan-tkd.ru"

REPO_ROOT = Path(__file__).resolve().parent.parent
FONTS_DIR = REPO_ROOT / "scripts" / "fonts"
OUT_DIR = REPO_ROOT / "frontend" / "public"
PNG_PATH = OUT_DIR / "qr-cabinet.png"
PDF_PATH = OUT_DIR / "qr-cabinet.pdf"

BLACK = HexColor("#080808")
RED = HexColor("#CC0000")
GRAY_DIM = HexColor("#6B6B6B")
WHITE = HexColor("#FFFFFF")


def register_fonts() -> dict[str, str]:
    """Register TTFs from scripts/fonts/. If absent — fall back to Helvetica."""
    wanted = {
        "BebasNeue": "BebasNeue-Regular.ttf",
        "BarlowCondensed-Bold": "BarlowCondensed-Bold.ttf",
        "Barlow": "Barlow-Regular.ttf",
    }
    resolved: dict[str, str] = {}
    missing: list[str] = []

    for alias, fname in wanted.items():
        fpath = FONTS_DIR / fname
        if fpath.exists():
            try:
                pdfmetrics.registerFont(TTFont(alias, str(fpath)))
                resolved[alias] = alias
            except Exception as e:
                print(f"WARNING: failed to register {alias}: {e}", file=sys.stderr)
                missing.append(fname)
        else:
            missing.append(fname)

    if missing:
        print(
            "WARNING: используется Helvetica вместо Bebas Neue — "
            f"для точного дизайна положите шрифты в {FONTS_DIR.relative_to(REPO_ROOT)}/:",
            file=sys.stderr,
        )
        for m in missing:
            print(f"   missing: {m}", file=sys.stderr)
        print(
            "Источники (SIL OFL, свободные):\n"
            "  https://fonts.google.com/specimen/Bebas+Neue\n"
            "  https://fonts.google.com/specimen/Barlow+Condensed\n"
            "  https://fonts.google.com/specimen/Barlow",
            file=sys.stderr,
        )
        # Fallbacks: built-in Helvetica family
        resolved.setdefault("BebasNeue", "Helvetica-Bold")
        resolved.setdefault("BarlowCondensed-Bold", "Helvetica-Bold")
        resolved.setdefault("Barlow", "Helvetica")

    return resolved


def make_qr_png() -> None:
    """1024x1024 QR PNG, EC=M, modules colored #080808 on white."""
    qr = qrcode.QRCode(
        version=None,
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=10,
        border=4,
    )
    qr.add_data(URL)
    qr.make(fit=True)
    img = qr.make_image(fill_color="#080808", back_color="#FFFFFF").convert("RGB")
    img = img.resize((1024, 1024), Image.Resampling.NEAREST)
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    img.save(PNG_PATH, format="PNG", optimize=True)


def make_pdf(fonts: dict[str, str]) -> None:
    """A4 poster: title, red rule, subtitle, QR, 3 steps, footer."""
    page_w, page_h = A4  # 595 x 842 pt

    c = canvas.Canvas(str(PDF_PATH), pagesize=A4)

    # White background (default — but explicit)
    c.setFillColor(WHITE)
    c.rect(0, 0, page_w, page_h, fill=1, stroke=0)

    # ── Header ──────────────────────────────────────────────────────────
    title_font = fonts["BebasNeue"]
    sub_font = fonts["BarlowCondensed-Bold"]
    body_font = fonts["Barlow"]

    # Title
    title_size = 52
    title_y = page_h - 32 * mm
    c.setFillColor(BLACK)
    c.setFont(title_font, title_size)
    c.drawCentredString(page_w / 2, title_y, "ЛИЧНЫЙ КАБИНЕТ РОДИТЕЛЯ")

    # Red rule
    rule_w = 60 * mm
    rule_y = title_y - 8 * mm
    c.setStrokeColor(RED)
    c.setLineWidth(2)
    c.line(page_w / 2 - rule_w / 2, rule_y, page_w / 2 + rule_w / 2, rule_y)

    # Subtitle
    sub_size = 22
    sub_y = rule_y - 14 * mm
    c.setFillColor(RED)
    c.setFont(sub_font, sub_size)
    c.drawCentredString(page_w / 2, sub_y, "КЛУБ ТХЭКВОНДО «ТАЙПАН»", charSpace=2)

    # ── QR code ─────────────────────────────────────────────────────────
    qr_size = 100 * mm
    qr_x = (page_w - qr_size) / 2
    qr_y = sub_y - 14 * mm - qr_size
    c.drawImage(
        str(PNG_PATH),
        qr_x,
        qr_y,
        width=qr_size,
        height=qr_size,
        preserveAspectRatio=True,
        mask="auto",
    )

    # ── Three steps ─────────────────────────────────────────────────────
    steps = [
        ("1", "НАВЕДИТЕ КАМЕРУ ТЕЛЕФОНА НА QR-КОД"),
        ("2", "ОТКРОЙТЕ ССЫЛКУ В БРАУЗЕРЕ"),
        ("3", 'ОТКРОЙТЕ МЕНЮ И НАЖМИТЕ «УСТАНОВИТЬ ПРИЛОЖЕНИЕ»'),
    ]
    step_num_size = 36
    step_text_size = 14
    step_left = 35 * mm
    step_text_x = step_left + 16 * mm
    step_gap = 4 * mm

    cursor_y = qr_y - 12 * mm
    for num, text in steps:
        # Number — Bebas Neue, red
        c.setFillColor(RED)
        c.setFont(title_font, step_num_size)
        num_baseline_y = cursor_y - step_num_size * 0.78  # approx top-of-cap baseline
        c.drawString(step_left, num_baseline_y, num)

        # Text — Barlow, black, vertically centred against the number cap
        c.setFillColor(BLACK)
        c.setFont(body_font, step_text_size)
        # offset text baseline so its cap-line aligns with number's cap-line
        text_baseline_y = num_baseline_y + (step_num_size * 0.7 - step_text_size * 0.7) / 2
        c.drawString(step_text_x, text_baseline_y, text)

        cursor_y = num_baseline_y - step_gap

    # ── Footer ──────────────────────────────────────────────────────────
    footer_y = 20 * mm
    c.setFillColor(GRAY_DIM)
    c.setFont(sub_font, 18)
    c.drawCentredString(page_w / 2, footer_y, "TAIPAN-TKD.RU", charSpace=3)

    c.showPage()
    c.save()


def main() -> int:
    fonts = register_fonts()
    using_real = all(v == k for k, v in fonts.items())

    print("Generating QR PNG...")
    make_qr_png()
    png_size = PNG_PATH.stat().st_size
    with Image.open(PNG_PATH) as im:
        png_dims = im.size
    print(f"   {PNG_PATH.relative_to(REPO_ROOT)}  {png_dims[0]}x{png_dims[1]}  {png_size/1024:.1f} KB")

    print("Generating PDF poster...")
    make_pdf(fonts)
    pdf_size = PDF_PATH.stat().st_size
    print(f"   {PDF_PATH.relative_to(REPO_ROOT)}  A4  {pdf_size/1024:.1f} KB")

    if using_real:
        print("Fonts: BebasNeue / BarlowCondensed-Bold / Barlow (project fonts)")
    else:
        print("Fonts: Helvetica fallback in effect for some entries — see warnings above")

    return 0


if __name__ == "__main__":
    sys.exit(main())
