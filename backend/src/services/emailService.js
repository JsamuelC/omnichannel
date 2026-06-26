const https = require('https');
const logger = require('../config/logger');

// ── Zoho OAuth2 token manager ─────────────────────────────────────────────────
let _cachedToken   = null;
let _tokenExpiry   = 0;

async function getZohoToken() {
  if (_cachedToken && Date.now() < _tokenExpiry) return _cachedToken;

  const refreshToken  = process.env.ZOHO_REFRESH_TOKEN;
  const clientId      = process.env.ZOHO_CLIENT_ID;
  const clientSecret  = process.env.ZOHO_CLIENT_SECRET;

  if (!refreshToken || !clientId || !clientSecret) {
    logger.warn('⚠️  Zoho OAuth credentials no configuradas');
    return null;
  }

  const body = `refresh_token=${refreshToken}&client_id=${clientId}&client_secret=${clientSecret}&grant_type=refresh_token`;

  return new Promise((resolve) => {
    const req = https.request({
      hostname: 'accounts.zoho.com',
      path:     '/oauth/v2/token',
      method:   'POST',
      headers: {
        'Content-Type':   'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(body),
      },
    }, (res) => {
      let data = '';
      res.on('data', c => { data += c; });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.access_token) {
            _cachedToken  = json.access_token;
            _tokenExpiry  = Date.now() + (json.expires_in - 60) * 1000;
            logger.info('🔑 Zoho token renovado');
            resolve(_cachedToken);
          } else {
            logger.error('❌ Zoho refresh error:', data);
            resolve(null);
          }
        } catch (e) { resolve(null); }
      });
    });
    req.on('error', (e) => { logger.error('❌ Zoho refresh request error:', e.message); resolve(null); });
    req.write(body);
    req.end();
  });
}

// ── Zoho Mail send ────────────────────────────────────────────────────────────
async function zohoSend({ to, subject, html }) {
  const token     = await getZohoToken();
  const from      = process.env.SMTP_FROM || process.env.SMTP_USER;
  const accountId = process.env.ZOHO_ACCOUNT_ID;

  if (!token || !from || !accountId) {
    logger.warn('⚠️  Zoho no configurado — email omitido');
    return false;
  }

  const body = JSON.stringify({ fromAddress: from, toAddress: to, subject, content: html, mailFormat: 'html' });

  return new Promise((resolve) => {
    const req = https.request({
      hostname: 'mail.zoho.com',
      path:     `/api/accounts/${accountId}/messages`,
      method:   'POST',
      headers: {
        'Authorization':  `Zoho-oauthtoken ${token}`,
        'Content-Type':   'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    }, (res) => {
      let data = '';
      res.on('data', c => { data += c; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(true);
        } else {
          logger.error(`❌ Zoho API ${res.statusCode}: ${data}`);
          // Si el token expiró forzar renovación en próxima llamada
          if (res.statusCode === 401) _tokenExpiry = 0;
          resolve(false);
        }
      });
    });
    req.on('error', (e) => { logger.error('❌ Zoho send error:', e.message); resolve(false); });
    req.write(body);
    req.end();
  });
}

