#!/usr/bin/env node
// Gera /produtos/ (todas as marcas) e /iphone/ (só Apple) a partir de produtos/precos.json, que tem SÓ preço de venda
// (o repositório é público; nunca o preço do fornecedor). Quem atualiza o precos.json é a sala "Valores de produtos".
//   node produtos/gerar.mjs
// Visual no padrão da loja da Apple (pedido do Gabriel, 22/11/2026: "mais profissional … familiar"): branco e cinza
// #f5f5f7, texto #1d1d1f, azul #0066cc, cartões limpos, preço pequeno, novo e seminovo LADO A LADO, sem imagem
// inventada. O script dos filtros vai dentro da página (um arquivo .js separado ficava velho no cache do celular).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dados = JSON.parse(fs.readFileSync(path.join(raiz, 'produtos', 'precos.json'), 'utf8'));
const SITE = 'https://gabrielfelipe.tech';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const brl = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
// Regra do Gabriel: em 12x, cada parcela é o preço à vista dividido por 10. Parcelamento até 18x.
const parcela12 = (v) => brl(Math.round(v * 10) / 100);
const slug = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const geracao = (m) => { if (/XR/.test(m)) return 10; if (/Duo/.test(m)) return 19; const n = m.match(/(\d+)/); return n ? Number(n[1]) : 0; };
const ordemMem = (m) => ({ '64 GB': 0, '128 GB': 1, '256 GB': 2, '512 GB': 3, '1 TB': 4, '2 TB': 5 }[m] ?? 9);
const ESTADO = { lacrado: 'Novo', seminovo: 'Seminovo' };
const zap = (texto) => `https://wa.me/${dados.whatsapp}?text=${encodeURIComponent(texto)}`;
const dataBr = dados.atualizadoEm.split('-').reverse().join('/');
// Foto oficial do fabricante em produtos/fotos/<modelo>.webp (iPhone: loja da Apple; Xiaomi/Poco: mi.com). Sem foto, sem imagem.
const FOTOS = new Set(fs.readdirSync(path.join(raiz, 'produtos', 'fotos')).filter((f) => f.endsWith('.webp')).map((f) => f.replace(/.webp$/, '')));
const foto = (modelo) => { const s = slug(modelo); return FOTOS.has(s) ? `/produtos/fotos/${s}.webp` : null; };

function precoBloco(o) {
  return `<div class="valor" data-condicao="${o.condicao}" data-preco="${o.preco}">
            <span class="estado">${ESTADO[o.condicao]}${o.grade ? ` <span class="nota">${esc(o.grade)}</span>` : ''}${o.aPartir ? ' <span class="apartir">· a partir de</span>' : ''}</span>
            <span class="preco">${brl(o.preco)}</span>
            <span class="parcela">ou 12x de ${parcela12(o.preco)}</span>
          </div>`;
}

