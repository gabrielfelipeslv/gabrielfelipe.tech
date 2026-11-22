#!/usr/bin/env node
// Gera iphone/index.html a partir de iphone/precos.json (os preços de VENDA; nunca o preço do fornecedor).
//   node iphone/gerar.mjs
// Os cartões saem prontos no HTML (o Google lê sem rodar script) e filtros.js só esconde/mostra e ordena.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const pasta = path.dirname(fileURLToPath(import.meta.url));
const dados = JSON.parse(fs.readFileSync(path.join(pasta, 'precos.json'), 'utf8'));
const URL_PAGINA = 'https://gabrielfelipe.tech/iphone/';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const brl = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
// Regra do Gabriel (22/11/2026): em 12x, cada parcela é o preço à vista dividido por 10. Parcelamento até 18x.
const parcela12 = (v) => Math.round(v * 10) / 100;
const slug = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const geracao = (m) => { if (/XR/.test(m)) return 10; if (/Duo/.test(m)) return 19; const n = m.match(/iPhone (\d+)/); return n ? Number(n[1]) : 0; };
const ordemMem = (m) => ({ '64 GB': 0, '128 GB': 1, '256 GB': 2, '512 GB': 3, '1 TB': 4, '2 TB': 5 }[m] ?? 9);

// Ilustração do aparelho (até as fotos oficiais entrarem em iphone/fotos/<slug>.webp).
function desenho(modelo, cat) {
  if (cat === 'mac') {
    return `<svg viewBox="0 0 120 120" aria-hidden="true"><rect x="22" y="30" width="76" height="50" rx="4" class="d-corpo"/><rect x="26" y="34" width="68" height="42" rx="2" class="d-tela"/><path d="M12 84h96l-6 8H18z" class="d-corpo"/><rect x="52" y="84" width="16" height="2" rx="1" class="d-detalhe"/></svg>`;
  }
  const g = geracao(modelo);
  const pro = /Pro/.test(modelo);
  const air = /Air/.test(modelo);
  const lente = (x, y, r = 5.2) => `<circle cx="${x}" cy="${y}" r="${r}" class="d-lente"/><circle cx="${x}" cy="${y}" r="${r * 0.45}" class="d-vidro"/>`;
  let camera;
  if (air) camera = `<rect x="38" y="16" width="44" height="13" rx="6.5" class="d-modulo"/>${lente(47, 22.5, 4.6)}`;
  else if (pro && g >= 17) camera = `<rect x="38" y="15" width="44" height="26" rx="8" class="d-modulo"/>${lente(48, 23)}${lente(48, 33.5)}${lente(60, 28)}`;
  else if (pro) camera = `<rect x="40" y="16" width="26" height="26" rx="8" class="d-modulo"/>${lente(47, 23.5)}${lente(47, 34.5)}${lente(58.5, 29)}`;
  else if (g === 10) camera = `<rect x="41" y="17" width="13" height="13" rx="5" class="d-modulo"/>${lente(47.5, 23.5, 4.4)}`;
  else camera = `<rect x="40" y="16" width="16" height="27" rx="8" class="d-modulo"/>${lente(48, 23.5)}${lente(48, 35)}`;
  return `<svg viewBox="0 0 120 120" aria-hidden="true"><rect x="36" y="10" width="48" height="100" rx="12" class="d-corpo ${pro ? 'd-titanio' : 'd-cor'}"/>${camera}<circle cx="60" cy="70" r="5" class="d-maca"/></svg>`;
}

// Um cartão por modelo + memória, com o novo lacrado e o seminovo lado a lado.
const grupos = new Map();
for (const it of dados.itens) {
  const chave = `${it.modelo}|${it.memoria}`;
  if (!grupos.has(chave)) grupos.set(chave, { modelo: it.modelo, memoria: it.memoria, categoria: it.categoria, ofertas: {} });
  grupos.get(chave).ofertas[it.condicao] = it;
}
const lista = [...grupos.values()].sort((a, b) => (a.categoria === b.categoria ? 0 : a.categoria === 'iphone' ? -1 : 1)
  || geracao(b.modelo) - geracao(a.modelo) || /Max/.test(b.modelo) - /Max/.test(a.modelo) || /Pro/.test(b.modelo) - /Pro/.test(a.modelo)
  || a.modelo.localeCompare(b.modelo) || ordemMem(a.memoria) - ordemMem(b.memoria));

