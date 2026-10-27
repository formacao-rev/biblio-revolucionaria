/* Biblioteca: busca + filtros facetados (tema, subtema, autor, tipo, idioma, período, tag)
   Dados em obras.json. Estado de filtros fica na URL (#...), então dá para compartilhar buscas. */

const $ = (s) => document.querySelector(s);
const norm = (s) => (s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pt = new Intl.Collator('pt-BR', { sensitivity: 'base' });

const PAGINA = 50;
const PERIODOS = [
  ['Antiguidade', -Infinity, 500],
  ['Medieval', 500, 1500],
  ['Moderno', 1500, 1800],
  ['Contemporâneo', 1800, Infinity],
];
const periodoDe = (a) => (a == null ? '' : (PERIODOS.find(([, i, f]) => a >= i && a < f) || [''])[0]);
const fmtAno = (a) => (a == null ? '' : a < 0 ? `${-a} a.C.` : String(a));

let obras = [];
let visiveis = PAGINA;

// estado dos filtros
const S = { q: '', tema: '', subtema: '', autor: '', tipo: [], idioma: [], periodo: '', tag: '', ord: 'titulo' };

/* ---------- filtragem ---------- */
// `ignorar`: lista de filtros a desconsiderar (usado para contar as opções de cada grupo)
function passa(o, ignorar = []) {
  const x = (k) => !ignorar.includes(k);
  if (x('q') && S.q && !S.q.split(/\s+/).every((w) => o._busca.includes(w))) return false;
  if (x('tema') && S.tema && o.tema !== S.tema) return false;
  if (x('subtema') && S.subtema && o.subtema !== S.subtema) return false;
  if (x('autor') && S.autor && o.autor !== S.autor) return false;
  if (x('tipo') && S.tipo.length && !S.tipo.includes(o.tipo)) return false;
  if (x('idioma') && S.idioma.length && !S.idioma.includes(o.idioma)) return false;
  if (x('periodo') && S.periodo && o._periodo !== S.periodo) return false;
  if (x('tag') && S.tag && !(o.tags || []).some((t) => norm(t) === norm(S.tag))) return false;
  return true;
}

function contar(campo, ignorar) {
  const m = new Map();
  for (const o of obras) {
    if (!passa(o, ignorar)) continue;
    const v = campo === 'periodo' ? o._periodo : o[campo];
    if (v) m.set(v, (m.get(v) || 0) + 1);
  }
  return m;
}

const filtrosAtivos = () =>
  S.q || S.tema || S.subtema || S.autor || S.tipo.length || S.idioma.length || S.periodo || S.tag;

function ordenar(lista) {
  const a = [...lista];
  const por = {
    titulo: (x, y) => pt.compare(x.titulo, y.titulo),
    autor: (x, y) => pt.compare(x.autor || '', y.autor || '') || pt.compare(x.titulo, y.titulo),
    ano: (x, y) => (x.ano ?? 1e9) - (y.ano ?? 1e9),
    'ano-desc': (x, y) => (y.ano ?? -1e9) - (x.ano ?? -1e9),
  };
  return a.sort(por[S.ord] || por.titulo);
}

/* ---------- render ---------- */
function itemHTML(o) {
  // Linha 1: "Título - Autor" (o título é o link). Linha 2: tipo (livro, vídeo...).
  // As tags NÃO aparecem na tela, mas continuam valendo na busca (ver _busca no fim do arquivo).
  const titulo = o.link
    ? `<a class="titulo" href="${esc(o.link)}" target="_blank" rel="noopener">${esc(o.titulo)}</a>`
    : `<span class="titulo">${esc(o.titulo)}</span>`;
  const autor = o.autor ? `<span class="autor"> - ${esc(o.autor)}</span>` : '';
  const tipo = o.tipo ? `<span class="tipo">${esc(o.tipo.toLowerCase())}</span>` : '';
  return `<li><div class="linha">${titulo}${autor}</div>${tipo}</li>`;
}

const opt = (f, v, n, on) =>
  `<li><button class="opt${on ? ' on' : ''}" type="button" data-f="${f}" data-v="${esc(v)}"><span>${esc(v)}</span><span class="n">${n}</span></button></li>`;
const chip = (f, v, n, on) =>
  `<button class="chip${on ? ' on' : ''}" type="button" data-f="${f}" data-v="${esc(v)}">${esc(v)}<span class="n">${n}</span></button>`;

function renderFiltros() {
  let h = '';

  // Tema > subtema (o subtema aparece ao escolher o tema)
  const temas = [...contar('tema', ['tema', 'subtema'])].sort((a, b) => pt.compare(a[0], b[0]));
  h += '<div class="grupo"><h3>Tema</h3><ul>';
  for (const [t, n] of temas) {
    h += opt('tema', t, n, S.tema === t);
    if (S.tema === t) {
      const subs = [...contar('subtema', ['subtema'])].filter(([s]) =>
        obras.some((o) => o.tema === t && o.subtema === s)).sort((a, b) => pt.compare(a[0], b[0]));
      if (subs.length) h += `<li><ul class="sub">${subs.map(([s, c]) => opt('subtema', s, c, S.subtema === s)).join('')}</ul></li>`;
    }
  }
  h += '</ul></div>';

  // Período
  const per = contar('periodo', ['periodo']);
  h += '<div class="grupo"><h3>Período</h3><div class="chips">';
  for (const [nome] of PERIODOS) if (per.get(nome) || S.periodo === nome) h += chip('periodo', nome, per.get(nome) || 0, S.periodo === nome);
  h += '</div></div>';

  // Tipo
  const tipos = [...contar('tipo', ['tipo'])].sort((a, b) => pt.compare(a[0], b[0]));
  if (tipos.length) {
    h += '<div class="grupo"><h3>Tipo</h3><div class="chips">';
    for (const [t, n] of tipos) h += chip('tipo', t, n, S.tipo.includes(t));
    h += '</div></div>';
  }

  // Idioma
  const idiomas = [...contar('idioma', ['idioma'])].sort((a, b) => pt.compare(a[0], b[0]));
  if (idiomas.length) {
    h += '<div class="grupo"><h3>Idioma</h3><div class="chips">';
    for (const [t, n] of idiomas) h += chip('idioma', t, n, S.idioma.includes(t));
    h += '</div></div>';
  }

  // Autor (select, porque pode haver centenas)
  const autores = [...contar('autor', ['autor'])].sort((a, b) => pt.compare(a[0], b[0]));
  h += '<div class="grupo"><h3>Autor</h3><select id="autor"><option value="">todos</option>';
  for (const [a, n] of autores) h += `<option value="${esc(a)}"${S.autor === a ? ' selected' : ''}>${esc(a)} (${n})</option>`;
  h += '</select></div>';

  if (filtrosAtivos()) h += '<button class="limpar" type="button" data-f="limpar">limpar filtros</button>';
  $('#filtros').innerHTML = h;
}

function renderAtivos() {
  const itens = [];
  if (S.q) itens.push(['q', S.q, `busca: ${S.q}`]);
  if (S.tema) itens.push(['tema', S.tema, S.tema]);
  if (S.subtema) itens.push(['subtema', S.subtema, S.subtema]);
  if (S.autor) itens.push(['autor', S.autor, S.autor]);
  S.tipo.forEach((v) => itens.push(['tipo', v, v]));
  S.idioma.forEach((v) => itens.push(['idioma', v, v]));
  if (S.periodo) itens.push(['periodo', S.periodo, S.periodo]);
  if (S.tag) itens.push(['tag', S.tag, `#${S.tag}`]);
  $('#ativos').innerHTML = itens
    .map(([f, v, txt]) => `<button class="ativo" type="button" data-f="${f}" data-v="${esc(v)}">${esc(txt)}</button>`)
    .join('');
}

function renderLista() {
  const lista = ordenar(obras.filter((o) => passa(o)));
  $('#contagem').textContent = `[ ${lista.length} ${lista.length === 1 ? 'obra' : 'obras'} ]`;

  // destaques só aparecem sem filtros
  const mostrarDest = !filtrosAtivos();
  const dest = mostrarDest ? lista.filter((o) => o.destaque) : [];
  $('#bloco-destaques').hidden = dest.length === 0;
  $('#destaques').innerHTML = dest.map(itemHTML).join('');

  const resto = dest.length ? lista.filter((o) => !o.destaque) : lista;
  $('#lista').innerHTML = resto.slice(0, visiveis).map(itemHTML).join('');
  $('#vazio').hidden = lista.length > 0;
  $('#mais').hidden = resto.length <= visiveis;
  $('#mais').textContent = `mostrar mais (${resto.length - visiveis} restantes)`;
}

function atualizar() {
  const busca = $('#busca');
  if (document.activeElement !== busca) busca.value = S.q;
  $('#ordem').value = S.ord;
  renderFiltros();
  renderAtivos();
  renderLista();
  salvarHash();
}

/* ---------- estado na URL ---------- */
function salvarHash() {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(S)) {
    if (Array.isArray(v)) { if (v.length) p.set(k, v.join('|')); }
    else if (v && !(k === 'ord' && v === 'titulo')) p.set(k, v);
  }
  history.replaceState(null, '', p.toString() ? '#' + p : location.pathname + location.search);
}
function carregarHash() {
  const p = new URLSearchParams(location.hash.slice(1));
  for (const k of Object.keys(S)) {
    if (!p.has(k)) continue;
    S[k] = Array.isArray(S[k]) ? p.get(k).split('|').filter(Boolean) : p.get(k);
  }
}

