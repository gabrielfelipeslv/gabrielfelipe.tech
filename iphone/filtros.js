// Filtros da página de iPhone: os cartões já vêm no HTML; aqui só escondemos, mostramos e ordenamos.
(function () {
  var grade = document.getElementById('grade');
  var cartoes = Array.prototype.slice.call(grade.querySelectorAll('.cartao'));
  var busca = document.getElementById('busca');
  var ordem = document.getElementById('ordem');
  var teto = document.getElementById('teto');
  var tetoValor = document.getElementById('teto-valor');
  var contagem = document.getElementById('contagem');
  var vazio = document.getElementById('vazio');
  var estado = { categoria: '', condicao: '', memoria: '', pronta: '' };
  var brl = function (v) { return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); };
  var semAcento = function (s) { return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); };

  function aplicar() {
    var termos = semAcento(busca.value.trim()).split(/\s+/).filter(Boolean);
    var limite = Number(teto.value);
    var visiveis = 0;
    cartoes.forEach(function (c) {
      var ofertas = Array.prototype.slice.call(c.querySelectorAll('.oferta'));
      var algumaOferta = false;
      ofertas.forEach(function (o) {
        var ok = (!estado.condicao || o.dataset.condicao === estado.condicao) && Number(o.dataset.preco) <= limite;
        o.hidden = !ok;
        if (ok) algumaOferta = true;
      });
      var texto = semAcento(c.querySelector('h3').textContent + ' ' + c.dataset.categoria + (c.dataset.categoria === 'mac' ? ' macbook' : ''));
      var ok = algumaOferta
        && (!estado.categoria || c.dataset.categoria === estado.categoria)
        && (!estado.memoria || c.dataset.memoria === estado.memoria)
        && (!estado.pronta || c.dataset.pronta === '1')
        && termos.every(function (t) { return texto.indexOf(t) >= 0; });
      c.hidden = !ok;
      if (ok) visiveis++;
    });
    contagem.textContent = visiveis === 1 ? '1 opção' : visiveis + ' opções';
    vazio.hidden = visiveis > 0;
    tetoValor.textContent = brl(limite);
  }

  function ordenar() {
    var m = ordem.value;
    var menor = function (c) {
      var ps = Array.prototype.slice.call(c.querySelectorAll('.oferta:not([hidden])')).map(function (o) { return Number(o.dataset.preco); });
      return ps.length ? Math.min.apply(null, ps) : Number(c.dataset.menor);
    };
    var lista = cartoes.slice();
    if (m === 'barato') lista.sort(function (a, b) { return menor(a) - menor(b); });
    else if (m === 'caro') lista.sort(function (a, b) { return menor(b) - menor(a); });
    lista.forEach(function (c) { grade.appendChild(c); });
  }

  document.querySelectorAll('.chip').forEach(function (b) {
    b.addEventListener('click', function () {
      var f = b.dataset.filtro;
      var valor = b.dataset.valor;
      if (f === 'pronta') valor = b.getAttribute('aria-pressed') === 'true' ? '' : '1';
      estado[f] = valor;
      document.querySelectorAll('.chip[data-filtro="' + f + '"]').forEach(function (x) {
        x.setAttribute('aria-pressed', String(f === 'pronta' ? valor === '1' : x.dataset.valor === valor));
      });
      aplicar(); ordenar();
    });
  });
  busca.addEventListener('input', function () { aplicar(); ordenar(); });
  teto.addEventListener('input', function () { aplicar(); ordenar(); });
  ordem.addEventListener('change', ordenar);

  // ?q=15 pro max na URL já abre filtrado (útil para mandar o link de um modelo).
  try { var q = new URLSearchParams(location.search).get('q'); if (q) busca.value = q; } catch (e) {}
  aplicar(); ordenar();
})();
