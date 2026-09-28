/* ═══════════════════════════════════════════════════════════════════════════
   SGSSS Health & Pay Simulator · app.js
   Motor de Cálculo SGSSS Colombia
   ═══════════════════════════════════════════════════════════════════════════ */

'use strict';

// ─── CONSTANTES SGSSS 2026 ─────────────────────────────────────────────────
// Decreto 1469 y 1470 del 29 de diciembre de 2025 + Decreto 159 del 19/02/2026
const SMMLV          = 1_750_905;   // Salario Mínimo Mensual Legal Vigente 2026
const AUX_TRANSPORTE = 249_095;     // Auxilio de Transporte 2026
const TASA_SALUD     = 0.125;       // 12.5% total cotización salud
const TASA_EMPLEADOR = 0.085;       // 8.5% empleador (dependiente)
const TASA_EMPLEADO  = 0.04;        // 4.0% empleado (dependiente)
const FACTOR_IBC_IND = 0.40;        // 40% del ingreso bruto para independientes
const SUBSIDIO_EPS   = 2 / 3;       // 66.67% (2/3) del IBC diario = subsidio EPS

// ─── ESTADO GLOBAL ─────────────────────────────────────────────────────────
let state = {
  tipo: 'independiente',
  contratos: [],
  ibcLegal: 0,
  ibcDeclarado: 0,
  ingresoTotal: 0,
  dias: 30,
  mainChart: null,
};

// ─── INICIALIZACIÓN ─────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  addContract();          // Contrato inicial por defecto
  onTipoChange();         // Configurar tipo inicial
  // Actualizar SMMLV en hero si el elemento existe
  const smmlvEl = document.getElementById('stat-smmlv');
  if (smmlvEl) smmlvEl.textContent = fmt(SMMLV);
  initChart();            // Gráfica vacía
  calcularTodo();         // Primer cálculo
  updateSlider(30);       // Slider inicial
});

// ═══════════════════════════════════════════════════════════════════════════
// MÓDULO 1 — CONTRATOS
// ═══════════════════════════════════════════════════════════════════════════
let contractCounter = 0;

function addContract(nombre = '', valor = '') {
  contractCounter++;
  const id = contractCounter;
  const list = document.getElementById('contracts-list');
  const div = document.createElement('div');
  div.classList.add('contract-item');
  div.id = `contract-item-${id}`;
  div.innerHTML = `
    <div class="contract-field">
      <label class="contract-field-label" for="cn-${id}">Fuente / Contrato</label>
      <input type="text" id="cn-${id}" class="contract-input" placeholder="Ej: Agencia Digital XYZ" value="${nombre}" oninput="calcularTodo()" aria-label="Nombre del contrato ${id}" />
    </div>
    <div class="contract-field">
      <label class="contract-field-label" for="cv-${id}">Honorarios / Salario (COP)</label>
      <input type="number" id="cv-${id}" class="contract-input" placeholder="Ej: 4000000" value="${valor}" min="0" step="50000" oninput="calcularTodo()" aria-label="Valor del contrato ${id}" />
    </div>
    <button class="remove-contract-btn" onclick="removeContract(${id})" aria-label="Eliminar contrato ${id}" title="Eliminar contrato">
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
        <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      </svg>
    </button>
  `;
  list.appendChild(div);
  calcularTodo();
}

function removeContract(id) {
  const el = document.getElementById(`contract-item-${id}`);
  if (el) {
    el.style.opacity = '0';
    el.style.transform = 'translateY(-10px)';
    el.style.transition = '0.25s';
    setTimeout(() => { el.remove(); calcularTodo(); }, 250);
  }
}

function onTipoChange() {
  state.tipo = document.querySelector('input[name="tipoTrabajador"]:checked')?.value || 'independiente';
  const esIndep = state.tipo === 'independiente';

  // Etiqueta del aporte
  const lblEmpleado = document.getElementById('aporte-empleado-label');
  const rowEmpleador = document.getElementById('aporte-empleador-row');
  const rowEmpleado  = document.getElementById('aporte-empleado-row');

  if (esIndep) {
    rowEmpleador.style.display = 'none';
    rowEmpleado.style.display  = 'flex';
    if (lblEmpleado) lblEmpleado.textContent = 'Independiente (12.5%)';
  } else {
    rowEmpleador.style.display = 'flex';
    rowEmpleado.style.display  = 'flex';
    if (lblEmpleado) lblEmpleado.textContent = 'Empleado (4%)';
  }

  // Actualizar banner info
  updateInfoBanner();
  calcularTodo();
}

