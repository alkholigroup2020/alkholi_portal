// Renders a card's QR code as a PNG buffer, optionally with a centered logo.
function createQrRenderer({ QRCode, createCanvas, loadImage }) {
  return async function renderQr({ text, size, foreground, background, logo }) {
    const canvas = createCanvas(size, size)
    await QRCode.toCanvas(canvas, text, {
      color: { dark: foreground, light: background },
      margin: 2,
      width: size,
      errorCorrectionLevel: 'M',
    })
    if (logo) {
      const image = await loadImage(logo)
      const logoSize = size / 4
      const offset = (size - logoSize) / 2
      canvas
        .getContext('2d')
        .drawImage(image, offset, offset, logoSize, logoSize)
    }
    return canvas.toBuffer('image/png')
  }
}

module.exports = { createQrRenderer }
