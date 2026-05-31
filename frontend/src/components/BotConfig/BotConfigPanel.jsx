import { useState, useRef, useCallback, useEffect } from "react";
import {
  Brain, Paperclip, Play, Save, Power, Upload,
  FileText, FileSpreadsheet, Image, File, Trash2,
  CheckCircle, AlertCircle, Loader, Clock
} from "lucide-react";

const PLACEHOLDER = `Eres Sofia, asistente virtual de Mi Empresa. Tu rol es atender clientes con calidez y eficiencia.

PERSONALIDAD:
- Tono amigable y profesional
- Respuestas breves y claras
- Comunicacion clara y directa

SERVICIOS Y TARIFAS:
Plan Basico: $49/mes - hasta 2 agentes, 1 canal
  archivo: plan_basico.pdf

Plan Pro: $99/mes - hasta 10 agentes, 3 canales + bot IA
  archivo: plan_pro.pdf

REGLAS:
- No dar precios sin escuchar primero que necesita el cliente
- Si no sabes algo: "En breve un asesor te dara esa informacion"

HORARIO: Lunes a Viernes 8am - 6pm
CONTACTO: info@miempresa.com | +1 809-000-0000`;

const TOKEN = () => localStorage.getItem("token");

const FileIcon = ({ type = "" }) => {
  const props = { size: 15, strokeWidth: 1.5 };
  if (type.includes("pdf"))                               return <FileText {...props} />;
  if (type.includes("word") || type.includes("document")) return <FileText {...props} />;
  if (type.includes("sheet") || type.includes("excel"))   return <FileSpreadsheet {...props} />;
  if (type.includes("image"))                             return <Image {...props} />;
  return <File {...props} />;
};

