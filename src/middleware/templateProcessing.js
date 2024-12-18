// src/middleware/templateProcessing.js
function processTemplateRequest(req, res, next) {
  // Prüfe ob der Request verarbeitet werden soll
  const needsProcessing = req.headers['x-process-template'] === 'true';

  if (needsProcessing && req.body) {
    // Rekursive Funktion um verschachtelte Objekte zu verarbeiten
    const processValue = value => {
      if (typeof value === 'string') {
        // Replace escaped handlebars syntax
        return (
          value
            .replace(/\\{\\{(\w+)\\}\\}/g, '{{$1}}')
            .replace(/\\\{\\\{(\w+)\\\}\\\}/g, '{{$1}}')
            .replace(/\{\{\{(\w+)\}\}\}/g, '{{$1}}')
            // Newlines
            .replace(/\\n/g, '\n')
            // Quotes
            .replace(/\\"/g, '"')
            // Backslashes
            .replace(/\\\\/g, '\\')
        );
      }
      if (typeof value === 'object' && value !== null) {
        return Array.isArray(value)
          ? value.map(processValue)
          : Object.fromEntries(Object.entries(value).map(([k, v]) => [k, processValue(v)]));
      }
      return value;
    };

    // Verarbeite den gesamten Request Body
    req.body = processValue(req.body);
    console.log('Processed template request:', req.body);
  }

  next();
}

module.exports = processTemplateRequest;