const zap = (texto) => `https://wa.me/${dados.whatsapp}?text=${encodeURIComponent(texto)}`;

const ROTULOS = { lacrado: 'Novo lacrado', cpo: 'Lacrado CPO', seminovo: 'Seminovo' };
function oferta(o, rotulo, extra) {
  return `<div class="oferta oferta-${o.condicao}" data-condicao="${o.condicao}" data-preco="${o.preco}">
          <span class="rotulo">${rotulo}${o.grade ? ` <b class="nota" title="Nota de conservação">${esc(o.grade)}</b>` : ''}${o.pronta ? ' <b class="pronta">Pronta entrega</b>' : ''}</span>
          <strong class="preco">${o.aPartir ? '<small>a partir de</small> ' : ''}${brl(o.preco)}</strong>
          ${o.cores && o.cores.length ? `<span class="cores">${o.cores.map(esc).join(', ')}</span>` : ''}
          <span class="parcela">12x de ${brl(parcela12(o.preco))} · ou até 18x</span>
          ${extra || ''}
        </div>`;
}

const cartoes = lista.map((g) => {
  const { lacrado, cpo, seminovo } = g.ofertas;
  const nome = `${g.modelo} ${g.memoria}`;
  const menor = Math.min(...Object.values(g.ofertas).map((o) => o.preco));
  const pronta = Object.values(g.ofertas).some((o) => o.pronta);
  const pedido = `Oi, Gabriel! Vi no site e quero saber do ${nome}${lacrado && !seminovo ? ' novo lacrado' : seminovo && !lacrado ? ' seminovo' : ''}.`;
  return `
    <article class="cartao" id="${slug(nome)}" data-categoria="${g.categoria}" data-modelo="${esc(g.modelo.toLowerCase())}" data-memoria="${g.memoria}"
      data-geracao="${geracao(g.modelo)}" data-menor="${menor}" data-pronta="${pronta ? 1 : 0}">
      <div class="foto">${desenho(g.modelo, g.categoria)}</div>
      <div class="corpo">
        <h3>${esc(g.modelo)} <span class="mem">${g.memoria}</span></h3>
        <div class="ofertas">
          ${lacrado ? oferta(lacrado, ROTULOS.lacrado) : ''}
          ${cpo ? oferta(cpo, ROTULOS.cpo, '<span class="nota-cpo">Recondicionado pela Apple, lacrado</span>') : ''}
          ${seminovo ? oferta(seminovo, 'Seminovo', `<span class="bateria" title="Saúde da bateria dos seminovos">Bateria em torno de ${dados.bateriaSeminovo}%</span>`) : ''}
        </div>
        <a class="quero" href="${zap(pedido)}" target="_blank" rel="noopener">Quero este no WhatsApp</a>
      </div>
    </article>`;
}).join('');