// ═══════════════════════════════════════════════════════════════════════════
// MOTOR DE CÁLCULO CENTRAL
// ═══════════════════════════════════════════════════════════════════════════
function calcularTodo() {
  // 1. Sumar ingresos
  const contratos = document.querySelectorAll('[id^="cv-"]');
  let totalBruto = 0;
  contratos.forEach(input => {
    const v = parseFloat(input.value) || 0;
    if (v > 0) totalBruto += v;
  });
  state.ingresoTotal = totalBruto;

  // 2. Calcular IBC legal
  let ibcLegal;
  if (state.tipo === 'independiente') {
    // Para independientes: IBC = 40% del ingreso bruto, mínimo SMMLV
    ibcLegal = Math.max(totalBruto * FACTOR_IBC_IND, SMMLV);
  } else {
    // Para dependientes: IBC = salario base, mínimo SMMLV
    ibcLegal = Math.max(totalBruto, SMMLV);
  }
  state.ibcLegal = ibcLegal;

  // 3. Cotización legal
  const cotizacionTotal  = ibcLegal * TASA_SALUD;
  const cotizacionEmpresa = state.tipo === 'dependiente' ? ibcLegal * TASA_EMPLEADOR : 0;
  const cotizacionEmpleado = state.tipo === 'dependiente' ? ibcLegal * TASA_EMPLEADO : cotizacionTotal;

  // 4. Actualizar UI Módulo 1
  document.getElementById('total-ingresos').textContent = fmt(totalBruto);

  // 5. Actualizar UI Módulo 2
  animateValue('ibc-display', ibcLegal);
  document.getElementById('ibc-formula').textContent =
    state.tipo === 'independiente'
      ? `40% × ${fmt(totalBruto)} = ${fmt(ibcLegal)}${ibcLegal === SMMLV && totalBruto * FACTOR_IBC_IND < SMMLV ? ' (mínimo SMMLV)' : ''}`
      : `Salario base: ${fmt(ibcLegal)}`;

  animateValue('cotizacion-display', cotizacionTotal);
  document.getElementById('cotizacion-formula').textContent = `${fmt(ibcLegal)} × 12,5% = ${fmt(cotizacionTotal)}`;

  document.getElementById('m2-ingreso-bruto').textContent  = fmt(totalBruto);
  document.getElementById('m2-ibc-legal').textContent      = fmt(ibcLegal);
  document.getElementById('m2-empleador').textContent      = fmt(cotizacionEmpresa);
  document.getElementById('m2-empleado').textContent       = fmt(cotizacionEmpleado);
  document.getElementById('m2-total-cotizacion').textContent = fmt(cotizacionTotal);

  // 6. Banner info
  updateInfoBanner();

  // 7. Recalcular evasión (si hay IBC declarado)
  calcularEvasion();

  // 8. Recalcular incapacidad
  calcularIncapacidad();

  // 9. Resumen ejecutivo
  updateExecutiveSummary();
}

function calcularEvasion() {
  const ibcDeclaradoInput = parseFloat(document.getElementById('ibc-declarado-input').value) || 0;
  state.ibcDeclarado = ibcDeclaradoInput;
  const ibcLegal = state.ibcLegal;

  document.getElementById('ev-declarado').textContent = fmt(ibcDeclaradoInput);
  document.getElementById('ev-legal').textContent     = fmt(ibcLegal);

  const brecha = ibcLegal - ibcDeclaradoInput;
  const ahorroFicticio = brecha * TASA_SALUD;

  document.getElementById('ev-brecha').textContent = brecha > 0 ? `−${fmt(brecha)}` : fmt(brecha);
  document.getElementById('ev-ahorro').textContent  = ahorroFicticio > 0 ? `${fmt(ahorroFicticio)}` : '$0';

  const alertBox = document.getElementById('alert-evasion');
  const okBox    = document.getElementById('ok-evasion');

  if (ibcDeclaradoInput <= 0) {
    alertBox.style.display = 'none';
    okBox.style.display    = 'none';
    return;
  }

  const bajoSMMLV   = ibcDeclaradoInput < SMMLV;
  const bajoLegal   = ibcDeclaradoInput < ibcLegal;

  if (bajoSMMLV || bajoLegal) {
    okBox.style.display    = 'none';
    alertBox.style.display = 'flex';
    const textoAlerta = buildAlertText(ibcDeclaradoInput, ibcLegal, bajoSMMLV, brecha, ahorroFicticio);
    document.getElementById('alert-body-text').innerHTML = textoAlerta;
  } else {
    alertBox.style.display = 'none';
    okBox.style.display    = 'flex';
  }

  // Recalcular con IBC declarado para comparación
  calcularIncapacidad();
}

