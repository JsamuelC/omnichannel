const logger = require('../config/logger');

const VARIABLE_REGEX = /\{([a-z0-9_]+)\}/g;

const KNOWN_SOURCES = {
  nombre_cliente: { source: 'contact', field: 'name' },
  cliente_nombre: { source: 'contact', field: 'name' },
  telefono:       { source: 'contact', field: 'phone' },
  cliente_telefono: { source: 'contact', field: 'phone' },
  email:          { source: 'contact', field: 'email' },
  cliente_email:  { source: 'contact', field: 'email' },
  fecha:          { source: 'system',  field: 'date' },
  fecha_actual:   { source: 'system',  field: 'date' },
  hora:           { source: 'system',  field: 'time' },
  hora_actual:    { source: 'system',  field: 'time' },
};

class MergeService {

  extractVariables(contenido) {
    if (!contenido) return [];
    const matches = new Set();
    let match;
    while ((match = VARIABLE_REGEX.exec(contenido)) !== null) {
      matches.add(match[1]);
    }
    return Array.from(matches);
  }

  merge(contenido, datos) {
    if (!contenido) return { resultado: '', variablesSinValor: [] };

    const variables = this.extractVariables(contenido);
    const variablesSinValor = [];

    let resultado = contenido;
    for (const v of variables) {
      const valor = datos[v];
      if (valor === undefined || valor === null || valor === '') {
        variablesSinValor.push(v);
      } else {
        resultado = resultado.replace(
          new RegExp(`\\{${v}\\}`, 'g'),
          String(valor)
        );
      }
    }

    return { resultado, variablesSinValor };
  }

  validate(contenido, datos) {
    const variables = this.extractVariables(contenido);
    const faltantes = variables.filter(
      v => datos[v] === undefined || datos[v] === null || datos[v] === ''
    );
    return {
      valid: faltantes.length === 0,
      total: variables.length,
      proporcionadas: variables.length - faltantes.length,
      faltantes,
    };
  }

  resolveContactData(contact) {
    return {
      nombre_cliente: contact?.name || '',
      telefono:       contact?.phone || contact?.whatsapp_id || '',
      email:          contact?.email || '',
      fecha:          new Date().toLocaleDateString('es-DO', { year: 'numeric', month: 'long', day: 'numeric' }),
    };
  }

  resolveSystemData() {
    const now = new Date();
    return {
      date: now.toLocaleDateString('es-DO', { year: 'numeric', month: 'long', day: 'numeric' }),
      time: now.toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit' }),
    };
  }

  suggestMapping(variables) {
    const mapping = {};
    for (const v of variables) {
      const known = KNOWN_SOURCES[v];
      if (known) {
        mapping[v] = { source: known.source, field: known.field };
      } else {
        mapping[v] = { source: 'chatbot', field: v };
      }
    }
    return mapping;
  }

  resolveAllData({ contact, conversation, collectedFields, mapping }) {
    const systemData = this.resolveSystemData();
    const datos = {};

    const contactFields = {
      name:  contact?.name || '',
      phone: contact?.phone || contact?.whatsapp_id || '',
      email: contact?.email || '',
    };
    const contactMeta = contact?.metadata || {};
    const convMeta = conversation?.metadata || {};
    const chatbotData = collectedFields || {};

    for (const [variable, config] of Object.entries(mapping || {})) {
      const src = config.source;
      const field = config.field;

      if (src === 'contact') {
        datos[variable] = contactFields[field] || contactMeta[field] || '';
      } else if (src === 'system') {
        datos[variable] = systemData[field] || '';
      } else if (src === 'conversation') {
        datos[variable] = convMeta[field] || '';
      } else if (src === 'chatbot') {
        datos[variable] = chatbotData[field] || '';
      } else if (src === 'static') {
        datos[variable] = config.value || '';
      }
    }

    return datos;
  }

  async autoMerge(template, { contact, conversation, collectedFields }) {
    const mapping = template.variable_mapping || this.suggestMapping(template.variables || []);
    const datos = this.resolveAllData({ contact, conversation, collectedFields, mapping });
    const { resultado, variablesSinValor } = this.merge(template.contenido, datos);
    const validacion = this.validate(template.contenido, datos);

    return {
      resultado,
      variablesSinValor,
      validacion,
      datosResueltos: datos,
      mapping,
    };
  }
}

module.exports = new MergeService();
