/**
 * Animação:
 * 1) Mostra mensagem (DOM) e ao clicar começa
 * 2) Texto dissolve -> vira partículas (mini-corações)
 * 3) Partículas “andam” até pontos de um coração grande
 * 4) Quando estabiliza, aparece botão central
 * 5) Botão abre cartinha (modal)
 */

const canvas = document.getElementById("scene");
const ctx = canvas.getContext("2d");

const intro = document.getElementById("intro");
const centerUI = document.getElementById("center-ui");
const openBtn = document.getElementById("openBtn");

const letter = document.getElementById("letter");
const closeLetter = document.getElementById("closeLetter");
const okBtn = document.getElementById("okBtn");

let W = 0, H = 0, DPR = 1;

// Estados
const STATE = {
  WAIT_START: "WAIT_START",
  DISSOLVE: "DISSOLVE",
  DRIFT: "DRIFT",
  FORM_HEART: "FORM_HEART",
  READY: "READY"
};
let state = STATE.WAIT_START;

let particles = [];
let heartTargets = [];
let formedProgress = 0;

const CONFIG = {
  // quantidade final (pontos do coração)
  heartPointCount: 420,

  // dissolve (texto)
  textSampleStep: 10, // menor = mais partículas
  dissolveDurationMs: 400,

  // drift antes de formar coração
  driftDurationMs: 400,

  // formação do coração
  formDurationMs: 900,

  // estilo
  backgroundFade: 0.18,
  heartBeat: true
};

// timers
let t0 = 0;

// helpers
function clamp(v, a, b){ return Math.max(a, Math.min(b, v)); }
function lerp(a, b, t){ return a + (b - a) * t; }
function easeOutCubic(t){ return 1 - Math.pow(1 - t, 3); }
function easeInOutCubic(t){
  return t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t + 2, 3)/2;
}

// Resize
function resize(){
  DPR = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
  W = Math.floor(window.innerWidth);
  H = Math.floor(window.innerHeight);

  canvas.width = Math.floor(W * DPR);
  canvas.height = Math.floor(H * DPR);
  canvas.style.width = W + "px";
  canvas.style.height = H + "px";

  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

  // se já gerou targets, recalcula (responsivo)
  if (state !== STATE.WAIT_START) {
    heartTargets = generateHeartTargets(CONFIG.heartPointCount);
    // reatribui targets para as partículas existentes (1:1)
    for (let i = 0; i < particles.length; i++){
      const t = heartTargets[i % heartTargets.length];
      particles[i].tx = t.x;
      particles[i].ty = t.y;
    }
  }
}

window.addEventListener("resize", () => {
  // para manter tudo alinhado sem dor de cabeça:
  resize();
});

// Coração (equação paramétrica) -> pontos alvo
function generateHeartTargets(count){
  const pts = []

  const scale = Math.min(W, H) * 0.030
  const cx = W * 0.5
  const cy = H * 0.52

  for(let i = 0; i < count; i++){

    const t = (i / count) * Math.PI * 2

    const x = 16 * Math.pow(Math.sin(t),3)

    const y =
      13 * Math.cos(t) -
      5 * Math.cos(2*t) -
      2 * Math.cos(3*t) -
      Math.cos(4*t)

    pts.push({
      x: cx + x * scale,
      y: cy - y * scale
    })
  }

  return pts
}

// Criar partículas a partir de texto (offscreen)
function textToParticles(text){
  const off = document.createElement("canvas");
  const octx = off.getContext("2d");

  off.width = Math.floor(W);
  off.height = Math.floor(H);

  // desenha texto no centro
  const fontSize = Math.floor(Math.min(W, H) * 0.085); // responsivo
  octx.clearRect(0, 0, off.width, off.height);
  octx.fillStyle = "#fff";
  octx.textAlign = "center";
  octx.textBaseline = "middle";
  octx.font = `700 ${fontSize}px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial`;

  // quebra em 2 linhas se necessário (simples)
  const maxWidth = Math.floor(W * 0.86);
  const lines = wrapText(octx, text, maxWidth);
  const lineH = Math.floor(fontSize * 1.10);
  const startY = H * 0.40 - (lines.length - 1) * lineH * 0.5;

  for (let i = 0; i < lines.length; i++){
    octx.fillText(lines[i], W * 0.5, startY + i * lineH);
  }

  // lê pixels e cria partículas onde existe texto
  const img = octx.getImageData(0, 0, off.width, off.height).data;
  const step = CONFIG.textSampleStep;

  const pts = [];
  for (let y = 0; y < off.height; y += step){
    for (let x = 0; x < off.width; x += step){
      const idx = (y * off.width + x) * 4;
      const a = img[idx + 3];
      if (a > 40){
        pts.push({ x, y });
      }
    }
  }

  return pts;
}