function buildAlertText(declarado, legal, bajoSMMLV, brecha, ahorro) {
  let texto = '';
  if (bajoSMMLV) {
    texto += `<strong>⚠ Violación al SMMLV:</strong> El IBC declarado (${fmt(declarado)}) es inferior al Salario Mínimo Mensual Legal Vigente (${fmt(SMMLV)}). Esto constituye una infracción directa al Decreto 780 de 2016 y genera sanciones inmediatas.<br/><br/>`;
  } else {
    texto += `<strong>⚠ IBC inferior al legalmente requerido:</strong> Tu IBC declarado (${fmt(declarado)}) es menor al IBC legal calculado (${fmt(legal)}).<br/><br/>`;
  }
  texto += `<strong>Consecuencias UGPP (Art. 271 Ley 1955/2019):</strong><br/>`;
  texto += `• Sanción del <strong>5% mensual</strong> sobre ${fmt(brecha)} no cotizado (hasta 60% máx.)<br/>`;
  texto += `• Sanción máxima estimada: <strong>${fmt(brecha * 0.6)}</strong><br/>`;
  texto += `• "Ahorro ficticio" mensual: ${fmt(ahorro)} — Pérdida potencial en incapacidad: <strong>mucho mayor</strong><br/>`;
  texto += `• Posible <strong>negación de prestaciones</strong> económicas (incapacidades, licencias) por la EPS<br/>`;
  texto += `• Riesgo de <strong>suspensión de afiliación</strong> y pérdida de cobertura para beneficiarios`;
  return texto;
}

// ═══════════════════════════════════════════════════════════════════════════
// MÓDULO 3 — SIMULADOR DE INCAPACIDAD
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Reglas SGSSS — Incapacidad por Enfermedad General:
 * Independientes:
 *   - Días 1-3: Sin pago (responsabilidad del trabajador)
 *   - Días 4-180: EPS paga 66.67% de (IBC/30) por día
 * Dependientes:
 *   - Días 1-3: Empleador paga 100% del salario diario
 *   - Días 4-180: EPS paga 66.67% de (IBC/30) por día
 */
function calcularIncapacidad() {
  const dias       = state.dias;
  const ibcLegal   = state.ibcLegal;
  const ibcDecl    = state.ibcDeclarado > 0 ? state.ibcDeclarado : SMMLV;
  const esDepend   = state.tipo === 'dependiente';

  const resultadoBad  = calcSubsidio(dias, ibcDecl,  esDepend);
  const resultadoGood = calcSubsidio(dias, ibcLegal, esDepend);

  // Actualizar subtítulos de escenarios
  document.getElementById('sc-bad-ibc').textContent  = `IBC declarado: ${fmt(ibcDecl)}`;
  document.getElementById('sc-good-ibc').textContent = `IBC legal: ${fmt(ibcLegal)}`;

  // ── Escenario BAD ──
  updateScenarioUI('bad', resultadoBad, dias, esDepend);

  // ── Escenario GOOD ──
  updateScenarioUI('good', resultadoGood, dias, esDepend);

  // ── Brecha ──
  const brecha = resultadoGood.total - resultadoBad.total;
  const diasEfectivos = Math.max(dias, 1);
  const brechaDiaria  = brecha / diasEfectivos;
  const brechaMensual = brechaDiaria * 30;
  const pctBrecha     = state.ingresoTotal > 0 ? (brechaMensual / state.ingresoTotal) * 100 : 0;

  animateValueRaw('brecha-total',   `−${fmt(brecha)}`);
  document.getElementById('brecha-diaria').textContent  = `−${fmt(Math.round(brechaDiaria))}`;
  document.getElementById('brecha-mensual').textContent = `−${fmt(Math.round(brechaMensual))}`;
  document.getElementById('brecha-pct').textContent     = `−${pctBrecha.toFixed(1)}%`;

  // ── Gráfica ──
  updateChart(dias, ibcLegal, ibcDecl, esDepend);
}

