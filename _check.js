
(function(){
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const GROUND_H = 90;

  const GRAVITY = 1500;
  const FLAP = -430;
  const PIPE_W = 68;
  const GAP = 180;
  let pipeSpeed = 190;
  const SPACING = 240;
  const MAX_FALL = 900;

  let last = 0, frame = 0;
  let groundOffset = 0, cloudOffset = 0;
  let shake = 0;

  let best = 0;
  try { best = parseInt(localStorage.getItem('alexPoopBest') || '0', 10) || 0; } catch(e) { best = 0; }

  let state = 'ready'; // ready | playing | caught | gameover
  let score = 0;

  let alex = { x: 90, y: H/2, vy: 0, w: 26, h: 30, rot: 0 };
  let poop = { x: alex.x - 90, y: alex.y, scale: 1, catchT: 0 };
  let pipes = [];
  let clouds = [
    {x: 40, y: 80, s: 1.1}, {x: 220, y: 140, s: 0.8}, {x: 340, y: 60, s: 1.3}
  ];

  // ---------- audio ----------
  let actx = null;
  function ac() { if (!actx) { try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch(e){} } return actx; }
  function beep(freq, dur, type, vol, delay) {
    const a = ac(); if (!a) return;
    delay = delay || 0;
    const t0 = a.currentTime + delay;
    const osc = a.createOscillator();
    const gain = a.createGain();
    osc.type = type || 'square';
    osc.frequency.setValueAtTime(freq, t0);
    gain.gain.setValueAtTime(vol || 0.06, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(gain); gain.connect(a.destination);
    osc.start(t0); osc.stop(t0 + dur);
  }
  function sndFlap() { beep(520, 0.09, 'square', 0.05); }
  function sndScore() { beep(880, 0.08, 'triangle', 0.06); beep(1200, 0.09, 'triangle', 0.05, 0.05); }
  function sndCatch() { beep(220, 0.25, 'sawtooth', 0.08); beep(120, 0.35, 'sawtooth', 0.08, 0.08); }

  // ---------- helpers ----------
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function easeIn(t) { return t * t; }
  function hash(n) { const s = Math.sin(n) * 43758.5453; return s - Math.floor(s); }

  function resetGame() {
    alex.y = H/2; alex.vy = 0; alex.rot = 0;
    pipes = [];
    let startX = W + 60;
    for (let i = 0; i < 4; i++) {
      spawnPipe(startX + i * SPACING);
    }
    score = 0;
    pipeSpeed = 190;
    poop.scale = 1; poop.catchT = 0;
    poop.x = alex.x - 90; poop.y = alex.y;
    state = 'ready';
  }

  function spawnPipe(xPos) {
    const margin = 70;
    const minY = margin;
    const maxY = H - GROUND_H - margin - GAP;
    const gapY = minY + Math.random() * Math.max(10, (maxY - minY));
    pipes.push({ x: xPos, gapY: gapY, passed: false, seed: Math.random() * 1000 });
  }

  function triggerCaught() {
    if (state === 'playing') {
      state = 'caught';
      poop.catchT = 0;
      shake = 14;
      sndCatch();
    }
  }

  function handleInput() {
    ac();
    if (state === 'ready') {
      state = 'playing';
      alex.vy = FLAP;
      sndFlap();
    } else if (state === 'playing') {
      alex.vy = FLAP;
      sndFlap();
    } else if (state === 'gameover') {
      resetGame();
    }
  }

  canvas.addEventListener('mousedown', handleInput);
  canvas.addEventListener('touchstart', function(e){ e.preventDefault(); handleInput(); }, {passive:false});
  window.addEventListener('keydown', function(e){
    if (e.code === 'Space' || e.code === 'ArrowUp') { e.preventDefault(); handleInput(); }
  });

  // ---------- update ----------
  function update(dt) {
    groundOffset -= pipeSpeed * dt * 0.6;
    cloudOffset -= 18 * dt;
    if (shake > 0) shake = Math.max(0, shake - dt * 40);

    if (state === 'ready') {
      alex.y = H/2 + Math.sin(frame * 0.05) * 10;
      alex.rot = Math.sin(frame * 0.05) * 0.05;
      poop.x = alex.x - 90;
      poop.y = alex.y + Math.sin(frame * 0.05 + 1) * 8;
      frame++;
      return;
    }

    if (state === 'playing') {
      alex.vy += GRAVITY * dt;
      alex.vy = Math.min(alex.vy, MAX_FALL);
      alex.y += alex.vy * dt;
      alex.rot = clamp(alex.vy / 500, -0.6, 1.3);

      pipeSpeed = 190 + Math.min(score * 3, 90);

      for (let i = 0; i < pipes.length; i++) pipes[i].x -= pipeSpeed * dt;
      if (pipes.length && pipes[0].x < -PIPE_W - 10) pipes.shift();
      const lastPipe = pipes[pipes.length - 1];
      if (!lastPipe || lastPipe.x < W - SPACING) {
        spawnPipe((lastPipe ? lastPipe.x : W) + SPACING);
      }

      for (let i = 0; i < pipes.length; i++) {
        const p = pipes[i];
        if (!p.passed && p.x + PIPE_W < alex.x) {
          p.passed = true;
          score++;
          if (score > best) { best = score; try { localStorage.setItem('alexPoopBest', String(best)); } catch(e){} }
          sndScore();
        }
      }

      const top = alex.y - alex.h/2, bottom = alex.y + alex.h/2;
      const left = alex.x - alex.w/2, right = alex.x + alex.w/2;

      if (bottom > H - GROUND_H || top < 0) {
        triggerCaught();
      }
      for (let i = 0; i < pipes.length; i++) {
        const p = pipes[i];
        if (right > p.x && left < p.x + PIPE_W) {
          if (top < p.gapY || bottom > p.gapY + GAP) {
            triggerCaught();
            break;
          }
        }
      }

      poop.x = alex.x - 90;
      const targetY = alex.y + Math.sin(frame * 0.09) * 7;
      poop.y += (targetY - poop.y) * Math.min(dt * 3.2, 1);
      frame++;
    } else if (state === 'caught') {
      poop.catchT += dt;
      const t = Math.min(poop.catchT / 0.35, 1);
      poop.x = lerp(alex.x - 90, alex.x - 4, easeIn(t));
      poop.scale = lerp(1, 1.6, t);
      alex.rot = lerp(alex.rot, 1.4, t);
      alex.y += 60 * dt;
      if (t >= 1 && poop.catchT > 0.4) {
        state = 'gameover';
      }
    }
  }

  // ---------- drawing ----------
  function drawSky() {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#7ec8e3');
    g.addColorStop(1, '#bfe8f5');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  function drawCloud(x, y, s) {
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.fillRect(x, y, 40*s, 14*s);
    ctx.fillRect(x+10*s, y-8*s, 26*s, 14*s);
    ctx.fillRect(x-8*s, y+4*s, 16*s, 10*s);
  }

  function drawClouds() {
    for (let i = 0; i < clouds.length; i++) {
      const c = clouds[i];
      let x = ((c.x + cloudOffset) % (W + 80)) ;
      if (x < -80) x += (W + 80);
      drawCloud(x, c.y, c.s);
    }
  }

  function drawPipeTexture(x, yTop, height, seed) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, yTop, PIPE_W, height);
    ctx.clip();
    for (let row = 0; row * 16 < height + 16; row++) {
      for (let col = 0; col * 16 < PIPE_W + 16; col++) {
        const h = hash(seed + row * 37 + col * 17);
        ctx.fillStyle = h > 0.55 ? 'rgba(0,0,0,0.08)' : (h < 0.15 ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0)');
        ctx.fillRect(x + col*16, yTop + row*16, 16, 16);
      }
    }
    ctx.restore();
  }

  function drawPipes() {
    for (let i = 0; i < pipes.length; i++) {
      const p = pipes[i];
      const topH = p.gapY;
      const botY = p.gapY + GAP;
      const botH = (H - GROUND_H) - botY;

      // top column
      ctx.fillStyle = '#8b5a2b';
      ctx.fillRect(p.x, 0, PIPE_W, topH);
      drawPipeTexture(p.x, 0, topH, p.seed);
      ctx.fillStyle = '#5fae3d';
      ctx.fillRect(p.x - 4, topH - 12, PIPE_W + 8, 12);
      ctx.fillStyle = '#4d9231';
      ctx.fillRect(p.x - 4, topH - 3, PIPE_W + 8, 3);

      // bottom column
      ctx.fillStyle = '#8b5a2b';
      ctx.fillRect(p.x, botY, PIPE_W, botH);
      drawPipeTexture(p.x, botY, botH, p.seed + 500);
      ctx.fillStyle = '#5fae3d';
      ctx.fillRect(p.x - 4, botY, PIPE_W + 8, 12);
      ctx.fillStyle = '#4d9231';
      ctx.fillRect(p.x - 4, botY, PIPE_W + 8, 3);
    }
  }

  function drawGround() {
    const gy = H - GROUND_H;
    ctx.fillStyle = '#8b5a2b';
    ctx.fillRect(0, gy, W, GROUND_H);
    ctx.fillStyle = '#5fae3d';
    ctx.fillRect(0, gy, W, 16);
    const block = 32;
    let off = ((groundOffset % block) + block) % block;
    ctx.strokeStyle = 'rgba(0,0,0,0.12)';
    ctx.lineWidth = 1;
    for (let x = -block; x < W + block; x += block) {
      ctx.beginPath();
      ctx.moveTo(x + off, gy + 16);
      ctx.lineTo(x + off, H);
      ctx.stroke();
    }
    for (let y = gy + 16 + 20; y < H; y += 20) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }
    ctx.fillStyle = '#4d9231';
    for (let x = -block; x < W + block; x += 8) {
      const xx = x + off;
      if (Math.floor((xx + 1000)/8) % 3 === 0) {
        ctx.fillRect(xx, gy + 12, 4, 6);
      }
    }
  }

  function drawAlex(x, y, rot) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot * 0.3);
    // legs
    ctx.fillStyle = '#3e6fae';
    ctx.fillRect(-10, 9, 8, 13);
    ctx.fillRect(2, 9, 8, 13);
    ctx.fillStyle = '#355f97';
    ctx.fillRect(-10, 19, 8, 3);
    ctx.fillRect(2, 19, 8, 3);
    // torso shirt
    ctx.fillStyle = '#57b45a';
    ctx.fillRect(-11, -9, 22, 18);
    ctx.fillStyle = '#3f8f45';
    ctx.fillRect(-11, 5, 22, 4);
    // arms
    ctx.fillStyle = '#e2a679';
    ctx.fillRect(-16, -7, 5, 15);
    ctx.fillRect(11, -7, 5, 15);
    ctx.fillStyle = '#3f8f45';
    ctx.fillRect(-16, -7, 5, 5);
    ctx.fillRect(11, -7, 5, 5);
    // head
    ctx.fillStyle = '#e2a679';
    ctx.fillRect(-11, -27, 22, 19);
    // hair
    ctx.fillStyle = '#a9531f';
    ctx.fillRect(-12, -28, 24, 6);
    ctx.fillRect(-12, -22, 4, 14);
    ctx.fillRect(8, -24, 5, 18);
    // eyes
    ctx.fillStyle = '#2b2b2b';
    ctx.fillRect(-6, -18, 3, 4);
    ctx.fillRect(2, -18, 3, 4);
    // mouth
    ctx.fillStyle = '#7a4a33';
    ctx.fillRect(-3, -11, 6, 2);
    ctx.restore();
  }

  function drawPoop(x, y, scale) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.fillStyle = '#6b4423';
    ctx.beginPath(); ctx.ellipse(0, 15, 21, 14, 0, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#7d5230';
    ctx.beginPath(); ctx.ellipse(0, 1, 16, 12, 0, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#8f603a';
    ctx.beginPath(); ctx.ellipse(0, -12, 11, 9, 0, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#a0724a';
    ctx.beginPath(); ctx.ellipse(-2, -20, 5, 4, 0, 0, Math.PI*2); ctx.fill();
    // eyes
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(-6, -12, 3.4, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(6, -12, 3.4, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#222';
    ctx.beginPath(); ctx.arc(-5.3, -11.5, 1.8, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(6.7, -11.5, 1.8, 0, Math.PI*2); ctx.fill();
    // angry eyebrows
    ctx.strokeStyle = '#222'; ctx.lineWidth = 2; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-10, -17); ctx.lineTo(-2, -15); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(10, -17); ctx.lineTo(2, -15); ctx.stroke();
    // grin
    ctx.beginPath(); ctx.arc(0, -6, 5, 0.15*Math.PI, 0.85*Math.PI); ctx.stroke();
    ctx.restore();
  }

  function drawTextCentered(text, y, size, color, weight) {
    ctx.font = (weight || 'bold') + ' ' + size + 'px "Segoe UI", sans-serif';
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.textAlign = 'center';
    ctx.fillText(text, W/2 + 2, y + 2);
    ctx.fillStyle = color || '#fff';
    ctx.fillText(text, W/2, y);
  }

  function render() {
    ctx.save();
    if (shake > 0) {
      ctx.translate((Math.random()-0.5) * shake, (Math.random()-0.5) * shake);
    }

    drawSky();
    drawClouds();
    drawPipes();
    drawGround();

    if (poop.x + 40 > -50) drawPoop(poop.x, poop.y, poop.scale);
    drawAlex(alex.x, alex.y, alex.rot);

    ctx.restore();

    if (state === 'playing') {
      drawTextCentered(String(score), 70, 48, '#fff');
    }

    if (state === 'ready') {
      drawTextCentered('Алекс убегает', 190, 30, '#fff');
      drawTextCentered('от какашки!', 224, 30, '#fff');
      drawTextCentered('Нажми / Пробел / Тап', 300, 18, '#fff', '600');
      drawTextCentered('чтобы взлететь', 322, 18, '#fff', '600');
      drawTextCentered('Не жми — упадёшь и она тебя схватит', 480, 14, '#ffe08a', '600');
      if (best > 0) drawTextCentered('Рекорд: ' + best, 40, 16, '#fff2b0');
    }

    if (state === 'gameover') {
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillRect(0, 0, W, H);
      drawTextCentered('ПОЙМАЛА!', 240, 40, '#ff6b6b');
      drawTextCentered('Счёт: ' + score, 300, 24, '#fff');
      drawTextCentered('Рекорд: ' + best, 332, 20, '#fff2b0');
      drawTextCentered('Нажми, чтобы попробовать снова', 400, 16, '#fff', '600');
    }
  }

  function frameLoop(ts) {
    requestAnimationFrame(frameLoop);
    if (!last) last = ts;
    const dt = Math.min((ts - last) / 1000, 0.033);
    last = ts;
    update(dt);
    render();
  }

  resetGame();
  requestAnimationFrame(frameLoop);
})();
