export const colors = {
  brand: '#880000',
  brandHover: '#6b0000',
  bgPage: '#f5f5f5',
  bgCard: '#ffffff',
  border: '#e5e7eb',
  textPrimary: '#111111',
  textSecondary: '#6b7280',
  success: '#10b981',
  successBg: '#d1fae5',
  successText: '#065f46',
  warning: '#f59e0b',
  warningBg: '#fef3c7',
  warningText: '#92400e',
  error: '#dc2626',
  errorStrong: '#ef4444',
  errorBg: '#fef2f2',
  errorText: '#991b1b',
  errorBorder: '#fca5a5',
  info: '#3b82f6',
  infoBg: '#eff6ff',
  infoText: '#1e40af',
  neutral: '#9ca3af',
  btnSecondary: '#4b5563',
};

export function gradeStyle(value) {
  const n = parseFloat(value);
  if (isNaN(n)) return { bg: colors.warningBg, text: colors.warningText };
  if (n >= 9) return { solid: colors.success, soft: { bg: colors.successBg, text: colors.successText } };
  if (n >= 6) return { solid: colors.warning, soft: { bg: colors.warningBg, text: colors.warningText } };
  return { solid: colors.errorStrong, soft: { bg: colors.errorBg, text: colors.errorText } };
}
