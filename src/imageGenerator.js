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
  template = null,
  templateData = {}
}) {
  if (!html && !template) {
    throw new Error('Either HTML content or template is required');
  }

  let finalHtml = template 
    ? Handlebars.compile(template)(templateData)
    : html;

  if (!finalHtml.includes('<html')) {
    finalHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          ${googleFonts ? `<link href="https://fonts.googleapis.com/css2?family=${googleFonts.replace(/\s/g, '+')}" rel="stylesheet">` : ''}
          <style>${css}</style>
        </head>
        <body>${finalHtml}</body>
      </html>
    `;
  }

  const options = {
    html: finalHtml,
    waitUntil: renderWhenReady ? 'networkidle0' : 'load',
    transparent: true,
    puppeteerArgs: {
      defaultViewport: viewportWidth && viewportHeight ? {
        width: viewportWidth,
        height: viewportHeight,
        deviceScaleFactor: deviceScale
      } : null
    }
  };

  if (selector) options.selector = selector;
  if (msDelay > 0) options.waitForTimeout = msDelay;
  if (fullScreen) options.fullPage = true;

  try {
    const image = await nodeHtmlToImage(options);
    return image;
  } catch (error) {
    throw new Error(`Image generation failed: ${error.message}`);
  }
}

module.exports = generateImage;