/* ---------- eventos ---------- */
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-f]');
  if (!b) return;
  const { f, v } = b.dataset;
  if (f === 'limpar') {
    Object.assign(S, { q: '', tema: '', subtema: '', autor: '', tipo: [], idioma: [], periodo: '', tag: '' });
  } else if (f === 'tema') {
    S.tema = S.tema === v ? '' : v; S.subtema = '';
  } else if (Array.isArray(S[f])) {
    S[f] = S[f].includes(v) ? S[f].filter((x) => x !== v) : [...S[f], v];
  } else {
    S[f] = S[f] === v ? '' : v;
  }
  visiveis = PAGINA;
  atualizar();
});

$('#busca').addEventListener('input', (e) => { S.q = norm(e.target.value.trim()); visiveis = PAGINA; atualizar(); });
$('#ordem').addEventListener('change', (e) => { S.ord = e.target.value; atualizar(); });
$('#filtros').addEventListener('change', (e) => {
  if (e.target.id === 'autor') { S.autor = e.target.value; visiveis = PAGINA; atualizar(); }
});
$('#mais').addEventListener('click', () => { visiveis += PAGINA; renderLista(); });
$('#abrir-filtros').addEventListener('click', () => $('#filtros').classList.toggle('aberto'));

/* ---------- início ---------- */
fetch('obras.json')
  .then((r) => r.json())
  .then((dados) => {
    obras = dados.map((o) => ({
      ...o,
      _periodo: periodoDe(o.ano),
      _busca: norm([o.titulo, o.autor, o.tema, o.subtema, ...(o.tags || [])].join(' ')),
    }));
    carregarHash();
    atualizar();
  })
  .catch(() => { $('#vazio').hidden = false; $('#vazio').textContent = 'Não foi possível carregar obras.json.'; });