function calcSubsidio(dias, ibc, esDepend) {
  const diarioIBC = ibc / 30;
  const minimoDiario = SMMLV / 30;
  
  let sinIngreso = 0; // Para independientes son los días 1-2. Para dependientes $0 porque lo paga el empleador.
  let empleadorPaga = 0; // Días 1-2 para dependientes
  let fase1 = 0; // Días 3-90 (EPS)
  let fase2 = 0; // Días 91-180 (EPS)

  // 1. Días 1 y 2
  const diasFase0 = Math.min(dias, 2);
  if (diasFase0 > 0) {
    if (esDepend) {
      // Empleador paga el 66.67%, no menor al mínimo diario
      const valorDiario = Math.max(diarioIBC * (2 / 3), minimoDiario);
      empleadorPaga = diasFase0 * valorDiario;
    } else {
      // Independiente no recibe nada estos 2 días
      sinIngreso = diasFase0 * diarioIBC; // Esto representa su pérdida total de ingresos
    }
  }

  // 2. Días 3 a 90 (Fase 1 de EPS)
  if (dias > 2) {
    const diasFase1 = Math.min(dias, 90) - 2;
    const valorDiario = Math.max(diarioIBC * (2 / 3), minimoDiario);
    fase1 = diasFase1 * valorDiario;
  }

  // 3. Días 91 a 180 (Fase 2 de EPS - Baja al 50%)
  if (dias > 90) {
    const diasFase2 = Math.min(dias, 180) - 90;
    const valorDiario = Math.max(diarioIBC * 0.50, minimoDiario);
    fase2 = diasFase2 * valorDiario;
  }

  // Pérdida o brecha real respecto al ingreso bruto real del trabajador
  // Para el cálculo de subsidio recibido:
  const totalRecibido = (esDepend ? empleadorPaga : 0) + fase1 + fase2;
  
  // El ingreso que deja de percibir por la incapacidad frente a su ingreso real
  const total = totalRecibido;
  const mensual = dias > 0 ? (total / dias) * 30 : 0;

  return { sinIngreso, empleadorPaga, fase1, fase2, total, mensual, diarioIBC };
}

function updateScenarioUI(escenario, res, dias, esDepend) {
  const pfx = `sc-${escenario}`;

  // 1. Días 1 y 2
  const sinIngresoEl = document.getElementById(`${pfx}-sin-ingreso`);
  if (esDepend) {
    sinIngresoEl.textContent = `+${fmt(Math.round(res.empleadorPaga))} (Empleador)`;
    sinIngresoEl.className = 'sc-val teal';
  } else {
    // Para independientes es pérdida de ingresos real
    const diasFase0 = Math.min(dias, 2);
    if (diasFase0 > 0) {
      sinIngresoEl.textContent = `$0 (Asume trabajador)`;
      sinIngresoEl.className = 'sc-val deficit';
    } else {
      sinIngresoEl.textContent = '$0';
      sinIngresoEl.className = 'sc-val';
    }
  }

  // 2. Fase 1 (Días 3–90) - EPS
  const row1 = document.getElementById(`${pfx}-fase1-row`);
  if (dias > 2) {
    row1.style.display = 'flex';
    const diaMaxFase1 = Math.min(dias, 90);
    document.getElementById(`${pfx}-fase1-label`).textContent = `Subsidio EPS (Días 3–${diaMaxFase1})`;
    document.getElementById(`${pfx}-fase1`).textContent = fmt(Math.round(res.fase1));
  } else {
    row1.style.display = 'none';
  }

  // 3. Fase 2 (Días 91–180) - EPS (al 50%)
  const row2 = document.getElementById(`${pfx}-fase2-row`);
  if (dias > 90) {
    row2.style.display = 'flex';
    const diaMaxFase2 = Math.min(dias, 180);
    document.getElementById(`${pfx}-fase2-label`).textContent = `Subsidio EPS (Días 91–${diaMaxFase2})`;
    document.getElementById(`${pfx}-fase2`).textContent = fmt(Math.round(res.fase2));
  } else {
    row2.style.display = 'none';
  }

  document.getElementById(`${pfx}-total`).textContent   = fmt(Math.round(res.total));
  document.getElementById(`${pfx}-mensual`).textContent = fmt(Math.round(res.mensual));
}

