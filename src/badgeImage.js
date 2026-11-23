// Draws the badge as an image for direct printing from the desktop app.
// 696 dots wide is the printable width of a 62mm Brother roll at 300 dpi;
// 1181 dots tall is 100mm. Keep the layout in step with .badge in styles.css.

const W = 696;
const H = 1181;
const SANS = 'Helvetica, Arial, sans-serif';
const MONO = 'Menlo, Consolas, monospace';

function fit(ctx, text, weight, start, min, maxWidth) {
  let size = start;
  do {
    ctx.font = `${weight} ${size}px ${SANS}`;
    if (ctx.measureText(text).width <= maxWidth) break;
    size -= 4;
  } while (size > min);
  return size;
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('The QR code could not be drawn.'));
    img.src = src;
  });
}

export async function renderBadgePng({ eventName, first, last, ticket, code, qrUrl }) {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#000';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';

  const max = W - 60;
  let y = 50;

  fit(ctx, (eventName || '').toUpperCase(), 700, 40, 26, max);
  ctx.fillText((eventName || '').toUpperCase(), W / 2, y);
  y += 110;

  const firstSize = fit(ctx, first || '', 800, 150, 60, max);
  ctx.fillText(first || '', W / 2, y);
  y += firstSize + 14;

  if (last) {
    const lastSize = fit(ctx, last, 600, 96, 44, max);
    ctx.fillText(last, W / 2, y);
    y += lastSize + 26;
  }

  if (ticket) {
    fit(ctx, ticket, 400, 38, 26, max);
    ctx.fillText(ticket, W / 2, y);
  }

  const qrSize = 400;
  const qrTop = H - qrSize - 110;
  if (qrUrl) {
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(await loadImage(qrUrl), (W - qrSize) / 2, qrTop, qrSize, qrSize);
  }

  ctx.font = `400 28px ${MONO}`;
  ctx.fillText(code || '', W / 2, qrTop + qrSize + 22);

  return canvas.toDataURL('image/png');
}