// wrap simples
function wrapText(context, text, maxWidth){
  const words = text.split(" ");
  const lines = [];
  let line = "";

  for (const w of words){
    const test = line ? line + " " + w : w;
    const width = context.measureText(test).width;
    if (width > maxWidth && line){
      lines.push(line);
      line = w;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

// Partícula (mini coração)
function makeParticle(x, y, tx, ty){
  const angle = Math.random() * Math.PI * 2;
  const sp = Math.random() * 0.8 + 0.25;

  return {
    x, y,
    vx: Math.cos(angle) * sp,
    vy: Math.sin(angle) * sp,
    tx, ty,
    size: Math.random() * 1.8 + 2.2,
    alpha: 0.9
  };
}

// Desenhar mini coração (canvas)
function drawMiniHeart(x,y,size,alpha){

  ctx.save()

  ctx.translate(x,y)

  ctx.scale(size,size)

  ctx.globalAlpha = alpha

  ctx.shadowBlur = 14
  ctx.shadowColor = "#FF001E"

  const gradient = ctx.createLinearGradient(-4, -4, 4, 4)
  gradient.addColorStop(0, "#FF3B52")
  gradient.addColorStop(0.55, "#FF001E")
  gradient.addColorStop(1, "#8F0013")

  ctx.fillStyle = gradient

  ctx.beginPath()

  ctx.moveTo(0,-1)

  ctx.bezierCurveTo(1.5,-3,4,-1,0,3)

  ctx.bezierCurveTo(-4,-1,-1.5,-3,0,-1)

  ctx.closePath()

  ctx.fill()

  ctx.restore()
}

// Fundo com leve “trail”
function fadeBackground(){
  ctx.fillStyle = `rgba(0,0,0,${CONFIG.backgroundFade})`;
  ctx.fillRect(0, 0, W, H);
}

// Cena: criar tudo e iniciar
function start(){
  // some intro
  intro.classList.add("hidden");

  // gera targets do coração grande
  heartTargets = generateHeartTargets(CONFIG.heartPointCount);

  // transforma texto em pontos
  const text = document.querySelector(".intro-title").textContent.trim();
  const textPts = textToParticles(text);

  // garante exatamente o mesmo número de partículas que pontos do coração
  const particlesCount = CONFIG.heartPointCount

  particles = []

  for(let i = 0; i < particlesCount; i++){

    const p = textPts[Math.floor(Math.random() * textPts.length)]
    const t = heartTargets[i]

    particles.push(
      makeParticle(p.x, p.y, t.x, t.y)
    )

  }

  // timers
  state = STATE.DISSOLVE;
  t0 = performance.now();
  formedProgress = 0;

  // garante UI central escondida
  centerUI.classList.add("hidden");
}

// animação principal
function animate(now){
  requestAnimationFrame(animate);

  // limpa com trail
  ctx.clearRect(0,0,W,H)

  // coração “bate” quando pronto
  const beat = (state === STATE.READY)
    ? (1 + 0.05 * Math.sin(now * 0.01))
    : 1;

  // desenha e atualiza partículas
  for (let i = 0; i < particles.length; i++){
    const p = particles[i];

    if (state === STATE.DISSOLVE){
      // dissolve: espalha um pouquinho (explodir suave)
      const t = clamp((now - t0) / CONFIG.dissolveDurationMs, 0, 1);
      const k = easeOutCubic(t);

      // acelera levemente no começo
      p.x += p.vx * (1.2 + 1.8 * k);
      p.y += p.vy * (1.2 + 1.8 * k);

      if (t >= 1){
        state = STATE.DRIFT;
        t0 = now;
      }

    } else if (state === STATE.DRIFT){
      // drift: flutuando e “indo” pro centro sutilmente
      const t = clamp((now - t0) / CONFIG.driftDurationMs, 0, 1);
      const k = easeInOutCubic(t);

      const cx = W * 0.5;
      const cy = H * 0.45;
      p.x += p.vx * 0.9 + (cx - p.x) * 0.0015 * k;
      p.y += p.vy * 0.9 + (cy - p.y) * 0.0015 * k;

      if (t >= 1){
        state = STATE.FORM_HEART;
        t0 = now;
      }

    } else if (state === STATE.FORM_HEART){
      // formação: mover para targets
      const t = clamp((now - t0) / CONFIG.formDurationMs, 0, 1);
      const k = easeInOutCubic(t);

      // força para o alvo aumenta com o tempo
      const pull = 0.010 + 0.030 * k;

      p.x += (p.tx - p.x) * pull;
      p.y += (p.ty - p.y) * pull;

      // estabilização
      if (t >= 1){
        // checa se quase todo mundo tá perto do alvo
        if (formedProgress === 0){
          formedProgress = 1;
          state = STATE.READY;
          centerUI.classList.remove("hidden");
        }
      }

    } else if (state === STATE.READY){
      // mantém no formato, com “batida” (scale ao redor do centro)
      const cx = W * 0.5;
      const cy = H * 0.48;
      const dx = p.tx - cx;
      const dy = p.ty - cy;

      const targetBeatX = cx + dx * beat;
      const targetBeatY = cy + dy * beat;

      p.x += (targetBeatX - p.x) * 0.06;
      p.y += (targetBeatY - p.y) * 0.06;
    }

    // desenhar
    drawMiniHeart(p.x, p.y, p.size, p.alpha)
  }

  // texto discreto “sombra” quando pronto (opcional)
  if (state === STATE.READY){
    ctx.save();
    ctx.globalAlpha = 0.12;
    ctx.fillStyle = "white";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `600 ${Math.floor(Math.min(W,H)*0.018)}px ui-sans-serif, system-ui`;
    ctx.fillText("💜", W*0.5, H*0.49);
    ctx.restore();
  }
}

// Carta modal
function openLetter(){
  letter.classList.remove("hidden");
}
function closeLetterModal(){
  letter.classList.add("hidden");
}

// Eventos
intro.addEventListener("click", () => {
  if (state !== STATE.WAIT_START) return;

  intro.classList.add("hidden")

  setTimeout(start, 100)
});

openBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  if (state === STATE.READY) {
    openLetter();
  }
});
closeLetter.addEventListener("click", closeLetterModal);
okBtn.addEventListener("click", closeLetterModal);

// ESC fecha modal
window.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !letter.classList.contains("hidden")){
    closeLetterModal();
  }
});

// init
resize();
ctx.fillStyle = "rgba(0,0,0,1)";
ctx.fillRect(0,0,W,H);
requestAnimationFrame(animate);