const memorias = [...new Set(dados.itens.map((i) => i.memoria))].sort((a, b) => ordemMem(a) - ordemMem(b));
const precoMax = Math.ceil(Math.max(...dados.itens.map((i) => i.preco)) / 500) * 500;
const menorIphone = Math.min(...dados.itens.filter((i) => i.categoria === 'iphone').map((i) => i.preco));
const dataBr = dados.atualizadoEm.split('-').reverse().join('/');
const temPronta = dados.itens.some((i) => i.pronta);
const temMac = dados.itens.some((i) => i.categoria === 'mac');
const temCpo = dados.itens.some((i) => i.condicao === 'cpo');
const modelosIphone = dados.itens.filter((i) => i.categoria === 'iphone').map((i) => i.modelo).sort((a, b) => geracao(a) - geracao(b));
const faixaModelos = `do ${modelosIphone[0]} ao ${modelosIphone[modelosIphone.length - 1]}`;

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'ItemList',
  name: 'iPhone e MacBook novos e seminovos',
  itemListElement: lista.map((g, i) => ({
    '@type': 'ListItem', position: i + 1,
    item: {
      '@type': 'Product', name: `${g.modelo} ${g.memoria}`, brand: { '@type': 'Brand', name: 'Apple' }, url: `${URL_PAGINA}#${slug(`${g.modelo} ${g.memoria}`)}`,
      offers: Object.values(g.ofertas).map((o) => ({
        '@type': 'Offer', price: o.preco.toFixed(2), priceCurrency: 'BRL',
        itemCondition: o.condicao === 'lacrado' ? 'https://schema.org/NewCondition' : o.condicao === 'cpo' ? 'https://schema.org/RefurbishedCondition' : 'https://schema.org/UsedCondition',
        availability: 'https://schema.org/InStock', seller: { '@type': 'Person', name: 'Gabriel Felipe' },
      })),
    },
  })),
};

