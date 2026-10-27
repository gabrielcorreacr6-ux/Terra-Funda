/*
 * Terra Funda — protótipo (fase 1)
 * Mundo 2D visto de cima com camadas subterrâneas, escavação, água que escorre,
 * plantio, caça, loja, ciclo de dia e noite e salvamento no navegador.
 * Sem dependências: basta abrir o index.html ou publicar no GitHub Pages.
 */
(() => {
  'use strict';

  // ================= Configuração =================
  const REGION = 160, RCOLS = 3, RROWS = 2;  // 6 regiões de 160 × 160, cada uma com seu bioma
  const W = REGION * RCOLS, H = REGION * RROWS, D = 6; // largura, altura e camadas (0 = superfície)
  const SPAWN = { x: REGION + 80, y: 80 };   // centro da região dos Campos
  const DAY_MS = 10 * 60 * 1000;          // duração de um dia completo (10 min no protótipo)
  const SOURCE_LEVEL = 16;                // força da água nas fontes (até ~15 blocos de vala)
  const SPEED = 4.2;                      // blocos por segundo
  const SAVE_KEY = 'terra-funda-v2';
  const ANIMAL_CAP = 40;
  const WATER_RX = 56, WATER_RY = 44;     // a água é simulada nesta janela em volta do jogador

  const T = {
    AIR: 0, GRASS: 1, TILLED: 2, CROP: 3, VALA: 4, TREE: 5, SOURCE: 6, HOLE: 7, WALL: 8, ROCK: 9, SAPLING: 10,
    DIRT: 11, STONE: 12, COAL: 13, BRONZE: 14, IRON: 15, SILVER: 16, GOLD: 17, OIL: 18, DIAMOND: 19, GATE: 20,
  };

  const ITEMS = {
    javali: { nome: 'Javali dourado (vivo)', valor: 600, cor: '#f2c84b' },
    diamante: { nome: 'Diamante', valor: 200, cor: '#67e3f0' },
    pavao: { nome: 'Pavão (vivo)', valor: 150, cor: '#2f8fd8' },
    cervo: { nome: 'Cervo (vivo)', valor: 35, cor: '#9a6a40' },
    raposa: { nome: 'Raposa (viva)', valor: 30, cor: '#e07a32' },
    galinha_viva: { nome: 'Galinha (viva)', valor: 4, cor: '#f2efe6' },
    coelho_vivo: { nome: 'Coelho (vivo)', valor: 4, cor: '#a07a58' },
    pintinho_vivo: { nome: 'Pintinho (vivo)', valor: 3, cor: '#f2d14b' },
    petroleo: { nome: 'Petróleo', valor: 80, cor: '#6a4b8c' },
    ouro: { nome: 'Ouro', valor: 50, cor: '#f2c84b' },
    prata: { nome: 'Prata', valor: 20, cor: '#dfe4ea' },
    ferro: { nome: 'Ferro', valor: 10, cor: '#c9a68a' },
    bronze: { nome: 'Bronze', valor: 5, cor: '#c47a3c' },
    colheita: { nome: 'Trigo', valor: 4, cor: '#e8c86a' },
    carvao: { nome: 'Carvão', valor: 3, cor: '#3a3a3a' },
    carne: { nome: 'Carne de caça', valor: 2, cor: '#c8564a' },
    pedra: { nome: 'Pedra', valor: 1, cor: '#8d9096' },
    madeira: { nome: 'Madeira', valor: 1, cor: '#a4703f' },
    sementes: { nome: 'Sementes', valor: 0, cor: '#9bbf5a' },
    flechas: { nome: 'Flechas', valor: 0, cor: '#c9a46a' },
  };

  const MINE = {
    // hard = picareta mínima; hits = golpes com a picareta inicial (cada nível de picareta tira um golpe)
    [T.ROCK]: { drop: 'pedra', n: 2, hard: 0, hits: 3 },
    [T.DIRT]: { drop: null, n: 0, hard: 0, hits: 1 },
    [T.STONE]: { drop: 'pedra', n: 1, hard: 0, hits: 2 },
    [T.COAL]: { drop: 'carvao', n: 1, hard: 0, hits: 2 },
    [T.BRONZE]: { drop: 'bronze', n: 1, hard: 0, hits: 3 },
    [T.IRON]: { drop: 'ferro', n: 1, hard: 1, hits: 4 },
    [T.SILVER]: { drop: 'prata', n: 1, hard: 1, hits: 4 },
    [T.GOLD]: { drop: 'ouro', n: 1, hard: 2, hits: 5 },
    [T.OIL]: { drop: 'petroleo', n: 1, hard: 2, hits: 5 },
    [T.DIAMOND]: { drop: 'diamante', n: 1, hard: 3, hits: 7 },
  };
  // Árvores: a adulta pede vários golpes (menos com machados melhores) e deixa uma muda que volta a crescer
  const TREE_HITS = [6, 4, 2];        // machado inicial, de bronze, de ferro
  const TREE_WOOD = 5, SAPLING_WOOD = 1;
  const TIER_NAME = ['madeira', 'bronze', 'ferro', 'diamante'];

  const TOOLS = [
    { id: 'picareta', nome: 'Picareta' },
    { id: 'machado', nome: 'Machado' },
    { id: 'enxada', nome: 'Enxada' },
    { id: 'espada', nome: 'Espada' },
    { id: 'muro', nome: 'Construir' },
    { id: 'rede', nome: 'Rede' },
    { id: 'arco', nome: 'Arco' },
    { id: 'cetro', nome: 'Cetro mágico' },
    { id: 'maos', nome: 'Mãos livres' },
  ];

  // Espécies: carne = quantas carnes rende no abate; chance = chance de captura com a rede
  const SPECIES = {
    galinha: { nome: 'Galinha', raridade: 'Comum', carne: 1, vivo: 'galinha_viva', chance: 1, speed: 1.1, dica: 'Em todo lugar' },
    coelho: { nome: 'Coelho', raridade: 'Comum', carne: 1, vivo: 'coelho_vivo', chance: 1, speed: 1.8, dica: 'Em todo lugar' },
    pintinho: { nome: 'Pintinho', raridade: 'Comum', carne: 0, vivo: 'pintinho_vivo', chance: 1, speed: 1.4, dica: 'Anda atrás das galinhas', protegido: true },
    raposa: { nome: 'Raposa', raridade: 'Incomum', carne: 1, vivo: 'raposa', chance: 0.7, speed: 2.2, dica: 'Só aparece à noite' },
    cervo: { nome: 'Cervo', raridade: 'Incomum', carne: 3, vivo: 'cervo', chance: 0.7, speed: 2.0, dica: 'Perto de água' },
    pavao: { nome: 'Pavão', raridade: 'Raro', carne: 2, vivo: 'pavao', chance: 0.4, speed: 2.6, foge: true, dica: 'De dia, longe do ponto inicial' },
    javali: { nome: 'Javali dourado', raridade: 'Lendário', carne: 5, vivo: 'javali', chance: 0.2, speed: 3.1, foge: true, dica: 'Dizem que surge em noites raras' },
  };
  const RARE_CAP = { raposa: 4, cervo: 4, pavao: 2 };
  const LEGEND_CHANCE = 1 / 150;   // por checagem (a cada 12 s, só à noite)
  const LEGEND_MS = 3 * 60 * 1000; // tempo até o lendário sumir

  const SHOP = [
    { id: 'sementes', nome: 'Sementes (5)', desc: 'Plante com a enxada em terra arada.', preco: 5, repetir: true },
    { id: 'pick1', nome: 'Picareta de bronze', desc: 'Minera ferro e prata.', preco: 40 },
    { id: 'pick2', nome: 'Picareta de ferro', desc: 'Minera ouro e petróleo.', preco: 150, req: 'pick1' },
    { id: 'pick3', nome: 'Picareta de diamante', desc: 'Minera diamante.', preco: 600, req: 'pick2' },
    { id: 'axe1', nome: 'Machado de bronze', desc: 'Derruba árvores grandes com 4 golpes em vez de 6.', preco: 35 },
    { id: 'axe2', nome: 'Machado de ferro', desc: 'Derruba árvores grandes com 2 golpes.', preco: 120, req: 'axe1' },
    { id: 'espada1', nome: 'Espada de ferro', desc: 'Cada abate rende 1 carne a mais.', preco: 150 },
    { id: 'espada2', nome: 'Espada de diamante', desc: 'Cada abate rende 2 carnes a mais.', preco: 900, req: 'espada1' },
    { id: 'capacete', nome: 'Capacete com lanterna', desc: 'Ilumina bem mais nas minas e à noite. A bateria acaba.', preco: 60 },
    { id: 'rede', nome: 'Rede de captura', desc: 'Captura animais vivos, que valem mais que a carne.', preco: 30 },
    { id: 'arco', nome: 'Arco', desc: 'Caça de longe (até 9 blocos). Gasta flechas.', preco: 1500 },
    { id: 'flechas', nome: 'Flechas (20)', desc: 'Munição do arco.', preco: 40, repetir: true, req: 'arco' },
    { id: 'cetro', nome: 'Cetro mágico', desc: 'Vira mago: a magia atordoa animais de longe (a rede pega na certa), ilumina a noite e recarrega sozinha.', preco: 9000 },
  ];
  // Desgaste: as ferramentas da loja acabam e precisam ser compradas de novo (incentiva gastar moedas).
  // As simples (picareta, machado, enxada e espada iniciais) também gastam, mas dá para fazer outra na Mochila.
  const DUR = { arco: 300, cetro: 400, pick1: 400, pick2: 600, pick3: 900, axe1: 350, axe2: 600, espada1: 300, espada2: 500, rede: 60, capacete: 1500 };
  const BASIC = {
    picareta: { nome: 'Picareta de madeira', dur: 200, receita: { madeira: 3, pedra: 2 } },
    machado: { nome: 'Machado de pedra', dur: 200, receita: { madeira: 3, pedra: 1 } },
    enxada: { nome: 'Enxada', dur: 300, receita: { madeira: 2, pedra: 1 } },
    espada: { nome: 'Espada de madeira', dur: 150, receita: { madeira: 3 } },
  };
  const WEAR = { picareta: ['pick3', 'pick2', 'pick1'], machado: ['axe2', 'axe1'], espada: ['espada2', 'espada1'], rede: ['rede'], enxada: [], arco: ['arco'], cetro: ['cetro'] };

  // ================= Construções =================
  // Muros: material de cada bloco fica em S.wmat. golpes = picaretadas para desmontar (devolve o material)
  const WALL_MATS = [
    { id: 'madeira', nome: 'Paliçada de madeira', custo: { madeira: 2 }, golpes: 2 },
    { id: 'pedra', nome: 'Muro de pedra', custo: { pedra: 3 }, golpes: 4 },
    { id: 'tijolo', nome: 'Muro de tijolos', custo: { pedra: 2, carvao: 1 }, golpes: 5 },
    { id: 'ferro', nome: 'Muro reforçado', custo: { pedra: 3, ferro: 1 }, golpes: 7 },
    { id: 'fortaleza', nome: 'Muralha de ferro', custo: { pedra: 4, ferro: 2 }, golpes: 9 },
  ];
  const GATE_EXTRA = { madeira: 2 };
  // Prontas da loja. casa e forte ocupam um losango w × h (h = w / 2); porta = ponto da borda de baixo
  // à esquerda (0 = canto esquerdo, 1 = canto de baixo). band = grossura das paredes, em blocos.
  const BUILDS = {
    cabana: { tipo: 'casa', nome: 'Casa de camponês', w: 8, h: 4, porta: 0.5, preco: 800, desc: 'Cabana de toras, com fogão e cama.' },
    pedra: { tipo: 'casa', nome: 'Casa de pedra', w: 8, h: 4, porta: 0.57, preco: 1600, desc: 'Paredes grossas e telhado de ardósia.' },
    tribal: { tipo: 'casa', nome: 'Casa tribal', w: 8, h: 4, porta: 0.42, preco: 1800, desc: 'Casa comprida com totem e fogueiras.' },
    saloon: { tipo: 'casa', nome: 'Saloon do faroeste', w: 8, h: 4, porta: 0.55, preco: 2400, desc: 'Balcão, piano e mesas de jogo.' },
    castelo: { tipo: 'casa', nome: 'Castelo', w: 8, h: 4, porta: 0.55, preco: 4500, desc: 'Torres nos cantos, lareira e armaduras.' },
    domo: { tipo: 'casa', nome: 'Domo alienígena', w: 8, h: 4, porta: 0.43, preco: 6500, desc: 'Cápsulas de dormir e holograma.' },
    muralha: { tipo: 'forte', nome: 'Muralha de castelo', w: 24, h: 12, porta: 0.5, preco: 4000, desc: 'Muralha com torres e portão. Cabem casas dentro.' },
    muralha_vila: { tipo: 'forte', arte: 'muralha', nome: 'Muralha com casas de camponeses', w: 24, h: 12, preco: 5200,
      desc: 'A muralha já vem com duas casas de camponês dentro (dá para mover).', junto: [['cabana', 4, 3], ['cabana', 12, 5]] },
    forte: { tipo: 'forte', nome: 'Forte do faroeste', w: 26, h: 13, preco: 3000, desc: 'Cerca de troncos com porteira.' },
    forte_cidade: { tipo: 'forte', nome: 'Cidade do faroeste', w: 26, h: 13, preco: 6000, desc: 'Forte com saloon, armazém e xerife.' },
    campo: { tipo: 'forte', nome: 'Campo de força', w: 26, h: 13, preco: 5500, desc: 'Parede de energia com portão alienígena.' },
    colonia: { tipo: 'forte', nome: 'Colônia alienígena', w: 26, h: 13, preco: 9000, desc: 'Campo de força com domos e antenas.' },
    torre_madeira: { tipo: 'torre', nome: 'Torre de vigia', w: 2, h: 2, preco: 500, desc: 'Torre simples de madeira.' },
    torre_pedra: { tipo: 'torre', nome: 'Torre de pedra', w: 2, h: 2, preco: 1100, desc: 'Torre de pedra com besta.' },
    torre_balista: { tipo: 'torre', nome: 'Torre com balista', w: 2, h: 2, preco: 1600, desc: 'Atira longe.' },
    torre_canhao: { tipo: 'torre', nome: 'Torre de canhão', w: 2, h: 2, preco: 2400, desc: 'Dano alto, recarga lenta.' },
    torre_balista_cristal: { tipo: 'torre', nome: 'Balista de cristal', w: 2, h: 2, preco: 3500, desc: 'Balista com cristal de energia.' },
    torre_cristal: { tipo: 'torre', nome: 'Torre de cristal', w: 2, h: 2, preco: 5000, desc: 'A defesa mais forte.' },
    catapulta: { tipo: 'torre', nome: 'Catapulta', w: 2, h: 2, preco: 2800, desc: 'Fique de frente e use (mãos livres): lança uma pedra longe, quebra rochas e derruba árvores. Cada tiro gasta 1 pedra.' },
    catapulta_ferro: { tipo: 'torre', nome: 'Catapulta reforçada', w: 2, h: 2, preco: 4800, desc: 'Reforçada com ferro: lança mais longe e quebra mais.' },
    espinhos: { tipo: 'armadilha', nome: 'Armadilha de espinhos', w: 1, h: 1, preco: 200, desc: 'Fica no chão; dá para passar por cima.', dw: 1.15 },
    cama: { tipo: 'movel', nome: 'Cama simples', preco: 60 }, cama_casal: { tipo: 'movel', nome: 'Cama grande', preco: 140 },
    cama_dossel: { tipo: 'movel', nome: 'Cama de dossel', preco: 400 }, capsula: { tipo: 'movel', nome: 'Cápsula de dormir', preco: 600 },
    mesa: { tipo: 'movel', nome: 'Mesa', preco: 40 }, mesa_redonda: { tipo: 'movel', nome: 'Mesa redonda', preco: 50 },
    banco: { tipo: 'movel', nome: 'Banco', preco: 30 }, bau: { tipo: 'movel', nome: 'Baú', preco: 60 },
    bau_ferro: { tipo: 'movel', nome: 'Baú de ferro', preco: 150 }, cofre: { tipo: 'movel', nome: 'Cofre', preco: 300 },
    cesto: { tipo: 'movel', nome: 'Cesto', preco: 25 }, fogao: { tipo: 'movel', nome: 'Fogão a lenha', preco: 120 },
    lareira: { tipo: 'movel', nome: 'Lareira', preco: 250 }, fogueira: { tipo: 'movel', nome: 'Fogueira com caldeirão', preco: 80 },
    cristal_roxo: { tipo: 'movel', nome: 'Cristal roxo', preco: 350, arte: 'cristal_roxo' },
    cristal_claro: { tipo: 'movel', nome: 'Cristal claro', preco: 350, arte: 'cristal_claro' },
    robo: { tipo: 'robo', nome: 'Robô minerador', preco: 3000, desc: 'Fica onde você colocar, procura minério embaixo da terra (até 6 blocos) e guarda para você. Os minérios que ele tira acabam de verdade.' },
  };
  for (const [k, d] of Object.entries(BUILDS)) {
    d.w = d.w || 1; d.h = d.h || 1;
    d.band = d.tipo === 'casa' ? 0.55 : 0.6;
    d.portaR = d.tipo === 'casa' ? 1.1 : 1.6;
    d.pad = d.tipo === 'casa' ? 0.15 : 0;
    d.img = d.tipo === 'casa' ? 'casa_' + k : d.tipo === 'forte' ? 'forte_' + (d.arte || k) : d.tipo === 'movel' ? (d.arte || 'movel_' + k) : k;
  }
  BUILDS.catapulta.img = 'catapulta_0';
  const SHOP_TABS = [['ferramentas', 'Ferramentas'], ['casas', 'Casas e fortalezas'], ['defesa', 'Defesa'], ['moveis', 'Móveis'], ['ajudantes', 'Ajudantes'], ['skins', 'Skins']];
  const TAB_OF = d => d.tipo === 'casa' || d.tipo === 'forte' ? 'casas' : d.tipo === 'torre' || d.tipo === 'armadilha' ? 'defesa' : d.tipo === 'movel' ? 'moveis' : 'ajudantes';
  const ROBO_CAP = 30, ROBO_EVERY = 30, ROBO_R = 6;

  // Compradores que andam pelo mapa: acampam um tempo e depois partem para outro ponto
  const MERCHANTS = [
    { id: 'tiao', nome: 'Tião', papel: 'compra minérios e madeira', cor: '#4f72b3', chapeu: '#6b4426',
      compra: ['pedra', 'carvao', 'bronze', 'ferro', 'prata', 'ouro', 'petroleo', 'diamante', 'madeira'] },
    { id: 'ana', nome: 'Dona Ana', papel: 'compra colheitas e carne', cor: '#b8495a', chapeu: '#e8d6a0',
      compra: ['colheita', 'carne', 'galinha_viva', 'coelho_vivo', 'pintinho_vivo'] },
    { id: 'lia', nome: 'Lia', papel: 'coleciona animais vivos', cor: '#5e8f34', chapeu: '#2f4a1e',
      compra: ['raposa', 'cervo', 'pavao', 'javali', 'galinha_viva', 'coelho_vivo', 'pintinho_vivo'] },
  ];
  const NPC_SPEED = 1.5;
  const CAMP_MS = [40000, 90000];   // quanto tempo cada comprador fica parado num lugar

  // Personagens jogáveis (a arte de cada um vem do atlas: <id>_front_idle, <id>_side_walk_0, ...)
  const CHARACTERS = [
    { id: 'menino', nome: 'Davi' },
    { id: 'menino_negro', nome: 'Caio' },
    { id: 'menina_ruiva', nome: 'Clara' },
    { id: 'menina_negra', nome: 'Ayo' },
  ];

  // Skins: só visual, não mudam nada no jogo. Cada uma aparece na loja quando a folha dela
  // (tools/sprites-src/skin_<id>.jpg) estiver no atlas. Preço sobe com a raridade (caras de propósito).
  const SKINS = [
    { id: 'guarda_azul', nome: 'Guarda Azul', raridade: 'Comum', preco: 1400 },
    { id: 'mecanico_vermelho', nome: 'Mecânico Vermelho', raridade: 'Comum', preco: 1400 },
    { id: 'cacadora', nome: 'Caçadora', raridade: 'Raro', preco: 2800 },
    { id: 'policial', nome: 'Policial', raridade: 'Raro', preco: 2800 },
    { id: 'saqueador', nome: 'Saqueador', raridade: 'Raro', preco: 2800 },
    { id: 'pirata', nome: 'Pirata', raridade: 'Raro', preco: 3500 },
    { id: 'rei_mascarado', nome: 'Rei Mascarado', raridade: 'Raro', preco: 3500 },
    { id: 'samurai', nome: 'Samurai', raridade: 'Épico', preco: 6300 },
    { id: 'pistoleira', nome: 'Pistoleira', raridade: 'Épico', preco: 6300 },
    { id: 'cowboy_caveira', nome: 'Cowboy Caveira', raridade: 'Épico', preco: 6300 },
    { id: 'princesa', nome: 'Princesa', raridade: 'Épico', preco: 6300 },
    { id: 'ceifador', nome: 'Ceifador', raridade: 'Épico', preco: 8400 },
    { id: 'exploradora', nome: 'Exploradora', raridade: 'Comum', preco: 1400 },
    { id: 'arqueiro_mata', nome: 'Arqueiro da Mata', raridade: 'Raro', preco: 2800 },
    { id: 'arqueira_mata', nome: 'Arqueira da Mata', raridade: 'Raro', preco: 2800 },
    { id: 'guerreiro_tribal', nome: 'Guerreiro Tribal', raridade: 'Raro', preco: 3500 },
    { id: 'sombra_tatica', nome: 'Sombra Tática', raridade: 'Épico', preco: 6300 },
    { id: 'carrasco', nome: 'Carrasco', raridade: 'Épico', preco: 6300 },
    { id: 'cacique', nome: 'Cacique', raridade: 'Lendário', preco: 12600 },
    { id: 'ciberpiloto', nome: 'Ciberpiloto', raridade: 'Lendário', preco: 12600 },
    { id: 'espectro', nome: 'Espectro', raridade: 'Lendário', preco: 14000 },
    { id: 'guardiao_cristal', nome: 'Guardião de Cristal', raridade: 'Lendário', preco: 17500 },
    { id: 'rei_dourado', nome: 'Rei Dourado', raridade: 'Lendário', preco: 17500 },
  ];
  const skinReady = id => !!ATLAS[`sk_${id}_front_idle`];
  // visual atual: a skin vestida (se tiver arte) ou o personagem escolhido
  const look = () => (S.skin && (S.skins || []).includes(S.skin) && skinReady(S.skin)) ? 'sk_' + S.skin : (S.char || 'menino');

  const DIRS = [[0, 1], [0, -1], [-1, 0], [1, 0]]; // baixo, cima, esquerda, direita

  // ================= Utilidades =================
  const I = (x, y, z) => (z * H + y) * W + x;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hash2(x, y, s) {
    let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(s, 1442695041)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }
  function makeNoise(seed) {
    const sm = t => t * t * (3 - 2 * t);
    return (x, y) => {
      const xi = Math.floor(x), yi = Math.floor(y);
      const u = sm(x - xi), v = sm(y - yi);
      const a = hash2(xi, yi, seed), b = hash2(xi + 1, yi, seed);
      const c = hash2(xi, yi + 1, seed), d = hash2(xi + 1, yi + 1, seed);
      return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
    };
  }

  // ================= Biomas e jazidas =================
  // Regiões em grade 3 × 2. tree/rock = [limiar do ruído, chance]; cresce = velocidade das plantações
  const BIOMES = [
    { id: 'floresta', nome: 'Floresta', tree: [0.5, 0.6], rock: [0.88, 0.3], fontes: 8, cresce: 1, raposa: 2, cervo: 2, pavao: 1 },
    { id: 'campos', nome: 'Campos', tree: [0.64, 0.55], rock: [0.84, 0.3], fontes: 8, cresce: 1, raposa: 1, cervo: 1, pavao: 0 },
    { id: 'pantano', nome: 'Pântano', tree: [0.6, 0.45], rock: [0.93, 0.2], fontes: 20, cresce: 1.2, raposa: 1, cervo: 1.5, pavao: 1.5 },
    { id: 'deserto', nome: 'Deserto', tree: [0.78, 0.25], rock: [0.8, 0.35], fontes: 3, cresce: 0.35, raposa: 1, cervo: 0, pavao: 0 },
    { id: 'montanhas', nome: 'Montanhas', tree: [0.7, 0.4], rock: [0.6, 0.55], fontes: 6, cresce: 0.7, raposa: 1, cervo: 1, pavao: 0, raso: true },
    { id: 'neve', nome: 'Neve', tree: [0.6, 0.5], rock: [0.84, 0.3], fontes: 5, cresce: 0.4, raposa: 1.5, cervo: 1, pavao: 0 },
  ];

  // Recursos importantes só existem em jazidas, que o administrador posiciona, move, pausa e repõe
  const DEPOSIT_ORE = {
    prata: { tile: T.SILVER, veins: 16, size: 3 },
    ouro: { tile: T.GOLD, veins: 12, size: 3 },
    petroleo: { tile: T.OIL, veins: 7, size: 6 },
    diamante: { tile: T.DIAMOND, veins: 8, size: 2 },
  };
  const DEPOSIT_PLAN = [   // [região, minério, camada]
    [0, 'prata', 3], [0, 'ouro', 4],
    [1, 'prata', 3],
    [2, 'ouro', 4], [2, 'petroleo', 4],
    [3, 'petroleo', 2], [3, 'ouro', 4],
    [4, 'prata', 2], [4, 'ouro', 3], [4, 'diamante', 5],
    [5, 'ouro', 4], [5, 'diamante', 5],
  ];
  const DEPOSIT_R = 10;
  const regionOrigin = reg => [(reg % RCOLS) * REGION, Math.floor(reg / RCOLS) * REGION];
  const regionOf = (x, y) => clamp(Math.floor(x / REGION), 0, RCOLS - 1) + RCOLS * clamp(Math.floor(y / REGION), 0, RROWS - 1);

  function fillDeposit(d, tl, rnd = Math.random) {
    const def = DEPOSIT_ORE[d.ore];
    for (let k = 0; k < def.veins; k++) {
      let x = Math.round(d.x + (rnd() * 2 - 1) * d.r), y = Math.round(d.y + (rnd() * 2 - 1) * d.r);
      for (let st = 0; st < def.size; st++) {
        x = clamp(x, 2, W - 3); y = clamp(y, 2, H - 3);
        const i = I(x, y, d.z);
        if (tl[i] === T.STONE || tl[i] === T.DIRT) tl[i] = def.tile;
        const r = Math.floor(rnd() * 4);
        x += r === 0 ? 1 : r === 1 ? -1 : 0; y += r === 2 ? 1 : r === 3 ? -1 : 0;
      }
    }
  }
  function forDepositCells(d, fn) {
    const m = d.r + 4;
    for (let y = Math.max(1, d.y - m); y <= Math.min(H - 2, d.y + m); y++)
      for (let x = Math.max(1, d.x - m); x <= Math.min(W - 2, d.x + m); x++) fn(I(x, y, d.z));
  }
  function clearDeposit(d) {
    const ore = DEPOSIT_ORE[d.ore].tile;
    forDepositCells(d, i => { if (S.tiles[i] === ore) S.tiles[i] = T.STONE; });
  }
  function countDeposit(d) {
    const ore = DEPOSIT_ORE[d.ore].tile;
    let n = 0;
    forDepositCells(d, i => { if (S.tiles[i] === ore) n++; });
    return n;
  }

  // ================= Estado =================
  let S = null;

  function emptyState(seed) {
    return {
      seed,
      tiles: new Uint8Array(W * H * D),
      aux: new Uint8Array(W * H),        // estágio das plantações
      biome: new Uint8Array(W * H),      // bioma de cada bloco (recalculado a partir da semente)
      water: new Uint8Array(W * H * D),
      water2: new Uint8Array(W * H * D),
      wmat: new Uint8Array(W * H * D),   // material de cada muro/portão (índice em WALL_MATS)
      p: { x: SPAWN.x + 0.5, y: SPAWN.y + 0.5, z: 0, dir: 0 },
      inv: { madeira: 6, sementes: 10 },
      coins: 0,
      owned: {},
      time: DAY_MS * 0.29,
      tool: 0,
      hints: {},
      catalog: {},
      home: { x: SPAWN.x + 0.5, y: SPAWN.y + 0.5 },
      homeReadyAt: 0,
      deposits: [],
      char: null,
      skins: [],
      skin: null,
      animals: [],
      npcs: [],
      builds: [],     // construções colocadas: { k, x, y }
      kit: {},        // construções compradas e ainda não colocadas
      bots: [],       // robôs mineradores
      sel: { k: 'muro', m: 0 },   // o que a ferramenta Construir coloca
      dur: {},        // usos restantes de cada ferramenta
      broken: {},     // ferramentas simples quebradas (fazer outra na Mochila)
    };
  }

  // Fronteiras entre biomas levemente onduladas para não parecerem uma linha reta
  function genBiomes(s) {
    const nB = makeNoise(s.seed + 7);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const bx = x + (nB(x / 24, y / 24) - 0.5) * 30, by = y + (nB(x / 24 + 90, y / 24) - 0.5) * 30;
      s.biome[y * W + x] = regionOf(bx, by);
    }
  }

  function genWorld(s) {
    genBiomes(s);
    const rnd = mulberry32(s.seed);
    const nTree = makeNoise(s.seed + 1), nRock = makeNoise(s.seed + 2), nDirt = makeNoise(s.seed + 3);
    const tl = s.tiles;

    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const B = BIOMES[s.biome[y * W + x]];
      let t = T.GRASS;
      const tv = nTree(x / 9, y / 9), rv = nRock(x / 5, y / 5);
      if (tv > B.tree[0] && rnd() < B.tree[1]) t = rnd() < 0.22 ? T.SAPLING : T.TREE;
      else if (rv > B.rock[0] && rnd() < B.rock[1]) t = T.ROCK;
      if (x < 2 || y < 2 || x >= W - 2 || y >= H - 2) t = T.TREE;
      tl[I(x, y, 0)] = t;
      for (let z = 1; z < D; z++) {
        let u = T.STONE;
        if (z === 1 && nDirt(x / 7, y / 7) > 0.4) u = T.DIRT;
        if (z === 2 && nDirt(x / 7 + 40, y / 7) > 0.72) u = T.DIRT;
        tl[I(x, y, z)] = u;
      }
    }

    // Minérios comuns por camada, em cada região: [minério, quantidade de veios, tamanho].
    // Nas montanhas eles ficam uma camada mais rasos.
    const veins = {
      1: [[T.COAL, 70, 5], [T.BRONZE, 22, 3]],
      2: [[T.COAL, 50, 5], [T.BRONZE, 50, 4], [T.IRON, 10, 3]],
      3: [[T.BRONZE, 20, 3], [T.IRON, 50, 4]],
      4: [[T.IRON, 30, 3]],
      5: [[T.IRON, 15, 3]],
    };
    for (let reg = 0; reg < RCOLS * RROWS; reg++) {
      const B = BIOMES[reg], [rx0, ry0] = regionOrigin(reg);
      for (let z = 1; z < D; z++) {
        const table = veins[B.raso ? Math.min(D - 1, z + 1) : z] || [];
        for (const [ore, count, size] of table) {
          for (let k = 0; k < count; k++) {
            let x = rx0 + 2 + Math.floor(rnd() * (REGION - 4)), y = ry0 + 2 + Math.floor(rnd() * (REGION - 4));
            for (let st = 0; st < size; st++) {
              const i = I(x, y, z);
              if (tl[i] === T.STONE || tl[i] === T.DIRT) tl[i] = ore;
              const d = Math.floor(rnd() * 4);
              x = clamp(x + (d === 0 ? 1 : d === 1 ? -1 : 0), 1, W - 2);
              y = clamp(y + (d === 2 ? 1 : d === 3 ? -1 : 0), 1, H - 2);
            }
          }
        }
      }
    }

    // Jazidas iniciais (o administrador pode mudar depois)
    s.deposits = DEPOSIT_PLAN.map(([reg, ore, z], k) => {
      const [rx0, ry0] = regionOrigin(reg);
      let x = 0, y = 0;
      for (let tries = 0; tries < 50; tries++) {
        x = rx0 + 25 + Math.floor(rnd() * (REGION - 50)); y = ry0 + 25 + Math.floor(rnd() * (REGION - 50));
        if (Math.hypot(x - SPAWN.x, y - SPAWN.y) > 35) break;
      }
      return { id: k, ore, z, x, y, r: DEPOSIT_R, active: true };
    });
    for (const d of s.deposits) fillDeposit(d, tl, rnd);

    // Clareira inicial
    const cx = SPAWN.x, cy = SPAWN.y;
    for (let dy = -5; dy <= 5; dy++) for (let dx = -5; dx <= 5; dx++) {
      if (dx * dx + dy * dy <= 26) tl[I(cx + dx, cy + dy, 0)] = T.GRASS;
    }

    // Fontes de água com uma pequena lagoa em volta (o pântano tem muitas, o deserto quase nenhuma)
    const spots = [[cx + 8, cy - 3]];
    for (let reg = 0; reg < RCOLS * RROWS; reg++) {
      const B = BIOMES[reg], [rx0, ry0] = regionOrigin(reg), gap = B.id === 'pantano' ? 12 : 20;
      let made = 0;
      for (let tries = 0; made < B.fontes && tries < 600; tries++) {
        const x = rx0 + 6 + Math.floor(rnd() * (REGION - 12)), y = ry0 + 6 + Math.floor(rnd() * (REGION - 12));
        if (spots.every(([a, b]) => (a - x) ** 2 + (b - y) ** 2 > gap * gap)) { spots.push([x, y]); made++; }
      }
    }
    for (const [sx, sy] of spots) {
      for (let dy = -5; dy <= 5; dy++) for (let dx = -5; dx <= 5; dx++) {   // margem livre em volta da lagoa
        const x = sx + dx, y = sy + dy;
        if (x > 1 && y > 1 && x < W - 2 && y < H - 2 && dx * dx + dy * dy <= 20) tl[I(x, y, 0)] = T.GRASS;
      }
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
        if (dx * dx + dy * dy <= 5) tl[I(sx + dx, sy + dy, 0)] = T.VALA;
      }
      tl[I(sx, sy, 0)] = T.SOURCE;
    }
  }

  function newWorld() {
    const s = emptyState((Math.random() * 2 ** 31) | 0);
    genWorld(s);
    return s;
  }

  // ================= Salvamento =================
  // O mapa é grande, então é guardado compactado (sequências repetidas viram valor + quantidade)
  function rle(u8) {
    const out = [];
    for (let i = 0; i < u8.length;) {
      const v = u8[i];
      let n = 1;
      while (i + n < u8.length && u8[i + n] === v && n < 255) n++;
      out.push(v, n);
      i += n;
    }
    return new Uint8Array(out);
  }
  function unrle(r, len) {
    const u = new Uint8Array(len);
    let o = 0;
    for (let i = 0; i + 1 < r.length; i += 2) {
      if (o + r[i + 1] > len) return null;
      u.fill(r[i], o, o + r[i + 1]); o += r[i + 1];
    }
    return o === len ? u : null;
  }
  function toB64(u8) {
    let str = '';
    for (let i = 0; i < u8.length; i += 0x8000) str += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
    return btoa(str);
  }
  function fromB64(b) {
    const str = atob(b), u = new Uint8Array(str.length);
    for (let i = 0; i < str.length; i++) u[i] = str.charCodeAt(i);
    return u;
  }
  const NET = window.TerraOnline || { enabled: false };
  const saveKey = () => SAVE_KEY + (NET.user ? ':' + NET.user.id : '');
  function serialize() {
    return {
      v: 2, savedAt: Date.now(), seed: S.seed, tiles: toB64(rle(S.tiles)), aux: toB64(rle(S.aux)),
      p: S.p, inv: S.inv, coins: S.coins, owned: S.owned, time: S.time, tool: S.tool, hints: S.hints, catalog: S.catalog,
      npcs: S.npcs.map(n => ({ id: n.id, x: n.x, y: n.y })),
      home: S.home, homeReadyAt: S.homeReadyAt, deposits: S.deposits, char: S.char, skins: S.skins, skin: S.skin,
      wmat: toB64(rle(S.wmat)), builds: S.builds, kit: S.kit, sel: S.sel, dur: S.dur, broken: S.broken,
      bots: S.bots.map(b => ({ x: b.x, y: b.y, hx: b.hx, hy: b.hy, store: b.store, t: b.t })),
    };
  }
  // grava no navegador e, com conta, também na nuvem (no máximo a cada 20 s; já, quando immediate)
  function save(immediate) {
    if (!S || bootPending) return false;
    const obj = serialize();
    let ok = true;
    try { localStorage.setItem(saveKey(), JSON.stringify(obj)); } catch (e) { ok = false; }
    if (NET.enabled && NET.user) NET.queueSave(obj, immediate === true);
    return ok;
  }
  let bootPending = true;
  let oldSaveFound = false;
  function readLocal() {
    try {
      if (localStorage.getItem('terra-funda-v1')) { oldSaveFound = true; localStorage.removeItem('terra-funda-v1'); }
      const raw = localStorage.getItem(saveKey());
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }
  function load(d) {
    try {
      if (!d || d.v !== 2) return null;
      const s = emptyState(d.seed);
      const tiles = unrle(fromB64(d.tiles), s.tiles.length), aux = unrle(fromB64(d.aux), s.aux.length);
      if (!tiles || !aux) return null;
      s.tiles = tiles; s.aux = aux;
      genBiomes(s);
      Object.assign(s.p, d.p);
      s.inv = d.inv || {}; s.coins = d.coins || 0; s.owned = d.owned || {};
      s.time = d.time || 0; s.tool = (d.tool || 0) % TOOLS.length; s.hints = d.hints || {}; s.catalog = d.catalog || {};
      s.savedNpcs = Array.isArray(d.npcs) ? d.npcs : [];
      if (d.home && typeof d.home.x === 'number') s.home = d.home;
      s.homeReadyAt = d.homeReadyAt || 0;
      s.deposits = Array.isArray(d.deposits) ? d.deposits : [];
      s.char = CHARACTERS.some(c => c.id === d.char) ? d.char : 'menino';
      s.skins = Array.isArray(d.skins) ? d.skins : []; s.skin = d.skin || null;
      if ((TOOLS[s.tool].id === 'arco' || TOOLS[s.tool].id === 'cetro') && !s.owned[TOOLS[s.tool].id]) s.tool = 0;
      if (d.wmat) { const wm = unrle(fromB64(d.wmat), s.wmat.length); if (wm) s.wmat = wm; }
      s.builds = Array.isArray(d.builds) ? d.builds.filter(b => BUILDS[b.k]) : [];
      s.kit = d.kit || {}; s.dur = d.dur || {}; s.broken = d.broken || {};
      if (d.sel && (d.sel.k === 'muro' || d.sel.k === 'portao' || (d.sel.k === 'kit' && BUILDS[d.sel.id]))) s.sel = d.sel;
      s.bots = Array.isArray(d.bots) ? d.bots.map(newBot) : [];
      return s;
    } catch (e) { return null; }
  }

  // ================= Regras do mundo =================
  function tileAt(x, y, z) {
    if (x < 0 || y < 0 || x >= W || y >= H || z < 0 || z >= D) return 255;
    return S.tiles[I(x, y, z)];
  }
  function walkable(t, z) {
    if (t === T.GATE) return true;
    return z === 0
      ? (t === T.GRASS || t === T.TILLED || t === T.CROP || t === T.VALA || t === T.HOLE)
      : (t === T.AIR || t === T.HOLE);
  }
  function canStand(px, py, z, r) {
    const pts = [[px - r, py - r], [px + r, py - r], [px - r, py + r], [px + r, py + r]];
    for (const [x, y] of pts) if (!walkable(tileAt(Math.floor(x), Math.floor(y), z), z)) return false;
    if (z === 0 && S.builds.length) for (const [x, y] of pts) if (buildBlocks(x, y)) return false;
    return true;
  }

  // ---- Forma das construções. casa e forte: losango com paredes na borda e uma porta;
  // torres e móveis: retângulo sólido; armadilha: dá para pisar.
  function shapeHit(b, px, py, move) {
    const d = BUILDS[b.k];
    if (px < b.x - 0.3 || py < b.y - 0.3 || px > b.x + d.w + 0.3 || py > b.y + d.h + 0.3) return null;
    if (d.tipo === 'casa' || d.tipo === 'forte') {
      const a = d.w / 2, bb = d.h / 2, cx = b.x + a, cy = b.y + bb;
      const dd = Math.abs(px - cx) / a + Math.abs(py - cy) / bb;
      if (dd > 1) return null;
      if ((1 - dd) * a * bb / Math.hypot(a, bb) > d.band) return 'inside';
      const [qx, qy] = doorPoint(b);
      return Math.hypot(px - qx, py - qy) < d.portaR ? 'inside' : 'solid';   // a porta também dá para atravessar andando
    }
    if (px < b.x || py < b.y || px >= b.x + d.w || py >= b.y + d.h) return null;
    if (d.tipo === 'armadilha') return move ? null : 'solid';
    return 'solid';
  }
  function doorPoint(b) {
    const d = BUILDS[b.k], a = d.w / 2, bb = d.h / 2, cx = b.x + a, cy = b.y + bb;
    return d.porta !== undefined ? [cx - a + d.porta * a, cy + d.porta * bb] : [cx, cy + bb - 0.4];
  }
  function buildBlocks(px, py) {
    for (const b of S.builds) if (shapeHit(b, px, py, true) === 'solid') return true;
    return false;
  }
  // casa ou forte em que o ponto está (do lado de dentro das paredes)
  function insideOf(px, py, tipo) {
    let best = null;
    for (const b of S.builds) {
      const d = BUILDS[b.k];
      if (d.tipo !== tipo) continue;
      const a = d.w / 2, bb = d.h / 2;
      if (Math.abs(px - b.x - a) / a + Math.abs(py - b.y - bb) / bb < 1) best = b;
    }
    return best;
  }
  const dayPhase = () => (S.time % DAY_MS) / DAY_MS;
  const sun = () => Math.sin((dayPhase() - 0.25) * Math.PI * 2);
  const isDay = () => sun() > -0.05;
  const pickTier = () => (S.owned.pick3 ? 3 : S.owned.pick2 ? 2 : S.owned.pick1 ? 1 : 0);
  const axeTier = () => (S.owned.axe2 ? 2 : S.owned.axe1 ? 1 : 0);
  const mineHits = m => Math.max(1, m.hits - pickTier());

  function give(item, n) { S.inv[item] = (S.inv[item] || 0) + n; invDirty = true; }
  function take(item, n) {
    if ((S.inv[item] || 0) < n) return false;
    S.inv[item] -= n; invDirty = true; return true;
  }
  const hasAll = cost => Object.entries(cost).every(([k, n]) => (S.inv[k] || 0) >= n);
  const payAll = cost => { if (!hasAll(cost)) return false; for (const [k, n] of Object.entries(cost)) take(k, n); return true; };
  const giveAll = cost => { for (const [k, n] of Object.entries(cost)) give(k, n); };
  const costTxt = cost => Object.entries(cost).map(([k, n]) => `${n} ${ITEMS[k].nome.toLowerCase()}`).join(' + ');
  const sumCost = (a, b) => { const o = { ...a }; for (const [k, n] of Object.entries(b)) o[k] = (o[k] || 0) + n; return o; };
  const wallCost = (m, gate) => gate ? sumCost(WALL_MATS[m].custo, GATE_EXTRA) : WALL_MATS[m].custo;

  // ---- Flechas e magia
  const shots = [], effects = [];
  let mana = 5, shotAnim = 0;
  // Usar encostado na parede de uma casa ou fortaleza: entra (se está fora) ou sai pela porta (se está dentro)
  function doorAction() {
    if (S.p.z !== 0) return null;
    const p = S.p, tg = target(), px = tg.x + 0.5, py = tg.y + 0.5;
    let best = null;
    for (const b of S.builds) {
      const d = BUILDS[b.k];
      if (d.tipo !== 'casa' && d.tipo !== 'forte') continue;
      if (shapeHit(b, px, py) !== 'solid' && shapeHit(b, p.x + DIRS[p.dir][0] * 0.45, p.y + DIRS[p.dir][1] * 0.45) !== 'solid') continue;
      if (!best || d.w < BUILDS[best.k].w) best = b;   // casa dentro do forte: vale a casa
    }
    if (!best) for (const b of S.builds) {   // parado na própria porta, empurrando: também vale
      const d = BUILDS[b.k];
      if (d.tipo !== 'casa' && d.tipo !== 'forte') continue;
      const [qx, qy] = doorPoint(b);
      if (Math.hypot(qx - p.x, qy - p.y) < 1.6 && (!best || d.w < BUILDS[best.k].w)) best = b;
    }
    if (!best) return null;
    return () => {
      const b = best, d = BUILDS[b.k], [qx, qy] = doorPoint(b);
      const cx = b.x + d.w / 2, cy = b.y + d.h / 2;
      let ux = qx - cx, uy = qy - cy; const L = Math.hypot(ux, uy) || 1; ux /= L; uy /= L;
      const inside = insideOf(p.x, p.y, d.tipo) === b;
      const sgn = inside ? 1 : -1;   // sai pela porta para fora; entra pela porta para dentro
      for (const dist of [1.1, 1.5, 2, 2.6, 0.8]) for (const side of [0, 0.4, -0.4, 0.8, -0.8]) {
        const nx = qx + sgn * ux * dist - uy * side, ny = qy + sgn * uy * dist + ux * side;
        if (canStand(nx, ny, 0, 0.3) && (insideOf(nx, ny, d.tipo) === b) !== inside) {
          p.x = nx; p.y = ny; p.dir = inside ? (uy > 0.3 ? 0 : ux < 0 ? 2 : 3) : 1;
          sfx('construir');
          S.hints.portaN = (S.hints.portaN || 0) + 1;
          if (S.hints.portaN >= 3) S.hints.porta = 1;
          if (!S.hints.porta) toast(inside ? `Saiu: ${d.nome}` : `Entrou: ${d.nome}`, 'leaf');
          return;
        }
      }
      toast('A porta está bloqueada', 'warn');
    };
  }
  function catapultInFront() {
    if (S.p.z !== 0) return null;
    const tg = target();
    return S.builds.find(b => b.k.startsWith('catapulta') && (shapeHit(b, tg.x + 0.5, tg.y + 0.5) || shapeHit(b, S.p.x, S.p.y - 0.6))) || null;
  }
  function fireCatapult(b) {
    const now = performance.now();
    if (b.fireAt && now - b.fireAt < 1500) return;
    if (!take('pedra', 1)) { toast('A catapulta precisa de pedra (mine rochas com a picareta)', 'warn'); return; }
    b.fireAt = now;
    const ferro = b.k === 'catapulta_ferro', d = DIRS[S.p.dir], dist = ferro ? 11 : 8;
    const cx = b.x + 1, cy = b.y + 1;
    setTimeout(() => {
      shots.push({ kind: 'pedra', x: cx, y: cy - 0.5, z: 0, vx: d[0] * 8, vy: d[1] * 8, left: dist, total: dist, ferro });
      sfx('arco');
    }, 260);
    sfx('construir');
  }
  // a pedra cai no fim do arco: quebra rochas, derruba árvores e acerta animais em volta
  function stoneLand(s2) {
    const x0 = Math.floor(s2.x), y0 = Math.floor(s2.y), R = s2.ferro ? 1 : 0;
    effects.push({ name: 'catapulta_impacto', x: s2.x, y: s2.y, z: 0, t0: performance.now(), dur: 500 });
    sfx('quebra');
    let got = {};
    for (let y = y0 - R; y <= y0 + R; y++) for (let x = x0 - R; x <= x0 + R; x++) {
      if (x < 2 || y < 2 || x >= W - 2 || y >= H - 2) continue;
      const i = I(x, y, 0), t = S.tiles[i];
      if (t === T.ROCK) { S.tiles[i] = T.GRASS; got.pedra = (got.pedra || 0) + 2; }
      else if (t === T.TREE) { S.tiles[i] = T.SAPLING; got.madeira = (got.madeira || 0) + TREE_WOOD; }
      else if (t === T.SAPLING) { S.tiles[i] = T.GRASS; got.madeira = (got.madeira || 0) + SAPLING_WOOD; }
    }
    for (let k = S.animals.length - 1; k >= 0; k--) {
      const a = S.animals[k], sp = SPECIES[a.kind];
      if (sp.protegido || Math.hypot(a.x - s2.x, a.y - s2.y) > 1 + R) continue;
      S.animals.splice(k, 1); got.carne = (got.carne || 0) + sp.carne;
    }
    const list = Object.entries(got);
    for (const [k, n] of list) give(k, n);
    if (list.length) toast('Catapulta: ' + list.map(([k, n]) => `+${n} ${ITEMS[k].nome.toLowerCase()}`).join(', '), 'gold');
  }
  const MANA_MAX = 5, MANA_REGEN = 3.5;   // cargas e segundos por carga
  function shotsTick(dt, now) {
    mana = Math.min(MANA_MAX, mana + dt / MANA_REGEN);
    shotAnim = Math.max(0, shotAnim - dt);
    for (let k = shots.length - 1; k >= 0; k--) {
      const s2 = shots[k], st = Math.hypot(s2.vx, s2.vy) * dt;
      s2.x += s2.vx * dt; s2.y += s2.vy * dt; s2.left -= st;
      if (s2.kind === 'pedra') {   // voa por cima de tudo e só cai no fim
        if (s2.left <= 0 || tileAt(Math.floor(s2.x), Math.floor(s2.y), 0) === 255) { stoneLand(s2); shots.splice(k, 1); }
        continue;
      }
      let end = s2.left <= 0;
      const tx = Math.floor(s2.x), ty = Math.floor(s2.y), t = tileAt(tx, ty, s2.z);
      if (!end && (t === 255 || !walkable(t, s2.z) || (s2.z === 0 && buildBlocks(s2.x, s2.y)))) { end = true; sfx('toque'); }
      if (!end && s2.z === 0) {
        const ai = S.animals.findIndex(a => (a.x - s2.x) ** 2 + (a.y - s2.y + 0.2) ** 2 < 0.36);
        if (ai >= 0) {
          const a = S.animals[ai], sp = SPECIES[a.kind];
          end = true;
          if (s2.kind === 'magia') {
            a.stun = now + 6000; sfx('atordoa');
            toast(`${sp.nome} atordoado: use a rede, ela pega na certa`, 'leaf');
          } else if (sp.protegido) toast('Pintinhos não podem ser caçados', 'warn');
          else {
            S.animals.splice(ai, 1);
            give('carne', sp.carne); sfx('acerto');
            toast(`+${sp.carne} Carne de caça (${sp.nome})`);
          }
        }
      }
      if (end) {
        if (s2.kind === 'magia') effects.push({ name: 'magia_estouro', x: s2.x, y: s2.y, z: s2.z, t0: now, dur: 350 });
        shots.splice(k, 1);
      }
    }
    for (let k = effects.length - 1; k >= 0; k--) if (now - effects[k].t0 > effects[k].dur) effects.splice(k, 1);
  }
  function drawShots(camX, camY, now) {
    for (const s2 of shots) {
      if (s2.z !== S.p.z) continue;
      const x = s2.x * tp - camX, y = s2.y * tp - camY, ang = Math.atan2(s2.vy, s2.vx);
      if (s2.kind === 'pedra') {   // arco no ar com sombra no chão
        const k = 1 - s2.left / s2.total, hgt = Math.sin(k * Math.PI) * 2.6 * tp, sz = (0.45 + 0.25 * Math.sin(k * Math.PI)) * tp;
        ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(x, y + tp * 0.3, sz * 0.45, sz * 0.18, 0, 0, Math.PI * 2); ctx.fill();
        const r = art2Rect('catapulta_pedra');
        if (r) ctx.drawImage(art2, r[0], r[1], r[2], r[3], x - sz / 2, y - hgt - sz / 2, sz, sz);
        else { ctx.fillStyle = '#8d8070'; ctx.beginPath(); ctx.arc(x, y - hgt, sz / 2, 0, Math.PI * 2); ctx.fill(); }
        continue;
      }
      const sr2 = artRect(s2.kind === 'flecha' ? 'flecha_voo' : 'magia_voo');
      if (sr2) {
        ctx.save(); ctx.translate(x, y); ctx.rotate(s2.kind === 'flecha' ? ang : ang + Math.PI / 4);
        const w = (s2.kind === 'flecha' ? 0.9 : 0.6) * tp, h = w * sr2[3] / sr2[2];
        ctx.drawImage(art, sr2[0], sr2[1], sr2[2], sr2[3], -w * (s2.kind === 'flecha' ? 0.6 : 0.65), -h * (s2.kind === 'flecha' ? 0.5 : 0.35), w, h);
        ctx.restore();
        continue;
      }
      ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
      if (s2.kind === 'flecha') {
        ctx.fillStyle = '#7a5230'; ctx.fillRect(-tp * 0.35, -tp * 0.025, tp * 0.6, tp * 0.05);
        ctx.fillStyle = '#d8dde3'; ctx.beginPath(); ctx.moveTo(tp * 0.32, 0); ctx.lineTo(tp * 0.22, -tp * 0.07); ctx.lineTo(tp * 0.22, tp * 0.07); ctx.fill();
        ctx.fillStyle = '#e8e0c8'; ctx.fillRect(-tp * 0.38, -tp * 0.07, tp * 0.1, tp * 0.05); ctx.fillRect(-tp * 0.38, tp * 0.02, tp * 0.1, tp * 0.05);
      } else {
        for (let j = 4; j >= 1; j--) {   // rastro
          ctx.fillStyle = `rgba(150,110,255,${0.12 * (5 - j)})`;
          ctx.beginPath(); ctx.arc(-j * tp * 0.12, 0, tp * (0.16 - j * 0.02), 0, Math.PI * 2); ctx.fill();
        }
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, tp * 0.3);
        g.addColorStop(0, '#ffffff'); g.addColorStop(0.35, '#c7b2ff'); g.addColorStop(1, 'rgba(120,80,255,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, tp * 0.3, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    }
    for (const fx of effects) {
      if (fx.z !== S.p.z) continue;
      const k = (now - fx.t0) / fx.dur, inAtlas2 = fx.name.startsWith('catapulta');
      const r = inAtlas2 ? art2Rect(fx.name) : artRect(fx.name);
      if (!r) continue;
      const w = (inAtlas2 ? 1.3 : 0.9) * tp * (0.6 + 0.6 * k), h = w * r[3] / r[2];
      ctx.globalAlpha = Math.max(0, 1 - k * k);
      ctx.drawImage(inAtlas2 ? art2 : art, r[0], r[1], r[2], r[3], fx.x * tp - camX - w / 2, fx.y * tp - camY - h * 0.7, w, h);
      ctx.globalAlpha = 1;
    }
    if (S.p.z === 0) for (const a of S.animals) {   // estrelinhas em volta dos atordoados
      if (!(a.stun > now)) continue;
      const x = a.x * tp - camX, y = a.y * tp - camY - tp * 0.75;
      for (let j = 0; j < 3; j++) {
        const an = now / 300 + j * 2.1;
        ctx.fillStyle = j % 2 ? '#fff3a0' : '#c7b2ff';
        ctx.fillRect(x + Math.cos(an) * tp * 0.3 - 2, y + Math.sin(an) * tp * 0.1 - 2, 4, 4);
      }
    }
  }
  // arco e cetro desenhados por código (até chegar a arte do Gemini)
  function drawWeapon(tool, name, cx, bottom, h, flip, dir) {
    const hp = ATLAS['hand_' + name], sr = artRect(name);
    let hx = cx + (dir === 2 ? -0.22 : 0.22) * tp, hy = bottom - h * 0.42;
    if (hp && sr) { const k = h / sr[3], w = sr[2] * k; hx = flip ? cx + w / 2 - hp[0] * k : cx - w / 2 + hp[0] * k; hy = bottom - h + hp[1] * k; }
    const u2 = tp / 16, side = dir === 2 ? -1 : 1;
    const wr = artRect(tool === 'arco' ? 'arco_mao' : shotAnim > 0 || Math.sin(performance.now() / 400) > 0.6 ? 'cetro_brilho' : 'cetro_mao');
    if (wr) {   // arte (folha armas.jpg): desenhada na diagonal, endireitada na mão
      const L = (tool === 'arco' ? 1.05 : 1.3) * tp, k = L / Math.hypot(wr[2], wr[3]), w = wr[2] * k, hh = wr[3] * k;
      ctx.save(); ctx.translate(hx + (dir >= 2 ? side * 2 * u2 : 0), hy);
      if (dir === 2) ctx.scale(-1, 1);
      ctx.rotate(tool === 'arco' ? -Math.PI / 4 + 0.05 : -Math.PI / 4 + 0.18);
      if (tool === 'arco') ctx.drawImage(art, wr[0], wr[1], wr[2], wr[3], -w * 0.5, -hh * 0.5, w, hh);
      else ctx.drawImage(art, wr[0], wr[1], wr[2], wr[3], -w * 0.22, -hh * 0.78, w, hh);
      ctx.restore();
      return;
    }
    ctx.save(); ctx.translate(hx + (dir >= 2 ? side * 3 * u2 : 0), hy);
    if (tool === 'arco') {
      const pull = shotAnim > 0 ? 0 : 1;
      ctx.strokeStyle = '#6b4426'; ctx.lineWidth = 1.6 * u2;
      ctx.beginPath(); ctx.arc(dir >= 2 ? 0 : 0, 0, 6.5 * u2, side > 0 ? -1.15 : Math.PI - 1.15 + 0, side > 0 ? 1.15 : Math.PI + 1.15); ctx.stroke();
      ctx.strokeStyle = '#efe6cc'; ctx.lineWidth = Math.max(1, 0.45 * u2);
      const ex = Math.cos(1.15) * 6.5 * u2 * side, ey = Math.sin(1.15) * 6.5 * u2;
      ctx.beginPath(); ctx.moveTo(ex, -ey); ctx.lineTo(-pull * side * u2, 0); ctx.lineTo(ex, ey); ctx.stroke();
    } else {
      ctx.fillStyle = '#4a2e5e'; ctx.fillRect(-0.7 * u2, -9 * u2, 1.4 * u2, 14 * u2);
      ctx.fillStyle = '#c9a64a'; ctx.fillRect(-1.6 * u2, -9.6 * u2, 3.2 * u2, 1.2 * u2);
      const pulse = 0.75 + 0.25 * Math.sin(performance.now() / 260) + (shotAnim > 0 ? 0.6 : 0);
      const g = ctx.createRadialGradient(0, -11.5 * u2, 0, 0, -11.5 * u2, 5 * u2 * pulse);
      g.addColorStop(0, '#ffffff'); g.addColorStop(0.3, '#b49bff'); g.addColorStop(1, 'rgba(120,80,255,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, -11.5 * u2, 5 * u2 * pulse, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#8f6cff'; ctx.fillRect(-1.3 * u2, -12.8 * u2, 2.6 * u2, 2.6 * u2);
    }
    ctx.restore();
  }

  // ---- Desgaste das ferramentas
  const shopName = id => (SHOP.find(x => x.id === id) || {}).nome || id;
  function activeVariant(tool) {
    for (const id of WEAR[tool] || []) if (S.owned[id]) return id;
    return BASIC[tool] ? tool : null;
  }
  function toolUsable(tool) {
    if (!BASIC[tool]) return true;
    return (WEAR[tool] || []).some(id => S.owned[id]) || !S.broken[tool];
  }
  function durFrac(tool) {
    const v = activeVariant(tool);
    if (!v) return null;
    const max = BASIC[v] ? BASIC[v].dur : DUR[v];
    const left = S.dur[v] ?? max;
    return BASIC[v] && S.broken[v] && v === tool ? 0 : clamp(left / max, 0, 1);
  }
  function wear(tool) {
    const v = activeVariant(tool);
    if (!v) return;
    invDirty = true;
    if (!BASIC[v]) {
      S.dur[v] = (S.dur[v] ?? DUR[v]) - 1;
      if (S.dur[v] <= 0) { delete S.owned[v]; delete S.dur[v]; toast(`${shopName(v)} quebrou. Compre outra na loja.`, 'warn', 4000); }
      return;
    }
    S.dur[v] = (S.dur[v] ?? BASIC[v].dur) - 1;
    if (S.dur[v] <= 0) { S.dur[v] = 0; S.broken[v] = true; toast(`${BASIC[v].nome} quebrou. Faça outra na Mochila.`, 'warn', 4500); }
  }
  function craft(tool) {
    const b = BASIC[tool];
    if (!b || !payAll(b.receita)) { toast('Faltam materiais', 'warn'); return; }
    S.broken[tool] = false; S.dur[tool] = b.dur;
    toast(`Fez: ${b.nome}`, 'leaf');
  }
  const swordBonus = () => (S.owned.espada2 ? 2 : S.owned.espada1 ? 1 : 0);

  // Água: cada bloco aberto recebe o maior nível vizinho menos 1; fontes são fixas.
  // Buracos deixam a água cair para a camada de baixo sem perder força.
  // Para o mapa grande rodar bem no celular, só a região em volta do jogador é simulada.
  function waterTick() {
    const tl = S.tiles, w = S.water, w2 = S.water2, layer = W * H;
    const px0 = Math.floor(S.p.x), py0 = Math.floor(S.p.y);
    const xa = Math.max(1, px0 - WATER_RX), xb = Math.min(W - 2, px0 + WATER_RX);
    const ya = Math.max(1, py0 - WATER_RY), yb = Math.min(H - 2, py0 + WATER_RY);
    for (let z = 0; z < D; z++) {
      for (let y = ya; y <= yb; y++) {
        let i = I(xa, y, z);
        for (let x = xa; x <= xb; x++, i++) {
          const t = tl[i];
          if (t === T.SOURCE) { w2[i] = SOURCE_LEVEL; continue; }
          const open = z === 0 ? (t === T.VALA || t === T.HOLE) : (t === T.AIR || t === T.HOLE);
          if (!open) { w2[i] = 0; continue; }
          let m = Math.max(w[i - 1], w[i + 1], w[i - W], w[i + W]) - 1;
          if (z > 0) { const a = i - layer; if (tl[a] === T.HOLE && w[a] > m) m = w[a]; }
          w2[i] = m > 0 ? m : 0;
        }
      }
    }
    // fora da janela, copia o estado anterior para a água não sumir
    for (let z = 0; z < D; z++) {
      const base = z * layer;
      for (let y = 0; y < H; y++) {
        const row = base + y * W;
        if (y < ya || y > yb) { w2.set(w.subarray(row, row + W), row); continue; }
        if (xa > 0) w2.set(w.subarray(row, row + xa), row);
        if (xb < W - 1) w2.set(w.subarray(row + xb + 1, row + W), row + xb + 1);
      }
    }
    S.water = w2; S.water2 = w;
  }

  function wetAround(x, y) {
    const w = S.water;
    return w[I(x + 1, y, 0)] > 0 || w[I(x - 1, y, 0)] > 0 || w[I(x, y + 1, 0)] > 0 || w[I(x, y - 1, 0)] > 0;
  }

  // Plantações crescem de dia (bem mais rápido com água ao lado); terra arada vazia volta a ser grama.
  function farmTick() {
    const tl = S.tiles, aux = S.aux, day = isDay();
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
      const i = y * W + x, t = tl[i];
      if (t === T.CROP) {
        if (aux[i] < 3) {
          const wet = wetAround(x, y), B = BIOMES[S.biome[i]];
          const chance = (day ? (wet ? 0.16 : 0.03) : (wet && B.id !== 'neve' ? 0.03 : 0)) * B.cresce;
          if (Math.random() < chance) aux[i]++;
        }
      } else if (t === T.TILLED) {
        if (Math.random() < 0.003) tl[i] = T.GRASS;
      } else if (t === T.SAPLING) {
        if (Math.random() < 0.0018) tl[i] = T.TREE;   // muda vira árvore adulta em ~14 min, em média
      }
    }
  }

  // ================= Animais =================
  function nearWater(x, y, r) {
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      const xx = x + dx, yy = y + dy;
      if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
      if (S.water[I(xx, yy, 0)] > 0 || S.tiles[I(xx, yy, 0)] === T.SOURCE) return true;
    }
    return false;
  }
  const countKind = k => S.animals.reduce((n, a) => n + (a.kind === k), 0);

  // Sorteia a espécie; raras só aparecem nas condições delas, senão vira um animal comum
  function pickKind(x, y) {
    const B = BIOMES[S.biome[y * W + x]];
    // cada bioma muda a chance das espécies; o pavão só vive em floresta e pântano
    if (Math.random() < 0.012 * B.pavao && isDay() && countKind('pavao') < RARE_CAP.pavao) return 'pavao';
    if (Math.random() < 0.06 * B.raposa && !isDay() && countKind('raposa') < RARE_CAP.raposa) return 'raposa';
    if (Math.random() < 0.07 * B.cervo && countKind('cervo') < RARE_CAP.cervo && nearWater(x, y, 5)) return 'cervo';
    if (B.id === 'deserto' && Math.random() < 0.6) return 'coelho';
    return Math.random() < 0.5 ? 'galinha' : 'coelho';
  }
  // Animais nascem em volta do jogador (o mapa é grande demais para povoar inteiro)
  function spawnAnimal(far, forced) {
    for (let tries = 0; tries < 60; tries++) {
      const rmin = forced === 'javali' ? 30 : far ? 14 : 4, rmax = forced === 'javali' ? 65 : 55;
      const ang = Math.random() * Math.PI * 2, r = rmin + Math.random() * (rmax - rmin);
      const x = Math.floor(S.p.x + Math.cos(ang) * r), y = Math.floor(S.p.y + Math.sin(ang) * r);
      if (x < 3 || y < 3 || x >= W - 3 || y >= H - 3) continue;
      if (S.tiles[I(x, y, 0)] !== T.GRASS) continue;
      const kind = forced || pickKind(x, y);
      const a = { x: x + 0.5, y: y + 0.5, kind, vx: 0, vy: 0, next: 0, dir: Math.floor(Math.random() * 4), flee: 0 };
      if (kind === 'javali') a.expire = performance.now() + LEGEND_MS;
      S.animals.push(a);
      // algumas galinhas andam com 1 a 3 pintinhos atrás
      if (kind === 'galinha' && Math.random() < 0.4) {
        const n = 1 + Math.floor(Math.random() * 3);
        for (let k = 0; k < n; k++) {
          S.animals.push({ x: a.x + (Math.random() - 0.5) * 1.4, y: a.y + 0.6 + Math.random() * 0.8, kind: 'pintinho',
            vx: 0, vy: 0, next: 0, dir: a.dir, flee: 0, mother: a });
        }
      }
      return a;
    }
    return null;
  }
  function legendCheck() {
    if (isDay() || S.animals.some(a => a.kind === 'javali')) return;
    if (Math.random() < LEGEND_CHANCE && spawnAnimal(true, 'javali')) {
      toast('Um javali dourado apareceu em algum lugar distante. Ele some antes do amanhecer.', 'gold', 6000);
    }
  }
  function animalsTick(dt, now) {
    const p = S.p;
    S.animals = S.animals.filter(a => {
      if (a.kind === 'javali' && (now > a.expire || isDay())) return false;
      if (a.kind === 'raposa' && isDay() && Math.random() < dt * 0.02) return false;
      if (a.kind !== 'javali' && (a.x - p.x) ** 2 + (a.y - p.y) ** 2 > 85 * 85) return false;   // longe demais
      return true;
    });
    for (const a of S.animals) {
      if (a.stun > now) { a.vx = a.vy = 0; continue; }   // atordoado pela magia
      const sp0 = SPECIES[a.kind].speed;
      const dist2 = (a.x - p.x) ** 2 + (a.y - p.y) ** 2;
      if (a.mother && !S.animals.includes(a.mother)) a.mother = null;
      const mom = a.mother, md = mom ? Math.hypot(mom.x - a.x, mom.y - a.y) : 0;
      if (mom && md > 1.6 && now >= a.flee) {
        // pintinho corre atrás da mãe
        const sp = Math.min(sp0 * 1.6, Math.hypot(mom.vx, mom.vy) + 1.2);
        a.vx = (mom.x - a.x) / md * sp; a.vy = (mom.y - a.y) / md * sp;
        a.next = now + 300;
      } else if (p.z === 0 && (now < a.flee || (SPECIES[a.kind].foge && dist2 < 16))) {
        // foge na direção oposta ao jogador
        const ang = Math.atan2(a.y - p.y, a.x - p.x) + (Math.random() - 0.5) * 0.6;
        const sp = sp0 * (now < a.flee ? 1.5 : 1.15);
        a.vx = Math.cos(ang) * sp; a.vy = Math.sin(ang) * sp;
        a.next = now + 400;
      } else if (now > a.next) {
            const r = Math.random(), sp = sp0;
        if (r < 0.4) { a.vx = 0; a.vy = 0; }
        else { const d = DIRS[Math.floor(Math.random() * 4)]; a.vx = d[0] * sp * (mom ? 0.5 : 1); a.vy = d[1] * sp * (mom ? 0.5 : 1); }
        a.next = now + 700 + Math.random() * 1700;
      }
      // vira para a direção em que anda (0 baixo, 1 cima, 2 esquerda, 3 direita)
      if (a.vx || a.vy) a.dir = Math.abs(a.vx) > Math.abs(a.vy) ? (a.vx < 0 ? 2 : 3) : (a.vy < 0 ? 1 : 0);
      const nx = a.x + a.vx * dt;
      if (canStand(nx, a.y, 0, 0.25)) a.x = nx; else a.vx = -a.vx;
      const ny = a.y + a.vy * dt;
      if (canStand(a.x, ny, 0, 0.25)) a.y = ny; else a.vy = -a.vy;
    }
  }

  // ================= Compradores (NPCs) =================
  function grassNear(cx, cy, rmin, rmax) {
    for (let tries = 0; tries < 200; tries++) {
      const ang = Math.random() * Math.PI * 2, r = rmin + Math.random() * (rmax - rmin);
      const x = Math.floor(cx + Math.cos(ang) * r), y = Math.floor(cy + Math.sin(ang) * r);
      if (x < 3 || y < 3 || x >= W - 3 || y >= H - 3) continue;
      if (S.tiles[I(x, y, 0)] === T.GRASS) return [x + 0.5, y + 0.5];
    }
    return null;
  }
  function placeNpcs() {
    const cx = SPAWN.x, cy = SPAWN.y, saved = S.savedNpcs || [];
    S.npcs = MERCHANTS.map((m, k) => {
      const old = saved.find(s => s.id === m.id);
      let pos = old && walkable(tileAt(Math.floor(old.x), Math.floor(old.y), 0), 0) ? [old.x, old.y] : null;
      if (!pos) pos = grassNear(cx, cy, k < 2 ? 7 : 25, k < 2 ? 13 : 40) || [cx + 0.5, cy + 0.5];
      return { id: m.id, def: m, x: pos[0], y: pos[1], tx: null, ty: null, waitUntil: performance.now() + 20000 + k * 15000, face: 0, stuck: 0, phase: 0, moving: false };
    });
    delete S.savedNpcs;
  }
  function npcTick(dt, now) {
    const p = S.p;
    for (const n of S.npcs) {
      n.moving = false;
      const nearPlayer = p.z === 0 && (n.x - p.x) ** 2 + (n.y - p.y) ** 2 < 6.25;
      if (nearPlayer) {   // para e olha para o jogador
        hint('npc', `${n.def.nome} ${n.def.papel}. Fique de frente e aperte Usar para vender.`);
        const dx = p.x - n.x, dy = p.y - n.y;
        n.face = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 2 : 3) : (dy < 0 ? 1 : 0);
        continue;
      }
      if (now < n.waitUntil) continue;
      if (n.tx === null) {
        // viajam livremente, mas quando se afastam demais do início tendem a voltar
        const far = Math.hypot(n.x - SPAWN.x, n.y - SPAWN.y) > 110;
        const bx = far ? n.x + (SPAWN.x - n.x) * 0.4 : n.x, by = far ? n.y + (SPAWN.y - n.y) * 0.4 : n.y;
        const t = grassNear(bx, by, far ? 0 : 15, far ? 20 : 45);
        if (!t) { n.waitUntil = now + 5000; continue; }
        [n.tx, n.ty] = t;
      }
      const dx = n.tx - n.x, dy = n.ty - n.y, dist = Math.hypot(dx, dy);
      if (dist < 0.3) {   // chegou: acampa
        n.tx = n.ty = null;
        n.waitUntil = now + CAMP_MS[0] + Math.random() * (CAMP_MS[1] - CAMP_MS[0]);
        continue;
      }
      const step = NPC_SPEED * dt;
      const sx = Math.sign(dx) * Math.min(step, Math.abs(dx)), sy = Math.sign(dy) * Math.min(step, Math.abs(dy));
      const firstX = Math.abs(dx) > Math.abs(dy);
      let moved = false;
      const tryX = () => { if (sx && canStand(n.x + sx, n.y, 0, 0.3)) { n.x += sx; n.face = sx < 0 ? 2 : 3; return true; } return false; };
      const tryY = () => { if (sy && canStand(n.x, n.y + sy, 0, 0.3)) { n.y += sy; n.face = sy < 0 ? 1 : 0; return true; } return false; };
      moved = firstX ? (tryX() || tryY()) : (tryY() || tryX());
      if (moved) { n.moving = true; n.phase += dt * 10; n.stuck = 0; }
      else if ((n.stuck += dt) > 1.2) { n.tx = n.ty = null; n.stuck = 0; }   // caminho bloqueado: escolhe outro destino
    }
  }
  function npcInFront(x, y) {
    if (S.p.z !== 0) return null;
    const cx = x + 0.5, cy = y + 0.5;
    return S.npcs.find(n => (n.x - cx) ** 2 + (n.y - cy) ** 2 < 0.9 || (n.x - S.p.x) ** 2 + (n.y - S.p.y) ** 2 < 0.8) || null;
  }

  // ================= Ações do jogador =================
  let cooldown = 0, swing = 0;
  const hits = new Map();

  function target() {
    const p = S.p, d = DIRS[p.dir];
    return { x: Math.floor(p.x) + d[0], y: Math.floor(p.y) + d[1], z: p.z };
  }
  function hint(key, msg) {
    if (S.hints[key]) return;
    S.hints[key] = 1;
    toast(msg, 'leaf', 4200);
  }
  function playerInTile(x, y) {
    const p = S.p, r = 0.3;
    return p.x + r > x && p.x - r < x + 1 && p.y + r > y && p.y - r < y + 1;
  }

  function mineCell(i, t, after) {
    const m = MINE[t], tier = pickTier();
    if (m.hard > tier) {
      toast(`Precisa de picareta de ${TIER_NAME[m.hard]}`, 'warn');
      cooldown = 0.6;
      return false;
    }
    const need = mineHits(m), h = (hits.get(i)?.h || 0) + 1;
    cooldown = 0.28;
    wear('picareta'); sfx(t === T.DIRT ? 'cavar' : 'pedra');
    if (h < need) { hits.set(i, { h, need }); return false; }
    hits.delete(i);
    S.tiles[i] = after; sfx('quebra');
    if (m.drop) {
      give(m.drop, m.n);
      toast(`+${m.n} ${ITEMS[m.drop].nome}`, m.hard >= 2 ? 'gold' : '');
    }
    return true;
  }

  // Muros: desmontar leva golpes conforme o material e devolve tudo o que foi gasto
  function hitWall(i, z, tool) {
    const m = S.wmat[i], mat = WALL_MATS[m] || WALL_MATS[0], gate = S.tiles[i] === T.GATE;
    if (tool === 'machado' && mat.id !== 'madeira') { toast('O machado só desmonta paliçada. Use a picareta.', 'warn'); cooldown = 0.5; return; }
    const need = Math.max(1, mat.golpes - (tool === 'picareta' ? pickTier() : axeTier())), h = (hits.get(i)?.h || 0) + 1;
    cooldown = 0.3; wear(tool); sfx(mat.id === 'madeira' ? 'corte' : 'pedra');
    if (h < need) { hits.set(i, { h, need }); return; }
    hits.delete(i);
    const back = wallCost(m, gate);
    S.tiles[i] = z === 0 ? T.GRASS : T.AIR; S.wmat[i] = 0;
    giveAll(back);
    toast(`${gate ? 'Portão' : mat.nome} desmontado: ${costTxt(back)} de volta`);
  }
  function placeWall(x, y, z, t, i) {
    const gate = S.sel.k === 'portao', m = S.sel.m || 0, cost = wallCost(m, gate);
    const isWall = t === T.WALL || t === T.GATE;
    const free = z === 0 ? (t === T.GRASS || t === T.TILLED) : t === T.AIR;
    if (!free && !isWall) return;
    if (isWall && S.wmat[i] === m && (t === T.GATE) === gate) return;
    if (playerInTile(x, y) && !gate) return;
    if (z === 0 && S.builds.some(b => { const hb = shapeHit(b, x + 0.5, y + 0.5); return hb === 'solid' || (hb && BUILDS[b.k].tipo !== 'forte'); })) {
      toast('Tem uma construção aí', 'warn'); return;
    }
    if (!payAll(cost)) { toast(`Precisa de ${costTxt(cost)}`, 'warn'); cooldown = 0.5; return; }
    if (isWall) giveAll(wallCost(S.wmat[i], t === T.GATE));   // trocando o material: devolve o antigo
    S.tiles[i] = gate ? T.GATE : T.WALL; S.wmat[i] = m; sfx('construir');
    hits.delete(i);
    hint(gate ? 'portao' : 'muros', gate ? 'O portão abre sozinho quando você chega perto.'
      : 'Muros vizinhos se encaixam. Toque no nome da ferramenta (ou R) para trocar o material.');
  }

  // ---- Casas, fortalezas, torres, móveis e robôs comprados na loja
  function candidate(k) {
    const d = BUILDS[k], p = S.p, tg = target(), w = d.w, h = d.h;
    let x0, y0;
    if (p.dir === 1) { x0 = tg.x - Math.floor(w / 2); y0 = tg.y - h + 1; }
    else if (p.dir === 0) { x0 = tg.x - Math.floor(w / 2); y0 = tg.y; }
    else if (p.dir === 2) { x0 = tg.x - w + 1; y0 = tg.y - Math.floor(h / 2); }
    else { x0 = tg.x; y0 = tg.y - Math.floor(h / 2); }
    return { k, x: x0, y: y0 };
  }
  // o que pode ficar dentro do quê: tudo (menos outro forte) dentro de um forte; móveis dentro de casas
  const nestOK = (outer, inner) => {
    const o = BUILDS[outer.k].tipo, n = BUILDS[inner.k].tipo;
    return (o === 'forte' && n !== 'forte') || (o === 'casa' && (n === 'movel' || n === 'armadilha'));
  };
  function placeProblem(c) {
    const d = BUILDS[c.k];
    if (S.p.z !== 0) return 'Construções ficam na superfície';
    if (c.x < 2 || c.y < 2 || c.x + d.w > W - 2 || c.y + d.h > H - 2) return 'Fora do mapa';
    const small = d.w * d.h <= 4;
    for (let y = c.y; y < c.y + d.h; y++) for (let x = c.x; x < c.x + d.w; x++) {
      const px = x + 0.5, py = y + 0.5, hc = shapeHit(c, px, py);
      if (!hc) continue;
      const i = I(x, y, 0), t = S.tiles[i];
      if (t === T.SOURCE || t === T.HOLE || t === T.WALL || t === T.GATE) return 'Tem água, buraco ou muro no caminho';
      if (small && !(t === T.GRASS || t === T.TILLED || t === T.VALA || t === T.CROP)) return 'Limpe o terreno antes';
      if (small && S.water[i] > 0) return 'Não dá para colocar na água';
      for (const b of S.builds) {
        const hb = shapeHit(b, px, py);
        if (!hb) continue;
        if (hb === 'solid' || !(nestOK(b, c) || (hc === 'inside' && nestOK(c, b)))) return 'Encostado em outra construção';
      }
      if (hc === 'solid' && Math.abs(px - S.p.x) < 0.85 && Math.abs(py - S.p.y) < 0.85) return 'Saia de onde vai a construção';
    }
    return null;
  }
  function addBuild(c) {
    const d = BUILDS[c.k];
    const b = { k: d.tipo === 'forte' && d.arte ? d.arte : c.k, x: c.x, y: c.y };
    if (d.tipo === 'casa' || d.tipo === 'forte' || d.tipo === 'torre') {   // limpa o terreno embaixo
      for (let y = c.y; y < c.y + d.h; y++) for (let x = c.x; x < c.x + d.w; x++) {
        if (!shapeHit(b, x + 0.5, y + 0.5)) continue;
        const i = I(x, y, 0), t = S.tiles[i];
        if (t === T.TREE || t === T.SAPLING || t === T.ROCK || t === T.TILLED || t === T.CROP || t === T.VALA) { S.tiles[i] = T.GRASS; S.aux[i] = 0; }
      }
    }
    S.builds.push(b);
    return b;
  }
  function placeKit(k) {
    const d = BUILDS[k];
    if (!(S.kit[k] > 0)) { toast(`Você não tem ${d.nome.toLowerCase()}. Compre na loja.`, 'warn'); return; }
    if (d.tipo === 'robo') {
      const tg = target();
      if (S.p.z !== 0 || !walkable(tileAt(tg.x, tg.y, 0), 0) || buildBlocks(tg.x + 0.5, tg.y + 0.5)) { toast('Coloque o robô num chão livre da superfície', 'warn'); return; }
      S.kit[k]--; S.bots.push(newBot({ x: tg.x + 0.5, y: tg.y + 0.5 }));
      toast('Robô ligado. Ele procura minério embaixo deste lugar.', 'leaf', 3500);
    } else {
      const c = candidate(k), prob = placeProblem(c);
      if (prob) { toast(prob, 'warn'); cooldown = 0.5; return; }
      S.kit[k]--;
      addBuild(c); sfx('construir');
      for (const [jk, ox, oy] of d.junto || []) addBuild({ k: jk, x: c.x + ox, y: c.y + oy });
      toast(`${d.nome}: pronto`, 'gold');
      if (d.tipo === 'casa') hint('casa', 'Para entrar ou sair, é só andar contra a parede. Para mudar de lugar: Construir.');
    }
    if (!(S.kit[k] > 0)) S.sel = { k: 'muro', m: 0 };
    invDirty = true; save();
  }
  function pickupTarget() {
    const tg = target(), pts = [[tg.x + 0.5, tg.y + 0.5], [S.p.x, S.p.y]];
    if (S.p.z !== 0) return null;
    const bot = S.bots.find(b => pts.some(([x, y]) => Math.hypot(b.x - x, b.y - y) < 1.1));
    if (bot) return { bot };
    let best = null, area = Infinity;
    for (const b of S.builds) {
      const d = BUILDS[b.k];
      if (pts.some(([x, y]) => shapeHit(b, x, y)) && d.w * d.h < area) { best = b; area = d.w * d.h; }
    }
    return best ? { b: best } : null;
  }
  // guarda (volta para "Suas construções") ou vende pela metade do preço; casas levam os móveis de dentro
  function removeBuild(b, vender) {
    const d = BUILDS[b.k], gone = [b];
    if (d.tipo === 'casa' || d.tipo === 'forte') for (const o of S.builds) {
      const od = BUILDS[o.k];
      if (o !== b && nestOK(b, o) && (d.tipo === 'casa' || od.tipo === 'movel') && shapeHit(b, o.x + od.w / 2, o.y + od.h / 2)) gone.push(o);
    }
    let coins = 0;
    for (const o of gone) {
      S.builds.splice(S.builds.indexOf(o), 1);
      const kk = o.k === 'muralha' && d.junto ? o.k : o.k;
      if (vender) coins += Math.floor(BUILDS[kk].preco / 2); else S.kit[kk] = (S.kit[kk] || 0) + 1;
    }
    if (vender) { S.coins += coins; sfx('moeda'); toast(`${d.nome} vendido: +${coins} moedas`, 'gold'); }
    else toast(gone.length > 1 ? `${d.nome} guardado com ${gone.length - 1} ${gone.length > 2 ? 'itens' : 'item'} de dentro` : `${d.nome}: guardado. Coloque de novo com Construir.`, 'leaf', 3200);
    invDirty = true; save();
  }
  function pickUp() {
    const r = pickupTarget();
    if (!r) { toast('Fique de frente para o que quer guardar', 'warn'); return; }
    if (r.bot) {
      collectBot(r.bot, true);
      S.bots.splice(S.bots.indexOf(r.bot), 1); S.kit.robo = (S.kit.robo || 0) + 1;
      toast('Robô guardado', 'leaf');
    } else {
      const b = r.b, d = BUILDS[b.k], gone = [b];
      if (d.tipo === 'casa') for (const o of S.builds) if (o !== b && nestOK(b, o) && shapeHit(b, o.x + 0.5, o.y + 0.5)) gone.push(o);
      for (const o of gone) { S.builds.splice(S.builds.indexOf(o), 1); S.kit[o.k] = (S.kit[o.k] || 0) + 1; }
      toast(gone.length > 1 ? `${d.nome} guardada com ${gone.length - 1} ${gone.length > 2 ? 'móveis' : 'móvel'}` : `${d.nome}: guardado. Coloque de novo com Construir.`, 'leaf', 3200);
    }
    invDirty = true; save();
  }

  // ---- Robô minerador: anda perto de onde foi posto e, de tempos em tempos, tira um minério de verdade
  // das camadas de baixo (o bloco vira pedra; pedra vira terra). Guarda até ROBO_CAP itens.
  function newBot(o) {
    return { x: o.x, y: o.y, hx: o.hx ?? o.x, hy: o.hy ?? o.y, store: o.store || {}, t: o.t || 0,
      mode: 'walk', tx: o.x, ty: o.y, face: 0, phase: 0, dig: 0, moving: false, msg: '' };
  }
  const botCount = b => Object.values(b.store).reduce((a, n) => a + n, 0);
  function botsTick(dt) {
    for (const b of S.bots) {
      if (b.mode === 'dig') { b.dig -= dt; b.phase += dt * 5; if (b.dig <= 0) { b.mode = 'walk'; botMine(b); } continue; }
      b.t += dt;
      if (b.t >= ROBO_EVERY && botCount(b) < ROBO_CAP) { b.t = 0; b.mode = 'dig'; b.dig = 2.4; b.phase = 0; b.moving = false; continue; }
      const dx = b.tx - b.x, dy = b.ty - b.y, dist = Math.hypot(dx, dy);
      if (dist < 0.08) {
        b.moving = false;
        if (Math.random() < dt * 0.5) { const a = Math.random() * 6.283, r = Math.random() * 2.5; b.tx = b.hx + Math.cos(a) * r; b.ty = b.hy + Math.sin(a) * r; }
        continue;
      }
      const st = Math.min(1.1 * dt, dist), nx = b.x + dx / dist * st, ny = b.y + dy / dist * st;
      if (canStand(nx, ny, 0, 0.25)) {
        b.x = nx; b.y = ny; b.moving = true; b.phase += dt * 9;
        b.face = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 2 : 3) : (dy < 0 ? 1 : 0);
      } else { b.tx = b.x; b.ty = b.y; b.moving = false; }
    }
  }
  function botMine(b) {
    if (botCount(b) >= ROBO_CAP) return;
    const hx = Math.floor(b.hx), hy = Math.floor(b.hy);
    let ore = null, stone = null;
    for (let z = 1; z < D; z++) for (let y = hy - ROBO_R; y <= hy + ROBO_R; y++) for (let x = hx - ROBO_R; x <= hx + ROBO_R; x++) {
      if (x < 1 || y < 1 || x >= W - 1 || y >= H - 1) continue;
      const t = S.tiles[I(x, y, z)], m = MINE[t];
      if (!m || !m.drop || m.hard > 1) continue;
      const dd = (x - hx) ** 2 + (y - hy) ** 2 + z * z + Math.random();
      if (t === T.STONE) { if (!stone || dd < stone.d) stone = { x, y, z, d: dd }; }
      else if (!ore || dd < ore.d) ore = { x, y, z, d: dd };
    }
    const pk = ore || stone;
    if (!pk) { b.msg = 'sem minério por perto'; return; }
    const i = I(pk.x, pk.y, pk.z), t = S.tiles[i], m = MINE[t];
    S.tiles[i] = t === T.STONE ? T.DIRT : T.STONE;
    b.store[m.drop] = (b.store[m.drop] || 0) + m.n;
    b.msg = '';
  }
  function botNear(x, y) {
    if (S.p.z !== 0) return null;
    return S.bots.find(b => Math.hypot(b.x - x - 0.5, b.y - y - 0.5) < 0.9 || Math.hypot(b.x - S.p.x, b.y - S.p.y) < 0.7) || null;
  }
  function collectBot(b, quiet) {
    const got = Object.entries(b.store).filter(([, n]) => n > 0);
    if (!got.length) { if (!quiet) toast(`Robô: ${b.msg || 'ainda procurando minério'}`); return; }
    for (const [k, n] of got) give(k, n);
    b.store = {};
    toast('Robô entregou: ' + got.map(([k, n]) => `${n} ${ITEMS[k].nome.toLowerCase()}`).join(', '), 'gold', 3200);
  }

  function animalInFront(x, y) {
    const cx = x + 0.5, cy = y + 0.5;
    return S.animals.findIndex(a =>
      (a.x - cx) ** 2 + (a.y - cy) ** 2 < 0.8 || (a.x - S.p.x) ** 2 + (a.y - S.p.y) ** 2 < 0.5);
  }
  function checkCatalog() {
    const all = Object.keys(SPECIES).every(k => S.catalog[k]);
    if (all && !S.hints.catalogo) {
      S.hints.catalogo = 1;
      S.coins += 300; invDirty = true;
      toast('Catálogo completo! +300 moedas', 'gold', 5000);
    }
  }

  function useTool() {
    const tool = TOOLS[S.tool].id;
    const { x, y, z } = target();
    const npc = npcInFront(x, y);
    if (npc) { actHeld = false; showSheet('sheet-shop', npc); return; }
    const door = tool !== 'muro' && doorAction();
    if (door) { actHeld = false; door(); return; }
    const cat = tool !== 'muro' && catapultInFront();
    if (cat) { actHeld = false; fireCatapult(cat); return; }
    const bot = tool !== 'muro' && botNear(x, y);
    if (bot) { actHeld = false; collectBot(bot); return; }
    if (!toolUsable(tool)) {
      actHeld = false;
      toast(`${BASIC[tool].nome} quebrou. Faça outra na Mochila ou compre uma melhor na loja.`, 'warn', 3500);
      return;
    }
    const t = tileAt(x, y, z);
    swing = SWING_TIME;
    cooldown = Math.max(cooldown, 0.25);
    if (t === 255) return;
    const i = I(x, y, z);

    if (tool === 'maos') { swing = 0; return; }   // mãos livres: só conversa com compradores
    switch (tool) {
      case 'picareta': {
        if (t === T.WALL || t === T.GATE) { hitWall(i, z, 'picareta'); return; }
        if (MINE[t]) { mineCell(i, t, z === 0 ? T.GRASS : T.AIR); return; }
        if (z === 0 && (t === T.GRASS || t === T.TILLED)) {
          if (buildBlocks(x + 0.5, y + 0.5)) return;
          S.tiles[i] = T.VALA; wear('picareta'); sfx('cavar');
          hint('vala', 'Vala cavada. Ligue a vala à lagoa e a água vai escorrer por ela.');
        }
        return;
      }
      case 'machado': {
        if ((t === T.TREE || t === T.SAPLING) && x > 1 && y > 1 && x < W - 2 && y < H - 2) {
          const need = t === T.SAPLING ? 1 : TREE_HITS[axeTier()], h = (hits.get(i)?.h || 0) + 1;
          cooldown = 0.32; wear('machado'); sfx('corte');
          if (h < need) { hits.set(i, { h, need }); return; }
          hits.delete(i);
          sfx('arvore');
          if (t === T.TREE) {
            S.tiles[i] = T.SAPLING; give('madeira', TREE_WOOD);
            toast(`+${TREE_WOOD} Madeira · ficou uma muda`);
            hint('muda', 'A muda cresce de novo com o tempo. Corte a muda para limpar o terreno.');
          } else { S.tiles[i] = T.GRASS; give('madeira', SAPLING_WOOD); toast(`+${SAPLING_WOOD} Madeira`); }
        } else if (t === T.WALL || t === T.GATE) hitWall(i, z, 'machado');
        return;
      }
      case 'enxada': {
        if (z !== 0) { toast('Plante na superfície', 'warn'); return; }
        if (t === T.GRASS && buildBlocks(x + 0.5, y + 0.5)) return;
        if (t === T.GRASS || t === T.TILLED || t === T.CROP) { wear('enxada'); sfx('cavar'); }
        if (t === T.GRASS) { S.tiles[i] = T.TILLED; hint('arar', 'Terra arada. Use a enxada de novo para plantar.'); }
        else if (t === T.TILLED) {
          if (take('sementes', 1)) {
            S.tiles[i] = T.CROP; S.aux[i] = 0;
            if (!wetAround(x, y)) hint('agua', 'Plantas com água ao lado crescem bem mais rápido.');
          } else toast('Sem sementes. Compre na loja.', 'warn');
        } else if (t === T.CROP) {
          if (S.aux[i] >= 3) {
            S.tiles[i] = T.TILLED; S.aux[i] = 0;
            give('colheita', 1);
            const extra = Math.random() < 0.6 ? 1 : 0;
            if (extra) give('sementes', 1);
            toast(extra ? '+1 Trigo, +1 Semente' : '+1 Trigo', 'leaf');
          } else toast(wetAround(x, y) ? 'Ainda crescendo' : 'Crescendo devagar: falta água ao lado');
        }
        return;
      }
      case 'espada': {
        sfx('golpe');
        if (z !== 0) return;
        const k = animalInFront(x, y);
        if (k >= 0 && SPECIES[S.animals[k].kind].protegido) { toast('Pintinhos não podem ser caçados. Use a rede.', 'warn'); return; }
        if (k >= 0) {
          const sp = SPECIES[S.animals[k].kind];
          S.animals.splice(k, 1);
          const n = sp.carne + swordBonus();
          give('carne', n); wear('espada'); sfx('acerto');
          toast(`+${n} Carne de caça (${sp.nome})`);
          if (sp.raridade !== 'Comum') hint('rede', 'Animais vivos valem bem mais. Compre a rede na loja para capturar.');
        }
        return;
      }
      case 'rede': {
        if (!S.owned.rede) { toast('Compre a rede de captura na loja', 'warn'); return; }
        if (z !== 0) return;
        const k = animalInFront(x, y);
        if (k < 0) return;
        const a = S.animals[k], sp = SPECIES[a.kind];
        cooldown = 0.8; wear('rede'); sfx('golpe');
        if (a.stun > now || Math.random() < sp.chance) {
          S.animals.splice(k, 1);
          give(sp.vivo, 1);
          const novo = !S.catalog[a.kind];
          S.catalog[a.kind] = (S.catalog[a.kind] || 0) + 1;
          toast(`Capturou: ${sp.nome}${novo ? ' · nova no catálogo' : ''}`, sp.raridade === 'Comum' ? 'leaf' : 'gold', 3000);
          checkCatalog();
        } else {
          a.flee = performance.now() + 2500;
          toast(`${sp.nome} escapou da rede`, 'warn');
        }
        return;
      }
      case 'arco': case 'cetro': {
        swing = 0;
        if (!S.owned[tool]) { toast(`Compre ${tool === 'arco' ? 'o arco' : 'o cetro mágico'} na loja`, 'warn'); actHeld = false; return; }
        if (tool === 'arco' && !take('flechas', 1)) { toast('Sem flechas. Compre na loja.', 'warn'); actHeld = false; return; }
        if (tool === 'cetro') {
          if (mana < 1) { toast('Magia recarregando…', 'warn'); cooldown = 0.5; return; }
          mana -= 1;
        }
        const d = DIRS[S.p.dir];
        shots.push({ kind: tool === 'arco' ? 'flecha' : 'magia', x: S.p.x + d[0] * 0.4, y: S.p.y + d[1] * 0.4 - 0.2, z: S.p.z,
          vx: d[0] * (tool === 'arco' ? 13 : 9), vy: d[1] * (tool === 'arco' ? 13 : 9), left: tool === 'arco' ? 9 : 11, dir: S.p.dir });
        shotAnim = 0.25;
        cooldown = tool === 'arco' ? 0.55 : 0.45;
        wear(tool); sfx(tool === 'arco' ? 'arco' : 'magia');
        return;
      }
      case 'muro': {
        swing = 0;
        if (S.sel.k === 'kit') placeKit(S.sel.id);
        else placeWall(x, y, z, t, i);
        return;
      }
    }
  }

  function centerPlayer() { S.p.x = Math.floor(S.p.x) + 0.5; S.p.y = Math.floor(S.p.y) + 0.5; }
  function layerName(z) { return z === 0 ? 'Superfície' : `Camada ${z}${z >= 4 ? ' · mina profunda' : ''}`; }

  function upDown() {
    const p = S.p, x = Math.floor(p.x), y = Math.floor(p.y), z = p.z;
    if (z > 0 && tileAt(x, y, z - 1) === T.HOLE) {
      p.z--; centerPlayer(); toast(layerName(p.z)); return;
    }
    if (z >= D - 1) { toast('Esta é a camada mais funda', 'warn'); return; }
    const here = I(x, y, z), below = I(x, y, z + 1);
    const th = S.tiles[here], tb = S.tiles[below];
    if (z === 0 && th !== T.HOLE && buildBlocks(x + 0.5, y + 0.5)) { toast('Não dá para cavar aqui', 'warn'); return; }
    if (th !== T.HOLE) {
      const ok = z === 0 ? (th === T.GRASS || th === T.TILLED || th === T.VALA) : th === T.AIR;
      if (!ok) { toast('Não dá para cavar aqui', 'warn'); return; }
    }
    if (MINE[tb]) {
      const m = MINE[tb];
      if (m.hard > pickTier()) { toast(`Embaixo tem minério duro: precisa de picareta de ${TIER_NAME[m.hard]}`, 'warn'); return; }
      if (cooldown > 0) return;
      if (!toolUsable('picareta')) { toast('Sua picareta quebrou. Faça outra na Mochila.', 'warn'); return; }
      const need = mineHits(m), h = (hits.get(below)?.h || 0) + 1;
      cooldown = 0.28; swing = SWING_TIME; wear('picareta'); sfx('pedra');
      if (h < need) { hits.set(below, { h, need }); toast(`Cavando para baixo ${h}/${need}`); return; }
      hits.delete(below);
      if (m.drop) { give(m.drop, m.n); toast(`+${m.n} ${ITEMS[m.drop].nome}`, m.hard >= 2 ? 'gold' : ''); }
    }
    S.tiles[here] = T.HOLE;
    if (tb !== T.HOLE) S.tiles[below] = T.AIR;
    p.z++; centerPlayer();
    toast(layerName(p.z));
    hint('subir', 'Fique sobre a escada e aperte Subir para voltar.');
  }

  // ================= Casa =================
  const HOME_CHANNEL = 3000;          // segundos parado antes de voltar
  const HOME_COOLDOWN = 5 * 60 * 1000; // espera entre usos
  let homing = null;

  function setHome() {
    const p = S.p;
    if (p.z !== 0) { toast('Defina a casa na superfície', 'warn'); return; }
    S.home = { x: Math.floor(p.x) + 0.5, y: Math.floor(p.y) + 0.5 };
    toast('Casa definida aqui', 'leaf');
    save();
  }
  const mmss = ms => { const s = Math.ceil(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
  function goHome() {
    if (homing) { homing = null; toast('Volta para casa cancelada'); return; }
    if (S.time < S.homeReadyAt) { toast(`Casa disponível em ${mmss(S.homeReadyAt - S.time)}`, 'warn'); return; }
    homing = { until: S.time + HOME_CHANNEL, x: S.p.x, y: S.p.y, z: S.p.z };
    toast('Voltando para casa… fique parado', '', 3000);
  }
  function homingTick() {
    if (!homing) return;
    const p = S.p;
    if (p.z !== homing.z || Math.hypot(p.x - homing.x, p.y - homing.y) > 0.15) {
      homing = null; toast('Volta para casa cancelada: você se moveu', 'warn'); return;
    }
    if (S.time >= homing.until) {
      homing = null;
      let { x, y } = S.home;
      if (!walkable(tileAt(Math.floor(x), Math.floor(y), 0), 0)) { x = SPAWN.x + 0.5; y = SPAWN.y + 0.5; }
      p.x = x; p.y = y; p.z = 0;
      S.homeReadyAt = S.time + HOME_COOLDOWN;
      for (let k = 0; k < 20; k++) waterTick();   // enche a água em volta da casa
      toast('Em casa', 'leaf');
    }
  }

  // ================= Loja =================
  let trading = null;   // comprador com quem o jogador está negociando
  function sell(item) {
    const n = S.inv[item] || 0, it = ITEMS[item];
    if (!n || !it.valor || !trading || !trading.def.compra.includes(item)) return;
    S.coins += n * it.valor; S.inv[item] = 0; invDirty = true; sfx('moeda');
    toast(`Vendeu ${n} ${it.nome}: +${n * it.valor} moedas`, 'gold');
  }
  function sellAll() {
    if (!trading) return;
    let total = 0;
    for (const k of trading.def.compra) {
      if (k === 'madeira') continue;
      const n = S.inv[k] || 0;
      if (n) { total += n * ITEMS[k].valor; S.inv[k] = 0; }
    }
    if (total) { S.coins += total; invDirty = true; sfx('moeda'); toast(`+${total} moedas`, 'gold'); }
  }
  function buy(id) {
    const it = SHOP.find(s => s.id === id);
    if (!it || S.coins < it.preco) return;
    if (!it.repetir && S.owned[id]) return;
    if (it.req && !S.owned[it.req]) return;
    S.coins -= it.preco;
    if (id === 'sementes') give('sementes', 5);
    else if (id === 'flechas') give('flechas', 20);
    else { S.owned[id] = true; if (id === 'arco') give('flechas', 20); if (DUR[id]) S.dur[id] = DUR[id]; }
    invDirty = true; sfx('moeda');
    toast(`Comprou ${it.nome}`, 'gold');
  }

  // ================= Som e música =================
  // Tudo gerado na hora (Web Audio): não precisa de arquivos de áudio.
  const AUDIO = (() => { try { return JSON.parse(localStorage.getItem('terra-funda-audio')) || { musica: true, sons: true }; } catch (e) { return { musica: true, sons: true }; } })();
  let actx = null, master = null, musicBus = null, sfxBus = null, noiseBuf = null;
  function audioInit() {
    if (actx) { if (actx.state === 'suspended') actx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    actx = new AC();
    master = actx.createGain(); master.gain.value = 0.9; master.connect(actx.destination);
    musicBus = actx.createGain(); musicBus.gain.value = AUDIO.musica ? 0.32 : 0; musicBus.connect(master);
    sfxBus = actx.createGain(); sfxBus.gain.value = AUDIO.sons ? 0.7 : 0; sfxBus.connect(master);
    noiseBuf = actx.createBuffer(1, actx.sampleRate, actx.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    musicStart();
  }
  ['pointerdown', 'keydown', 'touchstart'].forEach(ev => window.addEventListener(ev, audioInit, { passive: true }));
  function saveAudio() {
    try { localStorage.setItem('terra-funda-audio', JSON.stringify(AUDIO)); } catch (e) {}
    if (musicBus) musicBus.gain.setTargetAtTime(AUDIO.musica ? 0.32 : 0, actx.currentTime, 0.3);
    if (sfxBus) sfxBus.gain.setTargetAtTime(AUDIO.sons ? 0.7 : 0, actx.currentTime, 0.05);
  }
  function env(g, t, a, peak, dec) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec); }
  function tone(type, f0, f1, t, a, peak, dec, bus = sfxBus) {
    const o = actx.createOscillator(), g = actx.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t); if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + a + dec);
    env(g, t, a, peak, dec); o.connect(g); g.connect(bus); o.start(t); o.stop(t + a + dec + 0.05);
  }
  function noise(t, dur, peak, type, f0, f1, q = 1) {
    const src = actx.createBufferSource(), f = actx.createBiquadFilter(), g = actx.createGain();
    src.buffer = noiseBuf; src.playbackRate.value = 0.8 + Math.random() * 0.4;
    f.type = type; f.Q.value = q; f.frequency.setValueAtTime(f0, t); if (f1) f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    env(g, t, 0.004, peak, dur); src.connect(f); f.connect(g); g.connect(sfxBus); src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.05);
  }
  const lastSfx = {};
  function sfx(name) {
    if (!actx || !AUDIO.sons) return;
    const t = actx.currentTime, v = 0.9 + Math.random() * 0.2;
    if (lastSfx[name] && t - lastSfx[name] < 0.04) return;
    lastSfx[name] = t;
    switch (name) {
      case 'golpe': noise(t, 0.16, 0.35, 'bandpass', 2400 * v, 700, 2); break;                       // vulto do golpe
      case 'acerto': tone('sine', 160 * v, 60, t, 0.005, 0.6, 0.14); noise(t, 0.08, 0.3, 'lowpass', 1500, 400); break;
      case 'corte': tone('triangle', 210 * v, 120, t, 0.003, 0.55, 0.09); noise(t, 0.12, 0.45, 'bandpass', 1100 * v, 500, 3); break;   // machado na madeira
      case 'arvore': noise(t, 0.6, 0.5, 'lowpass', 900, 150); tone('sine', 90, 45, t + 0.05, 0.02, 0.5, 0.5); break;
      case 'cavar': noise(t, 0.18, 0.55, 'lowpass', 700 * v, 250); noise(t + 0.03, 0.1, 0.25, 'bandpass', 2600, 1800, 2); break;
      case 'pedra': tone('square', 1450 * v, 1100, t, 0.002, 0.12, 0.08); tone('triangle', 2900 * v, 0, t, 0.002, 0.1, 0.12); noise(t, 0.07, 0.35, 'highpass', 2500, 0); break;
      case 'quebra': noise(t, 0.3, 0.55, 'lowpass', 1800, 200); tone('sine', 120, 50, t, 0.005, 0.35, 0.25); break;
      case 'construir': tone('triangle', 330, 200, t, 0.003, 0.4, 0.08); tone('triangle', 330, 200, t + 0.11, 0.003, 0.35, 0.08); break;
      case 'moeda': tone('square', 988, 0, t, 0.002, 0.12, 0.08); tone('square', 1319, 0, t + 0.07, 0.002, 0.12, 0.22); break;
      case 'arco': tone('triangle', 260 * v, 140, t, 0.002, 0.45, 0.18); noise(t + 0.02, 0.2, 0.25, 'bandpass', 3000, 900, 1.5); break;
      case 'magia': [523, 659, 784, 1047].forEach((f, k) => tone('sine', f, f * 1.01, t + k * 0.045, 0.01, 0.18, 0.35)); noise(t, 0.4, 0.12, 'highpass', 5000, 9000); break;
      case 'atordoa': [1047, 1319, 1568].forEach((f, k) => tone('triangle', f, 0, t + k * 0.06, 0.005, 0.15, 0.25)); break;
      case 'toque': noise(t, 0.06, 0.3, 'bandpass', 1800, 900, 2); break;
    }
  }
  // Música: alaúde dedilhado em ré dórico sobre um bordão grave, frases sorteadas a cada compasso
  const SCALE = [0, 2, 3, 5, 7, 9, 10];   // ré dórico
  const BASE = 146.83;                      // ré3
  const CHORDS = [[0, 4], [3, 0], [6, 2], [4, 1], [0, 4], [5, 2], [3, 0], [4, 1]];   // grau do baixo, grau "cor"
  let musicTimer = null, musicT = 0, bar = 0, mel = 7;
  const freq = deg => { const o = Math.floor(deg / 7), n = ((deg % 7) + 7) % 7; return BASE * 2 ** (o + SCALE[n] / 12); };
  function pluck(f, t, vol, dec = 1.4) {
    const o = actx.createOscillator(), o2 = actx.createOscillator(), flt = actx.createBiquadFilter(), g = actx.createGain();
    o.type = 'triangle'; o2.type = 'sawtooth'; o.frequency.value = f; o2.frequency.value = f * 1.003;
    flt.type = 'lowpass'; flt.frequency.setValueAtTime(f * 7, t); flt.frequency.exponentialRampToValueAtTime(f * 1.5, t + dec);
    const g2 = actx.createGain(); g2.gain.value = 0.18;
    env(g, t, 0.004, vol, dec);
    o.connect(flt); o2.connect(g2); g2.connect(flt); flt.connect(g); g.connect(musicBus);
    o.start(t); o2.start(t); o.stop(t + dec + 0.1); o2.stop(t + dec + 0.1);
  }
  function flute(f, t, dur, vol) {
    const o = actx.createOscillator(), lfo = actx.createOscillator(), lg = actx.createGain(), g = actx.createGain();
    o.type = 'sine'; o.frequency.value = f; lfo.frequency.value = 5; lg.gain.value = f * 0.006;
    lfo.connect(lg); lg.connect(o.frequency);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.12); g.gain.setValueAtTime(vol, t + dur - 0.15); g.gain.linearRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(musicBus); o.start(t); lfo.start(t); o.stop(t + dur + 0.05); lfo.stop(t + dur + 0.05);
  }
  function musicBar(t) {
    const beat = 60 / 66, [root, col] = CHORDS[bar % CHORDS.length];
    // baixo e bordão
    pluck(freq(root - 7) , t, 0.22, beat * 3.5);
    pluck(freq(root - 7 + 4), t + beat * 1.5, 0.12, beat * 2);
    // dedilhado
    const arp = [root, root + 2, root + 4, root + 7, root + 4, root + 2];
    arp.forEach((d, k) => pluck(freq(d), t + k * beat * 2 / 3, 0.075 + (k === 0 ? 0.03 : 0), 1.2));
    // melodia de flauta em metade dos compassos, andando por graus vizinhos
    if (bar % 4 >= 2) {
      let tt = t;
      const rhythm = Math.random() < 0.5 ? [1.5, 0.5, 1, 1] : [1, 1, 2];
      for (const r of rhythm) {
        mel += [-2, -1, -1, 0, 1, 1, 2][Math.floor(Math.random() * 7)];
        mel = clamp(mel, 5, 13);
        if (Math.random() < 0.4) mel = col + 7 + (Math.random() < 0.5 ? 0 : 2);
        flute(freq(mel), tt, r * beat * 0.95, 0.07);
        tt += r * beat;
      }
    }
    bar++;
    return beat * 4;
  }
  function musicStart() {
    if (musicTimer) return;
    musicT = actx.currentTime + 0.3;
    musicTimer = setInterval(() => {
      if (!actx || document.hidden) return;
      while (musicT < actx.currentTime + 1.5) musicT += musicBar(musicT);
      if (musicT < actx.currentTime) musicT = actx.currentTime + 0.1;
    }, 400);
  }
  document.addEventListener('visibilitychange', () => { if (!actx) return; if (document.hidden) actx.suspend(); else actx.resume(); });
  (function audioMenu() {   // botões no Menu
    const list = document.querySelector('#sheet-menu .menu-list');
    if (!list) return;
    const row = document.createElement('div'); row.className = 'confirm-row';
    const mk = (key, label) => {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'btn';
      const upd = () => { b.textContent = `${label}: ${AUDIO[key] ? 'ligada' : 'desligada'}`.replace('Sons: ligada', 'Sons: ligados').replace('Sons: desligada', 'Sons: desligados'); b.setAttribute('aria-pressed', String(AUDIO[key])); };
      b.addEventListener('click', () => { AUDIO[key] = !AUDIO[key]; audioInit(); saveAudio(); upd(); });
      upd(); return b;
    };
    row.append(mk('musica', 'Música'), mk('sons', 'Sons'));
    const help = document.getElementById('btn-help');
    list.insertBefore(row, help);
  })();

  // ================= Sprites =================
  const SPR = {};
  function sprite(painter, seed) {
    const cv = document.createElement('canvas');
    cv.width = cv.height = 16;
    const c = cv.getContext('2d');
    painter(c, mulberry32(seed));
    return cv;
  }
  const px = (c, x, y, w, h, col) => { c.fillStyle = col; c.fillRect(x, y, w, h); };
  function speckle(c, r, n, cols) {
    for (let k = 0; k < n; k++) px(c, Math.floor(r() * 16), Math.floor(r() * 16), 1, 1, cols[Math.floor(r() * cols.length)]);
  }
  const P = {
    grass(c, r) {
      px(c, 0, 0, 16, 16, '#5a9a3c');
      speckle(c, r, 34, ['#6bb04a', '#4a8532', '#529240']);
      for (let k = 0; k < 4; k++) { const x = Math.floor(r() * 15), y = Math.floor(r() * 14); px(c, x, y, 1, 2, '#7cc35a'); }
    },
    tilled(c, r) {
      px(c, 0, 0, 16, 16, '#7a5232');
      speckle(c, r, 20, ['#8a6040', '#6d4829']);
      for (const y of [3, 7, 11, 15]) px(c, 0, y, 16, 1, '#5b3b22');
    },
    vala(c, r) {
      px(c, 0, 0, 16, 16, '#5a3f28');
      px(c, 1, 1, 14, 14, '#45301e');
      speckle(c, r, 14, ['#523a24', '#3b2919']);
    },
    tree(c, r) {
      P.grass(c, r);
      px(c, 3, 13, 11, 2, 'rgba(0,0,0,0.25)');
      px(c, 7, 10, 3, 5, '#6b4426');
      px(c, 3, 2, 11, 9, '#2f6b2a'); px(c, 2, 4, 13, 5, '#2f6b2a'); px(c, 4, 1, 9, 11, '#2f6b2a');
      for (let k = 0; k < 10; k++) px(c, 4 + Math.floor(r() * 8), 2 + Math.floor(r() * 6), 2, 1, '#3f8a36');
      px(c, 4, 10, 9, 1, '#24541f');
    },
    rock(c, r) {
      P.grass(c, r);
      px(c, 3, 12, 11, 2, 'rgba(0,0,0,0.28)');
      px(c, 4, 5, 9, 8, '#7d8087'); px(c, 3, 7, 11, 5, '#7d8087'); px(c, 5, 4, 7, 9, '#7d8087');
      px(c, 5, 5, 4, 2, '#a1a4aa'); px(c, 4, 11, 9, 1, '#5d5f64');
    },
    source(c, r) {
      px(c, 0, 0, 16, 16, '#45301e');
      px(c, 2, 2, 12, 12, '#8d9096'); px(c, 1, 4, 14, 8, '#8d9096');
      px(c, 4, 4, 8, 8, '#2f7fd0'); px(c, 3, 5, 10, 6, '#2f7fd0');
      px(c, 5, 5, 3, 1, '#9fd6ff');
    },
    hole(c, r) {
      px(c, 0, 0, 16, 16, '#5a3f28');
      px(c, 2, 2, 12, 12, '#160f0a');
      px(c, 5, 2, 1, 13, '#a4703f'); px(c, 10, 2, 1, 13, '#a4703f');
      for (const y of [4, 7, 10, 13]) px(c, 5, y, 6, 1, '#c08850');
    },
    wall(c, r) {
      px(c, 0, 0, 16, 16, '#8a5a32');
      for (const y of [3, 7, 11, 15]) px(c, 0, y, 16, 1, '#5e3b1f');
      px(c, 5, 0, 1, 3, '#5e3b1f'); px(c, 11, 4, 1, 3, '#5e3b1f'); px(c, 3, 8, 1, 3, '#5e3b1f'); px(c, 9, 12, 1, 3, '#5e3b1f');
      px(c, 0, 0, 16, 1, '#b07a48');
      speckle(c, r, 10, ['#9a6a3e', '#7a4f2b']);
    },
    floor(c, r) {
      px(c, 0, 0, 16, 16, '#3b2d23');
      speckle(c, r, 26, ['#46362a', '#30241c', '#4f3d2f']);
    },
    dirt(c, r) {
      px(c, 0, 0, 16, 16, '#6e4c33');
      speckle(c, r, 30, ['#7d5a3e', '#5f4029', '#86624a']);
    },
    stone(c, r) {
      px(c, 0, 0, 16, 16, '#686a70');
      speckle(c, r, 34, ['#76787e', '#5a5c61', '#808389']);
      for (let k = 0; k < 2; k++) { const x = Math.floor(r() * 12), y = Math.floor(r() * 14); px(c, x, y, 4, 1, '#55575c'); }
    },
  };
  function ore(col, hi, n) {
    return (c, r) => {
      P.stone(c, r);
      for (let k = 0; k < n; k++) {
        const x = 1 + Math.floor(r() * 12), y = 1 + Math.floor(r() * 12);
        px(c, x, y, 3, 2, col); px(c, x + 1, y + 2, 2, 1, col); px(c, x, y, 1, 1, hi);
      }
    };
  }
  function oil(c, r) {
    P.stone(c, r);
    px(c, 3, 5, 10, 7, '#16121c'); px(c, 4, 4, 8, 9, '#16121c'); px(c, 2, 7, 12, 3, '#16121c');
    px(c, 5, 5, 3, 1, '#7a58a0'); px(c, 5, 6, 1, 1, '#7a58a0');
  }

  // Chão, árvores e pedras de cada bioma: [cor base, pintas, folhas de grama]
  const GROUND = {
    campos: ['#5a9a3c', ['#6bb04a', '#4a8532', '#529240'], '#7cc35a'],
    floresta: ['#3e7d31', ['#4a8f3a', '#346c29', '#397630'], '#58a043'],
    pantano: ['#4d6e3a', ['#5a7a44', '#3f5e30', '#5b7d5e'], '#6a8a4a'],
    deserto: ['#d8bf86', ['#cbb077', '#e4cf9c', '#c2a46a'], null],
    montanhas: ['#76875e', ['#86966e', '#667652', '#8d9096'], '#90a076'],
    neve: ['#e6ecf0', ['#d4dde5', '#ffffff', '#dbe3ea'], null],
  };
  const groundPainter = id => (c, r) => {
    const [base, sp, blade] = GROUND[id];
    px(c, 0, 0, 16, 16, base);
    speckle(c, r, 34, sp);
    if (blade) for (let k = 0; k < 4; k++) { const x = Math.floor(r() * 15), y = Math.floor(r() * 14); px(c, x, y, 1, 2, blade); }
  };
  const treePainter = id => (c, r) => {
    groundPainter(id)(c, r);
    px(c, 3, 13, 11, 2, 'rgba(0,0,0,0.25)');
    if (id === 'deserto') {          // cacto
      px(c, 7, 3, 3, 12, '#4f8a3a'); px(c, 3, 6, 2, 5, '#4f8a3a'); px(c, 4, 10, 3, 2, '#4f8a3a');
      px(c, 12, 4, 2, 5, '#4f8a3a'); px(c, 10, 8, 2, 2, '#4f8a3a'); px(c, 8, 3, 1, 11, '#6aa84e');
    } else if (id === 'montanhas' || id === 'neve') {   // pinheiro
      px(c, 7, 12, 2, 3, '#5e3b1f');
      const g = '#2d5a36', hi = id === 'neve' ? '#ffffff' : '#3d7448';
      px(c, 7, 1, 2, 2, g); px(c, 6, 3, 4, 2, g); px(c, 5, 5, 6, 2, g); px(c, 4, 7, 8, 2, g); px(c, 3, 9, 10, 3, g);
      px(c, 7, 1, 1, 1, hi); px(c, 6, 3, 2, 1, hi); px(c, 5, 5, 2, 1, hi); px(c, 4, 7, 3, 1, hi); px(c, 3, 9, 3, 1, hi);
    } else {
      const leaf = id === 'floresta' ? '#245a22' : id === 'pantano' ? '#4a6a2a' : '#2f6b2a';
      const hi = id === 'floresta' ? '#2f7a2c' : id === 'pantano' ? '#5f8238' : '#3f8a36';
      px(c, 7, 10, 3, 5, '#6b4426');
      px(c, 3, 2, 11, 9, leaf); px(c, 2, 4, 13, 5, leaf); px(c, 4, 1, 9, 11, leaf);
      for (let k = 0; k < 10; k++) px(c, 4 + Math.floor(r() * 8), 2 + Math.floor(r() * 6), 2, 1, hi);
      if (id === 'pantano') for (const x of [3, 6, 10, 13]) px(c, x, 9, 1, 4, leaf);   // galhos caídos do salgueiro
      px(c, 4, 10, 9, 1, 'rgba(0,0,0,0.25)');
    }
  };
  const rockPainter = id => (c, r) => {
    groundPainter(id)(c, r);
    const rk = id === 'deserto' ? '#a88a5e' : '#7d8087', lt = id === 'deserto' ? '#c4a676' : id === 'neve' ? '#ffffff' : '#a1a4aa';
    px(c, 3, 12, 11, 2, 'rgba(0,0,0,0.28)');
    px(c, 4, 5, 9, 8, rk); px(c, 3, 7, 11, 5, rk); px(c, 5, 4, 7, 9, rk);
    px(c, 5, 5, 4, 2, lt); px(c, 4, 11, 9, 1, 'rgba(0,0,0,0.25)');
  };

  function buildSprites() {
    const make = (key, painter) => { SPR[key] = [0, 1, 2, 3].map(v => sprite(painter, 101 + v * 977 + key.length * 13)); };
    for (const b of BIOMES) {
      make('grass_' + b.id, groundPainter(b.id)); make('tree_' + b.id, treePainter(b.id)); make('rock_' + b.id, rockPainter(b.id));
    }
    make('grass', P.grass); make('tilled', P.tilled); make('vala', P.vala); make('tree', P.tree);
    make('rock', P.rock); make('source', P.source); make('hole', P.hole); make('wall', P.wall);
    make('floor', P.floor); make('dirt', P.dirt); make('stone', P.stone);
    make('coal', ore('#1b1b1b', '#4a4a4a', 5)); make('bronze', ore('#c47a3c', '#f0a868', 4));
    make('iron', ore('#c9a68a', '#ecd2bf', 4)); make('silver', ore('#d8dde3', '#ffffff', 4));
    make('gold', ore('#f2c84b', '#fff0a8', 4)); make('oil', oil); make('diamond', ore('#5fd6e6', '#e2fdff', 3));
  }
  const SPR_KEY = {
    [T.AIR]: 'floor', [T.SAPLING]: 'tree', [T.GRASS]: 'grass', [T.TILLED]: 'tilled', [T.CROP]: 'tilled', [T.VALA]: 'vala', [T.TREE]: 'tree',
    [T.SOURCE]: 'source', [T.HOLE]: 'hole', [T.WALL]: 'wall', [T.GATE]: 'wall', [T.ROCK]: 'rock', [T.DIRT]: 'dirt', [T.STONE]: 'stone',
    [T.COAL]: 'coal', [T.BRONZE]: 'bronze', [T.IRON]: 'iron', [T.SILVER]: 'silver', [T.GOLD]: 'gold', [T.OIL]: 'oil', [T.DIAMOND]: 'diamond',
  };
  const isSolidUnder = t => (t >= T.DIRT && t <= T.DIAMOND) || t === T.WALL;

  // ================= Ícones da barra =================
  function line(c, x0, y0, x1, y1, col) {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
    for (let k = 0; k <= n; k++) {
      const x = Math.round(x0 + (x1 - x0) * k / n), y = Math.round(y0 + (y1 - y0) * k / n);
      px(c, x, y, 2, 2, col);
    }
  }
  const PICK_COLORS = ['#b08a5a', '#c47a3c', '#c9ccd2', '#67e3f0'];
  function drawIcon(c, id) {
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, 48, 48);
    if (drawArtFit(c, 'icon_' + id, 48)) return;
    c.imageSmoothingEnabled = false;
    c.setTransform(3, 0, 0, 3, 0, 0);
    if (id === 'picareta') {
      line(c, 3, 12, 10, 5, '#8a5a32');
      const col = PICK_COLORS[pickTier()];
      px(c, 4, 4, 2, 2, col); px(c, 5, 3, 3, 2, col); px(c, 8, 2, 3, 2, col); px(c, 11, 3, 2, 2, col); px(c, 12, 5, 2, 3, col);
    } else if (id === 'machado') {
      line(c, 4, 13, 10, 4, '#8a5a32');
      px(c, 9, 2, 4, 6, '#9aa0a8'); px(c, 12, 3, 2, 4, '#c9ccd2');
    } else if (id === 'enxada') {
      line(c, 3, 13, 10, 4, '#8a5a32');
      px(c, 9, 2, 6, 2, '#9aa0a8'); px(c, 13, 4, 2, 3, '#9aa0a8');
    } else if (id === 'espada') {
      line(c, 5, 10, 12, 3, '#d8dde3'); px(c, 13, 2, 1, 1, '#ffffff');
      line(c, 3, 8, 7, 12, '#c9a64a'); px(c, 2, 12, 3, 3, '#6b4426');
    } else if (id === 'maos') {   // mão aberta
      const sk = '#e2b48c', ln = '#7a4a2e';
      px(c, 5, 7, 7, 7, sk); px(c, 4, 9, 1, 3, sk);
      for (const [x, h] of [[5, 5], [7, 6], [9, 6], [11, 5]]) px(c, x, 7 - h + 2, 1.6, h, sk);
      px(c, 2, 8, 3, 2, sk);
      px(c, 5, 14, 7, 1, ln); px(c, 12, 7, 1, 7, ln);
    } else if (id === 'rede') {
      line(c, 3, 13, 7, 9, '#8a5a32');
      c.strokeStyle = '#e8dcc0'; c.lineWidth = 1;
      c.beginPath(); c.arc(10.5, 5.5, 4.5, 0, Math.PI * 2); c.stroke();
      for (const k of [8, 10, 12]) { px(c, k, 2, 1, 8, 'rgba(232,220,192,0.7)'); px(c, 7, k - 4, 8, 1, 'rgba(232,220,192,0.7)'); }
    } else if (id === 'arco') {
      c.strokeStyle = '#8a5a32'; c.lineWidth = 1.6;
      c.beginPath(); c.arc(4, 12, 9, -Math.PI / 2, 0); c.stroke();
      c.strokeStyle = '#efe6cc'; c.lineWidth = 0.6;
      c.beginPath(); c.moveTo(4, 3); c.lineTo(13, 12); c.stroke();
      line(c, 3, 13, 11, 5, '#c9a46a'); px(c, 11, 3, 2, 2, '#d8dde3');
    } else if (id === 'cetro') {
      line(c, 3, 14, 10, 7, '#5e3b7a');
      px(c, 9, 6, 3, 1, '#c9a64a');
      px(c, 10, 2, 4, 4, '#8f6cff'); px(c, 11, 3, 2, 2, '#ffffff');
    } else if (id === 'muro') {
      px(c, 2, 3, 12, 10, '#8a5a32');
      px(c, 2, 6, 12, 1, '#5e3b1f'); px(c, 2, 9, 12, 1, '#5e3b1f');
      px(c, 6, 3, 1, 3, '#5e3b1f'); px(c, 10, 7, 1, 2, '#5e3b1f'); px(c, 5, 10, 1, 3, '#5e3b1f');
      px(c, 2, 3, 12, 1, '#b07a48');
    }
  }

  // ================= Arte (sprite sheets) =================
  // Atlas gerado por tools/build_atlas.py a partir das folhas de sprites. Se a imagem não carregar,
  // o jogo continua com os desenhos feitos por código.
  const ATLAS = /*ATLAS_MAP*/{"water_tex":[0,0,256,256],"sk_exploradora_swing_front":[258,0,81,119],"sk_carrasco_swing_front":[341,0,82,118],"sk_carrasco_swing_up":[425,0,78,118],"sk_exploradora_swing_up":[505,0,78,118],"sk_guarda_azul_swing_front":[585,0,76,111],"sk_guarda_azul_swing_up":[663,0,74,111],"sk_mecanico_vermelho_swing_front":[739,0,74,111],"sk_mecanico_vermelho_swing_up":[815,0,73,111],"sk_sombra_tatica_swing_front":[890,0,75,111],"sk_sombra_tatica_swing_up":[0,258,74,111],"sk_cowboy_caveira_swing_front":[76,258,73,110],"sk_cowboy_caveira_swing_up":[151,258,72,110],"sk_guardiao_cristal_swing_front":[225,258,71,110],"sk_guardiao_cristal_swing_up":[298,258,70,110],"sk_princesa_swing_front":[370,258,73,110],"sk_princesa_swing_up":[445,258,71,110],"sk_rei_dourado_swing_front":[518,258,73,110],"sk_rei_dourado_swing_up":[593,258,72,110],"sk_rei_mascarado_swing_front":[667,258,73,110],"sk_rei_mascarado_swing_up":[742,258,72,110],"sk_samurai_swing_front":[816,258,72,110],"sk_samurai_swing_up":[890,258,70,110],"cetro_mao":[0,371,107,110],"cetro_brilho":[109,371,105,110],"sk_cacadora_swing_front":[216,371,72,109],"sk_cacadora_swing_up":[290,371,70,109],"sk_cacique_swing_front":[362,371,73,109],"sk_ceifador_swing_front":[437,371,75,109],"sk_ceifador_swing_up":[514,371,72,109],"sk_espectro_swing_front":[588,371,75,109],"sk_espectro_swing_up":[665,371,71,109],"sk_pirata_swing_up":[738,371,71,109],"sk_arqueira_mata_swing_front":[811,371,75,108],"sk_arqueira_mata_swing_up":[888,371,71,108],"sk_cacique_swing_up":[0,483,71,108],"sk_ciberpiloto_swing_front":[73,483,73,108],"sk_ciberpiloto_swing_up":[148,483,70,108],"sk_pirata_swing_front":[220,483,73,108],"sk_pistoleira_swing_front":[295,483,74,108],"sk_pistoleira_swing_up":[371,483,71,108],"sk_arqueiro_mata_swing_front":[444,483,73,107],"sk_arqueiro_mata_swing_up":[519,483,71,107],"sk_guerreiro_tribal_swing_front":[592,483,73,107],"sk_guerreiro_tribal_swing_up":[667,483,71,107],"sk_policial_swing_front":[740,483,72,107],"sk_policial_swing_up":[814,483,70,107],"sk_saqueador_swing_up":[886,483,70,107],"robo_dig_0":[0,593,111,106],"robo_dig_1":[113,593,113,106],"robo_dig_2":[228,593,85,106],"sk_saqueador_swing_front":[315,593,72,105],"tree_floresta":[389,593,79,104],"tree_deserto":[470,593,59,104],"tree_neve":[531,593,75,104],"menino_front_idle":[608,593,49,104],"menino_front_walk_0":[659,593,49,104],"menino_front_walk_1":[710,593,50,104],"menino_front_walk_2":[762,593,49,104],"menino_front_walk_3":[813,593,51,104],"menino_back_idle":[866,593,47,104],"menino_back_walk_0":[915,593,47,104],"menino_back_walk_1":[964,593,47,104],"menino_back_walk_2":[0,701,47,104],"menino_back_walk_3":[49,701,48,104],"menino_side_idle":[99,701,43,104],"menino_side_walk_0":[144,701,43,104],"menino_side_walk_1":[189,701,43,104],"menino_side_walk_2":[234,701,43,104],"menino_side_walk_3":[279,701,45,104],"menino_side_walk_4":[326,701,45,104],"menino_side_walk_5":[373,701,45,104],"menino_side_walk_6":[420,701,45,104],"menino_side_walk_7":[467,701,43,104],"menino_swing_front":[512,701,59,104],"menino_swing_up":[573,701,59,104],"menino_swing_side":[634,701,42,104],"menino_negro_front_idle":[678,701,50,104],"menino_negro_front_walk_0":[730,701,50,104],"menino_negro_front_walk_1":[782,701,51,104],"menino_negro_front_walk_2":[835,701,50,104],"menino_negro_front_walk_3":[887,701,51,104],"menino_negro_swing_side":[940,701,49,104],"menina_ruiva_front_idle":[0,807,50,104],"menina_ruiva_front_walk_0":[52,807,50,104],"menina_ruiva_front_walk_1":[104,807,51,104],"menina_ruiva_front_walk_2":[157,807,50,104],"menina_ruiva_front_walk_3":[209,807,52,104],"menina_ruiva_side_idle":[263,807,65,104],"menina_ruiva_side_walk_0":[330,807,65,104],"menina_ruiva_side_walk_1":[397,807,65,104],"menina_ruiva_side_walk_2":[464,807,65,104],"menina_ruiva_side_walk_3":[531,807,67,104],"menina_ruiva_side_walk_4":[600,807,67,104],"menina_ruiva_side_walk_5":[669,807,67,104],"menina_ruiva_side_walk_6":[738,807,67,104],"menina_ruiva_side_walk_7":[807,807,65,104],"menina_ruiva_swing_side":[874,807,58,104],"menina_negra_front_idle":[934,807,60,104],"menina_negra_front_walk_0":[0,913,60,104],"menina_negra_front_walk_1":[62,913,60,104],"menina_negra_front_walk_2":[124,913,60,104],"menina_negra_front_walk_3":[186,913,60,104],"menina_negra_swing_front":[248,913,60,104],"menina_negra_swing_up":[310,913,59,104],"menina_negra_swing_side":[371,913,48,104],"sk_arqueira_mata_front_idle":[421,913,52,104],"sk_arqueira_mata_front_walk_0":[475,913,52,104],"sk_arqueira_mata_front_walk_1":[529,913,52,104],"sk_arqueira_mata_front_walk_2":[583,913,52,104],"sk_arqueira_mata_front_walk_3":[637,913,52,104],"sk_arqueiro_mata_front_idle":[691,913,50,104],"sk_arqueiro_mata_front_walk_0":[743,913,50,104],"sk_arqueiro_mata_front_walk_1":[795,913,51,104],"sk_arqueiro_mata_front_walk_2":[848,913,50,104],"sk_arqueiro_mata_front_walk_3":[900,913,52,104],"sk_cacadora_front_idle":[954,913,52,104],"sk_cacadora_front_walk_0":[0,1019,52,104],"sk_cacadora_front_walk_1":[54,1019,51,104],"sk_cacadora_front_walk_2":[107,1019,52,104],"sk_cacadora_front_walk_3":[161,1019,52,104],"sk_cacique_front_idle":[215,1019,50,104],"sk_cacique_front_walk_0":[267,1019,50,104],"sk_cacique_front_walk_1":[319,1019,51,104],"sk_cacique_front_walk_2":[372,1019,50,104],"sk_cacique_front_walk_3":[424,1019,52,104],"sk_carrasco_front_idle":[478,1019,66,104],"sk_carrasco_front_walk_0":[546,1019,66,104],"sk_carrasco_front_walk_1":[614,1019,66,104],"sk_carrasco_front_walk_2":[682,1019,66,104],"sk_carrasco_front_walk_3":[750,1019,67,104],"sk_carrasco_back_idle":[819,1019,66,104],"sk_carrasco_back_walk_0":[887,1019,66,104],"sk_carrasco_back_walk_1":[955,1019,63,104],"sk_carrasco_back_walk_2":[0,1125,66,104],"sk_carrasco_back_walk_3":[68,1125,63,104],"sk_carrasco_side_idle":[133,1125,68,104],"sk_carrasco_side_walk_0":[203,1125,68,104],"sk_carrasco_side_walk_1":[273,1125,68,104],"sk_carrasco_side_walk_2":[343,1125,68,104],"sk_carrasco_side_walk_3":[413,1125,46,104],"sk_carrasco_side_walk_4":[461,1125,46,104],"sk_carrasco_side_walk_5":[509,1125,46,104],"sk_carrasco_side_walk_6":[557,1125,46,104],"sk_carrasco_side_walk_7":[605,1125,68,104],"sk_carrasco_swing_side":[675,1125,55,104],"sk_ceifador_front_idle":[732,1125,59,104],"sk_ceifador_front_walk_0":[793,1125,59,104],"sk_ceifador_front_walk_1":[854,1125,59,104],"sk_ceifador_front_walk_2":[915,1125,59,104],"sk_ceifador_front_walk_3":[0,1231,60,104],"sk_ciberpiloto_front_idle":[62,1231,60,104],"sk_ciberpiloto_front_walk_0":[124,1231,60,104],"sk_ciberpiloto_front_walk_1":[186,1231,60,104],"sk_ciberpiloto_front_walk_2":[248,1231,60,104],"sk_ciberpiloto_front_walk_3":[310,1231,61,104],"sk_cowboy_caveira_front_idle":[373,1231,53,104],"sk_cowboy_caveira_front_walk_0":[428,1231,53,104],"sk_cowboy_caveira_front_walk_1":[483,1231,53,104],"sk_cowboy_caveira_front_walk_2":[538,1231,53,104],"sk_cowboy_caveira_front_walk_3":[593,1231,53,104],"sk_espectro_front_idle":[648,1231,80,104],"sk_espectro_front_walk_0":[730,1231,80,104],"sk_espectro_front_walk_1":[812,1231,70,104],"sk_espectro_front_walk_2":[884,1231,80,104],"sk_espectro_front_walk_3":[0,1337,70,104],"sk_exploradora_front_idle":[72,1337,56,104],"sk_exploradora_front_walk_0":[130,1337,56,104],"sk_exploradora_front_walk_2":[188,1337,56,104],"sk_exploradora_back_idle":[246,1337,56,104],"sk_exploradora_back_walk_0":[304,1337,56,104],"sk_exploradora_back_walk_1":[362,1337,56,104],"sk_exploradora_back_walk_2":[420,1337,56,104],"sk_exploradora_back_walk_3":[478,1337,57,104],"sk_guarda_azul_front_idle":[537,1337,53,104],"sk_guarda_azul_front_walk_0":[592,1337,53,104],"sk_guarda_azul_front_walk_1":[647,1337,53,104],"sk_guarda_azul_front_walk_2":[702,1337,53,104],"sk_guarda_azul_front_walk_3":[757,1337,53,104],"sk_guardiao_cristal_front_idle":[812,1337,53,104],"sk_guardiao_cristal_front_walk_0":[867,1337,53,104],"sk_guardiao_cristal_front_walk_1":[922,1337,52,104],"sk_guardiao_cristal_front_walk_2":[0,1443,53,104],"sk_guardiao_cristal_front_walk_3":[55,1443,53,104],"sk_guerreiro_tribal_front_idle":[110,1443,50,104],"sk_guerreiro_tribal_front_walk_0":[162,1443,50,104],"sk_guerreiro_tribal_front_walk_1":[214,1443,50,104],"sk_guerreiro_tribal_front_walk_2":[266,1443,50,104],"sk_guerreiro_tribal_front_walk_3":[318,1443,51,104],"sk_mecanico_vermelho_front_idle":[371,1443,52,104],"sk_mecanico_vermelho_front_walk_0":[425,1443,52,104],"sk_mecanico_vermelho_front_walk_1":[479,1443,52,104],"sk_mecanico_vermelho_front_walk_2":[533,1443,52,104],"sk_mecanico_vermelho_front_walk_3":[587,1443,54,104],"sk_pirata_front_idle":[643,1443,58,104],"sk_pirata_front_walk_0":[703,1443,58,104],"sk_pirata_front_walk_1":[763,1443,56,104],"sk_pirata_front_walk_2":[821,1443,58,104],"sk_pirata_front_walk_3":[881,1443,57,104],"sk_pistoleira_front_idle":[940,1443,63,104],"sk_pistoleira_front_walk_0":[0,1549,63,104],"sk_pistoleira_front_walk_1":[65,1549,62,104],"sk_pistoleira_front_walk_2":[129,1549,63,104],"sk_pistoleira_front_walk_3":[194,1549,63,104],"sk_policial_front_idle":[259,1549,58,104],"sk_policial_front_walk_0":[319,1549,58,104],"sk_policial_front_walk_1":[379,1549,59,104],"sk_policial_front_walk_2":[440,1549,58,104],"sk_policial_front_walk_3":[500,1549,60,104],"sk_princesa_front_idle":[562,1549,59,104],"sk_princesa_front_walk_0":[623,1549,59,104],"sk_princesa_front_walk_1":[684,1549,58,104],"sk_princesa_front_walk_2":[744,1549,59,104],"sk_princesa_front_walk_3":[805,1549,59,104],"sk_rei_dourado_front_idle":[866,1549,61,104],"sk_rei_dourado_front_walk_0":[929,1549,61,104],"sk_rei_dourado_front_walk_1":[0,1655,62,104],"sk_rei_dourado_front_walk_2":[64,1655,61,104],"sk_rei_dourado_front_walk_3":[127,1655,62,104],"sk_rei_mascarado_front_idle":[191,1655,59,104],"sk_rei_mascarado_front_walk_0":[252,1655,59,104],"sk_rei_mascarado_front_walk_1":[313,1655,60,104],"sk_rei_mascarado_front_walk_2":[375,1655,59,104],"sk_rei_mascarado_front_walk_3":[436,1655,60,104],"sk_samurai_front_idle":[498,1655,47,104],"sk_samurai_front_walk_0":[547,1655,47,104],"sk_samurai_front_walk_1":[596,1655,48,104],"sk_samurai_front_walk_2":[646,1655,47,104],"sk_samurai_front_walk_3":[695,1655,49,104],"sk_saqueador_front_idle":[746,1655,61,104],"sk_saqueador_front_walk_0":[809,1655,61,104],"sk_saqueador_front_walk_1":[872,1655,61,104],"sk_saqueador_front_walk_2":[935,1655,61,104],"sk_saqueador_front_walk_3":[0,1761,62,104],"sk_sombra_tatica_front_idle":[64,1761,52,104],"sk_sombra_tatica_front_walk_0":[118,1761,52,104],"sk_sombra_tatica_front_walk_1":[172,1761,52,104],"sk_sombra_tatica_front_walk_2":[226,1761,52,104],"sk_sombra_tatica_front_walk_3":[280,1761,53,104],"tiao_0":[335,1761,75,104],"tiao_1":[412,1761,75,104],"ana_0":[489,1761,69,104],"ana_1":[560,1761,71,104],"lia_0":[633,1761,70,104],"lia_1":[705,1761,71,104],"lia_back":[778,1761,62,104],"menino_negro_back_idle":[842,1761,49,103],"menino_negro_back_walk_0":[893,1761,49,103],"menino_negro_back_walk_1":[944,1761,49,103],"menino_negro_back_walk_2":[0,1867,49,103],"menino_negro_back_walk_3":[51,1867,50,103],"menino_negro_side_idle":[103,1867,46,103],"menino_negro_side_walk_0":[151,1867,46,103],"menino_negro_side_walk_1":[199,1867,46,103],"menino_negro_side_walk_2":[247,1867,46,103],"menino_negro_side_walk_3":[295,1867,51,103],"menino_negro_side_walk_4":[348,1867,51,103],"menino_negro_side_walk_5":[401,1867,51,103],"menino_negro_side_walk_6":[454,1867,51,103],"menino_negro_side_walk_7":[507,1867,46,103],"menina_ruiva_back_idle":[555,1867,46,103],"menina_ruiva_back_walk_0":[603,1867,46,103],"menina_ruiva_back_walk_1":[651,1867,47,103],"menina_ruiva_back_walk_2":[700,1867,46,103],"menina_ruiva_back_walk_3":[748,1867,48,103],"menina_negra_back_idle":[798,1867,59,103],"menina_negra_back_walk_0":[859,1867,59,103],"menina_negra_back_walk_1":[920,1867,60,103],"menina_negra_back_walk_2":[0,1972,59,103],"menina_negra_back_walk_3":[61,1972,60,103],"sk_exploradora_front_walk_1":[123,1972,56,103],"sk_exploradora_front_walk_3":[181,1972,56,103],"sk_exploradora_side_idle":[239,1972,44,103],"sk_exploradora_side_walk_0":[285,1972,44,103],"sk_exploradora_side_walk_1":[331,1972,44,103],"sk_exploradora_side_walk_2":[377,1972,44,103],"sk_exploradora_side_walk_3":[423,1972,44,103],"sk_exploradora_side_walk_4":[469,1972,44,103],"sk_exploradora_side_walk_5":[515,1972,44,103],"sk_exploradora_side_walk_6":[561,1972,44,103],"sk_exploradora_side_walk_7":[607,1972,44,103],"sk_exploradora_swing_side":[653,1972,44,103],"sk_guarda_azul_back_idle":[699,1972,53,103],"sk_guarda_azul_back_walk_0":[754,1972,53,103],"sk_guarda_azul_back_walk_1":[809,1972,53,103],"sk_guarda_azul_back_walk_2":[864,1972,53,103],"sk_guarda_azul_back_walk_3":[919,1972,53,103],"sk_pistoleira_back_idle":[0,2077,69,103],"sk_pistoleira_back_walk_0":[71,2077,69,103],"sk_pistoleira_back_walk_2":[142,2077,69,103],"sk_rei_mascarado_back_idle":[213,2077,48,103],"sk_rei_mascarado_back_walk_0":[263,2077,48,103],"sk_rei_mascarado_back_walk_2":[313,2077,48,103],"menino_negro_swing_front":[363,2077,59,102],"menino_negro_swing_up":[424,2077,58,102],"menina_ruiva_swing_front":[484,2077,59,102],"menina_ruiva_swing_up":[545,2077,59,102],"menina_negra_side_idle":[606,2077,51,102],"menina_negra_side_walk_0":[659,2077,51,102],"menina_negra_side_walk_1":[712,2077,51,102],"menina_negra_side_walk_2":[765,2077,51,102],"menina_negra_side_walk_3":[818,2077,54,102],"menina_negra_side_walk_4":[874,2077,54,102],"menina_negra_side_walk_5":[930,2077,54,102],"menina_negra_side_walk_6":[0,2182,54,102],"menina_negra_side_walk_7":[56,2182,51,102],"sk_ceifador_back_idle":[109,2182,48,102],"sk_ceifador_back_walk_0":[159,2182,48,102],"sk_ceifador_back_walk_1":[209,2182,49,102],"sk_ceifador_back_walk_2":[260,2182,48,102],"sk_ceifador_back_walk_3":[310,2182,50,102],"sk_cowboy_caveira_back_idle":[362,2182,48,102],"sk_cowboy_caveira_back_walk_0":[412,2182,48,102],"sk_cowboy_caveira_back_walk_1":[462,2182,48,102],"sk_cowboy_caveira_back_walk_2":[512,2182,48,102],"sk_cowboy_caveira_back_walk_3":[562,2182,49,102],"sk_espectro_back_idle":[613,2182,73,102],"sk_espectro_back_walk_0":[688,2182,73,102],"sk_espectro_back_walk_1":[763,2182,74,102],"sk_espectro_back_walk_2":[839,2182,73,102],"sk_espectro_back_walk_3":[914,2182,74,102],"sk_guarda_azul_side_idle":[0,2286,42,102],"sk_guarda_azul_side_walk_0":[44,2286,42,102],"sk_guarda_azul_side_walk_1":[88,2286,42,102],"sk_guarda_azul_side_walk_2":[132,2286,42,102],"sk_guarda_azul_side_walk_3":[176,2286,38,102],"sk_guarda_azul_side_walk_4":[216,2286,38,102],"sk_guarda_azul_side_walk_5":[256,2286,38,102],"sk_guarda_azul_side_walk_6":[296,2286,38,102],"sk_guarda_azul_side_walk_7":[336,2286,42,102],"sk_guarda_azul_swing_side":[380,2286,39,102],"sk_guardiao_cristal_back_idle":[421,2286,50,102],"sk_guardiao_cristal_back_walk_0":[473,2286,50,102],"sk_guardiao_cristal_back_walk_1":[525,2286,51,102],"sk_guardiao_cristal_back_walk_2":[578,2286,50,102],"sk_guardiao_cristal_back_walk_3":[630,2286,52,102],"sk_mecanico_vermelho_back_idle":[684,2286,52,102],"sk_mecanico_vermelho_back_walk_0":[738,2286,52,102],"sk_mecanico_vermelho_back_walk_1":[792,2286,52,102],"sk_mecanico_vermelho_back_walk_2":[846,2286,52,102],"sk_mecanico_vermelho_back_walk_3":[900,2286,52,102],"sk_mecanico_vermelho_side_idle":[954,2286,42,102],"sk_mecanico_vermelho_side_walk_0":[0,2390,42,102],"sk_mecanico_vermelho_side_walk_1":[44,2390,42,102],"sk_mecanico_vermelho_side_walk_2":[88,2390,42,102],"sk_mecanico_vermelho_side_walk_3":[132,2390,38,102],"sk_mecanico_vermelho_side_walk_4":[172,2390,38,102],"sk_mecanico_vermelho_side_walk_5":[212,2390,38,102],"sk_mecanico_vermelho_side_walk_6":[252,2390,38,102],"sk_mecanico_vermelho_side_walk_7":[292,2390,42,102],"sk_mecanico_vermelho_swing_side":[336,2390,39,102],"sk_pistoleira_back_walk_1":[377,2390,70,102],"sk_pistoleira_back_walk_3":[449,2390,70,102],"sk_pistoleira_side_idle":[521,2390,59,102],"sk_pistoleira_side_walk_0":[582,2390,59,102],"sk_pistoleira_side_walk_1":[643,2390,59,102],"sk_pistoleira_side_walk_2":[704,2390,59,102],"sk_pistoleira_side_walk_3":[765,2390,59,102],"sk_pistoleira_side_walk_4":[826,2390,59,102],"sk_pistoleira_side_walk_5":[887,2390,59,102],"sk_pistoleira_side_walk_6":[948,2390,59,102],"sk_pistoleira_side_walk_7":[0,2494,59,102],"sk_pistoleira_swing_side":[61,2494,51,102],"sk_policial_back_walk_1":[114,2494,48,102],"sk_policial_back_walk_3":[164,2494,49,102],"sk_rei_dourado_back_idle":[215,2494,61,102],"sk_rei_dourado_back_walk_0":[278,2494,61,102],"sk_rei_dourado_back_walk_1":[341,2494,61,102],"sk_rei_dourado_back_walk_2":[404,2494,61,102],"sk_rei_dourado_back_walk_3":[467,2494,62,102],"sk_rei_mascarado_back_walk_1":[531,2494,48,102],"sk_rei_mascarado_back_walk_3":[581,2494,49,102],"sk_sombra_tatica_back_idle":[632,2494,52,102],"sk_sombra_tatica_back_walk_0":[686,2494,52,102],"sk_sombra_tatica_back_walk_1":[740,2494,52,102],"sk_sombra_tatica_back_walk_2":[794,2494,52,102],"sk_sombra_tatica_back_walk_3":[848,2494,53,102],"sk_sombra_tatica_side_idle":[903,2494,38,102],"sk_sombra_tatica_side_walk_0":[943,2494,38,102],"sk_sombra_tatica_side_walk_1":[983,2494,38,102],"sk_sombra_tatica_side_walk_2":[0,2598,38,102],"sk_sombra_tatica_side_walk_3":[40,2598,37,102],"sk_sombra_tatica_side_walk_4":[79,2598,37,102],"sk_sombra_tatica_side_walk_5":[118,2598,37,102],"sk_sombra_tatica_side_walk_6":[157,2598,37,102],"sk_sombra_tatica_side_walk_7":[196,2598,38,102],"sk_sombra_tatica_swing_side":[236,2598,36,102],"sk_cacadora_back_idle":[274,2598,52,101],"sk_cacadora_back_walk_0":[328,2598,52,101],"sk_cacadora_back_walk_1":[382,2598,50,101],"sk_cacadora_back_walk_2":[434,2598,52,101],"sk_cacadora_back_walk_3":[488,2598,51,101],"sk_ciberpiloto_back_idle":[541,2598,48,101],"sk_ciberpiloto_back_walk_0":[591,2598,48,101],"sk_ciberpiloto_back_walk_1":[641,2598,48,101],"sk_ciberpiloto_back_walk_2":[691,2598,48,101],"sk_ciberpiloto_back_walk_3":[741,2598,49,101],"sk_guardiao_cristal_side_idle":[792,2598,41,101],"sk_guardiao_cristal_side_walk_0":[835,2598,41,101],"sk_guardiao_cristal_side_walk_1":[878,2598,41,101],"sk_guardiao_cristal_side_walk_2":[921,2598,41,101],"sk_guardiao_cristal_side_walk_3":[964,2598,42,101],"sk_guardiao_cristal_side_walk_4":[0,2702,42,101],"sk_guardiao_cristal_side_walk_5":[44,2702,42,101],"sk_guardiao_cristal_side_walk_6":[88,2702,42,101],"sk_guardiao_cristal_side_walk_7":[132,2702,41,101],"sk_guardiao_cristal_swing_side":[175,2702,41,101],"sk_guerreiro_tribal_back_idle":[218,2702,50,101],"sk_guerreiro_tribal_back_walk_0":[270,2702,50,101],"sk_guerreiro_tribal_back_walk_1":[322,2702,50,101],"sk_guerreiro_tribal_back_walk_2":[374,2702,50,101],"sk_guerreiro_tribal_back_walk_3":[426,2702,51,101],"sk_pirata_side_idle":[479,2702,71,101],"sk_pirata_side_walk_0":[552,2702,71,101],"sk_pirata_side_walk_1":[625,2702,71,101],"sk_pirata_side_walk_2":[698,2702,71,101],"sk_pirata_side_walk_3":[771,2702,70,101],"sk_pirata_side_walk_4":[843,2702,70,101],"sk_pirata_side_walk_5":[915,2702,70,101],"sk_pirata_side_walk_6":[0,2805,70,101],"sk_pirata_side_walk_7":[72,2805,71,101],"sk_pirata_swing_side":[145,2805,54,101],"sk_policial_back_idle":[201,2805,47,101],"sk_policial_back_walk_0":[250,2805,47,101],"sk_policial_back_walk_2":[299,2805,47,101],"sk_policial_side_walk_3":[348,2805,43,101],"sk_policial_side_walk_4":[393,2805,43,101],"sk_policial_side_walk_5":[438,2805,43,101],"sk_policial_side_walk_6":[483,2805,43,101],"sk_princesa_back_idle":[528,2805,65,101],"sk_princesa_back_walk_0":[595,2805,65,101],"sk_princesa_back_walk_1":[662,2805,64,101],"sk_princesa_back_walk_2":[728,2805,65,101],"sk_princesa_back_walk_3":[795,2805,65,101],"sk_samurai_back_idle":[862,2805,47,101],"sk_samurai_back_walk_0":[911,2805,47,101],"sk_samurai_back_walk_1":[960,2805,47,101],"sk_samurai_back_walk_2":[0,2908,47,101],"sk_samurai_back_walk_3":[49,2908,48,101],"sk_samurai_side_idle":[99,2908,45,101],"sk_samurai_side_walk_0":[146,2908,45,101],"sk_samurai_side_walk_1":[193,2908,45,101],"sk_samurai_side_walk_2":[240,2908,45,101],"sk_samurai_side_walk_3":[287,2908,46,101],"sk_samurai_side_walk_4":[335,2908,46,101],"sk_samurai_side_walk_5":[383,2908,46,101],"sk_samurai_side_walk_6":[431,2908,46,101],"sk_samurai_side_walk_7":[479,2908,45,101],"sk_samurai_swing_side":[526,2908,41,101],"tree_campos":[569,2908,80,100],"sk_arqueira_mata_side_idle":[651,2908,41,100],"sk_arqueira_mata_side_walk_0":[694,2908,41,100],"sk_arqueira_mata_side_walk_1":[737,2908,41,100],"sk_arqueira_mata_side_walk_2":[780,2908,41,100],"sk_arqueira_mata_side_walk_3":[823,2908,41,100],"sk_arqueira_mata_side_walk_4":[866,2908,41,100],"sk_arqueira_mata_side_walk_5":[909,2908,41,100],"sk_arqueira_mata_side_walk_6":[952,2908,41,100],"sk_arqueira_mata_side_walk_7":[0,3011,41,100],"sk_arqueira_mata_swing_side":[43,3011,40,100],"sk_arqueiro_mata_side_idle":[85,3011,41,100],"sk_arqueiro_mata_side_walk_0":[128,3011,41,100],"sk_arqueiro_mata_side_walk_1":[171,3011,41,100],"sk_arqueiro_mata_side_walk_2":[214,3011,41,100],"sk_arqueiro_mata_side_walk_3":[257,3011,41,100],"sk_arqueiro_mata_side_walk_4":[300,3011,41,100],"sk_arqueiro_mata_side_walk_5":[343,3011,41,100],"sk_arqueiro_mata_side_walk_6":[386,3011,41,100],"sk_arqueiro_mata_side_walk_7":[429,3011,41,100],"sk_arqueiro_mata_swing_side":[472,3011,39,100],"sk_cacadora_side_idle":[513,3011,47,100],"sk_cacadora_side_walk_0":[562,3011,47,100],"sk_cacadora_side_walk_1":[611,3011,47,100],"sk_cacadora_side_walk_2":[660,3011,47,100],"sk_cacadora_side_walk_3":[709,3011,47,100],"sk_cacadora_side_walk_4":[758,3011,47,100],"sk_cacadora_side_walk_5":[807,3011,47,100],"sk_cacadora_side_walk_6":[856,3011,47,100],"sk_cacadora_side_walk_7":[905,3011,47,100],"sk_cacadora_swing_side":[954,3011,41,100],"sk_ceifador_side_idle":[0,3113,49,100],"sk_ceifador_side_walk_0":[51,3113,49,100],"sk_ceifador_side_walk_1":[102,3113,49,100],"sk_ceifador_side_walk_2":[153,3113,49,100],"sk_ceifador_side_walk_3":[204,3113,48,100],"sk_ceifador_side_walk_4":[254,3113,48,100],"sk_ceifador_side_walk_5":[304,3113,48,100],"sk_ceifador_side_walk_6":[354,3113,48,100],"sk_ceifador_side_walk_7":[404,3113,49,100],"sk_ceifador_swing_side":[455,3113,46,100],"sk_ciberpiloto_side_idle":[503,3113,43,100],"sk_ciberpiloto_side_walk_0":[548,3113,43,100],"sk_ciberpiloto_side_walk_1":[593,3113,43,100],"sk_ciberpiloto_side_walk_2":[638,3113,43,100],"sk_ciberpiloto_side_walk_3":[683,3113,43,100],"sk_ciberpiloto_side_walk_4":[728,3113,43,100],"sk_ciberpiloto_side_walk_5":[773,3113,43,100],"sk_ciberpiloto_side_walk_6":[818,3113,43,100],"sk_ciberpiloto_side_walk_7":[863,3113,43,100],"sk_ciberpiloto_swing_side":[908,3113,40,100],"sk_cowboy_caveira_side_idle":[950,3113,49,100],"sk_cowboy_caveira_side_walk_0":[0,3215,49,100],"sk_cowboy_caveira_side_walk_1":[51,3215,49,100],"sk_cowboy_caveira_side_walk_2":[102,3215,49,100],"sk_cowboy_caveira_side_walk_3":[153,3215,50,100],"sk_cowboy_caveira_side_walk_4":[205,3215,50,100],"sk_cowboy_caveira_side_walk_5":[257,3215,50,100],"sk_cowboy_caveira_side_walk_6":[309,3215,50,100],"sk_cowboy_caveira_side_walk_7":[361,3215,49,100],"sk_cowboy_caveira_swing_side":[412,3215,46,100],"sk_espectro_side_idle":[460,3215,88,100],"sk_espectro_side_walk_0":[550,3215,88,100],"sk_espectro_side_walk_1":[640,3215,88,100],"sk_espectro_side_walk_2":[730,3215,88,100],"sk_espectro_side_walk_3":[820,3215,88,100],"sk_espectro_side_walk_4":[910,3215,88,100],"sk_espectro_side_walk_5":[0,3317,88,100],"sk_espectro_side_walk_6":[90,3317,88,100],"sk_espectro_side_walk_7":[180,3317,88,100],"sk_espectro_swing_side":[270,3317,64,100],"sk_pirata_back_idle":[336,3317,54,100],"sk_pirata_back_walk_0":[392,3317,54,100],"sk_pirata_back_walk_1":[448,3317,52,100],"sk_pirata_back_walk_2":[502,3317,54,100],"sk_pirata_back_walk_3":[558,3317,52,100],"sk_policial_side_idle":[612,3317,42,100],"sk_policial_side_walk_0":[656,3317,42,100],"sk_policial_side_walk_1":[700,3317,42,100],"sk_policial_side_walk_2":[744,3317,42,100],"sk_policial_side_walk_7":[788,3317,42,100],"sk_policial_swing_side":[832,3317,40,100],"sk_princesa_side_idle":[874,3317,62,100],"sk_princesa_side_walk_0":[938,3317,62,100],"sk_princesa_side_walk_1":[0,3419,62,100],"sk_princesa_side_walk_2":[64,3419,62,100],"sk_princesa_side_walk_3":[128,3419,62,100],"sk_princesa_side_walk_4":[192,3419,62,100],"sk_princesa_side_walk_5":[256,3419,62,100],"sk_princesa_side_walk_6":[320,3419,62,100],"sk_princesa_side_walk_7":[384,3419,62,100],"sk_princesa_swing_side":[448,3419,52,100],"sk_rei_dourado_side_walk_3":[502,3419,57,100],"sk_rei_dourado_side_walk_4":[561,3419,57,100],"sk_rei_dourado_side_walk_5":[620,3419,57,100],"sk_rei_dourado_side_walk_6":[679,3419,57,100],"sk_rei_mascarado_side_idle":[738,3419,50,100],"sk_rei_mascarado_side_walk_0":[790,3419,50,100],"sk_rei_mascarado_side_walk_1":[842,3419,50,100],"sk_rei_mascarado_side_walk_2":[894,3419,50,100],"sk_rei_mascarado_side_walk_3":[946,3419,50,100],"sk_rei_mascarado_side_walk_4":[0,3521,50,100],"sk_rei_mascarado_side_walk_5":[52,3521,50,100],"sk_rei_mascarado_side_walk_6":[104,3521,50,100],"sk_rei_mascarado_side_walk_7":[156,3521,50,100],"sk_rei_mascarado_swing_side":[208,3521,49,100],"galinha_back_0":[259,3521,59,100],"galinha_back_1":[320,3521,57,100],"galinha_back_2":[379,3521,59,100],"galinha_back_3":[440,3521,56,100],"coelho_back_0":[498,3521,42,100],"coelho_back_1":[542,3521,42,100],"coelho_back_2":[586,3521,42,100],"coelho_back_3":[630,3521,42,100],"pintinho_front_0":[674,3521,72,100],"raposa_front_0":[748,3521,76,100],"raposa_front_1":[826,3521,78,100],"raposa_front_2":[906,3521,78,100],"raposa_front_3":[0,3623,73,100],"raposa_back_0":[75,3623,51,100],"raposa_back_1":[128,3623,54,100],"raposa_back_2":[184,3623,51,100],"raposa_back_3":[237,3623,56,100],"cervo_front_0":[295,3623,52,100],"cervo_front_1":[349,3623,52,100],"cervo_front_2":[403,3623,54,100],"cervo_front_3":[459,3623,52,100],"cervo_back_0":[513,3623,52,100],"cervo_back_1":[567,3623,52,100],"cervo_back_2":[621,3623,52,100],"cervo_back_3":[675,3623,52,100],"cervo_side_0":[729,3623,102,100],"cervo_side_1":[833,3623,107,100],"cervo_side_2":[0,3725,107,100],"cervo_side_3":[109,3725,107,100],"pavao_back_0":[218,3725,37,100],"javali_back_2":[257,3725,60,100],"robo_front_0":[319,3725,60,100],"robo_front_1":[381,3725,60,100],"robo_front_2":[443,3725,61,100],"robo_front_3":[506,3725,60,100],"robo_front_4":[568,3725,61,100],"robo_front_5":[631,3725,60,100],"sk_cacique_back_idle":[693,3725,49,99],"sk_cacique_back_walk_0":[744,3725,49,99],"sk_cacique_back_walk_1":[795,3725,50,99],"sk_cacique_back_walk_2":[847,3725,49,99],"sk_cacique_back_walk_3":[898,3725,51,99],"sk_cacique_side_idle":[951,3725,41,99],"sk_cacique_side_walk_0":[0,3827,41,99],"sk_cacique_side_walk_1":[43,3827,41,99],"sk_cacique_side_walk_2":[86,3827,41,99],"sk_cacique_side_walk_3":[129,3827,41,99],"sk_cacique_side_walk_4":[172,3827,41,99],"sk_cacique_side_walk_5":[215,3827,41,99],"sk_cacique_side_walk_6":[258,3827,41,99],"sk_cacique_side_walk_7":[301,3827,41,99],"sk_cacique_swing_side":[344,3827,39,99],"sk_guerreiro_tribal_side_idle":[385,3827,41,99],"sk_guerreiro_tribal_side_walk_0":[428,3827,41,99],"sk_guerreiro_tribal_side_walk_1":[471,3827,41,99],"sk_guerreiro_tribal_side_walk_2":[514,3827,41,99],"sk_guerreiro_tribal_side_walk_3":[557,3827,41,99],"sk_guerreiro_tribal_side_walk_4":[600,3827,41,99],"sk_guerreiro_tribal_side_walk_5":[643,3827,41,99],"sk_guerreiro_tribal_side_walk_6":[686,3827,41,99],"sk_guerreiro_tribal_side_walk_7":[729,3827,41,99],"sk_guerreiro_tribal_swing_side":[772,3827,39,99],"sk_rei_dourado_side_idle":[813,3827,57,99],"sk_rei_dourado_side_walk_0":[872,3827,57,99],"sk_rei_dourado_side_walk_1":[931,3827,57,99],"sk_rei_dourado_side_walk_2":[0,3928,57,99],"sk_rei_dourado_side_walk_7":[59,3928,57,99],"sk_rei_dourado_swing_side":[118,3928,53,99],"sk_saqueador_side_idle":[173,3928,40,99],"sk_saqueador_side_walk_0":[215,3928,40,99],"sk_saqueador_side_walk_1":[257,3928,40,99],"sk_saqueador_side_walk_2":[299,3928,40,99],"sk_saqueador_side_walk_3":[341,3928,40,99],"sk_saqueador_side_walk_4":[383,3928,40,99],"sk_saqueador_side_walk_5":[425,3928,40,99],"sk_saqueador_side_walk_6":[467,3928,40,99],"sk_saqueador_side_walk_7":[509,3928,40,99],"sk_saqueador_swing_side":[551,3928,39,99],"galinha_front_0":[592,3928,66,99],"galinha_front_1":[660,3928,69,99],"galinha_front_2":[731,3928,69,99],"galinha_front_3":[802,3928,69,99],"pavao_fan_0":[873,3928,116,99],"pavao_fan_1":[0,4029,117,99],"pavao_fan_2":[119,4029,116,99],"pavao_fan_3":[237,4029,116,99],"javali_back_0":[355,4029,60,99],"javali_back_1":[417,4029,59,99],"javali_back_3":[478,4029,60,99],"sk_saqueador_back_idle":[540,4029,54,98],"sk_saqueador_back_walk_0":[596,4029,54,98],"sk_saqueador_back_walk_1":[652,4029,54,98],"sk_saqueador_back_walk_2":[708,4029,54,98],"sk_saqueador_back_walk_3":[764,4029,54,98],"javali_front_0":[820,4029,60,98],"javali_front_1":[882,4029,59,98],"javali_front_2":[943,4029,68,98],"javali_front_3":[0,4130,60,98],"robo_back_0":[62,4130,58,98],"robo_back_1":[122,4130,58,98],"robo_back_2":[182,4130,58,98],"robo_back_3":[242,4130,58,98],"robo_back_4":[302,4130,58,98],"robo_back_5":[362,4130,57,98],"robo_side_0":[421,4130,56,98],"robo_side_1":[479,4130,56,98],"robo_side_2":[537,4130,57,98],"robo_side_3":[596,4130,57,98],"robo_side_4":[655,4130,56,98],"robo_side_5":[713,4130,56,98],"pintinho_back_1":[771,4130,69,97],"pintinho_back_3":[842,4130,69,97],"pavao_back_1":[913,4130,43,96],"pavao_back_2":[958,4130,37,96],"pavao_back_3":[0,4230,48,96],"arco_mao":[50,4230,90,96],"sk_arqueira_mata_back_idle":[142,4230,50,95],"sk_arqueira_mata_back_walk_0":[194,4230,50,95],"sk_arqueira_mata_back_walk_1":[246,4230,50,95],"sk_arqueira_mata_back_walk_2":[298,4230,50,95],"sk_arqueira_mata_back_walk_3":[350,4230,51,95],"pintinho_back_2":[403,4230,79,95],"robo_dig_3":[484,4230,72,95],"sk_arqueiro_mata_back_idle":[558,4230,49,94],"sk_arqueiro_mata_back_walk_0":[609,4230,49,94],"sk_arqueiro_mata_back_walk_1":[660,4230,50,94],"sk_arqueiro_mata_back_walk_2":[712,4230,49,94],"sk_arqueiro_mata_back_walk_3":[763,4230,50,94],"pintinho_back_0":[815,4230,78,94],"pavao_front_2":[895,4230,37,91],"tree_pantano":[934,4230,80,90],"pavao_front_0":[0,4328,37,90],"coelho_front_0":[39,4328,41,89],"coelho_front_1":[82,4328,44,89],"coelho_front_2":[128,4328,42,89],"coelho_front_3":[172,4328,39,89],"pavao_front_1":[213,4328,37,89],"coelho_side_0":[252,4328,84,86],"coelho_side_1":[338,4328,84,86],"coelho_side_3":[424,4328,84,86],"galinha_side_0":[510,4328,85,85],"galinha_side_1":[597,4328,87,85],"galinha_side_2":[686,4328,88,85],"galinha_side_3":[776,4328,88,85],"tree_montanhas":[866,4328,80,83],"javali_side_0":[0,4420,127,83],"javali_side_1":[129,4420,126,83],"javali_side_2":[257,4420,128,83],"javali_side_3":[387,4420,128,83],"coelho_side_2":[517,4420,84,81],"pavao_side_0":[603,4420,100,81],"pavao_side_1":[705,4420,103,79],"pavao_side_3":[810,4420,103,79],"pavao_side_2":[915,4420,104,78],"wall":[0,4505,61,76],"raposa_side_0":[63,4505,114,71],"raposa_side_1":[179,4505,114,71],"raposa_side_2":[295,4505,116,71],"raposa_side_3":[413,4505,114,71],"magia_estouro":[529,4505,72,71],"ground_campos_0":[603,4505,64,64],"ground_campos_1":[669,4505,64,64],"ground_campos_2":[735,4505,64,64],"ground_campos_3":[801,4505,64,64],"ground_floresta_0":[867,4505,64,64],"ground_floresta_1":[933,4505,64,64],"ground_floresta_2":[0,4583,64,64],"ground_floresta_3":[66,4583,64,64],"ground_pantano_0":[132,4583,64,64],"ground_pantano_1":[198,4583,64,64],"ground_pantano_2":[264,4583,64,64],"ground_pantano_3":[330,4583,64,64],"ground_deserto_0":[396,4583,64,64],"ground_deserto_1":[462,4583,64,64],"ground_deserto_2":[528,4583,64,64],"ground_deserto_3":[594,4583,64,64],"ground_montanhas_0":[660,4583,64,64],"ground_montanhas_1":[726,4583,64,64],"ground_montanhas_2":[792,4583,64,64],"ground_montanhas_3":[858,4583,64,64],"ground_neve_0":[924,4583,64,64],"ground_neve_1":[0,4649,64,64],"ground_neve_2":[66,4649,64,64],"ground_neve_3":[132,4649,64,64],"tilled_0":[198,4649,64,64],"tilled_1":[264,4649,64,64],"tilled_2":[330,4649,64,64],"tilled_3":[396,4649,64,64],"water_0":[462,4649,64,64],"water_1":[528,4649,64,64],"water_2":[594,4649,64,64],"dirt":[660,4649,64,64],"stone":[726,4649,64,64],"coal":[792,4649,64,64],"bronze":[858,4649,64,64],"iron":[924,4649,64,64],"silver":[0,4715,64,64],"gold":[66,4715,64,64],"oil":[132,4715,64,64],"diamond":[198,4715,64,64],"floor_0":[264,4715,64,64],"floor_1":[330,4715,64,64],"floor_2":[396,4715,64,64],"floor_3":[462,4715,64,64],"wheat_3":[528,4715,64,63],"wheat_2":[594,4715,64,58],"rock_montanhas":[660,4715,58,56],"icon_espada":[720,4715,54,56],"icon_muro":[776,4715,53,56],"icon_enxada":[831,4715,46,56],"icon_colheita":[879,4715,41,56],"icon_petroleo":[922,4715,36,56],"icon_arco":[960,4715,53,56],"icon_flechas":[0,4781,53,56],"icon_cetro":[55,4781,54,56],"icon_carvao":[111,4781,56,55],"helmet_front":[169,4781,64,55],"icon_picareta":[235,4781,56,54],"icon_rede":[293,4781,56,54],"helmet_back":[351,4781,64,54],"pintinho_side_1":[417,4781,43,53],"pintinho_side_3":[462,4781,43,53],"icon_machado":[507,4781,56,53],"pintinho_side_0":[565,4781,43,52],"pintinho_side_2":[610,4781,43,52],"rock_floresta":[655,4781,60,51],"rock_deserto":[717,4781,60,51],"hole":[779,4781,64,51],"spring":[845,4781,64,50],"magia_voo":[911,4781,56,50],"wheat_1":[0,4839,64,49],"icon_diamante":[66,4839,56,48],"icon_pedra":[124,4839,56,47],"icon_sementes":[182,4839,56,46],"helmet_side":[240,4839,64,45],"rock_neve":[306,4839,60,44],"icon_madeira":[368,4839,56,44],"rock_campos":[426,4839,60,42],"fist_menino":[488,4839,40,42],"fist_menino_negro":[530,4839,40,42],"fist_menina_ruiva":[572,4839,40,42],"fist_menina_negra":[614,4839,40,42],"fist_sk_arqueira_mata":[656,4839,40,42],"fist_sk_arqueiro_mata":[698,4839,40,42],"fist_sk_cacadora":[740,4839,40,42],"fist_sk_cacique":[782,4839,40,42],"fist_sk_carrasco":[824,4839,40,42],"fist_sk_ceifador":[866,4839,40,42],"fist_sk_ciberpiloto":[908,4839,40,42],"fist_sk_cowboy_caveira":[950,4839,40,42],"fist_sk_espectro":[0,4890,40,42],"fist_sk_exploradora":[42,4890,40,42],"fist_sk_guarda_azul":[84,4890,40,42],"fist_sk_guardiao_cristal":[126,4890,40,42],"fist_sk_guerreiro_tribal":[168,4890,40,42],"fist_sk_mecanico_vermelho":[210,4890,40,42],"fist_sk_pirata":[252,4890,40,42],"fist_sk_pistoleira":[294,4890,40,42],"fist_sk_policial":[336,4890,40,42],"fist_sk_princesa":[378,4890,40,42],"fist_sk_rei_dourado":[420,4890,40,42],"fist_sk_rei_mascarado":[462,4890,40,42],"fist_sk_samurai":[504,4890,40,42],"fist_sk_saqueador":[546,4890,40,42],"fist_sk_sombra_tatica":[588,4890,40,42],"icon_carne":[630,4890,56,39],"rock_pantano":[688,4890,60,38],"wheat_0":[750,4890,64,38],"icon_bronze":[816,4890,56,37],"icon_ferro":[874,4890,56,37],"icon_ouro":[932,4890,56,37],"icon_prata":[0,4934,56,37],"flecha_voo":[58,4934,64,13],"skin_menino":[228,185,150],"skin_menino_negro":[107,56,40],"skin_menina_ruiva":[243,168,128],"skin_menina_negra":[104,57,39],"skin_sk_arqueira_mata":[118,80,66],"skin_sk_arqueiro_mata":[130,71,63],"skin_sk_cacadora":[49,55,44],"skin_sk_cacique":[125,84,71],"skin_sk_carrasco":[73,38,41],"skin_sk_ceifador":[57,41,48],"skin_sk_ciberpiloto":[39,35,78],"skin_sk_cowboy_caveira":[81,62,55],"skin_sk_espectro":[32,26,40],"skin_sk_exploradora":[90,41,50],"skin_sk_guarda_azul":[75,65,61],"skin_sk_guardiao_cristal":[58,112,163],"skin_sk_guerreiro_tribal":[130,85,67],"skin_sk_mecanico_vermelho":[88,67,59],"skin_sk_pirata":[142,87,79],"skin_sk_pistoleira":[74,38,48],"skin_sk_policial":[46,31,87],"skin_sk_princesa":[57,63,130],"skin_sk_rei_dourado":[173,20,36],"skin_sk_rei_mascarado":[106,44,54],"skin_sk_samurai":[67,48,51],"skin_sk_saqueador":[103,76,75],"skin_sk_sombra_tatica":[71,68,64],"hand_menino_front_idle":[4,65],"hand_menino_front_walk_0":[4,65],"hand_menino_front_walk_1":[4,65],"hand_menino_front_walk_2":[4,65],"hand_menino_front_walk_3":[5,65],"hand_menino_back_idle":[41,63],"hand_menino_back_walk_0":[41,63],"hand_menino_back_walk_1":[41,63],"hand_menino_back_walk_2":[41,63],"hand_menino_back_walk_3":[42,64],"hand_menino_side_idle":[22,68],"hand_menino_side_walk_0":[23,68],"hand_menino_side_walk_1":[22,68],"hand_menino_side_walk_2":[22,68],"hand_menino_side_walk_3":[27,66],"hand_menino_side_walk_4":[28,66],"hand_menino_side_walk_5":[27,66],"hand_menino_side_walk_6":[27,66],"hand_menino_side_walk_7":[22,68],"hand_menino_negro_front_idle":[7,68],"hand_menino_negro_front_walk_0":[7,68],"hand_menino_negro_front_walk_1":[8,68],"hand_menino_negro_front_walk_2":[7,68],"hand_menino_negro_front_walk_3":[8,68],"hand_menino_negro_back_idle":[39,68],"hand_menino_negro_back_walk_0":[39,68],"hand_menino_negro_back_walk_1":[39,69],"hand_menino_negro_back_walk_2":[39,68],"hand_menino_negro_back_walk_3":[40,68],"hand_menino_negro_side_idle":[24,72],"hand_menino_negro_side_walk_0":[26,73],"hand_menino_negro_side_walk_1":[25,73],"hand_menino_negro_side_walk_2":[24,72],"hand_menino_negro_side_walk_3":[32,69],"hand_menino_negro_side_walk_4":[33,69],"hand_menino_negro_side_walk_5":[32,69],"hand_menino_negro_side_walk_6":[31,69],"hand_menino_negro_side_walk_7":[25,73],"hand_menina_ruiva_front_idle":[4,64],"hand_menina_ruiva_front_walk_0":[4,64],"hand_menina_ruiva_front_walk_1":[4,64],"hand_menina_ruiva_front_walk_2":[4,64],"hand_menina_ruiva_front_walk_3":[5,64],"hand_menina_ruiva_back_idle":[41,64],"hand_menina_ruiva_back_walk_0":[41,64],"hand_menina_ruiva_back_walk_1":[42,63],"hand_menina_ruiva_back_walk_2":[41,64],"hand_menina_ruiva_back_walk_3":[42,63],"hand_menina_ruiva_side_idle":[29,65],"hand_menina_ruiva_side_walk_0":[30,65],"hand_menina_ruiva_side_walk_1":[30,65],"hand_menina_ruiva_side_walk_2":[29,65],"hand_menina_ruiva_side_walk_3":[36,63],"hand_menina_ruiva_side_walk_4":[37,63],"hand_menina_ruiva_side_walk_5":[36,63],"hand_menina_ruiva_side_walk_6":[36,63],"hand_menina_ruiva_side_walk_7":[30,65],"hand_menina_negra_front_idle":[11,62],"hand_menina_negra_front_walk_0":[11,62],"hand_menina_negra_front_walk_1":[10,62],"hand_menina_negra_front_walk_2":[11,62],"hand_menina_negra_front_walk_3":[10,63],"hand_menina_negra_back_idle":[45,63],"hand_menina_negra_back_walk_0":[45,63],"hand_menina_negra_back_walk_1":[46,65],"hand_menina_negra_back_walk_2":[45,63],"hand_menina_negra_back_walk_3":[45,65],"hand_menina_negra_side_idle":[26,63],"hand_menina_negra_side_walk_0":[26,64],"hand_menina_negra_side_walk_1":[26,63],"hand_menina_negra_side_walk_2":[26,63],"hand_menina_negra_side_walk_3":[31,62],"hand_menina_negra_side_walk_4":[31,62],"hand_menina_negra_side_walk_5":[31,62],"hand_menina_negra_side_walk_6":[31,62],"hand_menina_negra_side_walk_7":[26,63],"hand_sk_arqueira_mata_front_idle":[9,61],"hand_sk_arqueira_mata_front_walk_0":[9,61],"hand_sk_arqueira_mata_front_walk_1":[9,61],"hand_sk_arqueira_mata_front_walk_2":[9,61],"hand_sk_arqueira_mata_front_walk_3":[10,64],"hand_sk_arqueira_mata_back_idle":[37,58],"hand_sk_arqueira_mata_back_walk_0":[37,58],"hand_sk_arqueira_mata_back_walk_1":[37,58],"hand_sk_arqueira_mata_back_walk_2":[37,58],"hand_sk_arqueira_mata_back_walk_3":[38,58],"hand_sk_arqueira_mata_side_idle":[22,64],"hand_sk_arqueira_mata_side_walk_0":[23,65],"hand_sk_arqueira_mata_side_walk_1":[22,64],"hand_sk_arqueira_mata_side_walk_2":[22,64],"hand_sk_arqueira_mata_side_walk_3":[22,64],"hand_sk_arqueira_mata_side_walk_4":[23,65],"hand_sk_arqueira_mata_side_walk_5":[22,64],"hand_sk_arqueira_mata_side_walk_6":[22,64],"hand_sk_arqueira_mata_side_walk_7":[22,64],"hand_sk_arqueiro_mata_front_idle":[8,61],"hand_sk_arqueiro_mata_front_walk_0":[8,61],"hand_sk_arqueiro_mata_front_walk_1":[8,61],"hand_sk_arqueiro_mata_front_walk_2":[8,61],"hand_sk_arqueiro_mata_front_walk_3":[10,63],"hand_sk_arqueiro_mata_back_idle":[37,57],"hand_sk_arqueiro_mata_back_walk_0":[37,57],"hand_sk_arqueiro_mata_back_walk_1":[37,57],"hand_sk_arqueiro_mata_back_walk_2":[37,57],"hand_sk_arqueiro_mata_back_walk_3":[37,57],"hand_sk_arqueiro_mata_side_idle":[22,63],"hand_sk_arqueiro_mata_side_walk_0":[22,64],"hand_sk_arqueiro_mata_side_walk_1":[22,64],"hand_sk_arqueiro_mata_side_walk_2":[22,63],"hand_sk_arqueiro_mata_side_walk_3":[22,63],"hand_sk_arqueiro_mata_side_walk_4":[23,64],"hand_sk_arqueiro_mata_side_walk_5":[22,63],"hand_sk_arqueiro_mata_side_walk_6":[22,63],"hand_sk_arqueiro_mata_side_walk_7":[22,64],"hand_sk_cacadora_front_idle":[10,62],"hand_sk_cacadora_front_walk_0":[10,62],"hand_sk_cacadora_front_walk_1":[10,62],"hand_sk_cacadora_front_walk_2":[10,62],"hand_sk_cacadora_front_walk_3":[10,62],"hand_sk_cacadora_back_idle":[39,58],"hand_sk_cacadora_back_walk_0":[39,58],"hand_sk_cacadora_back_walk_1":[38,57],"hand_sk_cacadora_back_walk_2":[39,58],"hand_sk_cacadora_back_walk_3":[39,57],"hand_sk_cacadora_side_idle":[28,61],"hand_sk_cacadora_side_walk_0":[29,62],"hand_sk_cacadora_side_walk_1":[29,61],"hand_sk_cacadora_side_walk_2":[28,61],"hand_sk_cacadora_side_walk_3":[29,61],"hand_sk_cacadora_side_walk_4":[29,62],"hand_sk_cacadora_side_walk_5":[29,61],"hand_sk_cacadora_side_walk_6":[28,61],"hand_sk_cacadora_side_walk_7":[29,61],"hand_sk_cacique_front_idle":[8,61],"hand_sk_cacique_front_walk_0":[8,61],"hand_sk_cacique_front_walk_1":[9,62],"hand_sk_cacique_front_walk_2":[8,61],"hand_sk_cacique_front_walk_3":[9,62],"hand_sk_cacique_back_idle":[38,59],"hand_sk_cacique_back_walk_0":[38,59],"hand_sk_cacique_back_walk_1":[37,60],"hand_sk_cacique_back_walk_2":[38,59],"hand_sk_cacique_back_walk_3":[39,58],"hand_sk_cacique_side_idle":[22,61],"hand_sk_cacique_side_walk_0":[23,63],"hand_sk_cacique_side_walk_1":[23,62],"hand_sk_cacique_side_walk_2":[22,61],"hand_sk_cacique_side_walk_3":[22,61],"hand_sk_cacique_side_walk_4":[23,62],"hand_sk_cacique_side_walk_5":[22,61],"hand_sk_cacique_side_walk_6":[22,61],"hand_sk_cacique_side_walk_7":[23,62],"hand_sk_carrasco_front_idle":[16,62],"hand_sk_carrasco_front_walk_0":[16,62],"hand_sk_carrasco_front_walk_1":[16,61],"hand_sk_carrasco_front_walk_2":[16,62],"hand_sk_carrasco_front_walk_3":[16,62],"hand_sk_carrasco_back_idle":[48,62],"hand_sk_carrasco_back_walk_0":[48,62],"hand_sk_carrasco_back_walk_1":[46,61],"hand_sk_carrasco_back_walk_2":[48,62],"hand_sk_carrasco_back_walk_3":[46,62],"hand_sk_carrasco_side_idle":[37,62],"hand_sk_carrasco_side_walk_0":[37,63],"hand_sk_carrasco_side_walk_1":[37,62],"hand_sk_carrasco_side_walk_2":[37,62],"hand_sk_carrasco_side_walk_3":[26,63],"hand_sk_carrasco_side_walk_4":[26,63],"hand_sk_carrasco_side_walk_5":[26,63],"hand_sk_carrasco_side_walk_6":[26,62],"hand_sk_carrasco_side_walk_7":[37,62],"hand_sk_ceifador_front_idle":[11,65],"hand_sk_ceifador_front_walk_0":[11,65],"hand_sk_ceifador_front_walk_1":[11,65],"hand_sk_ceifador_front_walk_2":[11,65],"hand_sk_ceifador_front_walk_3":[12,65],"hand_sk_ceifador_back_idle":[38,62],"hand_sk_ceifador_back_walk_0":[38,62],"hand_sk_ceifador_back_walk_1":[39,61],"hand_sk_ceifador_back_walk_2":[38,62],"hand_sk_ceifador_back_walk_3":[39,62],"hand_sk_ceifador_side_idle":[29,60],"hand_sk_ceifador_side_walk_0":[29,61],"hand_sk_ceifador_side_walk_1":[29,61],"hand_sk_ceifador_side_walk_2":[29,60],"hand_sk_ceifador_side_walk_3":[28,61],"hand_sk_ceifador_side_walk_4":[28,62],"hand_sk_ceifador_side_walk_5":[28,61],"hand_sk_ceifador_side_walk_6":[28,60],"hand_sk_ceifador_side_walk_7":[29,61],"hand_sk_ciberpiloto_front_idle":[11,56],"hand_sk_ciberpiloto_front_walk_0":[11,56],"hand_sk_ciberpiloto_front_walk_1":[11,56],"hand_sk_ciberpiloto_front_walk_2":[11,56],"hand_sk_ciberpiloto_front_walk_3":[12,57],"hand_sk_ciberpiloto_back_idle":[38,58],"hand_sk_ciberpiloto_back_walk_0":[38,58],"hand_sk_ciberpiloto_back_walk_1":[38,57],"hand_sk_ciberpiloto_back_walk_2":[38,58],"hand_sk_ciberpiloto_back_walk_3":[38,57],"hand_sk_ciberpiloto_side_idle":[22,64],"hand_sk_ciberpiloto_side_walk_0":[24,64],"hand_sk_ciberpiloto_side_walk_1":[23,64],"hand_sk_ciberpiloto_side_walk_2":[22,64],"hand_sk_ciberpiloto_side_walk_3":[23,64],"hand_sk_ciberpiloto_side_walk_4":[24,64],"hand_sk_ciberpiloto_side_walk_5":[23,64],"hand_sk_ciberpiloto_side_walk_6":[23,64],"hand_sk_ciberpiloto_side_walk_7":[23,64],"hand_sk_cowboy_caveira_front_idle":[10,64],"hand_sk_cowboy_caveira_front_walk_0":[10,64],"hand_sk_cowboy_caveira_front_walk_1":[10,64],"hand_sk_cowboy_caveira_front_walk_2":[10,64],"hand_sk_cowboy_caveira_front_walk_3":[9,64],"hand_sk_cowboy_caveira_back_idle":[37,63],"hand_sk_cowboy_caveira_back_walk_0":[37,63],"hand_sk_cowboy_caveira_back_walk_1":[38,63],"hand_sk_cowboy_caveira_back_walk_2":[37,63],"hand_sk_cowboy_caveira_back_walk_3":[38,62],"hand_sk_cowboy_caveira_side_idle":[28,60],"hand_sk_cowboy_caveira_side_walk_0":[29,61],"hand_sk_cowboy_caveira_side_walk_1":[29,61],"hand_sk_cowboy_caveira_side_walk_2":[28,60],"hand_sk_cowboy_caveira_side_walk_3":[28,61],"hand_sk_cowboy_caveira_side_walk_4":[29,61],"hand_sk_cowboy_caveira_side_walk_5":[28,61],"hand_sk_cowboy_caveira_side_walk_6":[28,60],"hand_sk_cowboy_caveira_side_walk_7":[29,61],"hand_sk_espectro_front_idle":[16,62],"hand_sk_espectro_front_walk_0":[16,62],"hand_sk_espectro_front_walk_1":[16,63],"hand_sk_espectro_front_walk_2":[16,62],"hand_sk_espectro_front_walk_3":[16,63],"hand_sk_espectro_back_idle":[47,64],"hand_sk_espectro_back_walk_0":[47,64],"hand_sk_espectro_back_walk_1":[46,62],"hand_sk_espectro_back_walk_2":[47,64],"hand_sk_espectro_back_walk_3":[47,64],"hand_sk_espectro_side_idle":[44,60],"hand_sk_espectro_side_walk_0":[44,60],"hand_sk_espectro_side_walk_1":[44,60],"hand_sk_espectro_side_walk_2":[44,60],"hand_sk_espectro_side_walk_3":[44,60],"hand_sk_espectro_side_walk_4":[44,61],"hand_sk_espectro_side_walk_5":[44,60],"hand_sk_espectro_side_walk_6":[44,60],"hand_sk_espectro_side_walk_7":[44,60],"hand_sk_exploradora_front_idle":[10,61],"hand_sk_exploradora_front_walk_0":[10,61],"hand_sk_exploradora_front_walk_1":[10,61],"hand_sk_exploradora_front_walk_2":[10,61],"hand_sk_exploradora_front_walk_3":[10,61],"hand_sk_exploradora_back_idle":[43,63],"hand_sk_exploradora_back_walk_0":[43,63],"hand_sk_exploradora_back_walk_1":[44,63],"hand_sk_exploradora_back_walk_2":[43,63],"hand_sk_exploradora_back_walk_3":[44,62],"hand_sk_exploradora_side_idle":[25,62],"hand_sk_exploradora_side_walk_0":[25,64],"hand_sk_exploradora_side_walk_1":[25,63],"hand_sk_exploradora_side_walk_2":[25,62],"hand_sk_exploradora_side_walk_3":[25,64],"hand_sk_exploradora_side_walk_4":[26,65],"hand_sk_exploradora_side_walk_5":[25,64],"hand_sk_exploradora_side_walk_6":[25,63],"hand_sk_exploradora_side_walk_7":[25,63],"hand_sk_guarda_azul_front_idle":[11,64],"hand_sk_guarda_azul_front_walk_0":[11,64],"hand_sk_guarda_azul_front_walk_1":[10,64],"hand_sk_guarda_azul_front_walk_2":[11,64],"hand_sk_guarda_azul_front_walk_3":[11,63],"hand_sk_guarda_azul_back_idle":[41,64],"hand_sk_guarda_azul_back_walk_0":[41,64],"hand_sk_guarda_azul_back_walk_1":[41,63],"hand_sk_guarda_azul_back_walk_2":[41,64],"hand_sk_guarda_azul_back_walk_3":[40,63],"hand_sk_guarda_azul_side_idle":[24,63],"hand_sk_guarda_azul_side_walk_0":[24,64],"hand_sk_guarda_azul_side_walk_1":[24,63],"hand_sk_guarda_azul_side_walk_2":[24,63],"hand_sk_guarda_azul_side_walk_3":[22,63],"hand_sk_guarda_azul_side_walk_4":[22,64],"hand_sk_guarda_azul_side_walk_5":[22,63],"hand_sk_guarda_azul_side_walk_6":[22,63],"hand_sk_guarda_azul_side_walk_7":[24,63],"hand_sk_guardiao_cristal_front_idle":[10,62],"hand_sk_guardiao_cristal_front_walk_0":[10,62],"hand_sk_guardiao_cristal_front_walk_1":[9,61],"hand_sk_guardiao_cristal_front_walk_2":[10,62],"hand_sk_guardiao_cristal_front_walk_3":[10,62],"hand_sk_guardiao_cristal_back_idle":[40,59],"hand_sk_guardiao_cristal_back_walk_0":[40,59],"hand_sk_guardiao_cristal_back_walk_1":[40,59],"hand_sk_guardiao_cristal_back_walk_2":[40,59],"hand_sk_guardiao_cristal_back_walk_3":[42,57],"hand_sk_guardiao_cristal_side_idle":[23,63],"hand_sk_guardiao_cristal_side_walk_0":[24,63],"hand_sk_guardiao_cristal_side_walk_1":[24,63],"hand_sk_guardiao_cristal_side_walk_2":[23,63],"hand_sk_guardiao_cristal_side_walk_3":[25,63],"hand_sk_guardiao_cristal_side_walk_4":[25,63],"hand_sk_guardiao_cristal_side_walk_5":[25,63],"hand_sk_guardiao_cristal_side_walk_6":[24,62],"hand_sk_guardiao_cristal_side_walk_7":[24,63],"hand_sk_guerreiro_tribal_front_idle":[8,61],"hand_sk_guerreiro_tribal_front_walk_0":[8,61],"hand_sk_guerreiro_tribal_front_walk_1":[8,61],"hand_sk_guerreiro_tribal_front_walk_2":[8,61],"hand_sk_guerreiro_tribal_front_walk_3":[9,62],"hand_sk_guerreiro_tribal_back_idle":[37,61],"hand_sk_guerreiro_tribal_back_walk_0":[37,61],"hand_sk_guerreiro_tribal_back_walk_1":[38,61],"hand_sk_guerreiro_tribal_back_walk_2":[37,61],"hand_sk_guerreiro_tribal_back_walk_3":[38,60],"hand_sk_guerreiro_tribal_side_idle":[22,62],"hand_sk_guerreiro_tribal_side_walk_0":[23,63],"hand_sk_guerreiro_tribal_side_walk_1":[23,62],"hand_sk_guerreiro_tribal_side_walk_2":[22,62],"hand_sk_guerreiro_tribal_side_walk_3":[23,62],"hand_sk_guerreiro_tribal_side_walk_4":[23,62],"hand_sk_guerreiro_tribal_side_walk_5":[23,62],"hand_sk_guerreiro_tribal_side_walk_6":[22,61],"hand_sk_guerreiro_tribal_side_walk_7":[23,62],"hand_sk_mecanico_vermelho_front_idle":[10,65],"hand_sk_mecanico_vermelho_front_walk_0":[10,65],"hand_sk_mecanico_vermelho_front_walk_1":[11,65],"hand_sk_mecanico_vermelho_front_walk_2":[10,65],"hand_sk_mecanico_vermelho_front_walk_3":[12,65],"hand_sk_mecanico_vermelho_back_idle":[40,62],"hand_sk_mecanico_vermelho_back_walk_0":[40,62],"hand_sk_mecanico_vermelho_back_walk_1":[40,62],"hand_sk_mecanico_vermelho_back_walk_2":[40,62],"hand_sk_mecanico_vermelho_back_walk_3":[39,62],"hand_sk_mecanico_vermelho_side_idle":[23,61],"hand_sk_mecanico_vermelho_side_walk_0":[24,62],"hand_sk_mecanico_vermelho_side_walk_1":[24,61],"hand_sk_mecanico_vermelho_side_walk_2":[23,61],"hand_sk_mecanico_vermelho_side_walk_3":[22,62],"hand_sk_mecanico_vermelho_side_walk_4":[22,62],"hand_sk_mecanico_vermelho_side_walk_5":[22,62],"hand_sk_mecanico_vermelho_side_walk_6":[21,62],"hand_sk_mecanico_vermelho_side_walk_7":[24,61],"hand_sk_pirata_front_idle":[9,60],"hand_sk_pirata_front_walk_0":[9,60],"hand_sk_pirata_front_walk_1":[10,61],"hand_sk_pirata_front_walk_2":[9,60],"hand_sk_pirata_front_walk_3":[11,60],"hand_sk_pirata_back_idle":[43,61],"hand_sk_pirata_back_walk_0":[43,61],"hand_sk_pirata_back_walk_1":[42,60],"hand_sk_pirata_back_walk_2":[43,61],"hand_sk_pirata_back_walk_3":[43,62],"hand_sk_pirata_side_idle":[41,65],"hand_sk_pirata_side_walk_0":[42,66],"hand_sk_pirata_side_walk_1":[42,66],"hand_sk_pirata_side_walk_2":[41,65],"hand_sk_pirata_side_walk_3":[41,66],"hand_sk_pirata_side_walk_4":[40,65],"hand_sk_pirata_side_walk_5":[41,66],"hand_sk_pirata_side_walk_6":[40,65],"hand_sk_pirata_side_walk_7":[42,66],"hand_sk_pistoleira_front_idle":[15,65],"hand_sk_pistoleira_front_walk_0":[15,65],"hand_sk_pistoleira_front_walk_1":[14,65],"hand_sk_pistoleira_front_walk_2":[15,65],"hand_sk_pistoleira_front_walk_3":[15,65],"hand_sk_pistoleira_back_idle":[49,66],"hand_sk_pistoleira_back_walk_0":[49,66],"hand_sk_pistoleira_back_walk_1":[50,65],"hand_sk_pistoleira_back_walk_2":[49,66],"hand_sk_pistoleira_back_walk_3":[49,65],"hand_sk_pistoleira_side_idle":[34,62],"hand_sk_pistoleira_side_walk_0":[35,63],"hand_sk_pistoleira_side_walk_1":[34,62],"hand_sk_pistoleira_side_walk_2":[34,62],"hand_sk_pistoleira_side_walk_3":[34,62],"hand_sk_pistoleira_side_walk_4":[35,63],"hand_sk_pistoleira_side_walk_5":[34,62],"hand_sk_pistoleira_side_walk_6":[34,61],"hand_sk_pistoleira_side_walk_7":[34,62],"hand_sk_policial_front_idle":[11,57],"hand_sk_policial_front_walk_0":[11,57],"hand_sk_policial_front_walk_1":[13,57],"hand_sk_policial_front_walk_2":[11,57],"hand_sk_policial_front_walk_3":[12,56],"hand_sk_policial_back_idle":[36,58],"hand_sk_policial_back_walk_0":[36,58],"hand_sk_policial_back_walk_1":[37,59],"hand_sk_policial_back_walk_2":[36,58],"hand_sk_policial_back_walk_3":[37,58],"hand_sk_policial_side_idle":[23,62],"hand_sk_policial_side_walk_0":[23,63],"hand_sk_policial_side_walk_1":[23,63],"hand_sk_policial_side_walk_2":[23,62],"hand_sk_policial_side_walk_3":[23,63],"hand_sk_policial_side_walk_4":[23,63],"hand_sk_policial_side_walk_5":[23,63],"hand_sk_policial_side_walk_6":[23,62],"hand_sk_policial_side_walk_7":[23,63],"hand_sk_princesa_front_idle":[16,68],"hand_sk_princesa_front_walk_0":[16,68],"hand_sk_princesa_front_walk_1":[16,69],"hand_sk_princesa_front_walk_2":[16,68],"hand_sk_princesa_front_walk_3":[15,69],"hand_sk_princesa_back_idle":[44,66],"hand_sk_princesa_back_walk_0":[44,66],"hand_sk_princesa_back_walk_1":[44,66],"hand_sk_princesa_back_walk_2":[44,66],"hand_sk_princesa_back_walk_3":[44,66],"hand_sk_princesa_side_idle":[34,57],"hand_sk_princesa_side_walk_0":[34,58],"hand_sk_princesa_side_walk_1":[34,58],"hand_sk_princesa_side_walk_2":[34,57],"hand_sk_princesa_side_walk_3":[33,58],"hand_sk_princesa_side_walk_4":[33,58],"hand_sk_princesa_side_walk_5":[33,58],"hand_sk_princesa_side_walk_6":[33,58],"hand_sk_princesa_side_walk_7":[34,58],"hand_sk_rei_dourado_front_idle":[6,73],"hand_sk_rei_dourado_front_walk_0":[6,73],"hand_sk_rei_dourado_front_walk_1":[6,72],"hand_sk_rei_dourado_front_walk_2":[6,73],"hand_sk_rei_dourado_front_walk_3":[6,73],"hand_sk_rei_dourado_back_idle":[44,64],"hand_sk_rei_dourado_back_walk_0":[44,64],"hand_sk_rei_dourado_back_walk_1":[45,64],"hand_sk_rei_dourado_back_walk_2":[44,64],"hand_sk_rei_dourado_back_walk_3":[45,64],"hand_sk_rei_dourado_side_idle":[38,67],"hand_sk_rei_dourado_side_walk_0":[41,67],"hand_sk_rei_dourado_side_walk_1":[39,67],"hand_sk_rei_dourado_side_walk_2":[38,67],"hand_sk_rei_dourado_side_walk_3":[39,68],"hand_sk_rei_dourado_side_walk_4":[41,68],"hand_sk_rei_dourado_side_walk_5":[39,68],"hand_sk_rei_dourado_side_walk_6":[37,68],"hand_sk_rei_dourado_side_walk_7":[39,67],"hand_sk_rei_mascarado_front_idle":[10,64],"hand_sk_rei_mascarado_front_walk_0":[10,64],"hand_sk_rei_mascarado_front_walk_1":[11,64],"hand_sk_rei_mascarado_front_walk_2":[10,64],"hand_sk_rei_mascarado_front_walk_3":[11,64],"hand_sk_rei_mascarado_back_idle":[36,64],"hand_sk_rei_mascarado_back_walk_0":[36,64],"hand_sk_rei_mascarado_back_walk_1":[37,62],"hand_sk_rei_mascarado_back_walk_2":[36,64],"hand_sk_rei_mascarado_back_walk_3":[37,63],"hand_sk_rei_mascarado_side_idle":[30,60],"hand_sk_rei_mascarado_side_walk_0":[30,61],"hand_sk_rei_mascarado_side_walk_1":[30,61],"hand_sk_rei_mascarado_side_walk_2":[30,60],"hand_sk_rei_mascarado_side_walk_3":[30,60],"hand_sk_rei_mascarado_side_walk_4":[29,61],"hand_sk_rei_mascarado_side_walk_5":[30,60],"hand_sk_rei_mascarado_side_walk_6":[30,59],"hand_sk_rei_mascarado_side_walk_7":[30,61],"hand_sk_samurai_front_idle":[10,61],"hand_sk_samurai_front_walk_0":[10,61],"hand_sk_samurai_front_walk_1":[11,61],"hand_sk_samurai_front_walk_2":[10,61],"hand_sk_samurai_front_walk_3":[11,61],"hand_sk_samurai_back_idle":[35,61],"hand_sk_samurai_back_walk_0":[35,61],"hand_sk_samurai_back_walk_1":[35,61],"hand_sk_samurai_back_walk_2":[35,61],"hand_sk_samurai_back_walk_3":[35,60],"hand_sk_samurai_side_idle":[26,65],"hand_sk_samurai_side_walk_0":[27,66],"hand_sk_samurai_side_walk_1":[26,65],"hand_sk_samurai_side_walk_2":[26,65],"hand_sk_samurai_side_walk_3":[26,65],"hand_sk_samurai_side_walk_4":[27,65],"hand_sk_samurai_side_walk_5":[26,65],"hand_sk_samurai_side_walk_6":[26,64],"hand_sk_samurai_side_walk_7":[26,65],"hand_sk_saqueador_front_idle":[9,59],"hand_sk_saqueador_front_walk_0":[9,59],"hand_sk_saqueador_front_walk_1":[9,58],"hand_sk_saqueador_front_walk_2":[9,59],"hand_sk_saqueador_front_walk_3":[9,58],"hand_sk_saqueador_back_idle":[42,57],"hand_sk_saqueador_back_walk_0":[42,57],"hand_sk_saqueador_back_walk_1":[44,56],"hand_sk_saqueador_back_walk_2":[42,57],"hand_sk_saqueador_back_walk_3":[44,57],"hand_sk_saqueador_side_idle":[22,60],"hand_sk_saqueador_side_walk_0":[22,61],"hand_sk_saqueador_side_walk_1":[22,61],"hand_sk_saqueador_side_walk_2":[22,60],"hand_sk_saqueador_side_walk_3":[21,60],"hand_sk_saqueador_side_walk_4":[22,60],"hand_sk_saqueador_side_walk_5":[21,60],"hand_sk_saqueador_side_walk_6":[21,59],"hand_sk_saqueador_side_walk_7":[22,61],"hand_sk_sombra_tatica_front_idle":[10,62],"hand_sk_sombra_tatica_front_walk_0":[10,62],"hand_sk_sombra_tatica_front_walk_1":[10,62],"hand_sk_sombra_tatica_front_walk_2":[10,62],"hand_sk_sombra_tatica_front_walk_3":[10,62],"hand_sk_sombra_tatica_back_idle":[41,61],"hand_sk_sombra_tatica_back_walk_0":[41,61],"hand_sk_sombra_tatica_back_walk_1":[41,61],"hand_sk_sombra_tatica_back_walk_2":[41,61],"hand_sk_sombra_tatica_back_walk_3":[41,60],"hand_sk_sombra_tatica_side_idle":[22,63],"hand_sk_sombra_tatica_side_walk_0":[23,64],"hand_sk_sombra_tatica_side_walk_1":[22,63],"hand_sk_sombra_tatica_side_walk_2":[22,63],"hand_sk_sombra_tatica_side_walk_3":[22,64],"hand_sk_sombra_tatica_side_walk_4":[22,64],"hand_sk_sombra_tatica_side_walk_5":[22,64],"hand_sk_sombra_tatica_side_walk_6":[21,63],"hand_sk_sombra_tatica_side_walk_7":[22,63],"head_menino_front_idle":[24,0,36],"head_menino_front_walk_0":[24,0,36],"head_menino_front_walk_1":[24,0,37],"head_menino_front_walk_2":[24,0,36],"head_menino_front_walk_3":[24,0,37],"head_menino_back_idle":[22,0,37],"head_menino_back_walk_0":[22,0,37],"head_menino_back_walk_1":[23,0,36],"head_menino_back_walk_2":[22,0,37],"head_menino_back_walk_3":[23,0,37],"head_menino_side_idle":[22,0,37],"head_menino_side_walk_0":[23,0,36],"head_menino_side_walk_1":[22,0,37],"head_menino_side_walk_2":[22,0,37],"head_menino_side_walk_3":[24,0,35],"head_menino_side_walk_4":[24,0,35],"head_menino_side_walk_5":[24,0,35],"head_menino_side_walk_6":[24,0,35],"head_menino_side_walk_7":[22,0,37],"head_menino_swing_front":[25,0,48],"head_menino_swing_up":[33,0,48],"head_menino_swing_side":[23,0,34],"head_menino_negro_front_idle":[24,0,31],"head_menino_negro_front_walk_0":[24,0,31],"head_menino_negro_front_walk_1":[25,0,32],"head_menino_negro_front_walk_2":[24,0,31],"head_menino_negro_front_walk_3":[25,0,31],"head_menino_negro_back_idle":[24,0,32],"head_menino_negro_back_walk_0":[24,0,32],"head_menino_negro_back_walk_1":[24,0,32],"head_menino_negro_back_walk_2":[24,0,32],"head_menino_negro_back_walk_3":[24,0,31],"head_menino_negro_side_idle":[26,0,34],"head_menino_negro_side_walk_0":[26,0,34],"head_menino_negro_side_walk_1":[26,0,34],"head_menino_negro_side_walk_2":[26,0,34],"head_menino_negro_side_walk_3":[31,0,34],"head_menino_negro_side_walk_4":[31,0,34],"head_menino_negro_side_walk_5":[31,0,34],"head_menino_negro_side_walk_6":[31,0,34],"head_menino_negro_side_walk_7":[26,0,34],"head_menino_negro_swing_front":[23,0,45],"head_menino_negro_swing_up":[33,0,45],"head_menino_negro_swing_side":[25,0,39],"head_menina_ruiva_front_idle":[24,1,32],"head_menina_ruiva_front_walk_0":[24,1,32],"head_menina_ruiva_front_walk_1":[25,0,33],"head_menina_ruiva_front_walk_2":[24,1,32],"head_menina_ruiva_front_walk_3":[26,0,32],"head_menina_ruiva_back_idle":[22,0,32],"head_menina_ruiva_back_walk_0":[22,0,32],"head_menina_ruiva_back_walk_1":[23,0,32],"head_menina_ruiva_back_walk_2":[22,0,32],"head_menina_ruiva_back_walk_3":[24,0,32],"head_menina_ruiva_side_idle":[30,0,43],"head_menina_ruiva_side_walk_0":[31,0,42],"head_menina_ruiva_side_walk_1":[30,0,43],"head_menina_ruiva_side_walk_2":[30,0,43],"head_menina_ruiva_side_walk_3":[31,0,43],"head_menina_ruiva_side_walk_4":[31,0,41],"head_menina_ruiva_side_walk_5":[31,0,43],"head_menina_ruiva_side_walk_6":[31,0,43],"head_menina_ruiva_side_walk_7":[30,0,43],"head_menina_ruiva_swing_front":[23,0,44],"head_menina_ruiva_swing_up":[34,0,46],"head_menina_ruiva_swing_side":[33,0,45],"head_menina_negra_front_idle":[30,0,56],"head_menina_negra_front_walk_0":[30,0,56],"head_menina_negra_front_walk_1":[30,0,56],"head_menina_negra_front_walk_2":[30,0,56],"head_menina_negra_front_walk_3":[30,0,56],"head_menina_negra_back_idle":[29,0,56],"head_menina_negra_back_walk_0":[29,0,56],"head_menina_negra_back_walk_1":[30,0,56],"head_menina_negra_back_walk_2":[29,0,56],"head_menina_negra_back_walk_3":[30,0,56],"head_menina_negra_side_idle":[24,0,46],"head_menina_negra_side_walk_0":[24,0,46],"head_menina_negra_side_walk_1":[24,0,46],"head_menina_negra_side_walk_2":[24,0,46],"head_menina_negra_side_walk_3":[24,0,46],"head_menina_negra_side_walk_4":[24,0,46],"head_menina_negra_side_walk_5":[24,0,46],"head_menina_negra_side_walk_6":[24,0,46],"head_menina_negra_side_walk_7":[24,0,46],"head_menina_negra_swing_front":[29,1,57],"head_menina_negra_swing_up":[28,0,57],"head_menina_negra_swing_side":[22,0,44],"head_sk_arqueira_mata_front_idle":[25,0,14],"head_sk_arqueira_mata_front_walk_0":[25,0,14],"head_sk_arqueira_mata_front_walk_1":[24,0,15],"head_sk_arqueira_mata_front_walk_2":[25,0,14],"head_sk_arqueira_mata_front_walk_3":[24,0,15],"head_sk_arqueira_mata_back_idle":[24,0,20],"head_sk_arqueira_mata_back_walk_0":[24,0,20],"head_sk_arqueira_mata_back_walk_1":[24,0,21],"head_sk_arqueira_mata_back_walk_2":[24,0,20],"head_sk_arqueira_mata_back_walk_3":[24,0,21],"head_sk_arqueira_mata_side_idle":[22,0,20],"head_sk_arqueira_mata_side_walk_0":[22,0,19],"head_sk_arqueira_mata_side_walk_1":[22,0,20],"head_sk_arqueira_mata_side_walk_2":[22,0,20],"head_sk_arqueira_mata_side_walk_3":[22,0,20],"head_sk_arqueira_mata_side_walk_4":[22,0,20],"head_sk_arqueira_mata_side_walk_5":[22,0,20],"head_sk_arqueira_mata_side_walk_6":[22,0,20],"head_sk_arqueira_mata_side_walk_7":[22,0,20],"head_sk_arqueira_mata_swing_front":[37,0,65],"head_sk_arqueira_mata_swing_up":[35,0,62],"head_sk_arqueira_mata_swing_side":[22,0,19],"head_sk_arqueiro_mata_front_idle":[24,1,14],"head_sk_arqueiro_mata_front_walk_0":[24,1,14],"head_sk_arqueiro_mata_front_walk_1":[23,0,15],"head_sk_arqueiro_mata_front_walk_2":[24,1,14],"head_sk_arqueiro_mata_front_walk_3":[25,1,15],"head_sk_arqueiro_mata_back_idle":[24,0,20],"head_sk_arqueiro_mata_back_walk_0":[24,0,20],"head_sk_arqueiro_mata_back_walk_1":[24,0,21],"head_sk_arqueiro_mata_back_walk_2":[24,0,20],"head_sk_arqueiro_mata_back_walk_3":[24,0,21],"head_sk_arqueiro_mata_side_idle":[22,0,19],"head_sk_arqueiro_mata_side_walk_0":[22,0,19],"head_sk_arqueiro_mata_side_walk_1":[22,0,19],"head_sk_arqueiro_mata_side_walk_2":[22,0,19],"head_sk_arqueiro_mata_side_walk_3":[22,0,19],"head_sk_arqueiro_mata_side_walk_4":[22,1,19],"head_sk_arqueiro_mata_side_walk_5":[22,0,19],"head_sk_arqueiro_mata_side_walk_6":[22,0,19],"head_sk_arqueiro_mata_side_walk_7":[22,0,19],"head_sk_arqueiro_mata_swing_front":[36,0,64],"head_sk_arqueiro_mata_swing_up":[35,0,62],"head_sk_arqueiro_mata_swing_side":[22,0,18],"head_sk_cacadora_front_idle":[26,0,21],"head_sk_cacadora_front_walk_0":[26,0,21],"head_sk_cacadora_front_walk_1":[25,0,20],"head_sk_cacadora_front_walk_2":[26,0,21],"head_sk_cacadora_front_walk_3":[25,0,21],"head_sk_cacadora_back_idle":[24,0,19],"head_sk_cacadora_back_walk_0":[24,0,19],"head_sk_cacadora_back_walk_1":[24,0,18],"head_sk_cacadora_back_walk_2":[24,0,19],"head_sk_cacadora_back_walk_3":[25,0,18],"head_sk_cacadora_side_idle":[27,0,20],"head_sk_cacadora_side_walk_0":[27,0,20],"head_sk_cacadora_side_walk_1":[27,0,20],"head_sk_cacadora_side_walk_2":[27,0,20],"head_sk_cacadora_side_walk_3":[27,0,20],"head_sk_cacadora_side_walk_4":[27,0,20],"head_sk_cacadora_side_walk_5":[27,0,20],"head_sk_cacadora_side_walk_6":[27,0,20],"head_sk_cacadora_side_walk_7":[27,0,20],"head_sk_cacadora_swing_front":[35,0,62],"head_sk_cacadora_swing_up":[34,0,62],"head_sk_cacadora_swing_side":[21,0,19],"head_sk_cacique_front_idle":[25,0,28],"head_sk_cacique_front_walk_0":[25,0,28],"head_sk_cacique_front_walk_1":[25,0,28],"head_sk_cacique_front_walk_2":[25,0,28],"head_sk_cacique_front_walk_3":[25,0,29],"head_sk_cacique_back_idle":[24,0,21],"head_sk_cacique_back_walk_0":[24,0,21],"head_sk_cacique_back_walk_1":[24,0,21],"head_sk_cacique_back_walk_2":[24,0,21],"head_sk_cacique_back_walk_3":[25,0,22],"head_sk_cacique_side_idle":[19,0,26],"head_sk_cacique_side_walk_0":[19,0,26],"head_sk_cacique_side_walk_1":[19,0,26],"head_sk_cacique_side_walk_2":[19,0,26],"head_sk_cacique_side_walk_3":[19,0,26],"head_sk_cacique_side_walk_4":[19,0,26],"head_sk_cacique_side_walk_5":[19,0,26],"head_sk_cacique_side_walk_6":[19,0,26],"head_sk_cacique_side_walk_7":[19,0,26],"head_sk_cacique_swing_front":[36,0,64],"head_sk_cacique_swing_up":[35,0,62],"head_sk_cacique_swing_side":[18,0,25],"head_sk_carrasco_front_idle":[22,0,42],"head_sk_carrasco_front_walk_0":[22,0,42],"head_sk_carrasco_front_walk_1":[22,0,42],"head_sk_carrasco_front_walk_2":[22,0,42],"head_sk_carrasco_front_walk_3":[22,0,42],"head_sk_carrasco_back_idle":[34,0,26],"head_sk_carrasco_back_walk_0":[34,0,26],"head_sk_carrasco_back_walk_1":[32,0,26],"head_sk_carrasco_back_walk_2":[34,0,26],"head_sk_carrasco_back_walk_3":[32,0,26],"head_sk_carrasco_side_idle":[24,0,46],"head_sk_carrasco_side_walk_0":[24,0,46],"head_sk_carrasco_side_walk_1":[24,0,46],"head_sk_carrasco_side_walk_2":[24,0,46],"head_sk_carrasco_side_walk_3":[18,0,36],"head_sk_carrasco_side_walk_4":[18,0,36],"head_sk_carrasco_side_walk_5":[18,0,36],"head_sk_carrasco_side_walk_6":[18,0,36],"head_sk_carrasco_side_walk_7":[24,0,46],"head_sk_carrasco_swing_front":[41,0,71],"head_sk_carrasco_swing_up":[38,1,69],"head_sk_carrasco_swing_side":[23,0,47],"head_sk_ceifador_front_idle":[28,0,17],"head_sk_ceifador_front_walk_0":[28,0,17],"head_sk_ceifador_front_walk_1":[27,0,17],"head_sk_ceifador_front_walk_2":[28,0,17],"head_sk_ceifador_front_walk_3":[28,0,17],"head_sk_ceifador_back_idle":[24,0,16],"head_sk_ceifador_back_walk_0":[24,0,16],"head_sk_ceifador_back_walk_1":[25,0,16],"head_sk_ceifador_back_walk_2":[24,0,16],"head_sk_ceifador_back_walk_3":[25,0,16],"head_sk_ceifador_side_idle":[28,0,17],"head_sk_ceifador_side_walk_0":[28,0,17],"head_sk_ceifador_side_walk_1":[28,0,17],"head_sk_ceifador_side_walk_2":[28,0,17],"head_sk_ceifador_side_walk_3":[27,0,17],"head_sk_ceifador_side_walk_4":[27,0,17],"head_sk_ceifador_side_walk_5":[27,0,17],"head_sk_ceifador_side_walk_6":[27,0,17],"head_sk_ceifador_side_walk_7":[28,0,17],"head_sk_ceifador_swing_front":[38,0,62],"head_sk_ceifador_swing_up":[36,0,61],"head_sk_ceifador_swing_side":[28,0,17],"head_sk_ciberpiloto_front_idle":[30,0,16],"head_sk_ciberpiloto_front_walk_0":[30,0,16],"head_sk_ciberpiloto_front_walk_1":[29,0,15],"head_sk_ciberpiloto_front_walk_2":[30,0,16],"head_sk_ciberpiloto_front_walk_3":[30,0,16],"head_sk_ciberpiloto_back_idle":[23,0,15],"head_sk_ciberpiloto_back_walk_0":[23,0,15],"head_sk_ciberpiloto_back_walk_1":[24,0,14],"head_sk_ciberpiloto_back_walk_2":[23,0,15],"head_sk_ciberpiloto_back_walk_3":[24,0,15],"head_sk_ciberpiloto_side_idle":[18,0,22],"head_sk_ciberpiloto_side_walk_0":[18,0,22],"head_sk_ciberpiloto_side_walk_1":[18,0,22],"head_sk_ciberpiloto_side_walk_2":[18,0,22],"head_sk_ciberpiloto_side_walk_3":[18,0,23],"head_sk_ciberpiloto_side_walk_4":[18,0,23],"head_sk_ciberpiloto_side_walk_5":[18,0,23],"head_sk_ciberpiloto_side_walk_6":[18,0,23],"head_sk_ciberpiloto_side_walk_7":[18,0,22],"head_sk_ciberpiloto_swing_front":[36,0,62],"head_sk_ciberpiloto_swing_up":[35,0,60],"head_sk_ciberpiloto_swing_side":[18,0,22],"head_sk_cowboy_caveira_front_idle":[26,0,25],"head_sk_cowboy_caveira_front_walk_0":[26,0,25],"head_sk_cowboy_caveira_front_walk_1":[26,0,25],"head_sk_cowboy_caveira_front_walk_2":[26,0,25],"head_sk_cowboy_caveira_front_walk_3":[26,0,25],"head_sk_cowboy_caveira_back_idle":[23,0,23],"head_sk_cowboy_caveira_back_walk_0":[23,0,23],"head_sk_cowboy_caveira_back_walk_1":[24,0,24],"head_sk_cowboy_caveira_back_walk_2":[23,0,23],"head_sk_cowboy_caveira_back_walk_3":[24,0,23],"head_sk_cowboy_caveira_side_idle":[31,0,22],"head_sk_cowboy_caveira_side_walk_0":[31,0,22],"head_sk_cowboy_caveira_side_walk_1":[31,0,22],"head_sk_cowboy_caveira_side_walk_2":[31,0,22],"head_sk_cowboy_caveira_side_walk_3":[31,0,22],"head_sk_cowboy_caveira_side_walk_4":[31,0,22],"head_sk_cowboy_caveira_side_walk_5":[31,0,22],"head_sk_cowboy_caveira_side_walk_6":[31,0,22],"head_sk_cowboy_caveira_side_walk_7":[31,0,22],"head_sk_cowboy_caveira_swing_front":[36,0,62],"head_sk_cowboy_caveira_swing_up":[36,0,62],"head_sk_cowboy_caveira_swing_side":[31,0,22],"head_sk_espectro_front_idle":[36,0,17],"head_sk_espectro_front_walk_0":[36,0,17],"head_sk_espectro_front_walk_1":[33,0,17],"head_sk_espectro_front_walk_2":[36,0,17],"head_sk_espectro_front_walk_3":[33,0,16],"head_sk_espectro_back_idle":[30,0,17],"head_sk_espectro_back_walk_0":[30,0,17],"head_sk_espectro_back_walk_1":[31,0,16],"head_sk_espectro_back_walk_2":[30,0,17],"head_sk_espectro_back_walk_3":[31,0,16],"head_sk_espectro_side_idle":[41,0,18],"head_sk_espectro_side_walk_0":[41,0,18],"head_sk_espectro_side_walk_1":[41,0,18],"head_sk_espectro_side_walk_2":[41,0,18],"head_sk_espectro_side_walk_3":[41,0,18],"head_sk_espectro_side_walk_4":[41,0,18],"head_sk_espectro_side_walk_5":[41,0,18],"head_sk_espectro_side_walk_6":[41,0,18],"head_sk_espectro_side_walk_7":[41,0,18],"head_sk_espectro_swing_front":[37,0,63],"head_sk_espectro_swing_up":[35,0,61],"head_sk_espectro_swing_side":[41,0,18],"head_sk_exploradora_front_idle":[27,0,24],"head_sk_exploradora_front_walk_0":[27,0,24],"head_sk_exploradora_front_walk_1":[27,0,25],"head_sk_exploradora_front_walk_2":[27,0,24],"head_sk_exploradora_front_walk_3":[27,0,25],"head_sk_exploradora_back_idle":[28,1,24],"head_sk_exploradora_back_walk_0":[28,1,24],"head_sk_exploradora_back_walk_1":[28,0,24],"head_sk_exploradora_back_walk_2":[28,1,24],"head_sk_exploradora_back_walk_3":[29,0,24],"head_sk_exploradora_side_idle":[22,0,26],"head_sk_exploradora_side_walk_0":[22,0,26],"head_sk_exploradora_side_walk_1":[22,0,26],"head_sk_exploradora_side_walk_2":[22,0,26],"head_sk_exploradora_side_walk_3":[22,0,25],"head_sk_exploradora_side_walk_4":[22,0,25],"head_sk_exploradora_side_walk_5":[22,0,25],"head_sk_exploradora_side_walk_6":[22,0,25],"head_sk_exploradora_side_walk_7":[22,0,26],"head_sk_exploradora_swing_front":[40,1,70],"head_sk_exploradora_swing_up":[38,0,69],"head_sk_exploradora_swing_side":[22,0,26],"head_sk_guarda_azul_front_idle":[26,0,27],"head_sk_guarda_azul_front_walk_0":[26,0,27],"head_sk_guarda_azul_front_walk_1":[26,1,26],"head_sk_guarda_azul_front_walk_2":[26,0,27],"head_sk_guarda_azul_front_walk_3":[26,1,26],"head_sk_guarda_azul_back_idle":[26,0,26],"head_sk_guarda_azul_back_walk_0":[26,0,26],"head_sk_guarda_azul_back_walk_1":[26,0,26],"head_sk_guarda_azul_back_walk_2":[26,0,26],"head_sk_guarda_azul_back_walk_3":[26,0,26],"head_sk_guarda_azul_side_idle":[24,0,27],"head_sk_guarda_azul_side_walk_0":[24,0,27],"head_sk_guarda_azul_side_walk_1":[24,0,27],"head_sk_guarda_azul_side_walk_2":[24,0,27],"head_sk_guarda_azul_side_walk_3":[22,0,28],"head_sk_guarda_azul_side_walk_4":[22,1,26],"head_sk_guarda_azul_side_walk_5":[22,0,28],"head_sk_guarda_azul_side_walk_6":[22,0,28],"head_sk_guarda_azul_side_walk_7":[24,0,27],"head_sk_guarda_azul_swing_front":[37,0,63],"head_sk_guarda_azul_swing_up":[36,0,63],"head_sk_guarda_azul_swing_side":[21,1,25],"head_sk_guardiao_cristal_front_idle":[26,0,22],"head_sk_guardiao_cristal_front_walk_0":[26,0,22],"head_sk_guardiao_cristal_front_walk_1":[25,0,21],"head_sk_guardiao_cristal_front_walk_2":[26,0,22],"head_sk_guardiao_cristal_front_walk_3":[25,0,21],"head_sk_guardiao_cristal_back_idle":[25,0,20],"head_sk_guardiao_cristal_back_walk_0":[25,0,20],"head_sk_guardiao_cristal_back_walk_1":[25,0,20],"head_sk_guardiao_cristal_back_walk_2":[25,0,20],"head_sk_guardiao_cristal_back_walk_3":[26,0,20],"head_sk_guardiao_cristal_side_idle":[22,0,20],"head_sk_guardiao_cristal_side_walk_0":[22,0,20],"head_sk_guardiao_cristal_side_walk_1":[22,0,20],"head_sk_guardiao_cristal_side_walk_2":[22,0,20],"head_sk_guardiao_cristal_side_walk_3":[23,0,22],"head_sk_guardiao_cristal_side_walk_4":[22,0,21],"head_sk_guardiao_cristal_side_walk_5":[23,0,22],"head_sk_guardiao_cristal_side_walk_6":[23,0,22],"head_sk_guardiao_cristal_side_walk_7":[22,0,20],"head_sk_guardiao_cristal_swing_front":[35,0,62],"head_sk_guardiao_cristal_swing_up":[34,0,61],"head_sk_guardiao_cristal_swing_side":[22,0,20],"head_sk_guerreiro_tribal_front_idle":[24,0,11],"head_sk_guerreiro_tribal_front_walk_0":[24,0,11],"head_sk_guerreiro_tribal_front_walk_1":[24,0,11],"head_sk_guerreiro_tribal_front_walk_2":[24,0,11],"head_sk_guerreiro_tribal_front_walk_3":[25,0,11],"head_sk_guerreiro_tribal_back_idle":[24,0,15],"head_sk_guerreiro_tribal_back_walk_0":[24,0,15],"head_sk_guerreiro_tribal_back_walk_1":[25,0,14],"head_sk_guerreiro_tribal_back_walk_2":[24,0,15],"head_sk_guerreiro_tribal_back_walk_3":[25,0,13],"head_sk_guerreiro_tribal_side_idle":[18,0,27],"head_sk_guerreiro_tribal_side_walk_0":[18,0,25],"head_sk_guerreiro_tribal_side_walk_1":[18,0,27],"head_sk_guerreiro_tribal_side_walk_2":[18,0,27],"head_sk_guerreiro_tribal_side_walk_3":[17,0,27],"head_sk_guerreiro_tribal_side_walk_4":[18,0,26],"head_sk_guerreiro_tribal_side_walk_5":[17,0,27],"head_sk_guerreiro_tribal_side_walk_6":[17,0,27],"head_sk_guerreiro_tribal_side_walk_7":[18,0,27],"head_sk_guerreiro_tribal_swing_front":[36,0,64],"head_sk_guerreiro_tribal_swing_up":[35,0,62],"head_sk_guerreiro_tribal_swing_side":[18,0,25],"head_sk_mecanico_vermelho_front_idle":[25,0,25],"head_sk_mecanico_vermelho_front_walk_0":[25,0,25],"head_sk_mecanico_vermelho_front_walk_1":[25,0,25],"head_sk_mecanico_vermelho_front_walk_2":[25,0,25],"head_sk_mecanico_vermelho_front_walk_3":[27,0,26],"head_sk_mecanico_vermelho_back_idle":[25,0,25],"head_sk_mecanico_vermelho_back_walk_0":[25,0,25],"head_sk_mecanico_vermelho_back_walk_1":[25,0,25],"head_sk_mecanico_vermelho_back_walk_2":[25,0,25],"head_sk_mecanico_vermelho_back_walk_3":[25,0,25],"head_sk_mecanico_vermelho_side_idle":[24,0,26],"head_sk_mecanico_vermelho_side_walk_0":[24,0,26],"head_sk_mecanico_vermelho_side_walk_1":[24,0,26],"head_sk_mecanico_vermelho_side_walk_2":[24,0,26],"head_sk_mecanico_vermelho_side_walk_3":[22,0,26],"head_sk_mecanico_vermelho_side_walk_4":[22,0,26],"head_sk_mecanico_vermelho_side_walk_5":[22,0,26],"head_sk_mecanico_vermelho_side_walk_6":[22,0,26],"head_sk_mecanico_vermelho_side_walk_7":[24,0,26],"head_sk_mecanico_vermelho_swing_front":[36,0,63],"head_sk_mecanico_vermelho_swing_up":[36,0,62],"head_sk_mecanico_vermelho_swing_side":[21,0,25],"head_sk_pirata_front_idle":[27,0,27],"head_sk_pirata_front_walk_0":[27,0,27],"head_sk_pirata_front_walk_1":[28,0,25],"head_sk_pirata_front_walk_2":[27,0,27],"head_sk_pirata_front_walk_3":[29,0,26],"head_sk_pirata_back_idle":[28,0,30],"head_sk_pirata_back_walk_0":[28,0,30],"head_sk_pirata_back_walk_1":[26,1,28],"head_sk_pirata_back_walk_2":[28,0,30],"head_sk_pirata_back_walk_3":[26,1,28],"head_sk_pirata_side_idle":[36,0,23],"head_sk_pirata_side_walk_0":[36,1,19],"head_sk_pirata_side_walk_1":[36,0,23],"head_sk_pirata_side_walk_2":[36,0,23],"head_sk_pirata_side_walk_3":[36,0,22],"head_sk_pirata_side_walk_4":[36,0,22],"head_sk_pirata_side_walk_5":[36,0,22],"head_sk_pirata_side_walk_6":[36,0,22],"head_sk_pirata_side_walk_7":[36,0,23],"head_sk_pirata_swing_front":[36,1,62],"head_sk_pirata_swing_up":[35,1,62],"head_sk_pirata_swing_side":[19,1,19],"head_sk_pistoleira_front_idle":[32,0,18],"head_sk_pistoleira_front_walk_0":[32,0,18],"head_sk_pistoleira_front_walk_1":[31,0,18],"head_sk_pistoleira_front_walk_2":[32,0,18],"head_sk_pistoleira_front_walk_3":[31,0,17],"head_sk_pistoleira_back_idle":[33,2,17],"head_sk_pistoleira_back_walk_0":[33,2,17],"head_sk_pistoleira_back_walk_1":[34,1,17],"head_sk_pistoleira_back_walk_2":[33,2,17],"head_sk_pistoleira_back_walk_3":[34,1,17],"head_sk_pistoleira_side_idle":[31,0,26],"head_sk_pistoleira_side_walk_0":[31,0,26],"head_sk_pistoleira_side_walk_1":[31,0,26],"head_sk_pistoleira_side_walk_2":[31,0,26],"head_sk_pistoleira_side_walk_3":[31,0,26],"head_sk_pistoleira_side_walk_4":[31,0,25],"head_sk_pistoleira_side_walk_5":[31,0,26],"head_sk_pistoleira_side_walk_6":[31,0,26],"head_sk_pistoleira_side_walk_7":[31,0,26],"head_sk_pistoleira_swing_front":[37,0,62],"head_sk_pistoleira_swing_up":[35,0,62],"head_sk_pistoleira_swing_side":[31,0,26],"head_sk_policial_front_idle":[28,1,15],"head_sk_policial_front_walk_0":[28,1,15],"head_sk_policial_front_walk_1":[29,0,14],"head_sk_policial_front_walk_2":[28,1,15],"head_sk_policial_front_walk_3":[29,1,15],"head_sk_policial_back_idle":[23,0,13],"head_sk_policial_back_walk_0":[23,0,13],"head_sk_policial_back_walk_1":[24,0,14],"head_sk_policial_back_walk_2":[23,0,13],"head_sk_policial_back_walk_3":[25,1,14],"head_sk_policial_side_idle":[19,0,21],"head_sk_policial_side_walk_0":[19,0,20],"head_sk_policial_side_walk_1":[19,0,21],"head_sk_policial_side_walk_2":[19,0,21],"head_sk_policial_side_walk_3":[19,0,20],"head_sk_policial_side_walk_4":[19,0,20],"head_sk_policial_side_walk_5":[19,0,20],"head_sk_policial_side_walk_6":[19,0,20],"head_sk_policial_side_walk_7":[19,0,21],"head_sk_policial_swing_front":[35,0,61],"head_sk_policial_swing_up":[34,0,59],"head_sk_policial_swing_side":[19,0,21],"head_sk_princesa_front_idle":[29,0,21],"head_sk_princesa_front_walk_0":[29,0,21],"head_sk_princesa_front_walk_1":[28,0,21],"head_sk_princesa_front_walk_2":[29,0,21],"head_sk_princesa_front_walk_3":[29,0,21],"head_sk_princesa_back_idle":[32,0,21],"head_sk_princesa_back_walk_0":[32,0,21],"head_sk_princesa_back_walk_1":[32,0,20],"head_sk_princesa_back_walk_2":[32,0,21],"head_sk_princesa_back_walk_3":[33,0,20],"head_sk_princesa_side_idle":[31,0,22],"head_sk_princesa_side_walk_0":[31,0,20],"head_sk_princesa_side_walk_1":[31,0,22],"head_sk_princesa_side_walk_2":[31,0,22],"head_sk_princesa_side_walk_3":[30,0,21],"head_sk_princesa_side_walk_4":[30,0,21],"head_sk_princesa_side_walk_5":[30,0,21],"head_sk_princesa_side_walk_6":[30,0,21],"head_sk_princesa_side_walk_7":[31,0,22],"head_sk_princesa_swing_front":[36,0,62],"head_sk_princesa_swing_up":[35,0,60],"head_sk_princesa_swing_side":[29,1,21],"head_sk_rei_dourado_front_idle":[30,0,14],"head_sk_rei_dourado_front_walk_0":[30,0,14],"head_sk_rei_dourado_front_walk_1":[31,0,14],"head_sk_rei_dourado_front_walk_2":[30,0,14],"head_sk_rei_dourado_front_walk_3":[31,0,14],"head_sk_rei_dourado_back_idle":[30,0,16],"head_sk_rei_dourado_back_walk_0":[30,0,16],"head_sk_rei_dourado_back_walk_1":[30,0,16],"head_sk_rei_dourado_back_walk_2":[30,0,16],"head_sk_rei_dourado_back_walk_3":[31,0,16],"head_sk_rei_dourado_side_idle":[33,0,17],"head_sk_rei_dourado_side_walk_0":[33,0,17],"head_sk_rei_dourado_side_walk_1":[33,0,17],"head_sk_rei_dourado_side_walk_2":[33,0,17],"head_sk_rei_dourado_side_walk_3":[33,0,17],"head_sk_rei_dourado_side_walk_4":[33,1,18],"head_sk_rei_dourado_side_walk_5":[33,0,17],"head_sk_rei_dourado_side_walk_6":[33,0,17],"head_sk_rei_dourado_side_walk_7":[33,0,17],"head_sk_rei_dourado_swing_front":[36,0,63],"head_sk_rei_dourado_swing_up":[35,1,61],"head_sk_rei_dourado_swing_side":[34,0,16],"head_sk_rei_mascarado_front_idle":[29,0,15],"head_sk_rei_mascarado_front_walk_0":[29,0,15],"head_sk_rei_mascarado_front_walk_1":[30,0,16],"head_sk_rei_mascarado_front_walk_2":[29,0,15],"head_sk_rei_mascarado_front_walk_3":[29,0,15],"head_sk_rei_mascarado_back_idle":[23,1,16],"head_sk_rei_mascarado_back_walk_0":[23,1,16],"head_sk_rei_mascarado_back_walk_1":[23,0,16],"head_sk_rei_mascarado_back_walk_2":[23,1,16],"head_sk_rei_mascarado_back_walk_3":[24,0,16],"head_sk_rei_mascarado_side_idle":[30,0,17],"head_sk_rei_mascarado_side_walk_0":[30,0,16],"head_sk_rei_mascarado_side_walk_1":[30,0,17],"head_sk_rei_mascarado_side_walk_2":[30,0,17],"head_sk_rei_mascarado_side_walk_3":[30,0,17],"head_sk_rei_mascarado_side_walk_4":[30,0,17],"head_sk_rei_mascarado_side_walk_5":[30,0,17],"head_sk_rei_mascarado_side_walk_6":[30,0,17],"head_sk_rei_mascarado_side_walk_7":[30,0,17],"head_sk_rei_mascarado_swing_front":[36,1,62],"head_sk_rei_mascarado_swing_up":[35,0,61],"head_sk_rei_mascarado_swing_side":[30,0,16],"head_sk_samurai_front_idle":[23,0,20],"head_sk_samurai_front_walk_0":[23,0,20],"head_sk_samurai_front_walk_1":[24,0,20],"head_sk_samurai_front_walk_2":[23,0,20],"head_sk_samurai_front_walk_3":[24,0,20],"head_sk_samurai_back_idle":[23,0,20],"head_sk_samurai_back_walk_0":[23,0,20],"head_sk_samurai_back_walk_1":[23,0,20],"head_sk_samurai_back_walk_2":[23,0,20],"head_sk_samurai_back_walk_3":[23,0,21],"head_sk_samurai_side_idle":[23,0,17],"head_sk_samurai_side_walk_0":[23,0,17],"head_sk_samurai_side_walk_1":[23,0,17],"head_sk_samurai_side_walk_2":[23,0,17],"head_sk_samurai_side_walk_3":[24,0,18],"head_sk_samurai_side_walk_4":[24,0,18],"head_sk_samurai_side_walk_5":[24,0,18],"head_sk_samurai_side_walk_6":[24,0,18],"head_sk_samurai_side_walk_7":[23,0,17],"head_sk_samurai_swing_front":[35,1,61],"head_sk_samurai_swing_up":[34,0,62],"head_sk_samurai_swing_side":[23,0,17],"head_sk_saqueador_front_idle":[27,0,17],"head_sk_saqueador_front_walk_0":[27,0,17],"head_sk_saqueador_front_walk_1":[27,1,16],"head_sk_saqueador_front_walk_2":[27,0,17],"head_sk_saqueador_front_walk_3":[27,1,17],"head_sk_saqueador_back_idle":[29,0,16],"head_sk_saqueador_back_walk_0":[29,0,16],"head_sk_saqueador_back_walk_1":[29,0,16],"head_sk_saqueador_back_walk_2":[29,0,16],"head_sk_saqueador_back_walk_3":[29,0,16],"head_sk_saqueador_side_idle":[20,0,21],"head_sk_saqueador_side_walk_0":[21,1,21],"head_sk_saqueador_side_walk_1":[20,0,21],"head_sk_saqueador_side_walk_2":[20,0,21],"head_sk_saqueador_side_walk_3":[20,0,21],"head_sk_saqueador_side_walk_4":[21,1,21],"head_sk_saqueador_side_walk_5":[20,0,21],"head_sk_saqueador_side_walk_6":[20,0,21],"head_sk_saqueador_side_walk_7":[20,0,21],"head_sk_saqueador_swing_front":[35,1,61],"head_sk_saqueador_swing_up":[34,1,62],"head_sk_saqueador_swing_side":[21,1,20],"head_sk_sombra_tatica_front_idle":[26,0,26],"head_sk_sombra_tatica_front_walk_0":[26,0,26],"head_sk_sombra_tatica_front_walk_1":[25,0,25],"head_sk_sombra_tatica_front_walk_2":[26,0,26],"head_sk_sombra_tatica_front_walk_3":[26,0,26],"head_sk_sombra_tatica_back_idle":[25,0,25],"head_sk_sombra_tatica_back_walk_0":[25,0,25],"head_sk_sombra_tatica_back_walk_1":[25,0,25],"head_sk_sombra_tatica_back_walk_2":[25,0,25],"head_sk_sombra_tatica_back_walk_3":[26,0,26],"head_sk_sombra_tatica_side_idle":[22,0,26],"head_sk_sombra_tatica_side_walk_0":[22,0,26],"head_sk_sombra_tatica_side_walk_1":[22,0,26],"head_sk_sombra_tatica_side_walk_2":[22,0,26],"head_sk_sombra_tatica_side_walk_3":[21,0,25],"head_sk_sombra_tatica_side_walk_4":[21,0,25],"head_sk_sombra_tatica_side_walk_5":[21,0,25],"head_sk_sombra_tatica_side_walk_6":[21,0,25],"head_sk_sombra_tatica_side_walk_7":[22,0,26],"head_sk_sombra_tatica_swing_front":[37,0,64],"head_sk_sombra_tatica_swing_up":[36,0,63],"head_sk_sombra_tatica_swing_side":[21,0,25],"grip_picareta":[14.7,38.7,46.5,6.5,6.6,46.6],"grip_machado":[12.9,34.5,49.3,6.1,6.1,44.9],"grip_enxada":[31.0,14.0,10.2,50.4,39.1,6.4],"grip_espada":[16.7,37.8,52.8,0.8,7.2,47.8],"grip_rede":[14.5,38.1,48.5,5.4,6.2,46.9]}/*FIM_ATLAS*/;
  let art = null;
  const iconURL = {};
  (function loadArt() {
    const img = new Image();
    img.onload = () => { art = img; buildIconURLs(); invDirty = true; };
    // se a pasta assets não foi enviada, tenta o arquivo solto na raiz do site
    img.onerror = () => { if (!img.dataset.raiz) { img.dataset.raiz = 1; img.src = 'atlas.webp'; } };
    img.src = window.TERRA_ATLAS || 'assets/atlas.webp';
  })();
  function artRect(name) { return art && ATLAS[name]; }
  // Segundo atlas: muros, torres, casas, fortalezas e móveis (tools/build_structures.py)
  const ATLAS2 = /*ATLAS2_MAP*/{"forte_muralha_chao":[0,0,760,651],"forte_muralha_fundo":[762,0,760,651],"forte_muralha_frente":[0,653,760,651],"forte_forte_cidade_fundo":[762,653,760,384],"forte_forte_cidade_frente":[0,1306,760,384],"forte_colonia_fundo":[762,1306,760,378],"forte_colonia_frente":[0,1692,760,378],"forte_forte_fundo":[762,1692,760,354],"forte_forte_frente":[0,2072,760,354],"forte_campo_fundo":[762,2072,760,341],"forte_campo_frente":[0,2428,760,341],"casa_cabana":[762,2428,340,310],"casa_saloon":[1104,2428,340,304],"casa_pedra":[1446,2428,340,302],"casa_castelo":[0,2771,340,295],"casa_tribal":[342,2771,340,289],"casa_castelo_dentro":[684,2771,340,278],"casa_tribal_dentro":[1026,2771,340,275],"casa_cabana_dentro":[1368,2771,340,274],"casa_saloon_dentro":[0,3068,340,274],"casa_domo":[342,3068,340,268],"casa_domo_dentro":[684,3068,340,268],"casa_pedra_dentro":[1026,3068,340,260],"torre_madeira":[1368,3068,119,203],"torre_cristal":[1489,3068,114,203],"torre_pedra":[1605,3068,117,198],"torre_balista_cristal":[1724,3068,113,196],"torre_canhao":[1839,3068,137,188],"torre_balista":[0,3344,131,185],"forte_muralha":[133,3344,180,154],"catapulta_0":[315,3344,150,135],"catapulta_1":[467,3344,150,135],"catapulta_2":[619,3344,150,135],"catapulta_3":[771,3344,150,135],"movel_cama_dossel":[923,3344,126,132],"cristal_claro":[1051,3344,103,131],"cristal_roxo":[1156,3344,103,129],"catapulta_ferro":[1261,3344,161,124],"movel_lareira":[1424,3344,63,117],"muro_madeira_v":[1489,3344,31,112],"muro_tijolo_aberto":[1522,3344,85,111],"movel_fogao":[1609,3344,64,111],"movel_cama_casal":[1675,3344,126,105],"espinhos":[1803,3344,120,103],"muro_tijolo_v":[1925,3344,30,100],"movel_capsula":[0,3531,112,100],"muro_pedra_v":[114,3531,29,99],"movel_cama":[145,3531,102,95],"muro_madeira_aberto":[249,3531,88,93],"muro_pedra_aberto":[339,3531,88,93],"forte_forte_cidade":[429,3531,180,91],"forte_colonia":[611,3531,180,90],"muro_tijolo_portao":[793,3531,75,87],"muro_fortaleza_v":[870,3531,31,87],"movel_fogueira":[903,3531,68,85],"muro_fortaleza_aberto":[973,3531,90,84],"forte_forte":[1065,3531,180,84],"muro_madeira_h":[1247,3531,96,82],"forte_campo":[1345,3531,180,81],"movel_cofre":[1527,3531,63,78],"muro_madeira_portao":[1592,3531,76,77],"muro_fortaleza_portao":[1670,3531,79,75],"movel_mesa":[1751,3531,90,74],"muro_ferro_aberto":[1843,3531,87,73],"movel_cesto":[1932,3531,70,73],"movel_bau_ferro":[0,3633,66,72],"muro_pedra_portao":[68,3633,80,71],"muro_ferro_v":[150,3633,31,71],"movel_bau":[183,3633,66,64],"catapulta_impacto":[251,3633,86,63],"muro_pedra_h":[339,3633,96,63],"muro_ferro_portao":[437,3633,75,62],"movel_banco":[514,3633,81,62],"movel_mesa_redonda":[597,3633,72,58],"muro_tijolo_h":[671,3633,96,56],"muro_fortaleza_h":[769,3633,96,56],"muro_ferro_h":[867,3633,96,55],"catapulta_pilha":[965,3633,62,42],"catapulta_pedra":[1029,3633,30,29]}/*FIM_ATLAS2*/;
  let art2 = null;
  (function loadArt2() {
    const img = new Image();
    img.onload = () => { art2 = img; thumbCache.clear(); invDirty = true; };
    img.onerror = () => { if (!img.dataset.raiz) { img.dataset.raiz = 1; img.src = 'estruturas.webp'; } };
    img.src = window.TERRA_ATLAS2 || 'assets/estruturas.webp';
  })();
  const thumbCache = new Map();
  function thumb2(name, w = 56, h = 48) {
    if (!art2 || !ATLAS2[name]) return '';
    const key = name + w;
    if (!thumbCache.has(key)) {
      const r = ATLAS2[name], cv = document.createElement('canvas'); cv.width = w; cv.height = h;
      const c = cv.getContext('2d'), s2 = Math.min((w - 2) / r[2], (h - 2) / r[3]);
      c.drawImage(art2, r[0], r[1], r[2], r[3], (w - r[2] * s2) / 2, (h - r[3] * s2) / 2, r[2] * s2, r[3] * s2);
      try { thumbCache.set(key, cv.toDataURL()); } catch (e) { thumbCache.set(key, ''); }
    }
    const url = thumbCache.get(key);
    return url ? `<img class="thumb" src="${url}" alt="" width="${w}" height="${h}">` : '';
  }
  // desenha um sprite do atlas com a base no ponto (cx, bottom) e altura h, espelhado se flip
  function drawObj(name, cx, bottom, h, flip = false) {
    const r = artRect(name);
    if (!r) return false;
    const w = h * r[2] / r[3];
    if (flip) {
      ctx.save(); ctx.translate(cx, 0); ctx.scale(-1, 1);
      ctx.drawImage(art, r[0], r[1], r[2], r[3], -w / 2, bottom - h, w, h);
      ctx.restore();
    } else ctx.drawImage(art, r[0], r[1], r[2], r[3], cx - w / 2, bottom - h, w, h);
    return true;
  }
  // Passo simulado para sprites sem quadros de caminhada: as pernas (parte de baixo) alternam,
  // uma perna sobe enquanto a outra fica no chão, e o corpo balança de leve.
  function drawWalker(name, cx, bottom, h, flip, phase) {
    const r = artRect(name);
    if (!r) return false;
    const w = h * r[2] / r[3];
    const split = 0.7, legSrcH = r[3] * (1 - split), bodySrcH = r[3] * split;
    const lift = Math.sin(phase) * 0.06 * h, bob = Math.abs(Math.sin(phase)) * 0.025 * h;
    ctx.save();
    ctx.translate(cx, 0);
    if (flip) ctx.scale(-1, 1);
    const top = bottom - h, legTop = top + h * split;
    const halfSrc = r[2] / 2, halfW = w / 2;
    // perna esquerda e direita (metades da parte de baixo)
    ctx.drawImage(art, r[0], r[1] + bodySrcH, halfSrc, legSrcH, -halfW, legTop - Math.max(0, lift), halfW, h * (1 - split));
    ctx.drawImage(art, r[0] + halfSrc, r[1] + bodySrcH, halfSrc, legSrcH, 0, legTop - Math.max(0, -lift), halfW, h * (1 - split));
    // corpo por cima, com um pequeno sobe e desce
    ctx.drawImage(art, r[0], r[1], r[2], bodySrcH + 1, -halfW, top - bob, w, h * split + 1);
    ctx.restore();
    return true;
  }
  function drawTileArt(name, sx, sy, size) {
    const r = artRect(name);
    if (!r) return false;
    // amostra meio pixel para dentro e sobrepõe 1 px para não aparecer a grade entre os blocos
    ctx.drawImage(art, r[0] + 0.5, r[1] + 0.5, r[2] - 1, r[3] - 1, sx, sy, size + 1, size + 1);
    return true;
  }
  function drawArtFit(c, name, size) {
    const r = artRect(name);
    if (!r) return false;
    const s = Math.min(size / r[2], size / r[3]), w = r[2] * s, h = r[3] * s;
    c.imageSmoothingEnabled = true;
    c.drawImage(art, r[0], r[1], r[2], r[3], (size - w) / 2, (size - h) / 2, w, h);
    return true;
  }
  // miniaturas para a mochila (falha em silêncio se o navegador bloquear a leitura do atlas)
  const ITEM_ART = { flechas: 'icon_flechas', galinha_viva: 'galinha_side_0', coelho_vivo: 'coelho_side_0', pintinho_vivo: 'pintinho_side_0', raposa: 'raposa_side_0', cervo: 'cervo_side_0', pavao: 'pavao_fan_0', javali: 'javali_side_0' };
  function buildIconURLs() {
    for (const k of Object.keys(ITEMS)) {
      const name = ITEM_ART[k] || 'icon_' + k;
      if (!ATLAS[name]) continue;
      const cv = document.createElement('canvas'); cv.width = cv.height = 48;
      drawArtFit(cv.getContext('2d'), name, 48);
      try { iconURL[k] = cv.toDataURL(); } catch (e) { return; }
    }
  }
  function itemThumb(k) {
    return iconURL[k] ? `<img class="thumb" src="${iconURL[k]}" alt="">` : `<span class="sw" style="background:${ITEMS[k].cor}"></span>`;
  }

  // ================= Água =================
  // Superfície contínua: cor base + duas camadas de ondas que deslizam em direções diferentes,
  // margem mais escura com espuma onde a água encosta na terra.
  const WAVE = 96, WBLK = 3;
  function makeWaveTex(seed, light) {
    const cv = document.createElement('canvas'); cv.width = cv.height = WAVE;
    const c = cv.getContext('2d'), r = mulberry32(seed), K = 2 * Math.PI / WAVE;
    const ph = [r() * 6, r() * 6, r() * 6, r() * 6];
    for (let y = 0; y < WAVE; y += WBLK) for (let x = 0; x < WAVE; x += WBLK) {
      const v = Math.sin(K * (2 * x + y) + ph[0]) + 0.7 * Math.sin(K * (x - 3 * y) + ph[1])
        + 0.5 * Math.sin(K * (4 * x + 2 * y) + ph[2]) + 0.4 * Math.sin(K * (-3 * x + 5 * y) + ph[3]);
      if (v > 2.05) c.fillStyle = light ? 'rgba(235,250,255,0.5)' : 'rgba(200,235,250,0.28)';
      else if (v > 1.55) c.fillStyle = 'rgba(140,200,230,0.16)';
      else if (v < -1.8) c.fillStyle = 'rgba(25,60,95,0.14)';
      else continue;
      c.fillRect(x, y, WBLK, WBLK);
    }
    return cv;
  }
  let wavePatA = null, wavePatB = null, waterTex = null;
  function waterPatterns() {
    if (!waterTex && artRect('water_tex')) {   // textura pintada (do atlas)
      const r = ATLAS.water_tex, cv = document.createElement('canvas');
      cv.width = r[2]; cv.height = r[3];
      cv.getContext('2d').drawImage(art, r[0], r[1], r[2], r[3], 0, 0, r[2], r[3]);
      waterTex = ctx.createPattern(cv, 'repeat');
    }
    if (!wavePatA) {
      wavePatA = ctx.createPattern(makeWaveTex(11, true), 'repeat');
      wavePatB = ctx.createPattern(makeWaveTex(29, false), 'repeat');
    }
  }
  const isWet = (i, z) => S.water[i] > 0 || (z === 0 && S.tiles[i] === T.SOURCE);
  function drawWater(x, y, z, sx, sy, lv, now, camX, camY) {
    const u = tp / 16, i = I(x, y, z);
    // mais fundo = mais escuro
    const d = Math.min(lv, 12) / 12;
    ctx.fillStyle = `rgb(${Math.round(84 - 26 * d)},${Math.round(152 - 30 * d)},${Math.round(190 - 14 * d)})`;
    ctx.fillRect(sx, sy, tp + 1, tp + 1);
    waterPatterns();
    if (waterTex) {
      // textura em duas camadas deslizando devagar em sentidos diferentes, mais escura onde é fundo
      const t = now / 1000, sc = 4 * tp / 256;
      waterTex.setTransform(new DOMMatrix([sc, 0, 0, sc, -camX + 5 * t * u, -camY + 2 * t * u]));
      ctx.fillStyle = waterTex; ctx.fillRect(sx, sy, tp + 1, tp + 1);
      waterTex.setTransform(new DOMMatrix([-sc * 1.3, 0, 0, sc * 1.3, -camX - 4 * t * u, -camY + 3 * t * u]));
      ctx.globalAlpha = 0.28; ctx.fillRect(sx, sy, tp + 1, tp + 1); ctx.globalAlpha = 1;
      if (d > 0.4) { ctx.fillStyle = `rgba(20,55,85,${(0.22 * (d - 0.4) / 0.6).toFixed(2)})`; ctx.fillRect(sx, sy, tp + 1, tp + 1); }
    } else {
      const sc = tp / 36, t = now / 1000;
      for (const [pat, vx, vy, al] of [[wavePatB, -6, 3, 1], [wavePatA, 9, 5, 1]]) {
        pat.setTransform(new DOMMatrix([sc, 0, 0, sc, -camX + vx * t * u, -camY + vy * t * u]));
        ctx.globalAlpha = al; ctx.fillStyle = pat; ctx.fillRect(sx, sy, tp + 1, tp + 1);
      }
      ctx.globalAlpha = 1;
    }
    // margens: terra mais escura e uma linha de espuma onde a água encosta em algo seco
    const dryN = y > 0 && !isWet(i - W, z), dryS = y < H - 1 && !isWet(i + W, z);
    const dryW = x > 0 && !isWet(i - 1, z), dryE = x < W - 1 && !isWet(i + 1, z);
    const foam = 'rgba(235,248,255,' + (0.65 + 0.25 * Math.sin(now / 400 + x + y)).toFixed(2) + ')';
    const bank = 'rgba(40,70,90,0.35)', b = 2.5 * u, f = Math.max(1, 0.9 * u);
    if (dryN) { ctx.fillStyle = bank; ctx.fillRect(sx, sy, tp, b); ctx.fillStyle = foam; ctx.fillRect(sx, sy + b, tp, f); }
    if (dryS) { ctx.fillStyle = foam; ctx.fillRect(sx, sy + tp - f, tp, f); }
    if (dryW) { ctx.fillStyle = bank; ctx.fillRect(sx, sy, b * 0.6, tp); ctx.fillStyle = foam; ctx.fillRect(sx + b * 0.6, sy, f, tp); }
    if (dryE) { ctx.fillStyle = bank; ctx.fillRect(sx + tp - b * 0.6, sy, b * 0.6, tp); ctx.fillStyle = foam; ctx.fillRect(sx + tp - b * 0.6 - f, sy, f, tp); }
    // brilhos que piscam
    const tw = Math.sin(now / 300 + x * 12.9898 + y * 78.233);
    if (tw > 0.93) { ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.fillRect(sx + ((x * 7) % 10 + 3) * u, sy + ((y * 5) % 10 + 3) * u, 2 * u, u); }
  }

  // ================= DOM e HUD =================
  const $ = id => document.getElementById(id);
  const canvas = $('game'), ctx = canvas.getContext('2d');
  const lightCv = document.createElement('canvas'), lctx = lightCv.getContext('2d');
  let invDirty = true, lastMana = 5, pushT = 0;
  const slotEls = [];

  function buildHotbar() {
    const bar = $('hotbar');
    bar.innerHTML = '';
    TOOLS.forEach((t, k) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'slot'; b.setAttribute('aria-label', t.nome);
      const cv = document.createElement('canvas'); cv.width = cv.height = 48;
      const kk = document.createElement('span'); kk.className = 'k'; kk.textContent = k + 1;
      const n = document.createElement('span'); n.className = 'n';
      const bar2 = document.createElement('span'); bar2.className = 'dur'; const fill = document.createElement('i'); bar2.append(fill);
      b.append(cv, kk, n, bar2);
      b.addEventListener('click', () => selectTool(k, true));
      bar.append(b);
      slotEls.push({ b, cv, n, id: t.id, bar: bar2, fill, kk });
    });
  }
  function selectTool(k, tap) {
    k = (k + TOOLS.length) % TOOLS.length;
    if (tap && TOOLS[k].id === 'muro' && S.tool === k) { showSheet('sheet-build'); return; }   // segundo toque: escolher o que construir
    S.tool = k;
    invDirty = true;
    if (TOOLS[k].id === 'muro') hint('construir', 'Toque de novo em Construir (ou R) para escolher muros, portões, casas e móveis.');
  }
  function selName() {
    const sl = S.sel;
    if (sl.k === 'kit') return BUILDS[sl.id].nome;
    const m = WALL_MATS[sl.m || 0];
    return sl.k === 'portao' ? 'Portão de ' + m.id : m.nome;
  }
  function selCount() {
    const sl = S.sel;
    if (sl.k === 'kit') return S.kit[sl.id] || 0;
    const cost = wallCost(sl.m || 0, sl.k === 'portao');
    return Math.min(...Object.entries(cost).map(([k, n]) => Math.floor((S.inv[k] || 0) / n)));
  }
  function updateHotbar() {
    slotEls.forEach((s, k) => {
      s.b.setAttribute('aria-pressed', String(k === S.tool));
      s.b.classList.toggle('locked', s.id === 'rede' && !S.owned.rede);
      s.b.hidden = (s.id === 'arco' || s.id === 'cetro') && !S.owned[s.id];
      drawIcon(s.cv.getContext('2d'), s.id);
      s.n.textContent = s.id === 'arco' ? (S.inv.flechas || 0) : s.id === 'cetro' ? Math.floor(mana) : s.id === 'muro' ? selCount() : s.id === 'enxada' ? (S.inv.sementes || 0) : '';
      const f = s.id === 'rede' ? (S.owned.rede ? durFrac('rede') : null) : durFrac(s.id);
      s.bar.hidden = f === null;
      if (f !== null) { s.fill.style.width = Math.round(f * 100) + '%'; s.fill.className = f < 0.2 ? 'low' : ''; }
      if (BASIC[s.id] && !toolUsable(s.id)) s.b.classList.add('locked');
    });
    const tn = TOOLS[S.tool];
    $('toolname').textContent = tn.id === 'muro' ? `${selName()} ▾` : tn.nome;
  }
  let lastBiome = null;
  function updateHud() {
    $('coins').textContent = S.coins;
    const mins = Math.floor(dayPhase() * 24 * 60);
    const hh = String(Math.floor(mins / 60)).padStart(2, '0'), mm = String(Math.floor(mins % 60 / 10) * 10).padStart(2, '0');
    $('clock').textContent = `${hh}:${mm} · ${isDay() ? 'Dia' : 'Noite'}`;
    const here = BIOMES[S.biome[Math.floor(S.p.y) * W + Math.floor(S.p.x)]];
    $('depth').textContent = S.p.z === 0 ? here.nome : layerName(S.p.z);
    if (lastBiome && lastBiome !== here && S.p.z === 0) toast(`Entrando: ${here.nome}`, 'leaf');
    lastBiome = here;
    if (openSheet && openSheet.id === 'sheet-admin') drawMinimap();
    const p = S.p;
    const onLadder = p.z > 0 && tileAt(Math.floor(p.x), Math.floor(p.y), p.z - 1) === T.HOLE;
    $('btn-f').textContent = onLadder ? 'Subir' : 'Descer';
    const hb = $('btn-home');
    const homeTxt = homing ? 'Voltando…' : S.time < S.homeReadyAt ? `Casa ${mmss(S.homeReadyAt - S.time)}` : 'Casa';
    if (hb.textContent !== homeTxt) hb.textContent = homeTxt;
    hb.classList.toggle('busy', !!homing);
  }

  function toast(msg, kind = '', ms = 2200) {
    const box = $('toasts');
    const el = document.createElement('div');
    el.className = 'toast' + (kind ? ' ' + kind : '');
    el.textContent = msg;
    box.append(el);
    while (box.children.length > 3) box.firstChild.remove();
    setTimeout(() => el.remove(), ms);
  }

  // Painéis
  let openSheet = null;
  let panelMode = 'shop';   // 'shop' (comprar), 'bag' (mochila) ou 'trade' (vender a um comprador)
  function showSheet(id, merchant = null, mode = 'shop') {
    closeSheet();
    trading = merchant;
    panelMode = merchant ? 'trade' : mode;
    openSheet = $(id);
    openSheet.hidden = false;
    held.up = held.down = held.left = held.right = false; actHeld = false;
    if (id === 'sheet-shop') renderShop();
    if (id === 'sheet-admin') { adminMove = null; renderAdmin(); }
    if (id === 'sheet-build') renderBuild();
  }
  function closeSheet() {
    if (openSheet) openSheet.hidden = true;
    openSheet = null;
    trading = null;
    $('confirm-new').hidden = true;
  }
  const coinsTxt = v => `${v} ${v === 1 ? 'moeda' : 'moedas'}`;
  function buyersOf(item) { return MERCHANTS.filter(m => m.compra.includes(item)).map(m => m.nome).join(' ou '); }

  function renderShop() {
    $('shop-coins').textContent = S.coins;
    const m = trading && trading.def;
    $('shop-title').textContent = m ? m.nome : panelMode === 'bag' ? 'Mochila' : 'Loja';
    const items = Object.keys(ITEMS).filter(k => (S.inv[k] || 0) > 0);
    if (panelMode === 'shop') { renderBuyList(); return; }
    let html = m ? `<p class="muted">${m.nome} ${m.papel}.</p>` : '';
    if (!m) {
      const total = items.reduce((s, k) => s + (S.inv[k] || 0) * ITEMS[k].valor, 0);
      html += '<div class="section-label">Ferramentas e oficina</div><div class="list">';
      for (const tool of ['picareta', 'machado', 'enxada', 'espada', 'rede']) {
        const v = activeVariant(tool);
        if (!v) continue;
        const basic = !!BASIC[v], max = basic ? BASIC[v].dur : DUR[v], left = S.dur[v] ?? max;
        const brk = basic && S.broken[v];
        let btn = '<span></span>';
        if (basic && (brk || left < max)) {
          const can = hasAll(BASIC[v].receita);
          btn = `<button type="button" class="btn ${can ? 'btn-gold' : ''}" data-craft="${v}" ${can ? '' : 'disabled'}>Fazer nova</button>`;
        }
        const sub = brk ? `Quebrada · fazer outra: ${costTxt(BASIC[v].receita)}` : `${left} de ${max} usos` + (basic ? ` · fazer outra: ${costTxt(BASIC[v].receita)}` : ' · da loja');
        html += `<div class="row"><span></span><span class="name"><b>${basic ? BASIC[v].nome : shopName(v)}</b><small>${sub}</small></span><span></span>${btn}</div>`;
      }
      if (S.owned.capacete) html += `<div class="row"><span></span><span class="name"><b>Capacete com lanterna</b><small>Bateria: ${Math.ceil((S.dur.capacete ?? DUR.capacete) / 60)} min de luz no escuro</small></span><span></span><span></span></div>`;
      html += '</div>';
      if (total) html += `<p class="muted small-text">Tudo na mochila vale cerca de ${coinsTxt(total)}.</p>`;
    }
    html += '<div class="section-label">Itens</div><div class="list">';
    if (!items.length) html += '<div class="empty">Mochila vazia. Mine, cace, capture e colha para ter o que vender.</div>';
    for (const k of items) {
      const it = ITEMS[k], n = S.inv[k];
      const buys = m && m.compra.includes(k);
      let info;
      if (!it.valor) info = 'Para plantar';
      else if (m) info = buys ? `${coinsTxt(it.valor)} cada` : `${m.nome} não compra`;
      else info = `${coinsTxt(it.valor)} cada · venda para ${buyersOf(k)}`;
      html += `<div class="row">${itemThumb(k)}
        <span class="name"><b>${it.nome}</b><small>${info}</small></span>
        <span class="qty">${n}</span>
        ${buys ? `<button type="button" class="btn" data-sell="${k}">Vender</button>` : '<span></span>'}</div>`;
    }
    html += '</div>';
    if (m) {
      if (items.some(k => m.compra.includes(k) && k !== 'madeira')) {
        html += `<div class="list-actions"><button type="button" class="btn btn-gold" data-sellall>Vender tudo${m.compra.includes('madeira') ? ' (menos madeira)' : ''}</button></div>`;
      }
      $('shop-body').innerHTML = html;
      return;
    }
    html += '<p class="muted small-text">Para vender, encontre um comprador. Eles andam pelo mapa e as setas na borda da tela mostram onde estão.</p>';
    const found = Object.keys(SPECIES).filter(k => S.catalog[k]).length;
    html += `<div class="section-label">Catálogo de animais · ${found} de ${Object.keys(SPECIES).length}</div><div class="list">`;
    for (const [k, sp] of Object.entries(SPECIES)) {
      const n = S.catalog[k] || 0;
      html += `<div class="row shop"><span class="name"><b>${n ? sp.nome : '???'}</b><small>${sp.raridade} · ${sp.dica}</small></span>
        <span class="${n ? 'owned' : 'muted small-text'}">${n ? n + ' capturado' + (n > 1 ? 's' : '') : 'Não capturado'}</span></div>`;
    }
    html += '</div><p class="muted small-text">Complete o catálogo para ganhar 300 moedas.</p>';
    $('shop-body').innerHTML = html;
  }

  let shopTab = 'ferramentas';
  function renderBuyList() {
    let html = '<div class="shop-tabs" role="tablist">' + SHOP_TABS.map(([k, n]) =>
      `<button type="button" class="btn ${shopTab === k ? 'btn-gold' : ''}" data-tab="${k}" aria-pressed="${shopTab === k}">${n}</button>`).join('') + '</div>';
    if (shopTab === 'ferramentas') {
      html += '<div class="list">';
      for (const it of SHOP) {
        const owned = !it.repetir && S.owned[it.id];
        const locked = it.req && !S.owned[it.req];
        let desc = locked ? `Requer ${SHOP.find(s => s.id === it.req).nome.toLowerCase()}` : it.desc;
        if (DUR[it.id] && !locked) desc += it.id === 'capacete' ? ` Bateria: ${Math.round(DUR[it.id] / 60)} min no escuro.` : ` Dura ${DUR[it.id]} usos.`;
        const left = owned && DUR[it.id] ? (it.id === 'capacete' ? `${Math.ceil((S.dur[it.id] ?? DUR[it.id]) / 60)} min` : `${S.dur[it.id] ?? DUR[it.id]} usos`) : '';
        html += `<div class="row shop"><span class="name"><b>${it.nome}</b><small>${desc}</small></span>
          ${owned ? `<span class="owned">Comprado${left ? ' · ' + left : ''}</span>` :
            `<button type="button" class="btn ${S.coins >= it.preco && !locked ? 'btn-gold' : ''}" data-buy="${it.id}" ${S.coins >= it.preco && !locked ? '' : 'disabled'}>${it.preco} moedas</button>`}</div>`;
      }
      html += '</div><p class="muted small-text">As ferramentas da loja gastam com o uso e precisam ser compradas de novo. As simples dá para fazer na Mochila.</p>';
    } else if (shopTab === 'skins') {
      const ready = SKINS.filter(sk => skinReady(sk.id));
      html += '<div class="list">';
      if (!ready.length) html += '<div class="empty">Nenhuma skin disponível ainda.</div>';
      for (const sk of ready) {
        const has = (S.skins || []).includes(sk.id), wearing = has && S.skin === sk.id;
        let btn;
        if (wearing) btn = `<button type="button" class="btn" data-skin="off">Tirar</button>`;
        else if (has) btn = `<button type="button" class="btn btn-gold" data-skin="${sk.id}">Vestir</button>`;
        else btn = `<button type="button" class="btn ${S.coins >= sk.preco ? 'btn-gold' : ''}" data-skinbuy="${sk.id}" ${S.coins >= sk.preco ? '' : 'disabled'}>${sk.preco} moedas</button>`;
        html += `<div class="row skin-row">${skinThumb(sk.id)}<span class="name"><b>${sk.nome}</b><small>${sk.raridade} · só visual${wearing ? ' · usando' : ''}</small></span><span></span>${btn}</div>`;
      }
      html += '</div>';
    } else {
      html += '<div class="list">';
      for (const [k, d] of Object.entries(BUILDS)) {
        if (TAB_OF(d) !== shopTab) continue;
        const n = S.kit[k] || 0, can = S.coins >= d.preco;
        const sub = (d.desc || (d.tipo === 'movel' ? 'Para decorar dentro ou fora de casa.' : '')) + (n ? ` · você tem ${n} guardado${n > 1 ? 's' : ''}` : '');
        html += `<div class="row skin-row">${d.tipo === 'robo' ? thumb1('robo_front_0') : thumb2(d.img)}<span class="name"><b>${d.nome}</b><small>${sub}</small></span><span></span>
          <button type="button" class="btn ${can ? 'btn-gold' : ''}" data-buyk="${k}" ${can ? '' : 'disabled'}>${d.preco} moedas</button></div>`;
      }
      html += '</div><p class="muted small-text">O que você compra vai para Construir (ferramenta 5). Depois de colocar, dá para guardar e mudar de lugar quantas vezes quiser.</p>';
    }
    $('shop-body').innerHTML = html;
  }
  function thumb1(name, w = 48, h = 56) {
    const r = artRect(name);
    if (!r) return '<span></span>';
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const c = cv.getContext('2d'), s2 = Math.min((w - 4) / r[2], (h - 4) / r[3]);
    c.drawImage(art, r[0], r[1], r[2], r[3], (w - r[2] * s2) / 2, h - 2 - r[3] * s2, r[2] * s2, r[3] * s2);
    try { return `<img class="thumb" src="${cv.toDataURL()}" alt="">`; } catch (e) { return '<span></span>'; }
  }
  function buyKit(k) {
    const d = BUILDS[k];
    if (!d || S.coins < d.preco) return;
    S.coins -= d.preco; S.kit[k] = (S.kit[k] || 0) + 1;
    S.sel = { k: 'kit', id: k }; S.tool = TOOLS.findIndex(t => t.id === 'muro');
    invDirty = true;
    toast(`Comprou ${d.nome}. Já está em Construir: fique de frente para o lugar e use.`, 'gold', 4000);
    save();
  }
  function renderBuild() {
    const row = (th, name, sub, btn) => `<div class="row skin-row">${th || '<span></span>'}<span class="name"><b>${name}</b><small>${sub}</small></span><span></span>${btn}</div>`;
    const cur = (k, m, id) => S.sel.k === k && (k === 'kit' ? S.sel.id === id : (S.sel.m || 0) === m);
    const pick = (val, on) => on ? '<span class="owned">Escolhido</span>' : `<button type="button" class="btn btn-gold" data-bsel="${val}">Escolher</button>`;
    let html = '';
    // tudo o que está construído por perto, do mais perto ao mais longe
    const near = S.builds.map((b, i) => ({ b, i, dist: Math.hypot(b.x + BUILDS[b.k].w / 2 - S.p.x, b.y + BUILDS[b.k].h / 2 - S.p.y) }))
      .filter(o => o.dist < 60).sort((a, c) => a.dist - c.dist).slice(0, 30);
    near.push(...S.bots.map((b, i) => ({ bot: b, i, dist: Math.hypot(b.x - S.p.x, b.y - S.p.y) })).filter(o => o.dist < 60));
    html += '<div class="section-label">Construído por perto · guardar ou vender</div><div class="list">';
    if (!near.length) html += '<div class="empty">Nada construído por perto.</div>';
    for (const o of near) {
      const d = o.bot ? BUILDS.robo : BUILDS[o.b.k], th = o.bot ? thumb1('robo_front_0') : thumb2(d.img + (d.tipo === 'forte' ? '' : ''));
      const tag = o.bot ? 'bot' : 'b';
      html += `<div class="row skin-row">${th || '<span></span>'}<span class="name"><b>${d.nome}</b><small>a ${Math.round(o.dist)} blocos · vender devolve ${Math.floor(d.preco / 2)} moedas</small></span>
        <button type="button" class="btn" data-bpick="${tag}:${o.i}">Guardar</button>
        <button type="button" class="btn btn-danger" data-bsell="${tag}:${o.i}">Vender</button></div>`;
    }
    html += '</div><p class="muted small-text">Guardar devolve para "Suas construções", para colocar em outro lugar. Casas levam os móveis de dentro. Muros e portões: desmonte com a picareta.</p>';
    html += '<div class="section-label">Muros</div><div class="list">';
    WALL_MATS.forEach((m, k) => { html += row(thumb2(`muro_${m.id}_h`), m.nome, `${costTxt(m.custo)} · ${m.golpes} golpes para derrubar`, pick('muro:' + k, cur('muro', k))); });
    html += '</div><div class="section-label">Portões · abrem quando você chega perto</div><div class="list">';
    WALL_MATS.forEach((m, k) => { html += row(thumb2(`muro_${m.id}_portao`), `Portão (${m.nome.toLowerCase()})`, costTxt(wallCost(k, true)), pick('portao:' + k, cur('portao', k))); });
    html += '</div><div class="section-label">Suas construções</div><div class="list">';
    const mine = Object.entries(S.kit).filter(([k, n]) => n > 0 && BUILDS[k]);
    if (!mine.length) html += '<div class="empty">Nada guardado. Casas, fortalezas, torres, móveis e o robô minerador estão na loja.</div>';
    for (const [k, n] of mine) {
      const d = BUILDS[k];
      html += row(d.tipo === 'robo' ? thumb1('robo_front_0') : thumb2(d.img), `${d.nome}${n > 1 ? ' × ' + n : ''}`, d.desc || 'Móvel', pick('kit:' + k, cur('kit', 0, k)));
    }
    html += '</div><div class="section-label">Mudar de lugar</div>';
    const tg = pickupTarget();
    const tgName = tg ? (tg.bot ? 'Robô minerador' : BUILDS[tg.b.k].nome) : '';
    html += tg ? `<p class="muted small-text">Na sua frente: <b>${tgName}</b>. Guardar devolve para "Suas construções"${tg.b && BUILDS[tg.b.k].tipo === 'casa' ? ' (os móveis de dentro vão junto)' : ''}; depois é só colocar onde quiser.</p>
      <div class="list-actions"><button type="button" class="btn" data-pickup>Guardar</button></div>`
      : '<p class="muted small-text">Fique de frente para uma casa, móvel, torre ou robô para guardar e colocar em outro lugar. Muros e portões se desmontam com a picareta e devolvem o material.</p>';
    html += '<div class="list-actions"><button type="button" class="btn" data-tab-go="casas">Comprar construções</button></div>';
    $('build-body').innerHTML = html;
  }
  function skinThumb(id) {
    const r = artRect(`sk_${id}_front_idle`);
    if (!r) return '<span></span>';
    const cv = document.createElement('canvas'); cv.width = 48; cv.height = 64;
    const c = cv.getContext('2d'), s2 = Math.min(44 / r[2], 60 / r[3]);
    c.drawImage(art, r[0], r[1], r[2], r[3], (48 - r[2] * s2) / 2, 62 - r[3] * s2, r[2] * s2, r[3] * s2);
    try { return `<img class="thumb" src="${cv.toDataURL()}" alt="">`; } catch (e) { return '<span></span>'; }
  }
  function buySkin(id) {
    const sk = SKINS.find(x => x.id === id);
    if (!sk || S.coins < sk.preco || (S.skins || []).includes(id)) return;
    S.coins -= sk.preco; S.skins = [...(S.skins || []), id]; S.skin = id; invDirty = true;
    toast(`Skin ${sk.nome} comprada e vestida`, 'gold'); save();
  }

  // ================= Administrador =================
  // Painel escondido (5 toques no relógio, ou a tecla 0 cinco vezes). No multiplayer ele só abre
  // na conta do administrador e as ações são validadas no servidor.
  let adminMove = null;          // jazida aguardando um toque no minimapa para mudar de lugar
  const secretTaps = [];
  function secretTap() {
    const now = performance.now();
    secretTaps.push(now);
    while (secretTaps.length && now - secretTaps[0] > 2500) secretTaps.shift();
    if (secretTaps.length >= 5) { secretTaps.length = 0; openStaff(); }
  }

  const MINI_SCALE = 2;
  const miniBase = document.createElement('canvas');
  function rebuildMiniBase() {
    miniBase.width = W; miniBase.height = H;
    const mc = miniBase.getContext('2d'), img = mc.createImageData(W, H), d = img.data;
    const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
    const groundRGB = BIOMES.map(b => hex(GROUND[b.id][0]));
    const treeRGB = BIOMES.map(b => b.id === 'neve' ? hex('#9fb4a8') : b.id === 'deserto' ? hex('#6f9a4f') : hex('#2a5a26'));
    const C = { water: hex('#3a8ad8'), rock: hex('#8d9096'), dug: hex('#5a3f28'), farm: hex('#7a5232'), wall: hex('#b07a48') };
    for (let i = 0; i < W * H; i++) {
      const t = S.tiles[i], b = S.biome[i];
      let c = groundRGB[b];
      if (t === T.SOURCE || S.water[i] > 0) c = C.water;
      else if (t === T.TREE || t === T.SAPLING) c = treeRGB[b];
      else if (t === T.ROCK) c = C.rock;
      else if (t === T.VALA || t === T.HOLE) c = C.dug;
      else if (t === T.TILLED || t === T.CROP) c = C.farm;
      else if (t === T.WALL) c = C.wall;
      d[i * 4] = c[0]; d[i * 4 + 1] = c[1]; d[i * 4 + 2] = c[2]; d[i * 4 + 3] = 255;
    }
    mc.putImageData(img, 0, 0);
    for (const b of S.builds) {   // construções no minimapa
      const d = BUILDS[b.k];
      mc.fillStyle = d.tipo === 'forte' ? 'rgba(120,90,60,0.55)' : d.tipo === 'casa' ? '#c0703a' : '#b07a48';
      if (d.tipo === 'casa' || d.tipo === 'forte') {
        mc.beginPath(); mc.moveTo(b.x, b.y + d.h / 2); mc.lineTo(b.x + d.w / 2, b.y); mc.lineTo(b.x + d.w, b.y + d.h / 2); mc.lineTo(b.x + d.w / 2, b.y + d.h); mc.fill();
      } else mc.fillRect(b.x, b.y, d.w, d.h);
    }
  }
  // No protótipo solo só existe você; no multiplayer este número conta todos os jogadores por perto
  const playersNear = d => (Math.hypot(S.p.x - d.x, S.p.y - d.y) < 30 ? 1 : 0);

  function drawMinimap(now = performance.now()) {
    const cv = $('minimap'), c = cv.getContext('2d'), k = MINI_SCALE;
    c.imageSmoothingEnabled = false;
    c.drawImage(miniBase, 0, 0, W * k, H * k);
    // regiões e nomes dos biomas
    c.strokeStyle = 'rgba(20,17,15,0.55)'; c.lineWidth = 2; c.setLineDash([8, 6]);
    for (let x = 1; x < RCOLS; x++) { c.beginPath(); c.moveTo(x * REGION * k, 0); c.lineTo(x * REGION * k, H * k); c.stroke(); }
    for (let y = 1; y < RROWS; y++) { c.beginPath(); c.moveTo(0, y * REGION * k); c.lineTo(W * k, y * REGION * k); c.stroke(); }
    c.setLineDash([]);
    c.font = '600 20px "Pixelify Sans", "Courier New", monospace'; c.textBaseline = 'top'; c.textAlign = 'left';
    BIOMES.forEach((b, reg) => {
      const [rx, ry] = regionOrigin(reg);
      const tw = c.measureText(b.nome).width;
      c.fillStyle = 'rgba(20,17,15,0.75)'; c.fillRect(rx * k + 8, ry * k + 8, tw + 14, 28);
      c.fillStyle = '#f4eadb'; c.fillText(b.nome, rx * k + 15, ry * k + 13);
    });
    // jazidas
    c.textAlign = 'center'; c.textBaseline = 'middle';
    for (const d of S.deposits) {
      const cx = d.x * k, cy = d.y * k, r = d.r * k, col = ITEMS[d.ore].cor;
      const sel = adminMove === d.id;
      c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2);
      if (d.active) { c.fillStyle = col + '66'; c.fill(); }
      c.lineWidth = sel ? 4 + Math.sin(now / 150) * 2 : 3;
      c.strokeStyle = d.active ? col : 'rgba(40,36,32,0.8)';
      if (!d.active) c.setLineDash([6, 5]);
      c.stroke(); c.setLineDash([]);
      const label = `${ITEMS[d.ore].nome} · c${d.z}`;
      c.font = '600 17px "Pixelify Sans", "Courier New", monospace';
      const tw = c.measureText(label).width;
      c.fillStyle = 'rgba(20,17,15,0.82)'; c.fillRect(cx - tw / 2 - 6, cy - r - 26, tw + 12, 22);
      c.fillStyle = d.active ? '#f4eadb' : '#bba98f'; c.fillText(label, cx, cy - r - 14);
      const near = playersNear(d);
      if (near) {
        c.fillStyle = '#e8794f'; c.beginPath(); c.arc(cx + r * 0.75, cy - r * 0.75, 12, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#ffffff'; c.font = '600 15px "Pixelify Sans", "Courier New", monospace'; c.fillText(String(near), cx + r * 0.75, cy - r * 0.75 + 1);
      }
    }
    // compradores e jogador
    for (const n of S.npcs) {
      c.fillStyle = n.def.cor; c.strokeStyle = '#14110f'; c.lineWidth = 2;
      c.beginPath(); c.arc(n.x * k, n.y * k, 6, 0, Math.PI * 2); c.fill(); c.stroke();
    }
    c.fillStyle = '#ffffff'; c.strokeStyle = '#14110f'; c.lineWidth = 3;
    c.beginPath(); c.arc(S.p.x * k, S.p.y * k, 8, 0, Math.PI * 2); c.fill(); c.stroke();
    c.fillStyle = '#efb941'; c.fillRect(S.home.x * k - 2, S.home.y * k - 14, 3, 14); c.fillRect(S.home.x * k + 1, S.home.y * k - 14, 9, 6);
  }

  // Painel: sem contas (teste local) abre para quem souber o atalho; com contas, só para a equipe.
  function openStaff() {
    if (NET.enabled && !NET.isStaff) return;
    showSheet('sheet-admin');
  }
  function renderPlayers(list) {
    const box = $('admin-players');
    if (!list.length) { box.innerHTML = '<div class="empty">Nenhum jogador encontrado.</div>'; return; }
    const fmt = d => d ? new Date(d).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—';
    box.innerHTML = list.map(p => {
      const banned = p.banned_until && (p.banned_until === 'infinity' || new Date(p.banned_until) > new Date());
      const tags = (p.role !== 'player' ? `<span class="role-tag ${p.role}">${p.role === 'admin' ? 'Admin' : 'Moderador'}</span>` : '')
        + (banned ? `<span class="role-tag ban">Banido${p.banned_until === 'infinity' ? '' : ' até ' + fmt(p.banned_until)}</span>` : '');
      const self = NET.user && p.id === NET.user.id;
      let btns = '';
      if (!self && p.role !== 'admin') {
        btns += banned ? `<button type="button" class="btn" data-pl="unban" data-id="${p.id}">Desbanir</button>`
          : `<button type="button" class="btn" data-pl="ban1" data-id="${p.id}">Banir 1 dia</button>
             <button type="button" class="btn" data-pl="ban7" data-id="${p.id}">7 dias</button>
             <button type="button" class="btn btn-danger" data-pl="banp" data-id="${p.id}">Permanente</button>`;
        if (NET.isAdmin) {
          btns += p.role === 'moderator' ? `<button type="button" class="btn" data-pl="demote" data-id="${p.id}">Remover moderador</button>`
            : `<button type="button" class="btn" data-pl="promote" data-id="${p.id}">Tornar moderador</button>`;
          btns += `<button type="button" class="btn btn-gold" data-pl="coins" data-id="${p.id}">+500 moedas</button>`;
        }
      }
      return `<div class="row player-row"><span class="name"><b>${escapeHtml(p.username)}</b> <code class="pcode">${escapeHtml(p.codigo || '')}</code>${tags}
        <small>${p.coins} moedas · visto ${fmt(p.updated_at)}${p.ban_reason ? ' · ' + escapeHtml(p.ban_reason) : ''}</small></span>
        <span class="admin-btns">${btns}</span></div>`;
    }).join('');
  }
  const escapeHtml = t => String(t).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  async function refreshPlayers() {
    if (!NET.enabled || !NET.isStaff) return;
    $('admin-players').innerHTML = '<div class="empty">Carregando…</div>';
    try { renderPlayers(await NET.listPlayers($('admin-search').value.trim())); }
    catch (e) { $('admin-players').innerHTML = `<div class="empty">${escapeHtml(e.message)}</div>`; }
  }
  // confirmação dentro da página (o navegador do artefato não mostra confirm())
  const armed = {};
  async function playerAction(action, id, btn) {
    const key = action + id;
    if ((action === 'banp' || action === 'promote') && !armed[key]) {
      armed[key] = true; btn.textContent = 'Confirmar?'; setTimeout(() => { delete armed[key]; }, 4000); return;
    }
    try {
      if (action === 'ban1') await NET.ban(id, 1, 'Suspensão de 1 dia');
      else if (action === 'ban7') await NET.ban(id, 7, 'Suspensão de 7 dias');
      else if (action === 'banp') await NET.ban(id, -1, 'Banimento permanente');
      else if (action === 'unban') await NET.ban(id, 0, null);
      else if (action === 'promote') await NET.setRole(id, 'moderator');
      else if (action === 'demote') await NET.setRole(id, 'player');
      else if (action === 'coins') await NET.giveCoins(id, 500);
      toast('Feito');
    } catch (e) { toast(e.message, 'warn', 4000); }
    refreshPlayers();
  }
  $('admin-players').addEventListener('click', e => {
    const b = e.target.closest('[data-pl]');
    if (b) playerAction(b.dataset.pl, b.dataset.id, b);
  });
  $('admin-search-btn').addEventListener('click', refreshPlayers);
  $('admin-search').addEventListener('keydown', e => { if (e.key === 'Enter') refreshPlayers(); e.stopPropagation(); });

  function renderAdmin() {
    const online = NET.enabled;
    $('admin-players-wrap').hidden = !online;
    $('admin-world').hidden = online && !NET.isAdmin;   // moderador só vê jogadores
    $('admin-title').textContent = online ? (NET.isAdmin ? 'Administrador' : 'Moderação') : 'Administrador';
    $('admin-note').textContent = online
      ? (NET.isAdmin ? 'Só você vê este painel. Seu perfil fica invisível para os jogadores.' : 'Ações de moderação ficam registradas para o administrador.')
      : 'Modo de teste local. Com contas ligadas, este painel só abre para a equipe, conferido pelo servidor.';
    if (online) refreshPlayers();
    if (online && !NET.isAdmin) return;
    rebuildMiniBase();
    drawMinimap();
    const mode = $('admin-mode');
    if (adminMove !== null) {
      const d = S.deposits.find(x => x.id === adminMove);
      mode.hidden = false;
      mode.innerHTML = `Toque no mapa para escolher o novo lugar da jazida de ${ITEMS[d.ore].nome.toLowerCase()}. <button type="button" class="btn" data-admin="cancel">Cancelar</button>`;
    } else mode.hidden = true;
    let html = '';
    for (const d of S.deposits) {
      const left = countDeposit(d), near = playersNear(d);
      html += `<div class="row admin-row">
        <span class="sw" style="background:${ITEMS[d.ore].cor}"></span>
        <span class="name"><b>${ITEMS[d.ore].nome} · ${BIOMES[regionOf(d.x, d.y)].nome}</b>
          <small>Camada ${d.z} · ${d.active ? `restam ${left} blocos` : 'pausada'} · ${near} ${near === 1 ? 'jogador' : 'jogadores'} perto</small></span>
        <span class="admin-btns">
          <button type="button" class="btn" data-dep="move" data-id="${d.id}">Mover</button>
          <button type="button" class="btn" data-dep="toggle" data-id="${d.id}">${d.active ? 'Pausar' : 'Ativar'}</button>
          <button type="button" class="btn" data-dep="refill" data-id="${d.id}" ${d.active ? '' : 'disabled'}>Repor</button>
          <button type="button" class="btn" data-dep="goto" data-id="${d.id}">Ir</button>
        </span></div>`;
    }
    $('admin-deposits').innerHTML = html;
  }

  function adminDeposit(action, id) {
    const d = S.deposits.find(x => x.id === id);
    if (!d) return;
    const nome = ITEMS[d.ore].nome.toLowerCase();
    if (action === 'move') { adminMove = id; }
    else if (action === 'toggle') {
      if (d.active) { clearDeposit(d); d.active = false; toast(`Jazida de ${nome} pausada: o minério sumiu até você ativar`); }
      else { d.active = true; fillDeposit(d, S.tiles); toast(`Jazida de ${nome} ativada`); }
    } else if (action === 'refill') { fillDeposit(d, S.tiles); toast(`Jazida de ${nome} reposta`); }
    else if (action === 'goto') {
      const pos = grassNear(d.x, d.y, 0, 12);
      if (pos) { S.p.x = pos[0]; S.p.y = pos[1]; S.p.z = 0; for (let k = 0; k < 20; k++) waterTick(); closeSheet(); toast(`Você está sobre a jazida (camada ${d.z})`); return; }
    }
    renderAdmin();
  }
  function adminTool(action) {
    if (action === 'coins') { S.coins += 500; invDirty = true; toast('+500 moedas'); }
    else if (action === 'hour') { S.time += DAY_MS / 4; toast('Avançou 6 horas'); }
    else if (action === 'javali') {
      if (isDay()) { toast('O javali dourado só aparece à noite. Avance as horas primeiro.', 'warn'); return; }
      S.animals = S.animals.filter(a => a.kind !== 'javali');
      if (spawnAnimal(true, 'javali')) toast('Javali dourado chamado', 'gold');
    } else if (action === 'cancel') { adminMove = null; }
    renderAdmin();
  }
  $('minimap').addEventListener('click', e => {
    if (adminMove === null) return;
    const cv = $('minimap'), rect = cv.getBoundingClientRect();
    const x = Math.round((e.clientX - rect.left) / rect.width * W), y = Math.round((e.clientY - rect.top) / rect.height * H);
    const d = S.deposits.find(q => q.id === adminMove);
    clearDeposit(d);
    d.x = clamp(x, d.r + 3, W - d.r - 4); d.y = clamp(y, d.r + 3, H - d.r - 4);
    if (d.active) fillDeposit(d, S.tiles);
    adminMove = null;
    toast(`Jazida de ${ITEMS[d.ore].nome.toLowerCase()} movida para ${BIOMES[regionOf(d.x, d.y)].nome}`);
    renderAdmin();
  });
  $('clock').parentElement.addEventListener('click', secretTap);

  // ================= Escolha de personagem =================
  function renderChars(first) {
    const box = $('char-list');
    box.innerHTML = '';
    CHARACTERS.forEach(ch => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'char-card';
      b.setAttribute('aria-pressed', String(S.char === ch.id));
      const cv = document.createElement('canvas'); cv.width = 96; cv.height = 128;
      const c = cv.getContext('2d');
      const r = artRect(ch.id + '_front_idle');
      if (r) { const s2 = Math.min(84 / r[2], 120 / r[3]); c.imageSmoothingEnabled = true;
        c.drawImage(art, r[0], r[1], r[2], r[3], (96 - r[2] * s2) / 2, 124 - r[3] * s2, r[2] * s2, r[3] * s2); }
      const nm = document.createElement('span'); nm.textContent = ch.nome;
      b.append(cv, nm);
      b.addEventListener('click', () => {
        S.char = ch.id; save(); closeSheet();
        if (first) showSheet('sheet-help'); else toast(`Agora você joga com ${ch.nome}`, 'leaf');
      });
      box.append(b);
    });
    $('char-close').hidden = !!first;
  }
  function showChars(first) {
    showSheet('sheet-chars');
    if (art) renderChars(first);
    else { const t = setInterval(() => { if (art) { clearInterval(t); if (openSheet && openSheet.id === 'sheet-chars') renderChars(first); } }, 100); }
  }

  // ================= Entrada =================
  const held = { up: false, down: false, left: false, right: false };
  let actHeld = false, lastDir = null;
  const KEYMAP = { ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right' };

  window.addEventListener('keydown', e => {
    if (e.target && /^(INPUT|TEXTAREA)$/.test(e.target.tagName)) return;   // digitando em formulário
    if (openSheet && (openSheet.id === 'sheet-auth' || openSheet.id === 'sheet-banned' || (openSheet.id === 'sheet-chars' && !S.char))) return;
    if (openSheet) { if (e.code === 'Escape' || ((e.code === 'KeyB' || e.code === 'KeyI') && openSheet.id === 'sheet-shop') || (e.code === 'KeyR' && openSheet.id === 'sheet-build')) closeSheet(); return; }
    const d = KEYMAP[e.code];
    if (d) { held[d] = true; lastDir = d; e.preventDefault(); return; }
    if (e.code === 'Space') {
      e.preventDefault();
      if (!e.repeat && !actHeld && cooldown <= 0) useTool();
      actHeld = true;
      return;
    }
    if (e.repeat) return;
    if (e.code === 'KeyF') upDown();
    else if (/^Digit[1-9]$/.test(e.code)) { const k = +e.code.slice(5) - 1; if (!slotEls[k] || !slotEls[k].b.hidden) selectTool(k); }
    else if (e.code === 'KeyQ' || e.code === 'KeyE') {
      let k = S.tool;
      do k = (k + (e.code === 'KeyQ' ? -1 : 1) + TOOLS.length) % TOOLS.length; while (slotEls[k] && slotEls[k].b.hidden);
      selectTool(k);
    }
    else if (e.code === 'KeyB') showSheet('sheet-shop');
    else if (e.code === 'KeyI') showSheet('sheet-shop', null, 'bag');
    else if (e.code === 'KeyH') goHome();
    else if (e.code === 'KeyR') { S.tool = TOOLS.findIndex(t => t.id === 'muro'); invDirty = true; showSheet('sheet-build'); }
    else if (e.code === 'Digit0') secretTap();
  });
  window.addEventListener('keyup', e => {
    const d = KEYMAP[e.code];
    if (d) held[d] = false;
    if (e.code === 'Space') actHeld = false;
  });
  window.addEventListener('blur', () => { held.up = held.down = held.left = held.right = false; actHeld = false; });

  function bindHold(el, on, off) {
    el.addEventListener('pointerdown', e => { e.preventDefault(); try { el.setPointerCapture(e.pointerId); } catch (_) {} el.classList.add('on'); on(); });
    const end = () => { el.classList.remove('on'); off(); };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
    el.addEventListener('lostpointercapture', end);
  }
  document.querySelectorAll('.d').forEach(el => {
    const d = el.dataset.dir;
    bindHold(el, () => { held[d] = true; lastDir = d; }, () => { held[d] = false; });
  });
  bindHold($('btn-a'), () => { if (cooldown <= 0) useTool(); actHeld = true; }, () => { actHeld = false; });
  $('btn-f').addEventListener('click', () => upDown());

  function enableTouchUi() { $('touch').hidden = false; $('keys').hidden = true; }
  if (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) enableTouchUi();
  window.addEventListener('touchstart', enableTouchUi, { once: true, passive: true });

  $('btn-shop').addEventListener('click', () => showSheet('sheet-shop'));
  $('btn-bag').addEventListener('click', () => showSheet('sheet-shop', null, 'bag'));
  $('btn-home').addEventListener('click', () => goHome());
  $('toolname').addEventListener('click', () => { if (TOOLS[S.tool].id === 'muro') showSheet('sheet-build'); });
  $('btn-sethome').addEventListener('click', () => { closeSheet(); setHome(); });
  $('btn-menu').addEventListener('click', () => showSheet('sheet-menu'));
  $('btn-help').addEventListener('click', () => showSheet('sheet-help'));
  $('btn-char').addEventListener('click', () => showChars(false));
  $('btn-save').addEventListener('click', () => {
    const ok = save();
    toast(ok ? 'Jogo salvo' : 'Não foi possível salvar neste navegador', ok ? '' : 'warn');
    closeSheet();
  });
  $('btn-new').addEventListener('click', () => { $('confirm-new').hidden = false; });
  $('btn-new-no').addEventListener('click', () => { $('confirm-new').hidden = true; });
  $('btn-new-yes').addEventListener('click', () => { const keep = S.char; start(newWorld()); S.char = keep; save(); closeSheet(); toast('Mundo novo criado'); });
  document.querySelectorAll('.sheet').forEach(sh => {
    sh.addEventListener('click', e => {
      if (sh.id === 'sheet-chars' && !S.char && e.target === sh) return;   // primeira vez: precisa escolher
      if (sh.id === 'sheet-auth' || sh.id === 'sheet-banned') return;   // login e suspensão não fecham
      if (e.target === sh || e.target.closest('[data-close]')) { closeSheet(); return; }
      const sellBtn = e.target.closest('[data-sell]');
      if (sellBtn) { sell(sellBtn.dataset.sell); renderShop(); return; }
      if (e.target.closest('[data-sellall]')) { sellAll(); renderShop(); return; }
      const skBuy = e.target.closest('[data-skinbuy]');
      if (skBuy) { buySkin(skBuy.dataset.skinbuy); renderShop(); return; }
      const skBtn = e.target.closest('[data-skin]');
      if (skBtn) { S.skin = skBtn.dataset.skin === 'off' ? null : skBtn.dataset.skin; save(); renderShop(); return; }
      const tabBtn = e.target.closest('[data-tab]');
      if (tabBtn) { shopTab = tabBtn.dataset.tab; renderShop(); return; }
      const goBtn = e.target.closest('[data-tab-go]');
      if (goBtn) { shopTab = goBtn.dataset.tabGo; showSheet('sheet-shop'); return; }
      const kitBtn = e.target.closest('[data-buyk]');
      if (kitBtn) { buyKit(kitBtn.dataset.buyk); renderShop(); return; }
      const crBtn = e.target.closest('[data-craft]');
      if (crBtn) { craft(crBtn.dataset.craft); renderShop(); return; }
      const bsel = e.target.closest('[data-bsel]');
      if (bsel) {
        const [k, v] = bsel.dataset.bsel.split(':');
        S.sel = k === 'kit' ? { k, id: v } : { k, m: +v };
        S.tool = TOOLS.findIndex(t => t.id === 'muro'); invDirty = true; closeSheet();
        if (k === 'kit') hint('colocar', 'Fique de frente para o lugar: a prévia fica verde quando cabe. Use para construir.');
        return;
      }
      if (e.target.closest('[data-pickup]')) { closeSheet(); pickUp(); return; }
      const bp = e.target.closest('[data-bpick]') || e.target.closest('[data-bsell]');
      if (bp) {
        const sellIt = !!bp.dataset.bsell, [tag, idx] = (bp.dataset.bsell || bp.dataset.bpick).split(':');
        if (tag === 'bot') {
          const b = S.bots[+idx];
          if (b) { collectBot(b, true); S.bots.splice(+idx, 1);
            if (sellIt) { S.coins += Math.floor(BUILDS.robo.preco / 2); sfx('moeda'); toast(`Robô vendido: +${Math.floor(BUILDS.robo.preco / 2)} moedas`, 'gold'); }
            else { S.kit.robo = (S.kit.robo || 0) + 1; toast('Robô guardado', 'leaf'); }
            invDirty = true; save(); }
        } else if (S.builds[+idx]) removeBuild(S.builds[+idx], sellIt);
        renderBuild(); return;
      }
      const buyBtn = e.target.closest('[data-buy]');
      if (buyBtn) { buy(buyBtn.dataset.buy); renderShop(); return; }
      const depBtn = e.target.closest('[data-dep]');
      if (depBtn) { adminDeposit(depBtn.dataset.dep, +depBtn.dataset.id); return; }
      const admBtn = e.target.closest('[data-admin]');
      if (admBtn) adminTool(admBtn.dataset.admin);
    });
  });

  // ================= Tela =================
  let dpr = 1, vw = 0, vh = 0, tp = 48;
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    vw = canvas.clientWidth; vh = canvas.clientHeight;
    canvas.width = Math.round(vw * dpr); canvas.height = Math.round(vh * dpr);
    lightCv.width = canvas.width; lightCv.height = canvas.height;
    const css = clamp(Math.round(Math.min(vw, vh) / 11), 30, 56);
    tp = Math.max(16, Math.round(css * dpr / 4) * 4);   // tamanho do bloco em pixels do aparelho
  }
  window.addEventListener('resize', resize);

  function drawCrop(x0, y0, u, stage) {
    const g = '#6fbf4a', dg = '#4c9a34', wheat = '#e8c86a', wd = '#c9a240';
    const rows = [[3, 4], [9, 4], [3, 10], [9, 10]];
    for (const [rx, ry] of rows) {
      const bx = x0 + rx * u, by = y0 + ry * u;
      ctx.fillStyle = stage === 3 ? wd : dg;
      if (stage === 0) { ctx.fillStyle = g; ctx.fillRect(bx + 1 * u, by + 2 * u, 2 * u, 2 * u); }
      else if (stage === 1) { ctx.fillRect(bx + 1 * u, by, 1 * u, 4 * u); ctx.fillStyle = g; ctx.fillRect(bx, by + 1 * u, 3 * u, 1 * u); }
      else if (stage === 2) { ctx.fillRect(bx, by - 1 * u, 4 * u, 5 * u); ctx.fillStyle = g; ctx.fillRect(bx + 1 * u, by - 2 * u, 2 * u, 2 * u); }
      else { ctx.fillRect(bx + 1 * u, by, 2 * u, 4 * u); ctx.fillStyle = wheat; ctx.fillRect(bx, by - 2 * u, 4 * u, 3 * u); }
    }
  }

  // ---- versões com arte (quando o atlas carregou)
  const UNDER_ART = { [T.DIRT]: 'dirt', [T.STONE]: 'stone', [T.COAL]: 'coal', [T.BRONZE]: 'bronze', [T.IRON]: 'iron',
    [T.SILVER]: 'silver', [T.GOLD]: 'gold', [T.OIL]: 'oil', [T.DIAMOND]: 'diamond' };
  const WHEAT_H = [0.5, 0.72, 1.05, 1.05];
  function tileArt(t, x, y, z, sx, sy, v, objs) {
    if (!art) return false;
    if (z > 0 && UNDER_ART[t]) return drawTileArt(UNDER_ART[t], sx, sy, tp);
    const b = z === 0 ? BIOMES[S.biome[y * W + x]].id : null;
    const ground = () => drawTileArt(z > 0 ? 'floor_' + v : `ground_${b}_${v}`, sx, sy, tp);
    const cx = sx + tp / 2, bottom = sy + tp;
    switch (t) {
      case T.AIR: case T.GRASS: return ground();
      case T.TREE: ground(); objs.push([bottom, 'tree_' + b, cx, bottom - 0.04 * tp, 2.5 * tp]); return true;
      case T.SAPLING: ground(); objs.push([bottom, 'tree_' + b, cx, bottom - 0.06 * tp, 0.95 * tp]); return true;
      case T.ROCK: ground(); objs.push([bottom - 0.1 * tp, 'rock_' + b, cx, bottom - 0.08 * tp, 0.8 * tp]); return true;
      case T.TILLED: return drawTileArt('tilled_' + v, sx, sy, tp);
      case T.CROP: {
        drawTileArt('tilled_' + v, sx, sy, tp);
        const st = S.aux[y * W + x];
        objs.push([bottom - 0.05 * tp, 'wheat_' + st, cx, bottom - 0.02 * tp, WHEAT_H[st] * tp]);
        return true;
      }
      case T.WALL: case T.GATE:
        ground();
        objs.push([bottom, art2 ? wallFn(t, x, y, z, sx, sy) : 'wall', cx, bottom, 1.15 * tp]);
        return true;
      case T.HOLE: ground(); drawObj('hole', cx, sy + tp * 0.97, tp * 0.82); return true;
      case T.SOURCE:
        drawWater(x, y, z, sx, sy, SOURCE_LEVEL, performance.now(), curCam[0], curCam[1]);
        drawObj('spring', cx, sy + tp * 0.98, tp * 1.05);
        return true;
    }
    return false;
  }
  // altura (em blocos) do quadro mais alto de cada animal; todos os quadros usam a mesma escala
  const ANIMAL_H = { galinha: 0.85, coelho: 0.85, pintinho: 0.42, raposa: 0.85, cervo: 1.5, pavao: 1.3, javali: 0.95 };
  const ANIMAL_PX = 100;   // altura desse quadro no atlas (ver tools/build_atlas.py)
  const VIEW = ['front', 'back', 'side', 'side'];
  const frameCount = {};
  function framesOf(kind, view) {
    const key = kind + '_' + view;
    if (frameCount[key] === undefined) { let n = 0; while (ATLAS[`${key}_${n}`]) n++; frameCount[key] = n; }
    return frameCount[key];
  }
  function shadow(cx, cy, rx, ry) {
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
  }

  function drawAnimal(a, sx, sy, u) {
    if (art) {
      const mv = !!(a.vx || a.vy), now = performance.now();
      let view = VIEW[a.dir] || 'side';
      if (a.kind === 'pavao' && !mv && Math.floor(now / 4000 + a.x) % 3 !== 0) view = 'fan';   // parado, abre a cauda
      const n = framesOf(a.kind, view), tick = Math.floor(now / 140 + a.x * 3);
      const name = `${a.kind}_${view}_${mv ? tick % n : (view === 'fan' ? Math.floor(now / 500) % n : 0)}`;
      const r = artRect(name);
      if (r) {
        const k = ANIMAL_H[a.kind] * tp / ANIMAL_PX;
        const sw = view === 'side' ? 4.6 : 3.2;
        shadow(sx, sy + 3.6 * u, sw * u * (a.kind === 'pintinho' ? 0.5 : 1), 1.4 * u);
        const ok = mv && n === 1
          ? drawWalker(name, sx, sy + 4 * u, r[3] * k, false, now / 70 + a.x * 3)   // só um quadro: passo simulado
          : drawObj(name, sx, sy + 4 * u, r[3] * k, a.dir === 2);
        if (ok) return;
      }
    }
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(sx - 3 * u, sy + 3 * u, 6 * u, 1.5 * u);
    const f = a.dir === 2 ? -1 : 1;
    if (a.kind === 'pintinho') {
      ctx.fillStyle = '#f2d14b'; ctx.fillRect(sx - 1.5 * u, sy - 1 * u, 3 * u, 3 * u);
      ctx.fillStyle = '#e9a23b'; ctx.fillRect(sx + (f > 0 ? 1.5 : -2) * u, sy, 0.6 * u, 0.6 * u);
      return;
    }
    if (a.kind === 'galinha') {
      ctx.fillStyle = '#f2efe6'; ctx.fillRect(sx - 3 * u, sy - 2 * u, 6 * u, 5 * u);
      ctx.fillRect(sx + (f > 0 ? 1 : -3) * u, sy - 5 * u, 2 * u, 3 * u);
      ctx.fillStyle = '#d8443a'; ctx.fillRect(sx + (f > 0 ? 1 : -3) * u, sy - 6 * u, 2 * u, 1 * u);
      ctx.fillStyle = '#e9a23b'; ctx.fillRect(sx + (f > 0 ? 3 : -4) * u, sy - 4 * u, 1 * u, 1 * u);
      ctx.fillStyle = '#d9d4c6'; ctx.fillRect(sx - 1 * u, sy - 1 * u, 3 * u, 2 * u);
    } else if (a.kind === 'raposa') {
      ctx.fillStyle = '#e07a32'; ctx.fillRect(sx - 3 * u, sy - 2 * u, 6 * u, 4 * u);
      ctx.fillRect(sx + (f > 0 ? 2 : -5) * u, sy - 4 * u, 3 * u, 3 * u);
      ctx.fillRect(sx + (f > 0 ? 2 : -4) * u, sy - 6 * u, 1 * u, 2 * u);
      ctx.fillRect(sx + (f > 0 ? 4 : -2) * u, sy - 6 * u, 1 * u, 2 * u);
      ctx.fillRect(sx + (f > 0 ? -6 : 3) * u, sy - 3 * u, 3 * u, 2 * u);
      ctx.fillStyle = '#f6efe2'; ctx.fillRect(sx + (f > 0 ? -6 : 5) * u, sy - 3 * u, 1 * u, 2 * u);
      ctx.fillRect(sx + (f > 0 ? 3 : -4) * u, sy - 2 * u, 2 * u, 1 * u);
      ctx.fillStyle = '#1c1410'; ctx.fillRect(sx + (f > 0 ? 4 : -4) * u, sy - 3 * u, 1 * u, 1 * u);
    } else if (a.kind === 'cervo') {
      ctx.fillStyle = '#9a6a40'; ctx.fillRect(sx - 4 * u, sy - 3 * u, 8 * u, 4 * u);
      ctx.fillRect(sx - 3 * u, sy + 1 * u, 1 * u, 2 * u); ctx.fillRect(sx + 2 * u, sy + 1 * u, 1 * u, 2 * u);
      ctx.fillRect(sx + (f > 0 ? 3 : -5) * u, sy - 7 * u, 2 * u, 5 * u);
      ctx.fillStyle = '#d9c7a4';
      ctx.fillRect(sx + (f > 0 ? 2 : -6) * u, sy - 10 * u, 1 * u, 3 * u); ctx.fillRect(sx + (f > 0 ? 5 : -3) * u, sy - 10 * u, 1 * u, 3 * u);
      ctx.fillRect(sx + (f > 0 ? 1 : -7) * u, sy - 10 * u, 2 * u, 1 * u); ctx.fillRect(sx + (f > 0 ? 5 : -3) * u, sy - 10 * u, 2 * u, 1 * u);
      ctx.fillStyle = '#efe2c8'; ctx.fillRect(sx - 2 * u, sy - 2 * u, 2 * u, 1 * u);
      ctx.fillStyle = '#1c1410'; ctx.fillRect(sx + (f > 0 ? 4 : -4) * u, sy - 6 * u, 1 * u, 1 * u);
    } else if (a.kind === 'pavao') {
      ctx.fillStyle = '#2a8a6a';
      ctx.fillRect(sx + (f > 0 ? -7 : 2) * u, sy - 6 * u, 5 * u, 8 * u);
      ctx.fillStyle = '#e8c84a';
      for (const [ox, oy] of [[1, 1], [3, 3], [1, 5], [3, -1]]) ctx.fillRect(sx + (f > 0 ? -7 + ox : 2 + ox) * u, sy + (-6 + oy + 1) * u, 1 * u, 1 * u);
      ctx.fillStyle = '#2f6fd8'; ctx.fillRect(sx - 2 * u, sy - 2 * u, 5 * u, 4 * u);
      ctx.fillRect(sx + (f > 0 ? 1 : -2) * u, sy - 6 * u, 2 * u, 4 * u);
      ctx.fillStyle = '#7ad0ff'; ctx.fillRect(sx + (f > 0 ? 1 : -2) * u, sy - 7 * u, 2 * u, 1 * u);
      ctx.fillStyle = '#e9a23b'; ctx.fillRect(sx + (f > 0 ? 3 : -3) * u, sy - 5 * u, 1 * u, 1 * u);
    } else if (a.kind === 'javali') {
      ctx.fillStyle = '#c9952a'; ctx.fillRect(sx - 5 * u, sy - 3 * u, 10 * u, 5 * u);
      ctx.fillStyle = '#f2c84b'; ctx.fillRect(sx - 4 * u, sy - 4 * u, 8 * u, 5 * u);
      ctx.fillRect(sx + (f > 0 ? 3 : -7) * u, sy - 3 * u, 4 * u, 4 * u);
      ctx.fillStyle = '#fff3c4'; ctx.fillRect(sx - 2 * u, sy - 4 * u, 4 * u, 1 * u);
      ctx.fillStyle = '#ffffff'; ctx.fillRect(sx + (f > 0 ? 6 : -7) * u, sy, 1 * u, 2 * u);
      ctx.fillStyle = '#8a5a12';
      ctx.fillRect(sx - 4 * u, sy + 2 * u, 2 * u, 2 * u); ctx.fillRect(sx + 2 * u, sy + 2 * u, 2 * u, 2 * u);
      ctx.fillStyle = '#1c1410'; ctx.fillRect(sx + (f > 0 ? 5 : -6) * u, sy - 2 * u, 1 * u, 1 * u);
    } else {
      ctx.fillStyle = '#a07a58'; ctx.fillRect(sx - 3 * u, sy - 2 * u, 6 * u, 4 * u);
      ctx.fillRect(sx + (f > 0 ? 1 : -4) * u, sy - 4 * u, 3 * u, 3 * u);
      ctx.fillRect(sx + (f > 0 ? 1 : -3) * u, sy - 7 * u, 1 * u, 3 * u);
      ctx.fillRect(sx + (f > 0 ? 3 : -1) * u, sy - 7 * u, 1 * u, 3 * u);
      ctx.fillStyle = '#efe6da'; ctx.fillRect(sx + (f > 0 ? -4 : 3) * u, sy - 1 * u, 1 * u, 1 * u);
      ctx.fillStyle = '#1c1410'; ctx.fillRect(sx + (f > 0 ? 3 : -3) * u, sy - 3 * u, 1 * u, 1 * u);
    }
  }

  // Golpe com a ferramenta que está na mão: o ícone gira num arco a partir da mão do personagem
  const SWING_TIME = 0.18;
  // Ferramenta na mão enquanto anda ou fica parado (o golpe usa drawSwing).
  // O ponto da mão de cada pose e o cabo de cada ferramenta vêm do atlas (tools/build_atlas.py).
  // A ferramenta é desenhada atrás do personagem: a mão fica por cima do cabo e parece segurar.
  const HOLD_ANGLE = [1.82, -1.15, -0.75, -0.75];   // de frente: pendurada na mão, cabeça para baixo   // direção cabo→ponta (para a esquerda é espelhado)
  // Desenha a ferramenta com o cabo no ponto da mão e devolve esse ponto (ou null)
  function drawHeld(tool, sprite, cx, bottom, h, flip, dir, moving, phase) {
    const r = artRect('icon_' + tool), g = ATLAS['grip_' + tool], hp = ATLAS['hand_' + sprite], sr = artRect(sprite);
    if (!r || !g || !hp || !sr) return null;
    const k = h / sr[3], w = sr[2] * k;
    const hx = flip ? cx + w / 2 - hp[0] * k : cx - w / 2 + hp[0] * k;
    const hy = bottom - h + hp[1] * k;
    const len = Math.hypot(g[2] - g[0], g[3] - g[1]);
    const s = (dir === 0 ? 0.5 : 0.62) * tp / len;   // de frente, pendurada, um pouco menor
    const want = HOLD_ANGLE[dir] + (moving ? Math.sin(phase) * 0.1 : 0);
    ctx.save();
    ctx.translate(hx, hy);
    if (dir === 2) ctx.scale(-1, 1);   // virado para a esquerda: espelha, a lâmina continua para a frente
    ctx.rotate(want - Math.atan2(g[3] - g[1], g[2] - g[0]));
    ctx.scale(s, s);
    // de frente a mão segura perto da ponta do cabo (o atlas guarda a pegada a 30% do cabo)
    const gx = dir === 0 && g.length > 4 ? g[4] : g[0], gy = dir === 0 && g.length > 4 ? g[5] : g[1];
    ctx.drawImage(art, r[0], r[1], r[2], r[3], -gx, -gy, r[2], r[3]);
    ctx.restore();
    return [hx, hy, dir === 2 ? Math.PI - want : want];
  }
  // Redesenha só o punho (do próprio sprite) por cima do cabo: os dedos fecham sobre ele
  function drawHandOver(sprite, cx, bottom, h, flip) {
    const hp = ATLAS['hand_' + sprite], sr = artRect(sprite);
    if (!hp || !sr) return;
    const k = h / sr[3], w = sr[2] * k, R = 5;
    const x0 = Math.max(0, hp[0] - R), y0 = Math.max(0, hp[1] - R);
    const pw = Math.min(sr[2] - x0, 2 * R + 1), phh = Math.min(sr[3] - y0, 2 * R + 1);
    const dx = flip ? cx + w / 2 - (x0 + pw) * k : cx - w / 2 + x0 * k, dy = bottom - h + y0 * k;
    ctx.save();
    ctx.beginPath(); ctx.ellipse(dx + pw * k / 2, dy + phh * k / 2, pw * k / 2, phh * k / 2, 0, 0, Math.PI * 2); ctx.clip();
    if (flip) { ctx.translate(dx + pw * k, dy); ctx.scale(-1, 1); ctx.drawImage(art, sr[0] + x0, sr[1] + y0, pw, phh, 0, 0, pw * k, phh * k); }
    else ctx.drawImage(art, sr[0] + x0, sr[1] + y0, pw, phh, dx, dy, pw * k, phh * k);
    ctx.restore();
  }
  // Capacete (folha capacete.png): encaixado no topo da cabeça de cada pose
  function drawHelmet(sprite, cx, bottom, h, flip, dir) {
    const view = dir === 0 ? 'front' : dir === 1 ? 'back' : 'side';
    const r = artRect('helmet_' + view), hb = ATLAS['head_' + sprite], sr = artRect(sprite);
    if (!r || !hb || !sr) return false;
    const k = h / sr[3], w = sr[2] * k;
    const hx = flip ? cx + w / 2 - hb[0] * k : cx - w / 2 + hb[0] * k;
    const top = bottom - h + hb[1] * k;
    const hw = hb[2] * k * 1.18, hh = hw * r[3] / r[2];
    ctx.save();
    ctx.translate(hx, 0);
    if (dir === 2) ctx.scale(-1, 1);
    ctx.drawImage(art, r[0], r[1], r[2], r[3], -hw / 2, top - hh * 0.22, hw, hh);
    ctx.restore();
    return true;
  }
  // Punho desenhado (folha de mãos) por cima do cabo, girado na direção do cabo
  function drawFistArt(at, u) {
    const r = artRect('fist_' + look());
    if (!r) return false;
    const w = 2.1 * u, h = w * r[3] / r[2];
    ctx.save();
    ctx.translate(at[0], at[1]);
    ctx.rotate(at[2] - Math.PI / 2);
    ctx.drawImage(art, r[0], r[1], r[2], r[3], -w / 2, -h / 2, w, h);
    ctx.restore();
    return true;
  }
  // Punho fechado sobre o cabo, na cor da pele do personagem
  function drawFist(at, u) {
    const sk = ATLAS['skin_' + (S.char || 'menino')] || [220, 170, 130];
    const fw = 2.6 * u, fh = 2.4 * u, x = at[0] - fw / 2, y = at[1] - fh / 2;
    ctx.fillStyle = `rgb(${Math.round(sk[0] * 0.45)},${Math.round(sk[1] * 0.45)},${Math.round(sk[2] * 0.45)})`;
    ctx.fillRect(x - 0.5 * u, y - 0.5 * u, fw + u, fh + u);                       // contorno
    ctx.fillStyle = `rgb(${sk[0]},${sk[1]},${sk[2]})`;
    ctx.fillRect(x, y, fw, fh);
    ctx.fillStyle = `rgba(0,0,0,0.25)`;                                            // dobras dos dedos
    ctx.fillRect(x, y + fh * 0.45, fw, Math.max(1, 0.35 * u));
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillRect(x + 0.3 * u, y + 0.3 * u, fw * 0.5, Math.max(1, 0.35 * u));
  }

  function drawSwing(tool, sx, sy, u, dir) {
    const r = artRect('icon_' + tool);
    if (!r) return false;
    const k = clamp(1 - swing / SWING_TIME, 0, 1);
    const size = 0.78 * tp, side = dir === 2 ? -1 : 1;
    const hand = dir === 0 ? [3.5 * u, -2 * u] : dir === 1 ? [-3.5 * u, -4 * u] : [3 * u * side, -3 * u];
    ctx.save();
    ctx.translate(sx + hand[0], sy + hand[1]);
    if (dir === 2) ctx.scale(-1, 1);
    // de cima para a frente: começa erguida atrás da cabeça e desce até o alvo
    const a0 = dir === 1 ? -0.4 : -1.9, a1 = dir === 1 ? 0.9 : 0.35;
    ctx.rotate(a0 + (a1 - a0) * (k * k * (3 - 2 * k)));
    // os ícones são desenhados na diagonal (cabo embaixo à esquerda): o cabo fica na mão
    ctx.rotate(Math.PI / 4);
    ctx.translate(-size * 0.18 + size / 2, -size * 0.92 + size / 2);
    if (tool === 'enxada') ctx.rotate(Math.PI);   // o ícone da enxada vem com a lâmina embaixo
    ctx.drawImage(art, r[0], r[1], r[2], r[3], -size / 2, -size / 2, size, size);
    ctx.restore();
    return true;
  }

  function drawPlayer(sx, sy, u, dir, moving, phase) {
    if (art) {
      const tool = TOOLS[S.tool].id;
      const acting = swing > 0 && tool !== 'muro';
      const c = look();
      const cnt = v => framesOf(c, v + '_walk');
      let name, flip = dir === 2;
      if (acting) {
        const early = swing > SWING_TIME * 0.45;   // primeira metade do golpe: braço erguido
        name = dir === 0 ? (early && ATLAS[`${c}_swing_front`] ? `${c}_swing_front` : `${c}_front_idle`)
          : dir === 1 ? (early ? `${c}_swing_up` : `${c}_back_idle`)
          : (early ? `${c}_side_idle` : `${c}_swing_side`);
      } else {
        const view = dir === 0 ? 'front' : dir === 1 ? 'back' : 'side';
        const n = cnt(view);
        if (!moving || !n) name = `${c}_${view}_idle`;
        else if (n <= 2) {   // poucos quadros: alterna e espelha para trocar o pé
          const step = Math.floor(phase / 1.6) & 3;
          name = `${c}_${view}_walk_${step & 1 ? n - 1 : 0}`;
          if (view !== 'side' && step === 3) flip = true;
        } else name = `${c}_${view}_walk_${Math.floor(phase / 1.4) % n}`;
      }
      const bob = 0;
      shadow(sx, sy + 5.6 * u, 4.4 * u, 1.5 * u);
      const toolDrawn = acting && dir === 1 && drawSwing(tool, sx, sy, u, dir);   // de costas: ferramenta atrás do corpo
      const ph = 1.5 * tp * (artRect(name) ? artRect(name)[3] / 104 : 1);
      const ranged = (tool === 'arco' || tool === 'cetro') && S.owned[tool];
      const holding = !acting && tool !== 'maos' && tool !== 'muro' && !ranged;
      // de lado e de costas: ferramenta atrás do corpo, com o cabo passando pelo punho
      let grip = null;
      if (holding && dir !== 0) grip = drawHeld(tool, name, sx, sy + 6 * u, ph, flip, dir, moving, phase);
      if (ranged && dir === 1) drawWeapon(tool, name, sx, sy + 6 * u, ph, flip, dir);
      const drawn = drawObj(name, sx, sy + 6 * u, ph, flip);
      if (ranged && dir !== 1 && drawn) drawWeapon(tool, name, sx, sy + 6 * u, ph, flip, dir);
      // de frente: pendurada na mão ao lado da perna
      if (holding && dir === 0 && drawn) grip = drawHeld(tool, name, sx, sy + 6 * u, ph, flip, dir, moving, phase);
      // punho fechado por cima do cabo (de costas a mão fica do outro lado do cabo)
      if (grip && dir !== 1 && !drawFistArt(grip, u) && dir === 0) drawHandOver(name, sx, sy + 6 * u, ph, flip);
      if (drawn) {
        if (acting && !toolDrawn) drawSwing(tool, sx, sy, u, dir);
        if (S.owned.capacete && !drawHelmet(name, sx, sy + 6 * u, ph, flip, dir)) {   // sem arte do capacete: versão simples
          ctx.fillStyle = '#e3b23c'; ctx.fillRect(sx - 3.6 * u, sy - 17.6 * u - bob, 7.2 * u, 2.4 * u);
          ctx.fillStyle = '#fff6c8'; ctx.fillRect(sx - 1 * u, sy - 17.2 * u - bob, 2 * u, 1.4 * u);
        }
        return;
      }
    }
    const bob = moving ? Math.round(Math.sin(phase * 2)) * u * 0.5 : 0;
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.fillRect(sx - 4 * u, sy + 5 * u, 8 * u, 2 * u);
    const x0 = sx - 4 * u, y0 = sy - 9 * u + bob;
    const step = moving ? Math.round(Math.sin(phase)) : 0;
    ctx.fillStyle = '#34405e';
    ctx.fillRect(x0 + 1 * u, y0 + 12 * u, 2.5 * u, (3 + step * 0.8) * u);
    ctx.fillRect(x0 + 4.5 * u, y0 + 12 * u, 2.5 * u, (3 - step * 0.8) * u);
    ctx.fillStyle = '#c85a3c'; ctx.fillRect(x0, y0 + 6 * u, 8 * u, 6.5 * u);
    ctx.fillStyle = '#a8462d'; ctx.fillRect(x0, y0 + 11 * u, 8 * u, 1.5 * u);
    ctx.fillStyle = '#e8b48a'; ctx.fillRect(x0 + 1 * u, y0 + 0.5 * u, 6 * u, 6 * u);
    ctx.fillStyle = S.owned.capacete ? '#e3b23c' : '#4a2e1c';
    ctx.fillRect(x0 + 0.5 * u, y0, 7 * u, (dir === 1 ? 6 : 2.2) * u);
    if (S.owned.capacete && dir !== 1) { ctx.fillStyle = '#fff6c8'; ctx.fillRect(x0 + 3 * u, y0 + 0.4 * u, 2 * u, 1.2 * u); }
    ctx.fillStyle = '#1c1410';
    if (dir === 0) { ctx.fillRect(x0 + 2.4 * u, y0 + 3.5 * u, 1 * u, 1.2 * u); ctx.fillRect(x0 + 4.6 * u, y0 + 3.5 * u, 1 * u, 1.2 * u); }
    else if (dir === 2) ctx.fillRect(x0 + 1.8 * u, y0 + 3.5 * u, 1 * u, 1.2 * u);
    else if (dir === 3) ctx.fillRect(x0 + 5.2 * u, y0 + 3.5 * u, 1 * u, 1.2 * u);
    // ferramenta na mão
    const d = DIRS[dir], reach = swing > 0 ? 3 : 1.5;
    ctx.fillStyle = TOOLS[S.tool].id === 'muro' ? '#8a5a32' : '#b9bec6';
    ctx.fillRect(sx + d[0] * reach * u + (d[0] === 0 ? 3 * u : -1 * u), sy + d[1] * reach * u - 1 * u, 2 * u, 2 * u);
  }

  function drawNpc(n, sx, sy, u) {
    if (art) {
      const id = n.def.id;
      const name = id === 'lia' && n.face === 1 ? 'lia_back' : `${id}_0`;
      shadow(sx, sy + 5.6 * u, 4.6 * u, 1.5 * u);
      // vira para o lado em que anda (espelha) e dá passos simulados
      const flip = n.face === 2;
      const ok = n.moving ? drawWalker(name, sx, sy + 6 * u, 1.55 * tp, flip, n.phase * 0.9)
        : drawObj(name, sx, sy + 6 * u, 1.55 * tp, flip);
      if (ok) return;
    }
    const m = n.def, dir = n.face;
    const step = n.moving ? Math.round(Math.sin(n.phase)) : 0;
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.fillRect(sx - 4 * u, sy + 5 * u, 8 * u, 2 * u);
    const x0 = sx - 4 * u, y0 = sy - 9 * u;
    ctx.fillStyle = '#3a3026';
    ctx.fillRect(x0 + 1 * u, y0 + 12 * u, 2.5 * u, (3 + step * 0.8) * u);
    ctx.fillRect(x0 + 4.5 * u, y0 + 12 * u, 2.5 * u, (3 - step * 0.8) * u);
    ctx.fillStyle = m.cor; ctx.fillRect(x0, y0 + 6 * u, 8 * u, 6.5 * u);
    ctx.fillStyle = '#7a5232';                       // bolsa de mercador
    ctx.fillRect(dir === 2 ? x0 + 6 * u : x0 - 1 * u, y0 + 8 * u, 3 * u, 4 * u);
    ctx.fillStyle = '#d9a77c'; ctx.fillRect(x0 + 1 * u, y0 + 0.5 * u, 6 * u, 6 * u);
    ctx.fillStyle = m.chapeu;                        // chapéu de aba larga
    ctx.fillRect(x0 - 1 * u, y0 + 0.5 * u, 10 * u, 1.5 * u);
    ctx.fillRect(x0 + 1 * u, y0 - 1.5 * u, 6 * u, 2 * u);
    ctx.fillStyle = '#1c1410';
    if (dir === 0) { ctx.fillRect(x0 + 2.4 * u, y0 + 3.5 * u, 1 * u, 1.2 * u); ctx.fillRect(x0 + 4.6 * u, y0 + 3.5 * u, 1 * u, 1.2 * u); }
    else if (dir === 2) ctx.fillRect(x0 + 1.8 * u, y0 + 3.5 * u, 1 * u, 1.2 * u);
    else if (dir === 3) ctx.fillRect(x0 + 5.2 * u, y0 + 3.5 * u, 1 * u, 1.2 * u);
  }

  // ---- Construções (atlas de estruturas)
  function art2Rect(name) { return art2 && ATLAS2[name]; }
  function buildRect(b, name, camX, camY) {
    const d = BUILDS[b.k], r = ATLAS2[name];
    let w, cx, bottom;
    if (d.tipo === 'casa' || d.tipo === 'forte') { w = d.w * tp; cx = (b.x + d.w / 2) * tp - camX; bottom = (b.y + d.h + d.pad) * tp - camY; }
    else if (b.k.startsWith('catapulta')) { w = 2.6 * tp; cx = (b.x + 1) * tp - camX; bottom = (b.y + 2.1) * tp - camY; }
    else if (d.tipo === 'torre') { w = 2.35 * tp; cx = (b.x + 1) * tp - camX; bottom = (b.y + 2.1) * tp - camY; }
    else { w = (d.dw || r[2] / 64) * tp; cx = (b.x + 0.5) * tp - camX; bottom = (b.y + 0.95) * tp - camY; }
    const h = w * r[3] / r[2];
    return [cx - w / 2, bottom - h, w, h];
  }
  function drawBuild(b, name, camX, camY, alpha = 1) {
    const d = BUILDS[b.k], r = art2Rect(name);
    if (alpha !== 1) ctx.globalAlpha = alpha;
    if (r) {
      const [x, y, w, h] = buildRect(b, name, camX, camY);
      ctx.drawImage(art2, r[0], r[1], r[2], r[3], x, y, w, h);
    } else {   // sem a arte: só a forma, para continuar jogável
      const x0 = b.x * tp - camX, y0 = b.y * tp - camY, w = d.w * tp, h = d.h * tp;
      ctx.fillStyle = d.tipo === 'forte' ? 'rgba(110,90,70,0.35)' : '#8a5a32';
      if (d.tipo === 'casa' || d.tipo === 'forte') {
        ctx.beginPath(); ctx.moveTo(x0, y0 + h / 2); ctx.lineTo(x0 + w / 2, y0); ctx.lineTo(x0 + w, y0 + h / 2); ctx.lineTo(x0 + w / 2, y0 + h); ctx.closePath(); ctx.fill();
      } else ctx.fillRect(x0 + 2, y0 + 2, w - 4, h - 4);
    }
    ctx.globalAlpha = 1;
  }
  function pushBuilds(ents, camX, camY, W2, H2, backs) {
    const p = S.p, fronts = [];
    const home = insideOf(p.x, p.y, 'casa'), fort = insideOf(p.x, p.y, 'forte');
    for (const b of S.builds) {
      const d = BUILDS[b.k];
      const x0 = b.x * tp - camX, y0 = b.y * tp - camY;
      if (x0 > W2 + tp || y0 > H2 + 2 * tp || x0 + d.w * tp < -tp || y0 + d.h * tp < -d.w * tp) continue;
      const key = (b.y + d.h) * tp - camY;
      // topo do desenho (em blocos): só fica transparente se o jogador estiver mesmo atrás do desenho
      const rr = ATLAS2[d.tipo === 'forte' ? d.img + '_fundo' : d.img];
      const topY = rr ? b.y + d.h + d.pad - d.w * rr[3] / rr[2] : b.y;
      if (d.tipo === 'casa') {
        if (b === home) {
          ents.push({ y: y0 - 2, f: () => drawBuild(b, d.img + '_dentro', camX, camY) });
          backs.push({ b, d, key: y0 - 2 });
          continue;
        }
        // jogador atrás da casa: a casa fica meio transparente para ele não sumir
        const a = d.w / 2, ox = Math.abs(p.x - b.x - a);
        const behind = ox < a + 0.3 && p.y < b.y + d.h / 2 + (d.h / 2) * Math.max(0, 1 - ox / a) && p.y > topY + 0.4;
        ents.push({ y: key, f: () => drawBuild(b, d.img, camX, camY, behind ? 0.55 : 1) });
        fronts.push({ b, d, key });
      } else if (d.tipo === 'forte') {
        // muros altos: dentro do forte a frente fica transparente; atrás dele, o fundo
        const a = d.w / 2, ox = Math.abs(p.x - b.x - a);
        const behind = b !== fort && ox < a && p.y < b.y + d.h / 2 - (d.h / 2) * Math.max(0, 1 - ox / a) && p.y > topY + 0.4;
        if (ATLAS2[d.img + '_chao']) ents.push({ y: -1e9, f: () => drawBuild(b, d.img + '_chao', camX, camY) });   // terra na frente do portão: chão
        ents.push({ y: y0 - 3, f: () => drawBuild(b, d.img + '_fundo', camX, camY, behind ? 0.5 : 1) });
        ents.push({ y: key, f: () => drawBuild(b, d.img + '_frente', camX, camY, b === fort ? 0.42 : 1) });
        fronts.push({ b, d, key });
        backs.push({ b, d, key: y0 - 3 });
      } else if (d.tipo === 'armadilha') ents.push({ y: y0 - 1, f: () => drawBuild(b, d.img, camX, camY) });
      else if (b.k === 'catapulta') {
        const el = performance.now() - (b.fireAt || -1e9);
        const fr = el < 150 ? 1 : el < 330 ? 2 : el < 700 ? 3 : 0;
        ents.push({ y: key, f: () => drawBuild(b, 'catapulta_' + fr, camX, camY) });
      }
      else ents.push({ y: key, f: () => drawBuild(b, d.img, camX, camY) });
    }
    return fronts;
  }
  // prévia do que vai ser construído na frente do jogador (vermelho quando não cabe)
  function drawGhost(camX, camY) {
    if (TOOLS[S.tool].id !== 'muro' || S.sel.k !== 'kit' || openSheet || !(S.kit[S.sel.id] > 0)) return;
    const d = BUILDS[S.sel.id];
    if (d.tipo === 'robo') return;
    const c = candidate(S.sel.id), bad = placeProblem(c);
    const show = { k: d.tipo === 'forte' && d.arte ? d.arte : c.k, x: c.x, y: c.y };
    if (d.tipo === 'forte') { drawBuild(show, d.img + '_fundo', camX, camY, 0.5); drawBuild(show, d.img + '_frente', camX, camY, 0.5); }
    else drawBuild(show, d.img, camX, camY, 0.5);
    for (const [jk, ox, oy] of d.junto || []) drawBuild({ k: jk, x: c.x + ox, y: c.y + oy }, BUILDS[jk].img, camX, camY, 0.5);
    const x0 = c.x * tp - camX, y0 = c.y * tp - camY, w = d.w * tp, h = d.h * tp;
    ctx.strokeStyle = bad ? 'rgba(235,80,60,0.95)' : 'rgba(140,230,120,0.95)';
    ctx.lineWidth = Math.max(2, tp / 16);
    ctx.beginPath();
    if (d.tipo === 'casa' || d.tipo === 'forte') { ctx.moveTo(x0, y0 + h / 2); ctx.lineTo(x0 + w / 2, y0); ctx.lineTo(x0 + w, y0 + h / 2); ctx.lineTo(x0 + w / 2, y0 + h); ctx.closePath(); }
    else ctx.rect(x0, y0, w, h);
    ctx.stroke();
  }
  // muros: a peça horizontal ocupa um bloco; vizinhos se ligam (metades da peça horizontal + poste)
  function wallFn(t, x, y, z, sx, sy) {
    const i = I(x, y, z), mat = (WALL_MATS[S.wmat[i]] || WALL_MATS[0]).id;
    const isW = (xx, yy) => { const q = tileAt(xx, yy, z); return q === T.WALL || q === T.GATE; };
    const L = isW(x - 1, y), R = isW(x + 1, y), U = isW(x, y - 1), Dn = isW(x, y + 1);
    return () => {
      const k = tp / 96, bottom = sy + tp * 1.04, cx = sx + tp / 2;
      const hr = ATLAS2[`muro_${mat}_h`], vr = ATLAS2[`muro_${mat}_v`];
      const half = side => {
        const sw = hr[2] / 2, dh = hr[3] * k;
        if (side === 'L') ctx.drawImage(art2, hr[0], hr[1], sw, hr[3], sx - 0.5, bottom - dh, tp / 2 + 1, dh);
        else ctx.drawImage(art2, hr[0] + sw, hr[1], sw, hr[3], cx - 0.5, bottom - dh, tp / 2 + 1, dh);
      };
      const post = () => { const w = vr[2] * k, h = vr[3] * k; ctx.drawImage(art2, vr[0], vr[1], vr[2], vr[3], cx - w / 2, bottom - h, w, h); };
      if (t === T.GATE) {
        if (L) half('L'); if (R) half('R');
        const open = S.p.z === z && Math.hypot(S.p.x - x - 0.5, S.p.y - y - 0.5) < 1.8;
        const gr = ATLAS2[`muro_${mat}_${open ? 'aberto' : 'portao'}`], w = gr[2] * k, h = gr[3] * k;
        ctx.drawImage(art2, gr[0], gr[1], gr[2], gr[3], cx - w / 2, bottom - h, w, h);
        return;
      }
      if (L && R && !U && !Dn) { half('L'); half('R'); return; }
      if (L) half('L');
      if (R) half('R');
      if (U) { const w = vr[2] * k, h = vr[3] * k; ctx.drawImage(art2, vr[0], vr[1], vr[2], vr[3], cx - w / 2, bottom - h - tp * 0.5, w, h); }   // emenda com o de cima
      post();
    };
  }
  const BOT_VIEW = ['front', 'back', 'side', 'side'];
  function drawBot(b, sx, bottom) {
    const h = 1.5 * tp, flip = b.face === 2;
    let name;
    if (b.mode === 'dig') name = `robo_dig_${Math.floor(b.phase) % 4}`;
    else name = `robo_${BOT_VIEW[b.face]}_${b.moving ? Math.floor(b.phase) % 6 : 0}`;
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.beginPath(); ctx.ellipse(sx, bottom - tp * 0.04, tp * 0.32, tp * 0.1, 0, 0, Math.PI * 2); ctx.fill();
    if (drawObj(name, sx, bottom, h, flip)) return;
    ctx.fillStyle = '#8a9a3a'; ctx.fillRect(sx - tp * 0.25, bottom - tp * 1.1, tp * 0.5, tp * 1.1);
    ctx.fillStyle = '#9fd8e8'; ctx.fillRect(sx - tp * 0.18, bottom - tp * 1.0, tp * 0.36, tp * 0.25);
  }

  function drawLabel(text, sx, sy, u, col) {
    const fs = Math.max(10, Math.round(5 * u));
    ctx.font = `600 ${fs}px "Pixelify Sans", "Courier New", monospace`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const w = ctx.measureText(text).width + fs;
    ctx.fillStyle = 'rgba(20,17,15,0.85)';
    ctx.fillRect(Math.round(sx - w / 2), Math.round(sy - fs * 0.75), Math.round(w), Math.round(fs * 1.5));
    ctx.fillStyle = col; ctx.fillRect(Math.round(sx - w / 2), Math.round(sy + fs * 0.75) - 2, Math.round(w), 2);
    ctx.fillStyle = '#f4eadb'; ctx.fillText(text, sx, sy + 1);
  }

  // Setas na borda da tela apontando para compradores fora de vista
  function drawNpcArrows(camX, camY, W2, H2) {
    const top = 78 * dpr, bottom = H2 - ($('touch').hidden ? 150 : 270) * dpr, side = 18 * dpr;
    const px0 = S.p.x * tp - camX, py0 = S.p.y * tp - camY;
    for (const n of S.npcs) {
      const sx = n.x * tp - camX, sy = n.y * tp - camY;
      if (sx > 0 && sx < W2 && sy > top && sy < bottom) continue;
      const ang = Math.atan2(sy - py0, sx - px0);
      const cosA = Math.cos(ang), sinA = Math.sin(ang);
      const kx = cosA > 0 ? (W2 - side - px0) / cosA : (side - px0) / cosA;
      const ky = sinA > 0 ? (bottom - py0) / sinA : (top - py0) / sinA;
      const k = Math.min(Math.abs(kx), Math.abs(ky));
      const ax = px0 + cosA * k, ay = py0 + sinA * k, r = 11 * dpr;
      ctx.save();
      ctx.translate(ax, ay); ctx.rotate(ang);
      ctx.fillStyle = n.def.cor;
      ctx.beginPath(); ctx.moveTo(r + 8 * dpr, 0); ctx.lineTo(r - 2 * dpr, -7 * dpr); ctx.lineTo(r - 2 * dpr, 7 * dpr); ctx.closePath(); ctx.fill();
      ctx.restore();
      ctx.fillStyle = 'rgba(20,17,15,0.9)';
      ctx.beginPath(); ctx.arc(ax, ay, r, 0, Math.PI * 2); ctx.fill();
      ctx.lineWidth = 2 * dpr; ctx.strokeStyle = n.def.cor; ctx.stroke();
      ctx.fillStyle = '#f4eadb';
      ctx.font = `600 ${Math.round(12 * dpr)}px "Pixelify Sans", "Courier New", monospace`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(n.def.nome.replace('Dona ', '')[0], ax, ay + dpr);
      const dist = Math.round(Math.hypot(n.x - S.p.x, n.y - S.p.y));
      ctx.font = `${Math.round(10 * dpr)}px "Pixelify Sans", "Courier New", monospace`;
      const lx = clamp(ax, 24 * dpr, W2 - 24 * dpr), ly = ay + (ay > H2 / 2 ? -r - 8 * dpr : r + 9 * dpr);
      ctx.fillStyle = 'rgba(20,17,15,0.85)'; ctx.fillRect(lx - 16 * dpr, ly - 7 * dpr, 32 * dpr, 14 * dpr);
      ctx.fillStyle = '#f4eadb'; ctx.fillText(`${dist}m`, lx, ly + dpr);
    }
  }

  let moving = false, walkPhase = 0;

  const curCam = [0, 0];
  function render(now) {
    const p = S.p, z = p.z, u = tp / 16;
    const W2 = canvas.width, H2 = canvas.height;
    ctx.imageSmoothingEnabled = !!art;
    if (art) ctx.imageSmoothingQuality = 'high';
    const objs = [];   // árvores, pedras, plantas e muros: desenhados depois, ordenados por profundidade
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = z === 0 ? '#2a4a20' : '#120d0a';
    ctx.fillRect(0, 0, W2, H2);

    const camX = Math.round(p.x * tp - W2 / 2), camY = Math.round(p.y * tp - H2 * 0.46);
    curCam[0] = camX; curCam[1] = camY;
    const x0 = Math.max(0, Math.floor(camX / tp)), y0 = Math.max(0, Math.floor(camY / tp));
    const x1 = Math.min(W - 1, Math.ceil((camX + W2) / tp)), y1 = Math.min(H - 1, Math.ceil((camY + H2) / tp));
    const tl = S.tiles, wt = S.water, layer = z * W * H;

    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const i = layer + y * W + x, t = tl[i];
        const sx = x * tp - camX, sy = y * tp - camY;
        const v = (x * 7 + y * 13) & 3;
        if (!tileArt(t, x, y, z, sx, sy, v, objs)) {
          const key = z === 0 && (t === T.GRASS || t === T.TREE || t === T.ROCK || t === T.SAPLING)
            ? SPR_KEY[t] + '_' + BIOMES[S.biome[y * W + x]].id : SPR_KEY[t];
          ctx.drawImage(SPR[key][v], sx, sy, tp, tp);
          if (z === 0 && t === T.CROP) drawCrop(sx, sy, u, S.aux[y * W + x]);
        }
        if (z > 0) {
          if (!isSolidUnder(t)) {
            if (y > 0 && isSolidUnder(tl[i - W])) { ctx.fillStyle = 'rgba(0,0,0,0.38)'; ctx.fillRect(sx, sy, tp, 3 * u); }
            if (tl[i - W * H] === T.HOLE) {          // escada vinda de cima
              ctx.fillStyle = 'rgba(255,236,180,0.10)'; ctx.fillRect(sx, sy, tp, tp);
              ctx.fillStyle = '#a4703f';
              ctx.fillRect(sx + 5 * u, sy, u, tp); ctx.fillRect(sx + 10 * u, sy, u, tp);
              ctx.fillStyle = '#c08850';
              for (const ry of [2, 6, 10, 14]) ctx.fillRect(sx + 5 * u, sy + ry * u, 6 * u, u);
            }
          } else {
            // bloco sólido: topo com borda clara e face escura onde encosta num túnel
            const below = y < H - 1 ? tl[i + W] : t, above = y > 0 ? tl[i - W] : t;
            if (!isSolidUnder(above)) { ctx.fillStyle = 'rgba(255,255,255,0.16)'; ctx.fillRect(sx, sy, tp, u); }
            if (!isSolidUnder(below)) {
              ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(sx, sy + 11 * u, tp, 5 * u);
              ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(sx, sy + 13 * u, tp, u);
            }
            if (x > 0 && !isSolidUnder(tl[i - 1])) { ctx.fillStyle = 'rgba(0,0,0,0.28)'; ctx.fillRect(sx, sy, u, tp); }
            if (x < W - 1 && !isSolidUnder(tl[i + 1])) { ctx.fillStyle = 'rgba(0,0,0,0.28)'; ctx.fillRect(sx + tp - u, sy, u, tp); }
          }
        }
        const lv = wt[i];
        if (t === T.SOURCE && art) {
          // a fonte já foi desenhada com a água por baixo
        } else if (lv > 0 && art) {
          drawWater(x, y, z, sx, sy, lv, now, camX, camY);
        } else if (lv > 0) {
          const wave = Math.sin(now / 500 + x * 0.9 + y * 0.6) * 0.05;
          ctx.fillStyle = `rgba(52,138,222,${(0.42 + 0.4 * Math.min(lv, 10) / 10 + wave).toFixed(3)})`;
          ctx.fillRect(sx + u, sy + u, tp - 2 * u, tp - 2 * u);
          if (((x + y + Math.floor(now / 400)) % 5) === 0) { ctx.fillStyle = 'rgba(200,235,255,0.55)'; ctx.fillRect(sx + 4 * u, sy + 5 * u, 3 * u, u); }
        }
        if (t === T.SOURCE && !art && Math.floor(now / 300) % 2) { ctx.fillStyle = '#c8ecff'; ctx.fillRect(sx + 8 * u, sy + 8 * u, 2 * u, u); }
      }
    }

    // rachaduras de mineração
    for (const [i, hv] of hits) {
      const tz = Math.floor(i / (W * H));
      if (tz !== z) continue;
      const r = i - tz * W * H, x = r % W, y = (r - x) / W;
      const sx = x * tp - camX, sy = y * tp - camY, k = hv.h / hv.need;
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.fillRect(sx + 4 * u, sy + 6 * u, 6 * u, u); ctx.fillRect(sx + 7 * u, sy + 3 * u, u, 8 * u);
      if (k > 0.34) { ctx.fillRect(sx + 2 * u, sy + 11 * u, 5 * u, u); ctx.fillRect(sx + 10 * u, sy + 9 * u, u, 5 * u); }
      if (k > 0.66) { ctx.fillRect(sx + 11 * u, sy + 3 * u, 3 * u, u); ctx.fillRect(sx + 3 * u, sy + 2 * u, u, 4 * u); }
      // barra de progresso
      ctx.fillStyle = 'rgba(20,17,15,0.75)'; ctx.fillRect(sx + 2 * u, sy - 3 * u, 12 * u, 2 * u);
      ctx.fillStyle = '#efb941'; ctx.fillRect(sx + 2 * u, sy - 3 * u, 12 * u * k, 2 * u);
    }

    // alvo
    const tg = target();
    ctx.strokeStyle = 'rgba(255,240,200,0.75)';
    ctx.lineWidth = Math.max(1, Math.round(u * 0.75));
    ctx.strokeRect(tg.x * tp - camX + ctx.lineWidth / 2, tg.y * tp - camY + ctx.lineWidth / 2, tp - ctx.lineWidth, tp - ctx.lineWidth);

    // quem pisa na água fica com os pés submersos e faz ondinhas
    const inWater = (ex, ey) => z === 0 && wt[Math.floor(ey) * W + Math.floor(ex)] > 0;
    const wade = (ex, ey, footY, depth, rx, draw) => {
      if (!inWater(ex, ey)) { draw(); return; }
      ctx.save();
      ctx.beginPath(); ctx.rect(-1e4, -1e4, 2e4, footY - depth + 1e4); ctx.clip();
      draw();
      ctx.restore();
      const ph = now / 260 + ex * 3;
      const ecx = ex * tp - camX, ecy = footY - depth * 0.5;
      ctx.fillStyle = 'rgba(92,150,168,0.75)';                    // água cobrindo os pés
      ctx.beginPath(); ctx.ellipse(ecx, ecy, rx, depth * 0.6, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(235,248,255,0.9)'; ctx.lineWidth = Math.max(1, u * 0.8);
      ctx.beginPath(); ctx.ellipse(ecx, ecy, rx, depth * 0.6, 0, 0.1 * Math.PI, 0.9 * Math.PI); ctx.stroke();   // espuma na frente
      const k = (ph % 2) / 2;                                       // anel que se espalha
      ctx.strokeStyle = `rgba(235,248,255,${(0.6 * (1 - k)).toFixed(2)})`; ctx.lineWidth = Math.max(1, u * 0.6);
      ctx.beginPath(); ctx.ellipse(ecx, ecy, rx * (1.1 + 0.8 * k), depth * (0.65 + 0.45 * k), 0, 0, Math.PI * 2); ctx.stroke();
    };

    // árvores, animais, compradores e jogador ordenados pela base (quem está mais embaixo fica na frente)
    const ents = objs.map(o => ({ y: o[0], tx: (o[2] + camX) / tp, ty: (o[0] + camY) / tp - 0.5,
      f: typeof o[1] === 'function' ? o[1] : () => drawObj(o[1], o[2], o[3], o[4]) }));
    const backs = [], fronts = z === 0 ? pushBuilds(ents, camX, camY, W2, H2, backs) : [];
    if (z === 0) {
      // bandeira da casa
      const hx = S.home.x * tp - camX, hy = S.home.y * tp - camY;
      if (hx > -tp && hy > -tp && hx < W2 + tp && hy < H2 + tp) {
        ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(hx - 2 * u, hy + 5 * u, 5 * u, 1.5 * u);
        ctx.fillStyle = '#6b4426'; ctx.fillRect(hx - 1 * u, hy - 8 * u, 1.2 * u, 14 * u);
        ctx.fillStyle = '#efb941'; ctx.fillRect(hx + 0.2 * u, hy - 8 * u, 6 * u, 4 * u);
        ctx.fillStyle = '#c98f1e'; ctx.fillRect(hx + 0.2 * u, hy - 5 * u, 6 * u, 1 * u);
      }
      for (const a of S.animals) {
        const sx = a.x * tp - camX, sy = a.y * tp - camY;
        if (sx < -2 * tp || sy < -2 * tp || sx > W2 + 2 * tp || sy > H2 + 2 * tp) continue;
        ents.push({ y: sy + 4 * u, wx: a.x, wy: a.y, f: () => wade(a.x, a.y, sy + 4 * u, (a.kind === 'pintinho' ? 2 : 3) * u, (a.kind === 'pintinho' ? 2.5 : 5) * u, () => {
          drawAnimal(a, sx, sy, u);
          if (a.kind === 'pavao' || a.kind === 'javali') {   // brilho dos raros
            const ph = (now / 180 + a.x * 3) % 8;
            if (ph < 3) {
              ctx.fillStyle = 'rgba(255,248,200,0.95)';
              const gx = sx + (Math.sin(a.x * 9) * 5) * u, gy = sy - (art ? 14 : 8) * u - Math.cos(a.y * 7) * 2 * u;
              ctx.fillRect(gx - u, gy, 3 * u, u); ctx.fillRect(gx, gy - u, u, 3 * u);
            }
          }
        }) });
      }
      for (const n of S.npcs) {
        const sx = n.x * tp - camX, sy = n.y * tp - camY;
        if (sx < -2 * tp || sy < -2 * tp || sx > W2 + 2 * tp || sy > H2 + 2 * tp) continue;
        ents.push({ y: sy + 6 * u, wx: n.x, wy: n.y, f: () => wade(n.x, n.y, sy + 6 * u, 4 * u, 5.5 * u, () => drawNpc(n, sx, sy, u)) });
      }
    }
    const psx = p.x * tp - camX, psy = p.y * tp - camY;
    if (z === 0) for (const b of S.bots) {
      const bx = b.x * tp - camX, by = b.y * tp - camY;
      if (bx < -2 * tp || by < -3 * tp || bx > W2 + 2 * tp || by > H2 + 2 * tp) continue;
      ents.push({ y: by + 4 * u, wx: b.x, wy: b.y, f: () => drawBot(b, bx, by + 4 * u) });
    }
    ents.push({ y: psy + 6 * u, wx: p.x, wy: p.y, f: () => wade(p.x, p.y, psy + 6 * u, 4 * u, 5.5 * u, () => drawPlayer(psx, psy, u, p.dir, moving, walkPhase)) });
    ents.sort((e1, e2) => e1.y - e2.y);
    for (const e of ents) {   // árvores e bichos atrás do muro do fundo de um forte ficam atrás dele
      const ex = e.wx ?? e.tx, ey = e.wy ?? e.ty;
      if (ex === undefined) continue;
      for (const v of backs) {
        const a = v.d.w / 2, bb = v.d.h / 2, ox = Math.abs(ex - v.b.x - a);
        if (ox >= a + 0.4) continue;
        if (ey < v.b.y + bb - bb * Math.max(0, 1 - ox / a) + 0.05) e.y = Math.min(e.y, v.key - 0.5);
      }
    }
    for (const e of ents) if (e.wx !== undefined) for (const v of fronts) {
      // quem está na frente da parede da frente de uma casa ou forte é desenhado depois dela
      const a = v.d.w / 2, bb = v.d.h / 2, ox = Math.abs(e.wx - v.b.x - a);
      if (ox >= a + 0.4) continue;
      const fe = v.b.y + bb + bb * Math.max(0, 1 - ox / a);
      e.y = e.wy >= fe - 0.05 ? Math.max(e.y, v.key + 0.5) : Math.min(e.y, v.key - 0.5);
    }
    for (const e of ents) e.f();
    drawShots(camX, camY, now);
    if (z === 0) drawGhost(camX, camY);
    if (homing) {   // anel de progresso da volta para casa
      const k = clamp(1 - (homing.until - S.time) / HOME_CHANNEL, 0, 1);
      const cx = p.x * tp - camX, cy = p.y * tp - camY - 2 * u;
      ctx.lineWidth = Math.max(2, 1.2 * u);
      ctx.strokeStyle = 'rgba(20,17,15,0.6)';
      ctx.beginPath(); ctx.arc(cx, cy, 11 * u, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = '#efb941';
      ctx.beginPath(); ctx.arc(cx, cy, 11 * u, -Math.PI / 2, -Math.PI / 2 + k * Math.PI * 2); ctx.stroke();
    }

    // luz: noite na superfície, escuridão nas camadas de baixo
    let alpha, tint;
    if (z === 0) { alpha = clamp(-sun() * 0.95 + 0.12, 0, 0.78); tint = '10,14,34'; }
    else { alpha = z === 1 ? 0.8 : z <= 3 ? 0.88 : 0.94; tint = '6,4,3'; }
    if (alpha > 0.02) {
      lctx.globalCompositeOperation = 'source-over';
      lctx.clearRect(0, 0, W2, H2);
      lctx.fillStyle = `rgba(${tint},${alpha.toFixed(3)})`;
      lctx.fillRect(0, 0, W2, H2);
      lctx.globalCompositeOperation = 'destination-out';
      const glow = (gx, gy, rad, power) => {
        const g = lctx.createRadialGradient(gx, gy, 0, gx, gy, rad);
        g.addColorStop(0, `rgba(0,0,0,${power})`);
        g.addColorStop(0.55, `rgba(0,0,0,${power * 0.7})`);
        g.addColorStop(1, 'rgba(0,0,0,0)');
        lctx.fillStyle = g;
        lctx.fillRect(gx - rad, gy - rad, rad * 2, rad * 2);
      };
      const rad = (S.owned.capacete ? (z === 0 ? 7 : 6) : (z === 0 ? 4.2 : 3.2)) * tp;
      glow(p.x * tp - camX, p.y * tp - camY - 4 * u, rad, 1);
      if (S.owned.cetro && TOOLS[S.tool].id === 'cetro') glow(p.x * tp - camX, p.y * tp - camY - 10 * u, 6 * tp, 0.9);   // luz do mago
      for (const s2 of shots) if (s2.kind === 'magia' && s2.z === z) glow(s2.x * tp - camX, s2.y * tp - camY, 2.2 * tp, 0.9);
      if (z > 0) {
        const daylight = clamp(sun() * 0.6 + 0.6, 0.25, 1);
        for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
          if (tl[layer - W * H + y * W + x] === T.HOLE) glow((x + 0.5) * tp - camX, (y + 0.5) * tp - camY, 2.4 * tp, daylight);
        }
      } else {
        for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
          if (tl[y * W + x] === T.SOURCE) glow((x + 0.5) * tp - camX, (y + 0.5) * tp - camY, 1.6 * tp, 0.5);
        }
      }
      ctx.drawImage(lightCv, 0, 0);
    }

    // nomes dos compradores e setas (por cima da escuridão, para serem achados à noite)
    if (z === 0) {
      for (const n of S.npcs) {
        const sx = n.x * tp - camX, sy = n.y * tp - camY;
        if (sx < -tp || sy < -tp || sx > W2 + tp || sy > H2 + tp) continue;
        const near = (n.x - p.x) ** 2 + (n.y - p.y) ** 2 < 6.25;
        drawLabel(near ? `${n.def.nome} · Usar para vender` : n.def.nome, sx, sy - (art ? 23 : 14) * u, u, n.def.cor);
      }
      for (const b of S.builds) {   // "Usar para entrar" perto das paredes
        const d = BUILDS[b.k];
        if (d.tipo !== 'casa' && d.tipo !== 'forte') continue;
        const [qx, qy] = doorPoint(b);
        if (Math.hypot(qx - p.x, qy - p.y) > 2.2) continue;
        const inside = insideOf(p.x, p.y, d.tipo) === b;
        if (S.hints.porta) continue;
        drawLabel(inside ? 'Ande contra a parede: sair' : 'Ande contra a parede: entrar', qx * tp - camX, qy * tp - camY - 18 * u, u, '#c9a34a');
      }
      for (const b of S.bots) {
        const n = botCount(b);
        if (!n && !b.msg) continue;
        const bx = b.x * tp - camX, by = b.y * tp - camY;
        if (bx < -tp || by < -tp || bx > W2 + tp || by > H2 + tp) continue;
        drawLabel(n ? `Robô · ${n}${n >= ROBO_CAP ? ' (cheio)' : ''}` : 'Robô · sem minério', bx, by - 26 * u, u, '#c9a34a');
      }
      drawNpcArrows(camX, camY, W2, H2);
    }
  }

  // ================= Laço principal =================
  let last = performance.now(), accWater = 0, accFarm = 0, accSave = 0, accSpawn = 0, accHud = 0;

  function update(dt, now) {
    S.time += dt * 1000;
    cooldown -= dt; swing -= dt;
    const p = S.p;
    let vx = (held.right ? 1 : 0) - (held.left ? 1 : 0);
    let vy = (held.down ? 1 : 0) - (held.up ? 1 : 0);
    moving = !!(vx || vy) && !openSheet;
    if (moving) {
      if (lastDir && held[lastDir]) p.dir = { down: 0, up: 1, left: 2, right: 3 }[lastDir];
      else p.dir = vy > 0 ? 0 : vy < 0 ? 1 : vx < 0 ? 2 : 3;
      const len = Math.hypot(vx, vy);
      const slow = p.z === 0 && S.water[Math.floor(p.y) * W + Math.floor(p.x)] > 0 ? 0.6 : 1;   // anda mais devagar na água
      vx = vx / len * SPEED * slow * dt; vy = vy / len * SPEED * slow * dt;
      const ox = p.x, oy = p.y;
      if (canStand(p.x + vx, p.y, p.z, 0.3)) p.x += vx;
      if (canStand(p.x, p.y + vy, p.z, 0.3)) p.y += vy;
      // andando contra a parede de uma casa ou fortaleza: entra (ou sai) sozinho depois de um instante
      if (Math.hypot(p.x - ox, p.y - oy) < Math.hypot(vx, vy) * 0.3 && p.z === 0 && S.builds.length) {
        pushT += dt;
        if (pushT > 0.22) { pushT = -0.5; const door = doorAction(); if (door) door(); }   // -0.5: espera antes de repetir
      } else pushT = Math.min(0, pushT + dt);
      walkPhase += dt * 12;
    } else pushT = Math.min(0, pushT + dt);
    if (actHeld && cooldown <= 0 && !openSheet) useTool();

    accWater += dt; accFarm += dt; accSave += dt; accSpawn += dt; accHud += dt;
    if (accWater > 0.18) { accWater = 0; waterTick(); }
    if (accFarm > 1.5) { accFarm = 0; farmTick(); }
    if (accSpawn > 4) {
      accSpawn = 0;
      if (S.animals.length < ANIMAL_CAP) spawnAnimal(true);
      if (Math.random() < 1 / 3) legendCheck();   // checagem do lendário a cada ~12 s
    }
    if (accSave > 15) { accSave = 0; save(); }
    animalsTick(dt, now);
    botsTick(dt);
    shotsTick(dt, now);
    if (TOOLS[S.tool].id === 'cetro' && Math.floor(mana) !== lastMana) { lastMana = Math.floor(mana); invDirty = true; }
    if (S.owned.capacete && (p.z > 0 || !isDay())) {     // a bateria do capacete gasta no escuro
      S.dur.capacete = (S.dur.capacete ?? DUR.capacete) - dt;
      if (S.dur.capacete <= 0) { delete S.owned.capacete; delete S.dur.capacete; toast('A bateria do capacete acabou. Compre outro na loja.', 'warn', 4000); invDirty = true; }
    }
    npcTick(dt, now);
    homingTick();
    if (accHud > 0.25) { accHud = 0; updateHud(); }
    if (invDirty) {
      invDirty = false; updateHotbar(); $('coins').textContent = S.coins;
      if (openSheet && openSheet.id === 'sheet-shop') $('shop-coins').textContent = S.coins;
    }
  }

  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    update(dt, now);
    render(now);
    requestAnimationFrame(frame);
  }

  function start(state) {
    S = state;
    S.animals = [];
    for (let k = 0; k < 30; k++) spawnAnimal(false);
    for (let k = 0; k < 24; k++) waterTick();     // enche lagoas e valas existentes
    placeNpcs();
    homing = null;
    lastBiome = null;
    hits.clear();
    invDirty = true;
    updateHud();
  }

  document.addEventListener('visibilitychange', () => { if (document.hidden) save(true); });
  window.addEventListener('pagehide', () => save(true));

  // ================= Contas =================
  let authMode = 'in';   // 'in' entrar, 'up' criar conta, 'reset' pedir link, 'new' nova senha
  function setAuthMode(m) {
    authMode = m;
    $('auth-tab-in').setAttribute('aria-pressed', String(m === 'in')); $('auth-tab-in').classList.toggle('btn-gold', m === 'in');
    $('auth-tab-up').setAttribute('aria-pressed', String(m === 'up')); $('auth-tab-up').classList.toggle('btn-gold', m === 'up');
    $('auth-tab-in').parentElement.hidden = m === 'new';
    $('auth-name-row').hidden = m !== 'up';
    $('auth-email-row').hidden = m === 'new';
    $('auth-pass-row').hidden = m === 'reset';
    $('auth-pass-label').textContent = m === 'new' ? 'Nova senha' : 'Senha';
    $('auth-forgot').hidden = m !== 'in';
    $('auth-title').textContent = m === 'reset' ? 'Recuperar senha' : m === 'new' ? 'Criar nova senha' : 'Entrar em Terra Funda';
    $('auth-submit').textContent = { in: 'Entrar', up: 'Criar conta', reset: 'Enviar link para o e-mail', new: 'Salvar nova senha' }[m];
    $('auth-pass').autocomplete = m === 'in' ? 'current-password' : 'new-password';
    $('auth-msg').textContent = ''; $('auth-msg').className = 'auth-msg';
  }
  function askLogin(mode = 'in') {
    return new Promise(resolve => {
      setAuthMode(mode);
      openSheet = $('sheet-auth'); openSheet.hidden = false;
      $('auth-tab-in').onclick = () => setAuthMode('in');
      $('auth-tab-up').onclick = () => setAuthMode('up');
      $('auth-forgot').onclick = () => setAuthMode('reset');
      $('auth-form').onsubmit = async e => {
        e.preventDefault();
        const m = $('auth-msg'), btn = $('auth-submit');
        const email = $('auth-email').value.trim(), pass = $('auth-pass').value;
        if (authMode !== 'new' && !email) { m.textContent = 'Preencha o e-mail.'; return; }
        if (authMode !== 'reset' && pass.length < 6) { m.textContent = 'A senha precisa ter pelo menos 6 caracteres.'; return; }
        btn.disabled = true; m.className = 'auth-msg'; m.textContent = 'Aguarde…';
        try {
          if (authMode === 'reset') {
            await NET.resetPassword(email);
            setAuthMode('in');
            m.className = 'auth-msg ok'; m.textContent = 'Se esse e-mail tiver conta, enviamos um link. Abra o link para criar uma senha nova.';
            btn.disabled = false; return;
          }
          if (authMode === 'new') { await NET.updatePassword(pass); toast('Senha nova salva', 'leaf'); }
          else if (authMode === 'up') {
            const r = await NET.signUp(email, pass, $('auth-name').value);
            if (r.needsConfirm) { setAuthMode('in'); m.className = 'auth-msg ok'; m.textContent = 'Conta criada. Abra o link que enviamos para o seu e-mail e depois entre.'; btn.disabled = false; return; }
          } else await NET.signIn(email, pass);
          $('sheet-auth').hidden = true; openSheet = null;
          resolve();
        } catch (err) { m.className = 'auth-msg'; m.textContent = err.message; }
        btn.disabled = false;
      };
    });
  }
  function showBanned() {
    const b = NET.profile.banned_until;
    $('ban-text').textContent = (b === 'infinity' ? 'Sua conta foi banida.' : `Sua conta está suspensa até ${new Date(b).toLocaleString('pt-BR')}.`)
      + (NET.profile.ban_reason ? ' Motivo: ' + NET.profile.ban_reason + '.' : '');
    openSheet = $('sheet-banned'); openSheet.hidden = false;
    $('ban-logout').onclick = async () => { await NET.signOut(); location.reload(); };
  }
  function updateAccountUi() {
    const on = NET.enabled && NET.user;
    $('account-line').hidden = !on; $('btn-logout').hidden = !on;
    $('btn-staff').hidden = !(on && NET.isStaff);
    if (on) $('account-line').textContent = `Conectado como ${NET.profile ? NET.profile.username : NET.user.email}`
      + (!NET.profile && NET.profileError ? ` · perfil não carregou (${NET.profileError})` : '')
      + (NET.profile && NET.profile.codigo ? ` · seu código: ${NET.profile.codigo}` : '');
    $('save-note').textContent = on ? 'O progresso fica salvo na sua conta e neste navegador.' : 'O progresso é salvo neste navegador a cada 15 segundos.';
  }
  $('btn-logout').addEventListener('click', async () => { save(true); await new Promise(r => setTimeout(r, 400)); await NET.signOut(); location.reload(); });
  $('btn-staff').addEventListener('click', () => { closeSheet(); openStaff(); });

  // ?teste na URL: expõe o estado para testes automáticos
  if (/[?&]teste\b/.test(location.search)) window.TerraDebug = { get S() { return S; }, get pushT() { return pushT; }, doorAction, catapultInFront, useTool, target, placeKit, pickUp, candidate, placeProblem, showSheet, botMine, save };

  async function boot() {
    buildSprites();
    buildHotbar();
    resize();
    let data = null;
    if (NET.enabled) {
      start(newWorld());                  // mundo de fundo enquanto a pessoa entra
      requestAnimationFrame(frame);
      try { await NET.init(); } catch (e) { /* sem rede: segue para o login */ }
      if (!NET.user) await askLogin();
      else if (NET.recovery) await askLogin('new');   // veio do link de recuperar senha
      if (NET.banned) { showBanned(); return; }
      const local = readLocal();
      let cloud = null;
      try { cloud = await NET.loadSave(); } catch (e) { /* sem rede: usa o do navegador */ }
      data = cloud && (!local || (cloud.data.savedAt || cloud.updatedAt) >= (local.savedAt || 0)) ? cloud.data : local;
    } else data = readLocal();
    const loaded = load(data);
    start(loaded || newWorld());
    bootPending = false;
    updateAccountUi();
    if (!loaded || !S.char) {
      showChars(true); save();
      if (oldSaveFound) toast('O mapa ficou 6 vezes maior, com biomas novos: um mundo novo foi criado.', 'gold', 6000);
    } else toast(NET.user && NET.profile ? `Bem-vindo de volta, ${NET.profile.username}` : 'Bem-vindo de volta');
    if (!NET.enabled) requestAnimationFrame(frame);
  }
  boot();
})();
