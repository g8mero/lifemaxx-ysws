<script lang="ts">
  import { onMount } from 'svelte';

  let { data } = $props();


  const SLACK = 'https://hackclub.slack.com/app_redirect?channel=lifemaxx';
  const RSVP = 'https://rsvp.soon.it/lifemaxx';
  const C = '/images/cutouts';

  // Live details. Server-rendered with fixed fallbacks so hydration matches,
  // then swapped for the visitor's own clock on mount.
  let nag = $state('(still late)');

  function nagFor(d: Date) {
    const h = d.getHours();
    const t = `${h % 12 || 12}:${String(d.getMinutes()).padStart(2, '0')}${h < 12 ? 'am' : 'pm'}`;
    if (h < 5) return `it's ${t}. go to sleep.`;
    if (h < 9) return `it's ${t}. you're up??`;
    if (h < 15) return `it's ${t}. aren't you in class`;
    if (h < 22) return `it's ${t}. homework can wait`;
    return `it's ${t}. one more commit`;
  }

  onMount(() => {
    nag = nagFor(new Date());
    const tick = setInterval(() => (nag = nagFor(new Date())), 30_000);
    return () => clearInterval(tick);
  });

  // Drag the cutouts around. ponytail: mouse only, so touch scrolling stays
  // untouched; add touch drag if phones ask for it.
  let z = 10;
  let moved = $state<HTMLElement[]>([]);

  // The headline's text selection: drag either handle to move it, one letter at a time.
  const TITLE = '#lifemaxx';
  let selA = $state(5);
  let selB = $state(TITLE.length);
  let h1: HTMLElement;

  function grab(e: PointerEvent, end: 'a' | 'b') {
    e.preventDefault();
    const handle = e.currentTarget as HTMLElement;
    handle.setPointerCapture(e.pointerId);
    // x of every gap between letters; the text never reflows, so measure once
    const xs: number[] = [];
    const range = document.createRange();
    const walker = document.createTreeWalker(h1, NodeFilter.SHOW_TEXT);
    let right = 0;
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      for (let i = 0; i < (n.textContent ?? '').length; i++) {
        range.setStart(n, i);
        range.setEnd(n, i + 1);
        const r = range.getBoundingClientRect();
        xs.push(r.left);
        right = r.right;
      }
    }
    xs.push(right);
    const move = (ev: PointerEvent) => {
      let best = 0;
      for (let i = 1; i < xs.length; i++) if (Math.abs(xs[i] - ev.clientX) < Math.abs(xs[best] - ev.clientX)) best = i;
      if (end === 'a') selA = Math.min(best, selB - 1);
      else selB = Math.max(best, selA + 1);
    };
    const up = () => {
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', up);
      handle.removeEventListener('pointercancel', up);
    };
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', up);
    handle.addEventListener('pointercancel', up);
  }

  function drag(el: HTMLElement) {
    let sx = 0, sy = 0, x = 0, y = 0;
    const down = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse' || e.button) return;
      e.preventDefault();
      el.setPointerCapture(e.pointerId);
      if (!el.style.translate) x = y = 0;
      sx = e.clientX - x;
      sy = e.clientY - y;
      el.style.zIndex = String(++z);
      el.classList.add('held');
    };
    const move = (e: PointerEvent) => {
      if (!el.hasPointerCapture(e.pointerId)) return;
      x = e.clientX - sx;
      y = e.clientY - sy;
      el.style.translate = `${x}px ${y}px`;
      if (!moved.includes(el)) moved = [...moved, el];
    };
    const up = () => el.classList.remove('held');
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    return {
      destroy() {
        el.removeEventListener('pointerdown', down);
        el.removeEventListener('pointermove', move);
        el.removeEventListener('pointerup', up);
        el.removeEventListener('pointercancel', up);
      }
    };
  }

  function tidy() {
    for (const el of moved) {
      el.style.translate = '';
      el.style.zIndex = '';
    }
    moved = [];
  }

  const faqs = [
    ['What counts?', 'A productivity tool or app that tracks, gamifies or streamlines your daily habits and goals. Habit trackers, study timers, a desk gadget that yells at you. Software or hardware.'],
    ['What do I get?', 'Coffee, good school supplies, tech gear and workout essentials. The exact prize list is still tbd.'],
    ['When does it run?', "Dates are tbd. RSVP and join #lifemaxx on the Hack Club Slack and you'll hear first."],
    ['Who can join?', 'Teenagers aged 13–18, anywhere. No experience needed.'],
    ['Does it cost anything?', 'No. Hack Club is a nonprofit and the prizes are on us.'],
    ['Is this an excuse to not do my homework?', 'Yes.']
  ];
</script>

<svelte:head>
  <title>lifemaxx · a Hack Club YSWS</title>
  <meta name="description" content="You ship a productivity tool that fixes your life. We ship coffee, school supplies, tech and workout stuff." />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
  <link href="https://fonts.googleapis.com/css2?family=Inter:ital,wght@0,400;0,500;0,600;0,700;0,900;1,500&family=Permanent+Marker&family=Reenie+Beanie&display=swap" rel="stylesheet" />