/* ---------- abas: Curso / Biblioteca ---------- */
document.querySelectorAll('[data-aba]').forEach((b) => b.addEventListener('click', () => {
  const alvo = b.dataset.aba;
  document.querySelectorAll('[data-aba]').forEach((x) => x.classList.toggle('on', x === b));
  $('#view-curso').hidden = alvo !== 'curso';
  $('#view-biblioteca').hidden = alvo !== 'biblioteca';
}));

/* ---------- curso: módulos recolhíveis (curso.json) ---------- */
const abrirTodos = (aberto) =>
  document.querySelectorAll('#modulos details').forEach((d) => { d.open = aberto; });
$('#expandir-tudo').addEventListener('click', () => abrirTodos(true));
$('#recolher-tudo').addEventListener('click', () => abrirTodos(false));

fetch('curso.json')
  .then((r) => r.json())
  .then((modulos) => {
    $('#modulos').innerHTML = modulos.map((m, i) => `
      <details class="modulo"${i === 0 ? ' open' : ''}>
        <summary><span class="modulo-titulo">${esc(m.titulo)}</span></summary>
        <p class="modulo-desc">${esc(m.descricao || '')}</p>
        <ol class="leituras">
          ${(m.leituras || []).map((l) => `
            <li>
              <div class="linha">${l.link
                ? `<a class="titulo" href="${esc(l.link)}" target="_blank" rel="noopener">${esc(l.titulo)}</a>`
                : `<span class="titulo">${esc(l.titulo)}</span>`}<span class="autor"> - ${esc(l.autor || '')}</span></div>
              <span class="tipo">${l.ano != null ? esc(fmtAno(l.ano)) : ''}</span>
            </li>`).join('')}
        </ol>
      </details>`).join('');
  })
  .catch(() => { $('#curso-erro').hidden = false; });