// ── Layout base ───────────────────────────────────────────────────────────────
function baseLayout(content) {
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0f172a;font-family:'Segoe UI',Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;padding:40px 16px">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#1e293b;border-radius:16px;overflow:hidden;border:1px solid #334155">
        <tr>
          <td style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:32px;text-align:center">
            <h1 style="color:#fff;margin:0;font-size:24px;font-weight:800;letter-spacing:-0.5px">Tecnossync</h1>
            <p style="color:rgba(255,255,255,0.8);margin:4px 0 0;font-size:13px">Plataforma Omnicanal</p>
          </td>
        </tr>
        ${content}
        <tr>
          <td style="background:#0f172a;padding:20px 32px;text-align:center">
            <p style="color:#475569;font-size:11px;margin:0">© ${new Date().getFullYear()} Tecnossync. Todos los derechos reservados.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ── Funciones públicas ────────────────────────────────────────────────────────

async function sendPasswordReset(toEmail, resetLink, userName, type = 'password_reset') {
  const isEmailChange = type === 'email_change';
  const content = `
    <tr><td style="padding:40px 32px">
      <h2 style="color:#f1f5f9;font-size:20px;margin:0 0 8px;font-weight:700">
        ${isEmailChange ? 'Confirma tu nuevo correo' : 'Recuperación de contraseña'}
      </h2>
      ${userName ? `<p style="color:#94a3b8;font-size:14px;margin:0 0 20px">Hola <strong style="color:#e2e8f0">${userName}</strong>,</p>` : ''}
      <p style="color:#94a3b8;font-size:14px;line-height:1.6;margin:0 0 24px">
        ${isEmailChange
          ? 'Recibimos una solicitud para cambiar el correo de tu cuenta. El enlace expira en <strong style="color:#e2e8f0">24 horas</strong>.'
          : 'Recibimos una solicitud para restablecer tu contraseña. El enlace expira en <strong style="color:#e2e8f0">1 hora</strong>.'}
      </p>
      <table cellpadding="0" cellspacing="0" style="margin:0 auto 24px">
        <tr>
          <td style="background:${isEmailChange ? '#0ea5e9' : '#6366f1'};border-radius:10px">
            <a href="${resetLink}" style="display:inline-block;padding:14px 32px;color:#fff;text-decoration:none;font-weight:700;font-size:15px">
              ${isEmailChange ? 'Confirmar nuevo correo' : 'Restablecer contraseña'}
            </a>
          </td>
        </tr>
      </table>
      <p style="color:#64748b;font-size:12px;text-align:center;margin:0 0 8px">Si el botón no funciona, copia este enlace:</p>
      <p style="background:#0f172a;border-radius:8px;padding:10px 14px;font-size:11px;color:#6366f1;word-break:break-all;margin:0">${resetLink}</p>
      <hr style="border:none;border-top:1px solid #334155;margin:28px 0">
      <p style="color:#475569;font-size:12px;margin:0">Si no solicitaste este cambio, ignora este correo.</p>
    </td></tr>`;

  const ok = await zohoSend({
    to: toEmail,
    subject: isEmailChange ? 'Confirma tu nuevo correo — Tecnossync' : 'Recuperación de contraseña — Tecnossync',
    html: baseLayout(content),
  });
  if (ok) logger.info(`📧 Email recuperación enviado a: ${toEmail}`);
  else logger.error(`❌ Error enviando email recuperación a: ${toEmail}`);
  return ok;
}

async function sendLoginOTP({ toEmail, userName, otp }) {
  const codeBlocks = otp.split('').map(d =>
    `<span style="display:inline-block;width:44px;height:56px;line-height:56px;text-align:center;font-size:26px;font-weight:900;color:#fff;background:linear-gradient(135deg,#6366f1,#8b5cf6);border-radius:12px;margin:0 4px">${d}</span>`
  ).join('');

  const content = `
    <tr><td style="padding:44px 36px">
      <h2 style="color:#f1f5f9;font-size:20px;margin:0 0 6px;font-weight:800">Tu código de verificación</h2>
      ${userName ? `<p style="color:#94a3b8;font-size:14px;margin:0 0 28px">Hola <strong style="color:#e2e8f0">${userName}</strong>, alguien está intentando iniciar sesión en tu cuenta.</p>` : ''}
      <div style="text-align:center;padding:28px 0;background:#0f172a;border-radius:16px;margin:0 0 28px;border:1px solid #1e3a5f">
        <p style="color:#64748b;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin:0 0 18px">CÓDIGO OTP</p>
        <div>${codeBlocks}</div>
        <p style="color:#475569;font-size:12px;margin:18px 0 0">⏱ Expira en <strong style="color:#a5b4fc">10 minutos</strong></p>
      </div>
      <div style="background:#1e293b;border:1px solid #334155;border-left:4px solid #f59e0b;border-radius:10px;padding:16px 18px;margin-bottom:20px">
        <p style="color:#fbbf24;font-size:12px;font-weight:700;margin:0 0 6px">⚠️ Aviso de seguridad</p>
        <p style="color:#94a3b8;font-size:12px;line-height:1.6;margin:0">Si no fuiste tú, ignora este correo y cambia tu contraseña.</p>
      </div>
      <p style="color:#475569;font-size:12px;margin:0;text-align:center">Nunca compartas este código con nadie.</p>
    </td></tr>`;

  const ok = await zohoSend({
    to: toEmail,
    subject: `${otp} es tu código de acceso — Tecnossync`,
    html: baseLayout(content),
  });
  if (ok) logger.info(`🔐 OTP enviado a: ${toEmail}`);
  else logger.error(`❌ Error enviando OTP a: ${toEmail}`);
  return ok;
}

async function sendWelcomeEmail({ toEmail, userName, companyName, password, verificationCode }) {
  const codeBlocks = verificationCode.split('').map(d =>
    `<span style="display:inline-block;width:40px;height:50px;line-height:50px;text-align:center;font-size:24px;font-weight:900;color:#fff;background:#6366f1;border-radius:10px;margin:0 4px">${d}</span>`
  ).join('');

  const content = `
    <tr><td style="padding:40px 32px">
      <h2 style="color:#f1f5f9;font-size:22px;margin:0 0 6px;font-weight:800">¡Bienvenido/a a Tecnossync, ${userName}! 🎉</h2>
      <p style="color:#94a3b8;font-size:14px;margin:0 0 28px;line-height:1.6">
        Tu cuenta ha sido creada correctamente${companyName ? ` en la empresa <strong style="color:#e2e8f0">${companyName}</strong>` : ''}.
      </p>
      <div style="background:#0f172a;border-radius:12px;padding:20px 24px;margin-bottom:28px;border:1px solid #334155">
        <p style="color:#64748b;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;margin:0 0 12px">TUS DATOS DE ACCESO</p>
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr><td style="padding:6px 0;color:#64748b;font-size:13px;width:110px">Correo:</td><td style="padding:6px 0;color:#a5b4fc;font-size:13px;font-weight:600">${toEmail}</td></tr>
          <tr><td style="padding:6px 0;color:#64748b;font-size:13px">Contraseña:</td><td style="padding:6px 0;color:#e2e8f0;font-size:13px;font-weight:600;font-family:monospace">${password}</td></tr>
        </table>
      </div>
      <div style="text-align:center;margin-bottom:28px">
        <p style="color:#94a3b8;font-size:13px;margin:0 0 16px">Código de verificación para activar tu cuenta:</p>
        <div style="margin:0 auto">${codeBlocks}</div>
        <p style="color:#475569;font-size:11px;margin:16px 0 0">⏱ Expira en <strong style="color:#e2e8f0">24 horas</strong>.</p>
      </div>
      <hr style="border:none;border-top:1px solid #334155;margin:28px 0">
      <p style="color:#475569;font-size:12px;margin:0">Si no esperabas esta cuenta, ignora este correo.</p>
    </td></tr>`;

  const ok = await zohoSend({
    to: toEmail,
    subject: `¡Bienvenido/a a Tecnossync, ${userName}! — Verifica tu cuenta`,
    html: baseLayout(content),
  });
  if (ok) logger.info(`📧 Email bienvenida enviado a: ${toEmail}`);
  else logger.error(`❌ Error enviando email bienvenida a: ${toEmail}`);
  return ok;
}

const METHOD_LABELS = {
  bank_transfer: 'Transferencia bancaria', cash: 'Efectivo', card: 'Tarjeta',
  mobile_payment: 'Pago móvil', check: 'Cheque', paypal: 'PayPal', other: 'Otro',
};

async function sendPaymentConfirmation({ toEmail, companyName, amount, currency, paymentMethod, referenceNumber, paymentDate, periodCovered, nextPaymentDate, nextAmount }) {
  const rows = [
    ['Empresa', companyName],
    ['Monto pagado', `$${Number(amount).toFixed(2)} ${currency || 'USD'}`],
    ['Método de pago', METHOD_LABELS[paymentMethod] || paymentMethod],
    referenceNumber ? ['Referencia / ID', referenceNumber] : null,
    ['Fecha de pago', paymentDate],
    periodCovered ? ['Período cubierto', periodCovered] : null,
    nextPaymentDate ? ['Próximo pago', nextPaymentDate] : null,
    nextAmount ? ['Monto próximo', `$${Number(nextAmount).toFixed(2)} ${currency || 'USD'}`] : null,
  ].filter(Boolean);

  const tableRows = rows.map(([label, value]) => `
    <tr>
      <td style="padding:10px 16px;color:#64748b;font-size:13px;border-bottom:1px solid #1e293b;width:160px">${label}</td>
      <td style="padding:10px 16px;color:#e2e8f0;font-size:13px;font-weight:600;border-bottom:1px solid #1e293b">${value}</td>
    </tr>`).join('');

  const content = `
    <tr><td style="padding:44px 36px">
      <div style="text-align:center;margin-bottom:28px">
        <div style="display:inline-block;width:56px;height:56px;line-height:56px;text-align:center;font-size:28px;background:linear-gradient(135deg,#059669,#10b981);border-radius:16px;margin-bottom:16px">✓</div>
        <h2 style="color:#f1f5f9;font-size:22px;margin:0 0 6px;font-weight:800">Pago confirmado</h2>
        <p style="color:#94a3b8;font-size:14px;margin:0">Hemos recibido tu pago correctamente.</p>
      </div>

      <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;border-radius:12px;overflow:hidden;border:1px solid #334155;margin-bottom:24px">
        ${tableRows}
      </table>

      ${nextPaymentDate ? `
      <div style="background:#1e293b;border:1px solid #334155;border-left:4px solid #6366f1;border-radius:10px;padding:16px 18px;margin-bottom:20px">
        <p style="color:#a5b4fc;font-size:12px;font-weight:700;margin:0 0 6px">📅 Próxima fecha de pago</p>
        <p style="color:#e2e8f0;font-size:14px;font-weight:800;margin:0">${nextPaymentDate}${nextAmount ? ` — $${Number(nextAmount).toFixed(2)} ${currency || 'USD'}` : ''}</p>
      </div>` : ''}

      <p style="color:#475569;font-size:12px;margin:0;text-align:center">
        Este es un comprobante automático generado por Tecnossync.<br>
        Si tienes alguna duda, contacta a tu administrador.
      </p>
    </td></tr>`;

  const ok = await zohoSend({
    to: toEmail,
    subject: `✅ Pago confirmado — $${Number(amount).toFixed(2)} ${currency || 'USD'} — Tecnossync`,
    html: baseLayout(content),
  });
  if (ok) logger.info(`💰 Email confirmación de pago enviado a: ${toEmail}`);
  else logger.error(`❌ Error enviando confirmación de pago a: ${toEmail}`);
  return ok;
}

async function sendReminderEmail({ toEmail, contactName, companyName, date, time, title, timeLabel }) {
  const content = `
    <tr><td style="padding:44px 36px">
      <div style="text-align:center;margin-bottom:28px">
        <div style="display:inline-block;width:56px;height:56px;line-height:56px;text-align:center;font-size:28px;background:linear-gradient(135deg,#6366f1,#8b5cf6);border-radius:16px;margin-bottom:16px">📅</div>
        <h2 style="color:#f1f5f9;font-size:22px;margin:0 0 6px;font-weight:800">Recordatorio de cita</h2>
        <p style="color:#94a3b8;font-size:14px;margin:0">Faltan ${timeLabel} para tu cita</p>
      </div>
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;border-radius:12px;overflow:hidden;border:1px solid #334155;margin-bottom:24px">
        <tr><td style="padding:10px 16px;color:#64748b;font-size:13px;border-bottom:1px solid #1e293b;width:120px">Cliente</td><td style="padding:10px 16px;color:#e2e8f0;font-size:13px;font-weight:600;border-bottom:1px solid #1e293b">${contactName}</td></tr>
        <tr><td style="padding:10px 16px;color:#64748b;font-size:13px;border-bottom:1px solid #1e293b">Fecha</td><td style="padding:10px 16px;color:#e2e8f0;font-size:13px;font-weight:600;border-bottom:1px solid #1e293b">${date}</td></tr>
        <tr><td style="padding:10px 16px;color:#64748b;font-size:13px;border-bottom:1px solid #1e293b">Hora</td><td style="padding:10px 16px;color:#e2e8f0;font-size:13px;font-weight:600;border-bottom:1px solid #1e293b">${time}</td></tr>
        ${title ? `<tr><td style="padding:10px 16px;color:#64748b;font-size:13px">Motivo</td><td style="padding:10px 16px;color:#e2e8f0;font-size:13px;font-weight:600">${title}</td></tr>` : ''}
      </table>
      <p style="color:#475569;font-size:12px;margin:0;text-align:center">Este es un recordatorio automático de ${companyName}.</p>
    </td></tr>`;

  const ok = await zohoSend({
    to: toEmail,
    subject: `📅 Recordatorio: cita en ${timeLabel} — ${companyName}`,
    html: baseLayout(content),
  });
  if (ok) logger.info(`📧 Recordatorio enviado a: ${toEmail}`);
  return ok;
}

module.exports = { sendPasswordReset, sendWelcomeEmail, sendLoginOTP, sendPaymentConfirmation, sendReminderEmail };