</svelte:head>

<!-- A handwritten note with a looped arrow. The arrow is drawn pointing right;
     `arrow` positions and rotates it so it aims at whatever the note is about. -->
{#snippet note(text: string, style: string, arrow: string)}
  <span class="hand" {style}>
    {@html text}
    <svg class="arr" viewBox="0 0 64 30" style={arrow} aria-hidden="true">
      <path d="M2 21c9-13 21-15 25-7 3 7-7 11-9 4-2-8 15-14 39-8" />
      <path d="M49 3l10 7-10 7" />
    </svg>
  </span>
{/snippet}

<div class="lm">
  <svg class="filters" aria-hidden="true">
    <filter id="tear-a" x="-10%" y="-10%" width="120%" height="120%"><feTurbulence type="fractalNoise" baseFrequency=".012 .03" numOctaves="3" seed="4" /><feDisplacementMap in="SourceGraphic" scale="46" /><feGaussianBlur stdDeviation="0.9" /><feComponentTransfer><feFuncA type="linear" slope="4" intercept="-1.5" /></feComponentTransfer></filter>
    <filter id="tear-b" x="-10%" y="-10%" width="120%" height="120%"><feTurbulence type="fractalNoise" baseFrequency=".02 .05" numOctaves="3" seed="11" /><feDisplacementMap in="SourceGraphic" scale="40" /><feGaussianBlur stdDeviation="0.9" /><feComponentTransfer><feFuncA type="linear" slope="4" intercept="-1.5" /></feComponentTransfer></filter>
    <filter id="rough"><feTurbulence type="fractalNoise" baseFrequency=".04" numOctaves="2" seed="7" /><feDisplacementMap in="SourceGraphic" scale="5" /><feGaussianBlur stdDeviation="0.9" /><feComponentTransfer><feFuncA type="linear" slope="4" intercept="-1.5" /></feComponentTransfer></filter>
  </svg>

  <header class="hero" id="top">
    <div class="torn"><i class="fibre"></i><i class="ink"></i></div>
    <a class="flag" href="https://hackclub.com/"><img src="https://assets.hackclub.com/flag-orpheus-top.svg" alt="Hack Club" /></a>
    <nav class="tabs" aria-label="Sections">
      <a href="#you-ship">you ship</a>
      <a href="#we-ship">we ship</a>
      <a href="#plan">the plan</a>
      <a href="#faq">faq</a>
      {#if !data.landingOnly}<a class="login" href="/api/auth/login">log in</a>{/if}
    </nav>

    <img class="build" src="{C}/build.webp" alt="Build" width="1031" height="457" />
    <p class="sub">software <span>&amp;&amp; hardware</span></p>
    <svg class="dash" viewBox="0 0 300 70" preserveAspectRatio="none" aria-hidden="true"><path d="M0 62C50 20 95 18 150 36s110 20 148-30" /></svg>

    <figure class="cut on-indigo m-hide" use:drag style="--w:clamp(92px,10vw,150px);--r:-8deg;left:25%;top:1.5%">
      <img src="{C}/volleyball.webp" alt="" draggable="false" />
      <figcaption>practice_at_6.png</figcaption>
      {@render note('keeping me sane', 'right:100%;top:80%;--r:-6deg;color:#fff;white-space:nowrap', 'left:86%;top:-0.95em;rotate:-36deg')}
    </figure>
    <figure class="cut on-indigo m-hide" use:drag style="--w:clamp(150px,16vw,240px);--r:-27deg;--cap:58px;left:3.5%;bottom:9%">
      <img src="{C}/hl-yellow.webp" alt="" draggable="false" />
      <figcaption>study_guide_FINAL.png</figcaption>
    </figure>
    <figure class="cut m-whey" use:drag style="--w:clamp(110px,12.5vw,190px);--mw:104px;--r:5deg;--cap:16px;left:35.5%;top:4%">
      <img src="{C}/whey.webp" alt="" draggable="false" />
      <figcaption class="picked">gains.png</figcaption>
    </figure>
    <figure class="cut folder on-indigo" use:drag style="--mw:92px" title="homework (unopened)">
      <svg viewBox="0 0 200 160" aria-hidden="true">
        <defs><linearGradient id="fg" x2="0" y2="1"><stop stop-color="#7fd4ff" /><stop offset="1" stop-color="#3fb1f3" /></linearGradient></defs>
        <path fill="#2f9be3" d="M8 22c0-8 6-14 14-14h46c6 0 11 2 15 6l9 8h86c8 0 14 6 14 14v102c0 8-6 14-14 14H22c-8 0-14-6-14-14z" />
        <g class="sheet">
          <rect x="24" y="30" width="152" height="100" rx="5" fill="#fff" />
          <text x="100" y="60" text-anchor="middle">lock in</text>
          <text x="100" y="78" text-anchor="middle" text-decoration="underline">fam</text>
        </g>
        <rect class="front" x="8" y="42" width="184" height="110" rx="13" fill="url(#fg)" />
      </svg>
      <span class="badge">4,812</span>
      <figcaption>homework</figcaption>
    </figure>
    <figure class="cut on-indigo m-matcha" use:drag style="--w:clamp(88px,9.6vw,146px);--mw:80px;--r:6deg;--cap:14px;left:34.6%;bottom:0.5%">
      <img src="{C}/matcha.webp" alt="" draggable="false" />
      <figcaption>self_care.png</figcaption>
      {@render note('$7. worth it.', 'left:150%;top:70%;--r:4deg;white-space:nowrap;color:var(--ink)', 'left:-0.2em;top:-0.25em;rotate:190deg')}
    </figure>
    <figure class="cut m-hide" use:drag style="--w:clamp(88px,9vw,138px);--r:9deg;--cap:16px;right:38%;top:2.5%">
      <img src="{C}/airpods.webp" alt="" draggable="false" />
      <figcaption>do_not_disturb.png</figcaption>
    </figure>
    <figure class="cut m-hide" use:drag style="--w:clamp(120px,13.5vw,205px);--r:-10deg;--cap:22px;right:3%;bottom:6%">
      <img src="{C}/dumbbell.webp" alt="" draggable="false" />
      <figcaption>used_twice.png</figcaption>
    </figure>

    <div class="pitch">
      <h1 bind:this={h1}>{TITLE.slice(0, selA)}<span class="sel"><b onpointerdown={(e) => grab(e, 'a')}></b>{TITLE.slice(selA, selB)}<b onpointerdown={(e) => grab(e, 'b')}></b></span>{TITLE.slice(selB)}</h1>
      <p>ys: something that helps you complete your goals</p>
      <p>ws: resources to help you get them done</p>
      <p class="cats">coffee - school supplies - tech - workout stuff</p>
      <span class="ctas"><a class="cta" href={SLACK}>join #lifemaxx <span aria-hidden="true">→</span></a><a class="cta" href={RSVP}>RSVP <span aria-hidden="true">→</span></a></span>
    </div>
  </header>

  <main>
    <section id="you-ship">
      <h2>you ship:</h2>
      <div class="desk">
        <div class="book">
          <div class="page l">
            <p><strong>things that count</strong></p>
            <ul>
              <li><label><input type="checkbox" /><span>habit tracker</span></label></li>
              <li><label><input type="checkbox" /><span>study timer that judges you</span></label></li>
              <li><label><input type="checkbox" /><span>gym log w/ streaks</span></label></li>
              <li><label><input type="checkbox" /><span>homework but it's a game</span></label></li>
              <li class="done"><s>chem homework</s></li>
            </ul>
          </div>
          <div class="page r">
            <p><strong>the rule</strong></p>
            <p>build a tool that <mark>tracks, gamifies or streamlines</mark> your habits + goals.</p>
            <p class="gap">app, site, bot or a desk gadget. it just has to help.</p>
          </div>
          <div class="sticky"><img src="{C}/orpheus.webp" alt="Orpheus, the Hack Club dinosaur, waving" draggable="false" loading="lazy" /></div>
        </div>

        <figure class="cut c-hl" use:drag style="--r:-34deg">
          <img src="{C}/hl-pink.webp" alt="" draggable="false" loading="lazy" />
        </figure>
        <figure class="cut c-pen" use:drag style="--r:63deg">
          <img src="{C}/pen.webp" alt="" draggable="false" loading="lazy" />
        </figure>
        <div class="cut alarms" use:drag style="--r:5deg" aria-hidden="true">
          <div><span>06:10<small>Alarm</small></span><i></i></div>
          <div><span>06:15<small>Alarm</small></span><i></i></div>
          <div><span>06:20<small>ok for real</small></span><i></i></div>
          <div><span>06:25<small>GET UP</small></span><i></i></div>
          {@render note(nag, 'left:4%;top:118%;--r:-3deg;white-space:nowrap;color:var(--red)', 'left:44%;top:-0.75em;rotate:-80deg')}
        </div>
      </div>
    </section>

    <section id="we-ship">
      <h2>we ship:</h2>
      <div class="lay">
        <figure class="cut" style="--w:132px;--r:-3deg">
          <img src="{C}/coffee.webp" alt="Iced coffee" draggable="false" loading="lazy" />
          <figcaption>coffee.png</figcaption>
        </figure>
        <figure class="cut pair" style="--w:190px;--r:0deg">
          <img src="{C}/hl-orange.webp" alt="Orange highlighter" draggable="false" loading="lazy" />
          <img src="{C}/hl-blue.webp" alt="Blue highlighter" draggable="false" loading="lazy" />
          <figcaption>school_supplies(1).png</figcaption>
        </figure>
        <figure class="cut" style="--w:210px;--r:4deg">
          <img src="{C}/macbook.webp" alt="Laptop" draggable="false" loading="lazy" />
          <figcaption>tech.png</figcaption>
        </figure>
        <figure class="cut" style="--w:230px;--r:-6deg">
          <img src="{C}/shoe.webp" alt="Running shoe" draggable="false" loading="lazy" />
          <figcaption>workout_stuff.png</figcaption>
        </figure>
        <figure class="cut" style="--w:62px;--r:5deg">
          <img src="{C}/bottle.webp" alt="Water bottle" draggable="false" loading="lazy" />
          <figcaption>hydration.png</figcaption>
        </figure>
        <figure class="cut" style="--w:142px;--r:-4deg">
          <img src="{C}/creatine.webp" alt="Creatine tub" draggable="false" loading="lazy" />
          <figcaption>brain_food.png</figcaption>
        </figure>
        <figure class="cut mystery" style="--w:120px;--r:3deg">
          <span class="q" aria-hidden="true">?</span>
          <figcaption>more_soon.png</figcaption>
          {@render note('suggest stuff<br>in #lifemaxx', 'left:84%;top:30%;--r:-5deg;white-space:nowrap', 'left:-0.2em;top:1.5em;rotate:158deg')}
        </figure>
      </div>
    </section>

    <section id="plan">
      <h2>the plan</h2>
      <div class="day">
        <div class="slot"><time>9:00am</time><div class="event" style="--c:#3a4bd6"><b>Build the thing</b><span>Something that fixes one real problem in your own life.</span></div></div>
        <div class="slot"><time>1:00pm</time><div class="event" style="--c:#35b25a"><b>Ship the thing</b><span>Put it somewhere people can use it.</span></div></div>
        <div class="slot"><time>4:00pm</time><div class="event" style="--c:#f0a92b"><b>Get the stuff</b><span>We mail you fuel so you can keep going.</span></div>
          <div class="label" aria-hidden="true">
            <i class="tape"></i>
            <small>ship to</small><b>you. yes, you.</b>
            <small>from</small><b>hack club hq</b>
            <span class="bars"></span>
            {@render note('straight to you', 'left:10%;top:158%;--r:-4deg;white-space:nowrap', 'left:42%;top:-0.95em;rotate:-82deg')}
          </div>
        </div>
        <div class="slot"><time>11:59pm</time><div class="event" style="--c:#d6161e"><b>Start the homework</b><span>Not part of the program. Just a reminder.</span></div>
        </div>
      </div>
    </section>

    <section id="faq" class="faq">
      <h2>faq</h2>
      {#each faqs as [q, a]}
        <details><summary>{q}</summary><p>{a}</p></details>
      {/each}
    </section>
  </main>

  <footer>
    <div class="torn"><i class="fibre"></i><i class="ink"></i></div>
    <p class="big">go fix your life.</p>
    <span class="ctas"><a class="cta" href={SLACK}>join #lifemaxx <span aria-hidden="true">→</span></a><a class="cta" href={RSVP}>RSVP <span aria-hidden="true">→</span></a></span>
    <small>Made by teenagers avoiding homework, for <a href="https://hackclub.com/">Hack Club</a>, a 501(c)(3) nonprofit. · <a href="https://hackclub.com/slack">Join the Slack</a></small>
  </footer>

  {#if moved.length}
    <button class="tidy" onclick={tidy}>tidy your desk ↺</button>
  {/if}
</div>

<style>
  .lm {
    --indigo: #2f2284;
    --red: #d6161e;
    --paper: #f4f2ed;
    --ink: #0b0b0c;
    --blue: #1557ff;
    --hi: #d8ff3e;
    --hand: 'Reenie Beanie', cursive;
    --marker: 'Permanent Marker', cursive;
    --cur: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='22' height='31' viewBox='0 0 24 34'%3E%3Cpath d='M2 2v25l6.5-6 4.5 11 4-1.700-4.500-10.800H21z' fill='%23000' stroke='%23fff' stroke-width='1.8' stroke-linejoin='round'/%3E%3C/svg%3E") 2 2, auto;
    --grain: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='3'/%3E%3CfeColorMatrix values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 .09 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
    position: relative;
    min-height: 100vh;
    overflow-x: clip;
    font-family: Inter, system-ui, sans-serif;
    line-height: 1.45;
    color: var(--ink);
    background: var(--paper) var(--grain);
  }
  /* The headline's desktop cursor, site-wide. Beats the layout's html.custom-cursor rule. */
  .lm, .lm :global(*), .lm :global(*:active) { cursor: var(--cur); }
  .lm :global(::selection) { background: rgb(60 130 255 / 0.3); }
  .lm :is(a, button, input, summary):focus-visible { outline: 2px solid var(--blue); outline-offset: 3px; }
  .lm :is(h1, h2, p, ul, figure) { margin: 0; }
  .filters { position: absolute; width: 0; height: 0; }
  .sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }

  /* ---------- shared collage pieces ---------- */
  .lm .cut { cursor: grab; }
  .lm .cut:global(.held) { cursor: grabbing; }
  .cut { position: absolute; width: var(--w); z-index: 2; user-select: none; touch-action: pan-y; transition: scale 0.18s; }
  .cut > img { width: 100%; rotate: var(--r, 0deg); pointer-events: none; filter: drop-shadow(0 6px 8px rgb(0 0 0 / 0.24)); transition: filter 0.18s, rotate 0.18s; }
  .cut:hover { scale: 1.04; }
  .cut:hover > img { rotate: calc(var(--r, 0deg) + 2deg); }
  .cut:global(.held) { scale: 1.07; transition: none; }
  .cut:global(.held) > img { filter: drop-shadow(0 18px 18px rgb(0 0 0 / 0.3)); }
  .cut figcaption { width: max-content; margin: var(--cap, 10px) 0 0 50%; translate: -50% 0; padding: 1px 6px; border-radius: 4px; font-size: 12px; line-height: 1.4; }
  .on-indigo figcaption { color: #fff; }
  .cut figcaption.picked { background: var(--blue); color: #fff; }

  .hand { position: absolute; z-index: 3; rotate: var(--r, -4deg); font-family: var(--hand); font-size: clamp(22px, 2vw, 29px); line-height: 0.9; pointer-events: none; }
  .arr { position: absolute; width: 2.2em; height: auto; max-width: none; overflow: visible; fill: none; stroke: currentColor; stroke-width: 1.5; stroke-linecap: round; stroke-linejoin: round; transform-origin: 0 50%; }

  .lm mark { color: inherit; background: linear-gradient(transparent 12%, var(--hi) 12% 88%, transparent 88%); padding: 0 3px; }
  .tape { position: absolute; z-index: 4; left: 50%; top: -13px; width: 96px; height: 27px; translate: -50% 0; rotate: -2deg; background: rgb(233 222 180 / 0.72); box-shadow: 0 1px 2px rgb(0 0 0 / 0.12); filter: url(#rough); }
  .badge { position: absolute; top: 8%; right: -8%; padding: 3px 9px; border: 2px solid #fff; border-radius: 99px; background: #ff3b30; color: #fff; font-size: 13px; font-weight: 700; line-height: 1.2; }

  h2 { font-size: clamp(30px, 4.2vw, 54px); font-weight: 700; letter-spacing: -0.035em; line-height: 1; text-align: center; text-wrap: balance; }
  section { position: relative; max-width: 1120px; margin: 0 auto; padding: clamp(80px, 10vw, 136px) 24px 0; }

  /* ---------- hero ---------- */
  .hero { position: relative; z-index: 1; min-height: max(660px, min(100svh, 860px)); }
  /* The indigo is a torn sheet: flush to the top and left, ripped on the right and bottom. */
  .torn { position: absolute; inset: 0 0 -70px 0; overflow: hidden; pointer-events: none; }
  .torn i { position: absolute; left: -80px; top: -80px; bottom: 44px; }
  .torn .fibre { bottom: 32px; }
  .torn .fibre { width: calc(43% + 96px); background: #fff; filter: url(#tear-b); }
  .torn .ink { width: calc(43% + 80px); background: var(--indigo) var(--grain); filter: url(#tear-a); }
  .flag { position: absolute; top: 0; left: 16px; z-index: 5; width: clamp(140px, 17vw, 250px); transform-origin: 0 0; transition: rotate 0.2s; }
  .flag:hover { rotate: -4deg; }
  .tabs { position: absolute; top: 0; right: 5%; z-index: 4; display: flex; align-items: flex-start; gap: 4px; }
  .tabs a { padding: 20px 16px 9px; border-radius: 0 0 10px 10px; background: #dcd8cf; box-shadow: 0 2px 3px rgb(0 0 0 / 0.15); font-size: 13px; font-weight: 500; transition: padding 0.15s; }
  .tabs a:hover, .tabs a:focus-visible { padding-top: 30px; }
  .tabs a:nth-child(2) { background: #cfd9e6; }
  .tabs a:nth-child(3) { background: #e9dfc0; }
  .tabs a:nth-child(4) { background: #e6cfd2; }
  .tabs .login { margin-left: 10px; background: var(--ink); color: #fff; }

  .build { position: absolute; left: 6%; top: 25%; z-index: 2; width: clamp(210px, 27vw, 400px); rotate: -2deg; }
  .sub { position: absolute; left: 13%; top: 50%; z-index: 2; rotate: -5deg; color: #fff; font-size: clamp(22px, 3.2vw, 48px); letter-spacing: -0.02em; line-height: 1.45; }
  .sub span { display: block; margin-left: 0.5em; }
  .dash { position: absolute; left: 0; top: 70%; z-index: 1; width: 23%; height: 9%; fill: none; stroke: #fff; stroke-width: 2.5; stroke-dasharray: 9 9; vector-effect: non-scaling-stroke; }

  .pitch { position: absolute; left: 52%; right: 4%; top: 50%; z-index: 3; translate: 0 -50%; }
  h1 { font-size: clamp(54px, 8.6vw, 148px); font-weight: 900; letter-spacing: -0.055em; line-height: 0.95; white-space: nowrap; }
  h1 .sel { position: relative; margin-right: -0.04em; padding: 0 0.04em 0 0; background: linear-gradient(90deg, transparent 0.035em, rgb(60 130 255 / 0.28) 0.035em); }
  h1 .sel::before, h1 .sel::after { content: ''; position: absolute; top: -4%; bottom: -4%; width: 3px; background: var(--blue); }
  h1 .sel::before { left: 0.035em; translate: -50% 0; }
  h1 .sel::after { right: -1px; }
  h1 .sel b { position: absolute; z-index: 1; width: 0.13em; height: 0.13em; border-radius: 50%; background: var(--blue); touch-action: none; }
  /* invisible grab area covering the whole bar, not just the dot */
  h1 .sel b::after { content: ''; position: absolute; left: -0.1em; right: -0.1em; height: 1.2em; }
  h1 .sel b:first-child::after { top: 0; }
  h1 .sel b:last-child::after { bottom: 0; }
  .lm h1 .sel b { cursor: ew-resize; }
  h1 .sel b:first-child { left: -0.03em; top: -0.12em; }
  h1 .sel b:last-child { right: -0.06em; bottom: -0.12em; }
  .pitch p { margin-top: 0.7em; font-size: clamp(16px, 1.62vw, 25px); font-weight: 700; letter-spacing: -0.03em; line-height: 1.25; white-space: nowrap; }
  .pitch .cats { margin-top: 1.3em; }
  .ctas { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 26px; }
  footer .ctas { justify-content: center; }
  .cta { display: inline-flex; align-items: center; gap: 10px; padding: 15px 24px; border-radius: 999px; background: var(--ink); color: #fff; font-size: 17px; font-weight: 700; transition: translate 0.15s, box-shadow 0.15s; }
  .cta:hover, .cta:focus-visible { translate: -2px -2px; box-shadow: 4px 4px 0 var(--red); }
  .cta span { transition: translate 0.15s; }
  .cta:hover span { translate: 3px 0; }

  .folder { --w: clamp(120px, 13.5vw, 200px); left: 24%; bottom: 1.5%; }
  .folder .badge { right: auto; left: -8%; }
  .folder text { fill: #1d2a6b; font-family: var(--hand); font-size: 21px; }
  .folder > svg { width: 100%; height: auto; overflow: visible; filter: drop-shadow(0 6px 8px rgb(0 0 0 / 0.24)); }
  .folder .front { transform-origin: 50% 100%; transition: transform 0.2s; }
  .folder .sheet { transition: transform 0.2s; }
  .folder:hover .front { transform: skewX(-7deg) scaleY(0.9); }
  .folder:hover .sheet { transform: translateY(-46px) rotate(-2deg); }

  /* ---------- you ship ---------- */
  .desk { position: relative; max-width: 780px; margin: 56px auto 0; container-type: inline-size; }
  .book { --line: 5.5cqw; position: relative; display: grid; grid-template-columns: 1fr 1fr; rotate: -1.5deg; padding: 1.1cqw 1.2cqw 1.5cqw; border-radius: 1.6cqw; background: #1c1b3a; box-shadow: 0 14px 22px rgb(0 0 0 / 0.26); }
  .page { min-height: 66cqw; padding: calc(var(--line) * 1.5) 5cqw 0 9cqw; color: #1d2a6b; font-family: var(--hand); font-size: 4.9cqw; line-height: var(--line);
    background:
      linear-gradient(90deg, transparent calc(6cqw - 1.3px), rgb(214 22 30 / 0.4) 6cqw, transparent calc(6cqw + 1.3px)),
      repeating-linear-gradient(transparent 0 calc(var(--line) - 2.6px), rgb(58 75 214 / 0.3) calc(var(--line) - 1.3px), transparent var(--line)) 0 calc(var(--line) * 0.42),
      #fffef8; }
  .page.l { border-radius: 1cqw 0 0 1cqw; box-shadow: inset -0.25cqw 0 0 rgb(0 0 0 / 0.3), inset -1.6cqw 0 1.4cqw -0.8cqw rgb(0 0 0 / 0.26), inset -7cqw 0 5cqw -4cqw rgb(0 0 0 / 0.14), 0 0.3cqw 0 #dcdad2, 0 0.6cqw 0 #fffef8, 0 0.9cqw 0 #dcdad2; }
  .page.r { border-radius: 0 1cqw 1cqw 0; padding: calc(var(--line) * 1.5) 5cqw 0 7cqw; box-shadow: inset 0.5cqw 0 0.5cqw rgb(255 255 255 / 0.9), inset 2.2cqw 0 1.6cqw -1cqw rgb(0 0 0 / 0.2), inset 6cqw 0 5cqw -4cqw rgb(0 0 0 / 0.1), 0 0.3cqw 0 #dcdad2, 0 0.6cqw 0 #fffef8, 0 0.9cqw 0 #dcdad2;
    background:
      repeating-linear-gradient(transparent 0 calc(var(--line) - 2.6px), rgb(58 75 214 / 0.3) calc(var(--line) - 1.3px), transparent var(--line)) 0 calc(var(--line) * 0.42),
      #fffef8; }
  .page strong { font-weight: 400; text-decoration: underline wavy 1px; text-underline-offset: 0.12em; }
  .page ul { list-style: none; padding: 0; }
  .page .gap { margin-top: var(--line); }
  .page label { display: flex; gap: 0.3em; align-items: baseline; cursor: pointer; }
  .page input { appearance: none; flex: none; width: 0.55em; height: 0.55em; margin: 0; translate: 0 0.05em; border: 1.5px solid currentColor; border-radius: 2px; cursor: pointer; }
  .page input:checked { background: currentColor; }
  .page input:checked + span { text-decoration: line-through; opacity: 0.55; }
  .page .done { padding-left: 0.85em; opacity: 0.55; }
  .page mark { padding: 0 0.1em; background: linear-gradient(transparent 18%, rgb(255 60 170 / 0.42) 18% 86%, transparent 86%); }
  .sticky { position: absolute; right: -11cqw; top: -10cqw; z-index: 3; width: 23cqw; aspect-ratio: 1; display: grid; place-items: center; rotate: 6deg; background: #ffe76a; box-shadow: 0 0.6cqw 1cqw rgb(0 0 0 / 0.2); }
  .sticky img { width: auto; height: 82%; }
  .c-hl { --w: clamp(120px, 27cqw, 210px); left: -11%; top: 1%; }
  .c-pen { --w: clamp(14px, 3.1cqw, 24px); right: 13%; bottom: -19%; }
  .alarms { --w: 150px; right: -22%; top: 34%; rotate: var(--r); padding: 6px 12px; border-radius: 12px; background: #000; color: #fff; font-size: 22px; font-weight: 300; line-height: 1.2; box-shadow: 0 6px 12px rgb(0 0 0 / 0.25); }
  .alarms div { display: flex; justify-content: space-between; align-items: center; padding: 7px 0; border-bottom: 1px solid #2a2a2c; }
  .alarms div:last-of-type { border: 0; }
  .alarms small { display: block; color: #aaa; font-size: 9px; font-weight: 400; }
  .alarms i { position: relative; width: 30px; height: 18px; border-radius: 9px; background: #34c759; }
  .alarms i::after { content: ''; position: absolute; right: 2px; top: 2px; width: 14px; height: 14px; border-radius: 50%; background: #fff; }

  /* ---------- we ship ---------- */
  .lay { display: flex; flex-wrap: wrap; justify-content: center; gap: 56px 0; margin-top: 56px; }
  .lay .cut { position: relative; flex: 0 0 25%; display: grid; grid-template-rows: 216px auto; justify-items: center; align-items: center; }
  .lm .lay .cut { cursor: var(--cur); }
  /* Cap by the row's height as well as the width, so tall items can't spill onto their caption. */
  .lay .cut > img { width: auto; max-width: min(var(--w), 88%); max-height: 100%; }
  .lay .q { width: min(var(--w), 88%); }
  .lay .cut figcaption { margin: 0; translate: none; }
  .cut.pair > img { grid-area: 1 / 1; }
  .cut.pair > img:first-child { rotate: -24deg; }
  .cut.pair > img:nth-child(2) { rotate: 18deg; }
  .mystery .q { display: grid; place-items: center; aspect-ratio: 0.85; rotate: var(--r); border: 2px dashed #a9a59b; border-radius: 16px; color: #a9a59b; font-size: 64px; font-weight: 900; }

  /* ---------- the plan ---------- */
  .day { position: relative; margin-top: 56px; }
  /* Hour lines start after the time column, so the labels need no background. */
  .slot { position: relative; display: grid; grid-template-columns: 84px 1fr; min-height: 132px; }
  .slot::before, .day::after { content: ''; position: absolute; left: 84px; right: 0; top: 0; border-top: 2px solid #7f8be6; }
  .day::after { top: auto; bottom: 0; }
  .slot time { align-self: start; translate: 0 -50%; color: #77746d; font-size: 14px; line-height: 1; }
  .event { align-self: start; max-width: 640px; margin: 6px 0 22px; padding: 14px 18px; border-left: 5px solid var(--c); border-radius: 4px; background: color-mix(in srgb, var(--c) 22%, #fff); }
  .event b { display: block; font-size: clamp(18px, 2vw, 22px); letter-spacing: -0.02em; }
  .event span { color: #3d3b37; font-size: 15px; }
  .label { position: absolute; right: 3%; top: 8px; z-index: 2; rotate: -4deg; width: 172px; padding: 12px 12px 10px; border: 2px solid var(--ink); background: #fff; box-shadow: 0 4px 9px rgb(0 0 0 / 0.2); line-height: 1.15; }
  .label .tape { width: 56%; }
  .label small { display: block; color: #6b675f; font-size: 9px; letter-spacing: 0.08em; text-transform: uppercase; }
  .label b { display: block; margin-bottom: 6px; font-size: 13px; }
  .bars { display: block; height: 26px; margin-top: 2px; filter: blur(0.15px); background: repeating-linear-gradient(90deg, var(--ink) 0 3px, transparent 3px 6px, var(--ink) 6px 8px, transparent 8px 13px, var(--ink) 13px 18px, transparent 18px 21px); }

  /* ---------- faq + footer ---------- */
  .faq { max-width: 720px; }
  .faq details { border-bottom: 1px solid #cfcbc2; }
  .faq details:first-of-type { margin-top: 44px; border-top: 1px solid #cfcbc2; }
  .faq summary { display: flex; justify-content: space-between; gap: 16px; padding: 20px 0; cursor: pointer; list-style: none; font-size: 19px; font-weight: 700; letter-spacing: -0.02em; }
  .faq summary::-webkit-details-marker { display: none; }
  .faq summary::after { content: '+'; font-weight: 400; transition: rotate 0.2s; }
  .faq details[open] summary::after { rotate: 45deg; }
  .faq p { max-width: 58ch; padding: 0 0 22px; text-wrap: pretty; }
  footer { position: relative; margin-top: clamp(96px, 12vw, 168px); padding: 132px 24px 40px; color: #fff; text-align: center; }
  footer .torn { inset: 0; }
  footer .torn .ink, footer .torn .fibre { left: -80px; right: -80px; top: 40px; bottom: -80px; width: auto; }
  footer .torn .fibre { top: 26px; }
  footer > :not(.torn) { position: relative; z-index: 1; }
  footer .big { font-size: clamp(30px, 5vw, 64px); font-weight: 900; letter-spacing: -0.05em; line-height: 1; }
  footer .cta { background: #fff; color: var(--ink); }
  footer small { display: block; margin-top: 48px; font-size: 13px; opacity: 0.85; }
  footer small a { text-decoration: underline; text-underline-offset: 3px; }

  .tidy { position: fixed; right: 20px; bottom: 20px; z-index: 50; padding: 10px 16px; border: 0; border-radius: 99px; background: var(--ink); color: #fff; font-size: 13px; font-weight: 600; cursor: pointer; box-shadow: 0 6px 16px rgb(0 0 0 / 0.25); }
  .tidy:hover { background: var(--red); }

  @media (max-width: 1040px) {
    .alarms { right: -4%; top: auto; bottom: -24%; }
  }
  @media (max-width: 760px) {
    .hero { min-height: 0; padding-bottom: 56px; }
    .torn .fibre, .torn .ink { width: auto; right: -80px; bottom: auto; }
    .torn .ink { height: calc(330px + 80px); }
    .torn .fibre { height: calc(330px + 94px); }
    footer .torn .ink, footer .torn .fibre { bottom: -80px; height: auto; }
    .tabs a:not(.login) { display: none; }
    .tabs { right: 16px; }
    .build { left: 6%; top: 78px; width: 58%; }
    .sub { left: 10%; top: calc(78px + 27vw); font-size: 22px; }
    .dash, .hero .hand, .hero figcaption, .m-hide { display: none; }
    .pitch { position: relative; left: auto; right: auto; top: auto; translate: none; padding: 400px 24px 0; }
    h1 { font-size: 16.5vw; }
    .hero .cut { --w: var(--mw) !important; }
    .m-whey { left: auto !important; right: 4%; top: 58px !important; }
    .m-matcha { left: auto !important; right: 9%; bottom: auto !important; top: 232px; }
    .hero .folder { left: 6%; bottom: auto; top: 284px; }
    .desk { margin-top: 40px; }
    .alarms, .c-pen { display: none; }
    .c-hl { left: -5%; top: -3%; }
    .lay { gap: 48px 0; }
    .lay .cut { flex-basis: 50%; }
    .lay .hand, .day .hand, .label { display: none; }
    .slot { grid-template-columns: 68px 1fr; }
    .slot::before, .day::after { left: 68px; }
    .lay .cut { grid-template-rows: 170px auto; row-gap: 10px; }
    .event { margin-right: 18px; }
    .pitch p { white-space: normal; }
  }
  @media (prefers-reduced-motion: reduce) {
    .lm :global(*) { transition: none !important; }
  }
</style>
