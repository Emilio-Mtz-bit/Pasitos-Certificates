import os
import qrcode
from io import BytesIO
from pathlib import Path
from datetime import date

from reportlab.lib.pagesizes import landscape, A4
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor, white, black
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

from dotenv import load_dotenv
from .. import models

load_dotenv()

PURPLE = HexColor("#7B2D8B")
LIGHT_PURPLE = HexColor("#EDE0F0")
GRAY = HexColor("#666666")
DARK = HexColor("#1a1a1a")

W, H = landscape(A4)  # 841.89 x 595.28 pt


def _qr_image(url: str) -> ImageReader:
    qr = qrcode.QRCode(border=1)
    qr.add_data(url)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    buf = BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)
    return ImageReader(buf)


def _draw_rounded_rect(c: canvas.Canvas, x, y, w, h, r, fill_color=None, stroke_color=None):
    path = c.beginPath()
    path.moveTo(x + r, y)
    path.lineTo(x + w - r, y)
    path.arcTo(x + w - 2 * r, y, x + w, y + 2 * r, -90, 90)
    path.lineTo(x + w, y + h - r)
    path.arcTo(x + w - 2 * r, y + h - 2 * r, x + w, y + h, 0, 90)
    path.lineTo(x + r, y + h)
    path.arcTo(x, y + h - 2 * r, x + 2 * r, y + h, 90, 90)
    path.lineTo(x, y + r)
    path.arcTo(x, y, x + 2 * r, y + 2 * r, 180, 90)
    path.close()
    if fill_color:
        c.setFillColor(fill_color)
    if stroke_color:
        c.setStrokeColor(stroke_color)
    c.drawPath(path, fill=1 if fill_color else 0, stroke=1 if stroke_color else 0)


def _format_date(d: date) -> str:
    meses = [
        "", "enero", "febrero", "marzo", "abril", "mayo", "junio",
        "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
    ]
    return f"{d.day} de {meses[d.month]} de {d.year}"


