const https = require('https');

https.get('https://sip.ranksitt.net/vup/Sources/core.min.js', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('Total core size:', data.length);
    const urls = data.match(/"\/[a-zA-Z0-9_\-\/]+"/g) || [];
    const endpoints = Array.from(new Set(urls.filter(u => u.toLowerCase().includes('api') || u.toLowerCase().includes('login') || u.toLowerCase().includes('session'))));
    console.log('Endpoints in core:', endpoints.slice(0, 30));
  });
}).on('error', err => console.error(err));
