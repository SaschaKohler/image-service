# HTML to Image Service

A production-ready service for converting HTML/CSS to images with template support.

## Features

- HTML/CSS to Image conversion
- Template support with variables
- Tailwind CSS integration
- Basic Auth security
- Rate limiting
- Multiple image formats support

## Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/image-service.git
cd image-service

# Install dependencies
npm install

# Configure environment variables
cp .env.example .env
# Edit .env with your settings
```

## Environment Variables

```env
API_USER=your_username
API_KEY=your_secure_api_key
PORT=3000
NODE_ENV=production
BASE_URL=https://your-domain.com
ALLOWED_ORIGINS=https://your-app.com
```

## Development

```bash
# Run in development mode
npm run dev

# Run tests
npm test

# Lint code
npm run lint

# Format code
npm run format
```

## API Usage

### Generate Image

```bash
curl -X POST https://your-domain.com/v1/image \
  -u "your_username:your_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "html": "<div>Hello World</div>",
    "css": ".box { color: blue; }"
  }'
```

### Create Template

```bash
curl -X POST https://your-domain.com/v1/template \
  -u "your_username:your_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "html": "<div>{{message}}</div>",
    "name": "Simple Template"
  }'
```

## Deployment

The service uses GitHub Actions for automated deployment. Required secrets:

- `SERVER_HOST`: Your server's hostname
- `SERVER_USER`: SSH username
- `SSH_PRIVATE_KEY`: SSH private key for authentication

## License

MIT

## Support

For support, email office@sascha-kohler.at
