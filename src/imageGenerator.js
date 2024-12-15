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
  template_data = {}, // Änderung hier: template_data statt templateData
  templateData = {}, // Behalte alte Variable für Kompatibilität
}) {
  if (!html) {
    throw new Error('HTML content is required');
  }

  try {
    // Nutze entweder template_data oder templateData
    const data = template_data || templateData;

    console.log('Processing template with data:', data); // Debug-Log

    // Kompiliere und verarbeite das Template mit Handlebars
    let processedHtml = html;
    try {
      const template = Handlebars.compile(html);
      processedHtml = template(data);
      console.log('Processed HTML:', processedHtml); // Debug-Log
    } catch (error) {
      console.error('Template processing error:', error);
      throw new Error(`Template processing failed: ${error.message}`);
    }

    // Erstelle vollständiges HTML-Dokument
    const fullHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          ${googleFonts ? `<link href="https://fonts.googleapis.com/css2?family=${googleFonts.replace(/\s/g, '+')}" rel="stylesheet">` : ''}
          <script src="https://cdn.tailwindcss.com"></script>
          <style>
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            ${css}
          </style>
        </head>
        <body>${processedHtml}</body>
      </html>
    `;

    console.log('Generating image with options:', {
      templateVariables: Object.keys(data),
      viewport:
        viewportWidth && viewportHeight
          ? { width: viewportWidth, height: viewportHeight }
          : undefined,
      selector,
      delay: msDelay,
      fullPage: fullScreen,
    });

    const options = {
      html: fullHtml,
      type: 'png',
      quality: 100,
      waitUntil: renderWhenReady ? 'networkidle0' : 'load',
      puppeteerArgs: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
      },
    };

    if (viewportWidth && viewportHeight) {
      options.puppeteerArgs.defaultViewport = {
        width: parseInt(viewportWidth, 10),
        height: parseInt(viewportHeight, 10),
        deviceScaleFactor: parseFloat(deviceScale) || 1,
      };
    }

    if (selector) options.selector = selector;
    if (msDelay > 0) options.waitForTimeout = msDelay;
    if (fullScreen) options.fullPage = true;

    options.waitForTimeout = (options.waitForTimeout || 0) + 100;

    const image = await nodeHtmlToImage(options);
    return image;
  } catch (error) {
    console.error('Image generation error:', error);
    throw new Error(`Image generation failed: ${error.message}`);
  }
}

module.exports = generateImage;