export default function BotConfigPanel() {
  const [instrucciones, setInstrucciones] = useState("");
  const [archivos, setArchivos]           = useState([]);
  const [nuevos, setNuevos]               = useState([]);
  const [botActivo, setBotActivo]         = useState(true);
  const [saving, setSaving]               = useState(false);
  const [saved, setSaved]                 = useState(false);
  const [dragOver, setDragOver]           = useState(false);
  const [testing, setTesting]             = useState(false);
  const [testMsg, setTestMsg]             = useState("");
  const [testResp, setTestResp]           = useState("");
  const [loading, setLoading]             = useState(true);
  const [configId, setConfigId]           = useState(null);
  const fileInputRef = useRef();

  useEffect(() => {
    const load = async () => {
      try {
        const res  = await fetch("/api/bot-configs/active", {
          headers: { Authorization: `Bearer ${TOKEN()}` }
        });
        const data = await res.json();
        if (data.success && data.data) {
          setConfigId(data.data.id);
          setInstrucciones(data.data.system_prompt || "");
          setBotActivo(data.data.is_active ?? true);
          setArchivos(data.data.archivos || []);
        }
      } catch (e) {
        console.error("Error cargando config:", e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const processFiles = useCallback((fileList) => {
    const items = Array.from(fileList).map((f) => ({
      id:     crypto.randomUUID(),
      file:   f,
      nombre: f.name,
      size:   (f.size / 1024).toFixed(0),
      type:   f.type,
    }));
    setNuevos((prev) => {
      const nombres = new Set(prev.map((a) => a.nombre));
      return [...prev, ...items.filter((a) => !nombres.has(a.nombre))];
    });
  }, []);

  const onDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    processFiles(e.dataTransfer.files);
  };

  const removeNuevo   = (id) => setNuevos((prev) => prev.filter((a) => a.id !== id));
  const removeArchivo = async (nombre) => {
    try {
      await fetch(`/api/bot-files/${encodeURIComponent(nombre)}`, {
        method: "DELETE", headers: { Authorization: `Bearer ${TOKEN()}` }
      });
      setArchivos((prev) => prev.filter((a) => a.nombre !== nombre));
    } catch (e) { console.error(e); }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const formData = new FormData();
      formData.append("system_prompt", instrucciones);
      formData.append("is_active",     botActivo);
      formData.append("name",          "Mi Asistente IA");
      nuevos.forEach((a) => formData.append("archivos", a.file, a.nombre));

      const url    = configId ? `/api/bot-configs/${configId}` : "/api/bot-configs";
      const method = configId ? "PUT" : "POST";

      const res  = await fetch(url, { method, headers: { Authorization: `Bearer ${TOKEN()}` }, body: formData });
      const data = await res.json();

      if (data.success) {
        if (!configId && data.data?.id) setConfigId(data.data.id);
        const r2 = await fetch("/api/bot-configs/active", { headers: { Authorization: `Bearer ${TOKEN()}` } });
        const d2 = await r2.json();
        setArchivos(d2.data?.archivos || []);
        setNuevos([]);
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    if (!testMsg.trim() || !instrucciones.trim()) return;
    setTesting(true);
    setTestResp("");
    try {
      const res  = await fetch("/api/bot-configs/test", {
        method:  "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${TOKEN()}` },
        body:    JSON.stringify({ instrucciones, mensaje: testMsg }),
      });
      const data = await res.json();
      setTestResp(data.respuesta || data.data?.response || "Sin respuesta");
    } catch {
      setTestResp("Error al conectar con el bot.");
    } finally {
      setTesting(false);
    }
  };

  if (loading) return (
    <div style={{ padding: "3rem", textAlign: "center", color: "#9ca3af", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
      <Loader size={16} style={{ animation: "spin 1s linear infinite" }} />
      Cargando configuracion...
      <style>{`@keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }`}</style>
    </div>
  );

  const todosLosArchivos = [
    ...archivos,
    ...nuevos.map((n) => ({ nombre: n.nombre, size: n.size * 1024, type: n.type, nuevo: true, id: n.id }))
  ];

  return (
    <div style={s.wrap}>
      <style>{`@keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }`}</style>

      {/* HEADER */}
      <div style={s.header}>
        <div>
          <h1 style={s.title}>Configuracion del bot</h1>
          <p style={s.sub}>Define como responde tu asistente automatico</p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div onClick={() => setBotActivo(!botActivo)} style={{ ...s.toggle, background: botActivo ? "#16a34a" : "#d1d5db" }}>
              <div style={{ ...s.toggleThumb, left: botActivo ? 20 : 3 }} />
            </div>
            <span style={{ fontSize: 13, color: botActivo ? "#16a34a" : "#9ca3af", fontWeight: 500, display: "flex", alignItems: "center", gap: 4 }}>
              <Power size={13} strokeWidth={2} />
              {botActivo ? "Bot activo" : "Bot pausado"}
            </span>
          </div>
          <button onClick={handleSave} disabled={saving} style={{ ...s.btnSave, opacity: saving ? 0.7 : 1, display: "flex", alignItems: "center", gap: 6 }}>
            {saving
              ? <><Loader size={13} style={{ animation: "spin 1s linear infinite" }} /> Guardando...</>
              : saved
              ? <><CheckCircle size={13} /> Guardado</>
              : <><Save size={13} /> Guardar</>
            }
          </button>
        </div>
      </div>

      {/* DOS COLUMNAS */}
      <div style={s.cols}>

        {/* COLUMNA IZQUIERDA: INSTRUCCIONES */}
        <div style={s.card}>
          <div style={s.cardHeader}>
            <div style={s.iconBox}><Brain size={16} strokeWidth={1.5} color="#6b7280" /></div>
            <div>
              <div style={s.cardTitle}>Instrucciones</div>
              <div style={s.cardSub}>
                Personalidad, servicios, tarifas y reglas.
                Usa <code style={s.code}>archivo: nombre.pdf</code> para vincular archivos.
              </div>
            </div>
          </div>
          <textarea
            value={instrucciones}
            onChange={(e) => setInstrucciones(e.target.value)}
            placeholder={PLACEHOLDER}
            style={s.bigTextarea}
          />
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
            <span style={s.hint}>{instrucciones.length} caracteres</span>
            <span style={s.hint}>Mas detalle = mejores respuestas</span>
          </div>
        </div>

        {/* COLUMNA DERECHA: ARCHIVOS */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

          <div style={s.card}>
            <div style={s.cardHeader}>
              <div style={s.iconBox}><Paperclip size={16} strokeWidth={1.5} color="#6b7280" /></div>
              <div>
                <div style={s.cardTitle}>Archivos</div>
                <div style={s.cardSub}>
                  El nombre debe coincidir con lo escrito en las instrucciones.
                </div>
              </div>
            </div>

            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              onClick={() => fileInputRef.current.click()}
              style={{ ...s.dropZone, ...(dragOver ? s.dropActive : {}) }}
            >
              <Upload size={18} strokeWidth={1.5} color="#9ca3af" style={{ marginBottom: 6 }} />
              <p style={{ fontSize: 13, fontWeight: 500, color: "#374151", margin: 0 }}>
                Arrastra o haz clic para subir
              </p>
              <p style={{ fontSize: 11, color: "#9ca3af", margin: "3px 0 0" }}>
                PDF, Word, Excel, Imagenes — max 10MB
              </p>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
                style={{ display: "none" }}
                onChange={(e) => processFiles(e.target.files)}
              />
            </div>

            <div style={{ marginTop: 10 }}>
              {todosLosArchivos.length === 0 && (
                <p style={{ fontSize: 12, color: "#9ca3af", textAlign: "center", padding: "0.5rem 0" }}>
                  No hay archivos cargados
                </p>
              )}
              {todosLosArchivos.map((a) => (
                <div key={a.id || a.nombre} style={s.fileRow}>
                  <span style={{ color: "#6b7280", flexShrink: 0 }}><FileIcon type={a.type} /></span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 500, color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {a.nombre}
                    </div>
                    <div style={{ fontSize: 11, color: "#9ca3af", display: "flex", alignItems: "center", gap: 3, marginTop: 1 }}>
                      {a.nuevo
                        ? <><Clock size={9} /> Pendiente</>
                        : `${((a.size || 0) / 1024).toFixed(0)} KB`
                      }
                    </div>
                  </div>
                  {instrucciones.includes(a.nombre)
                    ? <span style={s.badgeOk}><CheckCircle size={10} /> OK</span>
                    : <span style={s.badgeWarn}><AlertCircle size={10} /> Sin vincular</span>
                  }
                  <button onClick={() => a.nuevo ? removeNuevo(a.id) : removeArchivo(a.nombre)} style={s.btnRemove}>
                    <Trash2 size={13} strokeWidth={1.5} />
                  </button>
                </div>
              ))}
            </div>

            {nuevos.length > 0 && (
              <p style={{ fontSize: 11, color: "#3b82f6", marginTop: 6 }}>
                {nuevos.length} archivo(s) pendiente(s) — guarda para subirlos.
              </p>
            )}
          </div>

          {/* PROBAR BOT */}
          <div style={s.card}>
            <div style={s.cardHeader}>
              <div style={s.iconBox}><Play size={16} strokeWidth={1.5} color="#6b7280" /></div>
              <div>
                <div style={s.cardTitle}>Probar bot</div>
                <div style={s.cardSub}>Verifica las instrucciones antes de guardar</div>
              </div>
            </div>

            <div style={{ display: "flex", gap: 6 }}>
              <input
                type="text"
                value={testMsg}
                onChange={(e) => setTestMsg(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleTest()}
                placeholder="Escribe una pregunta..."
                style={{ ...s.input, flex: 1 }}
              />
              <button
                onClick={handleTest}
                disabled={testing || !instrucciones.trim()}
                style={{ ...s.btnTest, opacity: (!instrucciones.trim() || testing) ? 0.5 : 1, display: "flex", alignItems: "center", gap: 5 }}
              >
                {testing ? <Loader size={12} style={{ animation: "spin 1s linear infinite" }} /> : <Play size={12} />}
                {testing ? "..." : "Enviar"}
              </button>
            </div>

            {!instrucciones.trim() && (
              <p style={{ fontSize: 11, color: "#b45309", marginTop: 6 }}>
                Escribe las instrucciones primero.
              </p>
            )}

            {testResp && (
              <div style={s.testResp}>
                <span style={{ fontSize: 11, color: "#6b7280", display: "block", marginBottom: 4, fontWeight: 500 }}>
                  Respuesta del bot:
                </span>
                <p style={{ fontSize: 13, color: "#111827", margin: 0, lineHeight: 1.6 }}>{testResp}</p>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}

const s = {
  wrap:        { fontFamily: "'Inter', system-ui, sans-serif", maxWidth: 1100, margin: "0 auto", padding: "1.25rem 1rem", color: "#111827" },
  header:      { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1rem", flexWrap: "wrap", gap: 10 },
  title:       { fontSize: 18, fontWeight: 700, margin: 0 },
  sub:         { fontSize: 13, color: "#6b7280", margin: "3px 0 0" },
  cols:        { display: "grid", gridTemplateColumns: "1fr 380px", gap: 12, alignItems: "start" },
  card:        { background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: "1rem 1.1rem" },
  cardHeader:  { display: "flex", gap: 10, alignItems: "flex-start", marginBottom: "0.75rem" },
  iconBox:     { width: 30, height: 30, borderRadius: 7, background: "#f3f4f6", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  cardTitle:   { fontSize: 14, fontWeight: 600, color: "#111827" },
  cardSub:     { fontSize: 11, color: "#6b7280", marginTop: 2, lineHeight: 1.5 },
  code:        { background: "#f3f4f6", padding: "1px 5px", borderRadius: 3, fontSize: 10, fontFamily: "monospace", color: "#374151" },
  hint:        { fontSize: 11, color: "#9ca3af" },
  bigTextarea: { width: "100%", fontSize: 13, padding: "10px 12px", border: "1px solid #d1d5db", borderRadius: 8, color: "#111827", background: "#fafafa", resize: "vertical", fontFamily: "'Courier New', monospace", lineHeight: 1.6, boxSizing: "border-box", outline: "none", height: "calc(100vh - 260px)", minHeight: 320, maxHeight: 700 },
  dropZone:    { border: "1.5px dashed #d1d5db", borderRadius: 8, padding: "1rem", textAlign: "center", cursor: "pointer", transition: "all 0.15s", display: "flex", flexDirection: "column", alignItems: "center" },
  dropActive:  { borderColor: "#3b82f6", background: "#eff6ff" },
  fileRow:     { display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", background: "#f9fafb", borderRadius: 7, marginBottom: 5, border: "1px solid #f3f4f6" },
  badgeOk:     { fontSize: 10, padding: "2px 6px", borderRadius: 20, background: "#dcfce7", color: "#16a34a", fontWeight: 500, whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 3 },
  badgeWarn:   { fontSize: 10, padding: "2px 6px", borderRadius: 20, background: "#fef9c3", color: "#b45309", fontWeight: 500, whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 3 },
  btnRemove:   { color: "#9ca3af", background: "none", border: "none", cursor: "pointer", padding: "3px 5px", display: "flex", alignItems: "center", borderRadius: 5, flexShrink: 0 },
  input:       { fontSize: 13, padding: "8px 10px", border: "1px solid #d1d5db", borderRadius: 7, color: "#111827", background: "#fafafa", outline: "none" },
  btnTest:     { fontSize: 12, fontWeight: 600, color: "#fff", background: "#3b82f6", border: "none", borderRadius: 7, padding: "8px 14px", cursor: "pointer", whiteSpace: "nowrap" },
  testResp:    { marginTop: 10, background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 7, padding: "10px 12px" },
  toggle:      { width: 42, height: 24, borderRadius: 20, cursor: "pointer", position: "relative", transition: "background 0.2s", flexShrink: 0 },
  toggleThumb: { position: "absolute", width: 18, height: 18, borderRadius: "50%", background: "#fff", top: 3, transition: "left 0.2s" },
  btnSave:     { fontSize: 13, fontWeight: 600, color: "#fff", background: "#16a34a", border: "none", borderRadius: 8, padding: "8px 18px", cursor: "pointer" },
};