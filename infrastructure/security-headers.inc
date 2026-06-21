add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
add_header Content-Security-Policy   "default-src 'self'; script-src 'self' https://connect.facebook.net; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self'; connect-src 'self' wss: https://graph.facebook.com; frame-src https://www.facebook.com; frame-ancestors 'self'; form-action 'self'; base-uri 'self'; object-src 'none'" always;
add_header X-Frame-Options           "SAMEORIGIN" always;
add_header X-Content-Type-Options    "nosniff" always;
add_header Referrer-Policy           "strict-origin-when-cross-origin" always;
add_header Permissions-Policy        "camera=(), microphone=(), geolocation=(), payment=()" always;