function pagina({ caminho, itens, titulo, h1, sub, descricao, mostrarMarca }) {
  const url = SITE + caminho;
  const grupos = new Map();
  for (const original of itens) {
    const it = original.condicao === 'cpo' ? { ...original, condicao: 'lacrado' } : original;
    const chave = [it.marca, it.modelo, it.memoria, it.ram || ''].join('|');
    if (!grupos.has(chave)) grupos.set(chave, { ...it, ofertas: {} });
    const g = grupos.get(chave); const ja = g.ofertas[it.condicao];
    if (!ja) g.ofertas[it.condicao] = it;
    else g.ofertas[it.condicao] = { ...(it.preco < ja.preco ? it : ja), aPartir: true, preco: Math.min(it.preco, ja.preco) };
  }
  const ordemMarca = (m) => (m === 'Apple' ? 0 : 1);
  const lista = [...grupos.values()].sort((a, b) => ordemMarca(a.marca) - ordemMarca(b.marca) || a.marca.localeCompare(b.marca)
    || geracao(b.modelo) - geracao(a.modelo) || /Max/.test(b.modelo) - /Max/.test(a.modelo) || /Pro/.test(b.modelo) - /Pro/.test(a.modelo)
    || a.modelo.localeCompare(b.modelo) || ordemMem(a.memoria) - ordemMem(b.memoria));

  const cartoes = lista.map((g) => {
    const ofertas = ['lacrado', 'seminovo'].map((c) => g.ofertas[c]).filter(Boolean);
    const nome = `${g.modelo} ${g.memoria}${g.ram ? ` · ${g.ram} RAM` : ''}`;
    const menor = Math.min(...ofertas.map((o) => o.preco));
    const pronta = ofertas.some((o) => o.pronta);
    return `
      <article class="cartao" id="${slug(`${g.marca} ${nome}`)}" data-marca="${esc(g.marca)}" data-memoria="${g.memoria}"
        data-geracao="${geracao(g.modelo)}" data-menor="${menor}" data-pronta="${pronta ? 1 : 0}" data-busca="${esc(`${g.marca} ${g.modelo} ${g.memoria}`.toLowerCase())}">
        ${foto(g.modelo) ? `<img class="foto" src="${foto(g.modelo)}" alt="${esc(g.modelo)}" width="240" height="240" loading="lazy" decoding="async">` : ''}
        ${pronta ? '<span class="pronta">Pronta entrega</span>' : ''}
        ${mostrarMarca ? `<span class="marca">${esc(g.marca)}</span>` : ''}
        <h3>${esc(g.modelo)}</h3>
        <p class="memoria">${g.memoria}${g.ram ? ` · ${esc(g.ram)} de RAM` : ''}</p>
        <div class="valores n${ofertas.length}">
          ${ofertas.map(precoBloco).join('\n          ')}
        </div>
        <a class="comprar" href="${zap(`Oi, Gabriel! Vi no site e quero saber do ${nome}.`)}" target="_blank" rel="noopener">Comprar</a>
      </article>`;
  }).join('');

  const conta = (m) => itens.filter((i) => i.marca === m).length;
  const marcas = [...new Set(itens.map((i) => i.marca))].sort((a, b) => ordemMarca(a) - ordemMarca(b) || conta(b) - conta(a));
  const estados = ['lacrado', 'seminovo'].filter((c) => itens.some((i) => (i.condicao === 'cpo' ? 'lacrado' : i.condicao) === c));
  const memorias = [...new Set(itens.map((i) => i.memoria))].sort((a, b) => ordemMem(a) - ordemMem(b));
  const temSeminovo = estados.includes('seminovo');
    const temPronta = itens.some((i) => i.pronta);
  const seg = (filtro, rotulo, opcoes) => `<div class="segmento" role="group" aria-label="${rotulo}">
        ${opcoes.map(([v, t], i) => `<button type="button" data-filtro="${filtro}" data-valor="${esc(v)}" aria-pressed="${i === 0}">${esc(t)}</button>`).join('')}
      </div>`;

  const jsonLd = {
    '@context': 'https://schema.org', '@type': 'ItemList', name: titulo,
    itemListElement: lista.map((g, i) => ({
      '@type': 'ListItem', position: i + 1,
      item: {
        '@type': 'Product', name: `${g.modelo} ${g.memoria}`, brand: { '@type': 'Brand', name: g.marca }, ...(foto(g.modelo) ? { image: SITE + foto(g.modelo) } : {}),
        url: `${url}#${slug(`${g.marca} ${g.modelo} ${g.memoria}${g.ram ? ` · ${g.ram} RAM` : ''}`)}`,
        offers: Object.values(g.ofertas).map((o) => ({
          '@type': 'Offer', price: o.preco.toFixed(2), priceCurrency: 'BRL',
          itemCondition: o.condicao === 'lacrado' ? 'https://schema.org/NewCondition' : 'https://schema.org/UsedCondition',
          availability: 'https://schema.org/InStock', seller: { '@type': 'Person', name: 'Gabriel Felipe' },
        })),
      },
    })),
  };

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(titulo)}</title>
<meta name="description" content="${esc(descricao)}">
<link rel="canonical" href="${url}">
<meta name="robots" content="${dados.noGoogle ? 'noindex, follow' : 'index, follow, max-image-preview:large'}">
<meta property="og:type" content="website">
<meta property="og:locale" content="pt_BR">
<meta property="og:url" content="${url}">
<meta property="og:title" content="${esc(h1)}">
<meta property="og:description" content="${esc(descricao)}">
<meta property="og:image" content="${SITE}/assets/compartilhar.jpg">
<meta name="theme-color" content="#f5f5f7">
<link rel="icon" href="/assets/icone-180.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
<style>
  :root {
    --fundo: #f5f5f7; --branco: #ffffff; --texto: #1d1d1f; --texto-2: #6e6e73; --texto-3: #86868b; --linha: #d2d2d7;
    --azul: #0066cc; --azul-botao: #0071e3; --azul-botao-hover: #0077ed; --verde: #008009;
    --fonte: -apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Helvetica Neue", Inter, Arial, sans-serif;
  }
  *, *::before, *::after { box-sizing: border-box; }
  [hidden] { display: none !important; }
  html { -webkit-text-size-adjust: 100%; }
  body { margin: 0; font: 400 17px/1.47 var(--fonte); letter-spacing: -.022em; color: var(--texto); background: var(--fundo); -webkit-font-smoothing: antialiased; }
  a { color: var(--azul); text-decoration: none; }
  a:hover { text-decoration: underline; }
  .largura { max-width: 1024px; margin: 0 auto; padding-inline: max(22px, env(safe-area-inset-left, 0px)) max(22px, env(safe-area-inset-right, 0px)); }
  button, input, select { font: inherit; letter-spacing: inherit; color: inherit; }
  :focus-visible { outline: 2px solid var(--azul); outline-offset: 2px; }

  .nav { background: rgba(251,251,253,.8); backdrop-filter: saturate(180%) blur(20px); border-bottom: 1px solid rgba(0,0,0,.08); }
  .nav .largura { height: 44px; display: flex; align-items: center; justify-content: space-between; gap: 16px; font-size: 12px; letter-spacing: -.01em; }
  .nav a { color: var(--texto); opacity: .85; }
  .nav a:hover { opacity: 1; text-decoration: none; }
  .nav .links { display: flex; gap: 22px; }
  .nav [aria-current] { opacity: 1; font-weight: 600; }

  .cabeca .largura { padding-block: 44px 24px; display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: space-between; gap: 12px 32px; }
  h1 { margin: 0; font-size: clamp(32px, 6vw, 48px); line-height: 1.08; font-weight: 600; letter-spacing: -.015em; }
  h1 span { color: var(--texto-2); }
  .cabeca p { margin: 0; color: var(--texto-2); font-size: 15px; max-width: 32ch; }
  .cabeca .ajuda { display: block; color: var(--texto); font-weight: 600; }

  .filtros { position: sticky; top: 0; z-index: 5; background: rgba(245,245,247,.92); backdrop-filter: saturate(180%) blur(20px); }
  .filtros .largura { padding-block: 12px; display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }
  .segmento { display: inline-flex; background: #e8e8ed; border-radius: 9px; padding: 2px; gap: 2px; }
  .segmento button { border: 0; background: transparent; padding: 5px 14px; border-radius: 7px; font-size: 14px; color: var(--texto); cursor: pointer; white-space: nowrap; }
  .segmento button[aria-pressed="true"] { background: var(--branco); box-shadow: 0 1px 3px rgba(0,0,0,.12); font-weight: 600; }
  .campo { position: relative; flex: 1 1 200px; min-width: 0; }
  .campo input { width: 100%; height: 34px; border: 1px solid var(--linha); border-radius: 9px; background: var(--branco); padding: 0 12px 0 32px; font-size: 14px; }
  .campo svg { position: absolute; left: 10px; top: 50%; transform: translateY(-50%); width: 14px; height: 14px; fill: var(--texto-3); }
  select { height: 34px; border: 1px solid var(--linha); border-radius: 9px; background: var(--branco); padding: 0 10px; font-size: 14px; }

  main .largura { padding-block: 10px 56px; }
  .contagem { font-size: 14px; color: var(--texto-2); margin: 0 0 14px; }
  .grade { display: grid; grid-template-columns: repeat(auto-fill, minmax(290px, 1fr)); gap: 20px; align-items: start; }
  .cartao { position: relative; background: var(--branco); border-radius: 18px; padding: 26px 24px 22px; display: flex; flex-direction: column; gap: 4px; transition: box-shadow .25s; scroll-margin-top: 80px; }
  .cartao:hover { box-shadow: 2px 4px 12px rgba(0,0,0,.08); }
  .cartao:target { box-shadow: 0 0 0 2px var(--azul); }
  .foto { display: block; width: 100%; max-width: 220px; height: auto; aspect-ratio: 1; object-fit: contain; margin: 0 auto 14px; }
  .marca { font-size: 12px; color: var(--texto-3); font-weight: 600; }
  .pronta { position: absolute; top: 18px; right: 20px; font-size: 12px; color: #b64400; font-weight: 600; }
  h3 { margin: 0; font-size: 21px; line-height: 1.19; font-weight: 600; letter-spacing: .011em; }
  .memoria { margin: 0 0 14px; font-size: 14px; color: var(--texto-2); }
  .valores { display: grid; gap: 14px; padding: 14px 0 16px; border-top: 1px solid #e8e8ed; }
  .valores.n2 { grid-template-columns: 1fr 1fr; }
  .valores.n3 { grid-template-columns: 1fr 1fr 1fr; gap: 10px; }
  .valor { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
  .valor[hidden] { display: none; }
  .estado { font-size: 12px; color: var(--texto-2); font-weight: 600; }
  .nota { font-weight: 400; color: var(--texto-3); }
  .preco { font-size: 17px; font-weight: 600; white-space: nowrap; }
  .apartir { font-weight: 400; color: var(--texto-3); }
  .parcela { font-size: 12px; color: var(--texto-2); white-space: nowrap; }
  .n3 .preco { font-size: 15px; }
  .comprar { align-self: flex-start; background: var(--azul-botao); color: #fff; border-radius: 980px; padding: 7px 16px; font-size: 14px; }
  .comprar:hover { background: var(--azul-botao-hover); text-decoration: none; }
  .vazio { text-align: center; color: var(--texto-2); padding: 48px 16px; }

  .info { background: var(--branco); }
  .info .largura { padding-block: 40px; display: grid; gap: 24px; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); }
  .info h2 { margin: 0 0 4px; font-size: 17px; font-weight: 600; }
  .info p { margin: 0; font-size: 14px; color: var(--texto-2); }
  .rodape { background: var(--fundo); }
  .rodape .largura { padding-block: 18px 34px; font-size: 12px; color: var(--texto-3); }
  @media (max-width: 640px) {
    .filtros { position: static; }
    .filtros .largura { gap: 8px; }
    .segmento { max-width: 100%; overflow-x: auto; scrollbar-width: none; }
    .grade { gap: 14px; }
    .cartao { padding: 22px 20px 20px; }
    .valores.n3 { grid-template-columns: 1fr 1fr; }
    .foto { max-width: 150px; margin-bottom: 8px; }
  }
</style>
</head>
<body>
<nav class="nav" aria-label="Navegação">
  <div class="largura">
    <a href="/">Gabriel Felipe</a>
    <span class="links">
      <a href="/produtos/"${caminho === '/produtos/' ? ' aria-current="page"' : ''}>Todos os produtos</a>
      <a href="/iphone/"${caminho === '/iphone/' ? ' aria-current="page"' : ''}>iPhone</a>
      <a href="${zap('Oi, Gabriel! Vi os preços no site.')}" target="_blank" rel="noopener">WhatsApp</a>
    </span>
  </div>
</nav>

<header class="cabeca">
  <div class="largura">
    <h1>${h1}</h1>
    <p>${sub}<span class="ajuda">Atualizado em ${dataBr}.</span></p>
  </div>
</header>

<div class="filtros" role="search">
  <div class="largura">
    ${mostrarMarca && marcas.length > 1 ? seg('marca', 'Marca', [['', 'Todas'], ...marcas.map((m) => [m, m])]) : ''}
    ${estados.length > 1 ? seg('condicao', 'Estado', [['', 'Todos'], ...estados.map((c) => [c, ESTADO[c] + (c === 'seminovo' ? 's' : c === 'lacrado' ? 's' : '')])]) : ''}
    ${temPronta ? seg('pronta', 'Pronta entrega', [['', 'Todos'], ['1', 'Pronta entrega']]) : ''}
    <select id="memoria" aria-label="Memória">
      <option value="">Toda memória</option>
      ${memorias.map((m) => `<option value="${m}">${m}</option>`).join('')}
    </select>
    <select id="ordem" aria-label="Ordenar">
      <option value="novo">Mais recentes</option>
      <option value="barato">Menor preço</option>
      <option value="caro">Maior preço</option>
    </select>
    <label class="campo" for="busca"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M6.5 1a5.5 5.5 0 0 1 4.38 8.82l3.65 3.65-1.06 1.06-3.65-3.65A5.5 5.5 0 1 1 6.5 1Zm0 1.5a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z"/></svg>
      <input id="busca" type="search" placeholder="Buscar modelo" autocomplete="off" aria-label="Buscar modelo"></label>
  </div>
</div>

<main>
  <div class="largura">
    <p class="contagem" id="contagem">${lista.length} modelos</p>
    <div class="grade" id="grade">${cartoes}
    </div>
    <p class="vazio" id="vazio" hidden>Nenhum modelo com esses filtros. <a href="${zap('Oi, Gabriel! Procuro um aparelho que não achei no site.')}" target="_blank" rel="noopener">Me diga qual você procura.</a></p>
  </div>
</main>

<section class="info" aria-label="Como funciona">
  <div class="largura">
    <div><h2>Até 18x no cartão</h2><p>À vista no Pix ou em 12x com parcela de um décimo do valor. Também parcelo em até 18x.</p></div>
    ${temSeminovo ? `<div><h2>Seminovos revisados</h2><p>Bateria em torno de ${dados.bateriaSeminovo}%. A letra ao lado é a nota de conservação: A+ é a melhor.</p></div>` : ''}
    <div><h2>Compra pelo WhatsApp</h2><p>Toque em Comprar, escolha a cor e combine a entrega comigo.</p></div>
  </div>
</section>
<footer class="rodape"><div class="largura">Valores enquanto durarem os estoques e sujeitos a alteração. As marcas citadas pertencem aos seus donos; esta página não é de nenhum fabricante.</div></footer>

<script>
(function () {
  var grade = document.getElementById('grade');
  var cartoes = Array.prototype.slice.call(grade.querySelectorAll('.cartao'));
  var busca = document.getElementById('busca'), ordem = document.getElementById('ordem'), memoria = document.getElementById('memoria');
  var contagem = document.getElementById('contagem'), vazio = document.getElementById('vazio');
  var estado = { marca: '', condicao: '', pronta: '' };
  var limpo = function (s) { return s.normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').toLowerCase(); };
  function aplicar() {
    var termos = limpo(busca.value.trim()).split(/\\s+/).filter(Boolean), n = 0;
    cartoes.forEach(function (c) {
      var algum = false;
      c.querySelectorAll('.valor').forEach(function (v) {
        var ok = !estado.condicao || v.getAttribute('data-condicao') === estado.condicao;
        v.hidden = !ok; if (ok) algum = true;
      });
      var visiveis = c.querySelectorAll('.valor:not([hidden])').length;
      var caixa = c.querySelector('.valores'); caixa.className = 'valores n' + visiveis;
      var ok = algum && (!estado.marca || c.getAttribute('data-marca') === estado.marca)
        && (!estado.pronta || c.getAttribute('data-pronta') === '1')
        && (!memoria.value || c.getAttribute('data-memoria') === memoria.value)
        && termos.every(function (t) { return limpo(c.getAttribute('data-busca')).indexOf(t) >= 0; });
      c.hidden = !ok; if (ok) n++;
    });
    contagem.textContent = n === 1 ? '1 modelo' : n + ' modelos';
    vazio.hidden = n > 0;
    ordenar();
  }
  function menor(c) {
    var ps = Array.prototype.map.call(c.querySelectorAll('.valor:not([hidden])'), function (v) { return Number(v.getAttribute('data-preco')); });
    return ps.length ? Math.min.apply(null, ps) : Number(c.getAttribute('data-menor'));
  }
  function ordenar() {
    var l = cartoes.slice();
    if (ordem.value === 'barato') l.sort(function (a, b) { return menor(a) - menor(b); });
    else if (ordem.value === 'caro') l.sort(function (a, b) { return menor(b) - menor(a); });
    l.forEach(function (c) { grade.appendChild(c); });
  }
  document.querySelectorAll('.segmento button').forEach(function (b) {
    b.addEventListener('click', function () {
      var f = b.getAttribute('data-filtro');
      estado[f] = b.getAttribute('data-valor');
      b.parentNode.querySelectorAll('button').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
      aplicar();
    });
  });
  busca.addEventListener('input', aplicar);
  memoria.addEventListener('change', aplicar);
  ordem.addEventListener('change', ordenar);
  try {
    var p = new URLSearchParams(location.search);
    if (p.get('q')) busca.value = p.get('q');
    var m = p.get('marca');
    if (m) document.querySelectorAll('.segmento button[data-filtro="marca"]').forEach(function (b) { if (b.getAttribute('data-valor').toLowerCase() === m.toLowerCase()) b.click(); });
  } catch (e) {}
  aplicar();
})();
</script>
</body>
</html>
`;
}

const apple = dados.itens.filter((i) => i.marca === 'Apple');
const menor = (lista) => brl(Math.min(...lista.map((i) => i.preco)));
const ordemTodas = (a, b) => (a === 'Apple' ? -1 : b === 'Apple' ? 1 : dados.itens.filter((i) => i.marca === b).length - dados.itens.filter((i) => i.marca === a).length);
const marcasTodas = [...new Set(dados.itens.map((i) => i.marca))].sort(ordemTodas);
const paginas = [
  {
    caminho: '/produtos/', itens: dados.itens, mostrarMarca: true,
    titulo: `Celulares novos e seminovos: ${marcasTodas.join(', ')} | Gabriel Felipe`,
    h1: 'Celulares. <span>Novos e seminovos.</span>',
    sub: `${marcasTodas.join(', ')}. Em até 18x no cartão.`,
    descricao: `Preços de celulares novos e seminovos (${marcasTodas.join(', ')}), a partir de ${menor(dados.itens)}, em 12x ou até 18x. Escolha a marca, a memória e compre pelo WhatsApp.`,
  },
  {
    caminho: '/iphone/', itens: apple, mostrarMarca: false,
    titulo: 'iPhone novo e seminovo: preços atualizados | Gabriel Felipe',
    h1: 'iPhone. <span>Novo e seminovo.</span>',
    sub: 'Do iPhone 11 ao iPhone 18 Pro Max e iPhone Duo. Em até 18x no cartão.',
    descricao: `Preços de iPhone novo e seminovo (bateria em torno de ${dados.bateriaSeminovo}%), a partir de ${menor(apple)}, em 12x ou até 18x. Escolha o modelo e a memória e compre pelo WhatsApp.`,
  },
];
for (const p of paginas) {
  const dir = path.join(raiz, p.caminho.replace(/^\/|\/$/g, ''));
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), pagina(p));
  console.log(`${p.caminho}: ${p.itens.length} ofertas, atualizado em ${dataBr}${dados.noGoogle ? ' (noindex)' : ''}`);
}
