(function() {
  if (window.__tecnossync_widget) return;
  window.__tecnossync_widget = true;

  var cfg = window.TecnoSyncWidget || {};
  var API = cfg.server || 'https://app.tecnossync.com.do/api';
  var COMPANY = cfg.companyId || '';
  var COLOR = cfg.color || '#6366f1';
  var TITLE = cfg.title || 'Chat con nosotros';
  var SUBTITLE = cfg.subtitle || 'Te respondemos al instante';
  var POSITION = cfg.position || 'right';

  if (!COMPANY) { console.warn('TecnoSyncWidget: companyId requerido'); return; }

  var sessionId = localStorage.getItem('ts_widget_session') || null;
  var convId = localStorage.getItem('ts_widget_conv') || null;
  var open = false;
  var messages = [];

  // ── Estilos ────────────────────────────────────────────
  var style = document.createElement('style');
  style.textContent = `
    #ts-widget-btn{position:fixed;${POSITION}:20px;bottom:20px;width:60px;height:60px;border-radius:50%;background:${COLOR};color:#fff;border:none;cursor:pointer;box-shadow:0 4px 20px rgba(0,0,0,.25);z-index:99999;display:flex;align-items:center;justify-content:center;transition:transform .2s}
    #ts-widget-btn:hover{transform:scale(1.1)}
    #ts-widget-btn svg{width:28px;height:28px}
    #ts-widget-box{position:fixed;${POSITION}:20px;bottom:90px;width:380px;max-width:calc(100vw - 40px);height:520px;max-height:calc(100vh - 120px);background:#0f172a;border-radius:20px;box-shadow:0 8px 40px rgba(0,0,0,.4);z-index:99999;display:none;flex-direction:column;overflow:hidden;font-family:system-ui,-apple-system,sans-serif}
    #ts-widget-box.open{display:flex}
    #ts-widget-header{background:linear-gradient(135deg,${COLOR},${COLOR}dd);padding:18px 20px;display:flex;align-items:center;gap:12px}
    #ts-widget-header .avatar{width:40px;height:40px;border-radius:12px;background:rgba(255,255,255,.2);display:flex;align-items:center;justify-content:center;font-size:18px;color:#fff;font-weight:800;flex-shrink:0}
    #ts-widget-header .info{flex:1}
    #ts-widget-header .title{color:#fff;font-size:14px;font-weight:700;margin:0}
    #ts-widget-header .sub{color:rgba(255,255,255,.7);font-size:11px;margin:2px 0 0}
    #ts-widget-header .close{background:none;border:none;color:rgba(255,255,255,.6);cursor:pointer;padding:4px}
    #ts-widget-header .close:hover{color:#fff}
    #ts-widget-msgs{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:8px}
    .ts-msg{max-width:80%;padding:10px 14px;border-radius:16px;font-size:13px;line-height:1.5;word-wrap:break-word;animation:ts-fade .2s}
    .ts-msg.in{background:#1e293b;color:#e2e8f0;align-self:flex-start;border-bottom-left-radius:4px}
    .ts-msg.out{background:${COLOR};color:#fff;align-self:flex-end;border-bottom-right-radius:4px}
    .ts-msg .time{font-size:10px;opacity:.5;margin-top:4px;display:block}
    #ts-widget-input{display:flex;gap:8px;padding:12px 16px;background:#1e293b;border-top:1px solid #334155}
    #ts-widget-input input{flex:1;background:#0f172a;border:1px solid #334155;color:#e2e8f0;border-radius:12px;padding:10px 14px;font-size:13px;outline:none}
    #ts-widget-input input:focus{border-color:${COLOR}}
    #ts-widget-input input::placeholder{color:#475569}
    #ts-widget-input button{background:${COLOR};color:#fff;border:none;border-radius:12px;padding:10px 14px;cursor:pointer;font-weight:700;font-size:13px;transition:opacity .15s}
    #ts-widget-input button:hover{opacity:.85}
    #ts-widget-input button:disabled{opacity:.4;cursor:not-allowed}
    .ts-typing{align-self:flex-start;display:flex;gap:4px;padding:10px 14px}
    .ts-typing span{width:6px;height:6px;background:#475569;border-radius:50%;animation:ts-bounce .6s infinite}
    .ts-typing span:nth-child(2){animation-delay:.15s}
    .ts-typing span:nth-child(3){animation-delay:.3s}
    @keyframes ts-bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}
    @keyframes ts-fade{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
    #ts-widget-badge{position:absolute;top:-4px;right:-4px;width:18px;height:18px;background:#ef4444;border-radius:50%;font-size:10px;color:#fff;display:none;align-items:center;justify-content:center;font-weight:700}
  `;
  document.head.appendChild(style);

  // ── HTML ────────────────────────────────────────────────
  var btn = document.createElement('button');
  btn.id = 'ts-widget-btn';
  btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg><div id="ts-widget-badge">0</div>';
  document.body.appendChild(btn);

  var box = document.createElement('div');
  box.id = 'ts-widget-box';
  box.innerHTML = '<div id="ts-widget-header"><div class="avatar">💬</div><div class="info"><p class="title">' + TITLE + '</p><p class="sub">' + SUBTITLE + '</p></div><button class="close" id="ts-close"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" d="M6 18L18 6M6 6l12 12"/></svg></button></div><div id="ts-widget-msgs"></div><div id="ts-widget-input"><input id="ts-input" type="text" placeholder="Escribe tu mensaje..." autocomplete="off"><button id="ts-send">Enviar</button></div>';
  document.body.appendChild(box);

  var msgsEl  = document.getElementById('ts-widget-msgs');
  var inputEl = document.getElementById('ts-input');
  var sendBtn = document.getElementById('ts-send');

  // ── Funciones ──────────────────────────────────────────
  function addMsg(text, dir, time) {
    var d = document.createElement('div');
    d.className = 'ts-msg ' + dir;
    d.innerHTML = text + (time ? '<span class="time">' + time + '</span>' : '');
    msgsEl.appendChild(d);
    msgsEl.scrollTop = msgsEl.scrollHeight;
  }

  function showTyping() {
    var t = document.createElement('div');
    t.className = 'ts-typing';
    t.id = 'ts-typing';
    t.innerHTML = '<span></span><span></span><span></span>';
    msgsEl.appendChild(t);
    msgsEl.scrollTop = msgsEl.scrollHeight;
  }

  function hideTyping() {
    var t = document.getElementById('ts-typing');
    if (t) t.remove();
  }

  function fmtTime(d) {
    var dt = new Date(d);
    return dt.getHours().toString().padStart(2,'0') + ':' + dt.getMinutes().toString().padStart(2,'0');
  }

  async function initSession() {
    try {
      var res = await fetch(API + '/widget/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company_id: COMPANY, session_id: sessionId }),
      });
      var data = await res.json();
      if (data.success) {
        sessionId = data.data.session_id;
        convId    = data.data.conversation_id;
        localStorage.setItem('ts_widget_session', sessionId);
        localStorage.setItem('ts_widget_conv', convId);
        await loadHistory();
      }
    } catch (e) { console.error('TecnoSync widget init error:', e); }
  }

  async function loadHistory() {
    if (!convId) return;
    try {
      var res = await fetch(API + '/widget/messages/' + convId);
      var data = await res.json();
      if (data.success && data.data) {
        msgsEl.innerHTML = '';
        data.data.forEach(function(m) {
          addMsg(m.content, m.direction === 'inbound' ? 'out' : 'in', fmtTime(m.created_at));
        });
      }
    } catch (_) {}
    if (!msgsEl.children.length) {
      addMsg('¡Hola! 👋 ¿En qué te podemos ayudar?', 'in');
    }
  }

  async function sendMessage() {
    var text = inputEl.value.trim();
    if (!text) return;
    inputEl.value = '';
    sendBtn.disabled = true;
    addMsg(text, 'out', fmtTime(new Date()));

    if (!convId) await initSession();

    showTyping();
    try {
      var res = await fetch(API + '/widget/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversation_id: convId, session_id: sessionId, text: text }),
      });
      var data = await res.json();
      hideTyping();
      if (data.success && data.data.botReply) {
        addMsg(data.data.botReply.content, 'in', fmtTime(data.data.botReply.created_at));
      }
    } catch (e) {
      hideTyping();
      addMsg('Error de conexión. Intenta de nuevo.', 'in');
    }
    sendBtn.disabled = false;
    inputEl.focus();
  }

  // ── Eventos ────────────────────────────────────────────
  btn.onclick = function() {
    open = !open;
    box.classList.toggle('open', open);
    if (open && !convId) initSession();
    if (open) inputEl.focus();
  };

  document.getElementById('ts-close').onclick = function() {
    open = false;
    box.classList.remove('open');
  };

  sendBtn.onclick = sendMessage;
  inputEl.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  });
})();
