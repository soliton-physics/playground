/*
 * One page for every simulation, at /sim/<id>, and an index of them all at /sim. Search engines see a page of its own
 * for each: its own title, description, the textbook's answers and what can be changed, with the live simulation one
 * click away. The pages are written before Vite starts, from the engine's own catalogues, so they never drift from
 * what the playground runs. They are generated, not kept in git: see .gitignore.
 */
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const SITE = 'https://solitonplay.com';

/** The engine's areas, and the playground mode each one opens in. */
const AREAS = [
  ['mechanics', 'mechanics', 'MechanicsWorld'],
  ['optics', 'optics', 'OpticsBench'],
  ['thermal', 'thermal', 'ThermalGas'],
  ['statmech', 'thermal', 'StatRun'],
  ['circuits', 'circuits', 'CircuitBench'],
  ['modern', 'modern', 'ModernRun'],
  ['matter', 'matter', 'MatterRun'],
  ['magnetism', 'magnetism', 'MagnetismRun'],
];

/** NCERT chapter order, so the index reads like the textbook. */
const NCERT = {
  11: [
    'Units and measurement',
    'Motion in a straight line',
    'Motion in a plane',
    'Laws of motion',
    'Work, energy and power',
    'System of particles and rotational motion',
    'Gravitation',
    'Mechanical properties of solids',
    'Mechanical properties of fluids',
    'Thermal properties of matter',
    'Thermodynamics',
    'Kinetic theory',
    'Oscillations',
    'Waves',
  ],
  12: [
    'Electric charges and fields',
    'Electrostatic potential and capacitance',
    'Current electricity',
    'Moving charges and magnetism',
    'Magnetism and matter',
    'Electromagnetic induction',
    'Alternating current',
    'Electromagnetic waves',
    'Ray optics and optical instruments',
    'Wave optics',
    'Dual nature of radiation and matter',
    'Atoms',
    'Nuclei',
    'Semiconductor electronics',
  ],
  0: ['Showcase', 'Monte Carlo methods', 'Phase transitions'],
};

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const classLabel = (c) => (c ? `Class ${c}` : 'Beyond the syllabus');

/** A number as a person would write it: four significant figures, no trailing zeros, powers of ten when extreme. */
function number(v) {
  if (typeof v !== 'number' || !Number.isFinite(v)) return '—';
  if (v === 0) return '0';
  const size = Math.abs(v);
  if (size >= 1e6 || size < 1e-3) {
    const [m, e] = v.toExponential(3).split('e');
    return `${Number(m)} × 10<sup>${Number(e)}</sup>`;
  }
  return Number(v.toPrecision(4)).toLocaleString('en-IN', { maximumFractionDigits: 6 });
}

/** A meta description: the first sentences that fit in about 155 characters. */
function summary(text) {
  if (text.length <= 158) return text;
  const cut = text.slice(0, 155);
  const end = cut.lastIndexOf('. ');
  return end > 80 ? cut.slice(0, end + 1) : cut.slice(0, cut.lastIndexOf(' ')) + '…';
}

async function loadEngine(root) {
  const dir = join(root, 'engine');
  const engine = await import(join(dir, 'soliton_wasm.js'));
  await engine.default({ module_or_path: readFileSync(join(dir, 'soliton_wasm_bg.wasm')) });
  return engine;
}

/** The textbook's answers at the default settings, or none if the area cannot give them without running. */
function answersOf(engine, cls, id) {
  try {
    if (cls === 'MechanicsWorld') {
      const world = new engine.MechanicsWorld(id, {}, 5);
      const out = world.exact();
      world.free();
      return out;
    }
    const run = new engine[cls](id, {});
    const out = run.answers();
    run.free?.();
    return out;
  } catch {
    return [];
  }
}

