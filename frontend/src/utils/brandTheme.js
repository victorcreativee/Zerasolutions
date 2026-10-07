const parse = (value, fallback) => /^#[0-9a-f]{6}$/i.test(value || "") ? [1, 3, 5].map((offset) => parseInt(value.slice(offset, offset + 2), 16)) : fallback;
const luminance = (rgb) => rgb.map((v) => v / 255).map((v) => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4).reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
export function brandTheme(business) {
  if (!business?.useBrandTheme) return {};
  let primary = parse(business.brandPrimaryColor, [21, 128, 61]);
  // Darken light colors until white labels have sufficient contrast.
  while (luminance(primary) > 0.175) primary = primary.map((v) => Math.floor(v * 0.94));
  const secondary = parse(business.brandSecondaryColor, primary);
  const tint = (amount) => secondary.map((v) => Math.round(v * amount + 255 * (1 - amount))).join(" ");
  return { "--zera-green": primary.join(" "), "--zera-green-dark": primary.map((v) => Math.round(v * 0.8)).join(" "), "--zera-mint": tint(0.12), "--zera-mint-soft": tint(0.05) };
}
