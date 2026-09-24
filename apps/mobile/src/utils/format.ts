export const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

// "YYYY-MM" del mes actual (hora local del teléfono).
export function mesActual(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// 452 -> "7 h 32 min". Sin dato -> "— —".
export function formatearMinutos(min: number | null | undefined): string {
  if (min == null) return "— —";
  return `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, "0")} min`;
}

export function porcentaje(valor: number | null | undefined): string {
  return valor == null ? "—" : `${valor}%`;
}