function head({ title, description, path, jsonld }) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <title>${esc(title)}</title>
    <meta name="description" content="${esc(description)}" />
    <link rel="canonical" href="${SITE}${path}" />
    <meta name="robots" content="index, follow, max-image-preview:large" />
    <meta name="theme-color" content="#05070f" />
    <link rel="icon" href="/favicon.ico" sizes="48x48" />
    <link rel="icon" href="/icon-192.png" type="image/png" sizes="192x192" />
    <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
    <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="Soliton" />
    <meta property="og:url" content="${SITE}${path}" />
    <meta property="og:title" content="${esc(title)}" />
    <meta property="og:description" content="${esc(description)}" />
    <meta property="og:image" content="${SITE}/og.png" />
    <meta property="og:locale" content="en_IN" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${esc(title)}" />
    <meta name="twitter:description" content="${esc(description)}" />
    <meta name="twitter:image" content="${SITE}/og.png" />
    <script type="application/ld+json">${JSON.stringify(jsonld).replace(/</g, '\\u003c')}</script>
    <!-- Vercel Web Analytics: visits counted without cookies. -->
    <!-- Your own visits: open any page once with ?analytics=off and this browser is no longer counted; ?analytics=on undoes it. -->
    <script>(function () { var q = new URLSearchParams(location.search).get('analytics'); try { if (q === 'off') localStorage.setItem('soliton-analytics', 'off'); if (q === 'on') localStorage.removeItem('soliton-analytics'); } catch (e) {} var off = false; try { off = localStorage.getItem('soliton-analytics') === 'off'; } catch (e) {} window.va = window.va || function () { (window.vaq = window.vaq || []).push(arguments); }; if (off) window.va('beforeSend', function () { return null; }); if (q === 'off' || q === 'on') alert(off ? 'Done: visits from this browser are no longer counted in Soliton analytics. Open any page with ?analytics=on to undo.' : 'Done: visits from this browser are counted again.'); })();</script>
    <script defer src="/_vercel/insights/script.js"></script>
  </head>
  <body class="sim-page">
    <div class="backdrop" aria-hidden="true"><span class="orb orb-1"></span><span class="orb orb-2"></span><span class="orb orb-3"></span></div>
    <header class="nav">
      <div class="wrap nav-row">
        <a class="brand" href="/"><img src="/favicon.svg" alt="" width="32" height="32" /><span>Soliton</span></a>
        <nav class="nav-links">
          <a href="/sim">All simulations</a>
          <a href="https://docs.solitonplay.com">Docs</a>
          <a class="button small" href="/play">Launch playground <span class="arrow">→</span></a>
        </nav>
      </div>
    </header>
`;
}

const foot = `
    <footer class="footer">
      <div class="wrap footer-row">
        <a class="brand" href="/"><img src="/favicon.svg" alt="" width="24" height="24" /><span>Soliton</span></a>
        <nav>
          <a href="/sim">All simulations</a>
          <a href="/play">Playground</a>
          <a href="https://docs.solitonplay.com">Docs</a>
          <a href="https://www.npmjs.com/package/@soliton-physics/engine">npm</a>
          <a href="https://pypi.org/project/soliton-physics/">PyPI</a>
        </nav>
        <small>© 2026 Soliton Physics. Free to use.</small>
      </div>
    </footer>
    <script type="module" src="/src/sim/sim.ts"></script>
  </body>
