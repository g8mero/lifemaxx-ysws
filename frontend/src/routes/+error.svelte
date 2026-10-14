<script lang="ts">
	import { page } from '$app/state';
</script>

<svelte:head>
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
	<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700;900&display=swap" rel="stylesheet" />
</svelte:head>

<!-- Same paper, ink and Inter as the landing page and dashboard (see .claude/lifemaxx-design.md). -->
<div class="error-page">
	<div class="error-content">
		<h1>{page.status === 404 ? 'how did you get here?' : page.status}</h1>
		<p>{page.error?.message ?? 'Something went wrong'}</p>
		<!-- The cat, as a white-bordered printed photo with a file-name caption. -->
		<figure class="cat">
			<img src="https://http.cat/{page.status}" alt="HTTP {page.status} cat" />
			<figcaption>http_{page.status}.png</figcaption>
		</figure>
		<a href="/home" class="back-link">back to safety <span aria-hidden="true">→</span></a>
	</div>
</div>

<style>
	.error-page {
		--paper: #f4f2ed;
		--ink: #0b0b0c;
		--red: #d6161e;
		--blue: #1557ff;
		--grain: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='3'/%3E%3CfeColorMatrix values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 .09 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
		min-height: 100vh;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 2rem;
		background: var(--paper) var(--grain);
		color: var(--ink);
		font-family: Inter, system-ui, sans-serif;
		line-height: 1.45;
	}

	.error-content {
		max-width: 600px;
		text-align: center;
	}

	/* The landing page's section heading. */
	h1 {
		margin: 0;
		font-size: clamp(30px, 4.2vw, 54px);
		font-weight: 700;
		line-height: 1;
		letter-spacing: -0.035em;
		text-wrap: balance;
	}

	p {
		margin: 12px 0 40px;
		color: #77746d;
		font-size: 16px;
	}

	.cat {
		margin: 0;
	}

	.cat img {
		display: block;
		width: 100%;
		max-width: 520px;
		margin: 0 auto;
		border: 8px solid #fff;
		border-radius: 3px;
		box-shadow: 0 14px 22px -8px rgb(0 0 0 / 0.3);
		rotate: -2deg;
		transition: rotate 0.18s, scale 0.18s;
	}

	.cat:hover img {
		rotate: 0deg;
		scale: 1.02;
	}

	/* File-name caption; turns into the blue "selected" pill on hover. */
	.cat figcaption {
		display: inline-block;
		margin-top: 16px;
		padding: 1px 6px;
		border-radius: 4px;
		font-size: 12px;
		line-height: 1.4;
	}

	.cat:hover figcaption {
		background: var(--blue);
		color: #fff;
	}

	/* The landing page's pill button. */
	.back-link {
		display: inline-flex;
		align-items: center;
		gap: 10px;
		margin-top: 32px;
		padding: 15px 24px;
		border-radius: 999px;
		background: var(--ink);
		color: #fff;
		font-size: 17px;
		font-weight: 700;
		text-decoration: none;
		transition: translate 0.15s, box-shadow 0.15s;
	}

	.back-link:hover,
	.back-link:focus-visible {
		translate: -2px -2px;
		box-shadow: 4px 4px 0 var(--red);
	}

	.back-link span {
		transition: translate 0.15s;
	}

	.back-link:hover span {
		translate: 3px 0;
	}

	@media (prefers-reduced-motion: reduce) {
		.cat img,
		.back-link,
		.back-link span {
			transition: none;
		}
	}
</style>