function onDiasChange() {
  const slider = document.getElementById('dias-slider');
  const val = parseInt(slider.value, 10);
  state.dias = val;
  updateSlider(val);
  calcularIncapacidad();
  updateExecutiveSummary();
}

function updateSlider(val) {
  const slider = document.getElementById('dias-slider');
  slider.setAttribute('aria-valuenow', val);
  const pct = ((val - 1) / 179) * 100;
  slider.style.setProperty('--slider-pct', `${pct}%`);
  document.getElementById('dias-value').textContent = val;
  document.getElementById('dias-badge').setAttribute('aria-label', `${val} días seleccionados`);

  // Highlight de fase activa
  const p1 = document.getElementById('phase-1');
  const p2 = document.getElementById('phase-2');
  const p3 = document.getElementById('phase-3');
  p1.style.opacity = val <= 2  ? '1' : '0.5';
  p2.style.opacity = val > 2 && val <= 90 ? '1' : val > 2 ? '0.7' : '0.5';
  p3.style.opacity = val > 90 ? '1' : '0.5';
}

// ═══════════════════════════════════════════════════════════════════════════
// GRÁFICA — Chart.js
// ═══════════════════════════════════════════════════════════════════════════
function initChart() {
  if (typeof window.Chart === 'undefined') {
    console.warn('Chart.js no está cargado. El análisis visual se deshabilitará.');
    const chartCard = document.querySelector('.chart-card');
    if (chartCard) {
      chartCard.style.display = 'none'; // Ocultar si no se pudo cargar la librería
    }
    return;
  }

  try {
    const ctx = document.getElementById('mainChart').getContext('2d');
    state.mainChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: [],
        datasets: [
          {
            label: 'Subsidio IBC Legal (EPS)',
            data: [],
            backgroundColor: 'rgba(0, 232, 181, 0.7)',
            borderColor: '#00e8b5',
            borderWidth: 1,
            borderRadius: 6,
          },
          {
            label: 'Subsidio IBC Declarado (EPS)',
            data: [],
            backgroundColor: 'rgba(255, 95, 126, 0.7)',
            borderColor: '#ff5f7e',
            borderWidth: 1,
            borderRadius: 6,
          },
          {
            label: 'Brecha Financiera',
            data: [],
            backgroundColor: 'rgba(255, 181, 71, 0.5)',
            borderColor: '#ffb547',
            borderWidth: 1.5,
            borderRadius: 6,
            type: 'line',
            fill: false,
            tension: 0.4,
            pointBackgroundColor: '#ffb547',
            pointRadius: 3,
            yAxisID: 'y',
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(10, 10, 30, 0.95)',
            borderColor: 'rgba(255, 255, 255, 0.08)',
            borderWidth: 1,
            titleColor: '#eeeeff',
            bodyColor: 'rgba(238, 238, 255, 0.7)',
            callbacks: {
              label: ctx => ` ${ctx.dataset.label}: ${fmtChart(ctx.parsed.y)}`,
            },
          },
        },
        scales: {
          x: {
            grid: { color: 'rgba(255, 255, 255, 0.03)' },
            ticks: { color: 'rgba(238, 238, 255, 0.35)', font: { family: 'JetBrains Mono', size: 10 } },
          },
          y: {
            grid: { color: 'rgba(255, 255, 255, 0.03)' },
            ticks: { color: 'rgba(238, 238, 255, 0.35)', callback: v => fmtChart(v), font: { family: 'JetBrains Mono', size: 10 } },
          },
        },
      },
    });
  } catch (e) {
    console.error('Error al inicializar Chart.js:', e);
  }
}

