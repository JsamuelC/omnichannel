const logger = require('../config/logger');
const { sendLoginOTP } = require('./emailService');

let _intervalId = null;

async function checkReminders() {
  try {
    const { Appointment, BusinessSchedule } = require('../models');
    const Company = require('../models/Company');
    const { Op } = require('sequelize');

    const now = new Date();

    const schedules = await BusinessSchedule.findAll({
      where: { is_active: true },
      attributes: ['company_id'],
      group: ['company_id'],
      raw: true,
    });

    for (const sched of schedules) {
      const companyId = sched.company_id;
      if (!companyId) continue;

      const company = await Company.findByPk(companyId, { attributes: ['id', 'nombre', 'telefono', 'email'] });
      if (!company) continue;

      const upcoming = await Appointment.findAll({
        where: {
          company_id: companyId,
          status: { [Op.in]: ['pending', 'confirmed'] },
          date: { [Op.gte]: now.toISOString().slice(0, 10) },
        },
        order: [['date', 'ASC'], ['start_time', 'ASC']],
      });

      for (const appt of upcoming) {
        const apptDateTime = new Date(`${appt.date}T${appt.start_time}:00`);
        const diffMs = apptDateTime - now;
        const diffHours = diffMs / (1000 * 60 * 60);
        const diffDays = diffHours / 24;

        const meta = (typeof appt.metadata === 'object' && appt.metadata) ? appt.metadata : {};
        const sent = meta.reminders_sent || {};
        let changed = false;

        // 3 días antes
        if (diffDays <= 3 && diffDays > 2 && !sent['3d']) {
          await sendReminder(appt, company, '3 días');
          sent['3d'] = new Date().toISOString();
          changed = true;
        }
        // 1 día antes
        if (diffDays <= 1 && diffDays > 0.5 && !sent['1d']) {
          await sendReminder(appt, company, '1 día');
          sent['1d'] = new Date().toISOString();
          changed = true;
        }
        // 2 horas antes
        if (diffHours <= 2 && diffHours > 0 && !sent['2h']) {
          await sendReminder(appt, company, '2 horas');
          sent['2h'] = new Date().toISOString();
          changed = true;
        }

        if (changed) {
          await appt.update({ metadata: { ...meta, reminders_sent: sent } });
          logger.info(`⏰ Recordatorio marcado para ${appt.contact_name} (${appt.date})`);
        }
      }
    }
  } catch (err) {
    logger.error('Reminder check error:', err.message);
  }
}

async function sendReminder(appointment, company, timeLabel) {
  const { sendPaymentConfirmation } = require('./emailService');
  const notificationService = require('./notificationService');

  const contactPhone = appointment.contact_phone;
  const contactEmail = appointment.contact_email;
  const reminderConfig = appointment.metadata?.reminder_config || { whatsapp: true, email: true };

  const msg = `📅 Recordatorio de cita\n\nHola ${appointment.contact_name}, te recordamos tu cita en ${company.nombre}:\n\n📆 Fecha: ${appointment.date}\n⏰ Hora: ${appointment.start_time}\n📋 ${appointment.title || 'Cita programada'}\n\nFaltan ${timeLabel} para tu cita.`;

  // Enviar por WhatsApp si está habilitado y hay teléfono
  if (reminderConfig.whatsapp && contactPhone) {
    try {
      const whatsappService = require('./whatsappService');
      const sessions = whatsappService.getAllSessions();
      const businessSession = sessions.find(s => s.sessionType === 'business' && s.status === 'connected');
      if (businessSession) {
        const jid = contactPhone.replace(/[^0-9]/g, '') + '@s.whatsapp.net';
        const sock = whatsappService.getSession(businessSession.sessionId)?.sock;
        if (sock) {
          await sock.sendMessage(jid, { text: msg });
          logger.info(`📱 Recordatorio WA enviado a ${contactPhone} (${timeLabel})`);
        }
      }
    } catch (e) {
      logger.warn('Reminder WA error:', e.message);
    }
  }

  // Enviar por email si está habilitado
  if (reminderConfig.email && contactEmail) {
    try {
      const { zohoSend, baseLayout } = require('./emailService');
      // Usar zohoSend directamente si está disponible, si no crear contenido simple
      const emailService = require('./emailService');
      if (emailService.sendReminderEmail) {
        await emailService.sendReminderEmail({
          toEmail: contactEmail,
          contactName: appointment.contact_name,
          companyName: company.nombre,
          date: appointment.date,
          time: appointment.start_time,
          title: appointment.title,
          timeLabel,
        });
      }
      logger.info(`📧 Recordatorio email enviado a ${contactEmail} (${timeLabel})`);
    } catch (e) {
      logger.warn('Reminder email error:', e.message);
    }
  }

  // Notificación interna
  await notificationService.create({
    companyId: company.id,
    type: 'reminder',
    title: `Recordatorio: ${appointment.contact_name} en ${timeLabel}`,
    body: `Cita ${appointment.date} ${appointment.start_time} — ${appointment.title || 'Cita programada'}`,
    metadata: { appointment_id: appointment.id },
  });
}

function startReminderChecker() {
  if (_intervalId) return;
  _intervalId = setInterval(checkReminders, 5 * 60 * 1000); // cada 5 minutos
  logger.info('⏰ Servicio de recordatorios iniciado (cada 5 min)');
  checkReminders(); // primera ejecución inmediata
}

module.exports = { startReminderChecker, checkReminders };