</html>
`;

function simPage(sim, siblings) {
  const { id, title, description, syllabus, params } = sim;
  const where = syllabus.class ? `${classLabel(syllabus.class)} physics` : 'physics, beyond the syllabus';
  const pageTitle = `${title}: free interactive simulation, ${where} | Soliton`;
  const path = `/sim/${id}`;
  const play = `/play?mode=${sim.mode}&scenario=${id}`;
  const chapterAnchor = `/sim#${slug(syllabus.chapter)}`;
  const jsonld = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'LearningResource',
        name: title,
        description,
        url: SITE + path,
        learningResourceType: 'Simulation',
        interactivityType: 'active',
        isAccessibleForFree: true,
        inLanguage: 'en-IN',
        educationalLevel: syllabus.class ? `Class ${syllabus.class}` : undefined,
        teaches: syllabus.topic,
        about: syllabus.chapter,
        ...(syllabus.class
          ? { educationalAlignment: { '@type': 'AlignmentObject', alignmentType: 'educationalSubject', targetName: `NCERT Physics, ${classLabel(syllabus.class)}: ${syllabus.chapter}` } }
          : {}),
        publisher: { '@type': 'Organization', name: 'Soliton Physics', url: SITE },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Simulations', item: `${SITE}/sim` },
          { '@type': 'ListItem', position: 2, name: syllabus.chapter, item: `${SITE}${chapterAnchor}` },
          { '@type': 'ListItem', position: 3, name: title, item: SITE + path },
        ],
      },
    ],
  };

  const answers = sim.answers.filter((a) => typeof a.value === 'number' && Number.isFinite(a.value));
  const answerTable = answers.length
    ? `<section class="sim-card">
          <h2>The textbook's answers</h2>
          <p>At the starting settings. As it runs, the simulation measures each of these and shows its value beside the textbook's.</p>
          <table>
            <tbody>
${answers.map((a) => `              <tr><th scope="row">${esc(a.name)}</th><td>${number(a.value)}</td></tr>`).join('\n')}
            </tbody>
          </table>
        </section>`
    : '';
  const paramTable = params.length
    ? `<section class="sim-card">
          <h2>What you can change</h2>
          <p>Every slider changes the physics, not just the picture: the engine works it all out again.</p>
          <table>
            <thead><tr><th scope="col">Setting</th><th scope="col">Range</th><th scope="col">Starts at</th></tr></thead>
            <tbody>
${params
  .map((q) => {
    const unit = q.unit ? ` ${esc(q.unit)}` : '';
    return `              <tr><th scope="row">${esc(q.label)}</th><td>${number(q.min)} to ${number(q.max)}${unit}</td><td>${number(q.default)}${unit}</td></tr>`;
  })
  .join('\n')}
            </tbody>
          </table>
        </section>`
    : '';
  const more = siblings.filter((s) => s.id !== id);

  return (
    head({ title: pageTitle, description: summary(description), path, jsonld }) +
    `
    <main class="wrap sim">
      <nav class="crumbs" aria-label="Breadcrumb">
        <a href="/sim">Simulations</a><span aria-hidden="true">›</span><a href="${chapterAnchor}">${esc(syllabus.chapter)}</a><span aria-hidden="true">›</span><span aria-current="page">${esc(title)}</span>
      </nav>
      <header class="sim-head">
        <p class="pill"><span class="dot"></span>${esc(classLabel(syllabus.class))} · ${esc(syllabus.chapter)}</p>
        <h1>${esc(title)}</h1>
        <p class="lead">${esc(description)}</p>
      </header>

      <figure class="sim-stage" data-src="${esc(play)}&amp;embed">
        <div class="sim-poster">
          <button type="button" class="button sim-run">Run the simulation <span class="arrow">▶</span></button>
          <a class="sim-full" href="${esc(play)}">or open it full screen →</a>
          <small>Free, in your browser, nothing to install. Topic: ${esc(syllabus.topic)}.</small>
        </div>
      </figure>

      <div class="sim-grid">
        ${answerTable}
        ${paramTable}
      </div>
${
  more.length
    ? `
      <section class="sim-more">
        <h2>More in ${esc(syllabus.chapter)}</h2>
        <ul class="sim-list">
${more.map((s) => `          <li><a href="/sim/${s.id}"><b>${esc(s.title)}</b><span>${esc(s.syllabus.topic)}</span></a></li>`).join('\n')}
        </ul>
      </section>`
    : ''
}
    </main>
` +
    foot
  );
}