function updateChart(dias, ibcLegal, ibcDecl, esDepend) {
  if (!state.mainChart) return;

  try {
    const puntos  = buildChartPoints(dias);
    const labels  = puntos.map(p => `Día ${p}`);
    const legalData = puntos.map(p => Math.round(calcSubsidio(p, ibcLegal, esDepend).total));
    const declData  = puntos.map(p => Math.round(calcSubsidio(p, ibcDecl,  esDepend).total));
    const brechaData = legalData.map((v, i) => v - declData[i]);

    state.mainChart.data.labels            = labels;
    state.mainChart.data.datasets[0].data  = legalData;
    state.mainChart.data.datasets[1].data  = declData;
    state.mainChart.data.datasets[2].data  = brechaData;
    state.mainChart.update('active');
  } catch (e) {
    console.error('Error al actualizar Chart.js:', e);
  }
}

function buildChartPoints(maxDias) {
  // Generar ~10 puntos bien distribuidos
  const points = [];
  const step = Math.max(1, Math.ceil(maxDias / 10));
  for (let d = step; d <= maxDias; d += step) {
    points.push(d);
  }
  if (points[points.length - 1] !== maxDias) points.push(maxDias);
  return points;
}

// ═══════════════════════════════════════════════════════════════════════════
// RESUMEN EJECUTIVO
// ═══════════════════════════════════════════════════════════════════════════
function updateExecutiveSummary() {
  const ibcLegal = state.ibcLegal;
  const ibcDecl  = state.ibcDeclarado > 0 ? state.ibcDeclarado : SMMLV;
  const esDepend = state.tipo === 'dependiente';

  // Pérdida a 180 días
  const good180 = calcSubsidio(180, ibcLegal, esDepend);
  const bad180  = calcSubsidio(180, ibcDecl,  esDepend);
  const perdida180 = good180.total - bad180.total;

  // Reducción de ingresos mensual
  const mensualReal   = state.ingresoTotal || ibcLegal;
  const mensualIncap  = bad180.mensual;
  const reduccion     = mensualReal > 0 ? ((mensualReal - mensualIncap) / mensualReal) * 100 : 0;

  // Sanción UGPP estimada (5% mensual sobre diferencia no cotizada, 12 meses)
  const brechaIBC = Math.max(ibcLegal - ibcDecl, 0);
  const sancionUGPP = brechaIBC * TASA_SALUD * 0.60; // Máximo 60%

  // Nivel de riesgo
  let riesgo = '✅ Ninguno detectado';
  if (ibcDecl < SMMLV)   riesgo = '🔴 CRÍTICO — Bajo SMMLV';
  else if (ibcDecl < ibcLegal) riesgo = '🟠 ALTO — Elusión detectada';

  document.getElementById('exec-riesgo').textContent   = riesgo;
  document.getElementById('exec-perdida').textContent  = `−${fmt(Math.round(perdida180))}`;
  document.getElementById('exec-reduccion').textContent = `−${reduccion.toFixed(1)}%`;
  document.getElementById('exec-sancion').textContent  = fmt(Math.round(sancionUGPP));
}

