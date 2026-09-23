// Paleta extraída de src/index.css del diseño Figma Make original.
// Mantener sincronizada si el equipo de diseño actualiza el archivo fuente.

export const colors = {
  // Marca / acción principal (teal)
  primary: "#176b70",
  primaryDark: "#10555b",
  primaryLight: "#e7f3f2",
  primarySoft: "#e8f4f3",

  // Texto
  textDark: "#14213d",
  textHeading: "#11213b",
  textBody: "#3c4859",
  textMuted: "#7b8796",
  textFaint: "#98a2ac",

  // Fondos
  bgApp: "#e9eef4",
  bgScreen: "#f8fafb",
  bgLoginScreen: "#fbfcfd",
  bgCard: "#ffffff",

  // Bordes
  border: "#e5eaee",
  borderLight: "#edf0f2",

  // Estados
  success: "#2d8a64",
  successBg: "#e7f4ee",
  successStrong: "#37a474",
  warning: "#bd6c31",
  warningBg: "#fff0e2",
  danger: "#bd584c",

  // Info secundaria
  infoBlue: "#3d668b",
  infoBlueBg: "#ebf1f6",

  white: "#ffffff",
} as const;

export const gradients = {
  brand: [colors.primary, colors.primaryDark] as const,
  loginMark: ["#1c7c80", "#11575d"] as const,
};