def generar_pdf_certificado(cert: models.Certificate) -> str:
    enr = cert.enrollment
    participant = enr.participant
    course = enr.course

    public_url = os.getenv("PUBLIC_VERIFY_URL", "http://localhost:5173")
    verify_url = f"{public_url}/public?folio={cert.folio_verificacion}"

    storage_dir = Path(__file__).parent.parent.parent / "storage" / "certificates"
    storage_dir.mkdir(parents=True, exist_ok=True)
    pdf_path = storage_dir / f"{cert.no_certificado}.pdf"

    c = canvas.Canvas(str(pdf_path), pagesize=landscape(A4))

    # ── Fondo blanco ────────────────────────────────────────────────────────
    c.setFillColor(white)
    c.rect(0, 0, W, H, fill=1, stroke=0)

    # ── Sidebar izquierdo morado ─────────────────────────────────────────────
    SIDEBAR_W = 72
    c.setFillColor(PURPLE)
    c.rect(0, 0, SIDEBAR_W, H, fill=1, stroke=0)

    # Texto sidebar rotado
    c.saveState()
    c.setFillColor(white)
    c.setFont("Helvetica-Bold", 8)
    sidebar_text = "CAPACITACION QUE TRANSFORMA VIDAS"
    c.translate(SIDEBAR_W / 2, H / 2)
    c.rotate(90)
    c.drawCentredString(0, 0, sidebar_text)
    c.restoreState()

    # Decoración circular en sidebar (ícono abstracto)
    c.setFillColor(HexColor("#9B4DAB"))
    c.circle(SIDEBAR_W / 2, H * 0.72, 22, fill=1, stroke=0)
    c.setFillColor(white)
    c.setFont("Helvetica-Bold", 16)
    c.drawCentredString(SIDEBAR_W / 2, H * 0.72 - 6, "P")

    # ── Línea decorativa superior ────────────────────────────────────────────
    c.setFillColor(LIGHT_PURPLE)
    c.rect(SIDEBAR_W, H - 8, W - SIDEBAR_W, 8, fill=1, stroke=0)

    # ── Recuadro top-right: No. Certificado ─────────────────────────────────
    TOP_RIGHT_X = W - 185
    TOP_RIGHT_Y = H - 110

    c.setFillColor(DARK)
    c.setFont("Helvetica", 7)
    c.drawString(TOP_RIGHT_X, H - 20, "NO. DE CERTIFICADO")

    _draw_rounded_rect(c, TOP_RIGHT_X - 4, H - 50, 170, 24, 12, fill_color=PURPLE)
    c.setFillColor(white)
    c.setFont("Helvetica-Bold", 13)
    c.drawCentredString(TOP_RIGHT_X + 81, H - 41, cert.no_certificado)

    fecha_str = _format_date(cert.fecha_emision) if cert.fecha_emision else "—"
    c.setFillColor(GRAY)
    c.setFont("Helvetica", 8)
    c.drawString(TOP_RIGHT_X - 2, H - 65, f"Emitido el {fecha_str}")
    c.drawString(TOP_RIGHT_X - 2, H - 78, "Zapopan, Jalisco, México")

    # ── Cuerpo central ───────────────────────────────────────────────────────
    CENTER_X = (SIDEBAR_W + TOP_RIGHT_X) / 2 + 10
    y = H - 30

    # Logo "Pasitos" (texto placeholder)
    c.setFillColor(PURPLE)
    c.setFont("Helvetica-Bold", 30)
    c.drawCentredString(CENTER_X, y - 20, "Pasitos")

    c.setFont("Helvetica", 9)
    c.drawCentredString(CENTER_X, y - 38, "EDUCATION & HEALTH A.C.")

    c.setFillColor(GRAY)
    c.setFont("Helvetica", 8)
    c.drawCentredString(CENTER_X, y - 56, "Autorizada por la Secretaria de Trabajo y Previsión Social")

    # Separador delgado
    c.setStrokeColor(LIGHT_PURPLE)
    c.setLineWidth(1.5)
    c.line(CENTER_X - 140, y - 65, CENTER_X + 140, y - 65)

    # Título principal
    c.setFillColor(DARK)
    c.setFont("Helvetica-Bold", 16)
    c.drawCentredString(CENTER_X, y - 85, "CERTIFICADO DE COMPETENCIA LABORAL")

    # Badge "CON VALIDEZ DC-3"
    badge_y = y - 110
    badge_w = 220
    badge_x = CENTER_X - badge_w / 2
    _draw_rounded_rect(c, badge_x, badge_y - 1, badge_w, 17, 8, fill_color=PURPLE)
    c.setFillColor(white)
    c.setFont("Helvetica-Bold", 8)
    c.drawCentredString(CENTER_X, badge_y + 4, "CON VALIDEZ DC-3 CONFORME A LA STPS")

    # "Se certifica que:"
    c.setFillColor(GRAY)
    c.setFont("Helvetica", 9)
    c.drawCentredString(CENTER_X, y - 135, "Se certifica que:")

    # Nombre del participante (grande)
    nombre = participant.nombre_completo
    c.setFillColor(DARK)
    font_size = 28 if len(nombre) < 30 else (22 if len(nombre) < 40 else 18)
    c.setFont("Helvetica-Bold", font_size)
    c.drawCentredString(CENTER_X, y - 168, nombre)

    # CURP
    c.setFillColor(GRAY)
    c.setFont("Helvetica", 9)
    c.drawCentredString(CENTER_X, y - 187, f"CURP:  {participant.curp}")

    # Separador con corazón
    c.setStrokeColor(LIGHT_PURPLE)
    c.setLineWidth(1)
    c.line(CENTER_X - 100, y - 199, CENTER_X - 15, y - 199)
    c.line(CENTER_X + 15, y - 199, CENTER_X + 100, y - 199)
    c.setFillColor(PURPLE)
    c.setFont("Helvetica", 10)
    c.drawCentredString(CENTER_X, y - 204, "♥")

    # Texto previo al curso
    c.setFillColor(GRAY)
    c.setFont("Helvetica", 9)
    c.drawCentredString(CENTER_X, y - 220, "Ha completado satisfactoriamente el programa de capacitación en:")

    # Nombre del curso (grande, morado)
    nombre_curso = course.nombre.upper()
    font_size_curso = 24 if len(nombre_curso) < 25 else (18 if len(nombre_curso) < 35 else 14)
    c.setFillColor(PURPLE)
    c.setFont("Helvetica-Bold", font_size_curso)
    c.drawCentredString(CENTER_X, y - 252, nombre_curso)

    # Modalidad y duración
    modalidad_label = {"presencial": "Presencial", "online": "Online", "presencial_online": "Presencial y Online"}.get(
        course.modalidad.value if hasattr(course.modalidad, "value") else str(course.modalidad), str(course.modalidad)
    )
    c.setFillColor(GRAY)
    c.setFont("Helvetica", 8.5)
    c.drawCentredString(CENTER_X, y - 270, f"Modalidad: {modalidad_label}  ·  Duración: {course.duracion_horas} horas")
    if course.descripcion:
        c.drawCentredString(CENTER_X, y - 283, course.descripcion[:80])

    # ── Círculo decorativo izquierdo (mascota) ───────────────────────────────
    c.setFillColor(LIGHT_PURPLE)
    c.circle(SIDEBAR_W + 65, H * 0.38, 50, fill=1, stroke=0)
    c.setFillColor(HexColor("#C49AD8"))
    c.setFont("Helvetica-Bold", 28)
    c.drawCentredString(SIDEBAR_W + 65, H * 0.38 - 10, "P")

    # ── Firmas ───────────────────────────────────────────────────────────────
    firma_y = 100
    # Firma izquierda
    firma1_x = SIDEBAR_W + 90
    c.setStrokeColor(PURPLE)
    c.setLineWidth(1)
    c.line(firma1_x, firma_y, firma1_x + 140, firma_y)
    c.setFillColor(PURPLE)
    c.setFont("Helvetica-Bold", 8)
    c.drawCentredString(firma1_x + 70, firma_y - 13, "Karla Elizabeth Barba Gómez")
    c.setFillColor(DARK)
    c.setFont("Helvetica", 7.5)
    c.drawCentredString(firma1_x + 70, firma_y - 25, "DIRECTORA GENERAL")
    c.drawCentredString(firma1_x + 70, firma_y - 35, "PASITOS EDUCATION & HEALTH A.C.")

    # Firma central
    firma2_x = CENTER_X - 70
    c.setStrokeColor(PURPLE)
    c.line(firma2_x, firma_y, firma2_x + 140, firma_y)
    c.setFillColor(PURPLE)
    c.setFont("Helvetica-Bold", 8)
    c.drawCentredString(firma2_x + 70, firma_y - 13, "Coordinación Académica")
    c.setFillColor(DARK)
    c.setFont("Helvetica", 7.5)
    c.drawCentredString(firma2_x + 70, firma_y - 25, "RESPONSABLE DE CAPACITACIÓN")
    c.drawCentredString(firma2_x + 70, firma_y - 35, "PASITOS EDUCATION & HEALTH A.C.")

    # ── Recuadro bottom-right: DC-3 + Folio + QR ────────────────────────────
    BOX_X = W - 190
    BOX_W = 180
    BOX_TOP = H - 105

    # Borde del recuadro DC-3
    c.setStrokeColor(PURPLE)
    c.setLineWidth(0.8)
    _draw_rounded_rect(c, BOX_X, 190, BOX_W, BOX_TOP - 190, 6, stroke_color=PURPLE)

    # Ícono DC-3
    c.setFillColor(LIGHT_PURPLE)
    c.roundRect(BOX_X + 8, BOX_TOP - 60, 36, 40, 4, fill=1, stroke=0)
    c.setFillColor(PURPLE)
    c.setFont("Helvetica-Bold", 9)
    c.drawCentredString(BOX_X + 26, BOX_TOP - 38, "DC-3")

    # Texto REGISTRO DC-3
    c.setFillColor(PURPLE)
    c.setFont("Helvetica-Bold", 7.5)
    c.drawString(BOX_X + 52, BOX_TOP - 22, "REGISTRO DC-3")
    c.setFillColor(GRAY)
    c.setFont("Helvetica", 6.5)
    for i, line in enumerate([
        "Este certificado acredita",
        "capacitación conforme a lo",
        "establecido en el Artículo 153",
        "de la Ley Federal del Trabajo.",
    ]):
        c.drawString(BOX_X + 52, BOX_TOP - 34 - i * 9, line)

    # Línea separadora
    c.setStrokeColor(LIGHT_PURPLE)
    c.line(BOX_X + 8, 195, BOX_X + BOX_W - 8, 195)

    # Folio de verificación
    c.setFillColor(PURPLE)
    c.setFont("Helvetica-Bold", 7)
    c.drawString(BOX_X + 8, 185, "FOLIO DE VERIFICACIÓN")

    c.setFont("Helvetica-Bold", 14)
    c.drawString(BOX_X + 8, 168, cert.folio_verificacion)

    # Texto de instrucciones
    c.setFillColor(GRAY)
    c.setFont("Helvetica", 6)
    c.drawString(BOX_X + 8, 155, "Escanea para verificar autenticidad")
    c.drawString(BOX_X + 8, 145, "o ingresa:")
    c.setFillColor(PURPLE)
    c.drawString(BOX_X + 8, 135, f"{public_url}/public")

    # QR code
    qr_img = _qr_image(verify_url)
    qr_size = 78
    c.drawImage(qr_img, BOX_X + BOX_W - qr_size - 8, 120, width=qr_size, height=qr_size)

    # Firma digital (pie)
    c.setFillColor(GRAY)
    c.setFont("Helvetica", 6.5)
    c.drawCentredString(BOX_X + BOX_W / 2, 108, "Documento emitido con firma digital")
    c.drawCentredString(BOX_X + BOX_W / 2, 98, "Protegido contra alteraciones")

    # ── Línea decorativa inferior ────────────────────────────────────────────
    c.setFillColor(LIGHT_PURPLE)
    c.rect(SIDEBAR_W, 0, W - SIDEBAR_W, 6, fill=1, stroke=0)

    c.save()
    return str(pdf_path)
