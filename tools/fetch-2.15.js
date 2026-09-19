const https = require('https');
const fs = require('fs');
const path = require('path');

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const port = process.argv[2] || '63371';
const baseUrl = `https://127.0.0.1:${port}`;

console.log(`Connecting to ${baseUrl}...`);

https.get(baseUrl + '/', (res) => {
  let html = '';
  res.on('data', chunk => html += chunk);
  res.on('end', () => {
    console.log('HTML length:', html.length);
    const outDir = path.join(__dirname, 'upstream_2.15');
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, 'index.html'), html);

    const scriptMatches = [...html.matchAll(/<script[^>]+src=["']([^"']+)["']/g)];
    const scripts = scriptMatches.map(m => m[1]);
    console.log('Found scripts:', scripts);

    if (scripts.length === 0) {
      console.log('No scripts found in HTML');
      process.exit(0);
    }

    let finished = 0;
    for (const src of scripts) {
      const fullUrl = src.startsWith('http') ? src : `${baseUrl}${src.startsWith('/') ? '' : '/'}${src}`;
      console.log(`Downloading ${fullUrl}...`);
      https.get(fullUrl, (sRes) => {
        let sData = '';
        sRes.on('data', c => sData += c);
        sRes.on('end', () => {
          const fname = path.basename(src.split('?')[0]);
          fs.writeFileSync(path.join(outDir, fname), sData);
          console.log(`Saved ${fname} (${sData.length} bytes)`);
          finished++;
          if (finished === scripts.length) {
            console.log('🎉 全部上游 v2.15.0 前端代码资产下载完成！');
            process.exit(0);
          }
        });
      }).on('error', err => {
        console.error('Script fetch failed:', err.message);
        finished++;
        if (finished === scripts.length) process.exit(0);
      });
    }
  });
}).on('error', err => {
  console.error('HTML fetch failed:', err.message);
  process.exit(1);
});
