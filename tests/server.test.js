// 1. Template erstellen
async function createTemplate() {
  const template = {
    html: `
      <div class="flex min-h-screen bg-gray-100 items-center justify-center p-4">
        <div class="bg-white rounded-lg shadow-xl p-6 max-w-md w-full">
          <h1 class="text-2xl font-bold text-gray-800">{{title}}</h1>
          <p class="text-gray-600 mt-2">{{description}}</p>
          {{#if imageUrl}}
            <img src="{{imageUrl}}" class="mt-4 rounded-lg shadow-md w-full">
          {{/if}}
          <div class="mt-4 text-sm text-gray-500">
            Posted by {{author}} on {{date}}
          </div>
        </div>
      </div>
    `,
    name: "Blog Post Card",
    description: "Template for blog post social sharing images",
    viewport_width: 1200,
    viewport_height: 630,
    device_scale: 2,
  };

  const response = await fetch("http://localhost:3000/v1/template", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(template),
  });

  return response.json();
}

// 2. Bild aus Template generieren
async function generateImage(templateId) {
  const templateValues = {
    title: "Introducing Our New Feature",
    description:
      "A revolutionary way to create social sharing images with templates and variables.",
    // imageUrl: "https://example.com/feature-preview.jpg",
    author: "John Doe",
    date: new Date().toLocaleDateString(),
  };

  const response = await fetch(`http://localhost:3000/v1/image/${templateId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ template_values: templateValues }),
  });

  return response.json();
}

// Nutzung
createTemplate()
  .then((template) => generateImage(template.template_id))
  .then((image) => console.log("Generated image:", image.url))
  .catch(console.error);