function indexPage(groups, total) {
  const title = `All ${total} physics simulations, class 11 and 12 | Soliton`;
  const description = `Every simulation in Soliton, by NCERT chapter: ${total} free, interactive physics simulations for class 11 and 12, each checked against the textbook's answer.`;
  const jsonld = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: `All ${total} physics simulations`,
    url: `${SITE}/sim`,
    description,
    isAccessibleForFree: true,
    hasPart: groups.flatMap((g) => g.chapters.flatMap((c) => c.sims.map((s) => ({ '@type': 'LearningResource', name: s.title, url: `${SITE}/sim/${s.id}` })))),
  };
  const body = groups
    .map(
      (g) => `
      <section class="sim-class" id="${g.class ? `class-${g.class}` : 'beyond'}">
        <h2>${esc(classLabel(g.class))}</h2>
${g.chapters
  .map(
    (c) => `        <div class="sim-chapter" id="${slug(c.name)}">
          <h3>${esc(c.name)} <small>${c.sims.length}</small></h3>
          <ul class="sim-list">
${c.sims.map((s) => `            <li><a href="/sim/${s.id}"><b>${esc(s.title)}</b><span>${esc(s.syllabus.topic)}</span></a></li>`).join('\n')}
          </ul>
        </div>`,
  )
  .join('\n')}
      </section>`,
    )
    .join('\n');
  return (
    head({ title, description, path: '/sim', jsonld }) +
    `
    <main class="wrap sim">
      <header class="sim-head">
        <p class="pill"><span class="dot"></span>Free, in your browser</p>
        <h1>All ${total} physics simulations</h1>
        <p class="lead">Every chapter of NCERT physics for class 11 and 12, and a few scenes beyond the syllabus. Each one is computed live by a real physics engine and set beside the textbook's answer.</p>
        <nav class="sim-jump" aria-label="Jump to">
${groups.map((g) => `          <a href="#${g.class ? `class-${g.class}` : 'beyond'}">${esc(classLabel(g.class))}</a>`).join('\n')}
        </nav>
      </header>
${body}
    </main>
` +
    foot
  );
}

function sitemap(sims) {
  const urls = ['/', '/play', '/sim', ...sims.map((s) => `/sim/${s.id}`)];
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${SITE}${u}</loc></url>`).join('\n')}
</urlset>
`;
}

/** Writes sim/<id>.html, sim/index.html and public/sitemap.xml, and returns the pages for Vite to build. */
export async function writeSimPages(root) {
  const engine = await loadEngine(root);
  const sims = [];
  for (const [area, mode, cls] of AREAS) {
    for (const s of engine[`${area}_catalogue`]()) sims.push({ ...s, mode, answers: answersOf(engine, cls, s.id) });
  }

  // Group by class, then by chapter in textbook order; anything the list does not know goes last.
  const groups = [11, 12, 0].map((c) => {
    const inClass = sims.filter((s) => s.syllabus.class === c);
    const names = [...new Set(inClass.map((s) => s.syllabus.chapter))];
    const order = (n) => {
      const i = NCERT[c].findIndex((x) => x.toLowerCase() === n.toLowerCase());
      return i < 0 ? 100 + names.indexOf(n) : i;
    };
    names.sort((a, b) => order(a) - order(b));
    return { class: c, chapters: names.map((name) => ({ name, sims: inClass.filter((s) => s.syllabus.chapter === name) })) };
  });

  const out = join(root, 'sim');
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  const pages = {};
  for (const g of groups) {
    for (const c of g.chapters) {
      for (const s of c.sims) {
        const file = join(out, `${s.id}.html`);
        writeFileSync(file, simPage(s, c.sims));
        pages[`sim/${s.id}`] = file;
      }
    }
  }
  const index = join(out, 'index.html');
  writeFileSync(index, indexPage(groups, sims.length));
  pages['sim/index'] = index;
  writeFileSync(join(root, 'public', 'sitemap.xml'), sitemap(sims));
  return pages;
}
