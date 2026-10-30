(function () {
  var root = document.documentElement;
  var intro = document.getElementById('intro');
  var nb = window.__NB;
  if (!intro || !nb) return;

  var said = document.getElementById('nb-said');
  var who = document.getElementById('nb-who');
  var live = document.getElementById('nb-live');
  var ask = document.getElementById('nb-ask');
  var skip = document.getElementById('nb-skip');
  var canvas = document.getElementById('nb-rain');
  var sketch = document.getElementById('nb-sketch');
  var paths = sketch ? sketch.querySelectorAll('.ln') : [];
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var KEY = 'sullivan-notebook-seen';
  var timer = 0;
  var typing = 0;
  var running = false;
  var raf = 0;
  var rainOn = false;
  var cols = [];
  var last = 0;
  var ctx = canvas ? canvas.getContext('2d') : null;

  function seen() {
    try { localStorage.setItem(KEY, '1'); } catch (e) {}
  }

  function setSaid(text) {
    said.textContent = text;
    if (live) live.textContent = text;
  }

  function prepare() {
    paths.forEach(function (p) {
      var len = p.getTotalLength();
      p.style.strokeDasharray = String(len);
      p.style.strokeDashoffset = String(len);
      p.style.transition = 'none';
    });
    if (sketch) sketch.classList.add('is-ready');
  }

  function draw() {
    var mobile = window.innerWidth < 760;
    var step = mobile ? 16 : 24;
    var dur = mobile ? 520 : 720;
    paths.forEach(function (p, i) {
      p.style.transition = 'stroke-dashoffset ' + dur + 'ms ease ' + (i * step) + 'ms';
      p.style.strokeDashoffset = '0';
    });
  }

  function hideCards() {
    document.querySelectorAll('.index-card').forEach(function (el) { el.hidden = true; });
  }

  function showCard(id) {
    hideCards();
    var el = document.getElementById('card-' + id);
    if (!el) return;
    el.hidden = false;
    if (id === 'count') {
      var num = el.querySelector('[data-count]');
      if (!num) return;
      var target = Number(num.getAttribute('data-count'));
      if (reduce) {
        num.textContent = target.toLocaleString('en-US');
        return;
      }
      var t0 = performance.now();
      function tick(now) {
        var p = Math.min(1, (now - t0) / 900);
        var eased = 1 - Math.pow(1 - p, 3);
        num.textContent = Math.round(target * eased).toLocaleString('en-US');
        if (p < 1 && running) requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
    }
  }

  function typeLine(text, done) {
    who.textContent = nb.writing;
    if (reduce) {
      setSaid(text);
      done();
      return;
    }
    var i = 0;
    setSaid('');
    clearInterval(typing);
    var ms = window.innerWidth < 760 ? 32 : 36;
    typing = setInterval(function () {
      i += 1;
      setSaid(text.slice(0, i));
      if (i >= text.length) {
        clearInterval(typing);
        done();
      }
    }, ms);
  }

  function run(i) {
    if (!running) return;
    if (i >= nb.script.length) return;
    var step = nb.script[i];
    var scale = window.innerWidth < 760 ? 0.9 : 1;
    if (step.op === 'pause') {
      timer = setTimeout(function () { run(i + 1); }, Math.round(step.ms * scale));
    } else if (step.op === 'say') {
      typeLine(nb.lines[step.line], function () { run(i + 1); });
    } else if (step.op === 'erase') {
      timer = setTimeout(function () { setSaid(''); run(i + 1); }, reduce ? 0 : 160);
    } else if (step.op === 'card') {
      showCard(step.id);
      run(i + 1);
    } else if (step.op === 'ask') {
      ask.hidden = false;
      var first = ask.querySelector('a');
      if (first) first.focus();
    }
  }

  function resizeRain() {
    if (!canvas || !ctx) return;
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.floor(window.innerWidth * dpr);
    canvas.height = Math.floor(window.innerHeight * dpr);
    canvas.style.width = window.innerWidth + 'px';
    canvas.style.height = window.innerHeight + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    var mobile = window.innerWidth < 760;
    var n = mobile ? Math.min(6, Math.floor(window.innerWidth / 70)) : Math.min(12, Math.floor(window.innerWidth / 120));
    cols = [];
    for (var i = 0; i < n; i++) {
      cols.push({
        x: ((i + 0.5) * window.innerWidth) / n,
        y: Math.random() * window.innerHeight,
        s: 0.35 + Math.random() * 0.5,
        w: nb.keywords[i % nb.keywords.length],
      });
    }
  }

  function rainFrame(now) {
    if (!rainOn) return;
    raf = requestAnimationFrame(rainFrame);
    if (document.hidden) return;
    if (now - last < 33) return;
    last = now;
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    var dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    ctx.fillStyle = dark ? 'rgba(243,239,230,0.16)' : 'rgba(20,20,20,0.11)';
    ctx.font = '600 14px Archivo, "Noto Sans SC", sans-serif';
    cols.forEach(function (c) {
      if (c.y > 72) ctx.fillText(c.w, c.x, c.y);
      c.y += c.s * 1.15;
      if (c.y > window.innerHeight + 24) {
        c.y = -28;
        c.w = nb.keywords[(Math.random() * nb.keywords.length) | 0];
      }
    });
  }

  function startRain() {
    if (reduce || !canvas) return;
    resizeRain();
    if (rainOn) return;
    rainOn = true;
    raf = requestAnimationFrame(rainFrame);
  }

  function stopRain() {
    rainOn = false;
    if (raf) cancelAnimationFrame(raf);
    if (ctx) ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
  }

  function closeIntro(hash) {
    running = false;
    clearTimeout(timer);
    clearInterval(typing);
    stopRain();
    seen();
    root.classList.remove('play-intro');
    if (hash) {
      var el = document.querySelector(hash);
      if (el) {
        el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
        var head = el.querySelector('h2');
        if (head) head.setAttribute('tabindex', '-1');
        if (head) head.focus({ preventScroll: true });
      }
    }
  }

  function start() {
    running = true;
    clearTimeout(timer);
    clearInterval(typing);
    ask.hidden = true;
    hideCards();
    setSaid('');
    who.textContent = nb.writing;
    requestAnimationFrame(function () {
      prepare();
      requestAnimationFrame(draw);
    });
    var lead = reduce ? 0 : (window.innerWidth < 760 ? 450 : 600);
    timer = setTimeout(function () { run(0); }, lead);
  }

  skip.addEventListener('click', function () { closeIntro(); });
  document.addEventListener('keydown', function (e) {
    if (!root.classList.contains('play-intro')) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      closeIntro();
      return;
    }
    if (ask.hidden) return;
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft' && e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    var items = Array.prototype.slice.call(ask.querySelectorAll('a.choice'));
    if (!items.length) return;
    var idx = items.indexOf(document.activeElement);
    if (idx < 0) idx = 0;
    var dir = (e.key === 'ArrowLeft' || e.key === 'ArrowUp') ? -1 : 1;
    items[(idx + dir + items.length) % items.length].focus();
    e.preventDefault();
  });
  ask.addEventListener('click', function (e) {
    var a = e.target.closest('a[data-go]');
    if (!a) return;
    var go = a.getAttribute('data-go') || '';
    if (go.charAt(0) === '#') {
      e.preventDefault();
      closeIntro(go);
    }
  });
  var replayEnd = document.getElementById('nb-replay-end');
  if (replayEnd) replayEnd.addEventListener('click', function () { start(); });
  var replay = document.getElementById('replay-intro');
  if (replay) {
    replay.addEventListener('click', function () {
      root.classList.add('play-intro');
      start();
    });
  }
  window.addEventListener('resize', function () { if (rainOn) resizeRain(); });

  if (root.classList.contains('play-intro')) start();
})();
