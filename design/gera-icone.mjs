// Transforma a logo enviada (JPG com fundo texturizado) nos icones do app.
// A marca e chapada em dois tons; a textura do fundo so atrapalha e pesa.
import sharp from "sharp";

const ENTRADA = "./logo-mqc.jpg";
const SAIDA = "../public";

const NAVY = [4, 38, 73];
const LARANJA = [221, 87, 35];
const FUNDO = [237, 234, 229];
const CINZA_ORIGINAL = [176, 168, 160]; // o fundo texturizado da arte enviada

const dist = (r, g, b, c) => (r - c[0]) ** 2 + (g - c[1]) ** 2 + (b - c[2]) ** 2;

const { data, info } = await sharp(ENTRADA)
  .removeAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });

for (let i = 0; i < data.length; i += info.channels) {
  const r = data[i], g = data[i + 1], b = data[i + 2];
  const cands = [
    [NAVY, dist(r, g, b, NAVY)],
    [LARANJA, dist(r, g, b, LARANJA)],
    [FUNDO, dist(r, g, b, CINZA_ORIGINAL)],
  ].sort((a, c) => a[1] - c[1]);
  const cor = cands[0][0];
  data[i] = cor[0]; data[i + 1] = cor[1]; data[i + 2] = cor[2];
}

const limpo = sharp(data, { raw: { width: info.width, height: info.height, channels: info.channels } });
const marca = await limpo.png().toBuffer();

// A marca ocupa 80% do quadrado: sobra margem para o recorte redondo que
// Android e iOS aplicam no icone.
for (const tamanho of [512, 192, 180]) {
  const interno = Math.round(tamanho * 0.8);
  const redimensionada = await sharp(marca)
    .resize(interno, interno, { fit: "contain", background: FUNDO })
    .toBuffer();
  const borda = Math.round((tamanho - interno) / 2);
  await sharp(redimensionada)
    .extend({ top: borda, bottom: tamanho - interno - borda, left: borda, right: tamanho - interno - borda,
              background: FUNDO })
    .png({ compressionLevel: 9, palette: true })
    .toFile(`${SAIDA}/icon-${tamanho}.png`);
  const meta = await sharp(`${SAIDA}/icon-${tamanho}.png`).metadata();
  console.log(`icon-${tamanho}.png`, meta.width + "x" + meta.height, meta.size + " bytes");
}
