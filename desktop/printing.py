"""
Direct printing to a Brother QL-820NWB over the network.

Takes a finished badge image, converts it to the printer's own format and
sends it to the printer's address. No driver and no print dialog.
"""
import base64
import io
import socket
import time

from PIL import Image

# brother_ql still refers to a name that newer Pillow versions removed.
if not hasattr(Image, "ANTIALIAS"):
    Image.ANTIALIAS = Image.LANCZOS

from brother_ql.conversion import convert  # noqa: E402
from brother_ql.raster import BrotherQLRaster  # noqa: E402

MODEL = "QL-820NWB"
PORT = 9100
WIDTH = 696  # Printable dots across a 62mm roll at 300 dpi.

# Roll loaded in the printer -> (label type, print black and red)
ROLLS = {
    "2205": ("62", False),  # DK-2205, black on white, 62mm continuous
    "2251": ("62red", True),  # DK-2251, black and red on white, 62mm continuous
}
ROLL_NAMES = {
    "2205": "DK-2205 black on white (62mm)",
    "2251": "DK-2251 black and red (62mm)",
}


class PrintError(Exception):
    """A problem the person at the station can act on. The message is shown as is."""


def image_from_data_url(data_url):
    try:
        encoded = data_url.split(",", 1)[1] if data_url.startswith("data:") else data_url
        return Image.open(io.BytesIO(base64.b64decode(encoded)))
    except Exception as exc:
        raise PrintError("The badge image could not be read.") from exc


def prepare(image):
    """Flatten onto white and scale to the roll's printable width."""
    image = image.convert("RGBA")
    flat = Image.new("RGB", image.size, "white")
    flat.paste(image, mask=image.split()[3])
    if flat.width != WIDTH:
        flat = flat.resize((WIDTH, max(1, round(flat.height * WIDTH / flat.width))), Image.LANCZOS)
    return flat


def build_job(image, roll):
    if roll not in ROLLS:
        raise PrintError("Choose the roll type in the printer settings.")
    label, two_color = ROLLS[roll]
    raster = BrotherQLRaster(MODEL)
    raster.exception_on_warning = True
    return convert(
        qlr=raster,
        images=[prepare(image)],
        label=label,
        rotate="0",
        threshold=70.0,
        dither=False,
        compress=False,
        red=two_color,
        dpi_600=False,
        hq=True,
        cut=True,
    )


def _status_problem(frame):
    """Turn a 32-byte printer status frame into a message, or None if it reports no error."""
    if len(frame) < 32 or frame[0] != 0x80 or frame[1] != 0x20 or frame[18] != 0x02:
        return None
    e1, e2 = frame[8], frame[9]
    if e2 & 0x01:
        return "The roll in the printer does not match the roll type in the printer settings."
    if e1 & 0x01 or e1 & 0x02 or e2 & 0x40:
        return "The printer is out of labels or the roll is not loaded correctly."
    if e2 & 0x10:
        return "The printer cover is open."
    if e1 & 0x04:
        return "The printer's cutter is jammed."
    return "The printer reported an error. Check the message on its screen."


def send_job(job, ip, attempts=2):
    """
    Send a job. Returns True when the printer confirmed it printed, False when the
    job was delivered but the printer sent no confirmation.
    """
    last = None
    for attempt in range(attempts):
        try:
            with socket.create_connection((ip, PORT), timeout=5) as sock:
                sock.settimeout(15)
                sock.sendall(job)
                # Best effort: listen briefly for the printer's own verdict.
                sock.settimeout(1.5)
                deadline = time.time() + 6
                buffer = b""
                while time.time() < deadline:
                    try:
                        chunk = sock.recv(64)
                    except socket.timeout:
                        continue
                    if not chunk:
                        break
                    buffer += chunk
                    while len(buffer) >= 32:
                        frame, buffer = buffer[:32], buffer[32:]
                        problem = _status_problem(frame)
                        if problem:
                            raise PrintError(problem)
                        if frame[0] == 0x80 and frame[18] == 0x01:
                            return True
                return False
        except PrintError:
            raise
        except (socket.timeout, OSError) as exc:
            last = exc
            if attempt + 1 < attempts:
                time.sleep(2)
    raise PrintError(
        "Could not reach the printer. Check that it is on, showing its ready screen, "
        "on the same network as this computer, and that the address in the printer settings is right."
    ) from last


def print_image(image, ip, roll):
    if not ip:
        raise PrintError("Enter the printer's address in the printer settings.")
    return send_job(build_job(image, roll), ip)


def test_image(roll):
    from PIL import ImageDraw, ImageFont

    def font(size):
        try:
            return ImageFont.load_default(size=size)
        except TypeError:
            return ImageFont.load_default()

    two_color = ROLLS.get(roll, ("", False))[1]
    accent = (255, 0, 0) if two_color else (0, 0, 0)
    img = Image.new("RGB", (WIDTH, 600), "white")
    d = ImageDraw.Draw(img)
    d.rectangle([0, 0, WIDTH - 1, 90], fill=accent)
    for y, text, size, fill in ((22, "NC EMS EXPO", 44, "white"), (200, "Test print", 110, "black"), (360, ROLL_NAMES.get(roll, ""), 36, "black"), (440, "Printer and roll settings are correct.", 32, accent)):
        f = font(size)
        box = d.textbbox((0, 0), text, font=f)
        d.text(((WIDTH - (box[2] - box[0])) / 2, y), text, font=f, fill=fill)
    d.rectangle([4, 4, WIDTH - 5, 595], outline="black", width=4)
    return img
