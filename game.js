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
    { id: 'livro', nome: 'Livro de cura' },
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
    { id: 'livro', nome: 'Livro de cura', desc: 'Suporte: não ataca, cura você e os aliados em volta. Com experiência cura mais longe, restaura construções e fortifica a base.', preco: 7000 },
    { id: 'cetro', nome: 'Cetro mágico', desc: 'Vira mago: a magia atordoa animais de longe (a rede pega na certa), ilumina a noite e recarrega sozinha.', preco: 9000 },
  ];
  // Desgaste: as ferramentas da loja acabam e precisam ser compradas de novo (incentiva gastar moedas).
  // As simples (picareta, machado, enxada e espada iniciais) também gastam, mas dá para fazer outra na Mochila.
  const DUR = { arco: 300, cetro: 400, livro: 400, pick1: 400, pick2: 600, pick3: 900, axe1: 350, axe2: 600, espada1: 300, espada2: 500, rede: 60, capacete: 1500 };
  const BASIC = {
    picareta: { nome: 'Picareta de madeira', dur: 200, receita: { madeira: 3, pedra: 2 } },
    machado: { nome: 'Machado de pedra', dur: 200, receita: { madeira: 3, pedra: 1 } },
    enxada: { nome: 'Enxada', dur: 300, receita: { madeira: 2, pedra: 1 } },
    espada: { nome: 'Espada de madeira', dur: 150, receita: { madeira: 3 } },
  };
  const WEAR = { picareta: ['pick3', 'pick2', 'pick1'], machado: ['axe2', 'axe1'], espada: ['espada2', 'espada1'], rede: ['rede'], enxada: [], arco: ['arco'], cetro: ['cetro'], livro: ['livro'] };

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
    choupana: { tipo: 'casa', nome: 'Choupana', w: 6, h: 3, porta: 0.5, preco: 300, desc: 'A casa mais barata: pequena, de palha e fácil de derrubar.' },
    cabana: { tipo: 'casa', nome: 'Casa de camponês', w: 8, h: 4, porta: 0.5, preco: 800, desc: 'Cabana de toras, com fogão e cama.' },
    pedra: { tipo: 'casa', nome: 'Casa de pedra', w: 8, h: 4, porta: 0.57, preco: 1600, desc: 'Paredes grossas e telhado de ardósia.' },
    tribal: { tipo: 'casa', nome: 'Casa tribal', w: 8, h: 4, porta: 0.42, preco: 1800, desc: 'Casa comprida com totem e fogueiras.' },
    saloon: { tipo: 'casa', nome: 'Saloon do faroeste', w: 8, h: 4, porta: 0.55, preco: 2400, desc: 'Balcão, piano e mesas de jogo.' },
    castelo: { tipo: 'casa', nome: 'Castelo', w: 12, h: 6, porta: 0.55, preco: 4500, desc: 'Torres nos cantos, lareira e armaduras.' },
    domo: { tipo: 'casa', nome: 'Domo alienígena', w: 8, h: 4, porta: 0.43, preco: 6500, desc: 'Cápsulas de dormir e holograma.' },
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
    criado: { tipo: 'movel', nome: 'Criado-mudo com abajur', preco: 70 }, guarda_roupa: { tipo: 'movel', nome: 'Guarda-roupa', preco: 180 },
    espelho: { tipo: 'movel', nome: 'Espelho de pé', preco: 90 }, sofa: { tipo: 'movel', nome: 'Sofá', preco: 220 },
    poltrona: { tipo: 'movel', nome: 'Poltrona', preco: 120 }, mesinha: { tipo: 'movel', nome: 'Mesa de centro', preco: 110 },
    estante: { tipo: 'movel', nome: 'Estante de livros', preco: 160 }, tapete: { tipo: 'movel', nome: 'Tapete', preco: 80 },
    cadeira: { tipo: 'movel', nome: 'Cadeira', preco: 35 }, pia: { tipo: 'movel', nome: 'Bancada com pia', preco: 260 },
    geladeira: { tipo: 'movel', nome: 'Geladeira', preco: 300 }, barril: { tipo: 'movel', nome: 'Barril', preco: 40 },
    planta: { tipo: 'movel', nome: 'Planta em vaso', preco: 45 }, luminaria: { tipo: 'movel', nome: 'Luminária de pé', preco: 95 },
    quadro: { tipo: 'movel', nome: 'Quadro', preco: 130 }, aquario: { tipo: 'movel', nome: 'Aquário', preco: 350 },
    cristal_roxo: { tipo: 'movel', nome: 'Cristal roxo', preco: 350, arte: 'cristal_roxo' },
    cristal_claro: { tipo: 'movel', nome: 'Cristal claro', preco: 350, arte: 'cristal_claro' },
    ajudante: { tipo: 'robo', bot: 'fazenda', nome: 'Ajudante de fazenda', preco: 2500, desc: 'Cuida da plantação em volta de onde você colocar (até 6 blocos): colhe o trigo maduro, guarda a colheita e replanta com as sementes que sobram.' },
    robo: { tipo: 'robo', nome: 'Robô minerador', preco: 3000, desc: 'Fica onde você colocar, procura minério embaixo da terra (até 6 blocos) e guarda para você. Os minérios que ele tira acabam de verdade.' },
  };
  for (const [k, d] of Object.entries(BUILDS)) {
    d.w = d.w || 1; d.h = d.h || 1;
    d.band = d.tipo === 'casa' ? 0.55 : 0.6;
    d.portaR = d.tipo === 'casa' ? 1.1 : 1.6;
    d.pad = d.tipo === 'casa' ? 0.15 : 0;
    if (['criado', 'guarda_roupa', 'espelho', 'sofa', 'poltrona', 'mesinha', 'estante', 'tapete', 'cadeira', 'pia', 'geladeira', 'barril', 'planta', 'luminaria', 'quadro', 'aquario'].includes(k)) d.arte = 'iso_' + k;   // móveis novos só têm a arte do cômodo
    d.img = d.tipo === 'casa' ? 'casa_' + k : d.tipo === 'forte' ? 'forte_' + (d.arte || k) : d.tipo === 'movel' ? (d.arte || 'movel_' + k) : k;
  }
  BUILDS.catapulta.img = 'catapulta_0';
  // fortalezas descontinuadas: quem tinha recebe o valor de volta ao abrir o jogo
  const DESCONTINUADAS = { muralha: 4000, muralha_vila: 5200, forte: 3000, forte_cidade: 6000, campo: 5500, colonia: 9000, cabana_vila: 0 };
  const SHOP_TABS = [['ferramentas', 'Ferramentas'], ['casas', 'Casas'], ['defesa', 'Defesa'], ['moveis', 'Móveis'], ['ajudantes', 'Ajudantes'], ['skins', 'Skins']];
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
    // skins de evento: só aparecem na loja quando o administrador põe à venda, com o preço que ele escolher
    { id: 'raposa', nome: 'Raposa Andarilha', raridade: 'Lendária de evento', preco: 20000, evento: true },
    { id: 'elfo_vermelho', nome: 'Elfo do Noel', raridade: 'Lendária de evento', preco: 20000, evento: true },
    { id: 'elfo_verde', nome: 'Elfo da Floresta', raridade: 'Lendária de evento', preco: 20000, evento: true },
    { id: 'aprendiz', nome: 'Aprendiz', raridade: 'Lendária de evento', preco: 20000, evento: true },
    { id: 'maga_prata', nome: 'Maga de Prata', raridade: 'Lendária de evento', preco: 20000, evento: true },
    { id: 'mago_noturno', nome: 'Mago Noturno', raridade: 'Lendária de evento', preco: 20000, evento: true },
    { id: 'vampiro', nome: 'Vampiro', raridade: 'Lendária de evento', preco: 20000, evento: true },
    { id: 'pinguim_chapeu', nome: 'Pinguim de Chapéu', raridade: 'Lendária de evento', preco: 20000, evento: true },
    { id: 'pinguim_jaqueta', nome: 'Pinguim Rebelde', raridade: 'Lendária de evento', preco: 20000, evento: true },
    { id: 'pinguim_gravata', nome: 'Pinguim de Gravata', raridade: 'Lendária de evento', preco: 20000, evento: true },
    { id: 'armadura_estelar', nome: 'Armadura Estelar', raridade: 'Lendária de evento', preco: 20000, evento: true },
    { id: 'husky', nome: 'Husky', raridade: 'Lendária de evento', preco: 20000, evento: true },
  ];
  // preço na loja: skins de evento só têm preço enquanto o admin deixa à venda (null = fora da loja)
  const precoSkin = sk => (sk.evento ? ((typeof MUNDO !== 'undefined' && MUNDO.vendas) || {})[sk.id] ?? null : sk.preco);
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
      sel: { k: 'nada' },   // o que a ferramenta Construir coloca
      dur: {},        // usos restantes de cada ferramenta
      broken: {},     // ferramentas simples quebradas (fazer outra na Mochila)
      hp: 150, wxp: {}, wbless: {}, camps: [], mobs: [], aura: null, playMs: 0, morte: null,
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
      v: 2, savedAt: Date.now(), seed: S.seed, tiles: toB64(rle(S.tiles)), aux: toB64(rle(S.aux)), road: S.road ? toB64(rle(S.road)) : undefined,
      p: S.p, inv: S.inv, coins: S.coins, owned: S.owned, time: S.time, tool: S.tool, hints: S.hints, catalog: S.catalog,
      npcs: S.npcs.map(n => ({ id: n.id, x: n.x, y: n.y })),
      home: S.home, homeReadyAt: S.homeReadyAt, deposits: S.deposits, char: S.char, skins: S.skins, skin: S.skin,
      tirado: S.tirado, wmat: toB64(rle(S.wmat)), builds: S.builds, kit: S.kit, sel: S.sel, dur: S.dur, broken: S.broken,
      hp: S.hp, wxp: S.wxp, wbless: S.wbless, camps: S.camps, mundo: NET.enabled ? undefined : MUNDO, presentes: S.presentes, fugPegos: S.fugPegos, fugVisto: S.fugVisto, vilaEstado: S.vilaEstado, aura: S.aura, playMs: S.playMs, morte: S.morte, bichoMorto: S.bichoMorto,
      bots: S.bots.map(b => ({ x: b.x, y: b.y, hx: b.hx, hy: b.hy, store: b.store, t: b.t, tipo: b.tipo })),
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
      s.road = d.road ? unrle(fromB64(d.road), W * H) : null;
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
      if (['arco', 'cetro', 'livro'].includes(TOOLS[s.tool].id) && !s.owned[TOOLS[s.tool].id]) s.tool = 0;
      if (d.wmat) { const wm = unrle(fromB64(d.wmat), s.wmat.length); if (wm) s.wmat = wm; }
      let devolve = 0;
      for (const b of Array.isArray(d.builds) ? d.builds : []) if (DESCONTINUADAS[b.k] !== undefined) devolve += DESCONTINUADAS[b.k];
      for (const [k, n] of Object.entries(d.kit || {})) if (DESCONTINUADAS[k] !== undefined && n > 0) { devolve += DESCONTINUADAS[k] * n; d.kit[k] = 0; }
      s.builds = Array.isArray(d.builds) ? d.builds.filter(b => BUILDS[b.k]) : [];
      if (devolve) { s.coins += devolve; s.devolvido = devolve; }
      s.tirado = d.tirado || {}; s.kit = d.kit || {}; s.dur = d.dur || {}; s.broken = d.broken || {};
      if (d.sel && d.sel.carry) { const c = wallCost(d.sel.carry.w & 15, d.sel.carry.gate); for (const [k, n] of Object.entries(c)) s.inv[k] = (s.inv[k] || 0) + n; }   // salvou segurando um muro: devolve
      if (d.sel && (['nada', 'muro', 'portao', 'girar', 'remover'].includes(d.sel.k) || (d.sel.k === 'kit' && BUILDS[d.sel.id]))) s.sel = d.sel;
      s.bots = Array.isArray(d.bots) ? d.bots.map(newBot) : [];
      s.hp = typeof d.hp === 'number' && d.hp > 0 ? d.hp : 150; s.wxp = d.wxp || {}; s.wbless = d.wbless || {};
      s.camps = Array.isArray(d.camps) ? d.camps : []; s.mundo = d.mundo || null; s.presentes = d.presentes || {}; s.fugPegos = d.fugPegos || {}; s.fugVisto = d.fugVisto || {}; s.vilaEstado = d.vilaEstado || {}; s.aura = d.aura || null; s.playMs = d.playMs || 0; s.morte = d.morte || null; s.bichoMorto = d.bichoMorto || {};
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
  function canStand(px, py, z, r, quem) {
    const pts = [[px - r, py - r], [px + r, py - r], [px - r, py + r], [px + r, py + r]];
    for (const [x, y] of pts) if (!walkable(tileAt(Math.floor(x), Math.floor(y), z), z)) return false;
    if (z === 0 && S.builds.length) for (const [x, y] of pts) if (buildBlocks(x, y, quem !== 'jogador')) return false;
    return true;
  }

  // ---- Forma das construções. casa e forte: losango com paredes na borda e uma porta;
  // torres e móveis: retângulo sólido; armadilha: dá para pisar.
  function shapeHit(b, px, py, move) {
    const d = BUILDS[b.k];
    if (px < b.x - 0.6 || py < b.y - 0.6 || px > b.x + d.w + 0.6 || py > b.y + d.h + 0.6) return null;
    if (d.tipo === 'casa' || d.tipo === 'forte') {
      const a = d.w / 2, bb = d.h / 2, cx = b.x + a, cy = b.y + bb;
      const dd = Math.abs(px - cx) / a + Math.abs(py - cy) / bb;
      if (d.tipo === 'casa') {
        // casa: entra pelo botão, então não há passagem na porta; a parede vale um pouco além do desenho
        if (dd > 1) return Math.abs(px - cx) / (a + 0.45) + Math.abs(py - cy) / (bb + 0.3) <= 1 ? 'solid' : null;
        return (1 - dd) * a * bb / Math.hypot(a, bb) > d.band ? 'inside' : 'solid';
      }
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
    if (d.porta === undefined) return [cx, cy + bb - 0.4];
    return b.flip ? [cx + a - d.porta * a, cy + d.porta * bb] : [cx - a + d.porta * a, cy + d.porta * bb];   // girada: porta do outro lado
  }
  // bichos (estrito): a casa inteira é parede, ninguém entra a não ser o jogador
  function buildBlocks(px, py, estrito) {
    for (const b of S.builds) {
      const hb = shapeHit(b, px, py, true);
      if (hb === 'solid' || (estrito && hb && BUILDS[b.k].tipo === 'casa')) return true;
    }
    return false;
  }
  // Dono e regra de entrada de cada casa/fortaleza (no multiplayer o servidor confere)
  const myId = () => (NET.user ? NET.user.id : 'eu');
  const ACESSO = { so_eu: 'Só eu', aliados: 'Clã e aliados', todos: 'Aberta a todos' };
  function canEnter(b) {
    if (!b.dono || b.dono === 'eu' || b.dono === myId() || b.dono === 'vila') return true;
    if (b.acesso === 'todos') return true;
    if (b.acesso === 'aliados') return false;   // clãs e alianças ainda não existem
    return false;
  }
  // quem está dentro de uma casa só é visto por quem também está dentro dela
  function hiddenInHouse(x, y) {
    const h = insideOf(x, y, 'casa');
    return !!h && h !== insideOf(S.p.x, S.p.y, 'casa');
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
      if (d.tipo !== 'forte') continue;   // casas: botão Entrar
      if (shapeHit(b, px, py) !== 'solid' && shapeHit(b, p.x + DIRS[p.dir][0] * 0.45, p.y + DIRS[p.dir][1] * 0.45) !== 'solid') continue;
      if (!best || d.w < BUILDS[best.k].w) best = b;   // casa dentro do forte: vale a casa
    }
    if (!best) for (const b of S.builds) {   // parado na própria porta, empurrando: também vale
      const d = BUILDS[b.k];
      if (d.tipo !== 'forte') continue;
      const [qx, qy] = doorPoint(b);
      if (Math.hypot(qx - p.x, qy - p.y) < 1.6 && (!best || d.w < BUILDS[best.k].w)) best = b;
    }
    if (!best) return null;
    return () => {
      const b = best, d = BUILDS[b.k], [qx, qy] = doorPoint(b);
      if (insideOf(p.x, p.y, d.tipo) !== b && !canEnter(b)) { toast(`${d.nome} trancada: só entra quem o dono convidar`, 'warn'); return; }
      const cx = b.x + d.w / 2, cy = b.y + d.h / 2;
      let ux = qx - cx, uy = qy - cy; const L = Math.hypot(ux, uy) || 1; ux /= L; uy /= L;
      const inside = insideOf(p.x, p.y, d.tipo) === b;
      const sgn = inside ? 1 : -1;   // sai pela porta para fora; entra pela porta para dentro
      for (const dist of [1.1, 1.5, 2, 2.6, 0.8]) for (const side of [0, 0.4, -0.4, 0.8, -0.8]) {
        const nx = qx + sgn * ux * dist - uy * side, ny = qy + sgn * uy * dist + ux * side;
        if (canStand(nx, ny, 0, 0.3, 'jogador') && (insideOf(nx, ny, d.tipo) === b) !== inside) {
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
    sfx('desaba');
    let got = {};
    for (let y = y0 - R; y <= y0 + R; y++) for (let x = x0 - R; x <= x0 + R; x++) {
      if (x < 2 || y < 2 || x >= W - 2 || y >= H - 2) continue;
      const i = I(x, y, 0), t = S.tiles[i];
      if (t === T.ROCK) { S.tiles[i] = T.GRASS; got.pedra = (got.pedra || 0) + 2; }
      else if (t === T.TREE) { S.tiles[i] = T.SAPLING; S.aux[i % (W * H)] = 1; got.madeira = (got.madeira || 0) + TREE_WOOD; }
      else if (t === T.SAPLING) { S.tiles[i] = T.GRASS; S.aux[i % (W * H)] = 0; got.madeira = (got.madeira || 0) + SAPLING_WOOD; }
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
      if (!end) {
        const mi = S.mobs.findIndex(m => m.z === s2.z && (m.x - s2.x) ** 2 + (m.y - s2.y + 0.3) ** 2 < 0.5);
        if (mi >= 0) {
          const m = S.mobs[mi], arma = s2.kind === 'flecha' ? 'arco' : 'cetro';
          end = true;
          if (!s2.area) damageMob(m, s2.dano || 10, arma, { burn: s2.burn });
        }
      }
      if (end && s2.area) {   // magia: explode em área
        sfx('magia_acerto');
        for (const m of [...S.mobs]) if (m.z === s2.z && Math.hypot(m.x - s2.x, m.y - s2.y) < s2.area) damageMob(m, s2.dano, 'cetro', { burn: s2.burn });
        effects.push({ ring: s2.area, x: s2.x, y: s2.y, z: s2.z, t0: now, dur: 350, cor: WLV_COR[s2.lv] || '#c7b2ff' });
      }
      if (!end && s2.z === 0) {
        const ai = S.animals.findIndex(a => (a.x - s2.x) ** 2 + (a.y - s2.y + 0.2) ** 2 < 0.36);
        if (ai >= 0) {
          const a = S.animals[ai], sp = SPECIES[a.kind];
          end = true;
          if (s2.kind === 'magia') {
            a.stun = now + 6000; sfx('magia_acerto');
            toast(`${sp.nome} atordoado: use a rede, ela pega na certa`, 'leaf');
          } else if (sp.protegido) toast('Pintinhos não podem ser caçados', 'warn');
          else {
            S.animals.splice(ai, 1);
            give('carne', sp.carne); sfx('flecha_acerto');
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
      if (s2.lv >= 1) {   // aura do nível em volta da flecha ou da magia
        const g = ctx.createRadialGradient(x, y, 0, x, y, tp * 0.45), cor = s2.kind === 'flecha' ? ['#ff9a3c', '#ff9a3c', '#e0372a', '#ffcc33', '#ffcc33'][s2.lv] : WLV_COR[s2.lv];
        g.addColorStop(0, cor); g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.globalAlpha = 0.55; ctx.fillStyle = g; ctx.fillRect(x - tp * 0.45, y - tp * 0.45, tp * 0.9, tp * 0.9); ctx.globalAlpha = 1;
        if (s2.burn && Math.random() < 0.5) puff(s2.x, s2.y, '#ff6a1a', 0.07, 0.4);
      }
      const tr = artRect(s2.kind === 'flecha' ? (s2.burn ? 'fx_rastro_fogo' : 'fx_rastro_flecha') : 'fx_rastro_magia');
      if (tr) {   // rastro atrás do tiro (os desenhos vêm na diagonal)
        const w = 0.9 * tp, h = w * tr[3] / tr[2];
        ctx.save(); ctx.translate(x - Math.cos(ang) * tp * 0.35, y - Math.sin(ang) * tp * 0.35); ctx.rotate(ang + Math.PI / 4);
        ctx.globalAlpha = 0.75; ctx.drawImage(art, tr[0], tr[1], tr[2], tr[3], -w / 2, -h / 2, w, h); ctx.restore(); ctx.globalAlpha = 1;
      }
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
      if (!fx.name || fx.spr) continue;   // números, anéis e sprites animados são desenhados em drawCombatFx
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
      const tz = artRect('fx_tontura_' + (Math.floor(now / 250) % 2));
      if (tz) { const w = 0.8 * tp, h = w * tz[3] / tz[2]; ctx.drawImage(art, tz[0], tz[1], tz[2], tz[3], x - w / 2, y - h / 2, w, h); continue; }
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
    const lr = tool === 'livro' && artRect(wlv('livro') >= 4 ? 'livro_brilho' : 'livro_mao');
    if (lr) { const w = 0.62 * tp, h = w * lr[3] / lr[2]; ctx.drawImage(art, lr[0], lr[1], lr[2], lr[3], hx + (dir >= 2 ? side * 3 * u2 : 0) - w / 2, hy - h * 0.75, w, h); return; }
    if (tool === 'livro') {   // livro aberto na mão (sem arte)
      ctx.save(); ctx.translate(hx + (dir >= 2 ? side * 3 * u2 : 0), hy - 1 * u2);
      ctx.fillStyle = '#3a6a3a'; ctx.fillRect(-4 * u2, -3 * u2, 8 * u2, 5.5 * u2);
      ctx.fillStyle = '#f2ead2'; ctx.fillRect(-3.5 * u2, -3.5 * u2, 3.3 * u2, 5 * u2); ctx.fillRect(0.2 * u2, -3.5 * u2, 3.3 * u2, 5 * u2);
      ctx.fillStyle = '#4f8a4a'; ctx.fillRect(1.2 * u2, -2 * u2, 1.4 * u2, 0.5 * u2); ctx.fillRect(1.6 * u2, -2.5 * u2, 0.5 * u2, 1.5 * u2);
      ctx.restore(); return;
    }
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

  // ================= Combate =================
  // Vida: 100. Regenera 2/s depois de 8 s sem apanhar. Morrer leva de volta para casa com a vida cheia.
  const HP_MAX = 150;
  // Experiência de cada arma (níveis 0 a 4; o 5, lendário, só com a bênção do administrador ou 10.000 h de jogo)
  const WLV_XP = [0, 300, 1200, 3500, 9000];
  const WLV_NOME = ['Iniciante', 'Aprendiz', 'Médio', 'Grande', 'Expert', 'Lendário'];
  const WLV_DANO = [1, 1.05, 1.1, 1.15, 1.2, 1.3];
  const WLV_COR = [null, '#ff9a3c', '#a970ff', '#ffcc33', '#9b4dff', '#ffcc33'];   // aura da arma por nível
  const ARMAS = { espada: 'Espada', arco: 'Arco', cetro: 'Cetro mágico', livro: 'Livro de cura' };
  const MOB = {
    saqueador: { nome: 'Saqueador', hp: 90, dano: 9, cad: 1.1, vel: 3.8, ve: 5, segue: 12, volta: 8 * 60000, xp: 30 },
    chefe: { nome: 'Chefe dos saqueadores', hp: 260, dano: 17, cad: 1.6, vel: 3.2, ve: 5, segue: 12, volta: 8 * 60000, xp: 70 },
    fugitivo: { nome: 'Fugitivo', hp: 140, dano: 0, cad: 9, vel: 4.3, ve: 9, segue: 0, volta: 0, xp: 40 },
    construtor: { nome: 'Construtor', hp: 50, dano: 0, cad: 9, vel: 2.2, ve: 3, segue: 0, volta: 0, xp: 10 },
    bicho: { nome: 'Bicho do petróleo', hp: 300, dano: 20, cad: 1.4, vel: 3.2, ve: 3, segue: 10, volta: 7 * 60000, xp: 60, moedas: 100 },
  };
  const LENDA_MS = 10000 * 3600 * 1000;
  function wlvBase(w) { const xp = (S.wxp || {})[w] || 0; let lv = 0; for (let k = 1; k < WLV_XP.length; k++) if (xp >= WLV_XP[k]) lv = k; return lv; }
  function wlv(w) {
    if (w === 'cetro' && NET.enabled && NET.isAdmin) return 5;   // o administrador já nasce lendário no cetro
    let lv = wlvBase(w);
    const b = (S.wbless || {})[w];
    if (b && (!b.ate || b.ate > Date.now())) lv = Math.max(lv, b.lv);
    if (w === 'cetro' && lv === 4 && (S.playMs || 0) >= LENDA_MS && !S.ladrao) lv = 5;
    return Math.min(lv, w === 'cetro' ? 5 : 4);
  }
  function addXp(w, n) {
    const before = wlv(w);
    S.wxp = S.wxp || {}; S.wxp[w] = (S.wxp[w] || 0) + n;
    const after = wlv(w);
    if (after > before) { toast(`${ARMAS[w]} subiu para ${WLV_NOME[after]}!`, 'gold', 4000); sfx('magia'); }
  }
  let hurtAt = -1e9, invulnTil = 0, hits3 = { cetro: 0, livro: 0 }, defBuffTil = 0;
  function hurt(n, mob) {
    const now = performance.now();
    if (S.p.z === 0 && !interior && zonaEm(S.p.x, S.p.y)) return;
    if (now < invulnTil || S.hp <= 0) return;
    let k = 1;
    if (wearing('capacete')) k *= 0.9;
    if (now < defBuffTil) k *= 0.8;
    if (mob && mob.weak > now) k *= 0.7;
    S.hp = Math.max(0, S.hp - Math.round(n * k));
    hurtAt = now; sfx('acerto');
    effects.push({ txt: '-' + Math.round(n * k), x: S.p.x, y: S.p.y - 1.2, z: S.p.z, t0: now, dur: 700, cor: '#ff6a5a' });
    shake(120, tp * 0.04);
    if (S.hp <= 0) die(mob);
  }
  function die(mob) {
    const p = S.p;
    S.morte = { x: p.x, y: p.y, z: p.z };   // um X marca só a última morte, até você passar por cima
    let msg = 'Você caiu e acordou em casa.';
    if (mob && (mob.kind === 'saqueador' || mob.kind === 'chefe') && S.coins > 0) {
      const roubo = Math.min(500, S.coins);
      S.coins -= roubo;
      const camp = S.camps.find(c => c.id === mob.camp);
      if (camp) camp.bau += roubo;
      msg = `Os saqueadores levaram ${roubo} moedas para o baú do acampamento. Você acordou em casa.`;
    }
    for (const m of S.mobs) m.aggro = false;
    p.x = S.home.x; p.y = S.home.y; p.z = 0;
    if (!walkable(tileAt(Math.floor(p.x), Math.floor(p.y), 0), 0)) { p.x = SPAWN.x + 0.5; p.y = SPAWN.y + 0.5; }
    S.hp = HP_MAX; invulnTil = performance.now() + 4000; homing = null; interior = null;
    for (let k = 0; k < 20; k++) waterTick();
    invDirty = true; toast(msg, 'warn', 5500); save();
  }
  // ---- Acampamentos de saqueadores (o administrador move e liga/desliga) e o bicho do petróleo
  // ---- Áreas seguras: ninguém apanha lá dentro; monstros não entram nem atacam. O admin cria para eventos.
  function zonaEm(x, y) { return MUNDO.zonas.find(zn => zn.ativo && Math.hypot(x - zn.x, y - zn.y) < zn.r) || null; }
  let zonaAtual = null;
  function zonaTick() {
    if (S.p.z !== 0 || interior) return;
    const zn = zonaEm(S.p.x, S.p.y);
    if (zn !== zonaAtual) { if (zn) toast(`Área segura: ${zn.nome}`, 'leaf', 3000); else if (zonaAtual) toast('Você saiu da área segura', 'warn'); zonaAtual = zn; }
  }
  function makeCamps() {
    const rnd = mulberry32(S.seed + 99);
    S.camps = [];
    for (let reg = 0; reg < RCOLS * RROWS; reg++) {
      if (BIOMES[reg].id === 'campos') continue;   // o bioma do começo fica sem saqueadores
      const [rx0, ry0] = regionOrigin(reg);
      for (let tries = 0; tries < 200; tries++) {
        const x = rx0 + 20 + Math.floor(rnd() * (REGION - 40)), y = ry0 + 20 + Math.floor(rnd() * (REGION - 40));
        if (S.tiles[I(x, y, 0)] !== T.GRASS || Math.hypot(x - SPAWN.x, y - SPAWN.y) < 60) continue;
        S.camps.push({ id: reg, x, y, ativo: true, n: 3 + Math.floor(rnd() * 2), bau: 0, dia: Math.floor(S.time / DAY_MS), mortos: [] });
        break;
      }
    }
  }
  function clearAround(x, y, r) {
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      const i = I(x + dx, y + dy, 0), t = S.tiles[i];
      if (t === T.TREE || t === T.SAPLING || t === T.ROCK) S.tiles[i] = T.GRASS;
    }
  }
  function newMob(kind, x, y, z, extra) {
    const def = MOB[kind];
    return Object.assign({ kind, x, y, z, hx: x, hy: y, hp: def.hp, max: def.hp, dir: 0, moving: false, phase: 0, atk: 0, aggro: false,
      tx: x, ty: y, burn: 0, burnDps: 0, weak: 0, flash: 0 }, extra);
  }
  function mobsTick(dt, now) {
    const p = S.p, day = Math.floor(S.time / DAY_MS);
    // acampamentos: repõem o bando 8 min depois de cada morte; o baú ganha 10 moedas por dia
    for (const c of S.camps) {
      if (c.dia !== day) { if (c.ativo) c.bau += 10 * Math.max(0, day - c.dia); c.dia = day; }
      if (!c.ativo) continue;
      c.mortos = c.mortos.filter(t => t > S.time);
      const vivos = S.mobs.filter(m => m.camp === c.id).length;
      if (vivos + c.mortos.length < c.n && Math.hypot(c.x - p.x, c.y - p.y) < 70) {
        const a = Math.random() * 6.28;
        const temChefe = S.mobs.some(m => m.camp === c.id && m.kind === 'chefe') || (c.chefeVolta || 0) > S.time;
        S.mobs.push(newMob(temChefe ? 'saqueador' : 'chefe', c.x + 0.5 + Math.cos(a) * 2, c.y + 0.5 + Math.sin(a) * 2, 0, { camp: c.id, hx: c.x + 0.5, hy: c.y + 0.5 }));
      }
    }
    // bicho do petróleo: um por jazida de petróleo que ainda tem petróleo; volta 7 min depois de morrer
    for (const d of S.deposits) {
      if (d.ore !== 'petroleo' || !d.active) continue;
      S.bichoMorto = S.bichoMorto || {};
      if ((S.bichoMorto[d.id] || 0) > S.time) continue;
      if (S.mobs.some(m => m.dep === d.id)) continue;
      if (Math.hypot(d.x - p.x, d.y - p.y) > 50 || countDeposit(d) === 0) continue;
      const a = Math.random() * 6.28, r = 3 + Math.random() * 4;
      S.mobs.push(newMob('bicho', d.x + 0.5 + Math.cos(a) * r, d.y + 0.5 + Math.sin(a) * r, d.z, { dep: d.id, hx: d.x + 0.5, hy: d.y + 0.5 }));
    }
    for (let k = S.mobs.length - 1; k >= 0; k--) {
      const m = S.mobs[k], def = MOB[m.kind];
      if (m.burn > now) { m.hp -= m.burnDps * dt; if (m.hp <= 0) { killMob(m, k); continue; } }
      if (Math.hypot(m.x - p.x, m.y - p.y) > 90) { S.mobs.splice(k, 1); continue; }   // longe demais: some (volta quando chegar perto)
      const dist = Math.hypot(m.x - p.x, m.y - p.y), same = m.z === p.z && S.hp > 0 && now > invulnTil;
      const inHouse = !!interior || !!insideOf(p.x, p.y, 'casa') || (p.z === 0 && !!zonaEm(p.x, p.y));   // área segura conta como casa
      const fromHome = Math.hypot(m.x - m.hx, m.y - m.hy);
      if (m.kind === 'fugitivo' || m.kind === 'construtor') {   // não atacam: fogem de quem chega perto
        let tx, ty, sp = def.vel;
        if (same && dist < def.ve) { const L0 = dist || 1; tx = m.x + (m.x - p.x) / L0 * 4; ty = m.y + (m.y - p.y) / L0 * 4; if (m.kind === 'construtor') sp *= 1.3; }
        else { if (Math.hypot(m.tx - m.x, m.ty - m.y) < 0.3 && Math.random() < dt * 0.5) { const a = Math.random() * 6.28, r = Math.random() * (m.kind === 'fugitivo' ? 22 : 7); m.tx = m.hx + Math.cos(a) * r; m.ty = m.hy + Math.sin(a) * r; } tx = m.tx; ty = m.ty; sp *= 0.55; }
        const dx2 = tx - m.x, dy2 = ty - m.y, L2 = Math.hypot(dx2, dy2);
        if (L2 > 0.1) { const st = Math.min(L2, sp * dt), nx = m.x + dx2 / L2 * st, ny = m.y + dy2 / L2 * st;
          if (canStand(nx, ny, 0, 0.28)) { m.x = nx; m.y = ny; m.moving = true; m.phase += dt * 10; } else { m.moving = false; m.tx = m.x + (Math.random() - 0.5) * 6; m.ty = m.y + (Math.random() - 0.5) * 6; }
          m.dir = Math.abs(dx2) > Math.abs(dy2) ? (dx2 < 0 ? 2 : 3) : (dy2 < 0 ? 1 : 0); } else m.moving = false;
        continue;
      }
      if (!m.aggro && same && !inHouse && dist < def.ve) {
        m.aggro = true; if (m.kind !== 'bicho') sfx('golpe');
        if (m.camp !== undefined) for (const o of S.mobs) if (o.camp === m.camp && o.z === m.z) o.aggro = true;   // um avisa o bando inteiro
      }
      if (m.aggro && (!same || inHouse || fromHome > def.segue || dist > def.segue + 3)) m.aggro = false;
      let tx, ty, sp = def.vel;
      if (m.aggro) {
        tx = p.x; ty = p.y;
        if (m.kind === 'saqueador' && dist > 1.2) {   // bando cerca você: cada um mira um lado diferente
          const band = S.mobs.filter(o => o.camp === m.camp && o.kind === 'saqueador'), idx = band.indexOf(m);
          const ang = idx * (Math.PI * 2 / Math.max(band.length, 1)) + (m.camp || 0);
          tx = p.x + Math.cos(ang) * 0.85; ty = p.y + Math.sin(ang) * 0.85;
        }
        if (m.kind === 'chefe') {   // investida: a cada 5 s corre em dobro na sua direção
          if (!m.charge && now - (m.lastCharge || 0) > 5000 && dist > 2 && dist < 7) { m.charge = now + 700; m.lastCharge = now; sfx('golpe'); }
          if (m.charge && now < m.charge) sp *= 2.4; else m.charge = 0;
        }
        if (m.kind === 'bicho') {   // some debaixo da terra, corre e sai do seu lado
          if (!m.under && dist > 2.5 && now - (m.lastDive || 0) > 6000) { m.under = true; m.lastDive = now; m.rise = 0; }
          if (m.under) { sp *= 1.8; if (dist < 1.3) { m.under = false; m.rise = now; m.atk = 0.3; shake(200, tp * 0.06); sfx('bicho_ruge'); } }
        }
      }
      else {
        if (Math.hypot(m.tx - m.x, m.ty - m.y) < 0.2 && Math.random() < dt * 0.6) {
          const a = Math.random() * 6.28, r = Math.random() * (m.kind === 'bicho' ? 6 : 3.5);
          m.tx = m.hx + Math.cos(a) * r; m.ty = m.hy + Math.sin(a) * r;
        }
        tx = m.tx; ty = m.ty; sp *= fromHome > 4 ? 1 : 0.45;
      }
      const dx = tx - m.x, dy = ty - m.y, L = Math.hypot(dx, dy);
      m.atk -= dt;
      const atacantes = S.mobs.filter(o => o !== m && o.aggro && o.z === m.z && Math.hypot(o.x - p.x, o.y - p.y) < 1.0).length;
      if (m.aggro && dist < 1.0 && atacantes >= 2 && m.kind === 'saqueador') {   // espera a vez rodeando
        const a = Math.atan2(m.y - p.y, m.x - p.x) + dt * 1.2, nx = p.x + Math.cos(a) * 1.6, ny = p.y + Math.sin(a) * 1.6;
        if (canStand(nx, ny, 0, 0.28)) { m.x = nx; m.y = ny; m.moving = true; m.phase += dt * 10; }
      } else if (m.aggro && dist < 1.0) {           // perto: ataca
        m.moving = false;
        if (m.atk <= 0) {
          const furia = m.hp < m.max * 0.3;
          m.atk = def.cad * (furia ? 0.65 : 1); m.swing = now; hurt(def.dano * (m.charge ? 1.5 : 1), m);
          if (m.kind !== 'saqueador') { fxAnim(['fx_impacto'], S.p.x, S.p.y + 0.2, m.z, 1.4, 380); shake(220, tp * 0.08); }
        }
      } else if (L > 0.1) {
        const st = Math.min(L, sp * dt), nx = m.x + dx / L * st, ny = m.y + dy / L * st;
        const ok = m.kind === 'bicho' ? (tileAt(Math.floor(nx), Math.floor(ny), m.z) !== 255)   // cava por dentro da pedra
          : canStand(nx, ny, 0, 0.28) && !zonaEm(nx, ny);   // monstro não entra em área segura
        if (ok) { m.x = nx; m.y = ny; m.moving = true; m.phase += dt * 10; }
        else { m.moving = false; m.tx = m.x; m.ty = m.y; }
        m.dir = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 2 : 3) : (dy < 0 ? 1 : 0);
      } else m.moving = false;
    }
  }
  function damageMob(m, n, arma, opt = {}) {
    const now = performance.now(), idx = S.mobs.indexOf(m);
    if (idx < 0) return;
    if (m.under) return;   // debaixo da terra não leva dano
    n = Math.round(n);
    m.hp -= n; m.flash = now + 120; m.hitT = now; m.aggro = true;
    if (opt.burn) { m.burn = now + 4000; m.burnDps = 4; }
    const hitFx = arma === 'cetro' ? ['fx_magia_hit_0', 'fx_magia_hit_1', 'fx_magia_hit_2'] : arma === 'arco' ? ['fx_lascas'] : ['fx_faisca_0', 'fx_faisca_1', 'fx_faisca_2'];
    if (arma !== 'espada') fxAnim(hitFx, m.x, m.y - 0.6, m.z, arma === 'cetro' ? 1.2 : 0.9, 330);
    if (m.kind !== 'bicho' || arma !== 'cetro') {   // empurrão de meio bloco para longe de você
      const dx = m.x - S.p.x, dy = m.y - S.p.y, L = Math.hypot(dx, dy) || 1, k = m.kind === 'chefe' || m.kind === 'bicho' ? 0.25 : 0.5;
      const nx = m.x + dx / L * k, ny = m.y + dy / L * k;
      if (m.kind === 'bicho' ? tileAt(Math.floor(nx), Math.floor(ny), m.z) !== 255 : canStand(nx, ny, 0, 0.28)) { m.x = nx; m.y = ny; }
    }
    if (opt.weak) m.weak = now + 8000;
    effects.push({ txt: String(n), x: m.x, y: m.y - 1.3, z: m.z, t0: now, dur: 650, cor: opt.burn ? '#ffb347' : '#ffffff' });
    addXp(arma, 4);
    sfx(arma === 'espada' ? 'espada_acerto' : arma === 'arco' ? 'flecha_acerto' : arma === 'cetro' ? 'magia_acerto' : 'acerto');
    if (m.hp <= 0) killMob(m, idx, arma);
  }
  function killMob(m, idx, arma) {
    const def = MOB[m.kind];
    S.mobs.splice(idx, 1);
    sfx(m.kind === 'bicho' ? 'bicho_morre' : 'inimigo');
    if (arma) addXp(arma, def.xp);
    corpses.push({ kind: m.kind, x: m.x, y: m.y, z: m.z, flip: m.dir === 2, t0: performance.now() });
    if (m.kind === 'fugitivo') { pegouFugitivo(m); return; }
    if (m.kind === 'construtor') {
      const st = (S.vilaEstado || {})[m.vila]; if (st) st.mortos.push(S.time + CONSTRUTOR_VOLTA);
      S.coins += 50; invDirty = true; toast('Construtor derrubado: +50 moedas', 'gold');
      if (Math.random() < (MUNDO.construtores.chance || 0)) darPremio(MUNDO.construtores.premio);
      return;
    }
    if (m.kind === 'saqueador' || m.kind === 'chefe') {
      const c = S.camps.find(q => q.id === m.camp);
      if (c) { c.mortos.push(S.time + def.volta); if (m.kind === 'chefe') c.chefeVolta = S.time + def.volta; }
      toast(m.kind === 'chefe' ? 'Chefe dos saqueadores derrotado!' : 'Saqueador derrotado', 'gold');
    } else {
      S.bichoMorto = S.bichoMorto || {};
      S.bichoMorto[m.dep] = S.time + def.volta;
      S.coins += def.moedas; invDirty = true;
      toast(`Bicho do petróleo derrotado: +${def.moedas} moedas`, 'gold', 3500);
    }
  }
  // mira: vira o personagem para o inimigo mais perto dentro do alcance
  function aimAt(range) {
    let best = null, bd = range;
    for (const m of S.mobs) {
      if (m.z !== S.p.z) continue;
      const d = Math.hypot(m.x - S.p.x, m.y - S.p.y);
      if (d < bd) { bd = d; best = m; }
    }
    if (best) {
      const dx = best.x - S.p.x, dy = best.y - S.p.y;
      S.p.dir = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 2 : 3) : (dy < 0 ? 1 : 0);
    }
    return best;
  }
  // espada: 1 bloco; Médio: dano em área em volta do golpe; Grande ou mais: área alcança 2 blocos
  function fxAnim(frames, x, y, z, size, dur, rot = 0, flip = false) {
    effects.push({ spr: frames, x, y, z, size, rot, flip, t0: performance.now(), dur });
  }
  const DIR_ANG = [Math.PI / 2, -Math.PI / 2, Math.PI, 0];
  let shakeTil = 0, shakeAmt = 0;
  function shake(ms, amt) { shakeTil = performance.now() + ms; shakeAmt = amt; }
  function swordStrike() {
    const lv = wlv('espada'), m = aimAt(2.2), d = DIRS[S.p.dir];
    const fx = S.p.x + d[0] * 0.9, fy = S.p.y + d[1] * 0.9 - 0.1;
    const dano = 12 * WLV_DANO[lv] * (1 + swordBonus() * 0.25);
    const raio = lv >= 3 ? 2 : lv >= 2 ? 1.25 : 0.8;
    let acertou = false;
    for (const mm of [...S.mobs]) {
      if (mm.z !== S.p.z) continue;
      const near = lv >= 2 ? Math.hypot(mm.x - fx, mm.y - fy) < raio : Math.hypot(mm.x - fx, mm.y - fy) < 0.9;
      if (near) { damageMob(mm, dano, 'espada'); acertou = true; }
    }
    // corte em meia-lua na direção do golpe, na cor do nível
    if (lv >= 2) effects.push({ ring: raio, x: fx, y: fy, z: S.p.z, t0: performance.now(), dur: 260, cor: WLV_COR[lv] });
    return acertou || !!m;
  }
  // livro: cura você (e aliados, no multiplayer) em área; Grande: a cada 3 curas reconstrói; Expert: +20% de defesa
  function bookHeal() {
    const lv = wlv('livro'), raio = [5, 5, 8, 10, 12, 12][lv];
    if (mana < 1) { toast('O livro está recarregando…', 'warn'); cooldown = 0.5; return; }
    mana -= 1;
    const cura = Math.round(18 * WLV_DANO[lv]), antes = S.hp;
    S.hp = Math.min(HP_MAX, S.hp + cura);
    effects.push({ ring: raio, x: S.p.x, y: S.p.y, z: S.p.z, t0: performance.now(), dur: 600, cor: lv >= 4 ? '#ff5a4a' : '#7fe08a', img: 'anel_cura' });
    if (S.hp > antes) { effects.push({ txt: '+' + (S.hp - antes), x: S.p.x, y: S.p.y - 1.2, z: S.p.z, t0: performance.now(), dur: 700, cor: '#7fe08a' }); addXp('livro', 3); }
    hits3.livro++;
    if (lv >= 4) defBuffTil = performance.now() + 20000;
    if (lv >= 3 && hits3.livro % 3 === 0) toast(lv >= 4 ? 'Base fortificada: +20% de defesa por 20 s' : 'Construções por perto restauradas', 'leaf');
    sfx('livro'); cooldown = 0.6; wear('livro');
  }
  // explosão circular do cetro (Expert, a cada 3 magias): enfraquece inimigos; lendário também cura
  function staffNova(lv) {
    const now = performance.now();
    effects.push({ ring: 3, x: S.p.x, y: S.p.y, z: S.p.z, t0: now, dur: 500, cor: lv >= 5 ? '#ffcc33' : '#9b4dff', img: 'anel_explosao' });
    for (const m of [...S.mobs]) if (m.z === S.p.z && Math.hypot(m.x - S.p.x, m.y - S.p.y) < 3) damageMob(m, 10 * WLV_DANO[lv], 'cetro', { weak: true });
    if (lv >= 5) S.hp = Math.min(HP_MAX, S.hp + 15);
    sfx('magia_acerto');
  }
  function combatTick(dt, now) {
    S.playMs = (S.playMs || 0) + dt * 1000;
    if (S.morte && S.morte.z === S.p.z && Math.hypot(S.morte.x - S.p.x, S.morte.y - S.p.y) < 0.8) { S.morte = null; toast('Você voltou ao lugar onde caiu'); }
    if (S.hp < HP_MAX && now - hurtAt > 10000) S.hp = Math.min(HP_MAX, S.hp + 1.5 * dt);
    mobsTick(dt, now);
    // baú dos saqueadores: Usar pega as moedas (ver useTool)
    const hpEl = document.getElementById('hp');
    if (hpEl) { const v = Math.ceil(S.hp); if (hpEl.dataset.v !== String(v)) { hpEl.dataset.v = v; hpEl.textContent = v; hpEl.parentElement.classList.toggle('low', v < 30); } }
  }
  function campChest(x, y) {
    if (S.p.z !== 0) return null;
    return S.camps.find(c => Math.hypot(c.x + 2.5 - x - 0.5, c.y + 0.5 - y - 0.5) < 0.9 || Math.hypot(c.x + 2.5 - S.p.x, c.y + 0.5 - S.p.y) < 0.8) || null;
  }
  // ---- desenho
  function drawMobs(ents, camX, camY, W2, H2, wade) {
    const now = performance.now(), u = tp / 16;
    for (const m of S.mobs) {
      if (m.z !== S.p.z) continue;
      const sx = m.x * tp - camX, sy = m.y * tp - camY;
      if (sx < -2 * tp || sy < -3 * tp || sx > W2 + 2 * tp || sy > H2 + 2 * tp) continue;
      if (!m.rise && m.kind === 'bicho' && !m.under) m.rise = now;
      if (m.under) {   // só a terra mexendo
        ents.push({ y: sy, f: () => { const r = artRect('fx_poeira'); if (r) { const w = 0.9 * tp, h = w * r[3] / r[2], j = Math.sin(now / 60) * 2; ctx.drawImage(art, r[0], r[1], r[2], r[3], sx - w / 2 + j, sy - h * 0.5, w, h); } } });
        continue;
      }
      ents.push({ y: sy + 6 * u, wx: m.x, wy: m.y, f: () => {
        const view = m.dir === 0 ? 'front' : m.dir === 1 ? 'back' : 'side', flip = m.dir === 2;
        if (m.flash > now) ctx.filter = 'brightness(2.2)';
        else if (m.burn > now) ctx.filter = 'sepia(1) saturate(3) hue-rotate(-20deg)';
        const view2 = m.dir === 1 ? 'back' : m.dir === 0 ? 'front' : 'side';
        const hitNow = m.hitT && now - m.hitT < 180, atkNow = m.swing && now - m.swing < 300;
        if (m.kind === 'construtor' || (m.kind === 'fugitivo' && !ATLAS.fugitivo_front_0)) {
          if (m.kind === 'construtor' && ATLAS.construtor_front_0) { const nf = framesOf('construtor', view2); drawObj(`construtor_${view2}_${m.moving && nf ? Math.floor(m.phase / 1.4) % nf : 0}`, sx, sy + 6 * u, 1.35 * tp, flip); }
          else if (m.kind === 'construtor') { ctx.filter = (ctx.filter === 'none' ? '' : ctx.filter) + ' hue-rotate(-70deg) saturate(0.8)'; const nf = framesOf('faz', view2); drawObj(`faz_${view2}_${m.moving && nf ? Math.floor(m.phase) % nf : 0}`, sx, sy + 6 * u, 1.25 * tp, flip); }
          else { ctx.filter = (ctx.filter === 'none' ? '' : ctx.filter) + ' grayscale(1) brightness(1.3)'; const nf = framesOf('saq', view2); drawObj(`saq_${view2}_${m.moving && nf ? Math.floor(m.phase / 1.2) % nf : 0}`, sx, sy + 6 * u, 1.45 * tp, flip); }
        } else if (m.kind !== 'bicho') {
          const pre = m.kind === 'chefe' ? 'chefe' : m.kind === 'fugitivo' ? 'fugitivo' : 'saq';
          shadow(sx, sy + 5.6 * u, (m.kind === 'chefe' ? 5.2 : 4.4) * u, 1.5 * u);
          let name;
          if (hitNow) name = `${pre}_hit`;
          else if (atkNow) name = `${pre}_atk_${m.dir >= 2 ? 'side' : 'front'}_${now - m.swing < 140 ? 0 : 1}`;
          else { const n = framesOf(pre, view2); name = `${pre}_${view2}_${m.moving && n ? Math.floor(m.phase / 1.4) % n : 0}`; }
          if (!drawObj(name, sx, sy + 6 * u, (m.kind === 'chefe' ? 1.7 : 1.5) * tp, flip)) {
            let nm = `sk_saqueador_${view}_idle`;
            if (!drawObj(nm, sx, sy + 6 * u, 1.5 * tp, flip)) { ctx.fillStyle = '#5a3a2a'; ctx.fillRect(sx - 4 * u, sy - 10 * u, 8 * u, 16 * u); }
          }
        } else {
          shadow(sx, sy + 4 * u, 6 * u, 1.8 * u);
          const n = framesOf('bicho', view2);
          let name = atkNow ? 'bicho_atk' : `bicho_${view2}_${m.moving && n ? Math.floor(m.phase / 1.2) % n : 0}`;
          if (m.rise && now - m.rise < 700) name = `bicho_dig_${3 - Math.min(3, Math.floor((now - m.rise) / 175))}`;   // saindo da terra
          const fb = ctx.filter === 'none' ? '' : ctx.filter;
          let ok = drawObj(name, sx, sy + 4 * u, 1.25 * tp, flip && name !== 'bicho_atk' ? flip : flip);
          if (!ok) {
            ctx.filter = (fb + ' brightness(0.32) saturate(0.6) hue-rotate(200deg)').trim();
            const n2 = framesOf('javali', view2);
            ok = n2 && drawObj(`javali_${view2}_${m.moving ? Math.floor(m.phase / 1.2) % n2 : 0}`, sx, sy + 4 * u, 1.25 * tp, flip);
            if (!ok) { ctx.fillStyle = '#1a1420'; ctx.fillRect(sx - 7 * u, sy - 4 * u, 14 * u, 8 * u); }
          }
        }
        ctx.filter = 'none';
        if (m.burn > now) { const fr = artRect('fx_fogo_' + (Math.floor(now / 110) % 3)); if (fr) { const w = 0.7 * tp, h = w * fr[3] / fr[2]; ctx.globalAlpha = 0.85; ctx.drawImage(art, fr[0], fr[1], fr[2], fr[3], sx - w / 2, sy - h * 0.6, w, h); ctx.globalAlpha = 1; } }
        if (m.weak > now) { ctx.fillStyle = 'rgba(155,77,255,0.35)'; ctx.beginPath(); ctx.ellipse(sx, sy + 5 * u, 6 * u, 2 * u, 0, 0, 6.28); ctx.fill(); }
        // barra de vida
        const k = clamp(m.hp / m.max, 0, 1), bw = 14 * u;
        ctx.fillStyle = 'rgba(20,17,15,0.8)'; ctx.fillRect(sx - bw / 2, sy - 22 * u, bw, 2.2 * u);
        ctx.fillStyle = m.kind === 'bicho' ? '#b05cff' : m.kind === 'chefe' ? '#ffb347' : m.kind === 'fugitivo' ? '#ffd24a' : m.kind === 'construtor' ? '#7fd16a' : '#e0573f'; ctx.fillRect(sx - bw / 2, sy - 22 * u, bw * k, 2.2 * u);
      } });
    }
    for (let k = corpses.length - 1; k >= 0; k--) {   // corpo caído some aos poucos
      const c = corpses[k], t = (now - c.t0) / 2500;
      if (t >= 1) { corpses.splice(k, 1); continue; }
      if (c.z !== S.p.z) continue;
      const cx = c.x * tp - camX, cy = c.y * tp - camY, name = ATLAS[c.kind + '_dead'] ? c.kind + '_dead' : 'saq_dead';
      ents.push({ y: cy - tp, f: () => { ctx.globalAlpha = t < 0.6 ? 1 : (1 - t) / 0.4; drawObj(name, cx, cy + 5 * u, (c.kind === 'bicho' ? 0.75 : 0.6) * tp, c.flip); ctx.globalAlpha = 1; } });
    }
    if (S.p.z === 0) for (const c of S.camps) {   // baú do acampamento
      const bx = (c.x + 2.5) * tp - camX, by = (c.y + 1) * tp - camY;
      if (bx < -2 * tp || by < -2 * tp || bx > W2 + 2 * tp || by > H2 + 2 * tp) continue;
      ents.push({ y: by, f: () => {
        const r = art2Rect('movel_bau');
        if (r) { const w = 0.85 * tp, h = w * r[3] / r[2]; ctx.drawImage(art2, r[0], r[1], r[2], r[3], bx - w / 2, by - h, w, h); }
        else { ctx.fillStyle = '#7a5230'; ctx.fillRect(bx - 0.4 * tp, by - 0.6 * tp, 0.8 * tp, 0.6 * tp); }
        const fr = art2Rect('catapulta_pilha');   // fogueira/pilha marcando o acampamento
        if (fr) { const w = 0.7 * tp, h = w * fr[3] / fr[2]; ctx.drawImage(art2, fr[0], fr[1], fr[2], fr[3], bx - 2.6 * tp, by - h - 0.4 * tp, w, h); }
      } });
    }
  }
  function drawCombatFx(camX, camY, now) {
    for (const fx of effects) {
      if (fx.spr && fx.z === S.p.z) {
        const k = clamp((now - fx.t0) / fx.dur, 0, 0.999), fr = fx.spr[Math.floor(k * fx.spr.length)], r = artRect(fr);
        if (!r) continue;
        const w = fx.size * tp * (fx.spr.length === 1 ? 0.8 + 0.4 * k : 1), h = w * r[3] / r[2];
        ctx.save(); ctx.globalAlpha = fx.spr.length === 1 ? 1 - k * k : (k > 0.7 ? (1 - k) / 0.3 : 1);
        ctx.translate(fx.x * tp - camX, fx.y * tp - camY); ctx.rotate(fx.rot || 0); if (fx.flip) ctx.scale(1, -1);
        ctx.drawImage(art, r[0], r[1], r[2], r[3], -w / 2, -h / 2, w, h); ctx.restore();
        continue;
      }
      if (fx.z !== S.p.z || (!fx.txt && !fx.ring)) continue;
      const k = (now - fx.t0) / fx.dur, x = fx.x * tp - camX, y = fx.y * tp - camY;
      if (fx.txt) {
        ctx.globalAlpha = Math.max(0, 1 - k);
        ctx.font = `bold ${Math.round(tp * 0.38)}px "Pixelify Sans", monospace`; ctx.textAlign = 'center';
        ctx.fillStyle = '#000'; ctx.fillText(fx.txt, x + 1, y - k * tp * 0.6 + 1);
        ctx.fillStyle = fx.cor; ctx.fillText(fx.txt, x, y - k * tp * 0.6);
      } else {
        ctx.globalAlpha = Math.max(0, 0.8 * (1 - k));
        const rr = fx.img && artRect(fx.img);
        if (rr) { const w = fx.ring * 2 * tp * (0.4 + 0.6 * k), h = w * rr[3] / rr[2]; ctx.drawImage(art, rr[0], rr[1], rr[2], rr[3], x - w / 2, y - h / 2, w, h); ctx.globalAlpha = 1; continue; }
        ctx.strokeStyle = fx.cor; ctx.lineWidth = Math.max(2, tp * 0.08);
        ctx.beginPath(); ctx.ellipse(x, y, fx.ring * tp * (0.4 + 0.6 * k), fx.ring * tp * 0.5 * (0.4 + 0.6 * k), 0, 0, 6.28); ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
    ctx.textAlign = 'left';
  }
  // fumaça subindo em volta de um ponto (aura da equipe e aura das armas)
  const smoke = [], corpses = [];
  const SMOKE_ART = { '#4cff7a': 'verde', '#1e8a3a': 'verde', '#7fe08a': 'verde', '#ff4a3a': 'vermelha', '#7a1010': 'vermelha', '#ff4a2a': 'vermelha', '#e0372a': 'vermelha',
    '#b05cff': 'roxa', '#4a1a7a': 'roxa', '#a970ff': 'roxa', '#9b4dff': 'roxa', '#ffd24a': 'dourada', '#ff8a2a': 'dourada', '#ffcc33': 'dourada', '#ff9a3c': 'dourada', '#ff6a1a': 'dourada' };
  function puff(x, y, cor, size, rise) { smoke.push({ x, y, cor, size, rise, t0: performance.now(), dur: 900 + Math.random() * 500, dx: (Math.random() - 0.5) * 0.4 }); }
  function drawSmoke(camX, camY, now) {
    for (let k = smoke.length - 1; k >= 0; k--) {
      const s2 = smoke[k], t = (now - s2.t0) / s2.dur;
      if (t >= 1) { smoke.splice(k, 1); continue; }
      const x = (s2.x + s2.dx * t) * tp - camX, y = (s2.y - s2.rise * t) * tp - camY, r = s2.size * tp * (0.5 + t);
      ctx.globalAlpha = 0.5 * (1 - t);
      const sr = SMOKE_ART[s2.cor] && artRect('fumaca_' + SMOKE_ART[s2.cor]);
      if (sr) ctx.drawImage(art, sr[0], sr[1], sr[2], sr[3], x - r, y - r, r * 2, r * 2);
      else { ctx.fillStyle = s2.cor; ctx.beginPath(); ctx.arc(x, y, r, 0, 6.28); ctx.fill(); }
    }
    ctx.globalAlpha = 1;
  }
  const AURAS = { verde: ['#4cff7a', '#1e8a3a'], vermelha: ['#ff4a3a', '#7a1010'], preta: ['#2a2230', '#000000'], roxa: ['#b05cff', '#4a1a7a'], dourada: ['#ffd24a', '#ff8a2a'] };
  function auraTick(dt) {
    const p = S.p;
    if (S.aura && AURAS[S.aura] && Math.random() < dt * 22) {   // aura da equipe: fumaça em volta, sem cobrir o personagem
      const [c1, c2] = AURAS[S.aura], a = Math.random() * 6.28;
      puff(p.x + Math.cos(a) * 0.45, p.y + 0.15 + Math.sin(a) * 0.15, Math.random() < 0.5 ? c1 : c2, 0.12, 1.1);
    }
    const tool = TOOLS[S.tool].id;
    if (ARMAS[tool] && S.owned[tool] !== false && Math.random() < dt * 8) {   // aura da arma pelo nível
      const lv = wlv(tool), cor = WLV_COR[lv];
      if (cor && (tool === 'espada' || S.owned[tool])) {
        const d = DIRS[p.dir];
        puff(p.x + d[0] * 0.35 + (Math.random() - 0.5) * 0.3, p.y - 0.35 + (Math.random() - 0.5) * 0.3, cor, 0.07, 0.6);
        if (lv >= 3 && tool !== 'livro') puff(p.x + d[0] * 0.35, p.y - 0.3, '#ff4a2a', 0.06, 0.8);       // fumaça vermelha no nível grande
        if (tool === 'livro' && lv >= 4) puff(p.x + d[0] * 0.35, p.y - 0.3, '#ffd24a', 0.06, 0.8);       // livro expert: fumaça dourada
      }
    }
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
  const wearing = id => !!S.owned[id] && !(S.tirado || {})[id];
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
  const NEVE_MS = 2 * 60 * 1000, NEVE_ID = BIOMES.findIndex(b => b.id === 'neve'), neveAt = new Map();
  function nearSource(x, y) {
    for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) if (S.tiles[I(x + dx, y + dy, 0)] === T.SOURCE) return true;
    return false;
  }
  function farmTick() {
    for (const [i] of neveAt) { const t = S.tiles[i]; if (t !== T.TILLED && t !== T.VALA) neveAt.delete(i); }
    const tl = S.tiles, aux = S.aux, day = isDay();
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
      const i = y * W + x, t = tl[i];
      if (t === T.CROP) {
        if (aux[i] < 3) {
          const wet = wetAround(x, y), B = BIOMES[S.biome[i]];
          const chance = (day ? (wet ? 0.16 : 0.03) : (wet && B.id !== 'neve' ? 0.03 : 0)) * B.cresce;
          if (Math.random() < chance) aux[i]++;
        }
      } else if ((t === T.TILLED || t === T.VALA) && S.biome[i] === NEVE_ID) {
        // na neve, o chão cavado volta a ficar coberto 2 minutos depois (as lagoas ficam)
        if (!neveAt.has(i)) { if (!nearSource(x, y)) neveAt.set(i, S.time); }
        else if (S.time - neveAt.get(i) > NEVE_MS) { tl[i] = T.GRASS; aux[i] = 0; S.water[i] = 0; neveAt.delete(i); }
      } else if (t === T.TILLED) {
        if (Math.random() < 0.003) tl[i] = T.GRASS;
      } else if (t === T.SAPLING) {
        if (aux[i] === 1) { if (Math.random() < 0.004) aux[i] = 0; }      // o toco brota uma muda (~6 min)
        else if (Math.random() < 0.0018) tl[i] = T.TREE;   // muda vira árvore adulta em ~14 min, em média
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
    S.tiles[i] = after; sfx(t === T.DIRT ? 'cavar' : 'pedra_quebra');
    if (m.drop) {
      give(m.drop, m.n);
      toast(`+${m.n} ${ITEMS[m.drop].nome}`, m.hard >= 2 ? 'gold' : '');
    }
    return true;
  }

  // Muros: desmontar leva golpes conforme o material e devolve tudo o que foi gasto
  function hitWall(i, z, tool) {
    const m = S.wmat[i] & 15, mat = WALL_MATS[m] || WALL_MATS[0], gate = S.tiles[i] === T.GATE;
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
    if (isWall && (S.wmat[i] & 15) === m && (t === T.GATE) === gate) return;
    if (playerInTile(x, y) && !gate) return;
    if (z === 0 && S.builds.some(b => { const hb = shapeHit(b, x + 0.5, y + 0.5); return hb === 'solid' || (hb && BUILDS[b.k].tipo !== 'forte'); })) {
      toast('Tem uma construção aí', 'warn'); return;
    }
    if (!payAll(cost)) { toast(`Precisa de ${costTxt(cost)}`, 'warn'); cooldown = 0.5; return; }
    if (isWall) giveAll(wallCost(S.wmat[i] & 15, t === T.GATE));   // trocando o material: devolve o antigo
    S.tiles[i] = gate ? T.GATE : T.WALL; S.wmat[i] = m; sfx('construir');
    hits.delete(i);
    hint(gate ? 'portao' : 'muros', gate ? 'O portão abre sozinho quando você chega perto.'
      : 'Muros vizinhos se encaixam. Em Construir dá para mover, girar e remover muros.');
  }
  // Mover, girar e remover muros e portões (sem gastar golpes)
  const isWallT = t => t === T.WALL || t === T.GATE;
  function wallEdit(x, y, z, t, i) {
    const mode = S.sel.k;
    if (mode === 'mover' && S.sel.carry) {          // segundo toque: solta onde estiver olhando
      const free = z === 0 ? (t === T.GRASS || t === T.TILLED) : t === T.AIR;
      if (!free || (playerInTile(x, y) && !S.sel.carry.gate)) { toast('Escolha um lugar livre', 'warn'); return; }
      if (z === 0 && S.builds.some(b => { const hb = shapeHit(b, x + 0.5, y + 0.5); return hb === 'solid' || (hb && BUILDS[b.k].tipo !== 'forte'); })) { toast('Tem uma construção aí', 'warn'); return; }
      S.tiles[i] = S.sel.carry.gate ? T.GATE : T.WALL; S.wmat[i] = S.sel.carry.w; S.sel.carry = null;
      sfx('construir'); invDirty = true; return;
    }
    if (!isWallT(t)) { toast(mode === 'mover' ? 'Fique de frente para um muro para pegar' : 'Fique de frente para um muro', 'warn'); return; }
    const gate = t === T.GATE, w = S.wmat[i];
    if (mode === 'remover') {
      S.tiles[i] = z === 0 ? T.GRASS : T.AIR; S.wmat[i] = 0; hits.delete(i);
      const back = wallCost(w & 15, gate); giveAll(back); sfx('desaba');
      toast(`Removido: ${costTxt(back)} de volta`);
    } else if (mode === 'mover') {
      S.tiles[i] = z === 0 ? T.GRASS : T.AIR; S.wmat[i] = 0; hits.delete(i);
      S.sel.carry = { w, gate }; sfx('toque');
      toast('Pegou. Fique de frente para o novo lugar e use de novo.', 'leaf');
    } else if (mode === 'girar') {
      if (gate) { toast('Portões ficam sempre de frente', 'warn'); return; }
      const o = ((w >> 4) + 1) % 3;
      S.wmat[i] = (w & 15) | (o << 4); sfx('toque');
      toast(['Encaixe automático', 'Deitado (de lado a lado)', 'Em pé (para cima e para baixo)'][o]);
    }
    invDirty = true;
  }
  // trocar de modo segurando um muro: devolve o material dele
  function dropCarry() {
    if (S.sel && S.sel.carry) { giveAll(wallCost(S.sel.carry.w & 15, S.sel.carry.gate)); S.sel.carry = null; }
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
  function placeProblem(c, vila) {
    const d = BUILDS[c.k];
    if (S.p.z !== 0 && !vila) return 'Construções ficam na superfície';
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
  function clearUnderHouse(b) {
    const d = BUILDS[b.k];
    if (d.tipo !== 'casa') return;
    for (let y = Math.max(1, b.y - d.h - 2); y < b.y + d.h + 1; y++) for (let x = b.x - 1; x < b.x + d.w + 1; x++) {
      const i = I(x, y, 0), t = S.tiles[i];
      const dug = t === T.TILLED || t === T.CROP || t === T.VALA, obj = (t === T.TREE || t === T.SAPLING || t === T.ROCK) && shapeHit(b, x + 0.5, y + 0.5);
      if (dug || obj) { S.tiles[i] = T.GRASS; S.aux[i] = 0; S.water[i] = 0; }
    }
  }
  function addBuild(c) {
    const d = BUILDS[c.k];
    const b = { k: d.tipo === 'forte' && d.arte ? d.arte : c.k, x: c.x, y: c.y, dono: myId(), flip: !!c.flip };
    if (d.tipo === 'casa' || d.tipo === 'forte') b.acesso = 'so_eu';
    if (d.tipo === 'casa' || d.tipo === 'forte' || d.tipo === 'torre') {   // limpa o terreno embaixo
      for (let y = c.y; y < c.y + d.h; y++) for (let x = c.x; x < c.x + d.w; x++) {
        if (!shapeHit(b, x + 0.5, y + 0.5)) continue;
        const i = I(x, y, 0), t = S.tiles[i];
        if (t === T.TREE || t === T.SAPLING || t === T.ROCK || t === T.TILLED || t === T.CROP || t === T.VALA) { S.tiles[i] = T.GRASS; S.aux[i] = 0; }
      }
    }
    S.builds.push(b);
    clearUnderHouse(b);
    return b;
  }
  function placeKit(k) {
    const d = BUILDS[k];
    if (!(S.kit[k] > 0)) { toast(`Você não tem ${d.nome.toLowerCase()}. Compre na loja.`, 'warn'); return; }
    if (d.tipo === 'robo') {
      const tg = target();
      if (S.p.z !== 0 || !walkable(tileAt(tg.x, tg.y, 0), 0) || buildBlocks(tg.x + 0.5, tg.y + 0.5)) { toast('Coloque o robô num chão livre da superfície', 'warn'); return; }
      S.kit[k]--; S.bots.push(newBot({ x: tg.x + 0.5, y: tg.y + 0.5, tipo: d.bot || 'mina' }));
      toast(d.bot === 'fazenda' ? 'Ajudante ligado. Ele colhe e replanta a plantação em volta.' : 'Robô ligado. Ele procura minério embaixo deste lugar.', 'leaf', 3500);
    } else {
      const c = candidate(k); c.flip = !!S.sel.flip; const prob = placeProblem(c);
      if (prob) { toast(prob, 'warn'); cooldown = 0.5; return; }
      S.kit[k]--;
      addBuild(c); sfx('construir');
      for (const [jk, ox, oy] of d.junto || []) addBuild({ k: jk, x: c.x + ox, y: c.y + oy });
      toast(`${d.nome}: pronto`, 'gold');
      if (d.tipo === 'casa') hint('casa', 'Chegue perto da porta e toque em Entrar. Lá dentro, toque em Decorar.');
    }
    if (!(S.kit[k] > 0)) S.sel = { k: 'nada' };
    else S.sel.flip = !!S.sel.flip;
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
      if (b.vila) continue;   // choupanas dos construtores não são suas
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
      S.bots.splice(S.bots.indexOf(r.bot), 1); S.kit[kitOfBot(r.bot)] = (S.kit[kitOfBot(r.bot)] || 0) + 1;
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
    return { x: o.x, y: o.y, hx: o.hx ?? o.x, hy: o.hy ?? o.y, store: o.store || {}, t: o.t || 0, tipo: o.tipo || 'mina', job: null,
      mode: 'walk', tx: o.x, ty: o.y, face: 0, phase: 0, dig: 0, moving: false, msg: '' };
  }
  const botCount = b => Object.values(b.store).reduce((a, n) => a + n, 0);
  const kitOfBot = b => (b.tipo === 'fazenda' ? 'ajudante' : 'robo');
  const FARM_R = 6, FARM_CAP = 40;
  // ajudante de fazenda: procura trigo maduro (ou terra arada para plantar), anda até lá e trabalha
  function farmJob(b) {
    const hx = Math.floor(b.hx), hy = Math.floor(b.hy);
    let best = null;
    for (let y = hy - FARM_R; y <= hy + FARM_R; y++) for (let x = hx - FARM_R; x <= hx + FARM_R; x++) {
      if (x < 1 || y < 1 || x >= W - 1 || y >= H - 1) continue;
      const i = I(x, y, 0), t = S.tiles[i];
      let act = null;
      if (t === T.CROP && S.aux[i] >= 3 && (b.store.colheita || 0) < FARM_CAP) act = 'colher';
      else if (t === T.TILLED && (b.store.sementes || 0) > 0) act = 'plantar';
      if (!act) continue;
      const d = Math.hypot(x + 0.5 - b.x, y + 0.5 - b.y) + (act === 'plantar' ? 3 : 0);
      if (!best || d < best.d) best = { x, y, act, d };
    }
    return best;
  }
  function farmWork(b) {
    const j = b.job, i = I(j.x, j.y, 0), t = S.tiles[i];
    if (j.act === 'colher' && t === T.CROP && S.aux[i] >= 3) {
      S.tiles[i] = T.TILLED; S.aux[i] = 0;
      b.store.colheita = (b.store.colheita || 0) + 1;
      if (Math.random() < 0.25) b.happy = performance.now() + 900;
      b.store.sementes = (b.store.sementes || 0) + (Math.random() < 0.6 ? 2 : 1);
    }
    if (S.tiles[i] === T.TILLED && (b.store.sementes || 0) > 0) { S.tiles[i] = T.CROP; S.aux[i] = 0; b.store.sementes--; }
    b.job = null; b.msg = '';
  }
  function botsTick(dt) {
    for (const b of S.bots) {
      b.still = b.moving || b.job ? 0 : (b.still || 0) + dt;
      if (b.tipo === 'fazenda') {
        b.t += dt;
        if (!b.job && b.t >= 2) { b.t = 0; b.job = farmJob(b); b.msg = b.job ? '' : 'nada para colher'; if (b.job) { b.tx = b.job.x + 0.5; b.ty = b.job.y + 0.5; } }
        if (b.job && b.mode !== 'dig' && Math.hypot(b.tx - b.x, b.ty - b.y) < 0.6) { b.mode = 'dig'; b.dig = 0.8; b.phase = 0; b.moving = false; }
        if (b.mode === 'dig') { b.dig -= dt; b.phase += dt * 5; if (b.dig <= 0) { b.mode = 'walk'; if (b.job) farmWork(b); } continue; }
      } else {
      if (b.mode === 'dig') { b.dig -= dt; b.phase += dt * 5; if (b.dig <= 0) { b.mode = 'walk'; botMine(b); } continue; }
      b.t += dt;
      if (b.t >= ROBO_EVERY && botCount(b) < ROBO_CAP) { b.t = 0; b.mode = 'dig'; b.dig = 2.4; b.phase = 0; b.moving = false; continue; }
      }
      const dx = b.tx - b.x, dy = b.ty - b.y, dist = Math.hypot(dx, dy);
      if (dist < 0.08) {
        b.moving = false;
        if (!b.job && Math.random() < dt * 0.5) { const a = Math.random() * 6.283, r = Math.random() * 2.5; b.tx = b.hx + Math.cos(a) * r; b.ty = b.hy + Math.sin(a) * r; }
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
    const got = Object.entries(b.store).filter(([k, n]) => n > 0 && !(b.tipo === 'fazenda' && k === 'sementes' && !quiet));
    if (!got.length) { if (!quiet) toast(b.tipo === 'fazenda' ? `Ajudante: ${b.msg || 'trabalhando'} (sementes guardadas: ${b.store.sementes || 0})` : `Robô: ${b.msg || 'ainda procurando minério'}`); return; }
    for (const [k, n] of got) { give(k, n); b.store[k] = 0; }
    toast((b.tipo === 'fazenda' ? 'Ajudante entregou: ' : 'Robô entregou: ') + got.map(([k, n]) => `${n} ${ITEMS[k].nome.toLowerCase()}`).join(', '), 'gold', 3200);
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
    if (interior) { roomUse(tool); return; }
    const { x, y, z } = target();
    const npc = npcInFront(x, y);
    if (npc) { actHeld = false; showSheet('sheet-shop', npc); return; }
    const chou = (tool === 'espada' || tool === 'machado') && choupanaNaFrente(x, y);   // choupana dos construtores: espada ou machado derrubam
    if (chou) { cooldown = 0.4; swing = SWING_TIME; baterChoupana(chou); return; }
    if (tool !== 'muro' && !interior && z === 0) {   // Usar de frente para a casa: entra
      const hb = houseNear();
      if (hb && shapeHit(hb, x + 0.5, y + 0.5)) { actHeld = false; enterHouse(hb); return; }
    }
    const door = tool !== 'muro' && !interior && doorAction();
    if (door) { actHeld = false; door(); return; }
    const evn = eventoPerto(x, y);
    if (evn) { actHeld = false; pedirPresente(evn); return; }
    const chest = tool !== 'muro' && campChest(x, y);
    if (chest) {
      actHeld = false;
      if (S.mobs.some(m => m.camp === chest.id && Math.hypot(m.x - chest.x, m.y - chest.y) < 8)) { toast('Os saqueadores estão guardando o baú', 'warn'); return; }
      if (chest.bau > 0) { S.coins += chest.bau; toast(`Baú dos saqueadores: +${chest.bau} moedas`, 'gold', 3500); sfx('moeda'); chest.bau = 0; invDirty = true; save(); }
      else toast('O baú está vazio');
      return;
    }
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
            S.tiles[i] = T.SAPLING; S.aux[y * W + x] = 1; give('madeira', TREE_WOOD);
            toast(`+${TREE_WOOD} Madeira · ficou um toco`);
            hint('muda', 'O toco brota uma muda, que vira árvore de novo com o tempo. Corte o toco ou a muda para limpar o terreno.');
          } else { S.tiles[i] = T.GRASS; S.aux[y * W + x] = 0; give('madeira', SAPLING_WOOD); toast(`+${SAPLING_WOOD} Madeira`); }
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
        sfx('espada');
        if (swordStrike()) { wear('espada'); cooldown = 0.38; return; }
        if (z !== 0) return;
        const k = animalInFront(x, y);
        if (k >= 0 && SPECIES[S.animals[k].kind].protegido) { toast('Pintinhos não podem ser caçados. Use a rede.', 'warn'); return; }
        if (k >= 0) {
          const sp = SPECIES[S.animals[k].kind];
          S.animals.splice(k, 1);
          const n = sp.carne + swordBonus();
          give('carne', n); wear('espada'); sfx('espada_acerto');
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
      case 'livro': {
        swing = 0;
        if (!S.owned.livro) { toast('Compre o livro de cura na loja', 'warn'); actHeld = false; return; }
        bookHeal();
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
        // alcance pelo nível: arco 4 → 6 blocos; cetro 4 → 7 → 8 → 10. Vira para o inimigo mais perto
        const lv = wlv(tool), range = tool === 'arco' ? [4, 4, 6, 6, 7][lv] : [4, 4, 7, 8, 10, 10][lv];
        const alvo = aimAt(range + 0.5), d = DIRS[S.p.dir];
        let vx = d[0], vy = d[1];
        if (alvo) { const L = Math.hypot(alvo.x - S.p.x, alvo.y - S.p.y + 0.2) || 1; vx = (alvo.x - S.p.x) / L; vy = (alvo.y - S.p.y + 0.2) / L; }
        const spd = tool === 'arco' ? 13 : 9;
        shots.push({ kind: tool === 'arco' ? 'flecha' : 'magia', x: S.p.x + vx * 0.4, y: S.p.y + vy * 0.4 - 0.2, z: S.p.z,
          vx: vx * spd, vy: vy * spd, left: range, dir: S.p.dir, lv,
          dano: (tool === 'arco' ? 10 : 14) * WLV_DANO[lv], burn: tool === 'arco' ? lv >= 3 : lv >= 4,
          area: tool === 'cetro' ? [1, 1, 1.3, 1.5, 1.8, 2][lv] : 0 });
        if (tool === 'cetro' && lv >= 4 && ++hits3.cetro % 3 === 0) staffNova(lv);
        shotAnim = 0.25;
        cooldown = tool === 'arco' ? 0.55 : 0.45;
        wear(tool); sfx(tool === 'arco' ? 'arco' : 'magia');
        return;
      }
      case 'muro': {
        swing = 0;
        if (S.sel.k === 'nada') { toast('Escolha o que construir: toque no nome da ferramenta (ou R)'); actHeld = false; showSheet('sheet-build'); return; }
        if (S.sel.k === 'kit') placeKit(S.sel.id);
        else if (S.sel.k === 'mover' || S.sel.k === 'girar' || S.sel.k === 'remover') wallEdit(x, y, z, t, i);
        else placeWall(x, y, z, t, i);
        return;
      }
    }
  }

  function centerPlayer() { S.p.x = Math.floor(S.p.x) + 0.5; S.p.y = Math.floor(S.p.y) + 0.5; }
  function layerName(z) { return z === 0 ? 'Superfície' : `Camada ${z}${z >= 4 ? ' · mina profunda' : ''}`; }

  function upDown() {
    if (interior) { toast('Saia da casa para cavar', 'warn'); return; }
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
      p.x = x; p.y = y; p.z = 0; interior = null;
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
    carregarSons();
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
  // Sons gravados (pasta sons/). Enquanto não carregam, ou se faltar o arquivo, toca o som gerado.
  const SOM_ARQ = {
    espada: ['espada_golpe'], espada_acerto: ['espada_acerto'], arco: ['flecha_disparo'], flecha_acerto: ['flecha_acerto'],
    magia: ['magia_lanca'], magia_acerto: ['magia_acerto'], livro: ['livro_cura'], moeda: ['moeda'], construir: ['construir'],
    cavar: ['cavar_1', 'cavar_2', 'cavar_3'], pedra: ['pedra_1', 'pedra_2', 'pedra_3', 'pedra_4'], pedra_quebra: ['pedra_quebra'],
    desaba: ['desaba'], corte: ['corte'], arvore: ['arvore'], inimigo: ['inimigo_1', 'inimigo_2'], bicho_ruge: ['bicho_ruge'], bicho_morre: ['bicho_morre'],
  };
  const SOM_SINT = { espada: 'golpe', espada_acerto: 'acerto', flecha_acerto: 'acerto', magia_acerto: 'atordoa', livro: 'atordoa',
    desaba: 'quebra', pedra_quebra: 'quebra', inimigo: 'quebra', bicho_morre: 'quebra', bicho_ruge: 'quebra' };
  const somBuf = {}, somUltimo = {};
  function carregarSons() {
    // os sons vêm todos juntos no arquivo sons.js (um só arquivo para subir); sem ele, procura a pasta sons/
    if (!window.TERRA_SONS && !carregarSons.tentou) {
      carregarSons.tentou = true;
      const sc = document.createElement('script'); sc.src = 'sons.js';
      sc.onload = sc.onerror = () => carregarSons();
      document.head.appendChild(sc); return;
    }
    const todos = [...new Set(Object.values(SOM_ARQ).flat())];
    for (const f of todos) {
      const src = (window.TERRA_SONS && window.TERRA_SONS[f]) || 'sons/' + f + '.mp3';
      fetch(src).then(r => (r.ok ? r.arrayBuffer() : null))
        .then(b => b && new Promise((ok, no) => actx.decodeAudioData(b, ok, no)))
        .then(buf => { if (buf) somBuf[f] = buf; }).catch(() => {});
    }
  }
  const lastSfx = {};
  function sfx(name) {
    if (!actx || !AUDIO.sons) return;
    const t = actx.currentTime, v = 0.9 + Math.random() * 0.2;
    if (lastSfx[name] && t - lastSfx[name] < 0.04) return;
    lastSfx[name] = t;
    const arq = SOM_ARQ[name] && SOM_ARQ[name].filter(f => somBuf[f]);
    if (arq && arq.length) {
      // sorteia entre as variações, sem repetir a última quando há mais de uma
      let f = arq[Math.floor(Math.random() * arq.length)];
      if (arq.length > 1 && f === somUltimo[name]) f = arq[(arq.indexOf(f) + 1) % arq.length];
      somUltimo[name] = f;
      const src = actx.createBufferSource(), g = actx.createGain();
      src.buffer = somBuf[f]; src.playbackRate.value = 0.96 + Math.random() * 0.08; g.gain.value = 0.85;
      src.connect(g); g.connect(sfxBus); src.start(t);
      return;
    }
    name = SOM_SINT[name] || name;
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
  // Música: flauta medieval em ré dórico, com bordão grave, alaúde e tamborim
  const SCALE = [0, 2, 3, 5, 7, 9, 10];   // ré dórico
  const BASE = 146.83;                      // ré3
  const CHORDS = [[0, 4], [3, 0], [6, 2], [4, 1], [0, 4], [5, 2], [3, 0], [4, 1]];   // grau do baixo, grau "cor"
  let musicTimer = null, musicT = 0;
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
  // Flauta doce: seno com um pouco de 2º harmônico, sopro no começo da nota e vibrato que entra depois
  function flute(f, t, dur, vol) {
    const o = actx.createOscillator(), o2 = actx.createOscillator(), g2 = actx.createGain(), lfo = actx.createOscillator(), lg = actx.createGain();
    const flt = actx.createBiquadFilter(), g = actx.createGain();
    o.type = 'sine'; o.frequency.value = f; o2.type = 'triangle'; o2.frequency.value = f * 2; g2.gain.value = 0.1;
    lfo.frequency.value = 5.3; lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(f * 0.007, t + Math.min(0.35, dur * 0.6));
    lfo.connect(lg); lg.connect(o.frequency); lg.connect(o2.frequency);
    flt.type = 'lowpass'; flt.frequency.value = f * 5;
    const end = t + dur;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.05); g.gain.linearRampToValueAtTime(vol * 0.82, t + 0.2);
    g.gain.setValueAtTime(vol * 0.82, Math.max(t + 0.2, end - 0.08)); g.gain.linearRampToValueAtTime(0.0001, end);
    o.connect(flt); o2.connect(g2); g2.connect(flt); flt.connect(g); g.connect(musicBus);
    // sopro: ruído filtrado bem curto no ataque
    if (noiseBuf) {
      const n = actx.createBufferSource(), nf = actx.createBiquadFilter(), ng = actx.createGain();
      n.buffer = noiseBuf; nf.type = 'bandpass'; nf.frequency.value = f * 2.5; nf.Q.value = 1.2;
      ng.gain.setValueAtTime(vol * 0.5, t); ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
      n.connect(nf); nf.connect(ng); ng.connect(musicBus); n.start(t, Math.random() * 0.5); n.stop(t + 0.12);
    }
    for (const x of [o, o2, lfo]) { x.start(t); x.stop(end + 0.05); }
  }
  // bordão grave contínuo (como uma gaita de foles bem suave)
  function drone(t, dur, vol) {
    for (const [f, v] of [[BASE / 2, 1], [BASE * 0.75, 0.6]]) {
      const o = actx.createOscillator(), flt = actx.createBiquadFilter(), g = actx.createGain();
      o.type = 'sawtooth'; o.frequency.value = f; flt.type = 'lowpass'; flt.frequency.value = 380;
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol * v, t + 0.6); g.gain.setValueAtTime(vol * v, t + dur - 0.6); g.gain.linearRampToValueAtTime(0.0001, t + dur);
      o.connect(flt); flt.connect(g); g.connect(musicBus); o.start(t); o.stop(t + dur + 0.05);
    }
  }
  // tamborim de moldura: batida grave e toques leves
  function tabor(t, vol, grave) {
    const o = actx.createOscillator(), g = actx.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(grave ? 110 : 190, t); o.frequency.exponentialRampToValueAtTime(grave ? 55 : 120, t + 0.12);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + (grave ? 0.25 : 0.1));
    o.connect(g); g.connect(musicBus); o.start(t); o.stop(t + 0.3);
  }
  // Frases (grau da escala, tempos). 7 = ré da flauta; -1 = pausa. Cada frase tem 2 compassos de 4 tempos.
  const FRASES = {
    A1: { b: [0, -1], n: [[7, 1], [8, 0.5], [9, 0.5], [11, 1], [9, 1], [10, 0.5], [9, 0.5], [8, 1], [7, 2]] },
    A2: { b: [0, 4], n: [[7, 1], [8, 0.5], [9, 0.5], [11, 1], [12, 1], [11, 0.5], [10, 0.5], [9, 1], [11, 2]] },
    B1: { b: [3, 0], n: [[10, 1.5], [11, 0.5], [12, 1], [10, 1], [11, 0.5], [10, 0.5], [9, 1], [8, 2]] },
    B2: { b: [-1, 0], n: [[9, 1], [10, 0.5], [9, 0.5], [8, 1], [6, 1], [7, 0.5], [8, 0.5], [6, 1], [7, 2]] },
    C1: { b: [4, 3], n: [[11, 0.5], [12, 0.5], [13, 1], [11, 1], [9, 1], [10, 1], [9, 0.5], [8, 0.5], [9, 2]] },
    D1: { b: [0, 0], n: [[4, 2], [5, 1], [6, 1], [7, 3], [-1, 1]] },
  };
  const FORMA = ['A1', 'A2', 'A1', 'B2', 'B1', 'B2', 'C1', 'D1'];
  let frase = 0;
  function musicBar(t) {
    const beat = 60 / 84, F = FRASES[FORMA[frase % FORMA.length]], bars = 2, len = beat * 4 * bars;
    if (frase % FORMA.length === 0 || frase % 4 === 0) drone(t, beat * 4 * 8 + 0.6, 0.03);   // bordão renovado a cada 4 frases
    // alaúde suave no tempo forte de cada compasso
    F.b.forEach((r, k) => { const tb = t + k * beat * 4; pluck(freq(r - 7), tb, 0.12, beat * 3); pluck(freq(r - 3), tb + beat * 2, 0.06, beat * 1.6); });
    // tamborim: tum . tá tá | tum . tá .
    for (let k = 0; k < bars; k++) { const tb = t + k * beat * 4; tabor(tb, 0.2, true); tabor(tb + beat * 2, 0.08); tabor(tb + beat * 2.5, 0.06); if (k === 0) tabor(tb + beat * 3, 0.07); }
    // flauta: a frase com pequenas variações (enfeite antes de notas longas, às vezes uma oitava acima)
    let tt = t;
    const oit = Math.random() < 0.2 ? 7 : 0;
    for (const [d, r] of F.n) {
      if (d >= 0) {
        if (r >= 1 && Math.random() < 0.25) { flute(freq(d + oit + 1), tt, beat * 0.18, 0.05); flute(freq(d + oit), tt + beat * 0.18, r * beat * 0.95 - beat * 0.18, 0.075); }
        else flute(freq(d + oit), tt, r * beat * 0.95, 0.075);
      }
      tt += r * beat;
    }
    frase++;
    return len;
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
  // qualidade dos gráficos: "leve" desenha em menos pixels (bom para celular), "alta" usa a tela toda
  const GRAF = (() => { try { const g = JSON.parse(localStorage.getItem('terra-funda-graficos')); if (g) return g; } catch (e) {} return { alta: !matchMedia('(pointer: coarse)').matches }; })();
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
    const g = document.createElement('button'); g.type = 'button'; g.className = 'btn';
    const updG = () => { g.textContent = `Gráficos: ${GRAF.alta ? 'alta qualidade' : 'leve'}`; };
    g.addEventListener('click', () => { GRAF.alta = !GRAF.alta; try { localStorage.setItem('terra-funda-graficos', JSON.stringify(GRAF)); } catch (e) {} updG(); resize(); });
    updG(); row.append(g);
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
    } else if (id === 'livro') {
      px(c, 3, 3, 10, 11, '#3a6a3a'); px(c, 4, 4, 8, 9, '#4f8a4a'); px(c, 3, 3, 1, 11, '#c9a64a');
      px(c, 7, 6, 2, 5, '#e8f8d0'); px(c, 6, 7, 4, 2, '#e8f8d0');
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
  const ATLAS = /*ATLAS_MAP*/{"gtex_campos":[0,0,512,512],"gtex_floresta":[514,0,512,512],"gtex_pantano":[1028,0,512,512],"gtex_deserto":[1542,0,512,512],"gtex_montanhas":[2056,0,512,512],"gtex_neve":[2570,0,512,512],"gtex_trilha":[3084,0,512,512],"water_tex":[3598,0,256,256],"water_deep_tex":[0,514,256,256],"tree_campos_0":[258,514,84,150],"tree_floresta_3":[344,514,84,150],"tree_pantano_0":[430,514,131,150],"tree_deserto_0":[563,514,80,150],"tree_montanhas_1":[645,514,88,150],"tree_neve_2":[735,514,86,150],"tree_neve_3":[823,514,87,150],"tree_campos_3":[912,514,76,149],"tree_floresta_1":[990,514,89,149],"tree_pantano_1":[1081,514,103,149],"tree_neve_0":[1186,514,79,149],"tree_neve_1":[1267,514,79,149],"tree_campos_1":[1348,514,89,147],"tree_pantano_3":[1439,514,107,146],"tree_montanhas_0":[1548,514,79,146],"tree_montanhas_3":[1629,514,73,145],"tree_floresta_0":[1704,514,75,144],"tree_deserto_2":[1781,514,68,144],"tree_campos_2":[1851,514,118,143],"tree_montanhas_2":[1971,514,114,142],"sk_cacadora_swing_maos_side":[2087,514,70,140],"sk_cowboy_caveira_swing_maos_side":[2159,514,64,140],"sk_guardiao_cristal_swing_maos_side":[2225,514,70,140],"sk_rei_dourado_swing_maos_side":[2297,514,70,140],"sk_rei_mascarado_swing_maos_side":[2369,514,71,140],"tree_floresta_2":[2442,514,86,134],"tree_deserto_1":[2530,514,86,134],"tree_pantano_2":[2618,514,147,129],"coelhao_pose_1":[2767,514,86,123],"coelhao_pose_0":[2855,514,74,122],"noel_pose_4":[2931,514,93,120],"coelhao_pose_3":[3026,514,71,120],"sk_exploradora_swing_front":[3099,514,81,119],"sk_exploradora_swing_gesto_dois_front":[3182,514,81,119],"sk_exploradora_swing_gesto_dois_side":[3265,514,81,119],"bicho_front_1":[3348,514,114,119],"bicho_front_2":[3464,514,115,119],"bicho_front_3":[3581,514,132,119],"bicho_dig_0":[3715,514,160,119],"sk_carrasco_swing_front":[3877,514,82,118],"sk_carrasco_swing_up":[3961,514,78,118],"sk_carrasco_swing_gesto_dois_front":[0,772,82,118],"sk_carrasco_swing_gesto_um_front":[84,772,68,118],"sk_carrasco_swing_gesto_dois_back":[154,772,78,118],"sk_carrasco_swing_gesto_um_back":[234,772,67,118],"sk_carrasco_swing_gesto_dois_side":[303,772,82,118],"sk_carrasco_swing_gesto_um_side":[387,772,68,118],"sk_exploradora_swing_up":[457,772,78,118],"sk_exploradora_swing_gesto_um_front":[537,772,67,118],"sk_exploradora_swing_gesto_dois_back":[606,772,78,118],"sk_exploradora_swing_gesto_um_back":[686,772,67,118],"sk_exploradora_swing_gesto_um_side":[755,772,67,118],"bicho_front_0":[824,772,113,118],"sk_carrasco_swing_maos_side":[939,772,53,117],"bicho_dig_3":[994,772,192,116],"coelhao_side_0":[1188,772,52,116],"coelhao_side_1":[1242,772,51,116],"coelhao_side_3":[1295,772,53,116],"coelhao_side_4":[1350,772,53,116],"coelhao_side_2":[1405,772,57,115],"coelhao_side_5":[1464,772,54,115],"coelhao_pose_4":[1520,772,56,115],"sk_exploradora_swing_maos_side":[1578,772,53,114],"chefe_front_0":[1633,772,89,112],"chefe_front_1":[1724,772,88,112],"chefe_front_2":[1814,772,88,112],"chefe_front_3":[1904,772,88,112],"chefe_front_4":[1994,772,89,112],"chefe_front_5":[2085,772,88,112],"bicho_dig_1":[2175,772,172,112],"noel_front_0":[2349,772,70,112],"noel_front_2":[2421,772,69,112],"noel_front_4":[2492,772,68,112],"coelhao_front_0":[2562,772,67,112],"coelhao_front_4":[2631,772,68,112],"sk_guarda_azul_swing_front":[2701,772,76,111],"sk_guarda_azul_swing_up":[2779,772,74,111],"sk_guarda_azul_swing_gesto_dois_front":[2855,772,76,111],"sk_guarda_azul_swing_gesto_um_front":[2933,772,63,111],"sk_guarda_azul_swing_gesto_dois_back":[2998,772,74,111],"sk_guarda_azul_swing_gesto_um_back":[3074,772,63,111],"sk_guarda_azul_swing_gesto_dois_side":[3139,772,76,111],"sk_guarda_azul_swing_gesto_um_side":[3217,772,63,111],"sk_mecanico_vermelho_swing_front":[3282,772,74,111],"sk_mecanico_vermelho_swing_up":[3358,772,73,111],"sk_mecanico_vermelho_swing_gesto_dois_front":[3433,772,74,111],"sk_mecanico_vermelho_swing_gesto_dois_back":[3509,772,73,111],"sk_mecanico_vermelho_swing_gesto_dois_side":[3584,772,74,111],"sk_samurai_swing_maos_side":[3660,772,50,111],"sk_sombra_tatica_swing_front":[3712,772,75,111],"sk_sombra_tatica_swing_up":[3789,772,74,111],"sk_sombra_tatica_swing_gesto_dois_front":[3865,772,75,111],"sk_sombra_tatica_swing_gesto_um_front":[3942,772,62,111],"sk_sombra_tatica_swing_gesto_dois_back":[4006,772,74,111],"sk_sombra_tatica_swing_gesto_um_back":[0,892,62,111],"sk_sombra_tatica_swing_gesto_dois_side":[64,892,75,111],"sk_sombra_tatica_swing_gesto_um_side":[141,892,62,111],"coelhao_front_3":[205,892,68,111],"coelhao_front_5":[275,892,67,111],"construtor_martelo_0":[344,892,97,111],"sk_cowboy_caveira_swing_front":[443,892,73,110],"sk_cowboy_caveira_swing_up":[518,892,72,110],"sk_cowboy_caveira_swing_gesto_dois_front":[592,892,73,110],"sk_cowboy_caveira_swing_gesto_um_front":[667,892,62,110],"sk_cowboy_caveira_swing_gesto_dois_back":[731,892,72,110],"sk_cowboy_caveira_swing_gesto_um_back":[805,892,59,110],"sk_cowboy_caveira_swing_gesto_dois_side":[866,892,73,110],"sk_cowboy_caveira_swing_gesto_um_side":[941,892,62,110],"sk_guardiao_cristal_swing_front":[1005,892,71,110],"sk_guardiao_cristal_swing_up":[1078,892,70,110],"sk_guardiao_cristal_swing_gesto_dois_front":[1150,892,71,110],"sk_guardiao_cristal_swing_gesto_dois_back":[1223,892,70,110],"sk_guardiao_cristal_swing_gesto_dois_side":[1295,892,71,110],"sk_mecanico_vermelho_swing_gesto_um_front":[1368,892,62,110],"sk_mecanico_vermelho_swing_gesto_um_back":[1432,892,62,110],"sk_mecanico_vermelho_swing_gesto_um_side":[1496,892,62,110],"sk_princesa_swing_front":[1560,892,73,110],"sk_princesa_swing_up":[1635,892,71,110],"sk_princesa_swing_gesto_dois_front":[1708,892,73,110],"sk_princesa_swing_gesto_um_front":[1783,892,65,110],"sk_princesa_swing_gesto_dois_back":[1850,892,71,110],"sk_princesa_swing_gesto_um_back":[1923,892,67,110],"sk_princesa_swing_gesto_dois_side":[1992,892,73,110],"sk_princesa_swing_gesto_um_side":[2067,892,65,110],"sk_raposa_swing_maos_side":[2134,892,66,110],"sk_raposa_swing_aceno":[2202,892,66,110],"sk_raposa_swing_gesto_dois_side":[2270,892,66,110],"sk_raposa_swing_gesto_um_side":[2338,892,66,110],"sk_rei_dourado_swing_front":[2406,892,73,110],"sk_rei_dourado_swing_up":[2481,892,72,110],"sk_rei_dourado_swing_gesto_dois_front":[2555,892,73,110],"sk_rei_dourado_swing_gesto_um_front":[2630,892,66,110],"sk_rei_dourado_swing_gesto_dois_back":[2698,892,72,110],"sk_rei_dourado_swing_gesto_dois_side":[2772,892,73,110],"sk_rei_dourado_swing_gesto_um_side":[2847,892,66,110],"sk_rei_mascarado_swing_front":[2915,892,73,110],"sk_rei_mascarado_swing_up":[2990,892,72,110],"sk_rei_mascarado_swing_gesto_dois_front":[3064,892,73,110],"sk_rei_mascarado_swing_gesto_um_front":[3139,892,66,110],"sk_rei_mascarado_swing_gesto_dois_back":[3207,892,72,110],"sk_rei_mascarado_swing_gesto_dois_side":[3281,892,73,110],"sk_rei_mascarado_swing_gesto_um_side":[3356,892,66,110],"sk_samurai_swing_front":[3424,892,72,110],"sk_samurai_swing_up":[3498,892,70,110],"sk_samurai_swing_gesto_dois_front":[3570,892,72,110],"sk_samurai_swing_gesto_um_front":[3644,892,59,110],"sk_samurai_swing_gesto_dois_back":[3705,892,70,110],"sk_samurai_swing_gesto_um_back":[3777,892,58,110],"sk_samurai_swing_gesto_dois_side":[3837,892,72,110],"sk_samurai_swing_gesto_um_side":[3911,892,59,110],"cetro_mao":[3972,892,107,110],"cetro_brilho":[0,1005,105,110],"chefe_back_0":[107,1005,78,110],"noel_front_1":[187,1005,69,110],"noel_front_3":[258,1005,68,110],"noel_front_5":[328,1005,68,110],"noel_pose_1":[398,1005,96,110],"noel_pose_2":[496,1005,61,110],"noel_pose_3":[559,1005,89,110],"sk_cacadora_swing_front":[650,1005,72,109],"sk_cacadora_swing_up":[724,1005,70,109],"sk_cacadora_swing_gesto_dois_front":[796,1005,72,109],"sk_cacadora_swing_gesto_um_front":[870,1005,61,109],"sk_cacadora_swing_gesto_dois_back":[933,1005,70,109],"sk_cacadora_swing_gesto_um_back":[1005,1005,60,109],"sk_cacadora_swing_gesto_dois_side":[1067,1005,72,109],"sk_cacadora_swing_gesto_um_side":[1141,1005,61,109],"sk_cacique_swing_front":[1204,1005,73,109],"sk_cacique_swing_gesto_dois_front":[1279,1005,73,109],"sk_cacique_swing_gesto_dois_side":[1354,1005,73,109],"sk_ceifador_swing_front":[1429,1005,75,109],"sk_ceifador_swing_up":[1506,1005,72,109],"sk_ceifador_swing_maos_side":[1580,1005,63,109],"sk_ceifador_swing_gesto_dois_front":[1645,1005,75,109],"sk_ceifador_swing_gesto_um_front":[1722,1005,65,109],"sk_ceifador_swing_gesto_dois_back":[1789,1005,72,109],"sk_ceifador_swing_gesto_um_back":[1863,1005,58,109],"sk_ceifador_swing_gesto_dois_side":[1923,1005,75,109],"sk_ceifador_swing_gesto_um_side":[2000,1005,65,109],"sk_espectro_swing_front":[2067,1005,75,109],"sk_espectro_swing_up":[2144,1005,71,109],"sk_espectro_swing_maos_side":[2217,1005,71,109],"sk_espectro_swing_gesto_dois_front":[2290,1005,75,109],"sk_espectro_swing_gesto_um_front":[2367,1005,75,109],"sk_espectro_swing_gesto_dois_back":[2444,1005,71,109],"sk_espectro_swing_gesto_um_back":[2517,1005,71,109],"sk_espectro_swing_gesto_dois_side":[2590,1005,75,109],"sk_espectro_swing_gesto_um_side":[2667,1005,75,109],"sk_guardiao_cristal_swing_gesto_um_front":[2744,1005,61,109],"sk_guardiao_cristal_swing_gesto_um_back":[2807,1005,60,109],"sk_guardiao_cristal_swing_gesto_um_side":[2869,1005,61,109],"sk_pirata_swing_up":[2932,1005,71,109],"sk_pirata_swing_gesto_dois_back":[3005,1005,71,109],"sk_pirata_swing_gesto_um_back":[3078,1005,60,109],"sk_raposa_swing_front":[3140,1005,72,109],"sk_raposa_swing_up":[3214,1005,71,109],"sk_raposa_swing_gesto_dois_front":[3287,1005,72,109],"sk_raposa_swing_gesto_um_front":[3361,1005,76,109],"sk_raposa_swing_gesto_dois_back":[3439,1005,71,109],"sk_raposa_swing_gesto_um_back":[3512,1005,66,109],"sk_rei_dourado_swing_gesto_um_back":[3580,1005,65,109],"sk_rei_mascarado_swing_gesto_um_back":[3647,1005,60,109],"chefe_back_1":[3709,1005,77,109],"chefe_back_2":[3788,1005,77,109],"chefe_atk_front_0":[3867,1005,85,109],"chefe_atk_front_1":[3954,1005,100,109],"chefe_atk_side_0":[0,1117,77,109],"noel_pose_0":[79,1117,82,109],"coelhao_back_1":[163,1117,57,109],"coelhao_back_5":[222,1117,55,109],"sk_arqueira_mata_swing_front":[279,1117,75,108],"sk_arqueira_mata_swing_up":[356,1117,71,108],"sk_arqueira_mata_swing_gesto_dois_front":[429,1117,75,108],"sk_arqueira_mata_swing_gesto_um_front":[506,1117,63,108],"sk_arqueira_mata_swing_gesto_dois_back":[571,1117,71,108],"sk_arqueira_mata_swing_gesto_um_back":[644,1117,59,108],"sk_arqueira_mata_swing_gesto_dois_side":[705,1117,75,108],"sk_arqueira_mata_swing_gesto_um_side":[782,1117,63,108],"sk_cacique_swing_up":[847,1117,71,108],"sk_cacique_swing_gesto_um_front":[920,1117,61,108],"sk_cacique_swing_gesto_dois_back":[983,1117,71,108],"sk_cacique_swing_gesto_um_back":[1056,1117,58,108],"sk_cacique_swing_gesto_um_side":[1116,1117,61,108],"sk_ciberpiloto_swing_front":[1179,1117,73,108],"sk_ciberpiloto_swing_up":[1254,1117,70,108],"sk_ciberpiloto_swing_maos_side":[1326,1117,51,108],"sk_ciberpiloto_swing_gesto_dois_front":[1379,1117,73,108],"sk_ciberpiloto_swing_gesto_dois_back":[1454,1117,70,108],"sk_ciberpiloto_swing_gesto_dois_side":[1526,1117,73,108],"sk_guarda_azul_swing_maos_side":[1601,1117,51,108],"sk_pinguim_chapeu_swing_up":[1654,1117,71,108],"sk_pinguim_chapeu_swing_gesto_dois_back":[1727,1117,71,108],"sk_pirata_swing_front":[1800,1117,73,108],"sk_pirata_swing_gesto_dois_front":[1875,1117,73,108],"sk_pirata_swing_gesto_dois_side":[1950,1117,73,108],"sk_pistoleira_swing_front":[2025,1117,74,108],"sk_pistoleira_swing_up":[2101,1117,71,108],"sk_pistoleira_swing_maos_side":[2174,1117,62,108],"sk_pistoleira_swing_gesto_dois_front":[2238,1117,74,108],"sk_pistoleira_swing_gesto_um_front":[2314,1117,74,108],"sk_pistoleira_swing_gesto_dois_back":[2390,1117,71,108],"sk_pistoleira_swing_gesto_um_back":[2463,1117,71,108],"sk_pistoleira_swing_gesto_dois_side":[2536,1117,74,108],"sk_pistoleira_swing_gesto_um_side":[2612,1117,74,108],"sk_sombra_tatica_swing_maos_side":[2688,1117,50,108],"noel_back_4":[2740,1117,60,108],"coelhao_back_0":[2802,1117,64,108],"coelhao_back_2":[2868,1117,55,108],"coelhao_back_4":[2925,1117,61,108],"sk_arqueiro_mata_swing_front":[2988,1117,73,107],"sk_arqueiro_mata_swing_up":[3063,1117,71,107],"sk_arqueiro_mata_swing_gesto_dois_front":[3136,1117,73,107],"sk_arqueiro_mata_swing_gesto_um_front":[3211,1117,61,107],"sk_arqueiro_mata_swing_gesto_dois_back":[3274,1117,71,107],"sk_arqueiro_mata_swing_gesto_um_back":[3347,1117,59,107],"sk_arqueiro_mata_swing_gesto_dois_side":[3408,1117,73,107],"sk_arqueiro_mata_swing_gesto_um_side":[3483,1117,61,107],"sk_ciberpiloto_swing_gesto_um_front":[3546,1117,65,107],"sk_ciberpiloto_swing_gesto_um_back":[3613,1117,57,107],"sk_ciberpiloto_swing_gesto_um_side":[3672,1117,65,107],"sk_elfo_vermelho_swing_maos_side":[3739,1117,43,107],"sk_elfo_vermelho_swing_gesto_dois_side":[3784,1117,43,107],"sk_guerreiro_tribal_swing_front":[3829,1117,73,107],"sk_guerreiro_tribal_swing_up":[3904,1117,71,107],"sk_guerreiro_tribal_swing_gesto_dois_front":[3977,1117,73,107],"sk_guerreiro_tribal_swing_gesto_um_front":[0,1228,61,107],"sk_guerreiro_tribal_swing_gesto_dois_back":[63,1228,71,107],"sk_guerreiro_tribal_swing_gesto_um_back":[136,1228,59,107],"sk_guerreiro_tribal_swing_gesto_dois_side":[197,1228,73,107],"sk_guerreiro_tribal_swing_gesto_um_side":[272,1228,61,107],"sk_mecanico_vermelho_swing_maos_side":[335,1228,50,107],"sk_pinguim_chapeu_swing_front":[387,1228,71,107],"sk_pinguim_chapeu_swing_maos_side":[460,1228,51,107],"sk_pinguim_chapeu_swing_aceno":[513,1228,63,107],"sk_pinguim_chapeu_swing_gesto_dois_front":[578,1228,71,107],"sk_pinguim_chapeu_swing_gesto_dois_side":[651,1228,51,107],"sk_pinguim_chapeu_swing_gesto_um_side":[704,1228,63,107],"sk_pirata_swing_maos_side":[769,1228,50,107],"sk_pirata_swing_gesto_um_front":[821,1228,61,107],"sk_pirata_swing_gesto_um_side":[884,1228,61,107],"sk_policial_swing_front":[947,1228,72,107],"sk_policial_swing_up":[1021,1228,70,107],"sk_policial_swing_maos_side":[1093,1228,50,107],"sk_policial_swing_gesto_dois_front":[1145,1228,72,107],"sk_policial_swing_gesto_um_front":[1219,1228,65,107],"sk_policial_swing_gesto_dois_back":[1286,1228,70,107],"sk_policial_swing_gesto_um_back":[1358,1228,57,107],"sk_policial_swing_gesto_dois_side":[1417,1228,72,107],"sk_policial_swing_gesto_um_side":[1491,1228,65,107],"sk_saqueador_swing_up":[1558,1228,70,107],"sk_saqueador_swing_gesto_dois_back":[1630,1228,70,107],"sk_saqueador_swing_gesto_um_back":[1702,1228,57,107],"noel_back_0":[1761,1228,64,107],"noel_back_1":[1827,1228,63,107],"noel_back_2":[1892,1228,60,107],"noel_back_3":[1954,1228,63,107],"noel_back_5":[2019,1228,63,107],"sk_aprendiz_swing_front":[2084,1228,70,106],"sk_aprendiz_swing_up":[2156,1228,70,106],"sk_aprendiz_swing_maos_side":[2228,1228,43,106],"sk_aprendiz_swing_gesto_dois_front":[2273,1228,70,106],"sk_aprendiz_swing_gesto_um_front":[2345,1228,70,106],"sk_aprendiz_swing_gesto_dois_back":[2417,1228,70,106],"sk_aprendiz_swing_gesto_um_back":[2489,1228,62,106],"sk_aprendiz_swing_gesto_dois_side":[2553,1228,43,106],"sk_armadura_estelar_swing_front":[2598,1228,70,106],"sk_armadura_estelar_swing_up":[2670,1228,70,106],"sk_armadura_estelar_swing_maos_side":[2742,1228,42,106],"sk_armadura_estelar_swing_aceno":[2786,1228,49,106],"sk_armadura_estelar_swing_gesto_dois_front":[2837,1228,70,106],"sk_armadura_estelar_swing_gesto_um_front":[2909,1228,70,106],"sk_armadura_estelar_swing_gesto_dois_back":[2981,1228,70,106],"sk_armadura_estelar_swing_gesto_dois_side":[3053,1228,42,106],"sk_armadura_estelar_swing_gesto_um_side":[3097,1228,49,106],"sk_elfo_verde_swing_front":[3148,1228,71,106],"sk_elfo_verde_swing_up":[3221,1228,70,106],"sk_elfo_verde_swing_maos_side":[3293,1228,43,106],"sk_elfo_verde_swing_gesto_dois_front":[3338,1228,71,106],"sk_elfo_verde_swing_gesto_dois_back":[3411,1228,70,106],"sk_elfo_verde_swing_gesto_um_back":[3483,1228,62,106],"sk_elfo_verde_swing_gesto_dois_side":[3547,1228,43,106],"sk_elfo_vermelho_swing_front":[3592,1228,71,106],"sk_elfo_vermelho_swing_up":[3665,1228,71,106],"sk_elfo_vermelho_swing_gesto_dois_front":[3738,1228,71,106],"sk_elfo_vermelho_swing_gesto_um_front":[3811,1228,66,106],"sk_elfo_vermelho_swing_gesto_dois_back":[3879,1228,71,106],"sk_elfo_vermelho_swing_gesto_um_back":[3952,1228,63,106],"sk_husky_swing_front":[4017,1228,70,106],"sk_husky_swing_up":[0,1337,70,106],"sk_husky_swing_maos_side":[72,1337,45,106],"sk_husky_swing_aceno":[119,1337,58,106],"sk_husky_swing_gesto_dois_front":[179,1337,70,106],"sk_husky_swing_gesto_dois_back":[251,1337,70,106],"sk_husky_swing_gesto_dois_side":[323,1337,45,106],"sk_husky_swing_gesto_um_side":[370,1337,58,106],"sk_maga_prata_swing_front":[430,1337,70,106],"sk_maga_prata_swing_up":[502,1337,70,106],"sk_maga_prata_swing_maos_side":[574,1337,43,106],"sk_maga_prata_swing_gesto_dois_front":[619,1337,70,106],"sk_maga_prata_swing_gesto_um_front":[691,1337,65,106],"sk_maga_prata_swing_gesto_dois_back":[758,1337,70,106],"sk_maga_prata_swing_gesto_um_back":[830,1337,63,106],"sk_maga_prata_swing_gesto_dois_side":[895,1337,43,106],"sk_pinguim_chapeu_swing_gesto_um_front":[940,1337,68,106],"sk_pinguim_chapeu_swing_gesto_um_back":[1010,1337,64,106],"sk_pinguim_gravata_swing_front":[1076,1337,70,106],"sk_pinguim_gravata_swing_up":[1148,1337,69,106],"sk_pinguim_gravata_swing_maos_side":[1219,1337,54,106],"sk_pinguim_gravata_swing_aceno":[1275,1337,60,106],"sk_pinguim_gravata_swing_gesto_dois_front":[1337,1337,70,106],"sk_pinguim_gravata_swing_gesto_dois_back":[1409,1337,69,106],"sk_pinguim_gravata_swing_gesto_dois_side":[1480,1337,54,106],"sk_pinguim_gravata_swing_gesto_um_side":[1536,1337,60,106],"sk_pinguim_jaqueta_swing_aceno":[1598,1337,53,106],"sk_pinguim_jaqueta_swing_gesto_um_side":[1653,1337,53,106],"sk_princesa_swing_maos_side":[1708,1337,49,106],"robo_dig_0":[1759,1337,111,106],"robo_dig_1":[1872,1337,113,106],"robo_dig_2":[1987,1337,85,106],"saq_side_0":[2074,1337,57,106],"saq_side_2":[2133,1337,65,106],"bicho_back_4":[2200,1337,111,106],"noel_side_0":[2313,1337,72,106],"noel_side_1":[2387,1337,72,106],"noel_side_2":[2461,1337,69,106],"noel_side_3":[2532,1337,73,106],"noel_side_4":[2607,1337,71,106],"noel_side_5":[2680,1337,73,106],"coelhao_back_3":[2755,1337,61,106],"sk_aprendiz_swing_aceno":[2818,1337,60,105],"sk_aprendiz_swing_gesto_um_side":[2880,1337,60,105],"sk_armadura_estelar_swing_gesto_um_back":[2942,1337,63,105],"sk_arqueira_mata_swing_maos_side":[3007,1337,48,105],"sk_arqueiro_mata_swing_maos_side":[3057,1337,48,105],"sk_elfo_verde_swing_gesto_um_front":[3107,1337,67,105],"sk_guerreiro_tribal_swing_maos_side":[3176,1337,48,105],"sk_husky_swing_gesto_um_front":[3226,1337,65,105],"sk_husky_swing_gesto_um_back":[3293,1337,62,105],"sk_mago_noturno_swing_front":[3357,1337,70,105],"sk_mago_noturno_swing_up":[3429,1337,70,105],"sk_mago_noturno_swing_maos_side":[3501,1337,42,105],"sk_mago_noturno_swing_gesto_dois_front":[3545,1337,70,105],"sk_mago_noturno_swing_gesto_um_front":[3617,1337,66,105],"sk_mago_noturno_swing_gesto_dois_back":[3685,1337,70,105],"sk_mago_noturno_swing_gesto_um_back":[3757,1337,64,105],"sk_mago_noturno_swing_gesto_dois_side":[3823,1337,42,105],"sk_pinguim_gravata_swing_gesto_um_back":[3867,1337,63,105],"sk_pinguim_jaqueta_swing_front":[3932,1337,70,105],"sk_pinguim_jaqueta_swing_up":[4004,1337,70,105],"sk_pinguim_jaqueta_swing_maos_side":[0,1445,46,105],"sk_pinguim_jaqueta_swing_gesto_dois_front":[48,1445,70,105],"sk_pinguim_jaqueta_swing_gesto_um_front":[120,1445,66,105],"sk_pinguim_jaqueta_swing_gesto_dois_back":[188,1445,70,105],"sk_pinguim_jaqueta_swing_gesto_dois_side":[260,1445,46,105],"sk_saqueador_swing_front":[308,1445,72,105],"sk_saqueador_swing_maos_side":[382,1445,49,105],"sk_saqueador_swing_gesto_dois_front":[433,1445,72,105],"sk_saqueador_swing_gesto_um_front":[507,1445,60,105],"sk_saqueador_swing_gesto_dois_side":[569,1445,72,105],"sk_saqueador_swing_gesto_um_side":[643,1445,60,105],"sk_vampiro_swing_aceno":[705,1445,59,105],"sk_vampiro_swing_gesto_um_side":[766,1445,59,105],"bicho_back_1":[827,1445,112,105],"bicho_back_3":[941,1445,112,105],"tree_floresta":[1055,1445,79,104],"tree_deserto":[1136,1445,59,104],"tree_neve":[1197,1445,75,104],"menino_front_idle":[1274,1445,49,104],"menino_front_walk_0":[1325,1445,49,104],"menino_front_walk_1":[1376,1445,50,104],"menino_front_walk_2":[1428,1445,49,104],"menino_front_walk_3":[1479,1445,51,104],"menino_back_idle":[1532,1445,47,104],"menino_back_walk_0":[1581,1445,47,104],"menino_back_walk_1":[1630,1445,47,104],"menino_back_walk_2":[1679,1445,47,104],"menino_back_walk_3":[1728,1445,48,104],"menino_side_idle":[1778,1445,43,104],"menino_side_walk_0":[1823,1445,43,104],"menino_side_walk_1":[1868,1445,43,104],"menino_side_walk_2":[1913,1445,43,104],"menino_side_walk_3":[1958,1445,45,104],"menino_side_walk_4":[2005,1445,45,104],"menino_side_walk_5":[2052,1445,45,104],"menino_side_walk_6":[2099,1445,45,104],"menino_side_walk_7":[2146,1445,43,104],"menino_swing_front":[2191,1445,59,104],"menino_swing_up":[2252,1445,59,104],"menino_swing_side":[2313,1445,42,104],"menino_swing_front2":[2357,1445,59,104],"menino_swing_gesto_um_front":[2418,1445,59,104],"menino_swing_gesto_um_back":[2479,1445,59,104],"menino_swing_gesto_um_side":[2540,1445,42,104],"menino_swing_gesto_dois_side":[2584,1445,42,104],"menino_swing_gesto_dois_front":[2628,1445,65,104],"menino_swing_gesto_dois_back":[2695,1445,66,104],"menino_negro_front_idle":[2763,1445,50,104],"menino_negro_front_walk_0":[2815,1445,50,104],"menino_negro_front_walk_1":[2867,1445,51,104],"menino_negro_front_walk_2":[2920,1445,50,104],"menino_negro_front_walk_3":[2972,1445,51,104],"menino_negro_swing_side":[3025,1445,49,104],"menino_negro_swing_gesto_um_side":[3076,1445,49,104],"menino_negro_swing_gesto_dois_side":[3127,1445,49,104],"menina_ruiva_front_idle":[3178,1445,50,104],"menina_ruiva_front_walk_0":[3230,1445,50,104],"menina_ruiva_front_walk_1":[3282,1445,51,104],"menina_ruiva_front_walk_2":[3335,1445,50,104],"menina_ruiva_front_walk_3":[3387,1445,52,104],"menina_ruiva_side_idle":[3441,1445,65,104],"menina_ruiva_side_walk_0":[3508,1445,65,104],"menina_ruiva_side_walk_1":[3575,1445,65,104],"menina_ruiva_side_walk_2":[3642,1445,65,104],"menina_ruiva_side_walk_3":[3709,1445,67,104],"menina_ruiva_side_walk_4":[3778,1445,67,104],"menina_ruiva_side_walk_5":[3847,1445,67,104],"menina_ruiva_side_walk_6":[3916,1445,67,104],"menina_ruiva_side_walk_7":[3985,1445,65,104],"menina_ruiva_swing_side":[0,1552,58,104],"menina_ruiva_swing_gesto_um_side":[60,1552,58,104],"menina_ruiva_swing_gesto_dois_side":[120,1552,58,104],"menina_negra_front_idle":[180,1552,60,104],"menina_negra_front_walk_0":[242,1552,60,104],"menina_negra_front_walk_1":[304,1552,60,104],"menina_negra_front_walk_2":[366,1552,60,104],"menina_negra_front_walk_3":[428,1552,60,104],"menina_negra_swing_front":[490,1552,60,104],"menina_negra_swing_up":[552,1552,59,104],"menina_negra_swing_side":[613,1552,48,104],"menina_negra_swing_front2":[663,1552,60,104],"menina_negra_swing_gesto_um_front":[725,1552,60,104],"menina_negra_swing_gesto_um_back":[787,1552,59,104],"menina_negra_swing_gesto_um_side":[848,1552,48,104],"menina_negra_swing_gesto_dois_side":[898,1552,48,104],"menina_negra_swing_gesto_dois_front":[948,1552,65,104],"menina_negra_swing_gesto_dois_back":[1015,1552,66,104],"sk_aprendiz_front_idle":[1083,1552,64,104],"sk_aprendiz_front_walk_0":[1149,1552,64,104],"sk_aprendiz_front_walk_1":[1215,1552,63,104],"sk_aprendiz_front_walk_2":[1280,1552,64,104],"sk_aprendiz_front_walk_3":[1346,1552,64,104],"sk_armadura_estelar_front_idle":[1412,1552,63,104],"sk_armadura_estelar_front_walk_0":[1477,1552,63,104],"sk_armadura_estelar_front_walk_1":[1542,1552,62,104],"sk_armadura_estelar_front_walk_2":[1606,1552,63,104],"sk_armadura_estelar_front_walk_3":[1671,1552,63,104],"sk_arqueira_mata_front_idle":[1736,1552,52,104],"sk_arqueira_mata_front_walk_0":[1790,1552,52,104],"sk_arqueira_mata_front_walk_1":[1844,1552,52,104],"sk_arqueira_mata_front_walk_2":[1898,1552,52,104],"sk_arqueira_mata_front_walk_3":[1952,1552,52,104],"sk_arqueiro_mata_front_idle":[2006,1552,50,104],"sk_arqueiro_mata_front_walk_0":[2058,1552,50,104],"sk_arqueiro_mata_front_walk_1":[2110,1552,51,104],"sk_arqueiro_mata_front_walk_2":[2163,1552,50,104],"sk_arqueiro_mata_front_walk_3":[2215,1552,52,104],"sk_cacadora_front_idle":[2269,1552,52,104],"sk_cacadora_front_walk_0":[2323,1552,52,104],"sk_cacadora_front_walk_1":[2377,1552,51,104],"sk_cacadora_front_walk_2":[2430,1552,52,104],"sk_cacadora_front_walk_3":[2484,1552,52,104],"sk_cacique_front_idle":[2538,1552,50,104],"sk_cacique_front_walk_0":[2590,1552,50,104],"sk_cacique_front_walk_1":[2642,1552,51,104],"sk_cacique_front_walk_2":[2695,1552,50,104],"sk_cacique_front_walk_3":[2747,1552,52,104],"sk_cacique_swing_maos_side":[2801,1552,48,104],"sk_carrasco_front_idle":[2851,1552,66,104],"sk_carrasco_front_walk_0":[2919,1552,66,104],"sk_carrasco_front_walk_1":[2987,1552,66,104],"sk_carrasco_front_walk_2":[3055,1552,66,104],"sk_carrasco_front_walk_3":[3123,1552,67,104],"sk_carrasco_back_idle":[3192,1552,66,104],"sk_carrasco_back_walk_0":[3260,1552,66,104],"sk_carrasco_back_walk_1":[3328,1552,63,104],"sk_carrasco_back_walk_2":[3393,1552,66,104],"sk_carrasco_back_walk_3":[3461,1552,63,104],"sk_carrasco_side_idle":[3526,1552,68,104],"sk_carrasco_side_walk_0":[3596,1552,68,104],"sk_carrasco_side_walk_1":[3666,1552,68,104],"sk_carrasco_side_walk_2":[3736,1552,68,104],"sk_carrasco_side_walk_3":[3806,1552,46,104],"sk_carrasco_side_walk_4":[3854,1552,46,104],"sk_carrasco_side_walk_5":[3902,1552,46,104],"sk_carrasco_side_walk_6":[3950,1552,46,104],"sk_carrasco_side_walk_7":[3998,1552,68,104],"sk_carrasco_swing_side":[0,1658,55,104],"sk_ceifador_front_idle":[57,1658,59,104],"sk_ceifador_front_walk_0":[118,1658,59,104],"sk_ceifador_front_walk_1":[179,1658,59,104],"sk_ceifador_front_walk_2":[240,1658,59,104],"sk_ceifador_front_walk_3":[301,1658,60,104],"sk_ciberpiloto_front_idle":[363,1658,60,104],"sk_ciberpiloto_front_walk_0":[425,1658,60,104],"sk_ciberpiloto_front_walk_1":[487,1658,60,104],"sk_ciberpiloto_front_walk_2":[549,1658,60,104],"sk_ciberpiloto_front_walk_3":[611,1658,61,104],"sk_cowboy_caveira_front_idle":[674,1658,53,104],"sk_cowboy_caveira_front_walk_0":[729,1658,53,104],"sk_cowboy_caveira_front_walk_1":[784,1658,53,104],"sk_cowboy_caveira_front_walk_2":[839,1658,53,104],"sk_cowboy_caveira_front_walk_3":[894,1658,53,104],"sk_elfo_verde_front_idle":[949,1658,63,104],"sk_elfo_verde_front_walk_0":[1014,1658,63,104],"sk_elfo_verde_front_walk_1":[1079,1658,63,104],"sk_elfo_verde_front_walk_2":[1144,1658,63,104],"sk_elfo_verde_front_walk_3":[1209,1658,64,104],"sk_elfo_verde_swing_aceno":[1275,1658,60,104],"sk_elfo_verde_swing_gesto_um_side":[1337,1658,60,104],"sk_elfo_vermelho_front_idle":[1399,1658,63,104],"sk_elfo_vermelho_front_walk_0":[1464,1658,63,104],"sk_elfo_vermelho_front_walk_1":[1529,1658,63,104],"sk_elfo_vermelho_front_walk_2":[1594,1658,63,104],"sk_elfo_vermelho_front_walk_3":[1659,1658,63,104],"sk_elfo_vermelho_swing_aceno":[1724,1658,60,104],"sk_elfo_vermelho_swing_gesto_um_side":[1786,1658,60,104],"sk_espectro_front_idle":[1848,1658,80,104],"sk_espectro_front_walk_0":[1930,1658,80,104],"sk_espectro_front_walk_1":[2012,1658,70,104],"sk_espectro_front_walk_2":[2084,1658,80,104],"sk_espectro_front_walk_3":[2166,1658,70,104],"sk_exploradora_front_idle":[2238,1658,56,104],"sk_exploradora_front_walk_0":[2296,1658,56,104],"sk_exploradora_front_walk_2":[2354,1658,56,104],"sk_exploradora_back_idle":[2412,1658,56,104],"sk_exploradora_back_walk_0":[2470,1658,56,104],"sk_exploradora_back_walk_1":[2528,1658,56,104],"sk_exploradora_back_walk_2":[2586,1658,56,104],"sk_exploradora_back_walk_3":[2644,1658,57,104],"sk_guarda_azul_front_idle":[2703,1658,53,104],"sk_guarda_azul_front_walk_0":[2758,1658,53,104],"sk_guarda_azul_front_walk_1":[2813,1658,53,104],"sk_guarda_azul_front_walk_2":[2868,1658,53,104],"sk_guarda_azul_front_walk_3":[2923,1658,53,104],"sk_guardiao_cristal_front_idle":[2978,1658,53,104],"sk_guardiao_cristal_front_walk_0":[3033,1658,53,104],"sk_guardiao_cristal_front_walk_1":[3088,1658,52,104],"sk_guardiao_cristal_front_walk_2":[3142,1658,53,104],"sk_guardiao_cristal_front_walk_3":[3197,1658,53,104],"sk_guerreiro_tribal_front_idle":[3252,1658,50,104],"sk_guerreiro_tribal_front_walk_0":[3304,1658,50,104],"sk_guerreiro_tribal_front_walk_1":[3356,1658,50,104],"sk_guerreiro_tribal_front_walk_2":[3408,1658,50,104],"sk_guerreiro_tribal_front_walk_3":[3460,1658,51,104],"sk_husky_front_idle":[3513,1658,63,104],"sk_husky_front_walk_0":[3578,1658,63,104],"sk_husky_front_walk_1":[3643,1658,63,104],"sk_husky_front_walk_2":[3708,1658,63,104],"sk_husky_front_walk_3":[3773,1658,66,104],"sk_maga_prata_front_idle":[3841,1658,61,104],"sk_maga_prata_front_walk_0":[3904,1658,61,104],"sk_maga_prata_front_walk_1":[3967,1658,61,104],"sk_maga_prata_front_walk_2":[4030,1658,61,104],"sk_maga_prata_front_walk_3":[0,1764,62,104],"sk_maga_prata_swing_aceno":[64,1764,60,104],"sk_maga_prata_swing_gesto_um_side":[126,1764,60,104],"sk_mago_noturno_front_idle":[188,1764,63,104],"sk_mago_noturno_front_walk_0":[253,1764,63,104],"sk_mago_noturno_front_walk_1":[318,1764,63,104],"sk_mago_noturno_front_walk_2":[383,1764,63,104],"sk_mago_noturno_front_walk_3":[448,1764,64,104],"sk_mago_noturno_swing_aceno":[514,1764,60,104],"sk_mago_noturno_swing_gesto_um_side":[576,1764,60,104],"sk_mecanico_vermelho_front_idle":[638,1764,52,104],"sk_mecanico_vermelho_front_walk_0":[692,1764,52,104],"sk_mecanico_vermelho_front_walk_1":[746,1764,52,104],"sk_mecanico_vermelho_front_walk_2":[800,1764,52,104],"sk_mecanico_vermelho_front_walk_3":[854,1764,54,104],"sk_pinguim_chapeu_front_walk_1":[910,1764,69,104],"sk_pinguim_chapeu_front_walk_3":[981,1764,70,104],"sk_pinguim_chapeu_back_idle":[1053,1764,62,104],"sk_pinguim_chapeu_back_walk_0":[1117,1764,62,104],"sk_pinguim_chapeu_back_walk_1":[1181,1764,62,104],"sk_pinguim_chapeu_back_walk_2":[1245,1764,62,104],"sk_pinguim_chapeu_back_walk_3":[1309,1764,63,104],"sk_pinguim_gravata_front_idle":[1374,1764,66,104],"sk_pinguim_gravata_front_walk_0":[1442,1764,66,104],"sk_pinguim_gravata_front_walk_1":[1510,1764,65,104],"sk_pinguim_gravata_front_walk_2":[1577,1764,66,104],"sk_pinguim_gravata_front_walk_3":[1645,1764,67,104],"sk_pinguim_gravata_swing_gesto_um_front":[1714,1764,66,104],"sk_pinguim_jaqueta_front_idle":[1782,1764,66,104],"sk_pinguim_jaqueta_front_walk_0":[1850,1764,66,104],"sk_pinguim_jaqueta_front_walk_1":[1918,1764,66,104],"sk_pinguim_jaqueta_front_walk_2":[1986,1764,66,104],"sk_pinguim_jaqueta_front_walk_3":[2054,1764,67,104],"sk_pirata_front_idle":[2123,1764,58,104],"sk_pirata_front_walk_0":[2183,1764,58,104],"sk_pirata_front_walk_1":[2243,1764,56,104],"sk_pirata_front_walk_2":[2301,1764,58,104],"sk_pirata_front_walk_3":[2361,1764,57,104],"sk_pistoleira_front_idle":[2420,1764,63,104],"sk_pistoleira_front_walk_0":[2485,1764,63,104],"sk_pistoleira_front_walk_1":[2550,1764,62,104],"sk_pistoleira_front_walk_2":[2614,1764,63,104],"sk_pistoleira_front_walk_3":[2679,1764,63,104],"sk_policial_front_idle":[2744,1764,58,104],"sk_policial_front_walk_0":[2804,1764,58,104],"sk_policial_front_walk_1":[2864,1764,59,104],"sk_policial_front_walk_2":[2925,1764,58,104],"sk_policial_front_walk_3":[2985,1764,60,104],"sk_princesa_front_idle":[3047,1764,59,104],"sk_princesa_front_walk_0":[3108,1764,59,104],"sk_princesa_front_walk_1":[3169,1764,58,104],"sk_princesa_front_walk_2":[3229,1764,59,104],"sk_princesa_front_walk_3":[3290,1764,59,104],"sk_raposa_front_idle":[3351,1764,74,104],"sk_raposa_front_walk_0":[3427,1764,74,104],"sk_raposa_front_walk_1":[3503,1764,75,104],"sk_raposa_front_walk_2":[3580,1764,74,104],"sk_raposa_front_walk_3":[3656,1764,75,104],"sk_rei_dourado_front_idle":[3733,1764,61,104],"sk_rei_dourado_front_walk_0":[3796,1764,61,104],"sk_rei_dourado_front_walk_1":[3859,1764,62,104],"sk_rei_dourado_front_walk_2":[3923,1764,61,104],"sk_rei_dourado_front_walk_3":[3986,1764,62,104],"sk_rei_mascarado_front_idle":[0,1870,59,104],"sk_rei_mascarado_front_walk_0":[61,1870,59,104],"sk_rei_mascarado_front_walk_1":[122,1870,60,104],"sk_rei_mascarado_front_walk_2":[184,1870,59,104],"sk_rei_mascarado_front_walk_3":[245,1870,60,104],"sk_samurai_front_idle":[307,1870,47,104],"sk_samurai_front_walk_0":[356,1870,47,104],"sk_samurai_front_walk_1":[405,1870,48,104],"sk_samurai_front_walk_2":[455,1870,47,104],"sk_samurai_front_walk_3":[504,1870,49,104],"sk_saqueador_front_idle":[555,1870,61,104],"sk_saqueador_front_walk_0":[618,1870,61,104],"sk_saqueador_front_walk_1":[681,1870,61,104],"sk_saqueador_front_walk_2":[744,1870,61,104],"sk_saqueador_front_walk_3":[807,1870,62,104],"sk_sombra_tatica_front_idle":[871,1870,52,104],"sk_sombra_tatica_front_walk_0":[925,1870,52,104],"sk_sombra_tatica_front_walk_1":[979,1870,52,104],"sk_sombra_tatica_front_walk_2":[1033,1870,52,104],"sk_sombra_tatica_front_walk_3":[1087,1870,53,104],"sk_vampiro_back_idle":[1142,1870,68,104],"sk_vampiro_back_walk_0":[1212,1870,68,104],"sk_vampiro_back_walk_1":[1282,1870,67,104],"sk_vampiro_back_walk_2":[1351,1870,68,104],"sk_vampiro_back_walk_3":[1421,1870,68,104],"sk_vampiro_swing_maos_side":[1491,1870,56,104],"sk_vampiro_swing_gesto_um_back":[1549,1870,68,104],"sk_vampiro_swing_gesto_dois_side":[1619,1870,56,104],"tiao_0":[1677,1870,75,104],"tiao_1":[1754,1870,75,104],"ana_0":[1831,1870,69,104],"ana_1":[1902,1870,71,104],"lia_0":[1975,1870,70,104],"lia_1":[2047,1870,71,104],"lia_back":[2120,1870,62,104],"chefe_side_0":[2184,1870,105,104],"chefe_side_2":[2291,1870,78,104],"chefe_side_3":[2371,1870,106,104],"chefe_atk_side_1":[2479,1870,94,104],"chefe_hit":[2575,1870,66,104],"tree_deserto_3":[2643,1870,62,104],"menino_negro_back_idle":[2707,1870,49,103],"menino_negro_back_walk_0":[2758,1870,49,103],"menino_negro_back_walk_1":[2809,1870,49,103],"menino_negro_back_walk_2":[2860,1870,49,103],"menino_negro_back_walk_3":[2911,1870,50,103],"menino_negro_side_idle":[2963,1870,46,103],"menino_negro_side_walk_0":[3011,1870,46,103],"menino_negro_side_walk_1":[3059,1870,46,103],"menino_negro_side_walk_2":[3107,1870,46,103],"menino_negro_side_walk_3":[3155,1870,51,103],"menino_negro_side_walk_4":[3208,1870,51,103],"menino_negro_side_walk_5":[3261,1870,51,103],"menino_negro_side_walk_6":[3314,1870,51,103],"menino_negro_side_walk_7":[3367,1870,46,103],"menina_ruiva_back_idle":[3415,1870,46,103],"menina_ruiva_back_walk_0":[3463,1870,46,103],"menina_ruiva_back_walk_1":[3511,1870,47,103],"menina_ruiva_back_walk_2":[3560,1870,46,103],"menina_ruiva_back_walk_3":[3608,1870,48,103],"menina_negra_back_idle":[3658,1870,59,103],"menina_negra_back_walk_0":[3719,1870,59,103],"menina_negra_back_walk_1":[3780,1870,60,103],"menina_negra_back_walk_2":[3842,1870,59,103],"menina_negra_back_walk_3":[3903,1870,60,103],"sk_exploradora_front_walk_1":[3965,1870,56,103],"sk_exploradora_front_walk_3":[4023,1870,56,103],"sk_exploradora_side_idle":[0,1976,44,103],"sk_exploradora_side_walk_0":[46,1976,44,103],"sk_exploradora_side_walk_1":[92,1976,44,103],"sk_exploradora_side_walk_2":[138,1976,44,103],"sk_exploradora_side_walk_3":[184,1976,44,103],"sk_exploradora_side_walk_4":[230,1976,44,103],"sk_exploradora_side_walk_5":[276,1976,44,103],"sk_exploradora_side_walk_6":[322,1976,44,103],"sk_exploradora_side_walk_7":[368,1976,44,103],"sk_exploradora_swing_side":[414,1976,44,103],"sk_guarda_azul_back_idle":[460,1976,53,103],"sk_guarda_azul_back_walk_0":[515,1976,53,103],"sk_guarda_azul_back_walk_1":[570,1976,53,103],"sk_guarda_azul_back_walk_2":[625,1976,53,103],"sk_guarda_azul_back_walk_3":[680,1976,53,103],"sk_pinguim_jaqueta_swing_gesto_um_back":[735,1976,63,103],"sk_pistoleira_back_idle":[800,1976,69,103],"sk_pistoleira_back_walk_0":[871,1976,69,103],"sk_pistoleira_back_walk_2":[942,1976,69,103],"sk_rei_mascarado_back_idle":[1013,1976,48,103],"sk_rei_mascarado_back_walk_0":[1063,1976,48,103],"sk_rei_mascarado_back_walk_2":[1113,1976,48,103],"sk_vampiro_swing_front":[1163,1976,82,103],"sk_vampiro_swing_up":[1247,1976,83,103],"sk_vampiro_swing_gesto_dois_front":[1332,1976,82,103],"sk_vampiro_swing_gesto_um_front":[1416,1976,66,103],"sk_vampiro_swing_gesto_dois_back":[1484,1976,83,103],"chefe_side_1":[1569,1976,79,103],"chefe_side_4":[1650,1976,105,103],"bicho_back_2":[1757,1976,114,103],"construtor_side_0":[1873,1976,62,103],"construtor_side_1":[1937,1976,62,103],"construtor_side_2":[2001,1976,62,103],"construtor_side_4":[2065,1976,62,103],"construtor_side_5":[2129,1976,61,103],"construtor_side_6":[2192,1976,62,103],"construtor_martelo_1":[2256,1976,96,103],"menino_negro_swing_front":[2354,1976,59,102],"menino_negro_swing_up":[2415,1976,58,102],"menino_negro_swing_front2":[2475,1976,59,102],"menino_negro_swing_gesto_um_front":[2536,1976,59,102],"menino_negro_swing_gesto_um_back":[2597,1976,58,102],"menino_negro_swing_gesto_dois_front":[2657,1976,64,102],"menino_negro_swing_gesto_dois_back":[2723,1976,67,102],"menina_ruiva_swing_front":[2792,1976,59,102],"menina_ruiva_swing_up":[2853,1976,59,102],"menina_ruiva_swing_front2":[2914,1976,59,102],"menina_ruiva_swing_gesto_um_front":[2975,1976,59,102],"menina_ruiva_swing_gesto_um_back":[3036,1976,59,102],"menina_ruiva_swing_gesto_dois_front":[3097,1976,64,102],"menina_ruiva_swing_gesto_dois_back":[3163,1976,67,102],"menina_negra_side_idle":[3232,1976,51,102],"menina_negra_side_walk_0":[3285,1976,51,102],"menina_negra_side_walk_1":[3338,1976,51,102],"menina_negra_side_walk_2":[3391,1976,51,102],"menina_negra_side_walk_3":[3444,1976,54,102],"menina_negra_side_walk_4":[3500,1976,54,102],"menina_negra_side_walk_5":[3556,1976,54,102],"menina_negra_side_walk_6":[3612,1976,54,102],"menina_negra_side_walk_7":[3668,1976,51,102],"sk_ceifador_back_idle":[3721,1976,48,102],"sk_ceifador_back_walk_0":[3771,1976,48,102],"sk_ceifador_back_walk_1":[3821,1976,49,102],"sk_ceifador_back_walk_2":[3872,1976,48,102],"sk_ceifador_back_walk_3":[3922,1976,50,102],"sk_cowboy_caveira_back_idle":[3974,1976,48,102],"sk_cowboy_caveira_back_walk_0":[4024,1976,48,102],"sk_cowboy_caveira_back_walk_1":[0,2081,48,102],"sk_cowboy_caveira_back_walk_2":[50,2081,48,102],"sk_cowboy_caveira_back_walk_3":[100,2081,49,102],"sk_elfo_verde_back_idle":[151,2081,56,102],"sk_elfo_verde_back_walk_0":[209,2081,56,102],"sk_elfo_verde_back_walk_1":[267,2081,58,102],"sk_elfo_verde_back_walk_2":[327,2081,56,102],"sk_elfo_verde_back_walk_3":[385,2081,59,102],"sk_elfo_vermelho_back_idle":[446,2081,57,102],"sk_elfo_vermelho_back_walk_0":[505,2081,57,102],"sk_elfo_vermelho_back_walk_1":[564,2081,59,102],"sk_elfo_vermelho_back_walk_2":[625,2081,57,102],"sk_elfo_vermelho_back_walk_3":[684,2081,60,102],"sk_espectro_back_idle":[746,2081,73,102],"sk_espectro_back_walk_0":[821,2081,73,102],"sk_espectro_back_walk_1":[896,2081,74,102],"sk_espectro_back_walk_2":[972,2081,73,102],"sk_espectro_back_walk_3":[1047,2081,74,102],"sk_guarda_azul_side_idle":[1123,2081,42,102],"sk_guarda_azul_side_walk_0":[1167,2081,42,102],"sk_guarda_azul_side_walk_1":[1211,2081,42,102],"sk_guarda_azul_side_walk_2":[1255,2081,42,102],"sk_guarda_azul_side_walk_3":[1299,2081,38,102],"sk_guarda_azul_side_walk_4":[1339,2081,38,102],"sk_guarda_azul_side_walk_5":[1379,2081,38,102],"sk_guarda_azul_side_walk_6":[1419,2081,38,102],"sk_guarda_azul_side_walk_7":[1459,2081,42,102],"sk_guarda_azul_swing_side":[1503,2081,39,102],"sk_guardiao_cristal_back_idle":[1544,2081,50,102],"sk_guardiao_cristal_back_walk_0":[1596,2081,50,102],"sk_guardiao_cristal_back_walk_1":[1648,2081,51,102],"sk_guardiao_cristal_back_walk_2":[1701,2081,50,102],"sk_guardiao_cristal_back_walk_3":[1753,2081,52,102],"sk_husky_back_idle":[1807,2081,58,102],"sk_husky_back_walk_0":[1867,2081,58,102],"sk_husky_back_walk_1":[1927,2081,58,102],"sk_husky_back_walk_2":[1987,2081,58,102],"sk_husky_back_walk_3":[2047,2081,59,102],"sk_mago_noturno_back_idle":[2108,2081,61,102],"sk_mago_noturno_back_walk_0":[2171,2081,61,102],"sk_mago_noturno_back_walk_1":[2234,2081,60,102],"sk_mago_noturno_back_walk_2":[2296,2081,61,102],"sk_mago_noturno_back_walk_3":[2359,2081,61,102],"sk_mecanico_vermelho_back_idle":[2422,2081,52,102],"sk_mecanico_vermelho_back_walk_0":[2476,2081,52,102],"sk_mecanico_vermelho_back_walk_1":[2530,2081,52,102],"sk_mecanico_vermelho_back_walk_2":[2584,2081,52,102],"sk_mecanico_vermelho_back_walk_3":[2638,2081,52,102],"sk_mecanico_vermelho_side_idle":[2692,2081,42,102],"sk_mecanico_vermelho_side_walk_0":[2736,2081,42,102],"sk_mecanico_vermelho_side_walk_1":[2780,2081,42,102],"sk_mecanico_vermelho_side_walk_2":[2824,2081,42,102],"sk_mecanico_vermelho_side_walk_3":[2868,2081,38,102],"sk_mecanico_vermelho_side_walk_4":[2908,2081,38,102],"sk_mecanico_vermelho_side_walk_5":[2948,2081,38,102],"sk_mecanico_vermelho_side_walk_6":[2988,2081,38,102],"sk_mecanico_vermelho_side_walk_7":[3028,2081,42,102],"sk_mecanico_vermelho_swing_side":[3072,2081,39,102],"sk_pistoleira_back_walk_1":[3113,2081,70,102],"sk_pistoleira_back_walk_3":[3185,2081,70,102],"sk_pistoleira_side_idle":[3257,2081,59,102],"sk_pistoleira_side_walk_0":[3318,2081,59,102],"sk_pistoleira_side_walk_1":[3379,2081,59,102],"sk_pistoleira_side_walk_2":[3440,2081,59,102],"sk_pistoleira_side_walk_3":[3501,2081,59,102],"sk_pistoleira_side_walk_4":[3562,2081,59,102],"sk_pistoleira_side_walk_5":[3623,2081,59,102],"sk_pistoleira_side_walk_6":[3684,2081,59,102],"sk_pistoleira_side_walk_7":[3745,2081,59,102],"sk_pistoleira_swing_side":[3806,2081,51,102],"sk_policial_back_walk_1":[3859,2081,48,102],"sk_policial_back_walk_3":[3909,2081,49,102],"sk_rei_dourado_back_idle":[3960,2081,61,102],"sk_rei_dourado_back_walk_0":[4023,2081,61,102],"sk_rei_dourado_back_walk_1":[0,2185,61,102],"sk_rei_dourado_back_walk_2":[63,2185,61,102],"sk_rei_dourado_back_walk_3":[126,2185,62,102],"sk_rei_mascarado_back_walk_1":[190,2185,48,102],"sk_rei_mascarado_back_walk_3":[240,2185,49,102],"sk_sombra_tatica_back_idle":[291,2185,52,102],"sk_sombra_tatica_back_walk_0":[345,2185,52,102],"sk_sombra_tatica_back_walk_1":[399,2185,52,102],"sk_sombra_tatica_back_walk_2":[453,2185,52,102],"sk_sombra_tatica_back_walk_3":[507,2185,53,102],"sk_sombra_tatica_side_idle":[562,2185,38,102],"sk_sombra_tatica_side_walk_0":[602,2185,38,102],"sk_sombra_tatica_side_walk_1":[642,2185,38,102],"sk_sombra_tatica_side_walk_2":[682,2185,38,102],"sk_sombra_tatica_side_walk_3":[722,2185,37,102],"sk_sombra_tatica_side_walk_4":[761,2185,37,102],"sk_sombra_tatica_side_walk_5":[800,2185,37,102],"sk_sombra_tatica_side_walk_6":[839,2185,37,102],"sk_sombra_tatica_side_walk_7":[878,2185,38,102],"sk_sombra_tatica_swing_side":[918,2185,36,102],"sk_vampiro_front_idle":[956,2185,67,102],"sk_vampiro_front_walk_0":[1025,2185,67,102],"sk_vampiro_front_walk_1":[1094,2185,66,102],"sk_vampiro_front_walk_2":[1162,2185,67,102],"sk_vampiro_front_walk_3":[1231,2185,67,102],"bicho_back_0":[1300,2185,113,102],"faz_plantar_0":[1415,2185,93,102],"faz_plantar_1":[1510,2185,93,102],"coelhao_pose_5":[1605,2185,88,102],"construtor_side_3":[1695,2185,59,102],"construtor_palha":[1756,2185,96,102],"construtor_hit":[1854,2185,63,102],"sk_aprendiz_back_idle":[1919,2185,57,101],"sk_aprendiz_back_walk_0":[1978,2185,57,101],"sk_aprendiz_back_walk_1":[2037,2185,58,101],"sk_aprendiz_back_walk_2":[2097,2185,57,101],"sk_aprendiz_back_walk_3":[2156,2185,58,101],"sk_armadura_estelar_back_idle":[2216,2185,59,101],"sk_armadura_estelar_back_walk_0":[2277,2185,59,101],"sk_armadura_estelar_back_walk_1":[2338,2185,60,101],"sk_armadura_estelar_back_walk_2":[2400,2185,59,101],"sk_armadura_estelar_back_walk_3":[2461,2185,63,101],"sk_cacadora_back_idle":[2526,2185,52,101],"sk_cacadora_back_walk_0":[2580,2185,52,101],"sk_cacadora_back_walk_1":[2634,2185,50,101],"sk_cacadora_back_walk_2":[2686,2185,52,101],"sk_cacadora_back_walk_3":[2740,2185,51,101],"sk_ciberpiloto_back_idle":[2793,2185,48,101],"sk_ciberpiloto_back_walk_0":[2843,2185,48,101],"sk_ciberpiloto_back_walk_1":[2893,2185,48,101],"sk_ciberpiloto_back_walk_2":[2943,2185,48,101],"sk_ciberpiloto_back_walk_3":[2993,2185,49,101],"sk_guardiao_cristal_side_idle":[3044,2185,41,101],"sk_guardiao_cristal_side_walk_0":[3087,2185,41,101],"sk_guardiao_cristal_side_walk_1":[3130,2185,41,101],"sk_guardiao_cristal_side_walk_2":[3173,2185,41,101],"sk_guardiao_cristal_side_walk_3":[3216,2185,42,101],"sk_guardiao_cristal_side_walk_4":[3260,2185,42,101],"sk_guardiao_cristal_side_walk_5":[3304,2185,42,101],"sk_guardiao_cristal_side_walk_6":[3348,2185,42,101],"sk_guardiao_cristal_side_walk_7":[3392,2185,41,101],"sk_guardiao_cristal_swing_side":[3435,2185,41,101],"sk_guerreiro_tribal_back_idle":[3478,2185,50,101],"sk_guerreiro_tribal_back_walk_0":[3530,2185,50,101],"sk_guerreiro_tribal_back_walk_1":[3582,2185,50,101],"sk_guerreiro_tribal_back_walk_2":[3634,2185,50,101],"sk_guerreiro_tribal_back_walk_3":[3686,2185,51,101],"sk_maga_prata_back_idle":[3739,2185,57,101],"sk_maga_prata_back_walk_0":[3798,2185,57,101],"sk_maga_prata_back_walk_1":[3857,2185,59,101],"sk_maga_prata_back_walk_2":[3918,2185,57,101],"sk_maga_prata_back_walk_3":[3977,2185,60,101],"sk_pinguim_gravata_back_idle":[0,2289,62,101],"sk_pinguim_gravata_back_walk_0":[64,2289,62,101],"sk_pinguim_gravata_back_walk_1":[128,2289,60,101],"sk_pinguim_gravata_back_walk_2":[190,2289,62,101],"sk_pinguim_gravata_back_walk_3":[254,2289,63,101],"sk_pinguim_jaqueta_back_idle":[319,2289,60,101],"sk_pinguim_jaqueta_back_walk_0":[381,2289,60,101],"sk_pinguim_jaqueta_back_walk_1":[443,2289,60,101],"sk_pinguim_jaqueta_back_walk_2":[505,2289,60,101],"sk_pinguim_jaqueta_back_walk_3":[567,2289,62,101],"sk_pirata_side_idle":[631,2289,71,101],"sk_pirata_side_walk_0":[704,2289,71,101],"sk_pirata_side_walk_1":[777,2289,71,101],"sk_pirata_side_walk_2":[850,2289,71,101],"sk_pirata_side_walk_3":[923,2289,70,101],"sk_pirata_side_walk_4":[995,2289,70,101],"sk_pirata_side_walk_5":[1067,2289,70,101],"sk_pirata_side_walk_6":[1139,2289,70,101],"sk_pirata_side_walk_7":[1211,2289,71,101],"sk_pirata_swing_side":[1284,2289,54,101],"sk_policial_back_idle":[1340,2289,47,101],"sk_policial_back_walk_0":[1389,2289,47,101],"sk_policial_back_walk_2":[1438,2289,47,101],"sk_policial_side_walk_3":[1487,2289,43,101],"sk_policial_side_walk_4":[1532,2289,43,101],"sk_policial_side_walk_5":[1577,2289,43,101],"sk_policial_side_walk_6":[1622,2289,43,101],"sk_princesa_back_idle":[1667,2289,65,101],"sk_princesa_back_walk_0":[1734,2289,65,101],"sk_princesa_back_walk_1":[1801,2289,64,101],"sk_princesa_back_walk_2":[1867,2289,65,101],"sk_princesa_back_walk_3":[1934,2289,65,101],"sk_raposa_back_idle":[2001,2289,62,101],"sk_raposa_back_walk_0":[2065,2289,62,101],"sk_raposa_back_walk_1":[2129,2289,67,101],"sk_raposa_back_walk_2":[2198,2289,62,101],"sk_raposa_back_walk_3":[2262,2289,69,101],"sk_samurai_back_idle":[2333,2289,47,101],"sk_samurai_back_walk_0":[2382,2289,47,101],"sk_samurai_back_walk_1":[2431,2289,47,101],"sk_samurai_back_walk_2":[2480,2289,47,101],"sk_samurai_back_walk_3":[2529,2289,48,101],"sk_samurai_side_idle":[2579,2289,45,101],"sk_samurai_side_walk_0":[2626,2289,45,101],"sk_samurai_side_walk_1":[2673,2289,45,101],"sk_samurai_side_walk_2":[2720,2289,45,101],"sk_samurai_side_walk_3":[2767,2289,46,101],"sk_samurai_side_walk_4":[2815,2289,46,101],"sk_samurai_side_walk_5":[2863,2289,46,101],"sk_samurai_side_walk_6":[2911,2289,46,101],"sk_samurai_side_walk_7":[2959,2289,45,101],"sk_samurai_swing_side":[3006,2289,41,101],"tree_campos":[3049,2289,80,100],"sk_arqueira_mata_side_idle":[3131,2289,41,100],"sk_arqueira_mata_side_walk_0":[3174,2289,41,100],"sk_arqueira_mata_side_walk_1":[3217,2289,41,100],"sk_arqueira_mata_side_walk_2":[3260,2289,41,100],"sk_arqueira_mata_side_walk_3":[3303,2289,41,100],"sk_arqueira_mata_side_walk_4":[3346,2289,41,100],"sk_arqueira_mata_side_walk_5":[3389,2289,41,100],"sk_arqueira_mata_side_walk_6":[3432,2289,41,100],"sk_arqueira_mata_side_walk_7":[3475,2289,41,100],"sk_arqueira_mata_swing_side":[3518,2289,40,100],"sk_arqueiro_mata_side_idle":[3560,2289,41,100],"sk_arqueiro_mata_side_walk_0":[3603,2289,41,100],"sk_arqueiro_mata_side_walk_1":[3646,2289,41,100],"sk_arqueiro_mata_side_walk_2":[3689,2289,41,100],"sk_arqueiro_mata_side_walk_3":[3732,2289,41,100],"sk_arqueiro_mata_side_walk_4":[3775,2289,41,100],"sk_arqueiro_mata_side_walk_5":[3818,2289,41,100],"sk_arqueiro_mata_side_walk_6":[3861,2289,41,100],"sk_arqueiro_mata_side_walk_7":[3904,2289,41,100],"sk_arqueiro_mata_swing_side":[3947,2289,39,100],"sk_cacadora_side_idle":[3988,2289,47,100],"sk_cacadora_side_walk_0":[4037,2289,47,100],"sk_cacadora_side_walk_1":[0,2392,47,100],"sk_cacadora_side_walk_2":[49,2392,47,100],"sk_cacadora_side_walk_3":[98,2392,47,100],"sk_cacadora_side_walk_4":[147,2392,47,100],"sk_cacadora_side_walk_5":[196,2392,47,100],"sk_cacadora_side_walk_6":[245,2392,47,100],"sk_cacadora_side_walk_7":[294,2392,47,100],"sk_cacadora_swing_side":[343,2392,41,100],"sk_ceifador_side_idle":[386,2392,49,100],"sk_ceifador_side_walk_0":[437,2392,49,100],"sk_ceifador_side_walk_1":[488,2392,49,100],"sk_ceifador_side_walk_2":[539,2392,49,100],"sk_ceifador_side_walk_3":[590,2392,48,100],"sk_ceifador_side_walk_4":[640,2392,48,100],"sk_ceifador_side_walk_5":[690,2392,48,100],"sk_ceifador_side_walk_6":[740,2392,48,100],"sk_ceifador_side_walk_7":[790,2392,49,100],"sk_ceifador_swing_side":[841,2392,46,100],"sk_ciberpiloto_side_idle":[889,2392,43,100],"sk_ciberpiloto_side_walk_0":[934,2392,43,100],"sk_ciberpiloto_side_walk_1":[979,2392,43,100],"sk_ciberpiloto_side_walk_2":[1024,2392,43,100],"sk_ciberpiloto_side_walk_3":[1069,2392,43,100],"sk_ciberpiloto_side_walk_4":[1114,2392,43,100],"sk_ciberpiloto_side_walk_5":[1159,2392,43,100],"sk_ciberpiloto_side_walk_6":[1204,2392,43,100],"sk_ciberpiloto_side_walk_7":[1249,2392,43,100],"sk_ciberpiloto_swing_side":[1294,2392,40,100],"sk_cowboy_caveira_side_idle":[1336,2392,49,100],"sk_cowboy_caveira_side_walk_0":[1387,2392,49,100],"sk_cowboy_caveira_side_walk_1":[1438,2392,49,100],"sk_cowboy_caveira_side_walk_2":[1489,2392,49,100],"sk_cowboy_caveira_side_walk_3":[1540,2392,50,100],"sk_cowboy_caveira_side_walk_4":[1592,2392,50,100],"sk_cowboy_caveira_side_walk_5":[1644,2392,50,100],"sk_cowboy_caveira_side_walk_6":[1696,2392,50,100],"sk_cowboy_caveira_side_walk_7":[1748,2392,49,100],"sk_cowboy_caveira_swing_side":[1799,2392,46,100],"sk_espectro_side_idle":[1847,2392,88,100],"sk_espectro_side_walk_0":[1937,2392,88,100],"sk_espectro_side_walk_1":[2027,2392,88,100],"sk_espectro_side_walk_2":[2117,2392,88,100],"sk_espectro_side_walk_3":[2207,2392,88,100],"sk_espectro_side_walk_4":[2297,2392,88,100],"sk_espectro_side_walk_5":[2387,2392,88,100],"sk_espectro_side_walk_6":[2477,2392,88,100],"sk_espectro_side_walk_7":[2567,2392,88,100],"sk_espectro_swing_side":[2657,2392,64,100],"sk_pinguim_chapeu_front_idle":[2723,2392,69,100],"sk_pinguim_chapeu_front_walk_0":[2794,2392,69,100],"sk_pinguim_chapeu_front_walk_2":[2865,2392,69,100],"sk_pinguim_gravata_side_idle":[2936,2392,65,100],"sk_pinguim_gravata_side_walk_0":[3003,2392,65,100],"sk_pinguim_gravata_side_walk_1":[3070,2392,65,100],"sk_pinguim_gravata_side_walk_2":[3137,2392,65,100],"sk_pinguim_gravata_side_walk_3":[3204,2392,63,100],"sk_pinguim_gravata_side_walk_4":[3269,2392,63,100],"sk_pinguim_gravata_side_walk_5":[3334,2392,63,100],"sk_pinguim_gravata_side_walk_6":[3399,2392,63,100],"sk_pinguim_gravata_side_walk_7":[3464,2392,65,100],"sk_pinguim_gravata_swing_side":[3531,2392,57,100],"sk_pirata_back_idle":[3590,2392,54,100],"sk_pirata_back_walk_0":[3646,2392,54,100],"sk_pirata_back_walk_1":[3702,2392,52,100],"sk_pirata_back_walk_2":[3756,2392,54,100],"sk_pirata_back_walk_3":[3812,2392,52,100],"sk_policial_side_idle":[3866,2392,42,100],"sk_policial_side_walk_0":[3910,2392,42,100],"sk_policial_side_walk_1":[3954,2392,42,100],"sk_policial_side_walk_2":[3998,2392,42,100],"sk_policial_side_walk_7":[4042,2392,42,100],"sk_policial_swing_side":[0,2494,40,100],"sk_princesa_side_idle":[42,2494,62,100],"sk_princesa_side_walk_0":[106,2494,62,100],"sk_princesa_side_walk_1":[170,2494,62,100],"sk_princesa_side_walk_2":[234,2494,62,100],"sk_princesa_side_walk_3":[298,2494,62,100],"sk_princesa_side_walk_4":[362,2494,62,100],"sk_princesa_side_walk_5":[426,2494,62,100],"sk_princesa_side_walk_6":[490,2494,62,100],"sk_princesa_side_walk_7":[554,2494,62,100],"sk_princesa_swing_side":[618,2494,52,100],"sk_raposa_side_idle":[672,2494,83,100],"sk_raposa_side_walk_0":[757,2494,83,100],"sk_raposa_side_walk_1":[842,2494,83,100],"sk_raposa_side_walk_2":[927,2494,83,100],"sk_raposa_side_walk_3":[1012,2494,83,100],"sk_raposa_side_walk_4":[1097,2494,83,100],"sk_raposa_side_walk_5":[1182,2494,83,100],"sk_raposa_side_walk_6":[1267,2494,83,100],"sk_raposa_side_walk_7":[1352,2494,83,100],"sk_raposa_swing_side":[1437,2494,73,100],"sk_rei_dourado_side_walk_3":[1512,2494,57,100],"sk_rei_dourado_side_walk_4":[1571,2494,57,100],"sk_rei_dourado_side_walk_5":[1630,2494,57,100],"sk_rei_dourado_side_walk_6":[1689,2494,57,100],"sk_rei_mascarado_side_idle":[1748,2494,50,100],"sk_rei_mascarado_side_walk_0":[1800,2494,50,100],"sk_rei_mascarado_side_walk_1":[1852,2494,50,100],"sk_rei_mascarado_side_walk_2":[1904,2494,50,100],"sk_rei_mascarado_side_walk_3":[1956,2494,50,100],"sk_rei_mascarado_side_walk_4":[2008,2494,50,100],"sk_rei_mascarado_side_walk_5":[2060,2494,50,100],"sk_rei_mascarado_side_walk_6":[2112,2494,50,100],"sk_rei_mascarado_side_walk_7":[2164,2494,50,100],"sk_rei_mascarado_swing_side":[2216,2494,49,100],"galinha_back_0":[2267,2494,59,100],"galinha_back_1":[2328,2494,57,100],"galinha_back_2":[2387,2494,59,100],"galinha_back_3":[2448,2494,56,100],"coelho_back_0":[2506,2494,42,100],"coelho_back_1":[2550,2494,42,100],"coelho_back_2":[2594,2494,42,100],"coelho_back_3":[2638,2494,42,100],"pintinho_front_0":[2682,2494,72,100],"raposa_front_0":[2756,2494,76,100],"raposa_front_1":[2834,2494,78,100],"raposa_front_2":[2914,2494,78,100],"raposa_front_3":[2994,2494,73,100],"raposa_back_0":[3069,2494,51,100],"raposa_back_1":[3122,2494,54,100],"raposa_back_2":[3178,2494,51,100],"raposa_back_3":[3231,2494,56,100],"cervo_front_0":[3289,2494,52,100],"cervo_front_1":[3343,2494,52,100],"cervo_front_2":[3397,2494,54,100],"cervo_front_3":[3453,2494,52,100],"cervo_back_0":[3507,2494,52,100],"cervo_back_1":[3561,2494,52,100],"cervo_back_2":[3615,2494,52,100],"cervo_back_3":[3669,2494,52,100],"cervo_side_0":[3723,2494,102,100],"cervo_side_1":[3827,2494,107,100],"cervo_side_2":[3936,2494,107,100],"cervo_side_3":[0,2596,107,100],"pavao_back_0":[109,2596,37,100],"javali_back_2":[148,2596,60,100],"robo_front_0":[210,2596,60,100],"robo_front_1":[272,2596,60,100],"robo_front_2":[334,2596,61,100],"robo_front_3":[397,2596,60,100],"robo_front_4":[459,2596,61,100],"robo_front_5":[522,2596,60,100],"saq_front_0":[584,2596,67,100],"saq_front_1":[653,2596,68,100],"saq_front_2":[723,2596,67,100],"saq_front_3":[792,2596,68,100],"saq_front_4":[862,2596,67,100],"saq_front_5":[931,2596,67,100],"anel_cura":[1000,2596,160,100],"faz_front_0":[1162,2596,66,100],"faz_front_1":[1230,2596,66,100],"faz_front_2":[1298,2596,66,100],"faz_front_3":[1366,2596,66,100],"fugitivo_front_0":[1434,2596,62,100],"fugitivo_front_1":[1498,2596,54,100],"fugitivo_front_4":[1554,2596,62,100],"fugitivo_front_5":[1618,2596,54,100],"fugitivo_back_2":[1674,2596,49,100],"fugitivo_back_4":[1725,2596,48,100],"fugitivo_back_5":[1775,2596,50,100],"fugitivo_pose_4":[1827,2596,62,100],"fugitivo_hit":[1891,2596,62,100],"construtor_front_3":[1955,2596,57,100],"sk_aprendiz_side_idle":[2014,2596,48,99],"sk_aprendiz_side_walk_0":[2064,2596,48,99],"sk_aprendiz_side_walk_1":[2114,2596,48,99],"sk_aprendiz_side_walk_2":[2164,2596,48,99],"sk_aprendiz_side_walk_3":[2214,2596,48,99],"sk_aprendiz_side_walk_4":[2264,2596,48,99],"sk_aprendiz_side_walk_5":[2314,2596,48,99],"sk_aprendiz_side_walk_6":[2364,2596,48,99],"sk_aprendiz_side_walk_7":[2414,2596,48,99],"sk_aprendiz_swing_side":[2464,2596,45,99],"sk_cacique_back_idle":[2511,2596,49,99],"sk_cacique_back_walk_0":[2562,2596,49,99],"sk_cacique_back_walk_1":[2613,2596,50,99],"sk_cacique_back_walk_2":[2665,2596,49,99],"sk_cacique_back_walk_3":[2716,2596,51,99],"sk_cacique_side_idle":[2769,2596,41,99],"sk_cacique_side_walk_0":[2812,2596,41,99],"sk_cacique_side_walk_1":[2855,2596,41,99],"sk_cacique_side_walk_2":[2898,2596,41,99],"sk_cacique_side_walk_3":[2941,2596,41,99],"sk_cacique_side_walk_4":[2984,2596,41,99],"sk_cacique_side_walk_5":[3027,2596,41,99],"sk_cacique_side_walk_6":[3070,2596,41,99],"sk_cacique_side_walk_7":[3113,2596,41,99],"sk_cacique_swing_side":[3156,2596,39,99],"sk_elfo_verde_side_idle":[3197,2596,52,99],"sk_elfo_verde_side_walk_0":[3251,2596,52,99],"sk_elfo_verde_side_walk_1":[3305,2596,52,99],"sk_elfo_verde_side_walk_2":[3359,2596,52,99],"sk_elfo_verde_side_walk_3":[3413,2596,50,99],"sk_elfo_verde_side_walk_4":[3465,2596,50,99],"sk_elfo_verde_side_walk_5":[3517,2596,50,99],"sk_elfo_verde_side_walk_6":[3569,2596,50,99],"sk_elfo_verde_side_walk_7":[3621,2596,52,99],"sk_elfo_verde_swing_side":[3675,2596,50,99],"sk_elfo_vermelho_side_idle":[3727,2596,53,99],"sk_elfo_vermelho_side_walk_0":[3782,2596,53,99],"sk_elfo_vermelho_side_walk_1":[3837,2596,53,99],"sk_elfo_vermelho_side_walk_2":[3892,2596,53,99],"sk_elfo_vermelho_side_walk_3":[3947,2596,52,99],"sk_elfo_vermelho_side_walk_4":[4001,2596,52,99],"sk_elfo_vermelho_side_walk_5":[0,2698,52,99],"sk_elfo_vermelho_side_walk_6":[54,2698,52,99],"sk_elfo_vermelho_side_walk_7":[108,2698,53,99],"sk_elfo_vermelho_swing_side":[163,2698,51,99],"sk_guerreiro_tribal_side_idle":[216,2698,41,99],"sk_guerreiro_tribal_side_walk_0":[259,2698,41,99],"sk_guerreiro_tribal_side_walk_1":[302,2698,41,99],"sk_guerreiro_tribal_side_walk_2":[345,2698,41,99],"sk_guerreiro_tribal_side_walk_3":[388,2698,41,99],"sk_guerreiro_tribal_side_walk_4":[431,2698,41,99],"sk_guerreiro_tribal_side_walk_5":[474,2698,41,99],"sk_guerreiro_tribal_side_walk_6":[517,2698,41,99],"sk_guerreiro_tribal_side_walk_7":[560,2698,41,99],"sk_guerreiro_tribal_swing_side":[603,2698,39,99],"sk_maga_prata_side_idle":[644,2698,51,99],"sk_maga_prata_side_walk_0":[697,2698,51,99],"sk_maga_prata_side_walk_1":[750,2698,51,99],"sk_maga_prata_side_walk_2":[803,2698,51,99],"sk_maga_prata_side_walk_3":[856,2698,50,99],"sk_maga_prata_side_walk_4":[908,2698,50,99],"sk_maga_prata_side_walk_5":[960,2698,50,99],"sk_maga_prata_side_walk_6":[1012,2698,50,99],"sk_maga_prata_side_walk_7":[1064,2698,51,99],"sk_maga_prata_swing_side":[1117,2698,49,99],"sk_mago_noturno_side_idle":[1168,2698,61,99],"sk_mago_noturno_side_walk_0":[1231,2698,61,99],"sk_mago_noturno_side_walk_1":[1294,2698,61,99],"sk_mago_noturno_side_walk_2":[1357,2698,61,99],"sk_mago_noturno_side_walk_3":[1420,2698,61,99],"sk_mago_noturno_side_walk_4":[1483,2698,61,99],"sk_mago_noturno_side_walk_5":[1546,2698,61,99],"sk_mago_noturno_side_walk_6":[1609,2698,61,99],"sk_mago_noturno_side_walk_7":[1672,2698,61,99],"sk_mago_noturno_swing_side":[1735,2698,54,99],"sk_rei_dourado_side_idle":[1791,2698,57,99],"sk_rei_dourado_side_walk_0":[1850,2698,57,99],"sk_rei_dourado_side_walk_1":[1909,2698,57,99],"sk_rei_dourado_side_walk_2":[1968,2698,57,99],"sk_rei_dourado_side_walk_7":[2027,2698,57,99],"sk_rei_dourado_swing_side":[2086,2698,53,99],"sk_saqueador_side_idle":[2141,2698,40,99],"sk_saqueador_side_walk_0":[2183,2698,40,99],"sk_saqueador_side_walk_1":[2225,2698,40,99],"sk_saqueador_side_walk_2":[2267,2698,40,99],"sk_saqueador_side_walk_3":[2309,2698,40,99],"sk_saqueador_side_walk_4":[2351,2698,40,99],"sk_saqueador_side_walk_5":[2393,2698,40,99],"sk_saqueador_side_walk_6":[2435,2698,40,99],"sk_saqueador_side_walk_7":[2477,2698,40,99],"sk_saqueador_swing_side":[2519,2698,39,99],"sk_vampiro_side_idle":[2560,2698,57,99],"sk_vampiro_side_walk_0":[2619,2698,57,99],"sk_vampiro_side_walk_1":[2678,2698,57,99],"sk_vampiro_side_walk_2":[2737,2698,57,99],"sk_vampiro_side_walk_3":[2796,2698,56,99],"sk_vampiro_side_walk_4":[2854,2698,56,99],"sk_vampiro_side_walk_5":[2912,2698,56,99],"sk_vampiro_side_walk_6":[2970,2698,56,99],"sk_vampiro_side_walk_7":[3028,2698,57,99],"sk_vampiro_swing_side":[3087,2698,56,99],"galinha_front_0":[3145,2698,66,99],"galinha_front_1":[3213,2698,69,99],"galinha_front_2":[3284,2698,69,99],"galinha_front_3":[3355,2698,69,99],"pavao_fan_0":[3426,2698,116,99],"pavao_fan_1":[3544,2698,117,99],"pavao_fan_2":[3663,2698,116,99],"pavao_fan_3":[3781,2698,116,99],"javali_back_0":[3899,2698,60,99],"javali_back_1":[3961,2698,59,99],"javali_back_3":[4022,2698,60,99],"saq_atk_side_0":[0,2799,59,99],"faz_colher_0":[61,2799,99,99],"faz_colher_1":[162,2799,87,99],"fugitivo_side_0":[251,2799,70,99],"fugitivo_pose_2":[323,2799,105,99],"sk_armadura_estelar_side_idle":[430,2799,51,98],"sk_armadura_estelar_side_walk_0":[483,2799,51,98],"sk_armadura_estelar_side_walk_1":[536,2799,51,98],"sk_armadura_estelar_side_walk_2":[589,2799,51,98],"sk_armadura_estelar_side_walk_3":[642,2799,49,98],"sk_armadura_estelar_side_walk_4":[693,2799,49,98],"sk_armadura_estelar_side_walk_5":[744,2799,49,98],"sk_armadura_estelar_side_walk_6":[795,2799,49,98],"sk_armadura_estelar_side_walk_7":[846,2799,51,98],"sk_armadura_estelar_swing_side":[899,2799,45,98],"sk_husky_side_idle":[946,2799,77,98],"sk_husky_side_walk_0":[1025,2799,77,98],"sk_husky_side_walk_1":[1104,2799,77,98],"sk_husky_side_walk_2":[1183,2799,77,98],"sk_husky_side_walk_3":[1262,2799,77,98],"sk_husky_side_walk_4":[1341,2799,77,98],"sk_husky_side_walk_5":[1420,2799,77,98],"sk_husky_side_walk_6":[1499,2799,77,98],"sk_husky_side_walk_7":[1578,2799,77,98],"sk_husky_swing_side":[1657,2799,63,98],"sk_pinguim_chapeu_side_idle":[1722,2799,59,98],"sk_pinguim_chapeu_side_walk_0":[1783,2799,59,98],"sk_pinguim_chapeu_side_walk_1":[1844,2799,59,98],"sk_pinguim_chapeu_side_walk_2":[1905,2799,59,98],"sk_pinguim_chapeu_side_walk_3":[1966,2799,57,98],"sk_pinguim_chapeu_side_walk_4":[2025,2799,57,98],"sk_pinguim_chapeu_side_walk_5":[2084,2799,57,98],"sk_pinguim_chapeu_side_walk_6":[2143,2799,57,98],"sk_pinguim_chapeu_side_walk_7":[2202,2799,59,98],"sk_pinguim_chapeu_swing_side":[2263,2799,55,98],"sk_pinguim_jaqueta_side_idle":[2320,2799,51,98],"sk_pinguim_jaqueta_side_walk_0":[2373,2799,51,98],"sk_pinguim_jaqueta_side_walk_1":[2426,2799,51,98],"sk_pinguim_jaqueta_side_walk_2":[2479,2799,51,98],"sk_pinguim_jaqueta_side_walk_3":[2532,2799,51,98],"sk_pinguim_jaqueta_side_walk_4":[2585,2799,51,98],"sk_pinguim_jaqueta_side_walk_5":[2638,2799,51,98],"sk_pinguim_jaqueta_side_walk_6":[2691,2799,51,98],"sk_pinguim_jaqueta_side_walk_7":[2744,2799,51,98],"sk_pinguim_jaqueta_swing_side":[2797,2799,48,98],"sk_saqueador_back_idle":[2847,2799,54,98],"sk_saqueador_back_walk_0":[2903,2799,54,98],"sk_saqueador_back_walk_1":[2959,2799,54,98],"sk_saqueador_back_walk_2":[3015,2799,54,98],"sk_saqueador_back_walk_3":[3071,2799,54,98],"javali_front_0":[3127,2799,60,98],"javali_front_1":[3189,2799,59,98],"javali_front_2":[3250,2799,68,98],"javali_front_3":[3320,2799,60,98],"robo_back_0":[3382,2799,58,98],"robo_back_1":[3442,2799,58,98],"robo_back_2":[3502,2799,58,98],"robo_back_3":[3562,2799,58,98],"robo_back_4":[3622,2799,58,98],"robo_back_5":[3682,2799,57,98],"robo_side_0":[3741,2799,56,98],"robo_side_1":[3799,2799,56,98],"robo_side_2":[3857,2799,57,98],"robo_side_3":[3916,2799,57,98],"robo_side_4":[3975,2799,56,98],"robo_side_5":[4033,2799,56,98],"saq_back_0":[0,2900,63,98],"saq_back_1":[65,2900,62,98],"saq_back_3":[129,2900,58,98],"saq_atk_front_0":[189,2900,78,98],"saq_atk_front_1":[269,2900,80,98],"bicho_atk":[351,2900,195,98],"faz_side_0":[548,2900,68,98],"faz_side_1":[618,2900,66,98],"faz_side_2":[686,2900,66,98],"faz_side_3":[754,2900,68,98],"faz_side_5":[824,2900,68,98],"fugitivo_side_1":[894,2900,71,98],"fugitivo_side_2":[967,2900,72,98],"fugitivo_side_3":[1041,2900,76,98],"fugitivo_pose_0":[1119,2900,79,98],"construtor_front_0":[1200,2900,58,98],"construtor_front_1":[1260,2900,58,98],"construtor_front_2":[1320,2900,58,98],"construtor_front_4":[1380,2900,58,98],"construtor_front_5":[1440,2900,55,98],"construtor_front_6":[1497,2900,58,98],"construtor_back_0":[1557,2900,54,98],"construtor_back_1":[1613,2900,54,98],"construtor_back_3":[1669,2900,52,98],"construtor_back_5":[1723,2900,54,98],"pintinho_back_1":[1779,2900,69,97],"pintinho_back_3":[1850,2900,69,97],"saq_back_2":[1921,2900,51,97],"saq_back_4":[1974,2900,57,97],"saq_back_5":[2033,2900,59,97],"bicho_dead":[2094,2900,265,97],"faz_side_4":[2361,2900,68,97],"faz_feliz":[2431,2900,92,97],"noel_pose_5":[2525,2900,67,97],"fugitivo_side_5":[2594,2900,74,97],"construtor_back_2":[2670,2900,54,97],"pavao_back_1":[2726,2900,43,96],"pavao_back_2":[2771,2900,37,96],"pavao_back_3":[2810,2900,48,96],"arco_mao":[2860,2900,90,96],"saq_atk_side_1":[2952,2900,88,96],"construtor_back_4":[3042,2900,54,96],"construtor_back_6":[3098,2900,54,96],"sk_arqueira_mata_back_idle":[3154,2900,50,95],"sk_arqueira_mata_back_walk_0":[3206,2900,50,95],"sk_arqueira_mata_back_walk_1":[3258,2900,50,95],"sk_arqueira_mata_back_walk_2":[3310,2900,50,95],"sk_arqueira_mata_back_walk_3":[3362,2900,51,95],"pintinho_back_2":[3415,2900,79,95],"robo_dig_3":[3496,2900,72,95],"saq_hit":[3570,2900,80,95],"anel_explosao":[3652,2900,160,95],"faz_back_0":[3814,2900,64,95],"faz_back_1":[3880,2900,64,95],"faz_sentado":[3946,2900,70,95],"fugitivo_side_4":[0,3000,77,95],"bush_0_neve":[79,3000,100,95],"sk_arqueiro_mata_back_idle":[181,3000,49,94],"sk_arqueiro_mata_back_walk_0":[232,3000,49,94],"sk_arqueiro_mata_back_walk_1":[283,3000,50,94],"sk_arqueiro_mata_back_walk_2":[335,3000,49,94],"sk_arqueiro_mata_back_walk_3":[386,3000,50,94],"pintinho_back_0":[438,3000,78,94],"saq_side_1":[518,3000,57,94],"saq_side_3":[577,3000,60,94],"saq_side_4":[639,3000,59,94],"saq_side_5":[700,3000,59,94],"faz_back_3":[761,3000,63,94],"faz_back_4":[826,3000,64,94],"faz_back_5":[892,3000,64,94],"coelhao_pose_2":[958,3000,67,94],"faz_back_2":[1027,3000,63,93],"fugitivo_front_3":[1092,3000,54,93],"muda_neve":[1148,3000,48,93],"pavao_front_2":[1198,3000,37,91],"tree_pantano":[1237,3000,80,90],"pavao_front_0":[1319,3000,37,90],"fx_magia_hit_2":[1358,3000,88,90],"coelho_front_0":[1448,3000,41,89],"coelho_front_1":[1491,3000,44,89],"coelho_front_2":[1537,3000,42,89],"coelho_front_3":[1581,3000,39,89],"pavao_front_1":[1622,3000,37,89],"fugitivo_front_2":[1661,3000,62,89],"fugitivo_back_0":[1725,3000,48,89],"construtor_plantar":[1775,3000,91,89],"fugitivo_back_1":[1868,3000,48,87],"fugitivo_back_3":[1918,3000,49,87],"coelho_side_0":[1969,3000,84,86],"coelho_side_1":[2055,3000,84,86],"coelho_side_3":[2141,3000,84,86],"galinha_side_0":[2227,3000,85,85],"galinha_side_1":[2314,3000,87,85],"galinha_side_2":[2403,3000,88,85],"galinha_side_3":[2493,3000,88,85],"muda_montanhas":[2583,3000,46,85],"toco_neve":[2631,3000,73,85],"bush_0_pantano":[2706,3000,82,84],"tree_montanhas":[2790,3000,80,83],"javali_side_0":[2872,3000,127,83],"javali_side_1":[3001,3000,126,83],"javali_side_2":[3129,3000,128,83],"javali_side_3":[3259,3000,128,83],"bicho_dig_2":[3389,3000,178,83],"coelho_side_2":[3569,3000,84,81],"pavao_side_0":[3655,3000,100,81],"pavao_side_1":[3757,3000,103,79],"pavao_side_3":[3862,3000,103,79],"bush_0_montanhas":[3967,3000,84,79],"pavao_side_2":[0,3097,104,78],"bush_1_pantano":[106,3097,72,78],"fugitivo_pose_3":[180,3097,56,77],"bush_1_neve":[238,3097,76,77],"wall":[316,3097,61,76],"bicho_side_0":[379,3097,197,74],"bicho_side_3":[578,3097,197,74],"muda_pantano":[777,3097,40,74],"bush_1_montanhas":[819,3097,76,74],"bicho_side_2":[897,3097,197,73],"bicho_side_1":[1096,3097,197,72],"bicho_side_4":[1295,3097,197,72],"fx_corte_2":[1494,3097,60,72],"fx_corte_laranja":[1556,3097,71,72],"fx_corte_roxo":[1629,3097,72,72],"fx_corte_dourado":[1703,3097,70,72],"fx_faisca_2":[1775,3097,71,72],"fx_lascas":[1848,3097,72,72],"fx_estrela":[1922,3097,72,72],"fx_rastro_flecha":[1996,3097,72,72],"fx_rastro_fogo":[2070,3097,72,72],"fx_rastro_magia":[2144,3097,72,72],"fx_magia_hit_1":[2218,3097,70,72],"fx_fogo_1":[2290,3097,59,72],"fx_tontura_0":[2351,3097,72,72],"fx_tontura_1":[2425,3097,72,72],"toco_pantano":[2499,3097,76,72],"muda_deserto":[2577,3097,44,72],"raposa_side_0":[2623,3097,114,71],"raposa_side_1":[2739,3097,114,71],"raposa_side_2":[2855,3097,116,71],"raposa_side_3":[2973,3097,114,71],"magia_estouro":[3089,3097,72,71],"fugitivo_pose_1":[3163,3097,89,71],"muda_campos":[3254,3097,38,71],"bush_1_floresta":[3294,3097,62,71],"bush_0_campos":[3358,3097,70,70],"bush_0_deserto":[3430,3097,66,70],"bush_1_deserto":[3498,3097,80,68],"bush_0_floresta":[3580,3097,70,67],"toco_montanhas":[3652,3097,76,67],"fx_poeira":[3730,3097,72,66],"fx_fogo_2":[3804,3097,56,66],"ground_campos_0":[3862,3097,64,64],"ground_campos_1":[3928,3097,64,64],"ground_campos_2":[3994,3097,64,64],"ground_campos_3":[0,3177,64,64],"ground_floresta_0":[66,3177,64,64],"ground_floresta_1":[132,3177,64,64],"ground_floresta_2":[198,3177,64,64],"ground_floresta_3":[264,3177,64,64],"ground_pantano_0":[330,3177,64,64],"ground_pantano_1":[396,3177,64,64],"ground_pantano_2":[462,3177,64,64],"ground_pantano_3":[528,3177,64,64],"ground_deserto_0":[594,3177,64,64],"ground_deserto_1":[660,3177,64,64],"ground_deserto_2":[726,3177,64,64],"ground_deserto_3":[792,3177,64,64],"ground_montanhas_0":[858,3177,64,64],"ground_montanhas_1":[924,3177,64,64],"ground_montanhas_2":[990,3177,64,64],"ground_montanhas_3":[1056,3177,64,64],"ground_neve_0":[1122,3177,64,64],"ground_neve_1":[1188,3177,64,64],"ground_neve_2":[1254,3177,64,64],"ground_neve_3":[1320,3177,64,64],"tilled_0":[1386,3177,64,64],"tilled_1":[1452,3177,64,64],"tilled_2":[1518,3177,64,64],"tilled_3":[1584,3177,64,64],"water_0":[1650,3177,64,64],"water_1":[1716,3177,64,64],"water_2":[1782,3177,64,64],"dirt":[1848,3177,64,64],"stone":[1914,3177,64,64],"coal":[1980,3177,64,64],"bronze":[2046,3177,64,64],"iron":[2112,3177,64,64],"silver":[2178,3177,64,64],"gold":[2244,3177,64,64],"oil":[2310,3177,64,64],"diamond":[2376,3177,64,64],"floor_0":[2442,3177,64,64],"floor_1":[2508,3177,64,64],"floor_2":[2574,3177,64,64],"floor_3":[2640,3177,64,64],"toco_deserto":[2706,3177,66,64],"wheat_3":[2774,3177,64,63],"coelhao_front_1":[2840,3177,67,63],"deco_18":[2909,3177,50,63],"coelhao_front_2":[2961,3177,67,62],"muda_floresta":[3030,3177,37,62],"deco_6":[3069,3177,61,61],"livro_brilho":[3132,3177,64,60],"bush_1_campos":[3198,3177,69,60],"deco_7":[3269,3177,50,59],"wheat_2":[3321,3177,64,58],"fx_corte_1":[3387,3177,57,58],"rock_montanhas":[3446,3177,58,56],"icon_espada":[3506,3177,54,56],"icon_muro":[3562,3177,53,56],"icon_enxada":[3617,3177,46,56],"icon_colheita":[3665,3177,41,56],"icon_petroleo":[3708,3177,36,56],"icon_arco":[3746,3177,53,56],"icon_flechas":[3801,3177,53,56],"icon_cetro":[3856,3177,54,56],"icon_livro":[3912,3177,48,56],"fx_faisca_1":[3962,3177,57,56],"icon_carvao":[4021,3177,56,55],"helmet_front":[0,3243,64,55],"fx_fogo_0":[66,3243,42,55],"construtor_dead":[110,3243,120,55],"icon_picareta":[232,3243,56,54],"icon_rede":[290,3243,56,54],"helmet_back":[348,3243,64,54],"pintinho_side_1":[414,3243,43,53],"pintinho_side_3":[459,3243,43,53],"icon_machado":[504,3243,56,53],"pintinho_side_0":[562,3243,43,52],"pintinho_side_2":[607,3243,43,52],"chefe_dead":[652,3243,115,52],"toco_floresta":[769,3243,58,52],"rock_floresta":[829,3243,60,51],"rock_deserto":[891,3243,60,51],"hole":[953,3243,64,51],"spring":[1019,3243,64,50],"magia_voo":[1085,3243,56,50],"wheat_1":[1143,3243,64,49],"deco_17":[1209,3243,58,49],"icon_diamante":[1269,3243,56,48],"deco_23":[1327,3243,49,48],"icon_pedra":[1378,3243,56,47],"deco_8":[1436,3243,47,47],"icon_sementes":[1485,3243,56,46],"deco_11":[1543,3243,59,46],"helmet_side":[1604,3243,64,45],"fugitivo_pose_5":[1670,3243,127,45],"fugitivo_dead":[1799,3243,127,45],"deco_0":[1928,3243,43,45],"deco_2":[1973,3243,40,45],"deco_4":[2015,3243,41,45],"deco_5":[2058,3243,41,45],"deco_10":[2101,3243,58,45],"deco_22":[2161,3243,31,45],"rock_neve":[2194,3243,60,44],"icon_madeira":[2256,3243,56,44],"livro_mao":[2314,3243,64,44],"deco_1":[2380,3243,43,44],"rock_campos":[2425,3243,60,42],"fist_menino":[2487,3243,40,42],"fist_menino_negro":[2529,3243,40,42],"fist_menina_ruiva":[2571,3243,40,42],"fist_menina_negra":[2613,3243,40,42],"fist_sk_aprendiz":[2655,3243,40,42],"fist_sk_armadura_estelar":[2697,3243,40,42],"fist_sk_arqueira_mata":[2739,3243,40,42],"fist_sk_arqueiro_mata":[2781,3243,40,42],"fist_sk_cacadora":[2823,3243,40,42],"fist_sk_cacique":[2865,3243,40,42],"fist_sk_carrasco":[2907,3243,40,42],"fist_sk_ceifador":[2949,3243,40,42],"fist_sk_ciberpiloto":[2991,3243,40,42],"fist_sk_cowboy_caveira":[3033,3243,40,42],"fist_sk_elfo_verde":[3075,3243,40,42],"fist_sk_elfo_vermelho":[3117,3243,40,42],"fist_sk_espectro":[3159,3243,40,42],"fist_sk_exploradora":[3201,3243,40,42],"fist_sk_guarda_azul":[3243,3243,40,42],"fist_sk_guardiao_cristal":[3285,3243,40,42],"fist_sk_guerreiro_tribal":[3327,3243,40,42],"fist_sk_husky":[3369,3243,40,42],"fist_sk_maga_prata":[3411,3243,40,42],"fist_sk_mago_noturno":[3453,3243,40,42],"fist_sk_mecanico_vermelho":[3495,3243,40,42],"fist_sk_pinguim_chapeu":[3537,3243,40,42],"fist_sk_pinguim_gravata":[3579,3243,40,42],"fist_sk_pinguim_jaqueta":[3621,3243,40,42],"fist_sk_pirata":[3663,3243,40,42],"fist_sk_pistoleira":[3705,3243,40,42],"fist_sk_policial":[3747,3243,40,42],"fist_sk_princesa":[3789,3243,40,42],"fist_sk_raposa":[3831,3243,40,42],"fist_sk_rei_dourado":[3873,3243,40,42],"fist_sk_rei_mascarado":[3915,3243,40,42],"fist_sk_samurai":[3957,3243,40,42],"fist_sk_saqueador":[3999,3243,40,42],"fist_sk_sombra_tatica":[4041,3243,40,42],"fist_sk_vampiro":[0,3300,40,42],"deco_9":[42,3300,47,42],"saq_dead":[91,3300,103,41],"fx_impacto":[196,3300,72,41],"fumaca_verde":[270,3300,40,40],"fumaca_vermelha":[312,3300,40,40],"fumaca_dourada":[354,3300,40,40],"fumaca_roxa":[396,3300,40,40],"fx_magia_hit_0":[438,3300,37,40],"toco_campos":[477,3300,50,40],"deco_16":[529,3300,59,40],"deco_20":[590,3300,64,40],"icon_carne":[656,3300,56,39],"rock_pantano":[714,3300,60,38],"wheat_0":[776,3300,64,38],"deco_14":[842,3300,40,38],"icon_bronze":[884,3300,56,37],"icon_ferro":[942,3300,56,37],"icon_ouro":[1000,3300,56,37],"icon_prata":[1058,3300,56,37],"deco_3":[1116,3300,41,37],"deco_21":[1159,3300,56,37],"deco_15":[1217,3300,30,36],"deco_12":[1249,3300,44,28],"deco_13":[1295,3300,37,24],"deco_19":[1334,3300,35,24],"fx_corte_0":[1371,3300,17,22],"fx_faisca_0":[1390,3300,21,21],"flecha_voo":[1413,3300,64,13],"skin_menino":[228,185,150],"skin_menino_negro":[107,56,40],"skin_menina_ruiva":[243,168,128],"skin_menina_negra":[104,57,39],"skin_sk_aprendiz":[123,80,68],"skin_sk_armadura_estelar":[105,103,127],"skin_sk_arqueira_mata":[118,80,66],"skin_sk_arqueiro_mata":[130,71,63],"skin_sk_cacadora":[49,55,44],"skin_sk_cacique":[125,84,71],"skin_sk_carrasco":[73,38,41],"skin_sk_ceifador":[57,41,48],"skin_sk_ciberpiloto":[39,35,78],"skin_sk_cowboy_caveira":[81,62,55],"skin_sk_elfo_verde":[217,149,143],"skin_sk_elfo_vermelho":[231,149,138],"skin_sk_espectro":[32,26,40],"skin_sk_exploradora":[90,41,50],"skin_sk_guarda_azul":[75,65,61],"skin_sk_guardiao_cristal":[58,112,163],"skin_sk_guerreiro_tribal":[130,85,67],"skin_sk_husky":[199,184,184],"skin_sk_maga_prata":[202,136,136],"skin_sk_mago_noturno":[206,145,144],"skin_sk_mecanico_vermelho":[88,67,59],"skin_sk_pinguim_chapeu":[169,164,174],"skin_sk_pinguim_gravata":[164,150,161],"skin_sk_pinguim_jaqueta":[84,74,83],"skin_sk_pirata":[142,87,79],"skin_sk_pistoleira":[74,38,48],"skin_sk_policial":[46,31,87],"skin_sk_princesa":[57,63,130],"skin_sk_raposa":[124,72,59],"skin_sk_rei_dourado":[173,20,36],"skin_sk_rei_mascarado":[106,44,54],"skin_sk_samurai":[67,48,51],"skin_sk_saqueador":[103,76,75],"skin_sk_sombra_tatica":[71,68,64],"skin_sk_vampiro":[176,143,141],"hand_menino_front_idle":[4,65],"hand_menino_front_walk_0":[4,65],"hand_menino_front_walk_1":[4,65],"hand_menino_front_walk_2":[4,65],"hand_menino_front_walk_3":[5,65],"hand_menino_back_idle":[41,63],"hand_menino_back_walk_0":[41,63],"hand_menino_back_walk_1":[41,63],"hand_menino_back_walk_2":[41,63],"hand_menino_back_walk_3":[42,64],"hand_menino_side_idle":[22,68],"hand_menino_side_walk_0":[23,68],"hand_menino_side_walk_1":[22,68],"hand_menino_side_walk_2":[22,68],"hand_menino_side_walk_3":[27,66],"hand_menino_side_walk_4":[28,66],"hand_menino_side_walk_5":[27,66],"hand_menino_side_walk_6":[27,66],"hand_menino_side_walk_7":[22,68],"hand_menino_negro_front_idle":[7,68],"hand_menino_negro_front_walk_0":[7,68],"hand_menino_negro_front_walk_1":[8,68],"hand_menino_negro_front_walk_2":[7,68],"hand_menino_negro_front_walk_3":[8,68],"hand_menino_negro_back_idle":[39,68],"hand_menino_negro_back_walk_0":[39,68],"hand_menino_negro_back_walk_1":[39,69],"hand_menino_negro_back_walk_2":[39,68],"hand_menino_negro_back_walk_3":[40,68],"hand_menino_negro_side_idle":[24,72],"hand_menino_negro_side_walk_0":[26,73],"hand_menino_negro_side_walk_1":[25,73],"hand_menino_negro_side_walk_2":[24,72],"hand_menino_negro_side_walk_3":[32,69],"hand_menino_negro_side_walk_4":[33,69],"hand_menino_negro_side_walk_5":[32,69],"hand_menino_negro_side_walk_6":[31,69],"hand_menino_negro_side_walk_7":[25,73],"hand_menina_ruiva_front_idle":[4,64],"hand_menina_ruiva_front_walk_0":[4,64],"hand_menina_ruiva_front_walk_1":[4,64],"hand_menina_ruiva_front_walk_2":[4,64],"hand_menina_ruiva_front_walk_3":[5,64],"hand_menina_ruiva_back_idle":[41,64],"hand_menina_ruiva_back_walk_0":[41,64],"hand_menina_ruiva_back_walk_1":[42,63],"hand_menina_ruiva_back_walk_2":[41,64],"hand_menina_ruiva_back_walk_3":[42,63],"hand_menina_ruiva_side_idle":[29,65],"hand_menina_ruiva_side_walk_0":[30,65],"hand_menina_ruiva_side_walk_1":[30,65],"hand_menina_ruiva_side_walk_2":[29,65],"hand_menina_ruiva_side_walk_3":[36,63],"hand_menina_ruiva_side_walk_4":[37,63],"hand_menina_ruiva_side_walk_5":[36,63],"hand_menina_ruiva_side_walk_6":[36,63],"hand_menina_ruiva_side_walk_7":[30,65],"hand_menina_negra_front_idle":[11,62],"hand_menina_negra_front_walk_0":[11,62],"hand_menina_negra_front_walk_1":[10,62],"hand_menina_negra_front_walk_2":[11,62],"hand_menina_negra_front_walk_3":[10,63],"hand_menina_negra_back_idle":[45,63],"hand_menina_negra_back_walk_0":[45,63],"hand_menina_negra_back_walk_1":[46,65],"hand_menina_negra_back_walk_2":[45,63],"hand_menina_negra_back_walk_3":[45,65],"hand_menina_negra_side_idle":[26,63],"hand_menina_negra_side_walk_0":[26,64],"hand_menina_negra_side_walk_1":[26,63],"hand_menina_negra_side_walk_2":[26,63],"hand_menina_negra_side_walk_3":[31,62],"hand_menina_negra_side_walk_4":[31,62],"hand_menina_negra_side_walk_5":[31,62],"hand_menina_negra_side_walk_6":[31,62],"hand_menina_negra_side_walk_7":[26,63],"hand_sk_aprendiz_front_idle":[11,62],"hand_sk_aprendiz_front_walk_0":[11,62],"hand_sk_aprendiz_front_walk_1":[10,60],"hand_sk_aprendiz_front_walk_2":[11,62],"hand_sk_aprendiz_front_walk_3":[10,61],"hand_sk_aprendiz_back_idle":[46,60],"hand_sk_aprendiz_back_walk_0":[46,60],"hand_sk_aprendiz_back_walk_1":[47,60],"hand_sk_aprendiz_back_walk_2":[46,60],"hand_sk_aprendiz_back_walk_3":[47,59],"hand_sk_aprendiz_side_idle":[29,59],"hand_sk_aprendiz_side_walk_0":[29,60],"hand_sk_aprendiz_side_walk_1":[29,59],"hand_sk_aprendiz_side_walk_2":[29,59],"hand_sk_aprendiz_side_walk_3":[29,59],"hand_sk_aprendiz_side_walk_4":[29,59],"hand_sk_aprendiz_side_walk_5":[29,59],"hand_sk_aprendiz_side_walk_6":[29,59],"hand_sk_aprendiz_side_walk_7":[29,59],"hand_sk_armadura_estelar_front_idle":[12,61],"hand_sk_armadura_estelar_front_walk_0":[12,61],"hand_sk_armadura_estelar_front_walk_1":[11,62],"hand_sk_armadura_estelar_front_walk_2":[12,61],"hand_sk_armadura_estelar_front_walk_3":[11,63],"hand_sk_armadura_estelar_back_idle":[46,59],"hand_sk_armadura_estelar_back_walk_0":[46,59],"hand_sk_armadura_estelar_back_walk_1":[48,59],"hand_sk_armadura_estelar_back_walk_2":[46,59],"hand_sk_armadura_estelar_back_walk_3":[49,57],"hand_sk_armadura_estelar_side_idle":[28,58],"hand_sk_armadura_estelar_side_walk_0":[29,60],"hand_sk_armadura_estelar_side_walk_1":[29,59],"hand_sk_armadura_estelar_side_walk_2":[28,58],"hand_sk_armadura_estelar_side_walk_3":[28,59],"hand_sk_armadura_estelar_side_walk_4":[28,60],"hand_sk_armadura_estelar_side_walk_5":[28,59],"hand_sk_armadura_estelar_side_walk_6":[27,59],"hand_sk_armadura_estelar_side_walk_7":[29,59],"hand_sk_arqueira_mata_front_idle":[9,61],"hand_sk_arqueira_mata_front_walk_0":[9,61],"hand_sk_arqueira_mata_front_walk_1":[9,61],"hand_sk_arqueira_mata_front_walk_2":[9,61],"hand_sk_arqueira_mata_front_walk_3":[10,64],"hand_sk_arqueira_mata_back_idle":[37,58],"hand_sk_arqueira_mata_back_walk_0":[37,58],"hand_sk_arqueira_mata_back_walk_1":[37,58],"hand_sk_arqueira_mata_back_walk_2":[37,58],"hand_sk_arqueira_mata_back_walk_3":[38,58],"hand_sk_arqueira_mata_side_idle":[22,64],"hand_sk_arqueira_mata_side_walk_0":[23,65],"hand_sk_arqueira_mata_side_walk_1":[22,64],"hand_sk_arqueira_mata_side_walk_2":[22,64],"hand_sk_arqueira_mata_side_walk_3":[22,64],"hand_sk_arqueira_mata_side_walk_4":[23,65],"hand_sk_arqueira_mata_side_walk_5":[22,64],"hand_sk_arqueira_mata_side_walk_6":[22,64],"hand_sk_arqueira_mata_side_walk_7":[22,64],"hand_sk_arqueiro_mata_front_idle":[8,61],"hand_sk_arqueiro_mata_front_walk_0":[8,61],"hand_sk_arqueiro_mata_front_walk_1":[8,61],"hand_sk_arqueiro_mata_front_walk_2":[8,61],"hand_sk_arqueiro_mata_front_walk_3":[10,63],"hand_sk_arqueiro_mata_back_idle":[37,57],"hand_sk_arqueiro_mata_back_walk_0":[37,57],"hand_sk_arqueiro_mata_back_walk_1":[37,57],"hand_sk_arqueiro_mata_back_walk_2":[37,57],"hand_sk_arqueiro_mata_back_walk_3":[37,57],"hand_sk_arqueiro_mata_side_idle":[22,63],"hand_sk_arqueiro_mata_side_walk_0":[22,64],"hand_sk_arqueiro_mata_side_walk_1":[22,64],"hand_sk_arqueiro_mata_side_walk_2":[22,63],"hand_sk_arqueiro_mata_side_walk_3":[22,63],"hand_sk_arqueiro_mata_side_walk_4":[23,64],"hand_sk_arqueiro_mata_side_walk_5":[22,63],"hand_sk_arqueiro_mata_side_walk_6":[22,63],"hand_sk_arqueiro_mata_side_walk_7":[22,64],"hand_sk_cacadora_front_idle":[10,62],"hand_sk_cacadora_front_walk_0":[10,62],"hand_sk_cacadora_front_walk_1":[10,62],"hand_sk_cacadora_front_walk_2":[10,62],"hand_sk_cacadora_front_walk_3":[10,62],"hand_sk_cacadora_back_idle":[39,58],"hand_sk_cacadora_back_walk_0":[39,58],"hand_sk_cacadora_back_walk_1":[38,57],"hand_sk_cacadora_back_walk_2":[39,58],"hand_sk_cacadora_back_walk_3":[39,57],"hand_sk_cacadora_side_idle":[28,61],"hand_sk_cacadora_side_walk_0":[29,62],"hand_sk_cacadora_side_walk_1":[29,61],"hand_sk_cacadora_side_walk_2":[28,61],"hand_sk_cacadora_side_walk_3":[29,61],"hand_sk_cacadora_side_walk_4":[29,62],"hand_sk_cacadora_side_walk_5":[29,61],"hand_sk_cacadora_side_walk_6":[28,61],"hand_sk_cacadora_side_walk_7":[29,61],"hand_sk_cacique_front_idle":[8,61],"hand_sk_cacique_front_walk_0":[8,61],"hand_sk_cacique_front_walk_1":[9,62],"hand_sk_cacique_front_walk_2":[8,61],"hand_sk_cacique_front_walk_3":[9,62],"hand_sk_cacique_back_idle":[38,59],"hand_sk_cacique_back_walk_0":[38,59],"hand_sk_cacique_back_walk_1":[37,60],"hand_sk_cacique_back_walk_2":[38,59],"hand_sk_cacique_back_walk_3":[39,58],"hand_sk_cacique_side_idle":[22,61],"hand_sk_cacique_side_walk_0":[23,63],"hand_sk_cacique_side_walk_1":[23,62],"hand_sk_cacique_side_walk_2":[22,61],"hand_sk_cacique_side_walk_3":[22,61],"hand_sk_cacique_side_walk_4":[23,62],"hand_sk_cacique_side_walk_5":[22,61],"hand_sk_cacique_side_walk_6":[22,61],"hand_sk_cacique_side_walk_7":[23,62],"hand_sk_carrasco_front_idle":[16,62],"hand_sk_carrasco_front_walk_0":[16,62],"hand_sk_carrasco_front_walk_1":[16,61],"hand_sk_carrasco_front_walk_2":[16,62],"hand_sk_carrasco_front_walk_3":[16,62],"hand_sk_carrasco_back_idle":[48,62],"hand_sk_carrasco_back_walk_0":[48,62],"hand_sk_carrasco_back_walk_1":[46,61],"hand_sk_carrasco_back_walk_2":[48,62],"hand_sk_carrasco_back_walk_3":[46,62],"hand_sk_carrasco_side_idle":[37,62],"hand_sk_carrasco_side_walk_0":[37,63],"hand_sk_carrasco_side_walk_1":[37,62],"hand_sk_carrasco_side_walk_2":[37,62],"hand_sk_carrasco_side_walk_3":[26,63],"hand_sk_carrasco_side_walk_4":[26,63],"hand_sk_carrasco_side_walk_5":[26,63],"hand_sk_carrasco_side_walk_6":[26,62],"hand_sk_carrasco_side_walk_7":[37,62],"hand_sk_ceifador_front_idle":[11,65],"hand_sk_ceifador_front_walk_0":[11,65],"hand_sk_ceifador_front_walk_1":[11,65],"hand_sk_ceifador_front_walk_2":[11,65],"hand_sk_ceifador_front_walk_3":[12,65],"hand_sk_ceifador_back_idle":[38,62],"hand_sk_ceifador_back_walk_0":[38,62],"hand_sk_ceifador_back_walk_1":[39,61],"hand_sk_ceifador_back_walk_2":[38,62],"hand_sk_ceifador_back_walk_3":[39,62],"hand_sk_ceifador_side_idle":[29,60],"hand_sk_ceifador_side_walk_0":[29,61],"hand_sk_ceifador_side_walk_1":[29,61],"hand_sk_ceifador_side_walk_2":[29,60],"hand_sk_ceifador_side_walk_3":[28,61],"hand_sk_ceifador_side_walk_4":[28,62],"hand_sk_ceifador_side_walk_5":[28,61],"hand_sk_ceifador_side_walk_6":[28,60],"hand_sk_ceifador_side_walk_7":[29,61],"hand_sk_ciberpiloto_front_idle":[11,56],"hand_sk_ciberpiloto_front_walk_0":[11,56],"hand_sk_ciberpiloto_front_walk_1":[11,56],"hand_sk_ciberpiloto_front_walk_2":[11,56],"hand_sk_ciberpiloto_front_walk_3":[12,57],"hand_sk_ciberpiloto_back_idle":[38,58],"hand_sk_ciberpiloto_back_walk_0":[38,58],"hand_sk_ciberpiloto_back_walk_1":[38,57],"hand_sk_ciberpiloto_back_walk_2":[38,58],"hand_sk_ciberpiloto_back_walk_3":[38,57],"hand_sk_ciberpiloto_side_idle":[22,64],"hand_sk_ciberpiloto_side_walk_0":[24,64],"hand_sk_ciberpiloto_side_walk_1":[23,64],"hand_sk_ciberpiloto_side_walk_2":[22,64],"hand_sk_ciberpiloto_side_walk_3":[23,64],"hand_sk_ciberpiloto_side_walk_4":[24,64],"hand_sk_ciberpiloto_side_walk_5":[23,64],"hand_sk_ciberpiloto_side_walk_6":[23,64],"hand_sk_ciberpiloto_side_walk_7":[23,64],"hand_sk_cowboy_caveira_front_idle":[10,64],"hand_sk_cowboy_caveira_front_walk_0":[10,64],"hand_sk_cowboy_caveira_front_walk_1":[10,64],"hand_sk_cowboy_caveira_front_walk_2":[10,64],"hand_sk_cowboy_caveira_front_walk_3":[9,64],"hand_sk_cowboy_caveira_back_idle":[37,63],"hand_sk_cowboy_caveira_back_walk_0":[37,63],"hand_sk_cowboy_caveira_back_walk_1":[38,63],"hand_sk_cowboy_caveira_back_walk_2":[37,63],"hand_sk_cowboy_caveira_back_walk_3":[38,62],"hand_sk_cowboy_caveira_side_idle":[28,60],"hand_sk_cowboy_caveira_side_walk_0":[29,61],"hand_sk_cowboy_caveira_side_walk_1":[29,61],"hand_sk_cowboy_caveira_side_walk_2":[28,60],"hand_sk_cowboy_caveira_side_walk_3":[28,61],"hand_sk_cowboy_caveira_side_walk_4":[29,61],"hand_sk_cowboy_caveira_side_walk_5":[28,61],"hand_sk_cowboy_caveira_side_walk_6":[28,60],"hand_sk_cowboy_caveira_side_walk_7":[29,61],"hand_sk_elfo_verde_front_idle":[5,70],"hand_sk_elfo_verde_front_walk_0":[5,70],"hand_sk_elfo_verde_front_walk_1":[5,69],"hand_sk_elfo_verde_front_walk_2":[5,70],"hand_sk_elfo_verde_front_walk_3":[7,70],"hand_sk_elfo_verde_back_idle":[48,73],"hand_sk_elfo_verde_back_walk_0":[48,73],"hand_sk_elfo_verde_back_walk_1":[49,74],"hand_sk_elfo_verde_back_walk_2":[48,73],"hand_sk_elfo_verde_back_walk_3":[51,74],"hand_sk_elfo_verde_side_idle":[28,67],"hand_sk_elfo_verde_side_walk_0":[29,68],"hand_sk_elfo_verde_side_walk_1":[29,68],"hand_sk_elfo_verde_side_walk_2":[28,67],"hand_sk_elfo_verde_side_walk_3":[28,68],"hand_sk_elfo_verde_side_walk_4":[27,68],"hand_sk_elfo_verde_side_walk_5":[28,68],"hand_sk_elfo_verde_side_walk_6":[26,68],"hand_sk_elfo_verde_side_walk_7":[29,68],"hand_sk_elfo_vermelho_front_idle":[5,68],"hand_sk_elfo_vermelho_front_walk_0":[5,68],"hand_sk_elfo_vermelho_front_walk_1":[6,70],"hand_sk_elfo_vermelho_front_walk_2":[5,68],"hand_sk_elfo_vermelho_front_walk_3":[5,69],"hand_sk_elfo_vermelho_back_idle":[49,74],"hand_sk_elfo_vermelho_back_walk_0":[49,74],"hand_sk_elfo_vermelho_back_walk_1":[52,74],"hand_sk_elfo_vermelho_back_walk_2":[49,74],"hand_sk_elfo_vermelho_back_walk_3":[50,74],"hand_sk_elfo_vermelho_side_idle":[28,64],"hand_sk_elfo_vermelho_side_walk_0":[30,65],"hand_sk_elfo_vermelho_side_walk_1":[29,65],"hand_sk_elfo_vermelho_side_walk_2":[28,64],"hand_sk_elfo_vermelho_side_walk_3":[28,66],"hand_sk_elfo_vermelho_side_walk_4":[29,66],"hand_sk_elfo_vermelho_side_walk_5":[28,66],"hand_sk_elfo_vermelho_side_walk_6":[27,65],"hand_sk_elfo_vermelho_side_walk_7":[29,65],"hand_sk_espectro_front_idle":[16,62],"hand_sk_espectro_front_walk_0":[16,62],"hand_sk_espectro_front_walk_1":[16,63],"hand_sk_espectro_front_walk_2":[16,62],"hand_sk_espectro_front_walk_3":[16,63],"hand_sk_espectro_back_idle":[47,64],"hand_sk_espectro_back_walk_0":[47,64],"hand_sk_espectro_back_walk_1":[46,62],"hand_sk_espectro_back_walk_2":[47,64],"hand_sk_espectro_back_walk_3":[47,64],"hand_sk_espectro_side_idle":[44,60],"hand_sk_espectro_side_walk_0":[44,60],"hand_sk_espectro_side_walk_1":[44,60],"hand_sk_espectro_side_walk_2":[44,60],"hand_sk_espectro_side_walk_3":[44,60],"hand_sk_espectro_side_walk_4":[44,61],"hand_sk_espectro_side_walk_5":[44,60],"hand_sk_espectro_side_walk_6":[44,60],"hand_sk_espectro_side_walk_7":[44,60],"hand_sk_exploradora_front_idle":[10,61],"hand_sk_exploradora_front_walk_0":[10,61],"hand_sk_exploradora_front_walk_1":[10,61],"hand_sk_exploradora_front_walk_2":[10,61],"hand_sk_exploradora_front_walk_3":[10,61],"hand_sk_exploradora_back_idle":[43,63],"hand_sk_exploradora_back_walk_0":[43,63],"hand_sk_exploradora_back_walk_1":[44,63],"hand_sk_exploradora_back_walk_2":[43,63],"hand_sk_exploradora_back_walk_3":[44,62],"hand_sk_exploradora_side_idle":[25,62],"hand_sk_exploradora_side_walk_0":[25,64],"hand_sk_exploradora_side_walk_1":[25,63],"hand_sk_exploradora_side_walk_2":[25,62],"hand_sk_exploradora_side_walk_3":[25,64],"hand_sk_exploradora_side_walk_4":[26,65],"hand_sk_exploradora_side_walk_5":[25,64],"hand_sk_exploradora_side_walk_6":[25,63],"hand_sk_exploradora_side_walk_7":[25,63],"hand_sk_guarda_azul_front_idle":[11,64],"hand_sk_guarda_azul_front_walk_0":[11,64],"hand_sk_guarda_azul_front_walk_1":[10,64],"hand_sk_guarda_azul_front_walk_2":[11,64],"hand_sk_guarda_azul_front_walk_3":[11,63],"hand_sk_guarda_azul_back_idle":[41,64],"hand_sk_guarda_azul_back_walk_0":[41,64],"hand_sk_guarda_azul_back_walk_1":[41,63],"hand_sk_guarda_azul_back_walk_2":[41,64],"hand_sk_guarda_azul_back_walk_3":[40,63],"hand_sk_guarda_azul_side_idle":[24,63],"hand_sk_guarda_azul_side_walk_0":[24,64],"hand_sk_guarda_azul_side_walk_1":[24,63],"hand_sk_guarda_azul_side_walk_2":[24,63],"hand_sk_guarda_azul_side_walk_3":[22,63],"hand_sk_guarda_azul_side_walk_4":[22,64],"hand_sk_guarda_azul_side_walk_5":[22,63],"hand_sk_guarda_azul_side_walk_6":[22,63],"hand_sk_guarda_azul_side_walk_7":[24,63],"hand_sk_guardiao_cristal_front_idle":[10,62],"hand_sk_guardiao_cristal_front_walk_0":[10,62],"hand_sk_guardiao_cristal_front_walk_1":[9,61],"hand_sk_guardiao_cristal_front_walk_2":[10,62],"hand_sk_guardiao_cristal_front_walk_3":[10,62],"hand_sk_guardiao_cristal_back_idle":[40,59],"hand_sk_guardiao_cristal_back_walk_0":[40,59],"hand_sk_guardiao_cristal_back_walk_1":[40,59],"hand_sk_guardiao_cristal_back_walk_2":[40,59],"hand_sk_guardiao_cristal_back_walk_3":[42,57],"hand_sk_guardiao_cristal_side_idle":[23,63],"hand_sk_guardiao_cristal_side_walk_0":[24,63],"hand_sk_guardiao_cristal_side_walk_1":[24,63],"hand_sk_guardiao_cristal_side_walk_2":[23,63],"hand_sk_guardiao_cristal_side_walk_3":[25,63],"hand_sk_guardiao_cristal_side_walk_4":[25,63],"hand_sk_guardiao_cristal_side_walk_5":[25,63],"hand_sk_guardiao_cristal_side_walk_6":[24,62],"hand_sk_guardiao_cristal_side_walk_7":[24,63],"hand_sk_guerreiro_tribal_front_idle":[8,61],"hand_sk_guerreiro_tribal_front_walk_0":[8,61],"hand_sk_guerreiro_tribal_front_walk_1":[8,61],"hand_sk_guerreiro_tribal_front_walk_2":[8,61],"hand_sk_guerreiro_tribal_front_walk_3":[9,62],"hand_sk_guerreiro_tribal_back_idle":[37,61],"hand_sk_guerreiro_tribal_back_walk_0":[37,61],"hand_sk_guerreiro_tribal_back_walk_1":[38,61],"hand_sk_guerreiro_tribal_back_walk_2":[37,61],"hand_sk_guerreiro_tribal_back_walk_3":[38,60],"hand_sk_guerreiro_tribal_side_idle":[22,62],"hand_sk_guerreiro_tribal_side_walk_0":[23,63],"hand_sk_guerreiro_tribal_side_walk_1":[23,62],"hand_sk_guerreiro_tribal_side_walk_2":[22,62],"hand_sk_guerreiro_tribal_side_walk_3":[23,62],"hand_sk_guerreiro_tribal_side_walk_4":[23,62],"hand_sk_guerreiro_tribal_side_walk_5":[23,62],"hand_sk_guerreiro_tribal_side_walk_6":[22,61],"hand_sk_guerreiro_tribal_side_walk_7":[23,62],"hand_sk_husky_front_idle":[8,63],"hand_sk_husky_front_walk_0":[8,63],"hand_sk_husky_front_walk_1":[8,64],"hand_sk_husky_front_walk_2":[8,63],"hand_sk_husky_front_walk_3":[11,65],"hand_sk_husky_back_idle":[41,56],"hand_sk_husky_back_walk_0":[41,56],"hand_sk_husky_back_walk_1":[38,58],"hand_sk_husky_back_walk_2":[41,56],"hand_sk_husky_back_walk_3":[40,55],"hand_sk_husky_side_idle":[49,59],"hand_sk_husky_side_walk_0":[51,60],"hand_sk_husky_side_walk_1":[49,60],"hand_sk_husky_side_walk_2":[49,59],"hand_sk_husky_side_walk_3":[51,62],"hand_sk_husky_side_walk_4":[52,62],"hand_sk_husky_side_walk_5":[51,62],"hand_sk_husky_side_walk_6":[50,62],"hand_sk_husky_side_walk_7":[49,60],"hand_sk_maga_prata_front_idle":[6,69],"hand_sk_maga_prata_front_walk_0":[6,69],"hand_sk_maga_prata_front_walk_1":[7,69],"hand_sk_maga_prata_front_walk_2":[6,69],"hand_sk_maga_prata_front_walk_3":[5,70],"hand_sk_maga_prata_back_idle":[51,68],"hand_sk_maga_prata_back_walk_0":[51,68],"hand_sk_maga_prata_back_walk_1":[52,68],"hand_sk_maga_prata_back_walk_2":[51,68],"hand_sk_maga_prata_back_walk_3":[52,69],"hand_sk_maga_prata_side_idle":[27,63],"hand_sk_maga_prata_side_walk_0":[28,64],"hand_sk_maga_prata_side_walk_1":[28,63],"hand_sk_maga_prata_side_walk_2":[27,63],"hand_sk_maga_prata_side_walk_3":[28,63],"hand_sk_maga_prata_side_walk_4":[29,64],"hand_sk_maga_prata_side_walk_5":[28,63],"hand_sk_maga_prata_side_walk_6":[27,64],"hand_sk_maga_prata_side_walk_7":[28,63],"hand_sk_mago_noturno_front_idle":[5,70],"hand_sk_mago_noturno_front_walk_0":[5,70],"hand_sk_mago_noturno_front_walk_1":[5,70],"hand_sk_mago_noturno_front_walk_2":[5,70],"hand_sk_mago_noturno_front_walk_3":[6,69],"hand_sk_mago_noturno_back_idle":[51,68],"hand_sk_mago_noturno_back_walk_0":[51,68],"hand_sk_mago_noturno_back_walk_1":[49,63],"hand_sk_mago_noturno_back_walk_2":[51,68],"hand_sk_mago_noturno_back_walk_3":[50,67],"hand_sk_mago_noturno_side_idle":[31,69],"hand_sk_mago_noturno_side_walk_0":[29,68],"hand_sk_mago_noturno_side_walk_1":[31,68],"hand_sk_mago_noturno_side_walk_2":[31,69],"hand_sk_mago_noturno_side_walk_3":[32,67],"hand_sk_mago_noturno_side_walk_4":[32,66],"hand_sk_mago_noturno_side_walk_5":[32,67],"hand_sk_mago_noturno_side_walk_6":[32,67],"hand_sk_mago_noturno_side_walk_7":[31,68],"hand_sk_mecanico_vermelho_front_idle":[10,65],"hand_sk_mecanico_vermelho_front_walk_0":[10,65],"hand_sk_mecanico_vermelho_front_walk_1":[11,65],"hand_sk_mecanico_vermelho_front_walk_2":[10,65],"hand_sk_mecanico_vermelho_front_walk_3":[12,65],"hand_sk_mecanico_vermelho_back_idle":[40,62],"hand_sk_mecanico_vermelho_back_walk_0":[40,62],"hand_sk_mecanico_vermelho_back_walk_1":[40,62],"hand_sk_mecanico_vermelho_back_walk_2":[40,62],"hand_sk_mecanico_vermelho_back_walk_3":[39,62],"hand_sk_mecanico_vermelho_side_idle":[23,61],"hand_sk_mecanico_vermelho_side_walk_0":[24,62],"hand_sk_mecanico_vermelho_side_walk_1":[24,61],"hand_sk_mecanico_vermelho_side_walk_2":[23,61],"hand_sk_mecanico_vermelho_side_walk_3":[22,62],"hand_sk_mecanico_vermelho_side_walk_4":[22,62],"hand_sk_mecanico_vermelho_side_walk_5":[22,62],"hand_sk_mecanico_vermelho_side_walk_6":[21,62],"hand_sk_mecanico_vermelho_side_walk_7":[24,61],"hand_sk_pinguim_chapeu_front_idle":[14,64],"hand_sk_pinguim_chapeu_front_walk_0":[14,64],"hand_sk_pinguim_chapeu_front_walk_1":[16,67],"hand_sk_pinguim_chapeu_front_walk_2":[14,64],"hand_sk_pinguim_chapeu_front_walk_3":[16,67],"hand_sk_pinguim_chapeu_back_idle":[51,69],"hand_sk_pinguim_chapeu_back_walk_0":[51,69],"hand_sk_pinguim_chapeu_back_walk_1":[51,68],"hand_sk_pinguim_chapeu_back_walk_2":[51,69],"hand_sk_pinguim_chapeu_back_walk_3":[51,69],"hand_sk_pinguim_chapeu_side_idle":[35,61],"hand_sk_pinguim_chapeu_side_walk_0":[36,62],"hand_sk_pinguim_chapeu_side_walk_1":[36,61],"hand_sk_pinguim_chapeu_side_walk_2":[35,61],"hand_sk_pinguim_chapeu_side_walk_3":[34,61],"hand_sk_pinguim_chapeu_side_walk_4":[35,61],"hand_sk_pinguim_chapeu_side_walk_5":[34,61],"hand_sk_pinguim_chapeu_side_walk_6":[34,61],"hand_sk_pinguim_chapeu_side_walk_7":[36,61],"hand_sk_pinguim_gravata_front_idle":[14,66],"hand_sk_pinguim_gravata_front_walk_0":[14,66],"hand_sk_pinguim_gravata_front_walk_1":[13,67],"hand_sk_pinguim_gravata_front_walk_2":[14,66],"hand_sk_pinguim_gravata_front_walk_3":[15,67],"hand_sk_pinguim_gravata_back_idle":[51,64],"hand_sk_pinguim_gravata_back_walk_0":[51,64],"hand_sk_pinguim_gravata_back_walk_1":[49,64],"hand_sk_pinguim_gravata_back_walk_2":[51,64],"hand_sk_pinguim_gravata_back_walk_3":[51,63],"hand_sk_pinguim_gravata_side_idle":[39,62],"hand_sk_pinguim_gravata_side_walk_0":[38,64],"hand_sk_pinguim_gravata_side_walk_1":[39,63],"hand_sk_pinguim_gravata_side_walk_2":[39,62],"hand_sk_pinguim_gravata_side_walk_3":[37,63],"hand_sk_pinguim_gravata_side_walk_4":[36,65],"hand_sk_pinguim_gravata_side_walk_5":[37,63],"hand_sk_pinguim_gravata_side_walk_6":[37,62],"hand_sk_pinguim_gravata_side_walk_7":[39,63],"hand_sk_pinguim_jaqueta_front_idle":[15,62],"hand_sk_pinguim_jaqueta_front_walk_0":[15,62],"hand_sk_pinguim_jaqueta_front_walk_1":[14,61],"hand_sk_pinguim_jaqueta_front_walk_2":[15,62],"hand_sk_pinguim_jaqueta_front_walk_3":[15,61],"hand_sk_pinguim_jaqueta_back_idle":[46,59],"hand_sk_pinguim_jaqueta_back_walk_0":[46,59],"hand_sk_pinguim_jaqueta_back_walk_1":[46,59],"hand_sk_pinguim_jaqueta_back_walk_2":[46,59],"hand_sk_pinguim_jaqueta_back_walk_3":[46,60],"hand_sk_pinguim_jaqueta_side_idle":[31,59],"hand_sk_pinguim_jaqueta_side_walk_0":[31,60],"hand_sk_pinguim_jaqueta_side_walk_1":[31,59],"hand_sk_pinguim_jaqueta_side_walk_2":[31,59],"hand_sk_pinguim_jaqueta_side_walk_3":[31,59],"hand_sk_pinguim_jaqueta_side_walk_4":[32,60],"hand_sk_pinguim_jaqueta_side_walk_5":[31,59],"hand_sk_pinguim_jaqueta_side_walk_6":[31,59],"hand_sk_pinguim_jaqueta_side_walk_7":[31,59],"hand_sk_pirata_front_idle":[9,60],"hand_sk_pirata_front_walk_0":[9,60],"hand_sk_pirata_front_walk_1":[10,61],"hand_sk_pirata_front_walk_2":[9,60],"hand_sk_pirata_front_walk_3":[11,60],"hand_sk_pirata_back_idle":[43,61],"hand_sk_pirata_back_walk_0":[43,61],"hand_sk_pirata_back_walk_1":[42,60],"hand_sk_pirata_back_walk_2":[43,61],"hand_sk_pirata_back_walk_3":[43,62],"hand_sk_pirata_side_idle":[41,65],"hand_sk_pirata_side_walk_0":[42,66],"hand_sk_pirata_side_walk_1":[42,66],"hand_sk_pirata_side_walk_2":[41,65],"hand_sk_pirata_side_walk_3":[41,66],"hand_sk_pirata_side_walk_4":[40,65],"hand_sk_pirata_side_walk_5":[41,66],"hand_sk_pirata_side_walk_6":[40,65],"hand_sk_pirata_side_walk_7":[42,66],"hand_sk_pistoleira_front_idle":[15,65],"hand_sk_pistoleira_front_walk_0":[15,65],"hand_sk_pistoleira_front_walk_1":[14,65],"hand_sk_pistoleira_front_walk_2":[15,65],"hand_sk_pistoleira_front_walk_3":[15,65],"hand_sk_pistoleira_back_idle":[49,66],"hand_sk_pistoleira_back_walk_0":[49,66],"hand_sk_pistoleira_back_walk_1":[50,65],"hand_sk_pistoleira_back_walk_2":[49,66],"hand_sk_pistoleira_back_walk_3":[49,65],"hand_sk_pistoleira_side_idle":[34,62],"hand_sk_pistoleira_side_walk_0":[35,63],"hand_sk_pistoleira_side_walk_1":[34,62],"hand_sk_pistoleira_side_walk_2":[34,62],"hand_sk_pistoleira_side_walk_3":[34,62],"hand_sk_pistoleira_side_walk_4":[35,63],"hand_sk_pistoleira_side_walk_5":[34,62],"hand_sk_pistoleira_side_walk_6":[34,61],"hand_sk_pistoleira_side_walk_7":[34,62],"hand_sk_policial_front_idle":[11,57],"hand_sk_policial_front_walk_0":[11,57],"hand_sk_policial_front_walk_1":[13,57],"hand_sk_policial_front_walk_2":[11,57],"hand_sk_policial_front_walk_3":[12,56],"hand_sk_policial_back_idle":[36,58],"hand_sk_policial_back_walk_0":[36,58],"hand_sk_policial_back_walk_1":[37,59],"hand_sk_policial_back_walk_2":[36,58],"hand_sk_policial_back_walk_3":[37,58],"hand_sk_policial_side_idle":[23,62],"hand_sk_policial_side_walk_0":[23,63],"hand_sk_policial_side_walk_1":[23,63],"hand_sk_policial_side_walk_2":[23,62],"hand_sk_policial_side_walk_3":[23,63],"hand_sk_policial_side_walk_4":[23,63],"hand_sk_policial_side_walk_5":[23,63],"hand_sk_policial_side_walk_6":[23,62],"hand_sk_policial_side_walk_7":[23,63],"hand_sk_princesa_front_idle":[16,68],"hand_sk_princesa_front_walk_0":[16,68],"hand_sk_princesa_front_walk_1":[16,69],"hand_sk_princesa_front_walk_2":[16,68],"hand_sk_princesa_front_walk_3":[15,69],"hand_sk_princesa_back_idle":[44,66],"hand_sk_princesa_back_walk_0":[44,66],"hand_sk_princesa_back_walk_1":[44,66],"hand_sk_princesa_back_walk_2":[44,66],"hand_sk_princesa_back_walk_3":[44,66],"hand_sk_princesa_side_idle":[34,57],"hand_sk_princesa_side_walk_0":[34,58],"hand_sk_princesa_side_walk_1":[34,58],"hand_sk_princesa_side_walk_2":[34,57],"hand_sk_princesa_side_walk_3":[33,58],"hand_sk_princesa_side_walk_4":[33,58],"hand_sk_princesa_side_walk_5":[33,58],"hand_sk_princesa_side_walk_6":[33,58],"hand_sk_princesa_side_walk_7":[34,58],"hand_sk_raposa_front_idle":[17,64],"hand_sk_raposa_front_walk_0":[17,64],"hand_sk_raposa_front_walk_1":[17,65],"hand_sk_raposa_front_walk_2":[17,64],"hand_sk_raposa_front_walk_3":[17,62],"hand_sk_raposa_back_idle":[48,61],"hand_sk_raposa_back_walk_0":[48,61],"hand_sk_raposa_back_walk_1":[49,60],"hand_sk_raposa_back_walk_2":[48,61],"hand_sk_raposa_back_walk_3":[51,60],"hand_sk_raposa_side_idle":[46,58],"hand_sk_raposa_side_walk_0":[46,61],"hand_sk_raposa_side_walk_1":[46,60],"hand_sk_raposa_side_walk_2":[46,58],"hand_sk_raposa_side_walk_3":[45,61],"hand_sk_raposa_side_walk_4":[45,61],"hand_sk_raposa_side_walk_5":[45,61],"hand_sk_raposa_side_walk_6":[45,60],"hand_sk_raposa_side_walk_7":[46,60],"hand_sk_rei_dourado_front_idle":[6,73],"hand_sk_rei_dourado_front_walk_0":[6,73],"hand_sk_rei_dourado_front_walk_1":[6,72],"hand_sk_rei_dourado_front_walk_2":[6,73],"hand_sk_rei_dourado_front_walk_3":[6,73],"hand_sk_rei_dourado_back_idle":[44,64],"hand_sk_rei_dourado_back_walk_0":[44,64],"hand_sk_rei_dourado_back_walk_1":[45,64],"hand_sk_rei_dourado_back_walk_2":[44,64],"hand_sk_rei_dourado_back_walk_3":[45,64],"hand_sk_rei_dourado_side_idle":[38,67],"hand_sk_rei_dourado_side_walk_0":[41,67],"hand_sk_rei_dourado_side_walk_1":[39,67],"hand_sk_rei_dourado_side_walk_2":[38,67],"hand_sk_rei_dourado_side_walk_3":[39,68],"hand_sk_rei_dourado_side_walk_4":[41,68],"hand_sk_rei_dourado_side_walk_5":[39,68],"hand_sk_rei_dourado_side_walk_6":[37,68],"hand_sk_rei_dourado_side_walk_7":[39,67],"hand_sk_rei_mascarado_front_idle":[10,64],"hand_sk_rei_mascarado_front_walk_0":[10,64],"hand_sk_rei_mascarado_front_walk_1":[11,64],"hand_sk_rei_mascarado_front_walk_2":[10,64],"hand_sk_rei_mascarado_front_walk_3":[11,64],"hand_sk_rei_mascarado_back_idle":[36,64],"hand_sk_rei_mascarado_back_walk_0":[36,64],"hand_sk_rei_mascarado_back_walk_1":[37,62],"hand_sk_rei_mascarado_back_walk_2":[36,64],"hand_sk_rei_mascarado_back_walk_3":[37,63],"hand_sk_rei_mascarado_side_idle":[30,60],"hand_sk_rei_mascarado_side_walk_0":[30,61],"hand_sk_rei_mascarado_side_walk_1":[30,61],"hand_sk_rei_mascarado_side_walk_2":[30,60],"hand_sk_rei_mascarado_side_walk_3":[30,60],"hand_sk_rei_mascarado_side_walk_4":[29,61],"hand_sk_rei_mascarado_side_walk_5":[30,60],"hand_sk_rei_mascarado_side_walk_6":[30,59],"hand_sk_rei_mascarado_side_walk_7":[30,61],"hand_sk_samurai_front_idle":[10,61],"hand_sk_samurai_front_walk_0":[10,61],"hand_sk_samurai_front_walk_1":[11,61],"hand_sk_samurai_front_walk_2":[10,61],"hand_sk_samurai_front_walk_3":[11,61],"hand_sk_samurai_back_idle":[35,61],"hand_sk_samurai_back_walk_0":[35,61],"hand_sk_samurai_back_walk_1":[35,61],"hand_sk_samurai_back_walk_2":[35,61],"hand_sk_samurai_back_walk_3":[35,60],"hand_sk_samurai_side_idle":[26,65],"hand_sk_samurai_side_walk_0":[27,66],"hand_sk_samurai_side_walk_1":[26,65],"hand_sk_samurai_side_walk_2":[26,65],"hand_sk_samurai_side_walk_3":[26,65],"hand_sk_samurai_side_walk_4":[27,65],"hand_sk_samurai_side_walk_5":[26,65],"hand_sk_samurai_side_walk_6":[26,64],"hand_sk_samurai_side_walk_7":[26,65],"hand_sk_saqueador_front_idle":[9,59],"hand_sk_saqueador_front_walk_0":[9,59],"hand_sk_saqueador_front_walk_1":[9,58],"hand_sk_saqueador_front_walk_2":[9,59],"hand_sk_saqueador_front_walk_3":[9,58],"hand_sk_saqueador_back_idle":[42,57],"hand_sk_saqueador_back_walk_0":[42,57],"hand_sk_saqueador_back_walk_1":[44,56],"hand_sk_saqueador_back_walk_2":[42,57],"hand_sk_saqueador_back_walk_3":[44,57],"hand_sk_saqueador_side_idle":[22,60],"hand_sk_saqueador_side_walk_0":[22,61],"hand_sk_saqueador_side_walk_1":[22,61],"hand_sk_saqueador_side_walk_2":[22,60],"hand_sk_saqueador_side_walk_3":[21,60],"hand_sk_saqueador_side_walk_4":[22,60],"hand_sk_saqueador_side_walk_5":[21,60],"hand_sk_saqueador_side_walk_6":[21,59],"hand_sk_saqueador_side_walk_7":[22,61],"hand_sk_sombra_tatica_front_idle":[10,62],"hand_sk_sombra_tatica_front_walk_0":[10,62],"hand_sk_sombra_tatica_front_walk_1":[10,62],"hand_sk_sombra_tatica_front_walk_2":[10,62],"hand_sk_sombra_tatica_front_walk_3":[10,62],"hand_sk_sombra_tatica_back_idle":[41,61],"hand_sk_sombra_tatica_back_walk_0":[41,61],"hand_sk_sombra_tatica_back_walk_1":[41,61],"hand_sk_sombra_tatica_back_walk_2":[41,61],"hand_sk_sombra_tatica_back_walk_3":[41,60],"hand_sk_sombra_tatica_side_idle":[22,63],"hand_sk_sombra_tatica_side_walk_0":[23,64],"hand_sk_sombra_tatica_side_walk_1":[22,63],"hand_sk_sombra_tatica_side_walk_2":[22,63],"hand_sk_sombra_tatica_side_walk_3":[22,64],"hand_sk_sombra_tatica_side_walk_4":[22,64],"hand_sk_sombra_tatica_side_walk_5":[22,64],"hand_sk_sombra_tatica_side_walk_6":[21,63],"hand_sk_sombra_tatica_side_walk_7":[22,63],"hand_sk_vampiro_front_idle":[11,67],"hand_sk_vampiro_front_walk_0":[11,67],"hand_sk_vampiro_front_walk_1":[12,66],"hand_sk_vampiro_front_walk_2":[11,67],"hand_sk_vampiro_front_walk_3":[12,67],"hand_sk_vampiro_back_idle":[59,70],"hand_sk_vampiro_back_walk_0":[59,70],"hand_sk_vampiro_back_walk_1":[59,70],"hand_sk_vampiro_back_walk_2":[59,70],"hand_sk_vampiro_back_walk_3":[59,70],"hand_sk_vampiro_side_idle":[33,63],"hand_sk_vampiro_side_walk_0":[35,64],"hand_sk_vampiro_side_walk_1":[34,64],"hand_sk_vampiro_side_walk_2":[33,63],"hand_sk_vampiro_side_walk_3":[33,64],"hand_sk_vampiro_side_walk_4":[35,65],"hand_sk_vampiro_side_walk_5":[33,64],"hand_sk_vampiro_side_walk_6":[32,64],"hand_sk_vampiro_side_walk_7":[34,64],"head_menino_front_idle":[24,0,31],"head_menino_front_walk_0":[24,0,31],"head_menino_front_walk_1":[25,0,31],"head_menino_front_walk_2":[24,0,31],"head_menino_front_walk_3":[25,0,31],"head_menino_back_idle":[23,0,31],"head_menino_back_walk_0":[23,0,31],"head_menino_back_walk_1":[23,0,31],"head_menino_back_walk_2":[23,0,31],"head_menino_back_walk_3":[24,0,31],"head_menino_side_idle":[23,0,31],"head_menino_side_walk_0":[23,0,31],"head_menino_side_walk_1":[23,0,31],"head_menino_side_walk_2":[23,0,31],"head_menino_side_walk_3":[25,0,31],"head_menino_side_walk_4":[25,0,31],"head_menino_side_walk_5":[25,0,31],"head_menino_side_walk_6":[25,0,31],"head_menino_side_walk_7":[23,0,31],"head_menino_swing_front":[26,0,31],"head_menino_swing_up":[26,0,31],"head_menino_swing_side":[22,0,31],"head_menino_swing_front2":[26,0,31],"head_menino_swing_gesto_um_front":[26,0,31],"head_menino_swing_gesto_um_back":[26,0,31],"head_menino_swing_gesto_um_side":[22,0,31],"head_menino_swing_gesto_dois_side":[22,0,31],"head_menino_swing_gesto_dois_front":[32,0,31],"head_menino_swing_gesto_dois_back":[32,0,31],"head_menino_negro_front_idle":[24,0,31],"head_menino_negro_front_walk_0":[24,0,31],"head_menino_negro_front_walk_1":[25,0,31],"head_menino_negro_front_walk_2":[24,0,31],"head_menino_negro_front_walk_3":[25,0,31],"head_menino_negro_back_idle":[23,0,30],"head_menino_negro_back_walk_0":[23,0,30],"head_menino_negro_back_walk_1":[24,0,30],"head_menino_negro_back_walk_2":[23,0,30],"head_menino_negro_back_walk_3":[24,0,30],"head_menino_negro_side_idle":[26,0,30],"head_menino_negro_side_walk_0":[26,0,30],"head_menino_negro_side_walk_1":[26,0,30],"head_menino_negro_side_walk_2":[26,0,30],"head_menino_negro_side_walk_3":[31,0,30],"head_menino_negro_side_walk_4":[31,0,30],"head_menino_negro_side_walk_5":[31,0,30],"head_menino_negro_side_walk_6":[31,0,30],"head_menino_negro_side_walk_7":[26,0,30],"head_menino_negro_swing_front":[30,0,29],"head_menino_negro_swing_up":[25,0,29],"head_menino_negro_swing_side":[25,0,31],"head_menino_negro_swing_front2":[26,0,29],"head_menino_negro_swing_gesto_um_front":[30,0,29],"head_menino_negro_swing_gesto_um_back":[25,0,29],"head_menino_negro_swing_gesto_um_side":[25,0,31],"head_menino_negro_swing_gesto_dois_side":[25,0,31],"head_menino_negro_swing_gesto_dois_front":[31,0,30],"head_menino_negro_swing_gesto_dois_back":[33,0,30],"head_menina_ruiva_front_idle":[24,1,31],"head_menina_ruiva_front_walk_0":[24,1,31],"head_menina_ruiva_front_walk_1":[25,0,31],"head_menina_ruiva_front_walk_2":[24,1,31],"head_menina_ruiva_front_walk_3":[26,0,31],"head_menina_ruiva_back_idle":[22,0,30],"head_menina_ruiva_back_walk_0":[22,0,30],"head_menina_ruiva_back_walk_1":[23,0,30],"head_menina_ruiva_back_walk_2":[22,0,30],"head_menina_ruiva_back_walk_3":[23,0,30],"head_menina_ruiva_side_idle":[31,0,31],"head_menina_ruiva_side_walk_0":[31,0,31],"head_menina_ruiva_side_walk_1":[31,0,31],"head_menina_ruiva_side_walk_2":[31,0,31],"head_menina_ruiva_side_walk_3":[31,0,31],"head_menina_ruiva_side_walk_4":[31,0,31],"head_menina_ruiva_side_walk_5":[31,0,31],"head_menina_ruiva_side_walk_6":[31,0,31],"head_menina_ruiva_side_walk_7":[31,0,31],"head_menina_ruiva_swing_front":[30,0,29],"head_menina_ruiva_swing_up":[26,0,29],"head_menina_ruiva_swing_side":[33,0,31],"head_menina_ruiva_swing_front2":[26,0,28],"head_menina_ruiva_swing_gesto_um_front":[30,0,29],"head_menina_ruiva_swing_gesto_um_back":[26,0,29],"head_menina_ruiva_swing_gesto_um_side":[33,0,31],"head_menina_ruiva_swing_gesto_dois_side":[33,0,31],"head_menina_ruiva_swing_gesto_dois_front":[31,0,30],"head_menina_ruiva_swing_gesto_dois_back":[33,0,30],"head_menina_negra_front_idle":[30,2,31],"head_menina_negra_front_walk_0":[30,2,31],"head_menina_negra_front_walk_1":[30,2,31],"head_menina_negra_front_walk_2":[30,2,31],"head_menina_negra_front_walk_3":[30,1,31],"head_menina_negra_back_idle":[29,2,30],"head_menina_negra_back_walk_0":[29,2,30],"head_menina_negra_back_walk_1":[30,1,30],"head_menina_negra_back_walk_2":[29,2,30],"head_menina_negra_back_walk_3":[30,1,30],"head_menina_negra_side_idle":[24,0,30],"head_menina_negra_side_walk_0":[24,0,30],"head_menina_negra_side_walk_1":[24,0,30],"head_menina_negra_side_walk_2":[24,0,30],"head_menina_negra_side_walk_3":[24,1,30],"head_menina_negra_side_walk_4":[24,1,30],"head_menina_negra_side_walk_5":[24,1,30],"head_menina_negra_side_walk_6":[24,1,30],"head_menina_negra_side_walk_7":[24,0,30],"head_menina_negra_swing_front":[30,1,31],"head_menina_negra_swing_up":[28,0,31],"head_menina_negra_swing_side":[21,0,31],"head_menina_negra_swing_front2":[28,0,31],"head_menina_negra_swing_gesto_um_front":[30,1,31],"head_menina_negra_swing_gesto_um_back":[28,0,31],"head_menina_negra_swing_gesto_um_side":[21,0,31],"head_menina_negra_swing_gesto_dois_side":[21,0,31],"head_menina_negra_swing_gesto_dois_front":[32,1,31],"head_menina_negra_swing_gesto_dois_back":[32,0,31],"head_sk_aprendiz_front_idle":[31,0,31],"head_sk_aprendiz_front_walk_0":[31,0,31],"head_sk_aprendiz_front_walk_1":[31,0,31],"head_sk_aprendiz_front_walk_2":[31,0,31],"head_sk_aprendiz_front_walk_3":[31,0,31],"head_sk_aprendiz_back_idle":[28,0,30],"head_sk_aprendiz_back_walk_0":[28,0,30],"head_sk_aprendiz_back_walk_1":[29,0,30],"head_sk_aprendiz_back_walk_2":[28,0,30],"head_sk_aprendiz_back_walk_3":[29,0,30],"head_sk_aprendiz_side_idle":[24,0,29],"head_sk_aprendiz_side_walk_0":[24,0,29],"head_sk_aprendiz_side_walk_1":[24,0,29],"head_sk_aprendiz_side_walk_2":[24,0,29],"head_sk_aprendiz_side_walk_3":[25,0,29],"head_sk_aprendiz_side_walk_4":[25,0,29],"head_sk_aprendiz_side_walk_5":[25,0,29],"head_sk_aprendiz_side_walk_6":[25,0,29],"head_sk_aprendiz_side_walk_7":[24,0,29],"head_sk_aprendiz_swing_front":[35,2,29],"head_sk_aprendiz_swing_up":[34,1,29],"head_sk_aprendiz_swing_side":[21,0,29],"head_sk_aprendiz_swing_maos_side":[21,1,31],"head_sk_aprendiz_swing_aceno":[37,1,29],"head_sk_aprendiz_swing_gesto_dois_front":[35,2,29],"head_sk_aprendiz_swing_gesto_um_front":[35,2,29],"head_sk_aprendiz_swing_gesto_dois_back":[34,1,29],"head_sk_aprendiz_swing_gesto_um_back":[27,1,29],"head_sk_aprendiz_swing_gesto_dois_side":[21,1,31],"head_sk_aprendiz_swing_gesto_um_side":[37,1,29],"head_sk_armadura_estelar_front_idle":[30,1,30],"head_sk_armadura_estelar_front_walk_0":[30,1,30],"head_sk_armadura_estelar_front_walk_1":[30,1,29],"head_sk_armadura_estelar_front_walk_2":[30,1,30],"head_sk_armadura_estelar_front_walk_3":[30,1,29],"head_sk_armadura_estelar_back_idle":[29,1,29],"head_sk_armadura_estelar_back_walk_0":[29,1,29],"head_sk_armadura_estelar_back_walk_1":[30,1,28],"head_sk_armadura_estelar_back_walk_2":[29,1,29],"head_sk_armadura_estelar_back_walk_3":[31,1,29],"head_sk_armadura_estelar_side_idle":[26,1,29],"head_sk_armadura_estelar_side_walk_0":[26,1,29],"head_sk_armadura_estelar_side_walk_1":[26,1,29],"head_sk_armadura_estelar_side_walk_2":[26,1,29],"head_sk_armadura_estelar_side_walk_3":[25,1,29],"head_sk_armadura_estelar_side_walk_4":[25,1,29],"head_sk_armadura_estelar_side_walk_5":[25,1,29],"head_sk_armadura_estelar_side_walk_6":[25,1,29],"head_sk_armadura_estelar_side_walk_7":[26,1,29],"head_sk_armadura_estelar_swing_front":[34,3,27],"head_sk_armadura_estelar_swing_up":[33,3,29],"head_sk_armadura_estelar_swing_side":[20,1,29],"head_sk_armadura_estelar_swing_maos_side":[21,3,31],"head_sk_armadura_estelar_swing_aceno":[24,3,31],"head_sk_armadura_estelar_swing_gesto_dois_front":[34,3,27],"head_sk_armadura_estelar_swing_gesto_um_front":[34,3,27],"head_sk_armadura_estelar_swing_gesto_dois_back":[33,3,29],"head_sk_armadura_estelar_swing_gesto_um_back":[28,3,27],"head_sk_armadura_estelar_swing_gesto_dois_side":[21,3,31],"head_sk_armadura_estelar_swing_gesto_um_side":[24,3,31],"head_sk_arqueira_mata_front_idle":[23,0,14],"head_sk_arqueira_mata_front_walk_0":[23,0,14],"head_sk_arqueira_mata_front_walk_1":[23,0,14],"head_sk_arqueira_mata_front_walk_2":[23,0,14],"head_sk_arqueira_mata_front_walk_3":[23,0,13],"head_sk_arqueira_mata_back_idle":[24,0,19],"head_sk_arqueira_mata_back_walk_0":[24,0,19],"head_sk_arqueira_mata_back_walk_1":[24,0,19],"head_sk_arqueira_mata_back_walk_2":[24,0,19],"head_sk_arqueira_mata_back_walk_3":[25,0,18],"head_sk_arqueira_mata_side_idle":[21,0,20],"head_sk_arqueira_mata_side_walk_0":[22,1,20],"head_sk_arqueira_mata_side_walk_1":[21,0,20],"head_sk_arqueira_mata_side_walk_2":[21,0,20],"head_sk_arqueira_mata_side_walk_3":[21,0,20],"head_sk_arqueira_mata_side_walk_4":[22,1,20],"head_sk_arqueira_mata_side_walk_5":[21,0,20],"head_sk_arqueira_mata_side_walk_6":[21,0,20],"head_sk_arqueira_mata_side_walk_7":[21,0,20],"head_sk_arqueira_mata_swing_front":[37,4,24],"head_sk_arqueira_mata_swing_up":[35,3,23],"head_sk_arqueira_mata_swing_side":[22,1,20],"head_sk_arqueira_mata_swing_maos_side":[17,3,31],"head_sk_arqueira_mata_swing_gesto_dois_front":[37,4,24],"head_sk_arqueira_mata_swing_gesto_um_front":[30,3,12],"head_sk_arqueira_mata_swing_gesto_dois_back":[35,3,23],"head_sk_arqueira_mata_swing_gesto_um_back":[27,3,16],"head_sk_arqueira_mata_swing_gesto_dois_side":[37,4,24],"head_sk_arqueira_mata_swing_gesto_um_side":[30,3,12],"head_sk_arqueiro_mata_front_idle":[22,1,14],"head_sk_arqueiro_mata_front_walk_0":[22,1,14],"head_sk_arqueiro_mata_front_walk_1":[19,0,12],"head_sk_arqueiro_mata_front_walk_2":[22,1,14],"head_sk_arqueiro_mata_front_walk_3":[23,1,13],"head_sk_arqueiro_mata_back_idle":[24,0,18],"head_sk_arqueiro_mata_back_walk_0":[24,0,18],"head_sk_arqueiro_mata_back_walk_1":[24,0,19],"head_sk_arqueiro_mata_back_walk_2":[24,0,18],"head_sk_arqueiro_mata_back_walk_3":[24,0,17],"head_sk_arqueiro_mata_side_idle":[22,1,20],"head_sk_arqueiro_mata_side_walk_0":[21,1,19],"head_sk_arqueiro_mata_side_walk_1":[22,1,20],"head_sk_arqueiro_mata_side_walk_2":[22,1,20],"head_sk_arqueiro_mata_side_walk_3":[22,1,20],"head_sk_arqueiro_mata_side_walk_4":[22,1,20],"head_sk_arqueiro_mata_side_walk_5":[22,1,20],"head_sk_arqueiro_mata_side_walk_6":[22,1,20],"head_sk_arqueiro_mata_side_walk_7":[22,1,20],"head_sk_arqueiro_mata_swing_front":[35,3,23],"head_sk_arqueiro_mata_swing_up":[35,3,23],"head_sk_arqueiro_mata_swing_side":[21,1,19],"head_sk_arqueiro_mata_swing_maos_side":[22,3,31],"head_sk_arqueiro_mata_swing_gesto_dois_front":[35,3,23],"head_sk_arqueiro_mata_swing_gesto_um_front":[31,3,15],"head_sk_arqueiro_mata_swing_gesto_dois_back":[35,3,23],"head_sk_arqueiro_mata_swing_gesto_um_back":[27,3,16],"head_sk_arqueiro_mata_swing_gesto_dois_side":[35,3,23],"head_sk_arqueiro_mata_swing_gesto_um_side":[31,3,15],"head_sk_cacadora_front_idle":[26,0,19],"head_sk_cacadora_front_walk_0":[26,0,19],"head_sk_cacadora_front_walk_1":[25,0,19],"head_sk_cacadora_front_walk_2":[26,0,19],"head_sk_cacadora_front_walk_3":[25,0,19],"head_sk_cacadora_back_idle":[24,0,19],"head_sk_cacadora_back_walk_0":[24,0,19],"head_sk_cacadora_back_walk_1":[24,0,18],"head_sk_cacadora_back_walk_2":[24,0,19],"head_sk_cacadora_back_walk_3":[25,0,18],"head_sk_cacadora_side_idle":[28,0,20],"head_sk_cacadora_side_walk_0":[28,0,20],"head_sk_cacadora_side_walk_1":[28,0,20],"head_sk_cacadora_side_walk_2":[28,0,20],"head_sk_cacadora_side_walk_3":[27,0,21],"head_sk_cacadora_side_walk_4":[28,0,20],"head_sk_cacadora_side_walk_5":[27,0,21],"head_sk_cacadora_side_walk_6":[27,0,21],"head_sk_cacadora_side_walk_7":[28,0,20],"head_sk_cacadora_swing_front":[35,5,18],"head_sk_cacadora_swing_up":[34,5,18],"head_sk_cacadora_swing_side":[22,0,20],"head_sk_cacadora_swing_maos_side":[38,5,16],"head_sk_cacadora_swing_gesto_dois_front":[35,5,18],"head_sk_cacadora_swing_gesto_um_front":[35,5,20],"head_sk_cacadora_swing_gesto_dois_back":[34,5,18],"head_sk_cacadora_swing_gesto_um_back":[24,4,16],"head_sk_cacadora_swing_gesto_dois_side":[35,5,18],"head_sk_cacadora_swing_gesto_um_side":[35,5,20],"head_sk_cacique_front_idle":[24,0,25],"head_sk_cacique_front_walk_0":[24,0,25],"head_sk_cacique_front_walk_1":[25,0,26],"head_sk_cacique_front_walk_2":[24,0,25],"head_sk_cacique_front_walk_3":[25,0,25],"head_sk_cacique_back_idle":[24,0,21],"head_sk_cacique_back_walk_0":[24,0,21],"head_sk_cacique_back_walk_1":[24,0,21],"head_sk_cacique_back_walk_2":[24,0,21],"head_sk_cacique_back_walk_3":[25,0,22],"head_sk_cacique_side_idle":[17,0,26],"head_sk_cacique_side_walk_0":[17,0,25],"head_sk_cacique_side_walk_1":[17,0,26],"head_sk_cacique_side_walk_2":[17,0,26],"head_sk_cacique_side_walk_3":[17,0,25],"head_sk_cacique_side_walk_4":[17,0,25],"head_sk_cacique_side_walk_5":[17,0,25],"head_sk_cacique_side_walk_6":[17,0,25],"head_sk_cacique_side_walk_7":[17,0,26],"head_sk_cacique_swing_front":[35,0,23],"head_sk_cacique_swing_up":[35,0,24],"head_sk_cacique_swing_side":[17,0,26],"head_sk_cacique_swing_maos_side":[18,0,30],"head_sk_cacique_swing_gesto_dois_front":[35,0,23],"head_sk_cacique_swing_gesto_um_front":[34,0,22],"head_sk_cacique_swing_gesto_dois_back":[35,0,24],"head_sk_cacique_swing_gesto_um_back":[25,0,18],"head_sk_cacique_swing_gesto_dois_side":[35,0,23],"head_sk_cacique_swing_gesto_um_side":[34,0,22],"head_sk_carrasco_front_idle":[26,0,31],"head_sk_carrasco_front_walk_0":[26,0,31],"head_sk_carrasco_front_walk_1":[27,0,31],"head_sk_carrasco_front_walk_2":[26,0,31],"head_sk_carrasco_front_walk_3":[27,0,31],"head_sk_carrasco_back_idle":[34,0,25],"head_sk_carrasco_back_walk_0":[34,0,25],"head_sk_carrasco_back_walk_1":[33,0,24],"head_sk_carrasco_back_walk_2":[34,0,25],"head_sk_carrasco_back_walk_3":[33,0,24],"head_sk_carrasco_side_idle":[24,0,31],"head_sk_carrasco_side_walk_0":[24,0,31],"head_sk_carrasco_side_walk_1":[24,0,31],"head_sk_carrasco_side_walk_2":[24,0,31],"head_sk_carrasco_side_walk_3":[24,0,23],"head_sk_carrasco_side_walk_4":[24,0,23],"head_sk_carrasco_side_walk_5":[24,0,23],"head_sk_carrasco_side_walk_6":[24,0,23],"head_sk_carrasco_side_walk_7":[24,0,31],"head_sk_carrasco_swing_front":[40,4,25],"head_sk_carrasco_swing_up":[38,3,25],"head_sk_carrasco_swing_side":[23,0,31],"head_sk_carrasco_swing_maos_side":[31,4,33],"head_sk_carrasco_swing_gesto_dois_front":[40,4,25],"head_sk_carrasco_swing_gesto_um_front":[36,4,18],"head_sk_carrasco_swing_gesto_dois_back":[38,3,25],"head_sk_carrasco_swing_gesto_um_back":[32,3,15],"head_sk_carrasco_swing_gesto_dois_side":[40,4,25],"head_sk_carrasco_swing_gesto_um_side":[36,4,18],"head_sk_ceifador_front_idle":[27,0,15],"head_sk_ceifador_front_walk_0":[27,0,15],"head_sk_ceifador_front_walk_1":[27,0,15],"head_sk_ceifador_front_walk_2":[27,0,15],"head_sk_ceifador_front_walk_3":[28,0,16],"head_sk_ceifador_back_idle":[24,0,14],"head_sk_ceifador_back_walk_0":[24,0,14],"head_sk_ceifador_back_walk_1":[25,0,14],"head_sk_ceifador_back_walk_2":[24,0,14],"head_sk_ceifador_back_walk_3":[25,0,15],"head_sk_ceifador_side_idle":[29,0,18],"head_sk_ceifador_side_walk_0":[29,0,18],"head_sk_ceifador_side_walk_1":[29,0,18],"head_sk_ceifador_side_walk_2":[29,0,18],"head_sk_ceifador_side_walk_3":[28,0,18],"head_sk_ceifador_side_walk_4":[28,0,18],"head_sk_ceifador_side_walk_5":[28,0,18],"head_sk_ceifador_side_walk_6":[28,0,18],"head_sk_ceifador_side_walk_7":[29,0,18],"head_sk_ceifador_swing_front":[37,4,15],"head_sk_ceifador_swing_up":[35,2,15],"head_sk_ceifador_swing_side":[29,0,18],"head_sk_ceifador_swing_maos_side":[36,1,19],"head_sk_ceifador_swing_gesto_dois_front":[37,4,15],"head_sk_ceifador_swing_gesto_um_front":[34,4,15],"head_sk_ceifador_swing_gesto_dois_back":[35,2,15],"head_sk_ceifador_swing_gesto_um_back":[23,2,13],"head_sk_ceifador_swing_gesto_dois_side":[37,4,15],"head_sk_ceifador_swing_gesto_um_side":[34,4,15],"head_sk_ciberpiloto_front_idle":[30,0,16],"head_sk_ciberpiloto_front_walk_0":[30,0,16],"head_sk_ciberpiloto_front_walk_1":[30,0,16],"head_sk_ciberpiloto_front_walk_2":[30,0,16],"head_sk_ciberpiloto_front_walk_3":[30,0,16],"head_sk_ciberpiloto_back_idle":[24,0,14],"head_sk_ciberpiloto_back_walk_0":[24,0,14],"head_sk_ciberpiloto_back_walk_1":[24,0,14],"head_sk_ciberpiloto_back_walk_2":[24,0,14],"head_sk_ciberpiloto_back_walk_3":[24,0,14],"head_sk_ciberpiloto_side_idle":[19,0,26],"head_sk_ciberpiloto_side_walk_0":[19,0,26],"head_sk_ciberpiloto_side_walk_1":[19,0,26],"head_sk_ciberpiloto_side_walk_2":[19,0,26],"head_sk_ciberpiloto_side_walk_3":[19,0,26],"head_sk_ciberpiloto_side_walk_4":[19,0,26],"head_sk_ciberpiloto_side_walk_5":[19,0,26],"head_sk_ciberpiloto_side_walk_6":[19,0,26],"head_sk_ciberpiloto_side_walk_7":[19,0,26],"head_sk_ciberpiloto_swing_front":[34,4,18],"head_sk_ciberpiloto_swing_up":[34,5,15],"head_sk_ciberpiloto_swing_side":[19,0,26],"head_sk_ciberpiloto_swing_maos_side":[23,3,32],"head_sk_ciberpiloto_swing_gesto_dois_front":[34,4,18],"head_sk_ciberpiloto_swing_gesto_um_front":[34,4,18],"head_sk_ciberpiloto_swing_gesto_dois_back":[34,5,15],"head_sk_ciberpiloto_swing_gesto_um_back":[22,4,14],"head_sk_ciberpiloto_swing_gesto_dois_side":[34,4,18],"head_sk_ciberpiloto_swing_gesto_um_side":[34,4,18],"head_sk_cowboy_caveira_front_idle":[26,0,29],"head_sk_cowboy_caveira_front_walk_0":[26,0,29],"head_sk_cowboy_caveira_front_walk_1":[26,0,29],"head_sk_cowboy_caveira_front_walk_2":[26,0,29],"head_sk_cowboy_caveira_front_walk_3":[26,0,29],"head_sk_cowboy_caveira_back_idle":[23,0,29],"head_sk_cowboy_caveira_back_walk_0":[23,0,29],"head_sk_cowboy_caveira_back_walk_1":[23,0,29],"head_sk_cowboy_caveira_back_walk_2":[23,0,29],"head_sk_cowboy_caveira_back_walk_3":[24,0,28],"head_sk_cowboy_caveira_side_idle":[29,0,30],"head_sk_cowboy_caveira_side_walk_0":[29,0,30],"head_sk_cowboy_caveira_side_walk_1":[29,0,30],"head_sk_cowboy_caveira_side_walk_2":[29,0,30],"head_sk_cowboy_caveira_side_walk_3":[29,0,30],"head_sk_cowboy_caveira_side_walk_4":[29,0,30],"head_sk_cowboy_caveira_side_walk_5":[29,0,30],"head_sk_cowboy_caveira_side_walk_6":[29,0,30],"head_sk_cowboy_caveira_side_walk_7":[29,0,30],"head_sk_cowboy_caveira_swing_front":[36,5,14],"head_sk_cowboy_caveira_swing_up":[36,6,14],"head_sk_cowboy_caveira_swing_side":[29,0,30],"head_sk_cowboy_caveira_swing_maos_side":[32,2,16],"head_sk_cowboy_caveira_swing_gesto_dois_front":[36,5,14],"head_sk_cowboy_caveira_swing_gesto_um_front":[36,5,28],"head_sk_cowboy_caveira_swing_gesto_dois_back":[36,6,14],"head_sk_cowboy_caveira_swing_gesto_um_back":[23,6,28],"head_sk_cowboy_caveira_swing_gesto_dois_side":[36,5,14],"head_sk_cowboy_caveira_swing_gesto_um_side":[36,5,28],"head_sk_elfo_verde_front_idle":[30,0,30],"head_sk_elfo_verde_front_walk_0":[30,0,30],"head_sk_elfo_verde_front_walk_1":[29,0,31],"head_sk_elfo_verde_front_walk_2":[30,0,30],"head_sk_elfo_verde_front_walk_3":[30,0,31],"head_sk_elfo_verde_back_idle":[27,0,29],"head_sk_elfo_verde_back_walk_0":[27,0,29],"head_sk_elfo_verde_back_walk_1":[29,0,30],"head_sk_elfo_verde_back_walk_2":[27,0,29],"head_sk_elfo_verde_back_walk_3":[29,0,29],"head_sk_elfo_verde_side_idle":[26,0,29],"head_sk_elfo_verde_side_walk_0":[26,0,29],"head_sk_elfo_verde_side_walk_1":[26,0,29],"head_sk_elfo_verde_side_walk_2":[26,0,29],"head_sk_elfo_verde_side_walk_3":[26,0,29],"head_sk_elfo_verde_side_walk_4":[26,0,29],"head_sk_elfo_verde_side_walk_5":[26,0,29],"head_sk_elfo_verde_side_walk_6":[26,0,29],"head_sk_elfo_verde_side_walk_7":[26,0,29],"head_sk_elfo_verde_swing_front":[36,3,28],"head_sk_elfo_verde_swing_up":[34,3,28],"head_sk_elfo_verde_swing_side":[26,0,29],"head_sk_elfo_verde_swing_maos_side":[21,3,31],"head_sk_elfo_verde_swing_aceno":[37,0,29],"head_sk_elfo_verde_swing_gesto_dois_front":[36,3,28],"head_sk_elfo_verde_swing_gesto_um_front":[34,2,29],"head_sk_elfo_verde_swing_gesto_dois_back":[34,3,28],"head_sk_elfo_verde_swing_gesto_um_back":[27,2,28],"head_sk_elfo_verde_swing_gesto_dois_side":[21,3,31],"head_sk_elfo_verde_swing_gesto_um_side":[37,0,29],"head_sk_elfo_vermelho_front_idle":[30,0,29],"head_sk_elfo_vermelho_front_walk_0":[30,0,29],"head_sk_elfo_vermelho_front_walk_1":[29,0,31],"head_sk_elfo_vermelho_front_walk_2":[30,0,29],"head_sk_elfo_vermelho_front_walk_3":[29,0,31],"head_sk_elfo_vermelho_back_idle":[28,0,29],"head_sk_elfo_vermelho_back_walk_0":[28,0,29],"head_sk_elfo_vermelho_back_walk_1":[29,0,30],"head_sk_elfo_vermelho_back_walk_2":[28,0,29],"head_sk_elfo_vermelho_back_walk_3":[30,0,30],"head_sk_elfo_vermelho_side_idle":[26,0,29],"head_sk_elfo_vermelho_side_walk_0":[26,0,29],"head_sk_elfo_vermelho_side_walk_1":[26,0,29],"head_sk_elfo_vermelho_side_walk_2":[26,0,29],"head_sk_elfo_vermelho_side_walk_3":[26,0,29],"head_sk_elfo_vermelho_side_walk_4":[26,0,29],"head_sk_elfo_vermelho_side_walk_5":[26,0,29],"head_sk_elfo_vermelho_side_walk_6":[26,0,29],"head_sk_elfo_vermelho_side_walk_7":[26,0,29],"head_sk_elfo_vermelho_swing_front":[36,3,30],"head_sk_elfo_vermelho_swing_up":[34,3,29],"head_sk_elfo_vermelho_swing_side":[26,0,29],"head_sk_elfo_vermelho_swing_maos_side":[21,4,32],"head_sk_elfo_vermelho_swing_aceno":[37,0,29],"head_sk_elfo_vermelho_swing_gesto_dois_front":[36,3,30],"head_sk_elfo_vermelho_swing_gesto_um_front":[33,2,29],"head_sk_elfo_vermelho_swing_gesto_dois_back":[34,3,29],"head_sk_elfo_vermelho_swing_gesto_um_back":[28,2,28],"head_sk_elfo_vermelho_swing_gesto_dois_side":[21,4,32],"head_sk_elfo_vermelho_swing_gesto_um_side":[37,0,29],"head_sk_espectro_front_idle":[37,0,14],"head_sk_espectro_front_walk_0":[37,0,14],"head_sk_espectro_front_walk_1":[33,0,14],"head_sk_espectro_front_walk_2":[37,0,14],"head_sk_espectro_front_walk_3":[33,0,14],"head_sk_espectro_back_idle":[30,0,15],"head_sk_espectro_back_walk_0":[30,0,15],"head_sk_espectro_back_walk_1":[30,0,15],"head_sk_espectro_back_walk_2":[30,0,15],"head_sk_espectro_back_walk_3":[31,0,14],"head_sk_espectro_side_idle":[41,0,19],"head_sk_espectro_side_walk_0":[41,0,19],"head_sk_espectro_side_walk_1":[41,0,19],"head_sk_espectro_side_walk_2":[41,0,19],"head_sk_espectro_side_walk_3":[41,0,19],"head_sk_espectro_side_walk_4":[41,0,19],"head_sk_espectro_side_walk_5":[41,0,19],"head_sk_espectro_side_walk_6":[41,0,19],"head_sk_espectro_side_walk_7":[41,0,19],"head_sk_espectro_swing_front":[38,5,16],"head_sk_espectro_swing_up":[35,2,14],"head_sk_espectro_swing_side":[41,0,19],"head_sk_espectro_swing_maos_side":[25,1,13],"head_sk_espectro_swing_gesto_dois_front":[38,5,16],"head_sk_espectro_swing_gesto_um_front":[38,5,16],"head_sk_espectro_swing_gesto_dois_back":[35,2,14],"head_sk_espectro_swing_gesto_um_back":[35,2,14],"head_sk_espectro_swing_gesto_dois_side":[38,5,16],"head_sk_espectro_swing_gesto_um_side":[38,5,16],"head_sk_exploradora_front_idle":[27,0,25],"head_sk_exploradora_front_walk_0":[27,0,25],"head_sk_exploradora_front_walk_1":[27,0,25],"head_sk_exploradora_front_walk_2":[27,0,25],"head_sk_exploradora_front_walk_3":[27,0,25],"head_sk_exploradora_back_idle":[28,1,24],"head_sk_exploradora_back_walk_0":[28,1,24],"head_sk_exploradora_back_walk_1":[28,0,24],"head_sk_exploradora_back_walk_2":[28,1,24],"head_sk_exploradora_back_walk_3":[29,0,24],"head_sk_exploradora_side_idle":[22,0,26],"head_sk_exploradora_side_walk_0":[22,0,26],"head_sk_exploradora_side_walk_1":[22,0,26],"head_sk_exploradora_side_walk_2":[22,0,26],"head_sk_exploradora_side_walk_3":[22,0,25],"head_sk_exploradora_side_walk_4":[22,0,25],"head_sk_exploradora_side_walk_5":[22,0,25],"head_sk_exploradora_side_walk_6":[22,0,25],"head_sk_exploradora_side_walk_7":[22,0,26],"head_sk_exploradora_swing_front":[39,4,25],"head_sk_exploradora_swing_up":[38,4,25],"head_sk_exploradora_swing_side":[22,0,26],"head_sk_exploradora_swing_maos_side":[25,3,34],"head_sk_exploradora_swing_gesto_dois_front":[39,4,25],"head_sk_exploradora_swing_gesto_um_front":[34,3,17],"head_sk_exploradora_swing_gesto_dois_back":[38,4,25],"head_sk_exploradora_swing_gesto_um_back":[31,4,18],"head_sk_exploradora_swing_gesto_dois_side":[39,4,25],"head_sk_exploradora_swing_gesto_um_side":[34,3,17],"head_sk_guarda_azul_front_idle":[26,0,26],"head_sk_guarda_azul_front_walk_0":[26,0,26],"head_sk_guarda_azul_front_walk_1":[26,1,26],"head_sk_guarda_azul_front_walk_2":[26,0,26],"head_sk_guarda_azul_front_walk_3":[26,1,26],"head_sk_guarda_azul_back_idle":[26,0,26],"head_sk_guarda_azul_back_walk_0":[26,0,26],"head_sk_guarda_azul_back_walk_1":[26,0,26],"head_sk_guarda_azul_back_walk_2":[26,0,26],"head_sk_guarda_azul_back_walk_3":[26,0,26],"head_sk_guarda_azul_side_idle":[23,0,29],"head_sk_guarda_azul_side_walk_0":[23,0,28],"head_sk_guarda_azul_side_walk_1":[23,0,29],"head_sk_guarda_azul_side_walk_2":[23,0,29],"head_sk_guarda_azul_side_walk_3":[21,0,28],"head_sk_guarda_azul_side_walk_4":[21,1,29],"head_sk_guarda_azul_side_walk_5":[21,0,28],"head_sk_guarda_azul_side_walk_6":[21,0,28],"head_sk_guarda_azul_side_walk_7":[23,0,29],"head_sk_guarda_azul_swing_front":[36,0,25],"head_sk_guarda_azul_swing_up":[36,1,25],"head_sk_guarda_azul_swing_side":[21,1,29],"head_sk_guarda_azul_swing_maos_side":[32,4,26],"head_sk_guarda_azul_swing_gesto_dois_front":[36,0,25],"head_sk_guarda_azul_swing_gesto_um_front":[36,0,24],"head_sk_guarda_azul_swing_gesto_dois_back":[36,1,25],"head_sk_guarda_azul_swing_gesto_um_back":[27,0,22],"head_sk_guarda_azul_swing_gesto_dois_side":[36,0,25],"head_sk_guarda_azul_swing_gesto_um_side":[36,0,24],"head_sk_guardiao_cristal_front_idle":[26,0,22],"head_sk_guardiao_cristal_front_walk_0":[26,0,22],"head_sk_guardiao_cristal_front_walk_1":[25,0,21],"head_sk_guardiao_cristal_front_walk_2":[26,0,22],"head_sk_guardiao_cristal_front_walk_3":[25,0,21],"head_sk_guardiao_cristal_back_idle":[25,0,20],"head_sk_guardiao_cristal_back_walk_0":[25,0,20],"head_sk_guardiao_cristal_back_walk_1":[25,0,20],"head_sk_guardiao_cristal_back_walk_2":[25,0,20],"head_sk_guardiao_cristal_back_walk_3":[26,0,20],"head_sk_guardiao_cristal_side_idle":[21,0,21],"head_sk_guardiao_cristal_side_walk_0":[22,0,20],"head_sk_guardiao_cristal_side_walk_1":[21,0,21],"head_sk_guardiao_cristal_side_walk_2":[21,0,21],"head_sk_guardiao_cristal_side_walk_3":[22,0,21],"head_sk_guardiao_cristal_side_walk_4":[22,0,20],"head_sk_guardiao_cristal_side_walk_5":[22,0,21],"head_sk_guardiao_cristal_side_walk_6":[22,0,21],"head_sk_guardiao_cristal_side_walk_7":[21,0,21],"head_sk_guardiao_cristal_swing_front":[34,4,19],"head_sk_guardiao_cristal_swing_up":[33,4,19],"head_sk_guardiao_cristal_swing_side":[22,0,20],"head_sk_guardiao_cristal_swing_maos_side":[37,4,16],"head_sk_guardiao_cristal_swing_gesto_dois_front":[34,4,19],"head_sk_guardiao_cristal_swing_gesto_um_front":[34,4,20],"head_sk_guardiao_cristal_swing_gesto_dois_back":[33,4,19],"head_sk_guardiao_cristal_swing_gesto_um_back":[25,4,16],"head_sk_guardiao_cristal_swing_gesto_dois_side":[34,4,19],"head_sk_guardiao_cristal_swing_gesto_um_side":[34,4,20],"head_sk_guerreiro_tribal_front_idle":[24,0,15],"head_sk_guerreiro_tribal_front_walk_0":[24,0,15],"head_sk_guerreiro_tribal_front_walk_1":[24,0,15],"head_sk_guerreiro_tribal_front_walk_2":[24,0,15],"head_sk_guerreiro_tribal_front_walk_3":[25,0,14],"head_sk_guerreiro_tribal_back_idle":[24,0,15],"head_sk_guerreiro_tribal_back_walk_0":[24,0,15],"head_sk_guerreiro_tribal_back_walk_1":[24,0,15],"head_sk_guerreiro_tribal_back_walk_2":[24,0,15],"head_sk_guerreiro_tribal_back_walk_3":[25,0,15],"head_sk_guerreiro_tribal_side_idle":[17,0,26],"head_sk_guerreiro_tribal_side_walk_0":[17,0,26],"head_sk_guerreiro_tribal_side_walk_1":[17,0,26],"head_sk_guerreiro_tribal_side_walk_2":[17,0,26],"head_sk_guerreiro_tribal_side_walk_3":[17,0,26],"head_sk_guerreiro_tribal_side_walk_4":[17,0,26],"head_sk_guerreiro_tribal_side_walk_5":[17,0,26],"head_sk_guerreiro_tribal_side_walk_6":[17,0,26],"head_sk_guerreiro_tribal_side_walk_7":[17,0,26],"head_sk_guerreiro_tribal_swing_front":[35,3,23],"head_sk_guerreiro_tribal_swing_up":[34,3,23],"head_sk_guerreiro_tribal_swing_side":[16,0,25],"head_sk_guerreiro_tribal_swing_maos_side":[17,0,30],"head_sk_guerreiro_tribal_swing_gesto_dois_front":[35,3,23],"head_sk_guerreiro_tribal_swing_gesto_um_front":[33,3,19],"head_sk_guerreiro_tribal_swing_gesto_dois_back":[34,3,23],"head_sk_guerreiro_tribal_swing_gesto_um_back":[23,3,22],"head_sk_guerreiro_tribal_swing_gesto_dois_side":[35,3,23],"head_sk_guerreiro_tribal_swing_gesto_um_side":[33,3,19],"head_sk_husky_front_idle":[31,1,30],"head_sk_husky_front_walk_0":[31,1,30],"head_sk_husky_front_walk_1":[30,1,31],"head_sk_husky_front_walk_2":[31,1,30],"head_sk_husky_front_walk_3":[32,1,31],"head_sk_husky_back_idle":[28,1,30],"head_sk_husky_back_walk_0":[28,1,30],"head_sk_husky_back_walk_1":[29,1,30],"head_sk_husky_back_walk_2":[28,1,30],"head_sk_husky_back_walk_3":[29,1,30],"head_sk_husky_side_idle":[52,1,23],"head_sk_husky_side_walk_0":[52,1,22],"head_sk_husky_side_walk_1":[52,1,23],"head_sk_husky_side_walk_2":[52,1,23],"head_sk_husky_side_walk_3":[52,1,21],"head_sk_husky_side_walk_4":[52,1,21],"head_sk_husky_side_walk_5":[52,1,21],"head_sk_husky_side_walk_6":[52,1,21],"head_sk_husky_side_walk_7":[52,1,23],"head_sk_husky_swing_front":[34,1,25],"head_sk_husky_swing_up":[34,1,25],"head_sk_husky_swing_side":[39,1,22],"head_sk_husky_swing_maos_side":[19,1,30],"head_sk_husky_swing_aceno":[35,1,23],"head_sk_husky_swing_gesto_dois_front":[34,1,25],"head_sk_husky_swing_gesto_um_front":[34,2,30],"head_sk_husky_swing_gesto_dois_back":[34,1,25],"head_sk_husky_swing_gesto_um_back":[27,1,28],"head_sk_husky_swing_gesto_dois_side":[19,1,30],"head_sk_husky_swing_gesto_um_side":[35,1,23],"head_sk_maga_prata_front_idle":[29,0,28],"head_sk_maga_prata_front_walk_0":[29,0,28],"head_sk_maga_prata_front_walk_1":[30,0,27],"head_sk_maga_prata_front_walk_2":[29,0,28],"head_sk_maga_prata_front_walk_3":[31,0,26],"head_sk_maga_prata_back_idle":[27,0,27],"head_sk_maga_prata_back_walk_0":[27,0,27],"head_sk_maga_prata_back_walk_1":[29,0,27],"head_sk_maga_prata_back_walk_2":[27,0,27],"head_sk_maga_prata_back_walk_3":[30,0,26],"head_sk_maga_prata_side_idle":[26,0,29],"head_sk_maga_prata_side_walk_0":[26,0,29],"head_sk_maga_prata_side_walk_1":[26,0,29],"head_sk_maga_prata_side_walk_2":[26,0,29],"head_sk_maga_prata_side_walk_3":[27,0,28],"head_sk_maga_prata_side_walk_4":[27,0,28],"head_sk_maga_prata_side_walk_5":[27,0,28],"head_sk_maga_prata_side_walk_6":[27,0,28],"head_sk_maga_prata_side_walk_7":[26,0,29],"head_sk_maga_prata_swing_front":[36,3,28],"head_sk_maga_prata_swing_up":[35,3,26],"head_sk_maga_prata_swing_side":[26,0,29],"head_sk_maga_prata_swing_maos_side":[21,3,31],"head_sk_maga_prata_swing_aceno":[38,0,28],"head_sk_maga_prata_swing_gesto_dois_front":[36,3,28],"head_sk_maga_prata_swing_gesto_um_front":[33,2,29],"head_sk_maga_prata_swing_gesto_dois_back":[35,3,26],"head_sk_maga_prata_swing_gesto_um_back":[27,2,27],"head_sk_maga_prata_swing_gesto_dois_side":[21,3,31],"head_sk_maga_prata_swing_gesto_um_side":[38,0,28],"head_sk_mago_noturno_front_idle":[30,0,28],"head_sk_mago_noturno_front_walk_0":[30,0,28],"head_sk_mago_noturno_front_walk_1":[30,0,29],"head_sk_mago_noturno_front_walk_2":[30,0,28],"head_sk_mago_noturno_front_walk_3":[30,0,29],"head_sk_mago_noturno_back_idle":[28,0,28],"head_sk_mago_noturno_back_walk_0":[28,0,28],"head_sk_mago_noturno_back_walk_1":[30,0,27],"head_sk_mago_noturno_back_walk_2":[28,0,28],"head_sk_mago_noturno_back_walk_3":[31,0,26],"head_sk_mago_noturno_side_idle":[31,0,29],"head_sk_mago_noturno_side_walk_0":[31,0,29],"head_sk_mago_noturno_side_walk_1":[31,0,29],"head_sk_mago_noturno_side_walk_2":[31,0,29],"head_sk_mago_noturno_side_walk_3":[31,0,29],"head_sk_mago_noturno_side_walk_4":[31,0,29],"head_sk_mago_noturno_side_walk_5":[31,0,29],"head_sk_mago_noturno_side_walk_6":[31,0,29],"head_sk_mago_noturno_side_walk_7":[31,0,29],"head_sk_mago_noturno_swing_front":[35,2,28],"head_sk_mago_noturno_swing_up":[34,2,27],"head_sk_mago_noturno_swing_side":[31,0,29],"head_sk_mago_noturno_swing_maos_side":[21,2,31],"head_sk_mago_noturno_swing_aceno":[37,0,29],"head_sk_mago_noturno_swing_gesto_dois_front":[35,2,28],"head_sk_mago_noturno_swing_gesto_um_front":[33,1,29],"head_sk_mago_noturno_swing_gesto_dois_back":[34,2,27],"head_sk_mago_noturno_swing_gesto_um_back":[28,2,28],"head_sk_mago_noturno_swing_gesto_dois_side":[21,2,31],"head_sk_mago_noturno_swing_gesto_um_side":[37,0,29],"head_sk_mecanico_vermelho_front_idle":[25,0,25],"head_sk_mecanico_vermelho_front_walk_0":[25,0,25],"head_sk_mecanico_vermelho_front_walk_1":[25,0,25],"head_sk_mecanico_vermelho_front_walk_2":[25,0,25],"head_sk_mecanico_vermelho_front_walk_3":[27,0,26],"head_sk_mecanico_vermelho_back_idle":[25,0,25],"head_sk_mecanico_vermelho_back_walk_0":[25,0,25],"head_sk_mecanico_vermelho_back_walk_1":[25,0,25],"head_sk_mecanico_vermelho_back_walk_2":[25,0,25],"head_sk_mecanico_vermelho_back_walk_3":[25,0,25],"head_sk_mecanico_vermelho_side_idle":[23,0,28],"head_sk_mecanico_vermelho_side_walk_0":[23,0,27],"head_sk_mecanico_vermelho_side_walk_1":[23,0,28],"head_sk_mecanico_vermelho_side_walk_2":[23,0,28],"head_sk_mecanico_vermelho_side_walk_3":[21,0,27],"head_sk_mecanico_vermelho_side_walk_4":[21,0,27],"head_sk_mecanico_vermelho_side_walk_5":[21,0,27],"head_sk_mecanico_vermelho_side_walk_6":[21,0,27],"head_sk_mecanico_vermelho_side_walk_7":[23,0,28],"head_sk_mecanico_vermelho_swing_front":[36,0,24],"head_sk_mecanico_vermelho_swing_up":[36,0,24],"head_sk_mecanico_vermelho_swing_side":[20,0,27],"head_sk_mecanico_vermelho_swing_maos_side":[31,5,25],"head_sk_mecanico_vermelho_swing_gesto_dois_front":[36,0,24],"head_sk_mecanico_vermelho_swing_gesto_um_front":[35,0,23],"head_sk_mecanico_vermelho_swing_gesto_dois_back":[36,0,24],"head_sk_mecanico_vermelho_swing_gesto_um_back":[27,0,20],"head_sk_mecanico_vermelho_swing_gesto_dois_side":[36,0,24],"head_sk_mecanico_vermelho_swing_gesto_um_side":[35,0,23],"head_sk_pinguim_chapeu_front_idle":[34,1,26],"head_sk_pinguim_chapeu_front_walk_0":[34,1,26],"head_sk_pinguim_chapeu_front_walk_1":[34,1,26],"head_sk_pinguim_chapeu_front_walk_2":[34,1,26],"head_sk_pinguim_chapeu_front_walk_3":[34,2,25],"head_sk_pinguim_chapeu_back_idle":[30,2,25],"head_sk_pinguim_chapeu_back_walk_0":[30,2,25],"head_sk_pinguim_chapeu_back_walk_1":[31,1,26],"head_sk_pinguim_chapeu_back_walk_2":[30,2,25],"head_sk_pinguim_chapeu_back_walk_3":[31,1,25],"head_sk_pinguim_chapeu_side_idle":[31,1,26],"head_sk_pinguim_chapeu_side_walk_0":[31,1,26],"head_sk_pinguim_chapeu_side_walk_1":[31,1,26],"head_sk_pinguim_chapeu_side_walk_2":[31,1,26],"head_sk_pinguim_chapeu_side_walk_3":[29,1,27],"head_sk_pinguim_chapeu_side_walk_4":[29,1,26],"head_sk_pinguim_chapeu_side_walk_5":[29,1,27],"head_sk_pinguim_chapeu_side_walk_6":[29,1,27],"head_sk_pinguim_chapeu_side_walk_7":[31,1,26],"head_sk_pinguim_chapeu_swing_front":[35,1,24],"head_sk_pinguim_chapeu_swing_up":[35,2,24],"head_sk_pinguim_chapeu_swing_side":[27,1,25],"head_sk_pinguim_chapeu_swing_maos_side":[22,1,31],"head_sk_pinguim_chapeu_swing_aceno":[36,1,27],"head_sk_pinguim_chapeu_swing_gesto_dois_front":[35,1,24],"head_sk_pinguim_chapeu_swing_gesto_um_front":[33,0,23],"head_sk_pinguim_chapeu_swing_gesto_dois_back":[35,2,24],"head_sk_pinguim_chapeu_swing_gesto_um_back":[29,1,22],"head_sk_pinguim_chapeu_swing_gesto_dois_side":[22,1,31],"head_sk_pinguim_chapeu_swing_gesto_um_side":[36,1,27],"head_sk_pinguim_gravata_front_idle":[32,1,31],"head_sk_pinguim_gravata_front_walk_0":[32,1,31],"head_sk_pinguim_gravata_front_walk_1":[32,1,31],"head_sk_pinguim_gravata_front_walk_2":[32,1,31],"head_sk_pinguim_gravata_front_walk_3":[33,1,31],"head_sk_pinguim_gravata_back_idle":[30,1,30],"head_sk_pinguim_gravata_back_walk_0":[30,1,30],"head_sk_pinguim_gravata_back_walk_1":[29,1,30],"head_sk_pinguim_gravata_back_walk_2":[30,1,30],"head_sk_pinguim_gravata_back_walk_3":[31,1,30],"head_sk_pinguim_gravata_side_idle":[36,1,30],"head_sk_pinguim_gravata_side_walk_0":[36,1,30],"head_sk_pinguim_gravata_side_walk_1":[36,1,30],"head_sk_pinguim_gravata_side_walk_2":[36,1,30],"head_sk_pinguim_gravata_side_walk_3":[34,1,30],"head_sk_pinguim_gravata_side_walk_4":[34,1,30],"head_sk_pinguim_gravata_side_walk_5":[34,1,30],"head_sk_pinguim_gravata_side_walk_6":[34,1,30],"head_sk_pinguim_gravata_side_walk_7":[36,1,30],"head_sk_pinguim_gravata_swing_front":[34,3,29],"head_sk_pinguim_gravata_swing_up":[34,3,28],"head_sk_pinguim_gravata_swing_side":[29,1,30],"head_sk_pinguim_gravata_swing_maos_side":[24,3,31],"head_sk_pinguim_gravata_swing_aceno":[33,1,30],"head_sk_pinguim_gravata_swing_gesto_dois_front":[34,3,29],"head_sk_pinguim_gravata_swing_gesto_um_front":[33,1,31],"head_sk_pinguim_gravata_swing_gesto_dois_back":[34,3,28],"head_sk_pinguim_gravata_swing_gesto_um_back":[29,2,27],"head_sk_pinguim_gravata_swing_gesto_dois_side":[24,3,31],"head_sk_pinguim_gravata_swing_gesto_um_side":[33,1,30],"head_sk_pinguim_jaqueta_front_idle":[34,1,30],"head_sk_pinguim_jaqueta_front_walk_0":[34,1,30],"head_sk_pinguim_jaqueta_front_walk_1":[34,1,29],"head_sk_pinguim_jaqueta_front_walk_2":[34,1,30],"head_sk_pinguim_jaqueta_front_walk_3":[34,1,29],"head_sk_pinguim_jaqueta_back_idle":[29,1,25],"head_sk_pinguim_jaqueta_back_walk_0":[29,1,25],"head_sk_pinguim_jaqueta_back_walk_1":[29,1,27],"head_sk_pinguim_jaqueta_back_walk_2":[29,1,25],"head_sk_pinguim_jaqueta_back_walk_3":[30,1,27],"head_sk_pinguim_jaqueta_side_idle":[24,1,29],"head_sk_pinguim_jaqueta_side_walk_0":[24,1,29],"head_sk_pinguim_jaqueta_side_walk_1":[24,1,29],"head_sk_pinguim_jaqueta_side_walk_2":[24,1,29],"head_sk_pinguim_jaqueta_side_walk_3":[25,1,29],"head_sk_pinguim_jaqueta_side_walk_4":[25,1,29],"head_sk_pinguim_jaqueta_side_walk_5":[25,1,29],"head_sk_pinguim_jaqueta_side_walk_6":[25,1,29],"head_sk_pinguim_jaqueta_side_walk_7":[24,1,29],"head_sk_pinguim_jaqueta_swing_front":[35,1,26],"head_sk_pinguim_jaqueta_swing_up":[34,2,26],"head_sk_pinguim_jaqueta_swing_side":[23,1,29],"head_sk_pinguim_jaqueta_swing_maos_side":[19,2,31],"head_sk_pinguim_jaqueta_swing_aceno":[29,1,29],"head_sk_pinguim_jaqueta_swing_gesto_dois_front":[35,1,26],"head_sk_pinguim_jaqueta_swing_gesto_um_front":[33,0,27],"head_sk_pinguim_jaqueta_swing_gesto_dois_back":[34,2,26],"head_sk_pinguim_jaqueta_swing_gesto_um_back":[28,1,25],"head_sk_pinguim_jaqueta_swing_gesto_dois_side":[19,2,31],"head_sk_pinguim_jaqueta_swing_gesto_um_side":[29,1,29],"head_sk_pirata_front_idle":[27,0,31],"head_sk_pirata_front_walk_0":[27,0,31],"head_sk_pirata_front_walk_1":[28,0,31],"head_sk_pirata_front_walk_2":[27,0,31],"head_sk_pirata_front_walk_3":[29,0,31],"head_sk_pirata_back_idle":[27,0,30],"head_sk_pirata_back_walk_0":[27,0,30],"head_sk_pirata_back_walk_1":[26,1,30],"head_sk_pirata_back_walk_2":[27,0,30],"head_sk_pirata_back_walk_3":[26,1,30],"head_sk_pirata_side_idle":[36,0,25],"head_sk_pirata_side_walk_0":[37,1,24],"head_sk_pirata_side_walk_1":[36,0,25],"head_sk_pirata_side_walk_2":[36,0,25],"head_sk_pirata_side_walk_3":[35,0,25],"head_sk_pirata_side_walk_4":[35,0,25],"head_sk_pirata_side_walk_5":[35,0,25],"head_sk_pirata_side_walk_6":[35,0,25],"head_sk_pirata_side_walk_7":[36,0,25],"head_sk_pirata_swing_front":[35,2,21],"head_sk_pirata_swing_up":[34,4,22],"head_sk_pirata_swing_side":[19,1,23],"head_sk_pirata_swing_maos_side":[30,5,25],"head_sk_pirata_swing_gesto_dois_front":[35,2,21],"head_sk_pirata_swing_gesto_um_front":[34,2,32],"head_sk_pirata_swing_gesto_dois_back":[34,4,22],"head_sk_pirata_swing_gesto_um_back":[24,4,19],"head_sk_pirata_swing_gesto_dois_side":[35,2,21],"head_sk_pirata_swing_gesto_um_side":[34,2,32],"head_sk_pistoleira_front_idle":[32,0,26],"head_sk_pistoleira_front_walk_0":[32,0,26],"head_sk_pistoleira_front_walk_1":[31,0,25],"head_sk_pistoleira_front_walk_2":[32,0,26],"head_sk_pistoleira_front_walk_3":[31,0,25],"head_sk_pistoleira_back_idle":[33,2,25],"head_sk_pistoleira_back_walk_0":[33,2,25],"head_sk_pistoleira_back_walk_1":[35,1,24],"head_sk_pistoleira_back_walk_2":[33,2,25],"head_sk_pistoleira_back_walk_3":[35,1,24],"head_sk_pistoleira_side_idle":[30,0,20],"head_sk_pistoleira_side_walk_0":[30,0,20],"head_sk_pistoleira_side_walk_1":[30,0,20],"head_sk_pistoleira_side_walk_2":[30,0,20],"head_sk_pistoleira_side_walk_3":[30,0,20],"head_sk_pistoleira_side_walk_4":[30,0,20],"head_sk_pistoleira_side_walk_5":[30,0,20],"head_sk_pistoleira_side_walk_6":[30,0,20],"head_sk_pistoleira_side_walk_7":[30,0,20],"head_sk_pistoleira_swing_front":[37,5,23],"head_sk_pistoleira_swing_up":[35,5,22],"head_sk_pistoleira_swing_side":[29,0,19],"head_sk_pistoleira_swing_maos_side":[33,2,19],"head_sk_pistoleira_swing_gesto_dois_front":[37,5,23],"head_sk_pistoleira_swing_gesto_um_front":[37,5,23],"head_sk_pistoleira_swing_gesto_dois_back":[35,5,22],"head_sk_pistoleira_swing_gesto_um_back":[35,5,22],"head_sk_pistoleira_swing_gesto_dois_side":[37,5,23],"head_sk_pistoleira_swing_gesto_um_side":[37,5,23],"head_sk_policial_front_idle":[28,1,13],"head_sk_policial_front_walk_0":[28,1,13],"head_sk_policial_front_walk_1":[29,0,14],"head_sk_policial_front_walk_2":[28,1,13],"head_sk_policial_front_walk_3":[29,1,14],"head_sk_policial_back_idle":[23,0,13],"head_sk_policial_back_walk_0":[23,0,13],"head_sk_policial_back_walk_1":[24,0,14],"head_sk_policial_back_walk_2":[23,0,13],"head_sk_policial_back_walk_3":[24,1,13],"head_sk_policial_side_idle":[22,0,21],"head_sk_policial_side_walk_0":[22,0,21],"head_sk_policial_side_walk_1":[22,0,21],"head_sk_policial_side_walk_2":[22,0,21],"head_sk_policial_side_walk_3":[21,0,21],"head_sk_policial_side_walk_4":[22,0,20],"head_sk_policial_side_walk_5":[21,0,21],"head_sk_policial_side_walk_6":[21,0,21],"head_sk_policial_side_walk_7":[22,0,21],"head_sk_policial_swing_front":[35,5,14],"head_sk_policial_swing_up":[35,5,16],"head_sk_policial_swing_side":[22,0,21],"head_sk_policial_swing_maos_side":[23,3,32],"head_sk_policial_swing_gesto_dois_front":[35,5,14],"head_sk_policial_swing_gesto_um_front":[35,4,13],"head_sk_policial_swing_gesto_dois_back":[35,5,16],"head_sk_policial_swing_gesto_um_back":[23,5,14],"head_sk_policial_swing_gesto_dois_side":[35,5,14],"head_sk_policial_swing_gesto_um_side":[35,4,13],"head_sk_princesa_front_idle":[30,0,20],"head_sk_princesa_front_walk_0":[30,0,20],"head_sk_princesa_front_walk_1":[29,0,20],"head_sk_princesa_front_walk_2":[30,0,20],"head_sk_princesa_front_walk_3":[30,0,20],"head_sk_princesa_back_idle":[33,0,20],"head_sk_princesa_back_walk_0":[33,0,20],"head_sk_princesa_back_walk_1":[32,0,19],"head_sk_princesa_back_walk_2":[33,0,20],"head_sk_princesa_back_walk_3":[32,0,19],"head_sk_princesa_side_idle":[32,0,20],"head_sk_princesa_side_walk_0":[32,0,19],"head_sk_princesa_side_walk_1":[32,0,20],"head_sk_princesa_side_walk_2":[32,0,20],"head_sk_princesa_side_walk_3":[31,0,19],"head_sk_princesa_side_walk_4":[31,0,19],"head_sk_princesa_side_walk_5":[31,0,19],"head_sk_princesa_side_walk_6":[31,0,19],"head_sk_princesa_side_walk_7":[32,0,20],"head_sk_princesa_swing_front":[35,2,21],"head_sk_princesa_swing_up":[34,2,20],"head_sk_princesa_swing_side":[31,1,20],"head_sk_princesa_swing_maos_side":[30,4,25],"head_sk_princesa_swing_gesto_dois_front":[35,2,21],"head_sk_princesa_swing_gesto_um_front":[35,1,20],"head_sk_princesa_swing_gesto_dois_back":[34,2,20],"head_sk_princesa_swing_gesto_um_back":[31,3,17],"head_sk_princesa_swing_gesto_dois_side":[35,2,21],"head_sk_princesa_swing_gesto_um_side":[35,1,20],"head_sk_raposa_front_idle":[36,0,31],"head_sk_raposa_front_walk_0":[36,0,31],"head_sk_raposa_front_walk_1":[36,0,31],"head_sk_raposa_front_walk_2":[36,0,31],"head_sk_raposa_front_walk_3":[36,0,31],"head_sk_raposa_back_idle":[30,1,30],"head_sk_raposa_back_walk_0":[30,1,30],"head_sk_raposa_back_walk_1":[33,1,30],"head_sk_raposa_back_walk_2":[30,1,30],"head_sk_raposa_back_walk_3":[34,1,30],"head_sk_raposa_side_idle":[44,0,21],"head_sk_raposa_side_walk_0":[44,0,21],"head_sk_raposa_side_walk_1":[44,0,21],"head_sk_raposa_side_walk_2":[44,0,21],"head_sk_raposa_side_walk_3":[44,0,21],"head_sk_raposa_side_walk_4":[44,0,21],"head_sk_raposa_side_walk_5":[44,0,21],"head_sk_raposa_side_walk_6":[44,0,21],"head_sk_raposa_side_walk_7":[44,0,21],"head_sk_raposa_swing_front":[36,0,32],"head_sk_raposa_swing_up":[35,0,32],"head_sk_raposa_swing_side":[44,0,21],"head_sk_raposa_swing_maos_side":[34,0,33],"head_sk_raposa_swing_aceno":[39,0,32],"head_sk_raposa_swing_gesto_dois_front":[36,0,32],"head_sk_raposa_swing_gesto_um_front":[27,0,21],"head_sk_raposa_swing_gesto_dois_back":[35,0,32],"head_sk_raposa_swing_gesto_um_back":[38,0,20],"head_sk_raposa_swing_gesto_dois_side":[34,0,33],"head_sk_raposa_swing_gesto_um_side":[39,0,32],"head_sk_rei_dourado_front_idle":[30,0,14],"head_sk_rei_dourado_front_walk_0":[30,0,14],"head_sk_rei_dourado_front_walk_1":[30,0,15],"head_sk_rei_dourado_front_walk_2":[30,0,14],"head_sk_rei_dourado_front_walk_3":[31,0,14],"head_sk_rei_dourado_back_idle":[30,0,14],"head_sk_rei_dourado_back_walk_0":[30,0,14],"head_sk_rei_dourado_back_walk_1":[30,0,14],"head_sk_rei_dourado_back_walk_2":[30,0,14],"head_sk_rei_dourado_back_walk_3":[30,0,15],"head_sk_rei_dourado_side_idle":[33,0,17],"head_sk_rei_dourado_side_walk_0":[33,0,17],"head_sk_rei_dourado_side_walk_1":[33,0,17],"head_sk_rei_dourado_side_walk_2":[33,0,17],"head_sk_rei_dourado_side_walk_3":[34,0,16],"head_sk_rei_dourado_side_walk_4":[34,1,16],"head_sk_rei_dourado_side_walk_5":[34,0,16],"head_sk_rei_dourado_side_walk_6":[34,0,16],"head_sk_rei_dourado_side_walk_7":[33,0,17],"head_sk_rei_dourado_swing_front":[36,5,15],"head_sk_rei_dourado_swing_up":[35,5,15],"head_sk_rei_dourado_swing_side":[33,0,17],"head_sk_rei_dourado_swing_maos_side":[37,5,16],"head_sk_rei_dourado_swing_gesto_dois_front":[36,5,15],"head_sk_rei_dourado_swing_gesto_um_front":[35,5,15],"head_sk_rei_dourado_swing_gesto_dois_back":[35,5,15],"head_sk_rei_dourado_swing_gesto_um_back":[29,5,14],"head_sk_rei_dourado_swing_gesto_dois_side":[36,5,15],"head_sk_rei_dourado_swing_gesto_um_side":[35,5,15],"head_sk_rei_mascarado_front_idle":[29,0,15],"head_sk_rei_mascarado_front_walk_0":[29,0,15],"head_sk_rei_mascarado_front_walk_1":[30,0,16],"head_sk_rei_mascarado_front_walk_2":[29,0,15],"head_sk_rei_mascarado_front_walk_3":[29,0,15],"head_sk_rei_mascarado_back_idle":[23,1,14],"head_sk_rei_mascarado_back_walk_0":[23,1,14],"head_sk_rei_mascarado_back_walk_1":[23,0,15],"head_sk_rei_mascarado_back_walk_2":[23,1,14],"head_sk_rei_mascarado_back_walk_3":[24,0,14],"head_sk_rei_mascarado_side_idle":[30,0,17],"head_sk_rei_mascarado_side_walk_0":[30,0,17],"head_sk_rei_mascarado_side_walk_1":[30,0,17],"head_sk_rei_mascarado_side_walk_2":[30,0,17],"head_sk_rei_mascarado_side_walk_3":[30,0,17],"head_sk_rei_mascarado_side_walk_4":[30,0,17],"head_sk_rei_mascarado_side_walk_5":[30,0,17],"head_sk_rei_mascarado_side_walk_6":[30,0,17],"head_sk_rei_mascarado_side_walk_7":[30,0,17],"head_sk_rei_mascarado_swing_front":[36,5,15],"head_sk_rei_mascarado_swing_up":[35,5,15],"head_sk_rei_mascarado_swing_side":[30,0,16],"head_sk_rei_mascarado_swing_maos_side":[38,4,16],"head_sk_rei_mascarado_swing_gesto_dois_front":[36,5,15],"head_sk_rei_mascarado_swing_gesto_um_front":[37,5,16],"head_sk_rei_mascarado_swing_gesto_dois_back":[35,5,15],"head_sk_rei_mascarado_swing_gesto_um_back":[23,5,15],"head_sk_rei_mascarado_swing_gesto_dois_side":[36,5,15],"head_sk_rei_mascarado_swing_gesto_um_side":[37,5,16],"head_sk_samurai_front_idle":[23,0,14],"head_sk_samurai_front_walk_0":[23,0,14],"head_sk_samurai_front_walk_1":[24,0,14],"head_sk_samurai_front_walk_2":[23,0,14],"head_sk_samurai_front_walk_3":[24,0,14],"head_sk_samurai_back_idle":[23,0,20],"head_sk_samurai_back_walk_0":[23,0,20],"head_sk_samurai_back_walk_1":[23,0,18],"head_sk_samurai_back_walk_2":[23,0,20],"head_sk_samurai_back_walk_3":[23,0,18],"head_sk_samurai_side_idle":[23,0,17],"head_sk_samurai_side_walk_0":[23,0,17],"head_sk_samurai_side_walk_1":[23,0,17],"head_sk_samurai_side_walk_2":[23,0,17],"head_sk_samurai_side_walk_3":[23,0,17],"head_sk_samurai_side_walk_4":[23,0,17],"head_sk_samurai_side_walk_5":[23,0,17],"head_sk_samurai_side_walk_6":[23,0,17],"head_sk_samurai_side_walk_7":[23,0,17],"head_sk_samurai_swing_front":[35,6,15],"head_sk_samurai_swing_up":[34,6,16],"head_sk_samurai_swing_side":[23,0,17],"head_sk_samurai_swing_maos_side":[18,0,13],"head_sk_samurai_swing_gesto_dois_front":[35,6,15],"head_sk_samurai_swing_gesto_um_front":[35,6,18],"head_sk_samurai_swing_gesto_dois_back":[34,6,16],"head_sk_samurai_swing_gesto_um_back":[24,6,14],"head_sk_samurai_swing_gesto_dois_side":[35,6,15],"head_sk_samurai_swing_gesto_um_side":[35,6,18],"head_sk_saqueador_front_idle":[27,0,19],"head_sk_saqueador_front_walk_0":[27,0,19],"head_sk_saqueador_front_walk_1":[27,1,18],"head_sk_saqueador_front_walk_2":[27,0,19],"head_sk_saqueador_front_walk_3":[27,1,18],"head_sk_saqueador_back_idle":[29,0,18],"head_sk_saqueador_back_walk_0":[29,0,18],"head_sk_saqueador_back_walk_1":[29,0,18],"head_sk_saqueador_back_walk_2":[29,0,18],"head_sk_saqueador_back_walk_3":[29,0,18],"head_sk_saqueador_side_idle":[19,0,20],"head_sk_saqueador_side_walk_0":[20,1,20],"head_sk_saqueador_side_walk_1":[19,0,20],"head_sk_saqueador_side_walk_2":[19,0,20],"head_sk_saqueador_side_walk_3":[19,0,20],"head_sk_saqueador_side_walk_4":[20,1,20],"head_sk_saqueador_side_walk_5":[19,0,20],"head_sk_saqueador_side_walk_6":[19,0,20],"head_sk_saqueador_side_walk_7":[19,0,20],"head_sk_saqueador_swing_front":[35,1,20],"head_sk_saqueador_swing_up":[33,4,17],"head_sk_saqueador_swing_side":[19,1,21],"head_sk_saqueador_swing_maos_side":[30,5,24],"head_sk_saqueador_swing_gesto_dois_front":[35,1,20],"head_sk_saqueador_swing_gesto_um_front":[32,1,20],"head_sk_saqueador_swing_gesto_dois_back":[33,4,17],"head_sk_saqueador_swing_gesto_um_back":[24,6,18],"head_sk_saqueador_swing_gesto_dois_side":[35,1,20],"head_sk_saqueador_swing_gesto_um_side":[32,1,20],"head_sk_sombra_tatica_front_idle":[26,0,26],"head_sk_sombra_tatica_front_walk_0":[26,0,26],"head_sk_sombra_tatica_front_walk_1":[25,0,25],"head_sk_sombra_tatica_front_walk_2":[26,0,26],"head_sk_sombra_tatica_front_walk_3":[26,0,26],"head_sk_sombra_tatica_back_idle":[25,0,25],"head_sk_sombra_tatica_back_walk_0":[25,0,25],"head_sk_sombra_tatica_back_walk_1":[25,0,25],"head_sk_sombra_tatica_back_walk_2":[25,0,25],"head_sk_sombra_tatica_back_walk_3":[26,0,26],"head_sk_sombra_tatica_side_idle":[20,0,27],"head_sk_sombra_tatica_side_walk_0":[20,0,27],"head_sk_sombra_tatica_side_walk_1":[20,0,27],"head_sk_sombra_tatica_side_walk_2":[20,0,27],"head_sk_sombra_tatica_side_walk_3":[20,0,26],"head_sk_sombra_tatica_side_walk_4":[20,0,26],"head_sk_sombra_tatica_side_walk_5":[20,0,26],"head_sk_sombra_tatica_side_walk_6":[20,0,26],"head_sk_sombra_tatica_side_walk_7":[20,0,27],"head_sk_sombra_tatica_swing_front":[36,0,24],"head_sk_sombra_tatica_swing_up":[36,0,23],"head_sk_sombra_tatica_swing_side":[20,0,26],"head_sk_sombra_tatica_swing_maos_side":[31,6,25],"head_sk_sombra_tatica_swing_gesto_dois_front":[36,0,24],"head_sk_sombra_tatica_swing_gesto_um_front":[35,0,23],"head_sk_sombra_tatica_swing_gesto_dois_back":[36,0,23],"head_sk_sombra_tatica_swing_gesto_um_back":[26,0,20],"head_sk_sombra_tatica_swing_gesto_dois_side":[36,0,24],"head_sk_sombra_tatica_swing_gesto_um_side":[35,0,23],"head_sk_vampiro_front_idle":[33,0,28],"head_sk_vampiro_front_walk_0":[33,0,28],"head_sk_vampiro_front_walk_1":[32,0,28],"head_sk_vampiro_front_walk_2":[33,0,28],"head_sk_vampiro_front_walk_3":[33,0,28],"head_sk_vampiro_back_idle":[33,0,29],"head_sk_vampiro_back_walk_0":[33,0,29],"head_sk_vampiro_back_walk_1":[33,0,28],"head_sk_vampiro_back_walk_2":[33,0,29],"head_sk_vampiro_back_walk_3":[33,0,28],"head_sk_vampiro_side_idle":[33,0,29],"head_sk_vampiro_side_walk_0":[33,0,29],"head_sk_vampiro_side_walk_1":[33,0,29],"head_sk_vampiro_side_walk_2":[33,0,29],"head_sk_vampiro_side_walk_3":[34,0,29],"head_sk_vampiro_side_walk_4":[34,0,29],"head_sk_vampiro_side_walk_5":[34,0,29],"head_sk_vampiro_side_walk_6":[34,0,29],"head_sk_vampiro_side_walk_7":[33,0,29],"head_sk_vampiro_swing_front":[40,2,27],"head_sk_vampiro_swing_up":[40,2,27],"head_sk_vampiro_swing_side":[33,0,29],"head_sk_vampiro_swing_maos_side":[33,0,31],"head_sk_vampiro_swing_aceno":[34,1,31],"head_sk_vampiro_swing_gesto_dois_front":[40,2,27],"head_sk_vampiro_swing_gesto_um_front":[33,2,29],"head_sk_vampiro_swing_gesto_dois_back":[40,2,27],"head_sk_vampiro_swing_gesto_um_back":[33,0,29],"head_sk_vampiro_swing_gesto_dois_side":[33,0,31],"head_sk_vampiro_swing_gesto_um_side":[34,1,31],"grip_picareta":[14.7,38.7,46.5,6.5,6.6,46.6],"grip_machado":[12.9,34.5,49.3,6.1,6.1,44.9],"grip_enxada":[31.0,14.0,10.2,50.4,39.1,6.4],"grip_espada":[16.7,37.8,52.8,0.8,7.2,47.8],"grip_rede":[14.5,38.1,48.5,5.4,6.2,46.9]}/*FIM_ATLAS*/;
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
  const ATLAS2 = /*ATLAS2_MAP*/{"forte_muralha_chao":[0,0,760,651],"forte_muralha_fundo":[762,0,760,651],"forte_muralha_frente":[1524,0,760,651],"forte_forte_cidade_fundo":[2286,0,760,384],"forte_forte_cidade_frente":[3048,0,760,384],"forte_colonia_fundo":[0,653,760,378],"forte_colonia_frente":[762,653,760,378],"forte_forte_fundo":[1524,653,760,354],"forte_forte_frente":[2286,653,760,354],"forte_campo_fundo":[3048,653,760,341],"forte_campo_frente":[0,1033,760,341],"casa_cabana":[762,1033,340,310],"casa_cabana_chao":[1104,1033,340,310],"casa_saloon":[1446,1033,340,304],"casa_saloon_chao":[1788,1033,340,304],"casa_pedra":[2130,1033,340,302],"casa_pedra_chao":[2472,1033,340,302],"casa_castelo":[2814,1033,340,295],"casa_castelo_chao":[3156,1033,340,295],"casa_tribal":[3498,1033,340,289],"casa_tribal_chao":[0,1376,340,289],"casa_castelo_dentro":[342,1376,340,278],"casa_castelo_dentro_chao":[684,1376,340,278],"casa_tribal_dentro":[1026,1376,340,275],"casa_tribal_dentro_chao":[1368,1376,340,275],"casa_cabana_dentro":[1710,1376,340,274],"casa_cabana_dentro_chao":[2052,1376,340,274],"casa_saloon_dentro":[2394,1376,340,274],"casa_saloon_dentro_chao":[2736,1376,340,274],"casa_domo":[3078,1376,340,268],"casa_domo_chao":[3420,1376,340,268],"casa_domo_dentro":[0,1667,340,268],"casa_domo_dentro_chao":[342,1667,340,268],"casa_pedra_dentro":[684,1667,340,260],"casa_pedra_dentro_chao":[1026,1667,340,260],"casa_choupana":[1368,1667,300,234],"torre_madeira":[1670,1667,119,203],"torre_cristal":[1791,1667,114,203],"torre_pedra":[1907,1667,117,198],"torre_balista_cristal":[2026,1667,113,196],"torre_canhao":[2141,1667,137,188],"torre_balista":[2280,1667,131,185],"iso_estante":[2413,1667,78,155],"iso_cama_dossel":[2493,1667,138,154],"forte_muralha":[2633,1667,180,154],"iso_guarda_roupa":[2815,1667,83,145],"iso_geladeira":[2900,1667,82,143],"iso_espelho":[2984,1667,70,137],"catapulta_0":[3056,1667,150,135],"catapulta_1":[3208,1667,150,135],"catapulta_2":[3360,1667,150,135],"catapulta_3":[3512,1667,150,135],"iso_luminaria":[3664,1667,82,134],"iso_aquario":[3748,1667,88,134],"movel_cama_dossel":[3838,1667,126,132],"cristal_claro":[3966,1667,103,131],"iso_cama_casal":[0,1937,150,130],"cristal_roxo":[152,1937,103,129],"iso_fogao":[257,1937,97,125],"catapulta_ferro":[356,1937,161,124],"iso_lareira":[519,1937,113,122],"iso_mesa":[634,1937,144,119],"iso_cofre":[780,1937,91,117],"movel_lareira":[873,1937,63,117],"iso_sofa":[938,1937,136,116],"muro_madeira_v":[1076,1937,31,112],"iso_pia":[1109,1937,153,111],"muro_tijolo_aberto":[1264,1937,85,111],"movel_fogao":[1351,1937,64,111],"iso_cama":[1417,1937,125,110],"iso_cadeira":[1544,1937,58,109],"iso_planta":[1604,1937,64,106],"iso_poltrona":[1670,1937,99,105],"movel_cama_casal":[1771,1937,126,105],"iso_barril":[1899,1937,71,104],"espinhos":[1972,1937,120,103],"muro_tijolo_v":[2094,1937,30,100],"movel_capsula":[2126,1937,112,100],"muro_pedra_v":[2240,1937,29,99],"iso_bau":[2271,1937,95,98],"movel_cama":[2368,1937,102,95],"iso_mesinha":[2472,1937,124,93],"muro_madeira_aberto":[2598,1937,88,93],"muro_pedra_aberto":[2688,1937,88,93],"iso_criado":[2778,1937,67,92],"forte_forte_cidade":[2847,1937,180,91],"forte_colonia":[3029,1937,180,90],"iso_quadro":[3211,1937,64,87],"muro_tijolo_portao":[3277,1937,75,87],"muro_fortaleza_v":[3354,1937,31,87],"movel_fogueira":[3387,1937,68,85],"muro_fortaleza_aberto":[3457,1937,90,84],"forte_forte":[3549,1937,180,84],"muro_madeira_h":[3731,1937,96,82],"forte_campo":[3829,1937,180,81],"movel_cofre":[4011,1937,63,78],"muro_madeira_portao":[0,2069,76,77],"muro_fortaleza_portao":[78,2069,79,75],"movel_mesa":[159,2069,90,74],"muro_ferro_aberto":[251,2069,87,73],"movel_cesto":[340,2069,70,73],"iso_tapete":[412,2069,132,72],"movel_bau_ferro":[546,2069,66,72],"muro_pedra_portao":[614,2069,80,71],"muro_ferro_v":[696,2069,31,71],"movel_bau":[729,2069,66,64],"catapulta_impacto":[797,2069,86,63],"muro_pedra_h":[885,2069,96,63],"muro_ferro_portao":[983,2069,75,62],"movel_banco":[1060,2069,81,62],"movel_mesa_redonda":[1143,2069,72,58],"muro_tijolo_h":[1217,2069,96,56],"muro_fortaleza_h":[1315,2069,96,56],"muro_ferro_h":[1413,2069,96,55],"catapulta_pilha":[1511,2069,62,42],"catapulta_pedra":[1575,2069,30,29]}/*FIM_ATLAS2*/;
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
  let wavePatA = null, wavePatB = null, waterTex = null, deepTex = null;
  function waterPatterns() {
    if (!waterTex && artRect('water_tex')) {   // textura pintada (do atlas)
      const r = ATLAS.water_tex, cv = document.createElement('canvas');
      cv.width = r[2]; cv.height = r[3];
      cv.getContext('2d').drawImage(art, r[0], r[1], r[2], r[3], 0, 0, r[2], r[3]);
      waterTex = ctx.createPattern(cv, 'repeat');
      const r2 = ATLAS.water_deep_tex;
      if (r2) { const c2 = document.createElement('canvas'); c2.width = r2[2]; c2.height = r2[3]; c2.getContext('2d').drawImage(art, r2[0], r2[1], r2[2], r2[3], 0, 0, r2[2], r2[3]); deepTex = ctx.createPattern(c2, 'repeat'); }
    }
    if (!wavePatA) {
      wavePatA = ctx.createPattern(makeWaveTex(11, true), 'repeat');
      wavePatB = ctx.createPattern(makeWaveTex(29, false), 'repeat');
    }
  }
  // toda a água visível de uma vez: poucas pinturas grandes em vez de várias por bloco
  function drawWaterAll(L, z, now, camX, camY) {
    if (!L.length) return;
    const u = tp / 16, n = L.length;
    waterPatterns();
    const COR = ['rgb(52,150,170)', 'rgb(40,120,150)', 'rgb(24,70,115)'];
    let bx0 = 1e9, by0 = 1e9, bx1 = -1e9, by1 = -1e9;
    for (let b = 0; b < 3; b++) {
      ctx.beginPath(); let any = false;
      for (let k = 0; k < n; k += 5) { const lv = L[k + 4], bk = lv < 5 ? 0 : lv < 9 ? 1 : 2; if (bk === b) { ctx.rect(L[k + 2], L[k + 3], tp + 1, tp + 1); any = true; } }
      if (any) { ctx.fillStyle = COR[b]; ctx.fill(); }
    }
    ctx.save(); ctx.beginPath();
    for (let k = 0; k < n; k += 5) {
      const sx = L[k + 2], sy = L[k + 3]; ctx.rect(sx, sy, tp + 1, tp + 1);
      if (sx < bx0) bx0 = sx; if (sy < by0) by0 = sy; if (sx > bx1) bx1 = sx; if (sy > by1) by1 = sy;
    }
    ctx.clip();
    const bw = bx1 - bx0 + tp + 1, bh = by1 - by0 + tp + 1, t = now / 1000;
    if (waterTex) {
      const sc = 4 * tp / 256;
      waterTex.setTransform(new DOMMatrix([sc, 0, 0, sc, -camX + 5 * t * u, -camY + 2 * t * u]));
      ctx.fillStyle = waterTex; ctx.fillRect(bx0, by0, bw, bh);
      waterTex.setTransform(new DOMMatrix([-sc * 1.3, 0, 0, sc * 1.3, -camX - 4 * t * u, -camY + 3 * t * u]));
      ctx.globalAlpha = 0.28; ctx.fillRect(bx0, by0, bw, bh); ctx.globalAlpha = 1;
      if (deepTex) {   // água funda: textura escura por cima, mais forte quanto mais fundo
        deepTex.setTransform(new DOMMatrix([sc, 0, 0, sc, -camX + 3 * t * u, -camY - 2 * t * u]));
        ctx.fillStyle = deepTex;
        for (let k = 0; k < n; k += 5) { const lv = L[k + 4]; if (lv > 4) { ctx.globalAlpha = Math.min(0.85, (lv - 4) / 7); ctx.fillRect(L[k + 2], L[k + 3], tp + 1, tp + 1); } }
        ctx.globalAlpha = 1;
      }
    } else {
      const sc = tp / 36;
      for (const [pat, vx, vy] of [[wavePatB, -6, 3], [wavePatA, 9, 5]]) {
        pat.setTransform(new DOMMatrix([sc, 0, 0, sc, -camX + vx * t * u, -camY + vy * t * u]));
        ctx.fillStyle = pat; ctx.fillRect(bx0, by0, bw, bh);
      }
    }
    ctx.restore();
    // margens com espuma e brilhos (só nas bordas, poucos retângulos)
    const foam = 'rgba(235,248,255,' + (0.65 + 0.25 * Math.sin(now / 400)).toFixed(2) + ')';
    const bank = 'rgba(40,70,90,0.35)', bb = 2.5 * u, f = Math.max(1, 0.9 * u);
    for (let k = 0; k < n; k += 5) {
      const x = L[k], y = L[k + 1], sx = L[k + 2], sy = L[k + 3], i = I(x, y, z);
      if (y > 0 && !isWet(i - W, z)) { ctx.fillStyle = bank; ctx.fillRect(sx, sy, tp, bb); ctx.fillStyle = foam; ctx.fillRect(sx, sy + bb, tp, f); }
      if (y < H - 1 && !isWet(i + W, z)) { ctx.fillStyle = foam; ctx.fillRect(sx, sy + tp - f, tp, f); }
      if (x > 0 && !isWet(i - 1, z)) { ctx.fillStyle = bank; ctx.fillRect(sx, sy, bb * 0.6, tp); ctx.fillStyle = foam; ctx.fillRect(sx + bb * 0.6, sy, f, tp); }
      if (x < W - 1 && !isWet(i + 1, z)) { ctx.fillStyle = bank; ctx.fillRect(sx + tp - bb * 0.6, sy, bb * 0.6, tp); ctx.fillStyle = foam; ctx.fillRect(sx + tp - bb * 0.6 - f, sy, f, tp); }
      if (Math.sin(now / 300 + x * 12.9898 + y * 78.233) > 0.93) { ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.fillRect(sx + ((x * 7) % 10 + 3) * u, sy + ((y * 5) % 10 + 3) * u, 2 * u, u); }
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
  const canvas = $('game');
  let ctx = canvas.getContext('2d');   // let: os pedaços do chão são desenhados trocando o ctx por um canvas guardado
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
      const kk = document.createElement('span'); kk.className = 'k'; kk.textContent = (k + 1) % 10;
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
    if (sl.k === 'nada') return 'Escolher construção';
    if (sl.k === 'kit') return BUILDS[sl.id].nome;
    if (sl.k === 'mover') return sl.carry ? 'Soltar muro' : 'Mover muro';
    if (sl.k === 'girar') return 'Girar muro';
    if (sl.k === 'remover') return 'Remover muro';
    const m = WALL_MATS[sl.m || 0];
    return sl.k === 'portao' ? 'Portão de ' + m.id : m.nome;
  }
  function selCount() {
    const sl = S.sel;
    if (sl.k === 'kit') return S.kit[sl.id] || 0;
    if (sl.k === 'mover' || sl.k === 'girar' || sl.k === 'remover' || sl.k === 'nada') return '';
    const cost = wallCost(sl.m || 0, sl.k === 'portao');
    return Math.min(...Object.entries(cost).map(([k, n]) => Math.floor((S.inv[k] || 0) / n)));
  }
  function updateHotbar() {
    slotEls.forEach((s, k) => {
      s.b.setAttribute('aria-pressed', String(k === S.tool));
      s.b.classList.toggle('locked', s.id === 'rede' && !S.owned.rede);
      s.b.hidden = (s.id === 'arco' || s.id === 'cetro' || s.id === 'livro') && !S.owned[s.id];
      drawIcon(s.cv.getContext('2d'), s.id);
      s.n.textContent = s.id === 'arco' ? (S.inv.flechas || 0) : s.id === 'cetro' || s.id === 'livro' ? Math.floor(mana) : s.id === 'muro' ? selCount() : s.id === 'enxada' ? (S.inv.sementes || 0) : '';
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
    updateDoorBtn();
    updateEditBar();
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
      const comprados = SHOP.filter(it => !it.repetir && S.owned[it.id] && it.id !== 'capacete');   // o capacete tem a linha dele
      if (comprados.length) {
        html += '<div class="section-label">Comprados na loja · descartar</div><div class="list">';
        for (const it of comprados) html += `<div class="row"><span></span><span class="name"><b>${it.nome}</b><small>Descartar não devolve moedas</small></span><span></span><button type="button" class="btn btn-danger" data-discard="${it.id}">Descartar</button></div>`;
        html += '</div>';
      }
      if (S.owned.capacete) html += `<div class="row"><span></span><span class="name"><b>Capacete com lanterna${wearing('capacete') ? '' : ' (guardado)'}</b><small>Bateria: ${Math.ceil((S.dur.capacete ?? DUR.capacete) / 60)} min de luz no escuro</small></span><span></span><span class="admin-btns"><button type="button" class="btn" data-equip="capacete">${wearing('capacete') ? 'Tirar' : 'Colocar'}</button><button type="button" class="btn btn-danger" data-discard="capacete">Descartar</button></span></div>`;
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
        ${buys ? `<button type="button" class="btn" data-sell="${k}">Vender</button>` : !m ? `<button type="button" class="btn btn-danger" data-trash="${k}">Jogar fora</button>` : '<span></span>'}</div>`;
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

  let shopTab = 'ferramentas', giftOpen = null;
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
      const ready = SKINS.filter(sk => skinReady(sk.id) && (!sk.evento || precoSkin(sk) != null || (S.skins || []).includes(sk.id)))
        .sort((a, b) => !!(b.evento && precoSkin(b) != null) - !!(a.evento && precoSkin(a) != null));
      html += '<div class="list">';
      if (!ready.length) html += '<div class="empty">Nenhuma skin disponível ainda.</div>';
      for (const sk of ready) {
        const has = (S.skins || []).includes(sk.id), wearing = has && S.skin === sk.id;
        let btn;
        if (wearing) btn = `<button type="button" class="btn" data-skin="off">Tirar</button>`;
        else if (has) btn = `<button type="button" class="btn btn-gold" data-skin="${sk.id}">Vestir</button>`;
        if (has) btn += `<button type="button" class="btn" data-gift="${sk.id}">Presentear</button>`;
        else { const pr = precoSkin(sk); btn = `<button type="button" class="btn ${S.coins >= pr ? 'btn-gold' : ''}" data-skinbuy="${sk.id}" ${S.coins >= pr ? '' : 'disabled'}>${pr} moedas</button>`; }
        html += `<div class="row skin-row${sk.evento ? ' skin-evento' : ''}">${skinThumb(sk.id)}<span class="name"><b>${sk.nome}</b><small>${sk.evento ? '✦ ' + sk.raridade + (precoSkin(sk) != null && !has ? ' · por tempo limitado' : '') : sk.raridade} · só visual${wearing ? ' · usando' : ''}</small></span><span></span><span class="admin-btns">${btn}</span></div>`;
        if (giftOpen === sk.id) html += `<div class="gift-form"><input id="gift-code" type="text" placeholder="Código do jogador (TF-…)" autocomplete="off" maxlength="12">
          <button type="button" class="btn btn-gold" data-giftsend="${sk.id}">Enviar presente</button><button type="button" class="btn" data-gift="">Cancelar</button></div>`;
      }
      html += '</div>';
    } else {
      html += '<div class="list">';
      for (const [k, d] of Object.entries(BUILDS)) {
        if (TAB_OF(d) !== shopTab) continue;
        const n = S.kit[k] || 0, can = S.coins >= d.preco;
        const sub = (d.desc || (d.tipo === 'movel' ? 'Para decorar dentro ou fora de casa.' : '')) + (n ? ` · você tem ${n} guardado${n > 1 ? 's' : ''}` : '');
        html += `<div class="row skin-row">${d.tipo === 'robo' ? thumb1(d && d.bot === 'fazenda' ? 'faz_front_0' : 'robo_front_0') : thumb2(ATLAS2['iso_' + k] ? 'iso_' + k : d.img)}<span class="name"><b>${d.nome}</b><small>${sub}</small></span><span></span>
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
    const pick = (val, on) => on ? '<button type="button" class="btn btn-chosen" data-bsel="nada:0" title="Toque para desmarcar">Escolhido ✓</button>' : `<button type="button" class="btn btn-gold" data-bsel="${val}">Escolher</button>`;
    let html = '';
    // tudo o que está construído por perto, do mais perto ao mais longe
    const near = S.builds.map((b, i) => ({ b, i, vila: b.vila, dist: Math.hypot(b.x + BUILDS[b.k].w / 2 - S.p.x, b.y + BUILDS[b.k].h / 2 - S.p.y) }))
      .filter(o => o.dist < 60 && !o.vila).sort((a, c) => a.dist - c.dist).slice(0, 30);
    near.push(...S.bots.map((b, i) => ({ bot: b, i, dist: Math.hypot(b.x - S.p.x, b.y - S.p.y) })).filter(o => o.dist < 60));
    html += '<div class="section-label">Construído por perto · guardar ou vender</div><div class="list">';
    if (!near.length) html += '<div class="empty">Nada construído por perto.</div>';
    for (const o of near) {
      const d = o.bot ? BUILDS[kitOfBot(o.bot)] : BUILDS[o.b.k], th = o.bot ? thumb1(d && d.bot === 'fazenda' ? 'faz_front_0' : 'robo_front_0') : thumb2(d.img + (d.tipo === 'forte' ? '' : ''));
      const tag = o.bot ? 'bot' : 'b';
      html += `<div class="row skin-row">${th || '<span></span>'}<span class="name"><b>${d.nome}</b><small>a ${Math.round(o.dist)} blocos · vender devolve ${Math.floor(d.preco / 2)} moedas</small></span>
        ${!o.bot && (d.tipo === 'casa' || d.tipo === 'forte') ? `<button type="button" class="btn" data-bacesso="${o.i}" title="Quem pode entrar">${ACESSO[o.b.acesso || 'so_eu']}</button>` : ''}
        <button type="button" class="btn" data-bpick="${tag}:${o.i}">Guardar</button>
        <button type="button" class="btn btn-danger" data-bsell="${tag}:${o.i}">Vender</button></div>`;
    }
    html += '</div><p class="muted small-text">Guardar devolve para "Suas construções", para colocar em outro lugar. Casas levam os móveis de dentro. Muros e portões: desmonte com a picareta.</p>';
    html += '<div class="section-label">Muros</div><div class="list">';
    WALL_MATS.forEach((m, k) => { html += row(thumb2(`muro_${m.id}_h`), m.nome, `${costTxt(m.custo)} · ${m.golpes} golpes para derrubar`, pick('muro:' + k, cur('muro', k))); });
    html += '</div><div class="section-label">Portões · abrem quando você chega perto</div><div class="list">';
    WALL_MATS.forEach((m, k) => { html += row(thumb2(`muro_${m.id}_portao`), `Portão (${m.nome.toLowerCase()})`, costTxt(wallCost(k, true)), pick('portao:' + k, cur('portao', k))); });
    html += '</div><div class="section-label">Ajustar muros e portões</div><div class="list">';
    html += row('', 'Mover', 'Use num muro para pegar e use de novo onde quiser soltar', pick('mover:0', S.sel.k === 'mover'));
    html += row('', 'Girar', 'Use num muro: encaixe automático → deitado → em pé', pick('girar:0', S.sel.k === 'girar'));
    html += row('', 'Remover', 'Use num muro: some na hora e devolve todo o material', pick('remover:0', S.sel.k === 'remover'));
    html += '</div><div class="section-label">Suas construções</div><div class="list">';
    const mine = Object.entries(S.kit).filter(([k, n]) => n > 0 && BUILDS[k]);
    if (!mine.length) html += '<div class="empty">Nada guardado. Casas, fortalezas, torres, móveis e o robô minerador estão na loja.</div>';
    for (const [k, n] of mine) {
      const d = BUILDS[k];
      html += row(d.tipo === 'robo' ? thumb1(d && d.bot === 'fazenda' ? 'faz_front_0' : 'robo_front_0') : thumb2(ATLAS2['iso_' + k] ? 'iso_' + k : d.img), `${d.nome}${n > 1 ? ' × ' + n : ''}`, d.desc || 'Móvel', pick('kit:' + k, cur('kit', 0, k)));
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
    const pr = sk && precoSkin(sk);
    if (!sk || pr == null || S.coins < pr || (S.skins || []).includes(id)) { if (sk && pr == null) toast('Essa skin não está mais à venda', 'warn'); return; }
    S.coins -= pr; S.skins = [...(S.skins || []), id]; S.skin = id; invDirty = true;
    toast(`Skin ${sk.nome} comprada e vestida`, 'gold'); save();
  }

  // ================= Administrador =================
  // Painel escondido (5 toques no relógio, ou a tecla P cinco vezes). No multiplayer ele só abre
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
    // áreas seguras
    for (const zn of MUNDO.zonas) {
      if (!zn.ativo) continue;
      c.strokeStyle = '#7fe08a'; c.lineWidth = 3; c.setLineDash([6, 4]);
      c.beginPath(); c.arc(zn.x * k, zn.y * k, zn.r * k, 0, 6.28); c.stroke(); c.setLineDash([]);
      c.fillStyle = 'rgba(127,224,138,0.18)'; c.fill();
    }
    for (const v of MUNDO.vilas) { c.fillStyle = v.ativo ? '#c9a34a' : 'rgba(60,50,45,0.8)'; c.strokeStyle = adminMove === 'vila:' + v.id ? '#fff' : '#14110f'; c.lineWidth = 2; c.fillRect(v.x * k - 8, v.y * k - 8, 16, 16); c.strokeRect(v.x * k - 8, v.y * k - 8, 16, 16); }
    if (MUNDO.fugitivo && MUNDO.fugitivo.ativo && !MUNDO.fugitivo.ganhador) { c.fillStyle = '#ff4a3a'; c.font = '600 22px sans-serif'; c.fillText('!', MUNDO.fugitivo.x * k, MUNDO.fugitivo.y * k); }
    // acampamentos de saqueadores
    for (const cp of S.camps) {
      const sel = adminMove === 'camp:' + cp.id;
      c.fillStyle = cp.ativo ? '#c8392b' : 'rgba(60,50,45,0.8)'; c.strokeStyle = sel ? '#ffffff' : '#14110f'; c.lineWidth = sel ? 4 : 2;
      c.beginPath(); c.moveTo(cp.x * k, cp.y * k - 12); c.lineTo(cp.x * k + 11, cp.y * k + 8); c.lineTo(cp.x * k - 11, cp.y * k + 8); c.closePath(); c.fill(); c.stroke();
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
          btns += `<span class="bless-form"><select data-bl-arma="${p.id}" aria-label="Arma">${Object.entries(ARMAS).map(([k, n]) => `<option value="${k}">${n}</option>`).join('')}</select>
            <select data-bl-nivel="${p.id}" aria-label="Nível">${WLV_NOME.slice(1).map((n, i) => `<option value="${i + 1}">${n}</option>`).join('')}</select>
            <select data-bl-horas="${p.id}" aria-label="Duração"><option value="0">Para sempre</option><option value="24">24 horas</option><option value="168">7 dias</option></select>
            <button type="button" class="btn" data-pl="bless" data-id="${p.id}">Dar nível</button></span>`;
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
      else if (action === 'bless') {
        const q = sel => document.querySelector(`[${sel}="${id}"]`).value;
        await NET.bless(id, q('data-bl-arma'), +q('data-bl-nivel'), +q('data-bl-horas'));
      }
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

  function staffExtras() {
    let box = document.getElementById('admin-staff');
    if (!box) {
      box = document.createElement('div'); box.id = 'admin-staff';
      $('admin-mode').after(box);
      box.addEventListener('click', e => {
        const b = e.target.closest('[data-st]');
        if (!b) return;
        const v = b.dataset.st;
        if (v === 'tp') { adminMove = 'tp'; renderAdmin(); return; }
        if (v.startsWith('aura:')) { S.aura = v.slice(5) === 'off' ? null : v.slice(5); save(); renderAdmin(); return; }
        if (v.startsWith('bless:')) {
          const [, arma, nivel] = v.split(':');
          S.wbless = S.wbless || {}; S.wbless[arma] = { lv: +nivel, ate: null };
          toast(`${ARMAS[arma]}: ${WLV_NOME[wlv(arma)]}`, 'gold'); save(); renderAdmin(); return;
        }
      });
    }
    const admin = !NET.enabled || NET.isAdmin;
    const cores = admin ? ['vermelha', 'preta', 'roxa', 'verde', 'dourada'] : ['verde'];
    let html = '<div class="section-label">Equipe</div><div class="confirm-row">'
      + '<button type="button" class="btn btn-gold" data-st="tp">Teletransportar (toque no mapa)</button></div>'
      + '<p class="muted small-text">Aura em volta de você (os jogadores verão no multiplayer):</p><div class="confirm-row">'
      + `<button type="button" class="btn ${!S.aura ? 'btn-gold' : ''}" data-st="aura:off">Sem aura</button>`
      + cores.map(c => `<button type="button" class="btn ${S.aura === c ? 'btn-gold' : ''}" data-st="aura:${c}">${c[0].toUpperCase() + c.slice(1)}</button>`).join('') + '</div>';
    if (admin) {
      html += '<div class="section-label">Suas armas · experiência</div><div class="list">';
      for (const [w, nome] of Object.entries(ARMAS)) {
        const max = w === 'cetro' ? 5 : 4;
        html += `<div class="row shop"><span class="name"><b>${nome}: ${WLV_NOME[wlv(w)]}</b><small>${(S.wxp || {})[w] || 0} de experiência</small></span>
          <span class="admin-btns">${[1, 2, 3, 4, 5].filter(l => l <= max).map(l => `<button type="button" class="btn" data-st="bless:${w}:${l}">${WLV_NOME[l]}</button>`).join('')}</span></div>`;
      }
      html += '</div>';
    }
    box.innerHTML = html;
  }
  // ================= Mundo do administrador: áreas seguras, eventos, fugitivo e vilas =================
  // Com contas ligadas fica no servidor (tabela "mundo") e vale para todos; sem contas fica no próprio save.
  const MUNDO_PADRAO = () => ({
    zonas: [{ id: 1, nome: 'Praça do começo', x: SPAWN.x, y: SPAWN.y, r: 18, ativo: true }],
    eventos: [], fugitivo: null, vilas: [], construtores: { premio: 'moedas:100', chance: 0.1 }, aviso: null, vendas: {},
  });
  let MUNDO = MUNDO_PADRAO();
  const online = () => NET.enabled && NET.user;
  async function mundoCarregar() {
    if (online()) {
      try {
        const o = await NET.mundoGet();
        const base = MUNDO_PADRAO();
        MUNDO = { zonas: o.zonas || base.zonas, eventos: o.eventos || [], fugitivo: o.fugitivo || null, vilas: o.vilas || [], construtores: o.construtores || base.construtores, aviso: o.aviso || null, vendas: o.vendas || {} };
        mostrarAviso(MUNDO.aviso); avisoFugitivo();
      } catch (e) { /* sem rede: fica com o que já tinha */ }
    } else MUNDO = S.mundo ? Object.assign(MUNDO_PADRAO(), S.mundo) : MUNDO_PADRAO();
    avisarFugitivo();
  }
  function mundoSalvar(chave) {
    S.mundo = MUNDO; save();
    if (online() && NET.isAdmin) NET.mundoSet(chave, MUNDO[chave]).catch(e => toast('Não salvou no servidor: ' + e.message, 'warn'));
  }
  setInterval(() => { if (S && online() && !bootPending) mundoCarregar(); }, 120000);   // os jogadores recebem as mudanças do admin

  // ---- avisos da moderação: roxos, sem o nome de quem mandou
  const avisosVistos = new Set();
  function avisoNoChat(titulo, texto, t) {
    chatPush({ de: '', nome: 'Moderação', titulo, texto, tipo: 'todos', sistema: true, t: t || Date.now() }, false);
    toast(`Moderação${titulo ? ' · ' + titulo : ''}: ${texto}`, 'roxo', 9000);
  }
  function mostrarAviso(a) {
    if (!a || !a.id || avisosVistos.has(a.id)) return;
    avisosVistos.add(a.id);
    if (Date.now() - (a.t || 0) > 20 * 60000) return;   // aviso velho não aparece para quem entra depois
    avisoNoChat(a.titulo, a.texto, a.t);
  }
  function avisoFugitivo() {
    const f = MUNDO.fugitivo;
    if (!f || !f.ganhador || avisosVistos.has('fug:' + f.id)) return;
    avisosVistos.add('fug:' + f.id);
    if ((S.fugPegos || {})[f.id] && NET.profile && f.ganhador === NET.profile.username) return;   // quem ganhou já viu
    avisoNoChat('Fugitivo', `${f.ganhador} pegou o fugitivo e ganhou ${premioNome(f.premio)}!`);
  }
  function enviarAviso(titulo, texto) {
    titulo = String(titulo || '').trim().slice(0, 40); texto = String(texto || '').replace(/\s+/g, ' ').trim().slice(0, 200);
    if (!texto) { toast('Escreva o aviso', 'warn'); return false; }
    MUNDO.aviso = { id: 'a' + Date.now(), titulo, texto, t: Date.now() };
    mundoSalvar('aviso');
    if (online()) setTimeout(() => NET.anunciar('aviso'), 600);   // dá tempo de gravar antes do sinal
    mostrarAviso(MUNDO.aviso);
    return true;
  }

  // ---- prêmios: moedas, itens da loja, skins e construções
  function premioOpcoes() {
    const op = [['moedas:100', '100 moedas'], ['moedas:500', '500 moedas'], ['moedas:1000', '1.000 moedas'], ['moedas:5000', '5.000 moedas'], ['flechas:50', '50 flechas']];
    for (const it of SHOP) if (!it.repetir) op.push(['shop:' + it.id, it.nome]);
    for (const sk of SKINS) op.push(['skin:' + sk.id, 'Skin ' + sk.nome]);
    for (const [k, d] of Object.entries(BUILDS)) op.push(['kit:' + k, d.nome]);
    return op;
  }
  const premioNome = code => (premioOpcoes().find(o => o[0] === code) || [0, code])[1];
  function darPremio(code) {
    const [t, v] = String(code).split(':');
    if (t === 'moedas') S.coins += +v;
    else if (t === 'flechas') give('flechas', +v);
    else if (t === 'shop') { S.owned[v] = true; if (DUR[v]) S.dur[v] = DUR[v]; }
    else if (t === 'skin') { S.skins = S.skins || []; if (!S.skins.includes(v)) S.skins.push(v); else S.coins += Math.floor((SKINS.find(s => s.id === v) || { preco: 0 }).preco / 2); }
    else if (t === 'kit') S.kit[v] = (S.kit[v] || 0) + 1;
    invDirty = true; sfx('moeda'); save(true);
    toast(`Você ganhou: ${premioNome(code)}!`, 'gold', 5000);
  }

  // ---- personagens de evento (Papai Noel, Coelho da Páscoa ou outro): aparecem só nas datas marcadas
  const hoje = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
  const eventoNoAr = ev => ev.ativo && (!ev.inicio || hoje() >= ev.inicio) && (!ev.fim || hoje() <= ev.fim);
  const evNpcs = new Map();
  function eventosTick(dt) {
    for (const ev of MUNDO.eventos) {
      const zn = MUNDO.zonas.find(z => z.id === ev.zona) || MUNDO.zonas[0];
      if (!zn || !eventoNoAr(ev)) { evNpcs.delete(ev.id); continue; }
      let n = evNpcs.get(ev.id);
      if (!n) { n = { ev, x: zn.x + 0.5, y: zn.y + 1.5, tx: zn.x, ty: zn.y, dir: 0, phase: 0, moving: false }; evNpcs.set(ev.id, n); }
      n.ev = ev;
      const dx = n.tx - n.x, dy = n.ty - n.y, L = Math.hypot(dx, dy);
      if (L < 0.2) { n.moving = false; if (Math.random() < dt * 0.4) { const a = Math.random() * 6.28, r = Math.random() * Math.max(2, zn.r * 0.6); n.tx = zn.x + Math.cos(a) * r; n.ty = zn.y + Math.sin(a) * r; } }
      else {
        const st = Math.min(L, 1.3 * dt), nx = n.x + dx / L * st, ny = n.y + dy / L * st;
        if (canStand(nx, ny, 0, 0.3)) { n.x = nx; n.y = ny; n.moving = true; n.phase += dt * 9; n.dir = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 2 : 3) : (dy < 0 ? 1 : 0); }
        else { n.tx = n.x; n.ty = n.y; }
      }
    }
  }
  function eventoPerto(x, y) {
    if (S.p.z !== 0 || interior) return null;
    for (const n of evNpcs.values()) if (Math.hypot(n.x - x - 0.5, n.y - y - 0.5) < 1.2 || Math.hypot(n.x - S.p.x, n.y - S.p.y) < 1.3) return n;
    return null;
  }
  async function pedirPresente(n) {
    const ev = n.ev, lim = Math.max(1, ev.limite || 1);
    try {
      let resta;
      if (online()) resta = await NET.pegarPresente(ev.id, lim);
      else { S.presentes = S.presentes || {}; const ja = S.presentes[ev.id] || 0; resta = ja >= lim ? -1 : lim - ja - 1; if (resta >= 0) S.presentes[ev.id] = ja + 1; }
      if (resta < 0) { toast(`${ev.nome}: você já pegou ${lim > 1 ? 'todos os seus presentes' : 'o seu presente'}`, 'warn', 3500); return; }
      darPremio(ev.premio);
      if (resta > 0) toast(`Ainda pode pegar mais ${resta}`, 'leaf');
    } catch (e) { toast(e.message, 'warn'); }
  }
  const EV_VISUAL = { natal: { nome: 'Papai Noel', arte: 'noel', cor: 'hue-rotate(-25deg) saturate(1.6)' }, pascoa: { nome: 'Coelho da Páscoa', arte: 'coelhao', cor: '' }, outro: { nome: 'Mensageiro', arte: 'mensageiro', cor: 'hue-rotate(180deg)' } };
  function drawEventoNpc(n, sx, sy, u) {
    const vis = EV_VISUAL[n.ev.tipo] || EV_VISUAL.outro, view = n.dir === 1 ? 'back' : n.dir === 0 ? 'front' : 'side', flip = n.dir === 2;
    shadow(sx, sy + 5.6 * u, 4.6 * u, 1.5 * u);
    const nf = framesOf(vis.arte, view);
    if (nf && drawObj(`${vis.arte}_${view}_${n.moving ? Math.floor(n.phase / 1.4) % nf : 0}`, sx, sy + 6 * u, 1.55 * tp, flip)) return;
    if (n.ev.tipo === 'pascoa') { drawObj(`coelho_${n.dir === 1 ? 'back' : n.dir === 0 ? 'front' : 'side'}_0`, sx, sy + 6 * u, 1.3 * tp, flip); return; }
    ctx.filter = vis.cor || 'none';   // até chegar a arte: o Tião com outra cor
    drawWalker('tiao_0', sx, sy + 6 * u, 1.55 * tp, flip, n.moving ? n.phase : 0);
    ctx.filter = 'none';
  }

  // ---- fugitivo: não ataca, foge; o primeiro que derrubar ganha o prêmio escolhido pelo admin
  function avisarFugitivo() {
    const f = MUNDO.fugitivo;
    if (!f || !f.ativo || f.ganhador) return;
    S.fugVisto = S.fugVisto || {};
    if (!S.fugVisto[f.id]) { S.fugVisto[f.id] = 1; toast(`Um fugitivo está solto em ${BIOMES[regionOf(f.x, f.y)].nome}! Quem pegar ganha ${premioNome(f.premio)}.`, 'gold', 7000); }
  }
  function fugitivoTick() {
    const f = MUNDO.fugitivo, p = S.p;
    const vivo = f && f.ativo && !f.ganhador && !(S.fugPegos || {})[f.id];
    const m = S.mobs.find(q => q.kind === 'fugitivo');
    if (!vivo) { if (m) S.mobs.splice(S.mobs.indexOf(m), 1); return; }
    if (!m && Math.hypot(f.x - p.x, f.y - p.y) < 70) S.mobs.push(newMob('fugitivo', f.x + 0.5, f.y + 0.5, 0, { fug: f.id }));
  }
  async function pegouFugitivo(m) {
    const f = MUNDO.fugitivo;
    if (!f || f.id !== m.fug) return;
    S.fugPegos = S.fugPegos || {}; S.fugPegos[f.id] = 1;
    try {
      const ok = online() ? await NET.pegarFugitivo(f.id) : true;
      if (!ok) { toast('Alguém pegou o fugitivo antes de você', 'warn', 4000); return; }
      darPremio(f.premio);
      const nome = NET.profile ? NET.profile.username : 'Você';
      f.ganhador = nome; avisosVistos.add('fug:' + f.id);
      if (online()) NET.anunciar('fugitivo');
      avisoNoChat('Fugitivo', `${nome} pegou o fugitivo e ganhou ${premioNome(f.premio)}!`);
    } catch (e) { toast(e.message, 'warn'); }
  }

  // ---- construtores: andam em grupos, fazem choupanas e plantações; não atacam
  const VILA_MAX_CASAS = 3, VILA_CASA_MS = 4 * 60000, CONSTRUTOR_VOLTA = 5 * 60000;
  function vilasTick() {
    const p = S.p;
    S.vilaEstado = S.vilaEstado || {};
    for (const v of MUNDO.vilas) {
      const st = S.vilaEstado[v.id] = S.vilaEstado[v.id] || { mortos: [], ultima: 0 };
      if (!v.ativo) { S.mobs = S.mobs.filter(m => m.vila !== v.id); continue; }
      if (Math.hypot(v.x - p.x, v.y - p.y) > 75) continue;
      st.mortos = st.mortos.filter(t => t > S.time);
      const vivos = S.mobs.filter(m => m.vila === v.id).length;
      if (vivos + st.mortos.length < v.n) {   // nasce num lugar livre perto do centro da vila
        for (let k = 0; k < 20; k++) {
          const a = Math.random() * 6.28, r = 2 + Math.random() * 4, nx = v.x + 0.5 + Math.cos(a) * r, ny = v.y + 0.5 + Math.sin(a) * r;
          if (canStand(nx, ny, 0, 0.28) && !buildBlocks(nx, ny)) { S.mobs.push(newMob('construtor', nx, ny, 0, { vila: v.id, hx: v.x + 0.5, hy: v.y + 0.5 })); break; }
        }
      }
      // de tempos em tempos levantam uma choupana nova (as destruídas não são consertadas)
      const casas = S.builds.filter(b => b.vila === v.id).length;
      if (vivos > 0 && casas < VILA_MAX_CASAS && S.time - st.ultima > VILA_CASA_MS) {
        st.ultima = S.time;
        for (let t = 0; t < 30; t++) {
          const a = Math.random() * 6.28, r = 3 + Math.random() * 9, c = { k: 'choupana', x: Math.round(v.x + Math.cos(a) * r) - 3, y: Math.round(v.y + Math.sin(a) * r) - 1 };
          if (placeProblem(c, true) || zonaEm(c.x + 3, c.y + 1) || Math.hypot(c.x + 3 - p.x, c.y + 1 - p.y) < 6) continue;
          let naEstrada = false;   // choupanas não ficam em cima das estradas
          if (S.road) for (let yy = c.y - 1; yy < c.y + BUILDS.choupana.h + 3 && !naEstrada; yy++) for (let xx = c.x - 1; xx < c.x + BUILDS.choupana.w + 1; xx++) if (S.road[yy * W + xx]) { naEstrada = true; break; }
          if (naEstrada) continue;
          const b = addBuild(c); b.dono = 'vila'; b.vila = v.id; b.hp = 60; b.acesso = 'todos';
          for (let k = 0; k < 6; k++) {   // plantação na frente
            const x = c.x + 1 + k % 3, y = c.y + BUILDS.choupana.h + 1 + Math.floor(k / 3), i = I(x, y, 0);
            if (S.tiles[i] === T.GRASS && !buildBlocks(x + 0.5, y + 0.5)) { S.tiles[i] = T.CROP; S.aux[i] = Math.floor(Math.random() * 3); }
          }
          break;
        }
      }
    }
  }
  function choupanaNaFrente(x, y) {
    if (S.p.z !== 0 || interior) return null;
    return S.builds.find(b => b.vila && (shapeHit(b, x + 0.5, y + 0.5) || shapeHit(b, S.p.x, S.p.y - 0.6))) || null;
  }
  function baterChoupana(b) {
    b.hp = (b.hp || 60) - 15; sfx('corte'); shake(80, tp * 0.03);
    fxAnim(['fx_lascas'], S.p.x + DIRS[S.p.dir][0], S.p.y + DIRS[S.p.dir][1] - 0.5, 0, 1, 300);
    if (b.hp <= 0) { S.builds.splice(S.builds.indexOf(b), 1); give('madeira', 4); sfx('desaba'); toast('Choupana derrubada: +4 madeira'); save(); }
    else toast(`Choupana: ${b.hp} de 60`);
  }

  // ---- painel do administrador: eventos
  function selPremio(attr, atual) {
    return `<select ${attr}>${premioOpcoes().map(([v, n]) => `<option value="${v}"${v === atual ? ' selected' : ''}>${escapeHtml(n)}</option>`).join('')}</select>`;
  }
  function renderEventos() {
    let box = document.getElementById('admin-eventos');
    if (!box) {
      box = document.createElement('div'); box.id = 'admin-eventos';
      document.getElementById('admin-zonas').after(box);
      box.addEventListener('keydown', e => e.stopPropagation());
      box.addEventListener('click', e => {
        const bt = e.target.closest('[data-ev]'); if (!bt) return;
        const a = bt.dataset.ev, id = bt.dataset.id, val = q => (box.querySelector(q) || {}).value;
        if (a === 'novo') {
          const tipo = val('#ev-tipo');
          MUNDO.eventos.push({ id: 'ev' + Date.now(), tipo, nome: (val('#ev-nome') || '').trim() || (EV_VISUAL[tipo] || EV_VISUAL.outro).nome, zona: +val('#ev-zona'),
            inicio: val('#ev-ini') || hoje(), fim: val('#ev-fim') || val('#ev-ini') || hoje(), premio: val('#ev-premio'), limite: Math.max(1, +val('#ev-lim') || 1), ativo: true });
          mundoSalvar('eventos'); toast('Evento criado');
        } else if (a === 'ev-toggle' || a === 'ev-del' || a === 'ev-agora') {
          const ev = MUNDO.eventos.find(q => q.id === id); if (!ev) return;
          if (a === 'ev-toggle') ev.ativo = !ev.ativo;
          if (a === 'ev-agora') { ev.inicio = hoje(); if (!ev.fim || ev.fim < hoje()) ev.fim = hoje(); ev.ativo = true; }
          if (a === 'ev-del') MUNDO.eventos.splice(MUNDO.eventos.indexOf(ev), 1);
          mundoSalvar('eventos');
        } else if (a === 'fug-soltar') {
          const p = S.p;
          MUNDO.fugitivo = { id: 'f' + Date.now(), x: Math.round(p.x), y: Math.round(p.y), premio: val('#fug-premio'), ativo: true, ganhador: null };
          S.fugVisto = S.fugVisto || {}; S.fugVisto[MUNDO.fugitivo.id] = 1;
          mundoSalvar('fugitivo');
          enviarAviso('Fugitivo à solta', `Um fugitivo foi visto em ${BIOMES[regionOf(p.x, p.y)].nome}! Quem pegar ganha ${premioNome(MUNDO.fugitivo.premio)}.`);
        } else if (a === 'fug-parar') { if (MUNDO.fugitivo) MUNDO.fugitivo.ativo = false; mundoSalvar('fugitivo'); }
        else if (a === 'vila-nova') { const p = S.p; MUNDO.vilas.push({ id: 'v' + Date.now(), nome: 'Vila', x: Math.round(p.x), y: Math.round(p.y), n: 3, ativo: true }); mundoSalvar('vilas'); toast('Vila criada onde você está'); }
        else if (a.startsWith('vila-')) {
          const v = MUNDO.vilas.find(q => q.id === id); if (!v) return;
          if (a === 'vila-move') adminMove = 'vila:' + v.id;
          if (a === 'vila-mais') v.n = Math.min(8, v.n + 1);
          if (a === 'vila-menos') v.n = Math.max(1, v.n - 1);
          if (a === 'vila-toggle') v.ativo = !v.ativo;
          if (a === 'vila-ir') { S.p.x = v.x + 0.5; S.p.y = v.y + 4.5; S.p.z = 0; interior = null; closeSheet(); return; }
          if (a === 'vila-del') MUNDO.vilas.splice(MUNDO.vilas.indexOf(v), 1);
          mundoSalvar('vilas');
        } else if (a === 'venda' || a === 'venda-tirar') {
          const sk = SKINS.find(q => q.id === id); if (!sk) return;
          if (a === 'venda') { const pr = Math.floor(+box.querySelector(`[data-venda-preco="${id}"]`).value); if (!(pr > 0)) { toast('Preço inválido', 'warn'); return; } MUNDO.vendas[id] = pr; toast(`${sk.nome} à venda por ${pr} moedas`, 'gold'); }
          else { delete MUNDO.vendas[id]; toast(`${sk.nome} saiu da loja`); }
          mundoSalvar('vendas');
        } else if (a === 'aviso') {
          if (enviarAviso(val('#aviso-titulo'), val('#aviso-texto'))) { box.querySelector('#aviso-texto').value = ''; toast('Aviso enviado para todos', 'roxo'); }
          return;
        } else if (a === 'cons-salvar') {
          MUNDO.construtores = { premio: val('#cons-premio'), chance: Math.min(1, Math.max(0, (+val('#cons-chance') || 0) / 100)) };
          mundoSalvar('construtores'); toast('Prêmio dos construtores salvo');
        }
        renderAdmin();
      });
    }
    const zonasOp = MUNDO.zonas.map(z => `<option value="${z.id}">${escapeHtml(z.nome)}</option>`).join('');
    const evNoAr = MUNDO.eventos.filter(eventoNoAr).map(e => e.nome);
    let html = `<div class="section-label">Aviso da moderação</div>
      <p class="muted small-text">Sai em roxo no chat de todos, assinado só como "Moderação" (seu nome fica oculto).</p>
      <div class="ev-form aviso-form"><input id="aviso-titulo" type="text" maxlength="40" list="aviso-sugestoes" placeholder="Título (opcional)" value="${evNoAr.length ? 'Eventos em vigência: ' + escapeHtml(evNoAr[0]) : ''}">
      <datalist id="aviso-sugestoes"><option value="Eventos em vigência">${MUNDO.eventos.map(e => `<option value="Eventos em vigência: ${escapeHtml(e.nome)}">`).join('')}<option value="Manutenção"><option value="Regras"></datalist>
      <textarea id="aviso-texto" maxlength="200" rows="2" placeholder="Escreva o aviso…"></textarea>
      <button type="button" class="btn btn-roxo" data-ev="aviso">Enviar aviso</button></div>
      <div class="section-label">Skins de evento (lendárias)</div>
      <p class="muted small-text">Só aparecem na loja enquanto estiverem à venda, pelo preço que você escolher. Também podem ser prêmio de evento.</p><div class="list">`;
    for (const sk of SKINS.filter(q => q.evento)) {
      const pr = MUNDO.vendas[sk.id];
      html += `<div class="row admin-row">${skinThumb(sk.id)}<span class="name"><b>${escapeHtml(sk.nome)}</b><small>${pr != null ? 'À venda por ' + pr + ' moedas' : 'Fora da loja'}</small></span>
        <span class="admin-btns"><input type="number" class="venda-preco" data-venda-preco="${sk.id}" min="1" max="9999999" value="${pr ?? sk.preco}" aria-label="Preço">
        <button type="button" class="btn ${pr != null ? '' : 'btn-gold'}" data-ev="venda" data-id="${sk.id}">${pr != null ? 'Mudar preço' : 'Pôr à venda'}</button>
        ${pr != null ? `<button type="button" class="btn btn-danger" data-ev="venda-tirar" data-id="${sk.id}">Tirar da loja</button>` : ''}</span></div>`;
    }
    html += `</div><div class="section-label">Eventos com data (Natal, Páscoa…)</div><div class="list">`;
    if (!MUNDO.eventos.length) html += '<div class="empty">Nenhum evento. Crie abaixo.</div>';
    for (const ev of MUNDO.eventos) {
      const zn = MUNDO.zonas.find(z => z.id === ev.zona);
      html += `<div class="row admin-row"><span class="sw" style="background:${ev.tipo === 'natal' ? '#d9413a' : ev.tipo === 'pascoa' ? '#e8a8d0' : '#7fd0e0'}"></span>
        <span class="name"><b>${escapeHtml(ev.nome)}${eventoNoAr(ev) ? ' · no ar' : ''}</b><small>${ev.inicio} a ${ev.fim} · ${zn ? escapeHtml(zn.nome) : 'sem área'} · ${premioNome(ev.premio)} · ${ev.limite} por jogador${ev.ativo ? '' : ' · desligado'}</small></span>
        <span class="admin-btns"><button type="button" class="btn" data-ev="ev-agora" data-id="${ev.id}">Começar hoje</button>
          <button type="button" class="btn" data-ev="ev-toggle" data-id="${ev.id}">${ev.ativo ? 'Desligar' : 'Ligar'}</button>
          <button type="button" class="btn btn-danger" data-ev="ev-del" data-id="${ev.id}">Apagar</button></span></div>`;
    }
    html += `</div><div class="ev-form">
      <select id="ev-tipo" aria-label="Personagem"><option value="natal">Papai Noel</option><option value="pascoa">Coelho da Páscoa</option><option value="outro">Mensageiro (outro evento)</option></select>
      <input id="ev-nome" type="text" maxlength="30" placeholder="Nome (ex.: Natal 2026)">
      <select id="ev-zona" aria-label="Área">${zonasOp}</select>
      <label>De <input id="ev-ini" type="date" value="${hoje().slice(0, 4)}-12-25"></label><label>até <input id="ev-fim" type="date" value="${hoje().slice(0, 4)}-12-25"></label>
      ${selPremio('id="ev-premio" aria-label="Presente"', 'moedas:500')}
      <label>Presentes por jogador <input id="ev-lim" type="number" min="1" max="99" value="1"></label>
      <button type="button" class="btn btn-gold" data-ev="novo">Criar evento</button></div>`;
    const f = MUNDO.fugitivo;
    html += '<div class="section-label">Fugitivo</div>';
    html += f ? `<p class="muted small-text">${f.ativo ? (f.ganhador ? `Pego por ${escapeHtml(f.ganhador)}` : 'Solto agora') : 'Encerrado'} · ${BIOMES[regionOf(f.x, f.y)].nome} · prêmio: ${premioNome(f.premio)}</p>` : '<p class="muted small-text">Nenhum fugitivo solto.</p>';
    html += `<div class="ev-form">${selPremio('id="fug-premio" aria-label="Prêmio do fugitivo"', 'moedas:1000')}
      <button type="button" class="btn btn-gold" data-ev="fug-soltar">Soltar fugitivo aqui e anunciar</button>
      ${f && f.ativo && !f.ganhador ? '<button type="button" class="btn" data-ev="fug-parar">Encerrar</button>' : ''}</div>`;
    html += '<div class="section-label">Vilas de construtores</div><div class="list">';
    for (const v of MUNDO.vilas) {
      const casas = S.builds.filter(b => b.vila === v.id).length;
      html += `<div class="row admin-row"><span class="sw" style="background:#c9a34a"></span><span class="name"><b>${escapeHtml(v.nome)}</b><small>${BIOMES[regionOf(v.x, v.y)].nome} · ${v.n} construtores · ${casas} choupanas no seu mundo${v.ativo ? '' : ' · desligada'}</small></span>
        <span class="admin-btns"><button type="button" class="btn" data-ev="vila-move" data-id="${v.id}">Mover</button><button type="button" class="btn" data-ev="vila-menos" data-id="${v.id}">−1</button><button type="button" class="btn" data-ev="vila-mais" data-id="${v.id}">+1</button>
          <button type="button" class="btn" data-ev="vila-toggle" data-id="${v.id}">${v.ativo ? 'Desligar' : 'Ligar'}</button><button type="button" class="btn" data-ev="vila-ir" data-id="${v.id}">Ir</button><button type="button" class="btn btn-danger" data-ev="vila-del" data-id="${v.id}">Apagar</button></span></div>`;
    }
    html += `</div><div class="ev-form"><button type="button" class="btn btn-gold" data-ev="vila-nova">Criar vila onde estou</button></div>
      <p class="muted small-text">Cada construtor derrubado dá 50 moedas e, às vezes, um item raro:</p>
      <div class="ev-form">${selPremio('id="cons-premio" aria-label="Item raro"', MUNDO.construtores.premio)}
      <label>Chance (%) <input id="cons-chance" type="number" min="0" max="100" value="${Math.round((MUNDO.construtores.chance || 0) * 100)}"></label>
      <button type="button" class="btn" data-ev="cons-salvar">Salvar</button></div>`;
    box.innerHTML = html;
  }
  function renderZonas() {
    let box = document.getElementById('admin-zonas');
    if (!box) {
      box = document.createElement('div'); box.id = 'admin-zonas';
      $('admin-deposits').after(box);
      box.addEventListener('click', e => {
        const bt = e.target.closest('[data-zona]'); if (!bt) return;
        const a = bt.dataset.zona, zn = MUNDO.zonas.find(q => q.id === +bt.dataset.id);
        if (a === 'nova') { const p = S.p; MUNDO.zonas.push({ id: Date.now(), nome: 'Evento', x: Math.round(p.x), y: Math.round(p.y), r: 10, ativo: true }); toast('Área segura criada onde você está'); }
        else if (!zn) return;
        else if (a === 'move') adminMove = 'zona:' + zn.id;
        else if (a === 'toggle') zn.ativo = !zn.ativo;
        else if (a === 'mais') zn.r = Math.min(60, zn.r + 4);
        else if (a === 'menos') zn.r = Math.max(4, zn.r - 4);
        else if (a === 'del') MUNDO.zonas.splice(MUNDO.zonas.indexOf(zn), 1);
        else if (a === 'goto') { S.p.x = zn.x + 0.5; S.p.y = zn.y + 0.5; S.p.z = 0; interior = null; closeSheet(); return; }
        mundoSalvar('zonas'); renderAdmin();
      });
      box.addEventListener('change', e => {
        const inp = e.target.closest('[data-zona-nome]'); if (!inp) return;
        const zn = MUNDO.zonas.find(q => q.id === +inp.dataset.zonaNome); if (zn) { zn.nome = inp.value.trim().slice(0, 30) || 'Evento'; mundoSalvar('zonas'); }
      });
      box.addEventListener('keydown', e => e.stopPropagation());
    }
    let html = '<div class="section-label">Áreas seguras · eventos</div><div class="list">';
    for (const zn of MUNDO.zonas) html += `<div class="row admin-row"><span class="sw" style="background:#7fe08a"></span>
      <span class="name"><input class="zona-nome" data-zona-nome="${zn.id}" value="${escapeHtml(zn.nome)}" maxlength="30" aria-label="Nome da área">
        <small>${BIOMES[regionOf(zn.x, zn.y)].nome} · raio de ${zn.r} blocos · ${zn.ativo ? 'ativa' : 'desligada'}</small></span>
      <span class="admin-btns"><button type="button" class="btn" data-zona="move" data-id="${zn.id}">Mover</button>
        <button type="button" class="btn" data-zona="menos" data-id="${zn.id}">−</button><button type="button" class="btn" data-zona="mais" data-id="${zn.id}">+</button>
        <button type="button" class="btn" data-zona="toggle" data-id="${zn.id}">${zn.ativo ? 'Desligar' : 'Ligar'}</button>
        <button type="button" class="btn" data-zona="goto" data-id="${zn.id}">Ir</button>
        <button type="button" class="btn btn-danger" data-zona="del" data-id="${zn.id}">Apagar</button></span></div>`;
    html += '</div><div class="list-actions"><button type="button" class="btn btn-gold" data-zona="nova">Criar área segura onde estou</button></div>';
    box.innerHTML = html;
  }
  function renderCamps() {
    let box = document.getElementById('admin-camps');
    if (!box) {
      box = document.createElement('div'); box.id = 'admin-camps';
      $('admin-deposits').after(box);
      box.addEventListener('click', e => {
        const b = e.target.closest('[data-camp]');
        if (!b) return;
        const c = S.camps.find(q => q.id === +b.dataset.id);
        if (!c) return;
        const a = b.dataset.camp;
        if (a === 'move') adminMove = 'camp:' + c.id;
        else if (a === 'toggle') { c.ativo = !c.ativo; if (!c.ativo) S.mobs = S.mobs.filter(m => m.camp !== c.id); toast(c.ativo ? 'Acampamento ativado' : 'Acampamento desligado: os saqueadores sumiram'); }
        else if (a === 'add') { c.n = Math.min(4, c.n + 1); }
        else if (a === 'sub') { c.n = Math.max(1, c.n - 1); S.mobs = S.mobs.filter((m, i, arr) => m.camp !== c.id || arr.filter(o => o.camp === c.id).indexOf(m) < c.n); }
        else if (a === 'goto') { const pos = grassNear(c.x, c.y, 4, 10); if (pos) { S.p.x = pos[0]; S.p.y = pos[1]; S.p.z = 0; closeSheet(); toast('Você está perto do acampamento'); return; } }
        save(); renderAdmin();
      });
    }
    let html = '<div class="section-label">Acampamentos de saqueadores</div><div class="list">';
    for (const c of S.camps) {
      const vivos = S.mobs.filter(m => m.camp === c.id).length;
      html += `<div class="row admin-row"><span class="sw" style="background:#c8392b"></span>
        <span class="name"><b>${BIOMES[regionOf(c.x, c.y)].nome}</b><small>${c.ativo ? `bando de ${c.n} · ${vivos} por perto agora` : 'desligado'} · baú com ${c.bau} moedas</small></span>
        <span class="admin-btns">
          <button type="button" class="btn" data-camp="move" data-id="${c.id}">Mover</button>
          <button type="button" class="btn" data-camp="toggle" data-id="${c.id}">${c.ativo ? 'Desligar' : 'Ligar'}</button>
          <button type="button" class="btn" data-camp="sub" data-id="${c.id}">−1</button>
          <button type="button" class="btn" data-camp="add" data-id="${c.id}">+1</button>
          <button type="button" class="btn" data-camp="goto" data-id="${c.id}">Ir</button>
        </span></div>`;
    }
    box.innerHTML = html + '</div>';
  }
  function renderAdmin() {
    const online = NET.enabled;
    $('admin-players-wrap').hidden = !online;
    $('admin-world').hidden = online && !NET.isAdmin;   // moderador só vê jogadores
    $('admin-title').textContent = online ? (NET.isAdmin ? 'Administrador' : 'Moderação') : 'Administrador';
    $('admin-note').textContent = online
      ? (NET.isAdmin ? 'Só você vê este painel. Seu perfil fica invisível para os jogadores.' : 'Ações de moderação ficam registradas para o administrador.')
      : 'Modo de teste local. Com contas ligadas, este painel só abre para a equipe, conferido pelo servidor.';
    if (online) refreshPlayers();
    rebuildMiniBase();
    drawMinimap();
    staffExtras();
    const mode = $('admin-mode');
    if (adminMove === 'tp' || (typeof adminMove === 'string' && (adminMove.startsWith('camp:') || adminMove.startsWith('zona:') || adminMove.startsWith('vila:')))) {
      mode.hidden = false;
      mode.innerHTML = `${adminMove === 'tp' ? 'Toque no mapa para onde quer ir.' : adminMove.startsWith('zona:') ? 'Toque no mapa para o novo lugar da área segura.' : adminMove.startsWith('vila:') ? 'Toque no mapa para o novo lugar da vila.' : 'Toque no mapa para o novo lugar do acampamento.'} <button type="button" class="btn" data-admin="cancel">Cancelar</button>`;
    } else if (adminMove !== null) {
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
    renderCamps();
    renderZonas();
    renderEventos();
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
    if (adminMove === 'tp') {   // teleporte da equipe
      adminMove = null;
      const pos = grassNear(clamp(x, 3, W - 4), clamp(y, 3, H - 4), 0, 10);
      if (!pos) { toast('Não achei chão livre ali', 'warn'); return; }
      S.p.x = pos[0]; S.p.y = pos[1]; S.p.z = 0; homing = null; interior = null;
      for (let k = 0; k < 20; k++) waterTick();
      closeSheet(); toast(`Teletransportado: ${BIOMES[regionOf(S.p.x, S.p.y)].nome}`, 'leaf'); sfx('magia');
      return;
    }
    if (typeof adminMove === 'string' && adminMove.startsWith('vila:')) {
      const v = MUNDO.vilas.find(q => q.id === adminMove.slice(5)); adminMove = null;
      if (v) { v.x = clamp(x, 8, W - 9); v.y = clamp(y, 8, H - 9); mundoSalvar('vilas'); toast(`Vila movida para ${BIOMES[regionOf(v.x, v.y)].nome}`); }
      renderAdmin(); return;
    }
    if (typeof adminMove === 'string' && adminMove.startsWith('zona:')) {
      const zn = MUNDO.zonas.find(q => q.id === +adminMove.slice(5));
      adminMove = null;
      if (zn) { zn.x = clamp(x, 4, W - 5); zn.y = clamp(y, 4, H - 5); toast(`Área segura movida para ${BIOMES[regionOf(zn.x, zn.y)].nome}`); mundoSalvar('zonas'); }
      renderAdmin(); return;
    }
    if (typeof adminMove === 'string' && adminMove.startsWith('camp:')) {
      const c = S.camps.find(q => q.id === +adminMove.slice(5));
      adminMove = null;
      if (c) { c.x = clamp(x, 6, W - 7); c.y = clamp(y, 6, H - 7); clearAround(c.x, c.y, 3); S.mobs = S.mobs.filter(m => m.camp !== c.id); toast(`Acampamento movido para ${BIOMES[regionOf(c.x, c.y)].nome}`); save(); }
      renderAdmin(); return;
    }
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
    else if (/^Digit[0-9]$/.test(e.code)) { const k = (+e.code.slice(5) + 9) % 10; if (slotEls[k] && !slotEls[k].b.hidden) selectTool(k); }
    else if (e.code === 'KeyQ' || e.code === 'KeyE') {
      let k = S.tool;
      do k = (k + (e.code === 'KeyQ' ? -1 : 1) + TOOLS.length) % TOOLS.length; while (slotEls[k] && slotEls[k].b.hidden);
      selectTool(k);
    }
    else if (e.code === 'KeyB') showSheet('sheet-shop');
    else if (e.code === 'KeyI') showSheet('sheet-shop', null, 'bag');
    else if (e.code === 'KeyH') goHome();
    else if (e.code === 'KeyG') gesto('um');
    else if (e.code === 'KeyJ') gesto('dois');
    else if (e.code === 'Enter' || e.code === 'KeyT') { e.preventDefault(); openChat(); }
    else if (e.code === 'KeyR') { S.tool = TOOLS.findIndex(t => t.id === 'muro'); invDirty = true; showSheet('sheet-build'); }
    else if (e.code === 'KeyP') secretTap();
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
  // o nome da ferramenta no meio da tela abre o modo construção
  $('toolname').addEventListener('click', () => { S.tool = TOOLS.findIndex(t => t.id === 'muro'); invDirty = true; showSheet('sheet-build'); });
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
      const eq = e.target.closest('[data-equip]');
      if (eq) { S.tirado = S.tirado || {}; S.tirado[eq.dataset.equip] = wearing(eq.dataset.equip); toast(wearing(eq.dataset.equip) ? 'Capacete colocado' : 'Capacete guardado na mochila'); save(); renderShop(); return; }
      const gf = e.target.closest('[data-gift]');
      if (gf) {
        if (gf.dataset.gift && !(NET.enabled && NET.user)) { toast('Para presentear, entre na sua conta (precisa das contas ligadas)', 'warn', 3500); return; }
        giftOpen = gf.dataset.gift || null; renderShop(); const inp = document.getElementById('gift-code'); if (inp) inp.focus(); return;
      }
      const gs = e.target.closest('[data-giftsend]');
      if (gs) {
        const id = gs.dataset.giftsend, code = (document.getElementById('gift-code').value || '').trim().toUpperCase();
        if (!/^TF-[A-Z0-9]{6}$/.test(code)) { toast('Digite o código no formato TF-XXXXXX', 'warn'); return; }
        gs.disabled = true;
        save(true);
        NET.giftSkin(code, id).then(nome => {
          S.skins = (S.skins || []).filter(x => x !== id); if (S.skin === id) S.skin = null;
          giftOpen = null; invDirty = true; save(true);
          toast(`Skin enviada para ${nome}!`, 'gold', 4000); renderShop();
        }).catch(err => { gs.disabled = false; toast(err.message, 'warn', 4000); });
        return;
      }
      const dc = e.target.closest('[data-discard]');
      if (dc) {
        const id = dc.dataset.discard;
        if (!dc.dataset.armed) { dc.dataset.armed = 1; dc.textContent = 'Confirmar?'; setTimeout(() => { if (dc.isConnected) { delete dc.dataset.armed; dc.textContent = 'Descartar'; } }, 3500); return; }
        delete S.owned[id]; delete S.dur[id];
        if (['arco', 'cetro', 'livro'].includes(TOOLS[S.tool].id) && !S.owned[TOOLS[S.tool].id]) S.tool = 0;
        toast(`Descartou: ${SHOP.find(x => x.id === id).nome}`); invDirty = true; save(); renderShop(); return;
      }
      const tr = e.target.closest('[data-trash]');
      if (tr) {
        const k = tr.dataset.trash;
        if (!tr.dataset.armed) { tr.dataset.armed = 1; tr.textContent = 'Confirmar?'; setTimeout(() => { if (tr.isConnected) { delete tr.dataset.armed; tr.textContent = 'Jogar fora'; } }, 3500); return; }
        const n = S.inv[k] || 0; S.inv[k] = 0; invDirty = true; toast(`Jogou fora ${n} ${ITEMS[k].nome.toLowerCase()}`); save(); renderShop(); return;
      }
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
        dropCarry();
        if (k === 'nada') { S.sel = { k: 'nada' }; invDirty = true; renderBuild(); return; }   // tocar em "Escolhido" desmarca
        S.sel = k === 'kit' ? { k, id: v } : { k, m: +v };
        S.tool = TOOLS.findIndex(t => t.id === 'muro'); invDirty = true; closeSheet();
        if (k === 'kit') hint('colocar', 'Fique de frente para o lugar: a prévia fica verde quando cabe. Use para construir.');
        return;
      }
      if (e.target.closest('[data-pickup]')) { closeSheet(); pickUp(); return; }
      const ac = e.target.closest('[data-bacesso]');
      if (ac) {
        const b = S.builds[+ac.dataset.bacesso], ks = Object.keys(ACESSO);
        if (b) { b.acesso = ks[(ks.indexOf(b.acesso || 'so_eu') + 1) % ks.length]; toast(`Entrada: ${ACESSO[b.acesso]}`); save(); }
        renderBuild(); return;
      }
      const bp = e.target.closest('[data-bpick]') || e.target.closest('[data-bsell]');
      if (bp) {
        const sellIt = !!bp.dataset.bsell, [tag, idx] = (bp.dataset.bsell || bp.dataset.bpick).split(':');
        if (tag === 'bot') {
          const b = S.bots[+idx];
          if (b) { collectBot(b, true); S.bots.splice(+idx, 1);
            const kb = BUILDS[kitOfBot(b)];
            if (sellIt) { S.coins += Math.floor(kb.preco / 2); sfx('moeda'); toast(`${kb.nome} vendido: +${Math.floor(kb.preco / 2)} moedas`, 'gold'); }
            else { S.kit[kitOfBot(b)] = (S.kit[kitOfBot(b)] || 0) + 1; toast(`${kb.nome} guardado`, 'leaf'); }
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
    dpr = Math.min(window.devicePixelRatio || 1, GRAF.alta ? 2 : 1.5);
    vw = canvas.clientWidth; vh = canvas.clientHeight;
    canvas.width = Math.round(vw * dpr); canvas.height = Math.round(vh * dpr);
    lightCv.width = Math.ceil(canvas.width / 4); lightCv.height = Math.ceil(canvas.height / 4);   // a luz é suave: meia resolução basta
    chunkCache.clear();
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
    if (z > 0 && UNDER_ART[t]) return drawTileRot(UNDER_ART[t], x, y, sx, sy);
    const b = z === 0 ? BIOMES[S.biome[y * W + x]].id : null;
    const ground = () => z > 0 ? drawTileArt('floor_' + v, sx, sy, tp) : drawGroundTile(b, x, y, sx, sy);
    const cx = sx + tp / 2, bottom = sy + tp;
    switch (t) {
      case T.AIR: case T.GRASS: return ground();
      case T.TREE: case T.SAPLING: ground(); arvoreObj(t, b, x, y, cx, bottom, objs); return true;
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
      const em = !acting && !moving && tool === 'maos' && S.p.emote && performance.now() < S.p.emote.ate ? S.p.emote.tipo : null;
      if (moving && S.p.emote) S.p.emote = null;   // andar abaixa as mãos
      const tem = n => ATLAS[`${c}_${n}`] ? `${c}_${n}` : null;
      if (em) {
        const v = dir === 0 ? 'front' : dir === 1 ? 'back' : 'side';
        name = tem(`swing_gesto_${em}_${v}`) || tem(`swing_gesto_${em}_front`);
        if (dir < 2 && name) flip = false;
      }
      if (name) { /* gesto */ }
      else if (acting) {
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
      const ranged = (tool === 'arco' || tool === 'cetro' || tool === 'livro') && S.owned[tool];
      const holding = !acting && !em && tool !== 'maos' && tool !== 'muro' && !ranged;
      // de lado e de costas: ferramenta atrás do corpo, com o cabo passando pelo punho
      let grip = null;
      if (holding && dir !== 0) grip = drawHeld(tool, name, sx, sy + 6 * u, ph, flip, dir, moving, phase);
      if (ranged && !em && dir === 1) drawWeapon(tool, name, sx, sy + 6 * u, ph, flip, dir);
      const drawn = drawObj(name, sx, sy + 6 * u, ph, flip);
      if (ranged && !em && dir !== 1 && drawn) drawWeapon(tool, name, sx, sy + 6 * u, ph, flip, dir);
      // de frente: pendurada na mão ao lado da perna
      if (holding && dir === 0 && drawn) grip = drawHeld(tool, name, sx, sy + 6 * u, ph, flip, dir, moving, phase);
      // punho fechado por cima do cabo (de costas a mão fica do outro lado do cabo)
      if (grip && dir !== 1 && !drawFistArt(grip, u) && dir === 0) drawHandOver(name, sx, sy + 6 * u, ph, flip);
      if (drawn) {
        if (acting && !toolDrawn) drawSwing(tool, sx, sy, u, dir);
        if (wearing('capacete') && !drawHelmet(name, sx, sy + 6 * u, ph, flip, dir)) {   // sem arte do capacete: versão simples
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
    ctx.fillStyle = wearing('capacete') ? '#e3b23c' : '#4a2e1c';
    ctx.fillRect(x0 + 0.5 * u, y0, 7 * u, (dir === 1 ? 6 : 2.2) * u);
    if (wearing('capacete') && dir !== 1) { ctx.fillStyle = '#fff6c8'; ctx.fillRect(x0 + 3 * u, y0 + 0.4 * u, 2 * u, 1.2 * u); }
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
      if (b.flip) { ctx.save(); ctx.translate(x + w, y); ctx.scale(-1, 1); ctx.drawImage(art2, r[0], r[1], r[2], r[3], 0, 0, w, h); ctx.restore(); }
      else ctx.drawImage(art2, r[0], r[1], r[2], r[3], x, y, w, h);
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
        // atrás da casa (paredes do fundo): a casa fica meio transparente e você passa por trás;
        // na frente e dos lados da frente: você fica por cima do desenho
        const a = d.w / 2, ox = Math.abs(p.x - b.x - a), cy = b.y + d.h / 2;
        const behind = ox < a + 0.8 && p.y < cy - 0.3 && p.y > topY + 0.2;
        ents.push({ y: key, f: () => drawBuild(b, d.img, camX, camY, behind ? 0.55 : 1) });
        fronts.push({ b, d, key, casa: true, topY, behind });
      } else if (d.tipo === 'forte') {
        // muros altos: dentro do forte a frente fica transparente; atrás dele, o fundo
        const a = d.w / 2, ox = Math.abs(p.x - b.x - a);
        const behind = b !== fort && ox < a && p.y < b.y + d.h / 2 - (d.h / 2) * Math.max(0, 1 - ox / a) && p.y > topY + 0.4;
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
    if (TOOLS[S.tool].id !== 'muro' || openSheet) return;
    if (S.sel.k === 'nada') return;
    if (S.sel.k !== 'kit') {   // muros: mostra onde vai ficar (verde cabe, vermelho não) ou o muro que será ajustado
      const tg = target(), t = tileAt(tg.x, tg.y, tg.z), x0 = tg.x * tp - camX, y0 = tg.y * tp - camY;
      const edit = ['girar', 'remover'].includes(S.sel.k) || (S.sel.k === 'mover' && !S.sel.carry);
      const free = tg.z === 0 ? (t === T.GRASS || t === T.TILLED) : t === T.AIR;
      const ok = edit ? isWallT(t) : (free || (isWallT(t) && S.sel.k !== 'mover'));
      const w = S.sel.k === 'mover' ? S.sel.carry && S.sel.carry.w : S.sel.m || 0;
      if (!edit && ok && art2) {
        const mat = (WALL_MATS[(w || 0) & 15] || WALL_MATS[0]).id, gate = S.sel.k === 'portao' || (S.sel.carry && S.sel.carry.gate);
        const r = ATLAS2[`muro_${mat}_${gate ? 'portao' : 'h'}`];
        if (r) { const k = tp / 96, ww = gate ? r[2] * k : tp, hh = r[3] * k; ctx.globalAlpha = 0.5; ctx.drawImage(art2, r[0], r[1], r[2], r[3], x0 + tp / 2 - ww / 2, y0 + tp * 1.04 - hh, ww, hh); ctx.globalAlpha = 1; }
      }
      ctx.strokeStyle = !ok ? 'rgba(235,80,60,0.95)' : S.sel.k === 'remover' ? 'rgba(240,120,60,0.95)' : 'rgba(140,230,120,0.95)';
      ctx.lineWidth = Math.max(2, tp / 16); ctx.strokeRect(x0 + 1, y0 + 1, tp - 2, tp - 2);
      return;
    }
    if (!(S.kit[S.sel.id] > 0)) return;
    const d = BUILDS[S.sel.id];
    if (d.tipo === 'robo') return;
    const c = candidate(S.sel.id), bad = placeProblem(c);
    const show = { k: d.tipo === 'forte' && d.arte ? d.arte : c.k, x: c.x, y: c.y, flip: !!S.sel.flip };
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
    const i = I(x, y, z), mat = (WALL_MATS[S.wmat[i] & 15] || WALL_MATS[0]).id, rot = S.wmat[i] >> 4;
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
      if (rot === 1) { half('L'); half('R'); return; }   // girado: deitado
      if (rot === 2) { const w = vr[2] * k, h = vr[3] * k; ctx.drawImage(art2, vr[0], vr[1], vr[2], vr[3], cx - w / 2, bottom - h - tp * 0.5, w, h); post(); return; }   // em pé
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
    if (b.tipo === 'fazenda') {   // ajudante de fazenda (npc_ajudante.jpg)
      const v = BOT_VIEW[b.face], n = framesOf('faz', v);
      let nm = b.mode === 'dig' ? `faz_${b.job && b.job.act === 'plantar' ? 'plantar' : 'colher'}_${Math.floor(b.phase) % 2}`
        : b.moving && n ? `faz_${v}_${Math.floor(b.phase) % n}` : !b.job && (b.still || 0) > 5 ? 'faz_sentado' : `faz_${v}_0`;   // só senta depois de 5 s parado
      if (b.happy > performance.now()) nm = 'faz_feliz';
      if (drawObj(nm, sx, bottom, 1.25 * tp, flip)) return;
      ctx.filter = 'hue-rotate(75deg) saturate(1.3)';
    }
    const ok = drawObj(name, sx, bottom, h, flip);
    ctx.filter = 'none';
    if (ok) {
      if (b.tipo === 'fazenda') { ctx.fillStyle = '#d9b44a'; ctx.beginPath(); ctx.ellipse(sx, bottom - h * 0.93, tp * 0.34, tp * 0.09, 0, 0, 6.28); ctx.fill(); ctx.fillRect(sx - tp * 0.16, bottom - h * 1.04, tp * 0.32, tp * 0.12); }   // chapéu de palha
      return;
    }
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
  // ---- Dentro de casa: cena própria, com o interior ampliado (como descer para o subsolo)
  let interior = null;
  function enterHouse(b) {
    const d = BUILDS[b.k];
    if (!canEnter(b)) { toast(`${d.nome} trancada: só entra quem o dono convidar`, 'warn'); return; }
    interior = b; homing = null; roomOf(b);
    RP.x = 0.6; RP.y = roomSize(b) - 1.5; RP.dir = 3;   // entra pela porta, no canto da frente
    for (let k = 0; k < 20 && roomBlocked(b, RP.x, RP.y); k++) RP.x += 0.5;
    sfx('construir'); updateDoorBtn();
    hint('decorar', 'Para sair, vá até a porta. Decorar fica no canto de cima.');
  }
  function leaveHouse() {
    const b = interior; if (!b) return;
    const d = BUILDS[b.k], [qx, qy] = doorPoint(b), cx = b.x + d.w / 2, cy = b.y + d.h / 2;
    let ux = qx - cx, uy = qy - cy; const L = Math.hypot(ux, uy) || 1; ux /= L; uy /= L;
    interior = null;
    for (const dist of [1.2, 1.6, 2.2, 3, 4]) for (const side of [0, 0.5, -0.5, 1, -1]) {
      const nx = qx + ux * dist - uy * side, ny = qy + uy * dist + ux * side;
      if (canStand(nx, ny, 0, 0.3, 'jogador') && !insideOf(nx, ny, 'casa')) { S.p.x = nx; S.p.y = ny; S.p.dir = 0; sfx('construir'); updateDoorBtn(); return; }
    }
    S.p.x = S.home.x; S.p.y = S.home.y; updateDoorBtn();
  }
  function houseNear() {
    if (interior || S.p.z !== 0) return null;
    const tg = target();
    let best = null, bd = 2.4;
    for (const b of S.builds) {
      if (BUILDS[b.k].tipo !== 'casa') continue;
      const [qx, qy] = doorPoint(b), dd = Math.hypot(qx - S.p.x, qy - S.p.y);
      const touch = shapeHit(b, tg.x + 0.5, tg.y + 0.5) || shapeHit(b, S.p.x, S.p.y - 0.6);
      if ((touch || dd < bd) && (!best || dd < bd)) { best = b; bd = Math.min(bd, dd); }
    }
    return best;
  }
  const doorBtn = document.createElement('button');
  doorBtn.type = 'button'; doorBtn.className = 'btn btn-gold door-btn'; doorBtn.hidden = true;
  doorBtn.addEventListener('click', () => { if (interior) leaveHouse(); else { const b = houseNear(); if (b) enterHouse(b); } });
  document.getElementById('app').append(doorBtn);
  const editBar = document.createElement('div');
  editBar.className = 'edit-bar'; editBar.hidden = true;
  document.getElementById('app').append(editBar);
  let editSig = '';
  function frontThing() {   // o que está na sua frente: construção, robô ou muro
    if (S.p.z !== 0 && !interior) return null;
    const r = pickupTarget();
    if (r) return r;
    const tg = target(), t = tileAt(tg.x, tg.y, tg.z);
    return isWallT(t) ? { wall: tg } : null;
  }
  function updateEditBar() {
    if (!S || openSheet || TOOLS[S.tool].id !== 'muro') { if (!editBar.hidden) editBar.hidden = true; editSig = ''; return; }
    let sig, html;
    if (interior) {
      const it = roomItemFront(interior);
      if (S.sel.k === 'kit' && S.kit[S.sel.id] > 0) { sig = 'rk' + S.sel.id; html = `<span>${BUILDS[S.sel.id].nome}</span><button type="button" class="btn" data-ed="girarkit">Girar</button><button type="button" class="btn" data-ed="cancelar">Cancelar</button>`; }
      else if (it) { sig = 'ri' + it.x + ',' + it.y; html = `<span>${BUILDS[it.k].nome}</span><button type="button" class="btn" data-ed="rmover">Mover</button><button type="button" class="btn" data-ed="rgirar">Girar</button><button type="button" class="btn" data-ed="rguardar">Guardar</button><button type="button" class="btn btn-danger" data-ed="rvender">Vender</button>`; }
      else { sig = 'rnone'; html = ''; }
      if (sig !== editSig) { editSig = sig; editBar.innerHTML = html; }
      editBar.hidden = !html; return;
    }
    if (S.sel.k === 'kit' && S.kit[S.sel.id] > 0) {
      sig = 'kit' + S.sel.id;
      html = `<span>${BUILDS[S.sel.id].nome}</span><button type="button" class="btn" data-ed="girarkit">Girar</button><button type="button" class="btn" data-ed="cancelar">Cancelar</button>`;
    } else if (S.sel.k === 'mover' && S.sel.carry) {
      sig = 'carry'; html = '<span>Segurando um muro</span><button type="button" class="btn" data-ed="soltar">Devolver</button>';
    } else {
      const f = frontThing();
      if (!f) { sig = 'none'; html = ''; }
      else if (f.wall) {
        sig = 'wall' + f.wall.x + ',' + f.wall.y;
        html = '<span>Muro</span><button type="button" class="btn" data-ed="wmover">Mover</button><button type="button" class="btn" data-ed="wgirar">Girar</button><button type="button" class="btn btn-danger" data-ed="wremover">Remover</button>';
      } else {
        const nome = f.bot ? BUILDS[kitOfBot(f.bot)].nome : BUILDS[f.b.k].nome;
        sig = 'b' + (f.bot ? 'bot' : S.builds.indexOf(f.b));
        html = `<span>${nome}</span><button type="button" class="btn" data-ed="mover">Mover</button>${f.bot ? '' : '<button type="button" class="btn" data-ed="girar">Girar</button>'}<button type="button" class="btn" data-ed="guardar">Guardar</button><button type="button" class="btn btn-danger" data-ed="vender">Vender</button>`;
      }
    }
    if (sig !== editSig) { editSig = sig; editBar.innerHTML = html; }
    editBar.hidden = !html;
  }
  editBar.addEventListener('click', e => {
    const bt = e.target.closest('[data-ed]');
    if (!bt) return;
    const a = bt.dataset.ed;
    if (a[0] === 'r' && interior && a !== 'remover') { roomEdit(a.slice(1)); editSig = ''; updateEditBar(); return; }
    if (a === 'girarkit') { S.sel.flip = !S.sel.flip; sfx('toque'); }
    else if (a === 'cancelar') { S.sel = { k: 'nada' }; toast('Guardado em Construir → Suas construções'); }
    else if (a === 'soltar') { dropCarry(); S.sel = { k: 'nada' }; }
    else if (a.startsWith('w')) {
      const tg = target(), i = I(tg.x, tg.y, tg.z), keep = S.sel;
      S.sel = { k: a.slice(1) };
      wallEdit(tg.x, tg.y, tg.z, S.tiles[i], i);
      if (a !== 'wmover') S.sel = keep;
    } else {
      const f = frontThing();
      if (!f || f.wall) return;
      if (f.bot) {
        const idx = S.bots.indexOf(f.bot); collectBot(f.bot, true); S.bots.splice(idx, 1);
        const kk = kitOfBot(f.bot), kb = BUILDS[kk];
        if (a === 'vender') { S.coins += Math.floor(kb.preco / 2); sfx('moeda'); toast(`${kb.nome} vendido: +${Math.floor(kb.preco / 2)} moedas`, 'gold'); }
        else { S.kit[kk] = (S.kit[kk] || 0) + 1; if (a === 'mover') { S.sel = { k: 'kit', id: kk }; toast('Escolha o novo lugar e use para colocar', 'leaf'); } else toast('Robô guardado', 'leaf'); }
      } else if (a === 'girar') { f.b.flip = !f.b.flip; sfx('toque'); }
      else {
        const k = f.b.k, flip = f.b.flip, muralha = k === 'muralha';
        removeBuild(f.b, a === 'vender');
        if (a === 'mover') { S.sel = { k: 'kit', id: muralha && !S.kit.muralha ? 'muralha_vila' : k, flip }; toast('Escolha o novo lugar e use para colocar', 'leaf'); }
      }
    }
    invDirty = true; save(); editSig = ''; updateEditBar();
  });
  const decorBtn = document.createElement('button');
  decorBtn.type = 'button'; decorBtn.className = 'btn decor-btn'; decorBtn.hidden = true; decorBtn.textContent = 'Decorar';
  decorBtn.addEventListener('click', () => { if (interior) { showSheet('sheet-decor'); renderDecor(); } });
  document.getElementById('app').append(decorBtn);
  function updateDoorBtn() {
    if (!S) return;
    decorBtn.hidden = !interior || !!openSheet;
    const b = interior || houseNear();
    // dentro: o botão Sair só aparece perto da porta (canto da frente, na parede da esquerda)
    const naPorta = interior && RP.x < 1.8 && RP.y > roomSize(interior) - 3.6;
    const txt = interior ? (naPorta ? 'Sair' : '') : b ? `Entrar · ${BUILDS[b.k].nome}` : '';
    doorBtn.hidden = !txt || !!openSheet;
    if (txt && doorBtn.textContent !== txt) doorBtn.textContent = txt;
  }
  // ================= Cômodo da casa (estilo Habbo) =================
  // Cada casa tem um cômodo próprio em losangos: 10 × 10 na casa comum, 30 × 30 no castelo.
  // O dono escolhe a cor do chão e das paredes e coloca os móveis onde quiser (b.room).
  const PISOS = { madeira: ['#9a6a3e', '#8a5c34'], clara: ['#d8b98a', '#c9a874'], pedra: ['#8d9096', '#7d8086'], xadrez: ['#e8e2d6', '#2a2622'],
    verde: ['#5f9a4e', '#53893f'], azul: ['#4a74b8', '#3f67a8'], vermelho: ['#b8493f', '#a63f36'], rosa: ['#e08cb4', '#d07ca4'], roxo: ['#8a5cc0', '#7b4fb0'], preto: ['#2e2a30', '#26222a'] };
  const PAREDES = { creme: '#e6d8b8', madeira: '#7a5230', pedra: '#6f7278', branca: '#f0eee8', azul: '#5d7fb5', verde: '#6e9a5e', vinho: '#7a2f3a', preta: '#2a2628' };
  const roomSize = b => (b.k === 'castelo' ? 45 : b.k === 'choupana' ? 10 : 15);
  function roomOf(b) {
    if (!b.room) b.room = { piso: 'madeira', parede: 'creme', itens: [] };
    const N = roomSize(b);   // cômodo diminuiu: o que ficou fora volta para "Suas construções"
    b.room.itens = b.room.itens.filter(it => { const f = FOOT[it.k] || [1, 1], [fw, fh] = it.flip ? [f[1], f[0]] : f;
      if (it.x + fw <= N && it.y + fh <= N) return true; S.kit[it.k] = (S.kit[it.k] || 0) + 1; return false; });
    return b.room;
  }
  const RP = { x: 5, y: 9, dir: 1 };
  // móveis do cômodo: blocos ocupados [ao longo de x, ao longo de y]; girar troca os dois. tapete não bloqueia.
  const FOOT = { cama: [2, 1], cama_casal: [2, 2], cama_dossel: [2, 2], sofa: [2, 1], mesinha: [2, 1], mesa: [2, 1], pia: [2, 1], lareira: [2, 1], tapete: [2, 2] };
  const ISO_REF = 83;   // pixels do atlas por largura de bloco (escala das folhas de móveis)
  const foot = it => { const f = FOOT[it.k] || [1, 1]; return it.flip ? [f[1], f[0]] : f; };
  const occupies = (it, x, y) => { const [fw, fh] = foot(it); return x >= it.x && x < it.x + fw && y >= it.y && y < it.y + fh; };   // posição no cômodo (em blocos do cômodo)
  function roomIso(x, y, ox, oy, tw) { return [ox + (x - y) * tw / 2, oy + (x + y) * tw / 4]; }
  // tamanho do losango: o cômodo pequeno cabe inteiro na tela; o castelo segue o jogador
  function roomTw(b) {
    const N = roomSize(b), W2 = canvas.width, H2 = canvas.height;
    return N <= 10 ? Math.min(W2 * 0.94 / N, H2 * 0.62 / (N / 2 + 2.5)) : Math.min(tp * 1.3, W2 / 8);
  }
  function roomBlocked(b, x, y) {
    const N = roomSize(b);
    if (x < 0.25 || y < 0.25 || x > N - 0.25 || y > N - 0.25) return true;
    return roomOf(b).itens.some(it => it.k !== 'tapete' && occupies(it, Math.floor(x), Math.floor(y)));
  }
  // direção da tela → direção no cômodo (a tela é girada 45°)
  const SCR = [[0, 1], [0, -1], [-1, 0], [1, 0]];
  function scrToRoom(sx, sy) { return [sx + sy, sy - sx]; }
  function roomFrontTile(b) {
    const [dx, dy] = scrToRoom(...SCR[RP.dir]), L = Math.hypot(dx, dy) || 1;
    const fx = Math.floor(RP.x) + Math.sign(dx), fy = Math.floor(RP.y) + Math.sign(dy), N = roomSize(b);   // bloco vizinho na diagonal da tela
    return fx < 0 || fy < 0 || fx >= N || fy >= N ? null : { x: fx, y: fy };
  }
  function roomItemFront(b) {
    const f = roomFrontTile(b);
    if (!f) return null;
    const its = roomOf(b).itens.filter(it => occupies(it, f.x, f.y));
    return its.find(it => it.k !== 'tapete') || its[0] || null;
  }
  function roomMove(dt) {
    const b = interior;
    let vx = (held.right ? 1 : 0) - (held.left ? 1 : 0), vy = (held.down ? 1 : 0) - (held.up ? 1 : 0);
    moving = !!(vx || vy) && !openSheet;
    if (!moving) return;
    if (lastDir && held[lastDir]) RP.dir = { down: 0, up: 1, left: 2, right: 3 }[lastDir];
    else RP.dir = vy > 0 ? 0 : vy < 0 ? 1 : vx < 0 ? 2 : 3;
    const L = Math.hypot(vx, vy), sp = SPEED * 0.75 * dt;
    let [dx, dy] = scrToRoom(vx / L, vy / L); const L2 = Math.hypot(dx, dy) || 1; dx = dx / L2 * sp; dy = dy / L2 * sp;
    if (!roomBlocked(b, RP.x + dx, RP.y)) RP.x += dx;
    if (!roomBlocked(b, RP.x, RP.y + dy)) RP.y += dy;
    walkPhase += dt * 12;
  }
  // Construir dentro de casa: coloca, tira e gira móveis
  function roomUse(tool) {
    const b = interior;
    if (tool !== 'muro') { actHeld = false; return; }
    if (S.sel.k !== 'kit' || !BUILDS[S.sel.id] || BUILDS[S.sel.id].tipo !== 'movel') {
      actHeld = false; toast('Dentro de casa: escolha um móvel em Construir (ou abra Decorar)'); showSheet('sheet-build'); return;
    }
    if (b.dono && b.dono !== 'eu' && b.dono !== myId()) { toast('Só o dono decora esta casa', 'warn'); return; }
    const k = S.sel.id, f = roomFrontTile(b);
    if (!(S.kit[k] > 0)) { toast(`Você não tem ${BUILDS[k].nome.toLowerCase()}. Compre na loja.`, 'warn'); return; }
    const novo = { k, x: f ? f.x : 0, y: f ? f.y : 0, flip: !!S.sel.flip }, [fw, fh] = foot(novo), N = roomSize(b), R0 = roomOf(b);
    let livre = !!f && f.x + fw <= N && f.y + fh <= N;
    for (let yy = novo.y; livre && yy < novo.y + fh; yy++) for (let xx = novo.x; livre && xx < novo.x + fw; xx++) {
      if (Math.floor(RP.x) === xx && Math.floor(RP.y) === yy && k !== 'tapete') livre = false;
      if (R0.itens.some(it => occupies(it, xx, yy) && (it.k === 'tapete') === (k === 'tapete'))) livre = false;
    }
    if (!livre) { toast('Não cabe aí: escolha um lugar livre na sua frente', 'warn'); cooldown = 0.4; return; }
    S.kit[k]--; R0.itens.push(novo);
    sfx('construir'); cooldown = 0.3;
    if (!(S.kit[k] > 0)) S.sel = { k: 'nada' };
    invDirty = true; save();
  }
  function roomEdit(a) {
    const b = interior, it = roomItemFront(b);
    if (!it) return;
    const R = roomOf(b);
    if (a === 'girar') it.flip = !it.flip;
    else {
      R.itens.splice(R.itens.indexOf(it), 1);
      if (a === 'vender') { const v = Math.floor(BUILDS[it.k].preco / 2); S.coins += v; sfx('moeda'); toast(`${BUILDS[it.k].nome} vendido: +${v} moedas`, 'gold'); }
      else { S.kit[it.k] = (S.kit[it.k] || 0) + 1; if (a === 'mover') { S.sel = { k: 'kit', id: it.k, flip: it.flip }; S.tool = TOOLS.findIndex(t => t.id === 'muro'); toast('Fique de frente para o novo lugar e use', 'leaf'); } }
    }
    sfx('toque'); invDirty = true; save();
  }
  function renderRoom(now) {
    const b = interior, N = roomSize(b), R = roomOf(b), W2 = canvas.width, H2 = canvas.height, tw = roomTw(b), th = tw / 2;
    const piso = PISOS[R.piso] || PISOS.madeira, parede = PAREDES[R.parede] || PAREDES.creme, wallH = th * 5;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#0e0a08'; ctx.fillRect(0, 0, W2, H2);
    // câmera segue o jogador; cômodo pequeno fica centralizado
    const [px0, py0] = roomIso(RP.x, RP.y, 0, 0, tw);
    let ox = Math.round(W2 / 2 - px0), oy = Math.round(H2 * 0.5 - py0);
    if (N <= 10) { const [cx, cy] = roomIso(N / 2, N / 2, 0, 0, tw); ox = Math.round(W2 / 2 - cx); oy = Math.round(H2 * 0.47 - cy + wallH * 0.35); }
    const P = (x, y) => roomIso(x, y, ox, oy, tw);
    const poly = (pts, fill, stroke) => { ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (const q of pts.slice(1)) ctx.lineTo(q[0], q[1]); ctx.closePath(); ctx.fillStyle = fill; ctx.fill(); if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.stroke(); } };
    const shade = (hex, k) => { const n = parseInt(hex.slice(1), 16), r = Math.round(((n >> 16) & 255) * k), g = Math.round(((n >> 8) & 255) * k), bl = Math.round((n & 255) * k); return `rgb(${Math.min(255, r)},${Math.min(255, g)},${Math.min(255, bl)})`; };
    // paredes do fundo (esquerda e direita)
    const up = q => [q[0], q[1] - wallH];
    poly([P(0, 0), P(0, N), up(P(0, N)), up(P(0, 0))], shade(parede, 0.82));
    poly([P(0, 0), P(N, 0), up(P(N, 0)), up(P(0, 0))], parede);
    ctx.fillStyle = shade(parede, 0.6); ctx.fillRect(P(0, 0)[0] - 1, P(0, 0)[1] - wallH, 2, wallH);   // quina
    // rodapé
    poly([P(0, 0), P(0, N), [P(0, N)[0], P(0, N)[1] - th * 0.25], [P(0, 0)[0], P(0, 0)[1] - th * 0.25]], shade(parede, 0.55));
    poly([P(0, 0), P(N, 0), [P(N, 0)[0], P(N, 0)[1] - th * 0.25], [P(0, 0)[0], P(0, 0)[1] - th * 0.25]], shade(parede, 0.65));
    // chão em losangos
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const [qx, qy] = P(x + 0.5, y + 0.5);
      if (qx < -tw || qx > W2 + tw || qy < -th || qy > H2 + th) continue;   // só os losangos que aparecem na tela
      const c = R.piso === 'xadrez' ? piso[(x + y) & 1] : piso[((x * 7 + y * 3) % 5 === 0) ? 1 : 0];
      poly([P(x, y), P(x + 1, y), P(x + 1, y + 1), P(x, y + 1)], c, 'rgba(0,0,0,0.12)');
    }
    // porta (canto da frente à esquerda)
    const d0 = P(0, N - 2), d1 = P(0, N - 1);
    poly([d0, d1, [d1[0], d1[1] - th * 3.2], [d0[0], d0[1] - th * 3.2]], '#4a2e1c', '#2a1a10');
    ctx.font = `600 ${Math.round(tw * 0.22)}px "Pixelify Sans", monospace`; ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(20,17,15,0.75)'; const lx = (d0[0] + d1[0]) / 2, ly = (d0[1] + d1[1]) / 2 - th * 3.6;
    ctx.fillRect(lx - tw * 0.4, ly - tw * 0.2, tw * 0.8, tw * 0.28); ctx.fillStyle = '#efb941'; ctx.fillText('Saída', lx, ly); ctx.textAlign = 'left';
    // alvo na frente do jogador quando estiver construindo
    const f = TOOLS[S.tool].id === 'muro' && !openSheet ? roomFrontTile(b) : null;
    if (f) poly([P(f.x, f.y), P(f.x + 1, f.y), P(f.x + 1, f.y + 1), P(f.x, f.y + 1)], roomItemFront(b) ? 'rgba(240,180,60,0.35)' : 'rgba(140,230,120,0.3)', 'rgba(255,255,255,0.7)');
    // móveis e jogador por profundidade (x + y)
    const drawItem = it => {
      const od = BUILDS[it.k], iso = art2Rect('iso_' + it.k), r = iso || art2Rect(od.img); if (!r) return;
      const [fw, fh] = foot(it), front = P(it.x + fw, it.y + fh), mid = P(it.x + fw / 2, it.y + fh / 2);
      const w = iso ? r[2] * tw / ISO_REF : tw, h = w * r[3] / r[2];
      ctx.save(); ctx.translate(mid[0], front[1] - (it.k === 'tapete' ? th * fh * 0.5 - h * 0.5 : 0)); if (it.flip) ctx.scale(-1, 1);
      ctx.drawImage(art2, r[0], r[1], r[2], r[3], -w / 2, it.k === 'tapete' ? -h / 2 - th * 0.5 : -h, w, h); ctx.restore();
    };
    for (const it of R.itens) if (it.k === 'tapete') drawItem(it);   // tapetes ficam no chão, embaixo de tudo
    const ents = R.itens.filter(it => it.k !== 'tapete').map(it => { const [fw, fh] = foot(it); return { d: it.x + it.y + fw + fh - 1, f: () => drawItem(it) }; });
    const base = tp; tp = tw * 0.8;   // personagem na escala do cômodo
    const [psx, psy] = P(RP.x, RP.y), u = tp / 16;
    ents.push({ d: RP.x + RP.y, f: () => drawPlayer(psx, psy - 6 * u, u, RP.dir, moving, walkPhase) });
    ents.sort((a, c) => a.d - c.d);
    for (const e of ents) e.f();
    drawBubble(psx, psy - 6 * u - 1.55 * tp, CHAT.bolha);
    tp = base;
  }
  // painel Decorar: cor do chão, das paredes e móveis
  function renderDecor() {
    const b = interior; if (!b) return;
    const R = roomOf(b), dono = !b.dono || b.dono === 'eu' || b.dono === myId();
    const sw = (grupo, id, cor, atual) => `<button type="button" class="swatch${atual ? ' on' : ''}" data-dec="${grupo}:${id}" title="${id}" style="background:${cor}" aria-label="${id}"></button>`;
    let html = `<p class="muted small-text">${BUILDS[b.k].nome} · cômodo de ${roomSize(b)} × ${roomSize(b)} blocos${dono ? '' : ' · só o dono pode decorar'}</p>`;
    html += '<div class="section-label">Cor do chão</div><div class="swatches">' + Object.entries(PISOS).map(([id, c]) => sw('piso', id, id === 'xadrez' ? `repeating-conic-gradient(${c[0]} 0 25%, ${c[1]} 0 50%) 0 0/12px 12px` : c[0], R.piso === id)).join('') + '</div>';
    html += '<div class="section-label">Cor das paredes</div><div class="swatches">' + Object.entries(PAREDES).map(([id, c]) => sw('parede', id, c, R.parede === id)).join('') + '</div>';
    const moveis = Object.entries(S.kit).filter(([k, n]) => n > 0 && BUILDS[k] && BUILDS[k].tipo === 'movel');
    html += '<div class="section-label">Seus móveis</div><div class="list">';
    if (!moveis.length) html += '<div class="empty">Nenhum móvel guardado. Compre na loja, aba Móveis.</div>';
    for (const [k, n] of moveis) html += `<div class="row skin-row">${thumb2(ATLAS2['iso_' + k] ? 'iso_' + k : BUILDS[k].img)}<span class="name"><b>${BUILDS[k].nome}${n > 1 ? ' × ' + n : ''}</b><small>Escolha e use de frente para o lugar</small></span><span></span><button type="button" class="btn btn-gold" data-dec="movel:${k}">Colocar</button></div>`;
    html += `</div><p class="muted small-text">Com Construir na mão, fique de frente para um móvel para mover, girar, guardar ou vender. ${R.itens.length} móveis no cômodo.</p>`;
    html += '<div class="list-actions"><button type="button" class="btn" data-tab-go="moveis">Comprar móveis</button></div>';
    $('decor-body').innerHTML = html;
  }
  $('decor-body').addEventListener('click', e => {
    const bt = e.target.closest('[data-dec]'); if (!bt || !interior) return;
    const b = interior, [g, v] = bt.dataset.dec.split(':');
    if (b.dono && b.dono !== 'eu' && b.dono !== myId()) { toast('Só o dono decora esta casa', 'warn'); return; }
    if (g === 'movel') { S.sel = { k: 'kit', id: v }; S.tool = TOOLS.findIndex(t => t.id === 'muro'); invDirty = true; closeSheet(); toast('Fique de frente para o lugar e use para colocar', 'leaf'); return; }
    roomOf(b)[g] = v; save(); renderDecor();
  });
  // ---- chão guardado em pedaços (deixa o jogo bem mais leve: o chão não é redesenhado bloco a bloco a cada quadro)
  const CH = 8, chunkCache = new Map(), CHUNK_MAX = 60;
  function chunkSig(z, cx, cy) {
    const tl = S.tiles, ax = S.aux, layer = z * W * H;
    let h = tp * 7 + roadVer;
    for (let y = cy * CH, ye = Math.min(H, y + CH); y < ye; y++) for (let x = cx * CH, xe = Math.min(W, x + CH); x < xe; x++) {
      const i = layer + y * W + x;
      h = (Math.imul(h, 31) + tl[i] * 5 + (tl[i] === T.TILLED || tl[i] === T.CROP ? 0 : ax[i] & 1)) | 0;
      if (z > 0) h = (h + (tl[i - W * H] === T.HOLE ? 977 : 0)) | 0;
    }
    return h;
  }
  function chunkOf(z, cx, cy) {
    const key = z + ':' + cx + ':' + cy, sig = chunkSig(z, cx, cy);
    let c = chunkCache.get(key);
    if (c && c.sig === sig) { chunkCache.delete(key); chunkCache.set(key, c); return c.cv; }   // mais recente no fim
    const cv = c ? c.cv : document.createElement('canvas');
    cv.width = cv.height = CH * tp + 1;
    const g = cv.getContext('2d'), keep = ctx;
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
    ctx = g;
    try { drawChunk(z, cx, cy); } finally { ctx = keep; }
    chunkCache.delete(key); chunkCache.set(key, { cv, sig });
    while (chunkCache.size > CHUNK_MAX) chunkCache.delete(chunkCache.keys().next().value);
    return cv;
  }
  function drawChunk(z, cx, cy) {
    const tl = S.tiles, layer = z * W * H, u = tp / 16, dummy = [];
    for (let y = cy * CH, ye = Math.min(H, y + CH); y < ye; y++) for (let x = cx * CH, xe = Math.min(W, x + CH); x < xe; x++) {
      const i = layer + y * W + x, t0 = tl[i], t = t0 === T.SOURCE ? T.GRASS : t0, objs = dummy;
      const sx = (x - cx * CH) * tp, sy = (y - cy * CH) * tp;
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
      dummy.length = 0;
    }
    if (z === 0) drawGroundExtras(cx, cy);
  }
  // árvore do bioma: 4 tipos sorteados pela posição; muda e toco (aux 1 = toco recém-cortado)
  function arvoreObj(t, b, x, y, cx, bottom, objs) {
    if (t === T.TREE) {
      const nm = `tree_${b}_${hsh(x, y) & 3}`, r = artRect(nm);
      if (r) { objs.push([bottom, nm, cx, bottom - 0.04 * tp, 2.65 * tp * r[3] / 150]); return; }
      objs.push([bottom, 'tree_' + b, cx, bottom - 0.04 * tp, 2.5 * tp]); return;
    }
    const nm = (S.aux[y * W + x] === 1 ? 'toco_' : 'muda_') + b, r = artRect(nm);
    if (r) objs.push([bottom, nm, cx, bottom - 0.04 * tp, 2.65 * tp * r[3] / 150]);
    else objs.push([bottom, 'tree_' + b, cx, bottom - 0.06 * tp, 0.95 * tp]);
  }
  // objetos em pé (desenhados depois, em ordem de profundidade com o jogador)
  function tileObjs(t, x, y, sx, sy, objs) {
    const cx = sx + tp / 2, bottom = sy + tp;
    if (t === T.TREE || t === T.SAPLING || t === T.ROCK || t === T.CROP || t === T.WALL || t === T.GATE) {
      const b = BIOMES[S.biome[y * W + x]].id;
      if (t === T.TREE || t === T.SAPLING) arvoreObj(t, b, x, y, cx, bottom, objs);
      else if (t === T.ROCK) objs.push([bottom - 0.1 * tp, 'rock_' + b, cx, bottom - 0.08 * tp, 0.8 * tp]);
      else if (t === T.CROP) { const st = S.aux[y * W + x]; objs.push([bottom - 0.05 * tp, 'wheat_' + st, cx, bottom - 0.02 * tp, WHEAT_H[st] * tp]); }
      else objs.push([bottom, art2 ? wallFn(t, x, y, 0, sx, sy) : 'wall', cx, bottom, 1.15 * tp]);
    } else if (t === T.GRASS && !(S.road && S.road[y * W + x])) {   // arbustos soltos (só enfeite, dá para passar)
      const b = BIOMES[S.biome[y * W + x]].id, h = hsh(x + 333, y + 911);
      if ((h % 1000) / 1000 < (BUSH_P[b] || 0) && Math.hypot(x - SPAWN.x, y - SPAWN.y) > 6) {
        const nm = `bush_${(h >> 12) & 1}_${b}`, r = artRect(nm);
        if (r) objs.push([bottom - 0.2 * tp, nm, cx + ((h >> 14) % 20 - 10) / 100 * tp, bottom - 0.12 * tp, 2.65 * tp * r[3] / 150 * 0.8]);
      }
    }
  }
  let roadVer = 0;

  // ================= Estradas =================
  // Caminhos de terra ligando o começo ao centro de cada bioma (e os biomas vizinhos entre si).
  // Ficam guardados no save (S.road): 1 = terra, 2 = calçamento de pedra perto do começo.
  function makeRoads() {
    const road = new Uint8Array(W * H), tl = S.tiles, nz = makeNoise(S.seed + 314), rnd = mulberry32(S.seed + 313);
    const blocked = i => { const t = tl[i]; return t === T.SOURCE || t === T.VALA || t === T.HOLE || t === T.WALL || t === T.GATE || S.water[i] > 0; };
    const centers = [];
    for (let reg = 0; reg < RCOLS * RROWS; reg++) {
      const [rx, ry] = regionOrigin(reg);
      let cx = rx + REGION / 2, cy = ry + REGION / 2;
      if (BIOMES[reg].id === 'campos') { cx = SPAWN.x; cy = SPAWN.y + 6; }
      else { cx += Math.round((rnd() - 0.5) * 40); cy += Math.round((rnd() - 0.5) * 40); }
      centers.push([cx, cy]);
    }
    const links = [];
    for (let r = 0; r < RROWS; r++) for (let c = 0; c < RCOLS; c++) {
      const a = r * RCOLS + c;
      if (c + 1 < RCOLS) links.push([a, a + 1]);
      if (r + 1 < RROWS) links.push([a, a + RCOLS]);
    }
    const N = W * H, g = new Float32Array(N), came = new Int32Array(N), closed = new Uint8Array(N);
    const heap = [];   // [f, i]
    const push = (f, i) => { heap.push([f, i]); let k = heap.length - 1; while (k > 0) { const p = (k - 1) >> 1; if (heap[p][0] <= heap[k][0]) break; [heap[p], heap[k]] = [heap[k], heap[p]]; k = p; } };
    const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let k = 0; for (;;) { const l = 2 * k + 1, r = l + 1; let m = k; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === k) break; [heap[m], heap[k]] = [heap[k], heap[m]]; k = m; } } return top; };
    const D8 = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.42], [1, -1, 1.42], [-1, 1, 1.42], [-1, -1, 1.42]];
    for (const [a, b] of links) {
      const [sx, sy] = centers[a], [tx, ty] = centers[b];
      g.fill(Infinity); closed.fill(0); heap.length = 0;
      const s0 = sy * W + sx, goal = ty * W + tx;
      g[s0] = 0; came[s0] = -1; push(0, s0);
      let found = false, steps = 0;
      while (heap.length && steps++ < 400000) {
        const [, i] = pop();
        if (closed[i]) continue;
        closed[i] = 1;
        if (i === goal) { found = true; break; }
        const x = i % W, y = (i - x) / W;
        for (const [dx, dy, dc] of D8) {
          const nx = x + dx, ny = y + dy;
          if (nx < 3 || ny < 3 || nx >= W - 3 || ny >= H - 3) continue;
          const j = ny * W + nx;
          if (closed[j] || blocked(j)) continue;
          if (dx && dy && (blocked(y * W + nx) || blocked(ny * W + x))) continue;
          const t = tl[j];
          let c = dc * (1 + nz(nx / 11, ny / 11) * 2.2);
          if (t === T.TREE || t === T.SAPLING || t === T.ROCK) c += 5;
          if (road[j]) c *= 0.35;
          const ng = g[i] + c;
          if (ng < g[j]) { g[j] = ng; came[j] = i; push(ng + Math.hypot(nx - tx, ny - ty) * 1.05, j); }
        }
      }
      if (!found) continue;
      for (let i = goal; i >= 0; i = came[i]) {
        const x = i % W, y = (i - x) / W;
        if (S.builds.length && buildBlocks(x + 0.5, y + 0.5)) continue;
        road[i] = Math.hypot(x - SPAWN.x, y - SPAWN.y) < 24 ? 2 : 1;
        const t = tl[i]; if (t === T.TREE || t === T.SAPLING || t === T.ROCK) tl[i] = T.GRASS;
        if (i === s0) break;
      }
    }
    S.road = road; roadVer++;
  }

  // ================= Chão mais bonito (desenhado só uma vez em cada pedaço guardado) =================
  const hsh = (x, y) => { let h = Math.imul(x, 374761393) + Math.imul(y, 668265263) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return (h ^ (h >>> 16)) >>> 0; };
  // o bloco de chão é girado e espelhado conforme a posição, para não ficar com cara de repetido
  // chão contínuo: cada bioma tem uma textura grande (TEXB × TEXB blocos) e cada bloco pega o pedaço da sua posição
  const TEXB = 8, TEXPX = 64;
  function drawGroundTile(b, x, y, sx, sy) {
    const r = ATLAS['gtex_' + b];
    if (r) {
      const tx = ((x % TEXB) + TEXB) % TEXB, ty = ((y % TEXB) + TEXB) % TEXB;
      const i0 = tx === 0 ? 0.5 : 0, i1 = tx === TEXB - 1 ? 0.5 : 0, j0 = ty === 0 ? 0.5 : 0, j1 = ty === TEXB - 1 ? 0.5 : 0;
      ctx.drawImage(art, r[0] + tx * TEXPX + i0, r[1] + ty * TEXPX + j0, TEXPX - i0 - i1, TEXPX - j0 - j1, sx, sy, tp + 0.5, tp + 0.5);
      return true;
    }
    return drawTileArt(`ground_${b}_${(x * 7 + y * 13) & 3}`, sx, sy, tp);
  }
  // blocos do subsolo girados e espelhados conforme a posição (não ficam todos iguais)
  function drawTileRot(name, x, y, sx, sy) {
    const r = artRect(name); if (!r) return false;
    const h = hsh(x * 3 + 11, y * 5 + 7), rot = h & 3, fl = (h >> 2) & 1;
    ctx.save(); ctx.translate(sx + tp / 2, sy + tp / 2);
    if (rot) ctx.rotate(rot * Math.PI / 2);
    if (fl) ctx.scale(-1, 1);
    ctx.drawImage(art, r[0] + 0.5, r[1] + 0.5, r[2] - 1, r[3] - 1, -tp / 2 - 0.5, -tp / 2 - 0.5, tp + 1, tp + 1);
    ctx.restore(); return true;
  }
  const isGroundT = t => t === T.GRASS || t === T.AIR || t === T.TREE || t === T.SAPLING || t === T.ROCK || t === T.WALL || t === T.GATE;
  // detalhes do chão por bioma (índices da folha t_detalhes: 0-5 flores, 6 capim, 7 samambaia, 8 trevo, 9 cogumelos,
  // 10 tronco, 11 folhas, 12 pedras, 13 pedrinhas, 14 arbusto seco, 15 cacto, 16 osso, 17 capim seco, 18 taboa,
  // 19 vitória-régia, 20 poça, 21 neve, 22 cristal, 23 arbusto gelado)
  const DECO = {
    campos: { p: 0.16, d: [0, 1, 2, 3, 4, 5, 0, 1, 2, 6, 8, 8] },
    floresta: { p: 0.15, d: [7, 7, 9, 11, 11, 6, 10, 8, 9] },
    pantano: { p: 0.13, d: [18, 18, 6, 9, 7] },
    deserto: { p: 0.08, d: [13, 13, 12, 14, 15, 17, 16] },
    montanhas: { p: 0.11, d: [12, 13, 13, 17, 6, 12] },
    neve: { p: 0.08, d: [21, 21, 22, 23, 13] },
  };
  const BUSH_P = { campos: 0.018, floresta: 0.03, pantano: 0.025, deserto: 0.015, montanhas: 0.02, neve: 0.02 };
  let trilhaPat = null, trilhaCv = null, mascaraCv = null;
  function trilhaPattern(g) {
    const r = ATLAS.gtex_trilha; if (!r) return null;
    if (!trilhaCv) { trilhaCv = document.createElement('canvas'); trilhaCv.width = r[2]; trilhaCv.height = r[3]; trilhaCv.getContext('2d').drawImage(art, r[0], r[1], r[2], r[3], 0, 0, r[2], r[3]); }
    return g.createPattern(trilhaCv, 'repeat');
  }
  function drawGroundExtras(cx, cy) {
    const tl = S.tiles, u = tp / 16, bio = S.biome, X0 = cx * CH, Y0 = cy * CH;
    const XE = Math.min(W, X0 + CH), YE = Math.min(H, Y0 + CH);
    // 1) bordas entre biomas: o bioma "dominante" avança sobre o vizinho em bolhas arredondadas,
    //    o que tira o degrau quadrado da fronteira
    for (let y = Y0; y < YE; y++) for (let x = X0; x < XE; x++) {
      const i = y * W + x; if (!isGroundT(tl[i])) continue;
      const sx = (x - X0) * tp, sy = (y - Y0) * tp, b = bio[i];
      for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0], [-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const j = ny * W + nx; if (bio[j] <= b || !isGroundT(tl[j])) continue;
        const h = hsh(x * 5 + dx + 50, y * 5 + dy + 90);
        const px = sx + tp / 2 + dx * tp / 2, py = sy + tp / 2 + dy * tp / 2;
        const rad = (dx && dy ? 0.5 : 0.46) * tp + ((h & 7) - 3) * u;
        ctx.save(); ctx.beginPath(); ctx.arc(px, py, rad, 0, Math.PI * 2); ctx.clip();
        drawGroundTile(BIOMES[bio[j]].id, nx, ny, sx, sy);
        ctx.restore();
      }
    }
    // 2) manchas suaves de luz e sombra (quebra a repetição)
    const nzT = tintNoise || (tintNoise = makeNoise(S.seed + 55));
    for (let y = Y0; y < YE; y++) for (let x = X0; x < XE; x++) {
      if (!isGroundT(tl[y * W + x])) continue;
      for (let q = 0; q < 4; q++) {
        const qx = q & 1, qy = q >> 1, n = nzT((x + qx * 0.5) / 9, (y + qy * 0.5) / 9) - 0.5;
        if (Math.abs(n) < 0.08) continue;
        ctx.fillStyle = n > 0 ? `rgba(255,250,215,${(n * 0.16).toFixed(3)})` : `rgba(10,30,20,${(-n * 0.2).toFixed(3)})`;
        ctx.fillRect((x - X0 + qx * 0.5) * tp, (y - Y0 + qy * 0.5) * tp, tp / 2 + 1, tp / 2 + 1);
      }
    }
    // 3) trilhas de terra batida: a forma do caminho é recortada da textura da trilha, com borda escura suave
    if (S.road) {
      const R = S.road, ok = (x, y) => x >= 0 && y >= 0 && x < W && y < H && R[y * W + x] && isGroundT(tl[y * W + x]);
      const forma = (g, k) => {   // cada bloco: um círculo; ligações retas/diagonais entre vizinhos (cada forma preenchida sozinha)
        for (let y = Math.max(0, Y0 - 1); y < Math.min(H, YE + 1); y++) for (let x = Math.max(0, X0 - 1); x < Math.min(W, XE + 1); x++) {
          if (!ok(x, y)) continue;
          const px = (x - X0 + 0.5) * tp, py = (y - Y0 + 0.5) * tp, rad = (0.47 + ((hsh(x, y) & 3) - 1.5) * 0.02) * tp * k;
          g.beginPath(); g.arc(px, py, rad, 0, Math.PI * 2); g.fill();
          for (const [dx, dy] of [[1, 0], [0, 1], [1, 1], [-1, 1]]) {
            if (!ok(x + dx, y + dy) || (dx && dy && (ok(x + dx, y) || ok(x, y + dy)))) continue;
            const L2 = Math.hypot(dx, dy), nx = -dy / L2 * rad, ny = dx / L2 * rad;
            g.beginPath(); g.moveTo(px + nx, py + ny); g.lineTo(px + dx * tp + nx, py + dy * tp + ny); g.lineTo(px + dx * tp - nx, py + dy * tp - ny); g.lineTo(px - nx, py - ny); g.closePath(); g.fill();
          }
        }
      };
      let tem = false;
      for (let y = Math.max(0, Y0 - 1); y < Math.min(H, YE + 1) && !tem; y++) for (let x = Math.max(0, X0 - 1); x < Math.min(W, XE + 1); x++) if (ok(x, y)) { tem = true; break; }
      if (tem && ATLAS.gtex_trilha) {
        const m = mascaraCv || (mascaraCv = document.createElement('canvas'));
        m.width = CH * tp + 1; m.height = CH * tp + 1;
        const g = m.getContext('2d');
        // borda escura suave
        g.fillStyle = '#000'; forma(g, 1.13);
        g.globalCompositeOperation = 'source-in'; g.fillStyle = 'rgba(55,38,20,0.3)'; g.fillRect(0, 0, m.width, m.height);
        ctx.drawImage(m, 0, 0);
        // a trilha recortada
        g.globalCompositeOperation = 'source-over'; g.clearRect(0, 0, m.width, m.height);
        g.fillStyle = '#000'; forma(g, 1);
        g.globalCompositeOperation = 'source-in';
        const pat = trilhaPattern(g);
        pat.setTransform(new DOMMatrix([tp / TEXPX, 0, 0, tp / TEXPX, -X0 * tp, -Y0 * tp]));
        g.fillStyle = pat; g.fillRect(0, 0, m.width, m.height);
        ctx.drawImage(m, 0, 0);
      }
    }
    // 4) detalhes: flores, capim, cogumelos, pedrinhas, taboas, neve… (folha de detalhes)
    for (let y = Y0; y < YE; y++) for (let x = X0; x < XE; x++) {
      const i = y * W + x, t = tl[i];
      if (t !== T.GRASS || (S.road && S.road[i])) continue;
      const B = BIOMES[bio[i]].id, d = DECO[B]; if (!d) continue;
      const h = hsh(x + 1000, y + 7000);
      if ((h % 1000) / 1000 > d.p) continue;
      const nome = 'deco_' + d.d[(h >> 10) % d.d.length], r = artRect(nome); if (!r) continue;
      const k = tp / TEXPX * 0.9, w = r[2] * k, hh = r[3] * k;
      const ox = (x - X0) * tp + tp * (0.2 + ((h >> 14) % 60) / 100) - w / 2, oy = (y - Y0) * tp + tp * (0.55 + ((h >> 20) % 35) / 100) - hh;
      if ((h >> 26) & 1) { ctx.save(); ctx.translate(ox + w / 2, 0); ctx.scale(-1, 1); ctx.drawImage(art, r[0], r[1], r[2], r[3], -w / 2, oy, w, hh); ctx.restore(); }
      else ctx.drawImage(art, r[0], r[1], r[2], r[3], ox, oy, w, hh);
    }
  }
  let tintNoise = null;

  function render(now) {
    if (interior) { renderRoom(now); return; }
    const p = S.p, z = p.z, u = tp / 16;
    const W2 = canvas.width, H2 = canvas.height;
    ctx.imageSmoothingEnabled = !!art;
    if (art) ctx.imageSmoothingQuality = GRAF.alta ? 'high' : 'medium';
    const objs = [];   // árvores, pedras, plantas e muros: desenhados depois, ordenados por profundidade
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = z === 0 ? '#2a4a20' : '#120d0a';
    ctx.fillRect(0, 0, W2, H2);

    const sh = shakeTil > now ? shakeAmt * (shakeTil - now) / 220 : 0;
    const camX = Math.round(p.x * tp - W2 / 2 + (Math.random() - 0.5) * sh), camY = Math.round(p.y * tp - H2 * 0.46 + (Math.random() - 0.5) * sh);
    curCam[0] = camX; curCam[1] = camY;
    const x0 = Math.max(0, Math.floor(camX / tp)), y0 = Math.max(0, Math.floor(camY / tp));
    const x1 = Math.min(W - 1, Math.ceil((camX + W2) / tp)), y1 = Math.min(H - 1, Math.ceil((camY + H2) / tp));
    const tl = S.tiles, wt = S.water, layer = z * W * H;

    if (art) {
      // chão em pedaços de CH × CH blocos já desenhados (só refaz quando algo muda); por quadro só o que se mexe
      const cx0 = Math.floor(x0 / CH), cy0 = Math.floor(y0 / CH), cx1 = Math.floor(x1 / CH), cy1 = Math.floor(y1 / CH);
      for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) {
        const cv = chunkOf(z, cx, cy);
        ctx.drawImage(cv, cx * CH * tp - camX, cy * CH * tp - camY);
      }
      // prepara com antecedência um pedaço da borda por quadro, para não travar ao andar
      let built = 0;
      for (let cy = cy0 - 1; cy <= cy1 + 1 && !built; cy++) for (let cx = cx0 - 1; cx <= cx1 + 1 && !built; cx++) {
        if (cx < 0 || cy < 0 || cx * CH >= W || cy * CH >= H || (cx >= cx0 && cx <= cx1 && cy >= cy0 && cy <= cy1)) continue;
        const c = chunkCache.get(z + ':' + cx + ':' + cy);
        if (!c) { chunkOf(z, cx, cy); built = 1; }
      }
      const wet = [], springs = [];
      for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
          const i = layer + y * W + x, t = tl[i];
          const sx = x * tp - camX, sy = y * tp - camY;
          if (z === 0) tileObjs(t, x, y, sx, sy, objs);
          if (t === T.SOURCE && z === 0) { wet.push(x, y, sx, sy, SOURCE_LEVEL); springs.push(sx, sy); }
          else if (wt[i] > 0) wet.push(x, y, sx, sy, wt[i]);
        }
      }
      drawWaterAll(wet, z, now, camX, camY);
      for (let k = 0; k < springs.length; k += 2) drawObj('spring', springs[k] + tp / 2, springs[k + 1] + tp * 0.98, tp * 1.05);
    } else
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
        if (S.builds.length && hiddenInHouse(a.x, a.y)) continue;
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
    drawMobs(ents, camX, camY, W2, H2);
    if (z === 0) for (const n of evNpcs.values()) {
      const sx = n.x * tp - camX, sy = n.y * tp - camY;
      if (sx < -2 * tp || sy < -3 * tp || sx > W2 + 2 * tp || sy > H2 + 2 * tp) continue;
      ents.push({ y: sy + 6 * u, wx: n.x, wy: n.y, f: () => drawEventoNpc(n, sx, sy, u) });
    }
    if (S.morte && S.morte.z === z) {   // X da última morte (só você vê)
      const mx = S.morte.x * tp - camX, my = S.morte.y * tp - camY;
      ents.push({ y: -1e8, f: () => { ctx.strokeStyle = '#e0372a'; ctx.lineWidth = Math.max(3, tp * 0.12); ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(mx - tp * 0.3, my - tp * 0.3); ctx.lineTo(mx + tp * 0.3, my + tp * 0.3); ctx.moveTo(mx + tp * 0.3, my - tp * 0.3); ctx.lineTo(mx - tp * 0.3, my + tp * 0.3); ctx.stroke(); ctx.lineCap = 'butt'; } });
    }
    if (z === 0) for (const b of S.bots) {
      const bx = b.x * tp - camX, by = b.y * tp - camY;
      if (bx < -2 * tp || by < -3 * tp || bx > W2 + 2 * tp || by > H2 + 2 * tp) continue;
      if (hiddenInHouse(b.x, b.y)) continue;
      ents.push({ y: by + 4 * u, wx: b.x, wy: b.y, f: () => drawBot(b, bx, by + 4 * u) });
    }
    ents.push({ y: psy + 6 * u, wx: p.x, wy: p.y, eu: true, f: () => wade(p.x, p.y, psy + 6 * u, 4 * u, 5.5 * u, () => drawPlayer(psx, psy, u, p.dir, moving, walkPhase)) });
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
      if (v.casa) {   // casas: o personagem fica sempre por cima do desenho; bichos seguem a ordem normal
        if (!e.eu) continue;
        const a = v.d.w / 2, ox = Math.abs(e.wx - v.b.x - a);
        if (ox < a + 1 && e.wy > v.topY - 0.5 && e.wy < v.b.y + v.d.h + 1.5) e.y = v.behind ? Math.min(e.y, v.key - 0.5) : Math.max(e.y, v.key + 0.5);
        continue;
      }
      // quem está na frente da parede da frente de uma casa ou forte é desenhado depois dela
      const a = v.d.w / 2, bb = v.d.h / 2, ox = Math.abs(e.wx - v.b.x - a);
      if (ox >= a + 0.4) continue;
      const fe = v.b.y + bb + bb * Math.max(0, 1 - ox / a);
      e.y = e.wy >= fe - 0.05 ? Math.max(e.y, v.key + 0.5) : Math.min(e.y, v.key - 0.5);
    }
    ents.sort((e1, e2) => e1.y - e2.y);   // ordena só depois dos ajustes acima
    for (const e of ents) e.f();
    drawSmoke(camX, camY, now);
    if (z === 0) for (const zn of MUNDO.zonas) {   // borda da área segura no chão
      if (!zn.ativo || Math.hypot(zn.x - p.x, zn.y - p.y) > zn.r + 20) continue;
      ctx.save(); ctx.strokeStyle = 'rgba(127,224,138,0.55)'; ctx.lineWidth = Math.max(2, tp * 0.06); ctx.setLineDash([tp * 0.4, tp * 0.3]);
      ctx.beginPath(); ctx.arc(zn.x * tp - camX, zn.y * tp - camY, zn.r * tp, 0, 6.28); ctx.stroke(); ctx.restore();
    }
    drawShots(camX, camY, now);
    drawCombatFx(camX, camY, now);
    drawBubble(psx, psy - 1.55 * tp, CHAT.bolha);
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
      lctx.setTransform(lightCv.width / W2, 0, 0, lightCv.height / H2, 0, 0);
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
      const rad = (wearing('capacete') ? (z === 0 ? 7 : 6) : (z === 0 ? 4.2 : 3.2)) * tp;
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
      ctx.imageSmoothingQuality = 'low'; ctx.drawImage(lightCv, 0, 0, W2, H2); ctx.imageSmoothingQuality = GRAF.alta ? 'high' : 'medium';
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
        if (d.tipo !== 'forte') continue;
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
        if (b.tipo === 'fazenda') { const c = b.store.colheita || 0; if (c) drawLabel(`Ajudante · ${c} trigo${c >= FARM_CAP ? ' (cheio)' : ''}`, bx, by - 26 * u, u, '#7fd16a'); continue; }
        drawLabel(n ? `Robô · ${n}${n >= ROBO_CAP ? ' (cheio)' : ''}` : 'Robô · sem minério', bx, by - 26 * u, u, '#c9a34a');
      }
      for (const n of evNpcs.values()) {
        const sx = n.x * tp - camX, sy = n.y * tp - camY;
        if (sx < -tp || sy < -tp || sx > W2 + tp || sy > H2 + tp) continue;
        drawLabel(Math.hypot(n.x - p.x, n.y - p.y) < 2.5 ? `${n.ev.nome} · Usar para ganhar presente` : n.ev.nome, sx, sy - 24 * u, u, '#e0372a');
      }
      drawNpcArrows(camX, camY, W2, H2);
      if (S.morte && S.morte.z === 0) {
        const mx = S.morte.x * tp - camX, my = S.morte.y * tp - camY;
        if (mx < 0 || my < 0 || mx > W2 || my > H2) {
          const cx = W2 / 2, cy = H2 / 2, a = Math.atan2(my - cy, mx - cx), R = Math.min(W2, H2) * 0.42;
          const ax = cx + Math.cos(a) * R, ay = cy + Math.sin(a) * R;
          ctx.fillStyle = 'rgba(20,17,15,0.75)'; ctx.beginPath(); ctx.arc(ax, ay, tp * 0.36, 0, 6.28); ctx.fill();
          ctx.strokeStyle = '#e0372a'; ctx.lineWidth = Math.max(2, tp * 0.07);
          ctx.beginPath(); ctx.moveTo(ax - tp * 0.15, ay - tp * 0.15); ctx.lineTo(ax + tp * 0.15, ay + tp * 0.15); ctx.moveTo(ax + tp * 0.15, ay - tp * 0.15); ctx.lineTo(ax - tp * 0.15, ay + tp * 0.15); ctx.stroke();
        }
      }
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
    if (interior) { roomMove(dt); vx = vy = 0; }
    else if (moving) {
      if (lastDir && held[lastDir]) p.dir = { down: 0, up: 1, left: 2, right: 3 }[lastDir];
      else p.dir = vy > 0 ? 0 : vy < 0 ? 1 : vx < 0 ? 2 : 3;
      const len = Math.hypot(vx, vy);
      const slow = p.z === 0 && S.water[Math.floor(p.y) * W + Math.floor(p.x)] > 0 ? 0.6 : 1;   // anda mais devagar na água
      vx = vx / len * SPEED * slow * dt; vy = vy / len * SPEED * slow * dt;
      const ox = p.x, oy = p.y;
      if (canStand(p.x + vx, p.y, p.z, 0.3, 'jogador')) p.x += vx;
      if (canStand(p.x, p.y + vy, p.z, 0.3, 'jogador')) p.y += vy;
      // andando contra a parede de uma casa ou fortaleza: entra (ou sai) sozinho depois de um instante
      if (Math.hypot(p.x - ox, p.y - oy) < Math.hypot(vx, vy) * 0.3 && p.z === 0 && S.builds.length) {
        pushT += dt;
        if (pushT > 0.22 && !interior) { pushT = -0.5; const door = doorAction(); if (door) door(); }   // -0.5: espera antes de repetir
      } else pushT = Math.min(0, pushT + dt);
      walkPhase += dt * 12;
    } else pushT = Math.min(0, pushT + dt);
    if (actHeld && cooldown <= 0 && !openSheet) useTool();

    accWater += dt; accFarm += dt; accSave += dt; accSpawn += dt; accHud += dt;
    if (accWater > 0.18) { accWater = 0; waterTick(); }
    if (accFarm > 1.5) { accFarm = 0; farmTick(); }
    if (accSpawn > 4) {
      accSpawn = 0;
      fugitivoTick(); vilasTick();
      if (S.animals.length < ANIMAL_CAP) spawnAnimal(true);
      if (Math.random() < 1 / 3) legendCheck();   // checagem do lendário a cada ~12 s
    }
    if (accSave > 15) { accSave = 0; save(); }
    animalsTick(dt, now);
    botsTick(dt);
    combatTick(dt, now);
    zonaTick();
    eventosTick(dt);
    auraTick(dt);
    shotsTick(dt, now);
    if ((TOOLS[S.tool].id === 'cetro' || TOOLS[S.tool].id === 'livro') && Math.floor(mana) !== lastMana) { lastMana = Math.floor(mana); invDirty = true; }
    if (wearing('capacete') && (p.z > 0 || !isDay())) {     // a bateria do capacete gasta no escuro
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
    S.mobs = [];
    if (!S.camps || !S.camps.length) makeCamps();
    if (!S.road) makeRoads();
    if (!online()) mundoCarregar();
    for (const c of S.camps) clearAround(c.x, c.y, 3);
    for (let k = 0; k < 30; k++) spawnAnimal(false);
    for (let k = 0; k < 24; k++) waterTick();     // enche lagoas e valas existentes
    placeNpcs();
    homing = null;
    lastBiome = null;
    interior = null;
    if (S.devolvido) { toast(`As fortalezas saíram do jogo: ${S.devolvido} moedas devolvidas`, 'gold', 6000); delete S.devolvido; }
    for (const b of S.builds) clearUnderHouse(b);   // casas antigas: limpa o chão embaixo
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
  (function hpChip() {   // vida no topo, ao lado das moedas
    const coins = document.querySelector('.hud .coins');
    if (!coins || document.getElementById('hp')) return;
    const c = document.createElement('div'); c.className = 'chip hp'; c.title = 'Vida';
    c.innerHTML = '<span class="heart" aria-hidden="true">♥</span><span id="hp">100</span>';
    const col = document.createElement('div'); col.className = 'hud-left';   // moedas e vida empilhadas
    coins.before(col); col.append(coins, c);
    const g = document.createElement('div'); g.className = 'gestos';   // gestos: levantar uma ou as duas mãos
    g.innerHTML = '<button type="button" class="btn gesto" data-gesto="um" title="Levantar uma mão (G)" aria-label="Levantar uma mão">✋</button><button type="button" class="btn gesto" data-gesto="dois" title="Levantar as duas mãos (J)" aria-label="Levantar as duas mãos">🙌</button>';
    col.append(g);
    g.addEventListener('click', e => { const b = e.target.closest('[data-gesto]'); if (b) { gesto(b.dataset.gesto); b.blur(); } });
  })();
  function gesto(tipo) {
    if (TOOLS[S.tool].id !== 'maos' || interior) { toast(interior ? 'Gestos só do lado de fora' : 'Guarde a ferramenta para levantar as mãos (mãos livres: tecla 0)', 'warn', 3000); return; }
    if (S.p.emote && S.p.emote.tipo === tipo && performance.now() < S.p.emote.ate) { S.p.emote = null; return; }   // tocar de novo abaixa
    S.p.emote = { tipo, ate: performance.now() + 4000 };
  }

  // ================= Chat de texto =================
  // Todos (geral), Privado (por código, um ou mais jogadores) e Amigos (amarelo, só amigos que se adicionaram).
  // Nada fica guardado: as mensagens existem só enquanto a partida está aberta.
  const CHAT = { log: [], tab: 'todos', unread: 0, para: '', amigos: [], bolha: null };
  const chatEsc = t => String(t).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  function chatPush(m, minha) {
    CHAT.log.push(Object.assign({ minha }, m));
    if (CHAT.log.length > 150) CHAT.log.shift();
    const quem = minha ? 'Você' : m.nome, pre = m.tipo === 'privado' ? '(privado) ' : m.tipo === 'amigos' ? '(amigos) ' : m.titulo ? m.titulo + ': ' : '';
    $('chat-last').textContent = `${quem}: ${pre}${m.texto}`;
    $('chat-bar').classList.toggle('amigos', m.tipo === 'amigos');
    $('chat-bar').classList.toggle('aviso', !!m.sistema);
    if (!minha && !(openSheet && openSheet.id === 'sheet-chat')) { CHAT.unread++; $('chat-badge').hidden = false; $('chat-badge').textContent = CHAT.unread; }
    if (openSheet && openSheet.id === 'sheet-chat') renderChatLog();
    if (minha) CHAT.bolha = { texto: m.texto, ate: performance.now() + 5000, amarelo: m.tipo === 'amigos' };
  }
  function chatOnMsg(m) {
    if (m && m.sistema) { if (online()) mundoCarregar(); return; }   // sinal de aviso: busca o texto verdadeiro no servidor
    if (!m || typeof m.texto !== 'string') return;
    if (m.tipo === 'amigos' && !CHAT.amigos.some(a => a.mutuo && a.codigo === m.de)) return;   // só amigos de verdade
    chatPush({ de: m.de, nome: String(m.nome || '?').slice(0, 20), texto: m.texto.slice(0, 200), tipo: ['todos', 'privado', 'amigos'].includes(m.tipo) ? m.tipo : 'todos', t: m.t }, false);
  }
  function renderChatLog() {
    const box = $('chat-log'), tab = CHAT.tab;
    const msgs = CHAT.log.filter(m => tab === 'todos' ? true : m.tipo === tab);
    box.innerHTML = msgs.length ? msgs.map(m => {
      const hora = new Date(m.t).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      if (m.sistema) return `<div class="chat-msg aviso"><span class="chat-hora">${hora}</span> <b>Moderação</b>${m.titulo ? ` · <i>${chatEsc(m.titulo)}</i>` : ''}: ${chatEsc(m.texto)}</div>`;
      const quem = m.minha ? 'Você' + (m.tipo === 'privado' && m.para ? ' → ' + m.para.join(', ') : '') : m.nome;
      const responder = !m.minha && m.de && m.tipo !== 'amigos' ? ` <button type="button" class="linkbtn" data-reply="${chatEsc(m.de)}">responder</button>` : '';
      return `<div class="chat-msg ${m.tipo}${m.minha ? ' minha' : ''}"><span class="chat-hora">${hora}</span> <b>${chatEsc(quem)}</b>${m.tipo !== 'todos' ? ` <small>(${m.tipo})</small>` : ''}: ${chatEsc(m.texto)}${responder}</div>`;
    }).join('') : '<div class="empty">Nenhuma mensagem ainda nesta partida.</div>';
    box.scrollTop = box.scrollHeight;
  }
  async function renderChatExtra() {
    const ex = $('chat-extra'), on = NET.enabled && NET.user;
    $('chat-input').disabled = !on;
    $('chat-note').textContent = on ? 'As mensagens não ficam guardadas: só quem está jogando agora recebe.' : 'O chat funciona com as contas ligadas (no site do jogo no GitHub).';
    if (CHAT.tab === 'privado') {
      ex.innerHTML = `<label class="field">Para (código TF-… de um ou mais jogadores, separados por vírgula)
        <input id="chat-para" type="text" maxlength="80" value="${chatEsc(CHAT.para)}" placeholder="TF-ABC123, TF-XYZ789"></label>`;
      $('chat-para').addEventListener('input', e => { CHAT.para = e.target.value; });
    } else if (CHAT.tab === 'amigos') {
      let html = `<div class="search-row"><input id="amigo-cod" type="text" maxlength="12" placeholder="Adicionar amigo pelo código TF-…"><button type="button" class="btn" id="amigo-add">Adicionar</button></div>`;
      html += '<div class="list" id="amigo-list"><div class="empty">Carregando…</div></div>';
      html += `<p class="muted small-text">Vocês viram amigos quando um adiciona o outro. Seu código: <b>${chatEsc((NET.profile && NET.profile.codigo) || '—')}</b></p>`;
      ex.innerHTML = html;
      $('amigo-add').addEventListener('click', async () => {
        const c = $('amigo-cod').value.trim().toUpperCase();
        if (!/^TF-[A-Z0-9]{6}$/.test(c)) { toast('Digite o código no formato TF-XXXXXX', 'warn'); return; }
        try { const nome = await NET.addFriend(c); toast(`Pedido de amizade para ${nome}`, 'leaf'); renderChatExtra(); } catch (e) { toast(e.message, 'warn'); }
      });
      if (!on) { $('amigo-list').innerHTML = '<div class="empty">Entre na sua conta para ver seus amigos.</div>'; return; }
      try { CHAT.amigos = await NET.friends() || []; } catch (e) { CHAT.amigos = []; }
      const list = $('amigo-list');
      if (!list) return;
      list.innerHTML = CHAT.amigos.length ? CHAT.amigos.map(a => `<div class="row shop"><span class="name"><b>${chatEsc(a.username)}</b>
        <small>${a.codigo} · ${a.mutuo ? 'amigos' : a.pediu ? 'quer ser seu amigo' : 'esperando aceitar'}</small></span><span class="admin-btns">
        ${a.pediu ? `<button type="button" class="btn btn-gold" data-amigo-ok="${a.codigo}">Aceitar</button>` : ''}
        <button type="button" class="btn" data-amigo-del="${a.id}">Remover</button></span></div>`).join('') : '<div class="empty">Nenhum amigo ainda.</div>';
    } else ex.innerHTML = '';
  }
  function chatTab(t) {
    CHAT.tab = t;
    document.querySelectorAll('#chat-tabs [data-ctab]').forEach(b => b.classList.toggle('btn-gold', b.dataset.ctab === t));
    $('chat-input').placeholder = t === 'amigos' ? 'Mensagem para seus amigos' : t === 'privado' ? 'Mensagem privada' : 'Mensagem para todos';
    renderChatExtra(); renderChatLog();
  }
  function openChat() {
    showSheet('sheet-chat');
    CHAT.unread = 0; $('chat-badge').hidden = true;
    chatTab(CHAT.tab);
    setTimeout(() => { const i = $('chat-input'); if (i && !i.disabled) i.focus(); }, 50);
  }
  $('chat-bar').addEventListener('click', openChat);
  $('chat-tabs').addEventListener('click', e => { const b = e.target.closest('[data-ctab]'); if (b) chatTab(b.dataset.ctab); });
  $('chat-extra').addEventListener('click', async e => {
    const ok = e.target.closest('[data-amigo-ok]'), del = e.target.closest('[data-amigo-del]');
    try {
      if (ok) { await NET.addFriend(ok.dataset.amigoOk); toast('Amizade aceita', 'leaf'); }
      if (del) { await NET.removeFriend(del.dataset.amigoDel); toast('Amigo removido'); }
    } catch (err) { toast(err.message, 'warn'); }
    if (ok || del) renderChatExtra();
  });
  $('chat-log').addEventListener('click', e => {
    const r = e.target.closest('[data-reply]');
    if (r) { CHAT.para = r.dataset.reply; chatTab('privado'); $('chat-input').focus(); }
  });
  $('chat-form').addEventListener('submit', async e => {
    e.preventDefault();
    const inp = $('chat-input'), texto = inp.value;
    if (!texto.trim()) return;
    try {
      let destinos;
      if (CHAT.tab === 'privado') {
        destinos = [...new Set(CHAT.para.toUpperCase().split(/[\s,;]+/).filter(c => /^TF-[A-Z0-9]{6}$/.test(c)))].slice(0, 8);
        if (!destinos.length) { toast('Escreva o código de quem vai receber (TF-…)', 'warn'); return; }
      } else if (CHAT.tab === 'amigos') {
        if (!CHAT.amigos.length) try { CHAT.amigos = await NET.friends() || []; } catch (er) {}
        destinos = CHAT.amigos.filter(a => a.mutuo).map(a => a.codigo);
        if (!destinos.length) { toast('Você ainda não tem amigos confirmados', 'warn'); return; }
      }
      const m = await NET.chatSend(CHAT.tab, texto, destinos);
      if (m) { inp.value = ''; chatPush(m, true); }
    } catch (err) { toast(err.message, 'warn'); }
  });
  $('chat-input').addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Escape') closeSheet(); });
  function chatStartIfReady() {
    if (!NET.enabled || !NET.user || !NET.chatStart) return;
    NET.chatStart(chatOnMsg);
    NET.friends().then(l => { CHAT.amigos = l || []; }).catch(() => {});
  }
  // balão sobre a cabeça de quem mandou a mensagem
  function drawBubble(x, y, b) {
    if (!b || performance.now() > b.ate) return;
    const u = tp / 16, txt = b.texto.length > 42 ? b.texto.slice(0, 40) + '…' : b.texto;
    ctx.font = `600 ${Math.round(tp * 0.3)}px "Barlow", sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const w = ctx.measureText(txt).width + 12 * u, h = tp * 0.55, bx = x - w / 2, by = y - h;
    ctx.fillStyle = b.amarelo ? 'rgba(80,64,10,0.92)' : 'rgba(20,17,15,0.88)'; ctx.strokeStyle = b.amarelo ? '#ffd24a' : 'rgba(255,255,255,0.5)'; ctx.lineWidth = Math.max(1, u * 0.6);
    ctx.beginPath(); ctx.roundRect ? ctx.roundRect(bx, by, w, h, 6 * u) : ctx.rect(bx, by, w, h); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x - 3 * u, by + h); ctx.lineTo(x, by + h + 4 * u); ctx.lineTo(x + 3 * u, by + h); ctx.fill();
    ctx.fillStyle = b.amarelo ? '#ffe680' : '#f4eadb'; ctx.fillText(txt, x, by + h / 2);
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
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
  if (/[?&]teste\b/.test(location.search)) window.TerraDebug = { get S() { return S; }, get RP() { return RP; }, roomFrontTile, get interior() { return interior; }, get fx() { return effects; }, get pushT() { return pushT; }, doorAction, catapultInFront, useTool, target, placeKit, pickUp, candidate, placeProblem, showSheet, botMine, save, get MUNDO() { return MUNDO; }, evNpcs, vilasTick, fugitivoTick, darPremio, renderAdmin, killMob, enterHouse, get sons() { return Object.keys(somBuf).length; } };

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
    chatStartIfReady();
    mundoCarregar();
    if (!loaded || !S.char) {
      showChars(true); save();
      if (oldSaveFound) toast('O mapa ficou 6 vezes maior, com biomas novos: um mundo novo foi criado.', 'gold', 6000);
    } else toast(NET.user && NET.profile ? `Bem-vindo de volta, ${NET.profile.username}` : 'Bem-vindo de volta');
    if (!NET.enabled) requestAnimationFrame(frame);
  }
  boot();
})();
/*SONS*/ // sons do jogo embutidos (gerado a partir da pasta sons/)
window.TERRA_SONS = window.TERRA_SONS || {"arvore": "data:audio/mpeg;base64,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", "bicho_morre": "data:audio/mpeg;base64,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", "bicho_ruge": "data:audio/mpeg;base64,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qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq//twxPmDFLnU/gwkekpHMh2I9I3gqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqpMQU1FMy4xMDCqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqv/7csRtA8AAAaQAAAAgAAA0gAAABKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq", "cavar_1": "data:audio/mpeg;base64,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RURWdqoqov////ymVASgarv/+01DlitFX1VU1UxBTUUzLjEwMFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVf/7cMSgA8yFWrkmDFhIAAA0gAAABFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVU=", "cavar_2": "data:audio/mpeg;base64,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iccHyhUoOioKiERBuQPZ2//9Th0dQ9n9f0VU/qjs5pyoj///uzmnDo8UHzD0WqIeY7HGjxUqYWqqrhqoqv/6aL/9VUxBTUUzLjEwMFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVf/7cMSYA89txtIGDPHIAAA0gAAABFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVU=", "cavar_3": "data:audio/mpeg;base64,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//bmSw0RNFMlpS0oqv/VmLf//+yX/pvZPfNFakxBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqv/7cMSpA87I8uJGGGfIAAA0gAAABKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqo=", "construir": "data:audio/mpeg;base64,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Ws7KhIOGlIKFCD2l60+MXoUZuvlxjXLY7S2LSwjspPUsub5ZFekile5/Pb2jbH8KZrdSct0IuN3pHvKpGZUjjNxuErbHM/DM1IsMw8S9f7f9FUxBTUUzLjEwMFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVUAQRHEgEkWElBWna3mAZLTrBQChVa4MOeCWyRx1ErAJ1gUSqk2q7AQql8VUZoxqa//+3LErgIPLasIB6RrwZg0IZgzDkBVVVWb1UmAlXPZj/1JjoVjv7HdYzGqrqpdX1Kl/GIMBMx/0jq+pcP6Wp8arG1EqpftG436tGb/ilqqqXGY6uzf/GZvq/9YUfiWtUxBTUUzLjEwMFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVf/7cMSqg88x7PKjGGfAAAA0gAAABFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVTEFNRTMuMTAwVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVX/+3LEbQPAAAGkAAAAIAAANIAAAARVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVQ==", "corte": "data:audio/mpeg;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjYwLjE2LjEwMAAAAAAAAAAAAAAA//twwAAAAAAAAAAAAAAAAAAAAAAASW5mbwAAAA8AAAAIAAALBQA4ODg4ODg4ODg4ODhVVVVVVVVVVVVVVVVxcXFxcXFxcXFxcXFxjo6Ojo6Ojo6Ojo6OqqqqqqqqqqqqqqqqqsfHx8fHx8fHx8fHx+Pj4+Pj4+Pj4+Pj4+P///////////////8AAAAATGF2YzYwLjMxAAAAAAAAAAAAAAAAJAR3AAAAAAAACwX0WC/1AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAP/7cMQAAA8BEugU9AACc6aldzcAAC5sxKBNCEMpby5vi3lzUbPZ4rHlRQUFBQUMTcUMqXe/d3uBQUMLAUBpTn2iOKGSLi76J/CIlOKCgole4uHgpRYuLi9oLi59/6O+iJ/8Inu6IlOLi55ANw/Pipe0Fxc+CDv6w+XD8EFggcE4fEYP///8P8uD7xA4EABUnA6pVoL2404GwEAC3kVNmCHRPIGzKSmLS+WL1NBDzBAXvE84DAQOrGTixkRSYBuAfprUOcSRFhyAbPi3GhFzczHAQ0kzgzAt5DBwIumZnB3kYQcpkWEbBkQUoQAWQykOdWYmSBcJkWQeIuOAj/fZaKemLjIiLnK5DyXV/0lqdM8t0CLpE4VyYNECYM////NGWaHUwGD7//+8yhABACABAAEgyn6PfYgeGRn/+3LEB4AQ1VMVGboAAjCuIac6YAApRJCZVAmEklzDdsDB5kh/rvfGGBilaSSMDLGw4kDBBUrKVACEgQAgFCRTEW32E2jEC14xHV11KfDIxDhcw5w6hmqv25RJo3GVWTJAetdbPtlEnUSieJpZkRb//bUovF4pF4xSTJma//etv1F1ZqgixlUXhF///3QAAACIgiCKK0nHwVDQIm4wQBgGh4koi9rSqNT0huV5N2TYkNQQJJM+0jKekzTrbragxlRnypzVPmlIFf5Uvuz51utp/aX/q577jS7R/dPtJ97ZsvMKRnfD7t1t/vuv8289KXmY2/fh7zFPX8fP5x8zEvvjYnYzym4eAY4UMBIwGv777/UXWqun8/HvpgGUFKUMEAAAACk1vC5g4hTCDQTlLI4YIEGEhKt2N9AZA//7cMQQgBQBNR85uYAKWSPqNzDwAoyCEQamwswioB/BQCCjMuEPASMlg0cMbm5m7B9w6QkyyGCQDDB8AgwuHiLmiBFx1l8YpoCiw9ECywUYAKltdpPqliHjEpDMGZDBZd/nHT8a4j0PXSEfmyf/UQw0JC5uphmC8N4UGGNxUwGjkWJD/600y+bs/iwAmEAsY4RRzBdpVKARKFQlpNNooFkCAexBqaqacUjQ4IMkpo7VilboCSxd5L2AAdJedQ63seUL8KpOOm1mw7JKIyaZNjEcJ5sXrCTDKhg84asUzcsscbDFWEdTC6mczsfJyeC3PX1mZyhM1X69sp/m0ZPM6uy17//+aRMv2NLRsQ/reaPt+XG8+2d/IqzBOYvRZOtf/s0ZmnZsi27/6wWqAADA07U2ApEI2NmijB7/+3LEBwPRITcwXYYAElsjpUGcPXEdkDox5L57H/Xm15vgiAIBklkIUrk1WjBwmKCZEOrbqxor+OhZO+trKeLLJjCT192kSxk6mqxt5IrfM1KCUBqPy8ZWctCZvdKzb0pSji9fApdPqrqZeOzkNNLCGvYHCJV7b7Dq+B47au0/TlkVVpbYgWZNsyd2tGneuhIDzi46UKSYgWlzTk8zfDSVY8zJlzOFVVUB1AhG1wWIoCpLByVBUR1/qrrvfW8sujlcfXJIP+3AYhG20snbarVrv15TOMiuQ46mZ/Z5vFp7ro7Dz9MnWchcSiJmujNgJNGy188c8HBsT6pkRKqgRsb+qKcyX2YVqoNUr6ELYxFi1a1+bwS7lzT6GFjWmUV+AwsrKyGU5o1aIA/4EHBnRCB5YMJikQgGAiI0BP/7cMQJgBKdDy41rAAKSSMp9zEwAAJiyqDbkPu2qK62xwECQkzkNyIDpOI19TdC5YOBIYUCRTbE7sba27rO3ffehkriP/CIYYfG559VpMlTjbR+868bp4bhthEEvo/jkNcfic1lvXatnKta/8u///vHXP/9dx5/////75/93jjyhd3Lv//7glItZLSIHSoUxYV1fjZwXeKcIAAAAAIAAAGAzWCA0QiChK5joc0wbZdjzxMMIPQcNmEfaMZ8h6xHwto4SoB7KJ3HGVyQL5dHeXAbxpFsvFxhtl0vkSE6GJJlwwLhwmET5gmUywLgI8k0kDI0R5w4bpp0xzET5cPSLp00j1nrdNjJSBcJw831l9E69+ecdm6c0J9MgBmRZL+o/8Df//0mjM4AC9UAAAAJCwYA2R83MKhgeCr/+3LEB4AR6VlMeaoAAhySIkO5kAHIo7MVNqQDZtCaw7MCafWi8DTugMWDIiTpqcAQUDAACiJIvJuqDY6FhIZCDrlhT/F2KILeLKFmo0V/jmmYZFFyFU3X1fycJ0vDOl46KR//yeJ02LxMkMHJHCWFq1rSq/5gWyCkVJQpmZUJ8niZq29f/5KFImyKFokiqRUpE2mVTYzJGDhhKMECYymezEgGNjgIy4kDD4iMJjsWC5gZAgYMEgEMqF8wcDTIo/MKEIgBByVG1MUVDpR0pBUI1wQamhAQhsMbsneh+XmUZIgVh1BnabEydXqxmfwipvtNNZZXMLnP7q5rLLLDDn73ewsP/MeGf8doIEvof6/4eopsaHDRt/vQ1D0gM2oApoiQn5jThEwA7MlBTDBwaQxCDINjAETAzaGq2//7cMQOgxAg4xpt5MfBqwtiCaYZ0CYBkAJCEMIkQHKK8T1aNI0+XBdtlijrKbEZjLDWCxipSrC1oAZhRSR4EnFAItZ5GiwNSJRmiULo+izTpo9pa3d/2zPpW5NYc/3fH/vtUm4OUo8LTXIqUedds6+to+q8p2U9bZUAAONKmMfAOzAHjwjABwKbaSX9ZMjaWlLKoawwickUkMA0eiiAkPS8Ow8hS2IJNwkAgquKASyOORRkShMRA0LuWCoKkQaDt4Ne5QNVA1KpxU7Q0sdiIGlA08FXeoWIppIruQVF+xlS+3errgCbs1uxbwWKc1xqIKy9qtc0jjGosc1KNAI1LUgxHxqTXjVfa0vO8ON6qTXX2Y/2NV4d1/h6tc1Jj+5Rrr+v/69gEDoTcuAoSPLdrARmREvDQicIjXj/+3LEKoPLUQj0TJhlQAAANIAAAASUGlDkVPpMQU1FMy4xMDCqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqg==", "desaba": "data:audio/mpeg;base64,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Gsbdr///l0MXlM11322y9Z/pbd7s5UoCwEAEuFLi/TltuNfWYmqqSmU1nS8LE6WHlVI0MAL04AvS30RSEmaXeOf6mb3ZkH80vmBVrtoIQ3qE03p+wWAtr5KHU2sMRcKyM5umZnP3UaZ9qDZ84FzjvN0g+rdFwxXpv//63Hz743Bxt7aev3bOYP+IlNXnmtDc2piyxK7f//1jfx//+r2yJpYVwIAAEt1BIsOVjBhl2Mv/+3DEB4AN9QU0/YQAEhUjpN2GJRjZi3eSqDSvFpjgv/CGdgiC8YIZJlCPB4kQtzHHsPCQYLh8HAoIYtJbDpxlSMi7SGbSWKOOipq7TvR4HtE3CtwQ9rS3vXVW1aM8c9RM+Ma9RU0VcCQU7gaff/y4ppdty/xgBgAAAPmdAgQyV5AMFbDZFnl8k+gVBsDxaDoqF4jgsySIIkk05myo0bjA55iNyk1RkYEZYVFSitHSVbSpA9VpXFWGUSsNVKPWQHx2U6i6pI/PHvlatLV4rL+mrURkEyVEsukaMkSGkaNyUTDTKxV5g0H1pwRKplLhauVPcjWLyYbVMAr0UAkGQAAAA+CnRhYSrEwHpO4tx0Ik3asDWbyHQx8j9CqlUpwxDZhc4NpFXnzxOw2wVSOiaDDyCZVs2VMy832a//tyxB8AjgkTJUekzwHkoaNcxI44tba2LVffzdQ7d5Nn7lNv2snzKO4XbGx99QbKllX5Z4SwSpiT0ktzEju3FGusZ/26N0VBoAHBxGJOJJUEZ9aYydJYrrXZs1HS6GKGvZLIKqB8wfPAisIUCM8KlThATjomCpYPkhs0hSLnjQIiIPjY4bDJEISBGYJUR1AbEoqKnCiNzSqi7BpoUrJwmhWtKksrVYasoY57KwMsl9qg5CYOrK0f/8yiqwrpcpTSVQAECIgACC1YwEDICAhTPYxlAx6wUakzN8alrJSvVWSkpNe2HKTVT2paiTI5f/zVrLZekf0j9dWjky0BIKYVeqpfVUu+scsmuR/+qsea9VWMlVV2/qykGdF6KOiuxtMKTEFNRTMuMTAwVVVVVVVVVVVVVVVVVVVVVVX/+3DEPIPL4WkBoYh8CAAANIAAAARVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV", "espada_acerto": "data:audio/mpeg;base64,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", "espada_golpe": "data:audio/mpeg;base64,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hSfPw5i/Isv5Ii5M7ipZyDR+yu2TvqeXeseNbGdVpfWLQtQrZtK3Whe87VJLlomAlgdIuHaWU4WMaBACFy8t46cNxB9mvGKUIcgMcpr1qUioBLJXytW3nST9Dy1R1pQnnTbQoHOhRFTSyJkr5iVQhYQyih02oJos/KWRK9UMAAHkilWqlOX472osR3JFyaFCnnZzFMhMq4L2X4vKmgy2Y7RZMzbe2tuR97ZtWJe/Ylc9XUTGngR5hADqnNuCy+Uyo4w63lIxoYYyt2BWluo4QM1Tug0iCYHkD1M/ChCnjhU/WV6mjUPWpTGYyr5SksPkopQMCVVaTdExGfCpZGDIqhT/FrEDaFaszqqvY3/////6gABCIADx5D1dOqWXXmn/+3DE3gBSeRsxh+06ihkjZWD9p1G2T1rXBGXEp555k9WxXu61HWbVpWn161e+f2uLYrNduzuVLZMCJRo9o4ZcKRXJSqsBRAMCpXTUyNxfcyyBN6Kw4ETOlAinABQfDRNfF94wWaP/FTRY6HzZi2JvkczMSiKHJ4Nf6iPvs7vt+CX/0f0qAgoAFbX2zQ0HTUxZNchyCkFoe7NUN//NdysNLcrAsdNeq1PRT4WBLo0k1IozNSNcrBalq5D1A5ZnUnYyqCNzExDTWpHO03f/f93j/4/1LMKpmlqX6oZ8zqylbVv6GNm+Yxaashi+pW6shn+VuoYKhojI4ls1nsNAgqkvDc/u6jKKyqSaaV1aSaSaaV1dXU7/2MlUk00l4PZlFZZNRsyTEJxds8JgycxfTCNkzDOMM5ELQJlH//tyxOMAEokfHKftOoH0nqMkzaNIKbx6lCZxnm4h6ELayzK5tbH7hPFt/kyyyVDL+NZZZZLNlDAwQYGCDo6Oks9ZZLLKCBggQOWWWSz7LJ5MoYGCphu/6bf/6CaYCyWmmoct/0//SVVVVdNNMNZMQU1FMy4xMDCqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqr/+3DE7IIO7Y8GxGRaglavUwSXj4mqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq", "flecha_acerto": "data:audio/mpeg;base64,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", "flecha_disparo": "data:audio/mpeg;base64,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", "inimigo_1": "data:audio/mpeg;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjYwLjE2LjEwMAAAAAAAAAAAAAAA//twwAAAAAAAAAAAAAAAAAAAAAAASW5mbwAAAA8AAAALAAAOsQAqKioqKioqKio/Pz8/Pz8/Pz9VVVVVVVVVVVVqampqampqamp/f39/f39/f3+VlZWVlZWVlZWqqqqqqqqqqqrAwMDAwMDAwMDV1dXV1dXV1dXq6urq6urq6ur///////////8AAAAATGF2YzYwLjMxAAAAAAAAAAAAAAAAJAQvAAAAAAAADrHcicAHAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAP/7cMQAA41wjxgsMTYCeLTkAc016AJpY3E3eMTiJJlOqPGWPGy+OMzWUnCWjRkAz2HIOPyy+avXKsgcNx3oVJFZe0tQd/QrLi0nmb/eRk9QUQJt//+snv9o3hQSBcfBMLekhicQDY0HxAnQJ/D5wgTV9YWOH+w/E4g9CeGA+T/5B1expnxgUDDhnAw+Tkg+sKiUxmHxILo8MhMDoQ7tujkB0GYxAXMCIECcMPQTAUCvgQgjSFkrF9R4EFTcxzfuTAjDTuyhcIAxMQh51GwS32YrjbgyyxL3ktf9DWam2sxD4JYPUJQZSkrof83b0Z+jMGTadJcv+SDITU3f+sycedZpqb/rJpk86lzBqq0JgbtNlt/U1DfzpcfU2m3/1mSKsMQAQHRp3qVRIQEMMDGDhMRvaU6Q4BZhQCz/+3LEDQARzWcpDumvQj+spaHdNegYAao1SgkDDBmLDqQOjRcFBS2w0RMYTEg8Sh9+lsCo1zElV5peGIFgK8YmQDEiulETEjU3ZGqftkUBU7hNxpKGDuf6Hq1MioAWAF0AeB4J1f/dXqKJpenXrKCL82PKac/+lQbX/61tq9NvzP3/1VFnW62S/TwYAAB08WkDN0rDGMLwMVKKyajIFUR0Vw4K0LqUwZFUwfVg4eP8y7cxDQBNCYepYLFmQMVc5+QsiWohxg8qgEJJmfxNQBVsUBl1FHzACpxTRkDDFnKhRXDkb3v7T19epk9fcSwJ4BWA1AsxadX/1lPqN/Q0mnjJDWT6eZ/16ymo8v/+t20vRv9Fvr1mHnDvxaowQAAAgyQZQCrcnqYXgZiMGqctmnXnMSFQKAgoCOjCxf/7cMQQAZHNZzMuabECOarnfbw2IDNDjQ+WzjHauNTBYwMEBogEANZQMALcQ5KjTeLVuwOhAEFMfDDCJ3BhhipiQxEJdlLl7Uh44w9hKCAQAzCiFPOHIq+HVFxDfxuACOC4Bdlwg//11kg1qlp6egzuin2o6H/s6k1f/6v9T/pfrp/z5MASETxe3RMAMTVnHb0Dc40Zw468GELkUJAoBqxmCCJnTEZR5nQnZnsCAmMmHV7OVZJFqTcKCTEQMMHCMQDgoOgdVn2SZwME/rm4FsBAQHIXeoMABC4MHceSk5MIlf9yRAMMB8EpE3Pf/3qGLut1lpnVWXjM3KTI1UlLdSfX33NJ9v/9jfUadND/0dSzDk40BAAAAADFFk0VDmqQdcZhMbGFAA6CyHlMIkwzWOQQIEEhjcdGNFn/+3LEE4HSlP85jmVRAmCe5tXNNiAZ4T52c0GSEoBguYxBkBDwb7MSLzxlTAHmBgQAREIICBMkk10DDRCAQESu2XF9kQllApNACarZrmn9OEeLFe6ALE0oyfmVGYNwlgQh1Br/qf+dslc98XlxiItiUuh6zv0mnsZllP/vv2+yV6P/XB2hXNPCIUCJznJCYYAErVHgaoYdJpvURGEQmIA8FAUYbdxo8aH7i0bbD5EZDCouZkv8rDEg4uWlcPBRICbtCF25kGwJPhzwgUiM4FCLWkVxZgOiV6WomqsPHQJ7C1MMqNCUBg+E0BgJiezj1jSHKEuCOSLHv9av0On1TWcKxhBjuSBqWzR5q/yeTC6ZMfJf632YZ9kt0/+m8IAAACQGFj8zDLSRkHAQyj4AEiU66mawABOZgEMIRP/7cMQPgRJo4z1OZPFCSyWndcyqIZ+otGBDUZJXptZCmkgMJBoVAwUBZ0zBEVYq3y+Zd8t6yIm/AoYdqHHmEiRQo9DwQGBUGlDUk2Eb0FAVUE4Ey0OVZ/+2rV7/1f1qZnWcASFYA53fopFGRnQvSQ2OOGccASFA8HqPfHrpQMAu5P+vO5Hz0r1azAEAACgqHvrOim4IQKYZYJsoNgoLPuxF3wSqQgaL+zMNBwwmIDNunM5rkxMG1el0CKBW5INZLO1fm4csQO1VhMGBtQo4HErGuIDVVH5UrBRKCYmWAQS1V7hNA185Mhj0d6aSF9C5Kgjg+C4CkhCcJn+hCz2zWf8xtBFKPCI10fVLaHE6mmPXr6f9XvHyTl/5GazUkBYAAAABKdidcocNIxO8QU1VIYXOw6ZAABQutGr/+3LEDoESxVdLrRU7Gjwo5/W8nehaZeubvoDjiXz6QAoG/sgtVGLsIYUwZHd51LXHfhp0nl7twBWlM9YQSjIgVEr8tSPDH/O/+KB0TGDx3/2/2+2PDACcarH+Y+ioYxUOxeRymPsYqPkqI6w0y5EdmZRW5YF2XrbFI2hIjrIoJlBgqYJoiA00NFHclhq5PgMAABl4N/aZ+xIAABnjUBj9qyz3JGAAzYIYs6iexhSwd5vlVyNBdLUzUzvnCJHWeaH00EBwqWTcERgyWAo09gcMyhYZCgQgpHLuZjDKHAvOIhTMCDWjHDKCGXYw5DlKVFQcZUYGRoawtAaJUjdv9/Nk33U04fqaBYgYaej6M7GaHGb99f3//I/P3HHHtUjVoAAAAAIOBqcPNqmuIjQaEDYJBCfcOAwKDofMKP/7cMQOARKw/TtOaPEB5ypp9ZeeIgRFpOQEAMxvOguNQMIzG4hMJh0yegTAQKBydkEMpWpLjQ5RwqEDLpDGuDmoFWjxAHNB0QkurCu5v0eFor2AoGZMEbOa1DJiukaKVNJjrkgWH2FuJheI7CYIiIyv//yR5DRI4meKBFGxG/3zsoavoOHlbTtPLh+UqK6KwwAATFMgxIuJD4AEFLBs0FLrEp0hyIegbPPip40SqgvctgaTC9tFwitumFqPQC6gVYvKQxmSutD9jVsrxaCCI8cBYFzPWkFWA7JP5AcaNgmr/8x/Mk90Y4xajwrEc5vzm9GL+qNXoPn06P6lRuBg6LHmFOaWfoFyGhXCAAAAAilGTrwY2YZEJznimqhKCQIDgSYqKBg1BAYxF+jDILMBg4KgxDAGm4wEYRn/+3LEGAGTqTM3TmTvgoanZYXdRXik7NTmmO5YFRzEeSWJQ6ZcZkHAIEZSGggKEHRhhLEXRcBszbTCwoYCYYgXsMdM7DSJRSVuwiFGlgnuWq2b/+4rcser8fAGInf//Pluzj5AnHAoDwRQeOnVhqR8Vq3+d0HFLL/fIKQYSDIet1skoLkIABJA0M8gTOCVCEQOmAoOmOIKmDQ0GHgHmJgDmCIclDkChjMrzWxh5UXHHjZj5huRhuSgoCayvSGh0C7oVBhAEWFJdoQsiKgFSx+Vouov5vm/cpm6Rxb8yBUoIuAxJrNDKGVRMgg7htVnDUJ0VqIRCFQHgARkCJUlmqb/9C76nZSnMiaIAMyLah9vsan//9OXk/+owRIqZGx7Mf3t//8mgAAAMCQzwRAFAcd7kxQAwwijRVJgEf/7cMQLAZHtMy7uZavCJqZkjaeeMFAoFgCjiYCAYEHBqBoqGi0Fq0eC2BeOVDA6PNhsz/QSrl6VnPGvVDWHH1ym6sSYllurIZTOOGh2jtFQUdWHc0DotdTkuCRAGkFtGIBLSAJiQab/2WaqqL8upG61OdMEqRFGKaGrf/Wk576n/2S/6jVFcyw6qrO///JVFFIkKiDYJT/uDYXxQ4AoyHUECzKxhkmSmgwEkGDhphhQqvBUVZUIEgpKADVIxUnUSoV0AOnSTk7CTDhRB5a09cYuMNbAI89EmHUwoqPZWtz+Dr+uUiD5OU3QbpCiwl1WWKLP///1mtiUw9FyPmsFiQjg5Lg6f/9f99n9/+s4iPHjhewtK9n//iUEDCAMQjxrcwaAdl+VbRQADhYv8ZoHmHhBkI2YABJJBcn/+3LEEIARnWsULbzxgXOR4ymGGdgMBGho7C4aLAQIEVMUqQ1KGLbTQ0gGEj1aFpAsgCk0WJQ56pm872YK0AuCPBqgNJnfVcSqUTD/8n6hJIm5xLibyhHKSVgVsSv//+ciSM2a3SJhFCUVFzW+rZur/uXztzjv/jpHm/q013+3/jwAsGAkqlp1n1XiZBrpYLhKpWtJ7mQp0yFmSNxa5MYDrjZqOxk+pmAyekqjrRd/vjV2JJki0bItuev//2OnK0oKEhJ3zI0Y8KGxWKAr+WfI4LcJv9R7yrv5KHNT/koEJRSQrGYehMPZQXqTpCEqPtcBsZk2wVEGHS1Mqk1JjLVZl61WP/ioaqXz1UqpcY1/8Mfk2XtS1UuNrG6vt7N/Ub+MR0oay/xqTGpHnSZqWqkayGpfVL2ZVZq2pf/7cMQuA8ytevxmGG5IAAA0gAAABPHCpVbguTxvP5VMQU1FMy4xMDBVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVU=", "inimigo_2": "data:audio/mpeg;base64,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", "livro_cura": "data:audio/mpeg;base64,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/xUVFBZv+sVqTEFNRTMuMTAwqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq//twxOgDD7VC9kywY8IKtFAI8w34qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqg==", "magia_acerto": "data:audio/mpeg;base64,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y0J8K27xeXOIX8cKHEUjt0ig2ViDotzQCXUvAK1nDjYCbutUxSdFtEO/I/5TJF51NnxFzp7q/eY8tkzMtTnbDrimsvd8HxR365/xsXO4BDIkYEwCePoXlkWBESUqlUXSoKyaNRmuT61NxMw00OqtWsttgkhFTaJbgiUMGpRkRFUgFeRUuYXSsRAkybHZkq5KpqDokzxVEVbBFAQ2hW5EqhVIUJLbSNnMSY+ICsmYs0QmCi8l3AkgkCIogwMFYvDgUJkUvE55aREpKqOCt3sUHwK5wnG7lJEdYk85/zteZj//e7yySkbOzCmJULkl0Nmz25XbrCnYYtsbgvdbewGJlf/7csTmANEZSTvGGH6CRKsmUMSZ+RSFSxjHywREyopM0s8iaj1ctCkhZLPxMUs4QuVZ/jBYhYatDDUMKksTbHorniy6FKYpZ6uXFUlLCohZvLQ5quxpMKmaWRM51iJFeX4oWctUhFLgImATgKrc9jCgKR1lUvY/CiVKbVSDCqFb6pMcoUFN4d1MQU1FMy4xMDCqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqAEBIXEssK3LwQobD8T1bbmbPWWnRdKSEnWPo5GX/ZYDBxyP5bDIyZZHI1a9scjUMFBJLwbcTCkRA6MlC6iaxCNA6DogI//twxOuA0zGLJIYk0cIuMiIA9I65zD3SjX9X//X/////zWURCIhkPlEbDbpRqrq6urSSnm/7Gq//8opJJ1OG5/V1uNISIqVKLwuSpY6dKI2NMhLrFP6hdmKi2oX1itVMQU1FMy4xMDBVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVf/7csS0g9HFlromDTUAAAA0gAAABFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV", "magia_lanca": "data:audio/mpeg;base64,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", "moeda": "data:audio/mpeg;base64,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nqyyiV64/eLQkBizZ6VdYVTqJFjrF1kcAMGAUcnRp4WicWeqnxKTjS0EpynyvUs+aROMWRKt//tyxPGA0tFrHwekvkpRLSNg9iMhRIFFAR6C59GlFOWyyyGW37NUPpMFpNSa/k1I1/zVgaGus/8ljkZNSWOrGJZz1jiQzl/2GrS5k1Joaw1/lIUFQ1n//qsMSzq1P/sYKDR+L7AEROjwE134VZUBVUxBTUUzLjEwMFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVX/+3DE7oATMTcGB6TaQeM0XSRjDwBVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV", "pedra_1": "data:audio/mpeg;base64,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BbtYMVHR1ddzaoWlb3vT11vKJ3s+reF/tJsOxLDvUTDoxR9B8OH3BZESAqoig+ocIH1IFxYOtA66SaCbativ6vqqAEIQkpWQE8eYuKUdorRJIlyxFZMhKmJPvFl40aFI6bSSGUQnI94cspK4OWdRdac16i73hReNPe28vykiWElz5mcmdOZ2OqZ3O80/w7c18OI5kFlEhKPLz/fC6Xhy7x87JflkUTe/nPM9yOb6ttYvO84/sqqBkp8ZOzL9E31VU/JdjRIXBQWHbRzw11y07gst0iIAF5EIEjQmEJkibFMxTBFNCUkJWRUdsyyRSRqgY8JKCjkiMP/7cMTFAg4dHwonjLbBjaChmLeKgEnRZJqnKuW2nk60SlkbIskpMa67GsO6/tSDIKokMYCgqNSY6TRqTZNfJnEw9qrMpBnarGpRo1JjVBUNf81qGu2TTJtYa0mpTVoyk1WHP4dIMgqYaSKLW9LN//yY4klmt+rFWEtMQU1FMy4xMDBVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVX/+3LE7IISLaL8R6THwh40XRiTDblVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVUxBTUUzLjEwMFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVf/7cMRtg8AAAaQAAAAgAAA0gAAABFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVU=", "pedra_2": "data:audio/mpeg;base64,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dbtyo0t5zHVlFVU1VvMeu6Pqy6XvIHqZJsslVCPMWjVdR8rMjDHVYxperTSeVdxjMxz53L/D+5pN5tPdqhvHVGJ05KVlVMaWb7kZrVza1a63XOO3O9kFdN0emVE+hvK1qVyqUqvvS1FqGhogb7KJqKbGK0tOnNsVe58vFatKzoM6tvyUbhLUkpBqDcI7VUKbDPkFgUoOW1JQTwLF+oZia3IcpKrLstRyvBwQ8Nps1JmPbXlJlVtqZO2ZMGtGS+3SXcZTI5bNtttDYnRhX41LwAEpt0lIFFqAqCUtqNGuqpbZosaFUmSxxhQVB1qCllJlpGsOkzUmsP/7cMTfAc7JHQgHjXbCM7PgFPYg+dWhrDJrIaw1awj/lJo4woKhrIaykayMsdWpfS/5/yoKCg0MvNQ0NYaw1pNcya2GTUjVxIZyP8mpNSamsZYatD6hqGBh6gezqFTP5YiAiQ9MQU1FMy4xMDCqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqr/+3LE7wASUfj4B6R3Sdoz3XRgjciqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqkxBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqv/7cMRtg8AAAaQAAAAgAAA0gAAABKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqo=", "pedra_3": "data:audio/mpeg;base64,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JJKjERWjjGBrpP27EOVVOYur1agj7nlW5z35ZLaxJi4RNkp2vEufOfcUNOi9v/M90eTtcPXN+JaKSx/+y+9/zP3crcUqAweQpYBsIypk9dZOVOR4zrDvLl1r5WzLsAlAkWm3VuCm11BiTE3E1NmaVRIMkUKowdSYMpLobKFtILGY6ymjATGYqYFGqqg4Kmh6EtLCkT0F0SFJlY2PcBCqGYV7USVVAxrZoKaqFVS2OqsY2hlmFUlElqStCqG2okoQ14zqEKW4KCtq2N/8xtmhyGYKikgGBUAo2EjVEjrRJHqJGmQkWo4tRI20TrRJFqJFLROtE60TTP/7cMTPgw5Y3whHjLaB5Z/gAPGW2VkTj1EjbRZZEpNEGMSIlJonXL4kaYtFro2FoteNhxcJGlLIloJS1Phx1qSNjZaKpNSFBQYwqo1JoZQ1akrUmu11hrHEhgTkf52kyoYkCCg0cjWXJqhkwUMCcZgka4FCpIK9aQka+SBkiCxFywETTEFNRTMuMTAwqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqr/+3LE6wOR2Z74JjBnykUym0hjDniqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqkxBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqv/7cMRtg8AAAaQAAAAgAAA0gAAABKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqo=", "pedra_4": "data:audio/mpeg;base64,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Km9RB2auX7/wOUi2OSHtJWsBdqEmwNUf5W6BHNQnXLYkxW9m25jwqT5lv/Gvkut8nGbYdf3s0m8n2tR1AIQAEQpCUfWVpyYhMuSk61WRwtZFu80bJxJzkquTSSVVW4S308JGxas/dGZiyTs+bLVOaUtkpOypbfNU/2RQU75618/f/nLliVbvfHI5KLzJVo/UTVV2sidZK8siUS52f1TnaURRfNItRtTjei4JY5HPOOjyWzj5VNrdiSX0UVxIVyLLP/pXX/srpvim21LoBg+QNsPZle3W5JCRFTqi8HQ0tn/xQcaqpONAij4dno0UKFkE1JEQYDLMtv/7cMTTg8343wgHjXbB8CbgQMQPIXaTjSzLi82e/3KmiymfzUnGigI9C82W/fNmjThIGZcXDtJcXmzRrN+7TRpxR8XG96OeNypOLdnZ2k4SBmXF5v7teVJISKAj4uLZzjj4vKk4t4dnZziyzLZ27OXF5s0aU1s9TRooCPi82af/NmjTj1lMQU1FMy4xMDBVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVX/+3LE74AR+Zj7JhjECmxBWECRmhFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVUxBTUUzLjEwMFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVf/7cMRtg8AAAaQAAAAgAAA0gAAABFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVU=", "pedra_quebra": "data:audio/mpeg;base64,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qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqr/+3DEugPTDaL5ozDLgAAANIAAAASqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq"};
/*FIM_SONS*/
