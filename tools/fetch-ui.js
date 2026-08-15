const https = require('https');
const fs = require('fs');
const path = require('path');

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const port = process.argv[2] || '51951';
const baseUrl = `https://127.0.0.1:${port}`;

function fetchUrl(urlPath) {
  return new Promise((resolve, reject) => {
    const fullUrl = urlPath.startsWith('http') ? urlPath : `${baseUrl}${urlPath.startsWith('/') ? '' : '/'}${urlPath}`;
    https.get(fullUrl, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

async function run() {
  console.log(`Connecting to ${baseUrl}...`);
  try {
    const html = await fetchUrl('/');
    console.log('HTML length:', html.length);
    fs.writeFileSync(path.join(__dirname, 'index.html'), html);

    // Find script tags
    const scriptMatches = [...html.matchAll(/<script[^>]+src=["']([^"']+)["']/g)];
    const scripts = scriptMatches.map(m => m[1]);
    console.log('Found scripts:', scripts);

    const allJs = [];
    for (const src of scripts) {
      console.log(`Fetching script: ${src}...`);
      const js = await fetchUrl(src);
      allJs.push(js);
      fs.writeFileSync(path.join(__dirname, path.basename(src.split('?')[0])), js);
    }

    console.log(`Saved ${scripts.length} script files.`);
  } catch (e) {
    console.error('Fetch error:', e.message);
  }
}

run();