// ═══════════════════════════════════════════════════════════════════════════
// CASO ALEJANDRO — PRECARGA
// ═══════════════════════════════════════════════════════════════════════════
function loadAlejandroCase() {
  // 1. Tipo: Independiente
  document.getElementById('radio-independiente').checked = true;
  onTipoChange();

  // 2. Limpiar contratos existentes
  document.getElementById('contracts-list').innerHTML = '';
  contractCounter = 0;

  // 3. Cargar los 3 contratos de Alejandro (total ~$12.000.000/mes)
  // En 2026 los ingresos ajustados por inflación del desarrollador
  addContract('Agencia Digital Local 1 (COP)',  '4200000');
  addContract('Agencia Digital Local 2 (COP)',  '3800000');
  addContract('Startup Extranjera (USD→COP)',   '4000000');

  // 4. IBC Declarado = SMMLV 2026 (lo que hacía Alejandro — elusión)
  document.getElementById('ibc-declarado-input').value = SMMLV;

  // 5. Días = 180 (escenario del ACV)
  document.getElementById('dias-slider').value = 180;
  state.dias = 180;
  updateSlider(180);

  // 6. Recalcular todo
  calcularTodo();

  // 7. Scroll al módulo 2
  setTimeout(() => scrollToSection('mod2'), 300);

  // Feedback visual
  const btn = document.getElementById('btn-load-caso');
  if (btn) {
    btn.textContent = '✓ Caso cargado';
    btn.style.background = 'linear-gradient(135deg, #4eff91, #00c9a7)';
    btn.style.color = '#06060f';
    setTimeout(() => {
      btn.innerHTML = `Cargar caso completo <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M2 8h10M8 4l4 4-4 4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`;
      btn.style.background = '';
      btn.style.color = '';
    }, 2500);
  }
  const btn2 = document.getElementById('btn-caso-alejandro');
  if (btn2) {
    btn2.style.background = 'linear-gradient(135deg, rgba(61,255,160,0.15), rgba(0,180,140,0.08))';
    setTimeout(() => { btn2.style.background = ''; }, 2500);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// BANNER INFO SMMLV
// ═══════════════════════════════════════════════════════════════════════════
function updateInfoBanner() {
  const esIndep = state.tipo === 'independiente';
  const total = state.ingresoTotal;
  const ibcCalc = esIndep ? total * FACTOR_IBC_IND : total;

  let texto = '';
  if (total === 0) {
    texto = `SMMLV 2026: ${fmt(SMMLV)} COP (Decreto 1469/2025) — Ingresa tus ingresos para calcular el IBC legal.`;
  } else if (esIndep) {
    texto = `Independiente: IBC = 40% × ${fmt(total)} = ${fmt(ibcCalc)}${ibcCalc < SMMLV ? ` → Se aplica mínimo SMMLV 2026: ${fmt(SMMLV)}` : ''}. Cotización en salud: ${fmt(state.ibcLegal * TASA_SALUD)}/mes.`;
  } else {
    texto = `Dependiente: IBC = Salario base ${fmt(total)}. Empresa paga ${fmt(total * TASA_EMPLEADOR)}, tú pagas ${fmt(total * TASA_EMPLEADO)} al mes.`;
  }
  document.getElementById('smmlv-info-text').textContent = texto;
}

// ═══════════════════════════════════════════════════════════════════════════
// UTILIDADES
// ═══════════════════════════════════════════════════════════════════════════

/** Formatear número a COP con separadores */
function fmt(value) {
  if (!isFinite(value) || isNaN(value)) return '$0';
  return '$' + Math.round(value).toLocaleString('es-CO');
}

/** Formatear para gráfica (abreviado) */
function fmtChart(value) {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000)     return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value}`;
}

/** Animación de valor numérico en elemento */
function animateValue(elementId, targetValue) {
  const el = document.getElementById(elementId);
  if (!el) return;
  const start = 0;
  const duration = 600;
  const startTime = performance.now();

  function update(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const ease = 1 - Math.pow(1 - progress, 3); // ease-out cubic
    const current = Math.round(start + (targetValue - start) * ease);
    el.textContent = fmt(current);
    if (progress < 1) requestAnimationFrame(update);
  }
  requestAnimationFrame(update);
}

/** Poner texto raw en elemento con fade */
function animateValueRaw(elementId, text) {
  const el = document.getElementById(elementId);
  if (!el) return;
  el.style.opacity = '0';
  setTimeout(() => {
    el.textContent = text;
    el.style.transition = 'opacity 0.3s';
    el.style.opacity = '1';
  }, 150);
}

/** Scroll suave a sección */
function scrollToSection(id) {
  const el = document.getElementById(id);
  if (el) {
    const offset = 80;
    const top = el.getBoundingClientRect().top + window.scrollY - offset;
    window.scrollTo({ top, behavior: 'smooth' });
  }
}

// ─── Highlight de nav pills según scroll ───────────────────────────────────
const sections = ['mod1', 'mod2', 'mod3'];
window.addEventListener('scroll', () => {
  const scrollY = window.scrollY + 120;
  sections.forEach(id => {
    const el = document.getElementById(id);
    const btn = document.getElementById(`nav-btn-${id}`);
    if (!el || !btn) return;
    const top = el.offsetTop;
    const bottom = top + el.offsetHeight;
    if (scrollY >= top && scrollY < bottom) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
}, { passive: true });