const html = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>iPhone novo e seminovo: preços atualizados | Gabriel Felipe</title>
<meta name="description" content="Preços de iPhone novo lacrado e seminovo (bateria em torno de ${dados.bateriaSeminovo}%), ${faixaModelos}. A partir de ${brl(menorIphone)}, em 12x ou até 18x. Filtre por modelo, memória e preço e chame no WhatsApp.">
<link rel="canonical" href="${URL_PAGINA}">
<meta name="robots" content="${dados.noGoogle === false ? 'index, follow, max-image-preview:large' : 'noindex, follow'}">
<meta property="og:type" content="website">
<meta property="og:locale" content="pt_BR">
<meta property="og:url" content="${URL_PAGINA}">
<meta property="og:title" content="iPhone novo e seminovo: preços atualizados">
<meta property="og:description" content="Novo lacrado e seminovo lado a lado, com parcelamento em até 18x. Atualizado em ${dataBr}.">
<meta property="og:image" content="https://gabrielfelipe.tech/assets/compartilhar.jpg">
<meta name="theme-color" content="#061226">
<link rel="icon" href="/assets/icone-180.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Schibsted+Grotesk:wght@400..900&display=swap" rel="stylesheet">
<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
<style>
  /* Mesma identidade do portfólio: azul-noite, cobalto, verde do WhatsApp, Schibsted Grotesk. */
  :root {
    --noite: #061226; --noite-2: #0B1D3A; --noite-fio: #1C3157; --noite-texto: #AFC0DD;
    --papel: #F2F5F9; --branco: #FFFFFF; --tinta: #0B1A31; --tinta-2: #4B5A73; --tinta-3: #77849A; --fio: #DDE3EC;
    --cobalto: #2F5BFF; --cobalto-escuro: #1E3FCC; --cobalto-fundo: #E9EEFF; --zap: #25D366; --zap-tinta: #04291A;
    --ambar: #B45309; --ambar-fundo: #FEF3C7;
    --fonte: "Schibsted Grotesk", "Segoe UI", system-ui, sans-serif;
    --raio: 18px; --raio-p: 12px;
    --sombra: 0 1px 2px rgba(11,26,49,.06), 0 12px 32px -12px rgba(11,26,49,.18);
  }
  *, *::before, *::after { box-sizing: border-box; }
  html { -webkit-text-size-adjust: 100%; }
  body { margin: 0; font: 400 16px/1.5 var(--fonte); color: var(--tinta); background: var(--papel); }
  a { color: inherit; }
  .largura { max-width: 1180px; margin: 0 auto; padding-inline: max(16px, env(safe-area-inset-left, 0px)) max(16px, env(safe-area-inset-right, 0px)); }

  .topo { background: var(--noite); color: #fff; }
  .topo .largura { padding-block: 18px 34px; }
  .nav { display: flex; justify-content: space-between; align-items: center; gap: 12px; font-weight: 600; }
  .nav a { text-decoration: none; color: var(--noite-texto); font-size: 14px; }
  .nav a:hover { color: #fff; }
  h1 { font-size: clamp(30px, 5vw, 50px); line-height: 1.05; letter-spacing: -.02em; margin: 26px 0 10px; text-wrap: balance; font-weight: 800; }
  h1 em { font-style: normal; color: #8EA8FF; }
  .sub { color: var(--noite-texto); max-width: 62ch; margin: 0; font-size: 17px; }
  .fatos { display: flex; flex-wrap: wrap; gap: 8px 18px; margin-top: 18px; font-size: 14px; color: #fff; }
  .fatos span { display: inline-flex; gap: 6px; align-items: center; }
  .fatos span::before { content: ""; width: 7px; height: 7px; border-radius: 50%; background: var(--zap); }

  .filtros { position: sticky; top: 0; z-index: 5; background: rgba(242,245,249,.94); backdrop-filter: blur(8px); border-bottom: 1px solid var(--fio); }
  .filtros .largura { padding-block: 12px; display: grid; gap: 10px; }
  .linha { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
  .busca { flex: 1 1 220px; min-width: 0; font: inherit; padding: 10px 14px; border: 1px solid var(--fio); border-radius: 999px; background: var(--branco); }
  .busca:focus-visible, .chip:focus-visible, select:focus-visible, input[type=range]:focus-visible, .quero:focus-visible { outline: 3px solid var(--cobalto); outline-offset: 2px; }
  .chip { font: 600 14px var(--fonte); padding: 7px 13px; border-radius: 999px; border: 1px solid var(--fio); background: var(--branco); color: var(--tinta-2); cursor: pointer; }
  .chip[aria-pressed="true"] { background: var(--noite); border-color: var(--noite); color: #fff; }
  .grupo-rotulo { font-size: 12px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: var(--tinta-3); margin-right: 2px; }
  select { font: 600 14px var(--fonte); padding: 8px 10px; border-radius: 999px; border: 1px solid var(--fio); background: var(--branco); color: var(--tinta); }
  .faixa { display: flex; align-items: center; gap: 8px; font-size: 14px; color: var(--tinta-2); }
  .faixa input { width: 160px; accent-color: var(--cobalto); }

  main .largura { padding-block: 22px 60px; }
  .resumo { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 8px; color: var(--tinta-2); font-size: 14px; margin-bottom: 14px; }
  .grade { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px; align-items: start; }
  .cartao { background: var(--branco); border: 1px solid var(--fio); border-radius: var(--raio); display: grid; grid-template-columns: 96px 1fr; gap: 14px; padding: 16px; box-shadow: var(--sombra); scroll-margin-top: 150px; }
  .cartao:target { outline: 3px solid var(--cobalto); }
  .foto { display: grid; place-items: center; background: var(--papel); border-radius: var(--raio-p); aspect-ratio: 1; max-width: 100%; }
  .foto svg { width: 100%; height: auto; }
  .d-corpo { fill: #D7DCE4; } .d-titanio { fill: #B9B2A6; } .d-cor { fill: #C9D6EA; } .d-tela { fill: var(--noite-2); }
  .d-modulo { fill: rgba(11,26,49,.14); } .d-lente { fill: #1B2638; } .d-vidro { fill: #3D5A8A; } .d-maca { fill: rgba(11,26,49,.18); } .d-detalhe { fill: #9AA5B5; }
  .corpo { min-width: 0; display: grid; gap: 10px; align-content: start; }
  h3 { margin: 0; font-size: 18px; line-height: 1.2; font-weight: 750; letter-spacing: -.01em; }
  .mem { display: inline-block; font-size: 13px; font-weight: 700; color: var(--cobalto-escuro); background: var(--cobalto-fundo); padding: 2px 8px; border-radius: 999px; vertical-align: 2px; }
  .ofertas { display: grid; gap: 8px; }
  .oferta { display: grid; gap: 1px; padding: 9px 11px; border-radius: var(--raio-p); border: 1px solid var(--fio); }
  .oferta-lacrado { background: #F7F9FF; }
  .rotulo { font-size: 12px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; color: var(--tinta-3); }
  .preco { font-size: 22px; font-weight: 800; letter-spacing: -.02em; }
  .parcela { font-size: 13px; color: var(--tinta-2); }
  .bateria { font-size: 13px; color: var(--tinta-2); display: inline-flex; gap: 6px; align-items: center; }
  .bateria::before { content: ""; width: 18px; height: 9px; border: 1.5px solid currentColor; border-radius: 2px; background: linear-gradient(90deg, var(--zap) 85%, transparent 85%); }
  .preco small { font-size: 12px; font-weight: 600; color: var(--tinta-3); letter-spacing: 0; }
  .cores { font-size: 13px; color: var(--tinta-2); }
  .cores::before { content: "Cores: "; color: var(--tinta-3); }
  .nota-cpo { font-size: 12.5px; color: var(--tinta-3); }
  .oferta-cpo { background: #F6FBF8; }
  .nota { display: inline-block; margin-left: 6px; color: var(--cobalto-escuro); background: var(--cobalto-fundo); padding: 1px 7px; border-radius: 999px; letter-spacing: 0; }
  .pronta { display: inline-block; margin-left: 6px; color: var(--ambar); background: var(--ambar-fundo); padding: 1px 7px; border-radius: 999px; letter-spacing: 0; text-transform: none; }
  .quero { display: inline-flex; justify-content: center; align-items: center; gap: 8px; text-decoration: none; font-weight: 700; font-size: 15px; background: var(--zap); color: var(--zap-tinta); padding: 10px 14px; border-radius: 999px; }
  .quero:hover { filter: brightness(.96); }
  .vazio { text-align: center; color: var(--tinta-2); padding: 40px 16px; }

  .info { border-top: 1px solid var(--fio); background: var(--branco); }
  .info .largura { padding-block: 34px; display: grid; gap: 22px; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); }
  .info h2 { font-size: 18px; margin: 0 0 6px; }
  .info p { margin: 0; color: var(--tinta-2); font-size: 15px; }
  .rodape { font-size: 13px; color: var(--tinta-3); padding-block: 18px 30px; }
  @media (max-width: 760px) {
    .filtros { position: static; }
    .filtros .linha:not(:first-child) { flex-wrap: nowrap; overflow-x: auto; padding-bottom: 4px; scrollbar-width: none; }
    .filtros .linha:not(:first-child)::-webkit-scrollbar { display: none; }
    .chip, .faixa { flex: 0 0 auto; }
  }
  @media (max-width: 420px) { .cartao { grid-template-columns: 72px 1fr; } .faixa input { width: 120px; } }
  @media (prefers-reduced-motion: no-preference) { .cartao { transition: transform .2s; } .cartao:hover { transform: translateY(-2px); } }
</style>
</head>
<body>
<header class="topo">
  <div class="largura">
    <nav class="nav"><a href="/">Gabriel Felipe</a><a href="${zap('Oi, Gabriel! Vi a tabela de iPhone no site.')}" target="_blank" rel="noopener">Falar no WhatsApp</a></nav>
    <h1>iPhone novo e seminovo, <em>com preço na tela</em></h1>
    <p class="sub">Novo lacrado e seminovo lado a lado, ${faixaModelos}${temMac ? ', e MacBook' : ''}. Escolha a memória, veja a parcela e me chame no WhatsApp.</p>
    <div class="fatos"><span>Atualizado em ${dataBr}</span><span>12x ou até 18x no cartão</span><span>Seminovo com bateria em torno de ${dados.bateriaSeminovo}%</span></div>
  </div>
</header>

<div class="filtros" role="search">
  <div class="largura">
    <div class="linha">
      <label class="grupo-rotulo" for="busca">Buscar</label>
      <input class="busca" id="busca" type="search" placeholder="Ex.: 15 Pro Max, 256, MacBook Air" autocomplete="off">
      <select id="ordem" aria-label="Ordenar">
        <option value="novo">Mais novos primeiro</option>
        <option value="barato">Menor preço</option>
        <option value="caro">Maior preço</option>
      </select>
    </div>
    <div class="linha" aria-label="Filtros">
      ${temMac ? `<span class="grupo-rotulo">Tipo</span>
      <button class="chip" type="button" data-filtro="categoria" data-valor="" aria-pressed="true">Todos</button>
      <button class="chip" type="button" data-filtro="categoria" data-valor="iphone" aria-pressed="false">iPhone</button>
      <button class="chip" type="button" data-filtro="categoria" data-valor="mac" aria-pressed="false">MacBook</button>` : ''}
      <span class="grupo-rotulo">Estado</span>
      <button class="chip" type="button" data-filtro="condicao" data-valor="" aria-pressed="true">Todos</button>
      <button class="chip" type="button" data-filtro="condicao" data-valor="lacrado" aria-pressed="false">Novo lacrado</button>
      ${temCpo ? '<button class="chip" type="button" data-filtro="condicao" data-valor="cpo" aria-pressed="false">Lacrado CPO</button>' : ''}
      <button class="chip" type="button" data-filtro="condicao" data-valor="seminovo" aria-pressed="false">Seminovo</button>
      ${temPronta ? '<button class="chip" type="button" data-filtro="pronta" data-valor="1" aria-pressed="false">Pronta entrega</button>' : ''}
    </div>
    <div class="linha">
      <span class="grupo-rotulo">Memória</span>
      <button class="chip" type="button" data-filtro="memoria" data-valor="" aria-pressed="true">Todas</button>
      ${memorias.map((m) => `<button class="chip" type="button" data-filtro="memoria" data-valor="${m}" aria-pressed="false">${m}</button>`).join('\n      ')}
      <label class="faixa" for="teto">Até <output id="teto-valor">${brl(precoMax)}</output>
        <input id="teto" type="range" min="1000" max="${precoMax}" step="250" value="${precoMax}"></label>
    </div>
  </div>
</div>

<main>
  <div class="largura">
    <div class="resumo"><span id="contagem">${lista.length} opções</span><span>Valores enquanto durarem os estoques.</span></div>
    <div class="grade" id="grade">${cartoes}
    </div>
    <p class="vazio" id="vazio" hidden>Nenhum aparelho com esses filtros. Tire um filtro ou <a href="${zap('Oi, Gabriel! Procuro um iPhone que não achei na tabela.')}" target="_blank" rel="noopener">me diga qual você procura</a>.</p>
  </div>
</main>

<section class="info" aria-label="Como funciona">
  <div class="largura">
    <div><h2>Parcelamento</h2><p>À vista no Pix ou em 12x no cartão, com parcela de um décimo do valor à vista. Também parcelo em até 18x.</p></div>
    <div><h2>Seminovos</h2><p>Aparelhos revisados, com a saúde da bateria em torno de ${dados.bateriaSeminovo}%. A letra é a nota de conservação (A+ é a melhor; podem ter pequenos detalhes).</p></div>
    ${temCpo ? '<div><h2>Lacrado CPO</h2><p>Recondicionado pela própria Apple e vendido lacrado, com preço menor que o novo.</p></div>' : ''}
    <div><h2>Como comprar</h2><p>Toque em "Quero este no WhatsApp", confirme a cor e a disponibilidade e combine a entrega.</p></div>
  </div>
  <p class="largura rodape">Imagens ilustrativas. iPhone e MacBook são marcas da Apple Inc.; esta página não é da Apple. Preços sujeitos a alteração.</p>
</section>
<script src="filtros.js" defer></script>
</body>
</html>
`;
fs.writeFileSync(path.join(pasta, 'index.html'), html);
console.log(`iphone/index.html: ${lista.length} cartões, ${dados.itens.length} ofertas, atualizado em ${dataBr}`);
