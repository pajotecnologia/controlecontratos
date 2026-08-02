const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

// Soma n meses a uma data "YYYY-MM-DD", com clamp no último dia do mês de destino
// (ex.: 31/01 + 1 mês -> 28/02). Retorna "YYYY-MM-DD".
function addMonths(dateStr, n) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const targetMonthIndex = (m - 1) + n;
  const year = y + Math.floor(targetMonthIndex / 12);
  const month = ((targetMonthIndex % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const day = Math.min(d, lastDay);
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

// Deriva "Mes/Ano" a partir de "YYYY-MM-DD"
function mesReferenciaFrom(dateStr) {
  const [y, m] = dateStr.split("-").map(Number);
  return `${MESES[m - 1]}/${y}`;
}

module.exports = { MESES, addMonths, mesReferenciaFrom };
