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
  template_data = {},
}) {
  if (!html) {
    throw new Error('HTML content is required');
  }

  try {
    // Format Google Fonts URL
    const formattedGoogleFonts = googleFonts
      .split(',')
      .map(font => font.trim())
      .filter(Boolean)
      .map(font => {
        // Ersetze Leerzeichen durch + und entferne spezielle Schriftschnitte in Klammern
        const formattedFont = font.replace(/\s+/g, '+').replace(/\(.*?\)/g, '');
        return formattedFont;
      })
      .join('|');

    const fontLink = formattedGoogleFonts
      ? `<link href="https://fonts.googleapis.com/css2?family=${formattedGoogleFonts}&display=swap" rel="stylesheet">`
      : '';

    // Kompiliere und verarbeite das Template mit Handlebars
    let processedHtml;
    try {
      const template = Handlebars.compile(html);
      processedHtml = template(template_data);
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
          ${fontLink}
          <script src="https://cdn.tailwindcss.com"></script>
          <style>
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            @font-face {
              font-family: 'Segoe UI Emoji';
              src: local('Segoe UI Emoji');
            }
            body {
              font-family: 'Segoe UI Emoji', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            }
            ${googleFonts ? formatFontFaces(googleFonts) : ''}
            ${css}
          </style>
        </head>
        <body>${processedHtml}</body>
      </html>
    `;

    const options = {
      html: fullHtml,
      type: 'png',
      quality: 100,
      waitUntil: renderWhenReady ? 'networkidle0' : 'load',
      puppeteerArgs: {
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--font-render-hinting=none',
        ],
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

    // Zusätzliche Wartezeit für Schriftarten
    options.waitForTimeout = (options.waitForTimeout || 0) + 500;

    const image = await nodeHtmlToImage(options);
    return image;
  } catch (error) {
    console.error('Image generation error:', error);
    throw new Error(`Image generation failed: ${error.message}`);
  }
}
// Hilfsfunktion um @font-face Deklarationen zu generieren
function formatFontFaces(googleFonts) {
  return googleFonts
    .split(',')
    .map(font => {
      const fontName = font.trim().replace(/\(.*?\)/g, '');
      return `
        @font-face {
          font-family: '${fontName}';
          font-display: swap;
          src: local('${fontName}');
        }
      `;
    })
    .join('\n');
}

module.exports = generateImage;
