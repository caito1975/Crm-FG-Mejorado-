// Datos de ejemplo para Norte CRM — agencia ficticia
// Todos los datos son inventados.

window.NORTE = (() => {

  const initials = (name) => name.split(' ').map(p => p[0]).slice(0,2).join('').toUpperCase();

  const contacts = [
    { id: 'c01', name: 'Lucía Fernández',    company: 'Mercado Norte',     role: 'Head of Brand',           email: 'lucia@mercadonorte.co',     phone: '+52 55 4421 0118', city: 'CDMX',     status: 'cliente',     tags: ['retainer','retail'],         lastTouch: 'hace 2 días',  owner: 'tu',          value: 86000 },
    { id: 'c02', name: 'Mateo Aguirre',      company: 'Cooperativa Sur',   role: 'Director de Marketing',   email: 'mateo@coopsur.org',         phone: '+54 11 5544 2218', city: 'Buenos Aires', status: 'oportunidad', tags: ['nonprofit'],                  lastTouch: 'ayer',         owner: 'Ana',         value: 24000 },
    { id: 'c03', name: 'Sofía Aramburu',     company: 'Atlas Studio',      role: 'Founder',                 email: 'sofia@atlasstudio.io',      phone: '+34 612 008 731',  city: 'Madrid',       status: 'lead',        tags: ['saas','referral'],            lastTouch: 'hace 5 días',  owner: 'tu',          value: 12000 },
    { id: 'c04', name: 'Diego Salinas',      company: 'Chiltepín Café',    role: 'Operaciones',             email: 'diego@chiltepin.mx',        phone: '+52 33 2918 4477', city: 'Guadalajara',  status: 'cliente',     tags: ['food','recurring'],           lastTouch: 'hoy',          owner: 'tu',          value: 18500 },
    { id: 'c05', name: 'Renata Bustos',      company: 'Casa Lupe',         role: 'Creative Director',       email: 'renata@casalupe.es',        phone: '+34 644 911 052',  city: 'Barcelona',    status: 'oportunidad', tags: ['design','referral'],          lastTouch: 'hace 1 día',   owner: 'Pablo',       value: 42000 },
    { id: 'c06', name: 'Tomás Iglesias',     company: 'Río Logística',     role: 'COO',                     email: 't.iglesias@riolog.com',     phone: '+57 1 487 2204',   city: 'Bogotá',       status: 'lead',        tags: ['logistics'],                  lastTouch: 'hace 3 días',  owner: 'Ana',         value: 65000 },
    { id: 'c07', name: 'Camila Peña',        company: 'Verde Salud',       role: 'CMO',                     email: 'camila@verdesalud.cl',      phone: '+56 2 2784 0091',  city: 'Santiago',     status: 'cliente',     tags: ['health','priority'],          lastTouch: 'hace 4 días',  owner: 'tu',          value: 110000 },
    { id: 'c08', name: 'Andrés Quiroga',     company: 'Tierra Café',       role: 'Owner',                   email: 'andres@tierracafe.pe',      phone: '+51 1 432 9921',   city: 'Lima',         status: 'archivado',   tags: ['food'],                       lastTouch: 'hace 1 mes',   owner: 'tu',          value: 0 },
    { id: 'c09', name: 'Valeria Echevarría', company: 'Numen Editorial',   role: 'Editora',                 email: 'valeria@numen.mx',          phone: '+52 55 8814 3300', city: 'CDMX',         status: 'oportunidad', tags: ['publishing'],                 lastTouch: 'hace 6 días',  owner: 'Pablo',       value: 9800 },
    { id: 'c10', name: 'Joaquín Méndez',     company: 'Faro Naval',        role: 'Director Comercial',      email: 'joa@faronaval.uy',          phone: '+598 2 600 1184',  city: 'Montevideo',   status: 'cliente',     tags: ['B2B','retainer'],             lastTouch: 'hace 2 días',  owner: 'tu',          value: 54000 },
    { id: 'c11', name: 'Isabela Ríos',       company: 'Pampa Fitness',     role: 'Marketing Lead',          email: 'isa@pampafit.ar',           phone: '+54 11 6622 7115', city: 'Rosario',      status: 'lead',        tags: ['fitness','small'],            lastTouch: 'hace 8 días',  owner: 'Ana',         value: 6500 },
    { id: 'c12', name: 'Bruno Caballero',    company: 'Ola Studios',       role: 'Producer',                email: 'bruno@olastudios.tv',       phone: '+34 670 122 008',  city: 'Valencia',     status: 'oportunidad', tags: ['media'],                      lastTouch: 'hace 1 día',   owner: 'tu',          value: 38000 },
    { id: 'c13', name: 'Paula Domínguez',    company: 'Norte Bicicletas',  role: 'Founder',                 email: 'paula@nortebici.cl',        phone: '+56 9 7711 4408',  city: 'Valparaíso',   status: 'cliente',     tags: ['retail','direct'],            lastTouch: 'hace 3 días',  owner: 'Pablo',       value: 22000 },
    { id: 'c14', name: 'Hernán Solís',       company: 'Solís & Asoc.',     role: 'Socio',                   email: 'hsolis@solisasoc.mx',       phone: '+52 81 3300 4422', city: 'Monterrey',    status: 'lead',        tags: ['legal'],                      lastTouch: 'hace 4 días',  owner: 'tu',          value: 14200 },
    { id: 'c15', name: 'Marina Otero',       company: 'Luz Fotografía',    role: 'Directora',               email: 'marina@luz.foto',           phone: '+34 622 880 015',  city: 'Sevilla',      status: 'cliente',     tags: ['creative'],                   lastTouch: 'hoy',          owner: 'tu',          value: 7400 },
  ].map(c => ({ ...c, initials: initials(c.name) }));

  const stages = [
    { id: 'enviar_mail',  label: 'Enviar Mail',     color: 'oklch(72% 0.04 250)' },
    { id: 'enviado',      label: 'Enviado',         color: 'oklch(68% 0.08 230)' },
    { id: 'reu_inicial',  label: 'Reu. Inicial',    color: 'oklch(65% 0.11 230)' },
    { id: 'seg_reu',      label: 'Seg. Reunión',    color: 'oklch(65% 0.13 260)' },
    { id: 'doc_enviada',  label: 'Doc. Enviada',    color: 'oklch(65% 0.13 280)' },
    { id: 'prop_enviada', label: 'Prop. Enviada',   color: 'oklch(68% 0.14 305)' },
    { id: 'ped_fc',       label: 'Ped. de FC',      color: 'oklch(70% 0.14 75)'  },
    { id: 'doc_firmada',  label: 'Doc. Firmada',    color: 'oklch(62% 0.14 145)' },
    { id: 'ganado',       label: 'Ganado-Consumo',  color: 'oklch(58% 0.15 155)' },
    { id: 'perdido',      label: 'Perdido',         color: 'oklch(60% 0.14 25)'  },
  ];

  const deals = [
    { id: 'd01', title: 'Rebrand Mercado Norte 2026',    contact: 'c01', stage: 'prop_enviada', amount: 86000, prob: 70, close: '15 may', owner: 'tu' },
    { id: 'd02', title: 'Campaña aniversario Coop. Sur', contact: 'c02', stage: 'reu_inicial',  amount: 24000, prob: 35, close: '02 jun', owner: 'Ana' },
    { id: 'd03', title: 'Identidad Atlas Studio',        contact: 'c03', stage: 'enviar_mail',  amount: 12000, prob: 15, close: '20 jun', owner: 'tu' },
    { id: 'd04', title: 'Menú estacional Chiltepín',     contact: 'c04', stage: 'ganado',       amount: 18500, prob: 100, close: '20 abr', owner: 'tu' },
    { id: 'd05', title: 'Web y e-comm Casa Lupe',        contact: 'c05', stage: 'doc_enviada',  amount: 42000, prob: 55, close: '08 jun', owner: 'Pablo' },
    { id: 'd06', title: 'Ecosistema digital Río',        contact: 'c06', stage: 'seg_reu',      amount: 65000, prob: 40, close: '30 jun', owner: 'Ana' },
    { id: 'd07', title: 'Lanzamiento Verde Salud',       contact: 'c07', stage: 'doc_firmada',  amount: 110000, prob: 90, close: '12 may', owner: 'tu' },
    { id: 'd08', title: 'Catálogo Numen Otoño',          contact: 'c09', stage: 'prop_enviada', amount: 9800, prob: 50, close: '28 may', owner: 'Pablo' },
    { id: 'd09', title: 'Naming Faro Naval',             contact: 'c10', stage: 'ganado',       amount: 22000, prob: 100, close: '14 abr', owner: 'tu' },
    { id: 'd10', title: 'Plan trimestral Pampa Fitness', contact: 'c11', stage: 'enviado',      amount: 6500, prob: 20, close: '05 jul', owner: 'Ana' },
    { id: 'd11', title: 'Serie de marca Ola Studios',    contact: 'c12', stage: 'ped_fc',       amount: 38000, prob: 65, close: '18 jun', owner: 'tu' },
    { id: 'd12', title: 'Retainer Norte Bicicletas',     contact: 'c13', stage: 'prop_enviada', amount: 22000, prob: 60, close: '22 may', owner: 'Pablo' },
    { id: 'd13', title: 'Identidad Solís & Asoc.',       contact: 'c14', stage: 'reu_inicial',  amount: 14200, prob: 30, close: '14 jun', owner: 'tu' },
    { id: 'd14', title: 'Campaña primavera Luz Foto',    contact: 'c15', stage: 'ganado',       amount: 7400, prob: 100, close: '28 abr', owner: 'tu' },
    { id: 'd15', title: 'Rediseño app Tierra Café',      contact: 'c08', stage: 'perdido',      amount: 16000, prob: 0,  close: '15 abr', owner: 'tu' },
  ];

  const tasks = [
    { id: 't01', title: 'Enviar contrato a Mercado Norte',          due: 'hoy',          priority: 'alta',  done: false, contact: 'c01', type: 'doc' },
    { id: 't02', title: 'Llamada de descubrimiento — Atlas Studio',  due: 'hoy 16:00',    priority: 'media', done: false, contact: 'c03', type: 'call' },
    { id: 't03', title: 'Revisar propuesta Casa Lupe',               due: 'mañana',       priority: 'alta',  done: false, contact: 'c05', type: 'review' },
    { id: 't04', title: 'Seguimiento email Verde Salud',             due: 'mañana',       priority: 'media', done: false, contact: 'c07', type: 'email' },
    { id: 't05', title: 'Preparar deck Río Logística',               due: '4 may',        priority: 'alta',  done: false, contact: 'c06', type: 'doc' },
    { id: 't06', title: 'Café con Renata',                            due: '6 may 11:00',  priority: 'baja',  done: false, contact: 'c05', type: 'meet' },
    { id: 't07', title: 'Cobrar factura Chiltepín #0421',             due: '7 may',        priority: 'media', done: false, contact: 'c04', type: 'invoice' },
    { id: 't08', title: 'Pulir naming Faro Naval — entrega final',   due: 'completada',   priority: 'media', done: true,  contact: 'c10', type: 'doc' },
    { id: 't09', title: 'Brief inicial Ola Studios',                  due: 'completada',   priority: 'media', done: true,  contact: 'c12', type: 'meet' },
    { id: 't10', title: 'Quote para Pampa Fitness',                   due: '8 may',        priority: 'baja',  done: false, contact: 'c11', type: 'doc' },
  ];

  const activities = [
    { id: 'a01', kind: 'email_in',  who: 'Lucía Fernández', text: 'Reenvía el contrato firmado con anexos.', when: 'hace 2 h',  contact: 'c01' },
    { id: 'a02', kind: 'note',      who: 'tú',              text: 'Renata interesada en sumar fotografía. Pedirle mood.', when: 'hace 5 h', contact: 'c05' },
    { id: 'a03', kind: 'call_out',  who: 'tú',              text: 'Llamada con Atlas — 22 min. Próximo paso: deck el viernes.', when: 'ayer', contact: 'c03' },
    { id: 'a04', kind: 'email_out', who: 'tú',              text: 'Cotización v3 enviada a Verde Salud (USD 110k, 6m).', when: 'ayer', contact: 'c07' },
    { id: 'a05', kind: 'meeting',   who: 'Ana',             text: 'Discovery con Cooperativa Sur — buen fit, presupuesto ajustado.', when: 'hace 2 días', contact: 'c02' },
    { id: 'a06', kind: 'invoice',   who: 'sistema',         text: 'Factura #0421 enviada a Chiltepín Café.', when: 'hace 3 días', contact: 'c04' },
  ];

  const inbox = [
    { id: 'm01', from: 'Lucía Fernández',     subject: 'Re: contrato — un par de cambios',                  preview: 'Hola, ya pasamos el draft a legal. Solo dos puntos: 1) ajuste en la cláusula 4.b sobre…', when: '10:42', unread: true,  starred: true,  labels: ['cliente'] },
    { id: 'm02', from: 'Renata Bustos',       subject: 'Mood para campaña otoño',                            preview: 'Te mandé un Are.na con referencias. La idea es buscar algo con textura, papel, casi…',         when: '09:18', unread: true,  starred: false, labels: ['propuesta'] },
    { id: 'm03', from: 'Camila Peña',         subject: 'Aprobado — vamos a firmar',                          preview: 'Equipo, después de varias rondas con finanzas tenemos luz verde. Coordinamos firma esta…',     when: 'ayer',  unread: true,  starred: true,  labels: ['cliente','prioridad'] },
    { id: 'm04', from: 'Mateo Aguirre',       subject: 'Documentos del proyecto cooperativa',                preview: 'Comparto docs internos, presupuestos previos y los stakeholders del comité. Quedo atento…',     when: 'ayer',  unread: false, starred: false, labels: ['propuesta'] },
    { id: 'm05', from: 'Stripe',              subject: 'Pago recibido — Chiltepín Café',                     preview: 'Has recibido un pago de USD 18,500.00 de Chiltepín Café por la factura #0421…',                  when: 'lun',   unread: false, starred: false, labels: ['facturación'] },
    { id: 'm06', from: 'Andrés Quiroga',      subject: 'Tal vez el próximo trimestre',                       preview: 'Disculpa la demora. Por temas de presupuesto vamos a tener que pausar hasta el siguiente…',     when: 'lun',   unread: false, starred: false, labels: ['archivado'] },
    { id: 'm07', from: 'Joaquín Méndez',      subject: 'Q3 planning — disponibilidad',                       preview: 'Hola, queremos planificar el siguiente trimestre con tiempo. ¿Tendrían bandwidth para…',          when: 'dom',   unread: false, starred: true,  labels: ['cliente'] },
    { id: 'm08', from: 'Bruno Caballero',     subject: 'Brief v2 — versión revisada',                        preview: 'Equipo, adjunto la versión 2 del brief. Cambios en producción y un poco más de contexto…',      when: 'sab',   unread: false, starred: false, labels: ['propuesta'] },
  ];

  const team = [
    { id: 'u_tu',    name: 'Sofía Aramburu', email: 'sofia@estudionorte.com', role: 'Owner',      tone: 'accent',  status: 'activo',   permission: 'admin',     quota: 240000, sold: 184000, deals: 7, winRate: 71, lastActive: 'ahora',         joined: 'jun 2023', region: 'LATAM' },
    { id: 'u_ana',   name: 'Ana López',      email: 'ana@estudionorte.com',   role: 'Vendedora',  tone: 'info',    status: 'activo',   permission: 'vendedor',  quota: 120000, sold: 24000,  deals: 3, winRate: 33, lastActive: 'hace 12 min',   joined: 'sep 2023', region: 'AR' },
    { id: 'u_pablo', name: 'Pablo Yánez',    email: 'pablo@estudionorte.com', role: 'Vendedor',   tone: 'success', status: 'activo',   permission: 'vendedor',  quota: 150000, sold: 92000,  deals: 4, winRate: 50, lastActive: 'hace 2 h',      joined: 'feb 2024', region: 'MX' },
    { id: 'u_lia',   name: 'Lía Marín',      email: 'lia@estudionorte.com',   role: 'SDR',        tone: 'warning', status: 'activo',   permission: 'sdr',       quota: 60000,  sold: 18500,  deals: 6, winRate: 28, lastActive: 'hace 1 día',    joined: 'ago 2024', region: 'CL' },
    { id: 'u_die',   name: 'Diego Ferrer',   email: 'diego@estudionorte.com', role: 'Vendedor',   tone: 'accent',  status: 'inactivo', permission: 'vendedor',  quota: 100000, sold: 12000,  deals: 2, winRate: 22, lastActive: 'hace 9 días',   joined: 'ene 2025', region: 'ES' },
    { id: 'u_inv',   name: 'Mariana Solís',  email: 'mariana@estudionorte.com', role: 'Vendedora',tone: 'info',    status: 'invitado', permission: 'vendedor',  quota: 0,      sold: 0,      deals: 0, winRate: 0,  lastActive: '—',             joined: '—',        region: 'CO' },
  ];

  // monthly revenue (last 9 months) for sparkline + reports
  const revenue = [
    { m: 'sep', v: 28 }, { m: 'oct', v: 34 }, { m: 'nov', v: 31 },
    { m: 'dic', v: 22 }, { m: 'ene', v: 38 }, { m: 'feb', v: 42 },
    { m: 'mar', v: 51 }, { m: 'abr', v: 58 }, { m: 'may', v: 64 },
  ];

  const sources = [
    { label: 'Referidos',        v: 38, color: 'oklch(58% 0.155 280)' },
    { label: 'Inbound web',      v: 24, color: 'oklch(65% 0.13 230)' },
    { label: 'Eventos',          v: 14, color: 'oklch(70% 0.13 75)'  },
    { label: 'Outbound',         v: 11, color: 'oklch(60% 0.13 155)' },
    { label: 'Otros',            v: 13, color: 'oklch(70% 0.04 250)' },
  ];

  return { contacts, stages, deals, tasks, activities, inbox, team, revenue, sources };
})();
