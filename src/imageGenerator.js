// src/imageGenerator.js
const nodeHtmlToImage = require('node-html-to-image');
const Handlebars = require('handlebars');

async function generateImage({
  html,
  css = '',
  googleFonts = '',
  selector = '',
  msDelay = 0,
  deviceScale = 1,
  renderWhenReady = false,
  fullScreen = false,
  viewportWidth,
  viewportHeight,
  templateData = {}
}) {
  if (!html) {
    throw new Error('HTML content is required');
  }

  // Handlebars Template verarbeiten, falls templateData vorhanden
  if (Object.keys(templateData).length > 0) {
    const template = Handlebars.compile(html);
    html = template(templateData);
  }

  // HTML Dokument erstellen, wenn nur Fragment übergeben wurde
  if (!html.includes('<html')) {
    html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          ${googleFonts ? `<link href="https://fonts.googleapis.com/css2?family=${googleFonts.replace(/\s/g, '+')}" rel="stylesheet">` : ''}
          <style>${css}</style>
        </head>
        <body>${html}</body>
      </html>
    `;
  }

  try {
    const options = {
      html,
      waitUntil: renderWhenReady ? 'networkidle0' : 'load',
      transparent: true,
      type: 'png',
      puppeteerArgs: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      }
    };

    // Viewport Einstellungen
    if (viewportWidth && viewportHeight) {
      options.puppeteerArgs.defaultViewport = {
        width: parseInt(viewportWidth),
        height: parseInt(viewportHeight),
        deviceScaleFactor: parseFloat(deviceScale) || 1
      };
    }

    // Optionale Parameter
    if (selector) options.selector = selector;
    if (msDelay > 0) options.waitForTimeout = msDelay;
    if (fullScreen) options.fullPage = true;

    const image = await nodeHtmlToImage(options);
    return image;
  } catch (error) {
    console.error('Image generation error:', error);
    throw new Error(`Image generation failed: ${error.message}`);
  }
}

module.exports = generateImage;
