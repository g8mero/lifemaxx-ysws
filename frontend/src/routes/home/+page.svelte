<!-- src/routes/home/+page.svelte -->
<!-- Color Pallet
 var(--color-danger) - Light Red
 var(--color-accent) - Light Blue
 var(--color-bg) - Dark Gray
 var(--color-border) - Medium Gray
 var(--color-text-faint) - Light Gray
 var(--color-text) - Beige
 var(--color-accent) - Light Steel Blue
 var(--color-text) - Light Cyan
 #9a9285 - Warm Granite (buildlogs accent)
 #52504a - Basalt       (buildlogs section bg)
 #ffffff - White
-->

<script lang="ts">
  import { onMount } from 'svelte';
  import { pushState } from '$app/navigation';
  import { page } from '$app/state';
  import confetti from 'canvas-confetti';
  import { formatLocal } from '$lib/utils/formatDate';

  // Portal action: moves a node to document.body so its position:fixed
  // escapes any ancestor containing-block (.main has filter: saturate which
  // otherwise pins fixed descendants to .main, making modals drift on long pages).
  function portal(node: HTMLElement) {
    const target = document.body;
    target.appendChild(node);
    return {
      destroy() {
        if (node.parentNode) node.parentNode.removeChild(node);
      },
    };
  }

  let { data } = $props();
  const MAX_SCREENSHOT_BYTES = 5 * 1024 * 1024;

  function slackUserUrl(slackId: string) {
    return `https://hackclub.enterprise.slack.com/team/${encodeURIComponent(slackId)}`;
  }

  const sectionRoutes: Record<string, string> = {
    dashboard: '/dashboard',
    shop: '/shop',
    explore: '/explore',
    me: '/me',
    buildlogs: '/buildlogs',
  };
  const pathSections: Record<string, string> = {
    '/home': 'dashboard',
    '/dashboard': 'dashboard',
    '/shop': 'shop',
    '/explore': 'explore',
    '/me': 'me',
    '/buildlogs': 'buildlogs'
  };
  const sectionFromPath = (pathname: string) => pathSections[pathname] ?? 'dashboard';

  let activeSection = $state(sectionFromPath(page.url.pathname));
  let customCursorEnabled = $state(typeof localStorage !== 'undefined' ? localStorage.getItem('customCursor') !== 'off' : true);
  let creatingProject = $state(false);
  let editingProject = $state<any>(null);
  type ProjectReview = {
    id: string;
    status: 'approved' | 'changes_needed';
    feedback: string | null;
    reviewerName: string | null;
    hideReviewerName?: boolean;
    createdAt: string;
  };
  let editingProjectReviews = $state<ProjectReview[]>([]);
  let editingProjectReviewsLoading = $state(false);
  let editingProjectQueue = $state<{ total: number; position: number } | null>(null);
  type BotReviewPrecheck = {
    checklist: { label: string; pass: boolean }[];
    summary: string | null;
    respondedAt: string;
  };
  let editingProjectPrecheck = $state<BotReviewPrecheck | null>(null);

  let projectName = $state('');
  let projectDesc = $state('');
  let projectType = $state('');
  let codeUrl = $state('');
  let demoUrl = $state('');
  let readmeUrl = $state('');

  // As the builder types a GitHub repo URL into Code URL, seed the README URL
  // for them — but only while README is still blank, so we never clobber a
  // manual entry or a value loaded from an existing project. Runs on input
  // (not a reactive effect) so it won't re-fill after the user clears it or
  // fire when editing an existing project. `HEAD` resolves to the repo's
  // default branch, so this works for `master`/non-`main` repos too.
  function autofillReadmeFromCode(code: string) {
    if (readmeUrl.trim()) return;
    const m = code.match(/^https:\/\/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?\/?$/i);
    if (m) readmeUrl = `https://github.com/${m[1]}/${m[2]}/blob/HEAD/README.md`;
  }
  let screenshotFiles = $state<(File | null)[]>([null, null]);
  let screenshotPreviews = $state<string[]>(['', '']);
  let hackatimeProject = $state<string[]>([]);
  let isUpdateProject = $state(false);
  let usedAi = $state(false);
  let aiUseDescription = $state('');
  let projects = $state<any[]>([]);
  let catImages = $state<Record<string, string>>({});
  let hackatimeProjects = $state<string[]>([]);
  let hackatimeLoading = $state(false);
  // null until the first fetch answers, so the Me page doesn't flash a Connect button at connected users.
  let hackatimeConnected = $state<boolean | null>(null);
  let hackatimeUserId = $state<string | null>(null);
  let hackatimeOpen = $state(false);
  let submitting = $state(false);
  let formError = $state('');
  let auditLog = $state<{ action: string; label: string; createdAt: string }[]>([]);
  let exploreProjects = $state<{ id: string; name: string; description: string; projectType: string; screenshot1Url: string | null; screenshot2Url: string | null; codeUrl: string | null; demoUrl: string | null; hours: number; builderName: string }[]>([]);
  let exploreLoading = $state(true);

  // Explore card screenshot index (per project)
  let cardImgIdx = $state<Record<string, number>>({});

  // Project detail view
  let detailProject = $state<any>(null);
  let detailLoading = $state(false);
  let detailComments = $state<{ id: string; body: string; authorName: string; authorId: string; createdAt: string }[]>([]);
  let detailCommentsLoading = $state(false);
  let detailCommentText = $state('');
  let detailCommentSubmitting = $state(false);
  let detailActiveImg = $state(0);

  // Shop state
  type ShopItemType = { id: string; name: string; description: string; detailedDescription: string | null; imageUrl: string; priceHours: number; stock: number | null; sortOrder: number; isFeatured: boolean; isSuperFeatured: boolean; isBlackMarket: boolean; estimatedShip: string | null };
  let shopItems = $state<ShopItemType[]>([]);
  // The single "super featured" item owns the spotlight hero at the top of the
  // shop; it's pulled out of the regular sections so it only appears once.
  const spotlightItem = $derived(shopItems.find((i) => i.isSuperFeatured && !i.isBlackMarket) ?? null);
  const featuredItems = $derived(shopItems.filter((i) => i.isFeatured && !i.isBlackMarket && i !== spotlightItem));
  const regularItems = $derived(shopItems.filter((i) => !i.isFeatured && !i.isBlackMarket && i !== spotlightItem));
  const blackMarketItems = $derived(shopItems.filter((i) => i.isBlackMarket));
  // True when the user has authored a golden project — unlocks black market items.
  let blackMarketUnlocked = $state(false);
  let shopLoading = $state(false);
  let shopLoaded = $state(false);
  let selectedShopItem = $state<ShopItemType | null>(null);
  let shopQuantity = $state(1);
  let shopQuantityText = $state('1');
  let userPipes = $state(0);
  // Currency display, config-driven (namePlural/nameSingular, capitalized to match the original UI's tone).
  function capitalize(s: string) {
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
  function currencyLabel(n: number) {
    return capitalize(n === 1 ? data.yswsConfig.currency.nameSingular : data.yswsConfig.currency.namePlural);
  }
  let purchaseLoading = $state(false);
  let purchaseError = $state('');
  let purchaseSuccess = $state('');
  // Checkout note popup: buyers can leave a note for the fulfillers.
  let notePromptOpen = $state(false);
  let orderNote = $state('');

  // User's own orders (shown at the bottom of the shop)
  type UserOrderType = { id: string; itemName: string; quantity: number; pipesSpent: number; status: string; createdAt: string };
  let userOrders = $state<UserOrderType[]>([]);
  let userOrdersLoading = $state(false);
  let refundingOrderId = $state<string | null>(null);
  let refundError = $state('');

  // Fulfillment updates state
  type FulfillmentUpdateType = { id: string; orderId: string; itemName: string; message: string; isRead: boolean; createdAt: string };
  let fulfillmentUpdates = $state<FulfillmentUpdateType[]>([]);
  let fulfillmentLoading = $state(false);
  let unreadCount = $state(0);

  // Buildlogs state
  type LookoutBuildlog = {
    status: string;
    trackedSeconds: number | null;
    videoUrl: string | null;
    thumbnailUrl: string | null;
  } | null;
  type BuildlogType = { id: string; projectId: string | null; title: string; text: string; imageUrls: string[]; lookout: LookoutBuildlog; createdAt: string };
  type LookoutSessionOption = {
    id: string;
    name: string | null;
    status: string;
    trackedSeconds: number | null;
    screenshotCount: number | null;
    videoUrl: string | null;
    thumbnailUrl: string | null;
    createdAt: string | null;
  };
  let buildlogs = $state<BuildlogType[]>([]);
  let buildlogsLoading = $state(false);
  let buildlogFormOpen = $state(false);
  let buildlogLightbox = $state<string | null>(null);
  // Whether the "select a timelapse" popup is open.
  let lookoutPickerOpen = $state(false);

  // Show the create form upfront when there are no buildlogs yet; otherwise
  // keep it tucked behind a "New buildlog" button until the user opens it.
  let buildlogFormVisible = $derived(buildlogs.length === 0 || buildlogFormOpen);

  function openBuildlogLightbox(url: string) {
    buildlogLightbox = url;
  }
  function closeBuildlogLightbox() {
    buildlogLightbox = null;
  }
  function onBuildlogLightboxKey(e: KeyboardEvent) {
    if (e.key !== 'Escape') return;
    if (lookoutPickerOpen) { lookoutPickerOpen = false; return; }
    closeBuildlogLightbox();
  }

  // Label for the "select a timelapse" button reflecting the current choice.
  function selectedLookoutLabel(): string {
    if (!buildlogLookoutSessionId) return '🎞️ Select a timelapse';
    const s = buildlogLookoutSessions.find((x) => x.id === buildlogLookoutSessionId);
    if (!s) return '🎞️ Select a timelapse';
    if (s.name) return `${s.name}`;
    const time = s.trackedSeconds ? `${fmtTrackedShort(s.trackedSeconds)} · ` : '';
    return `🎞️ ${time}${s.createdAt ? formatLocal(s.createdAt) : 'recent'}`;
  }
  let buildlogTitle = $state('');
  let buildlogText = $state('');
  let buildlogProjectId = $state<string>('');
  let buildlogFiles = $state<(File | null)[]>([null, null, null, null]);
  let buildlogPreviews = $state<string[]>(['', '', '', '']);
  let buildlogSubmitting = $state(false);
  let buildlogError = $state('');
  // Lookout timelapse the user records (optionally) before posting a buildlog.
  let buildlogLookoutSessionId = $state<string | null>(null);
  let buildlogLookoutSessions = $state<LookoutSessionOption[]>([]);
  let buildlogLookoutSessionsLoading = $state(false);
  let buildlogLookoutBusy = $state(false);
  // Survives the redirect to the Lookout recorder so the half-written buildlog
  // (and its attached recording) is restored when the user comes back.
  const BUILDLOG_DRAFT_KEY = 'ysws:buildlog-lookout-draft';
  const BUILDLOG_AUTOSAVE_KEY = 'ysws:buildlog-autosave';

  function selectDefaultBuildlogLookoutSession(sessions: LookoutSessionOption[]) {
    const selectable = getSelectableBuildlogLookoutSessions(sessions);
    const completeSession = selectable.find((session) => session.status === 'complete');
    return completeSession?.id ?? selectable[0]?.id ?? null;
  }

  function sortBuildlogLookoutSessions(sessions: LookoutSessionOption[]) {
    // Newest to oldest. (Default selection still prefers a complete session via
    // selectDefaultBuildlogLookoutSession, independent of this ordering.)
    // A missing createdAt means a just-created session, so treat it as newest.
    return [...sessions].sort((a, b) => {
      const aTime = a.createdAt ? Date.parse(a.createdAt) : Infinity;
      const bTime = b.createdAt ? Date.parse(b.createdAt) : Infinity;
      return bTime - aTime;
    });
  }

  $effect(() =>{
    if (typeof localStorage === 'undefined') return;
    const hasContent =
      buildlogTitle.trim() || buildlogText.trim() || buildlogProjectId || buildlogLookoutSessionId;
    if (!hasContent) {
      localStorage.removeItem(BUILDLOG_AUTOSAVE_KEY);
      return;
    }
    localStorage.setItem(
      BUILDLOG_AUTOSAVE_KEY,
      JSON.stringify({
        title: buildlogTitle,
        text: buildlogText,
        projectId: buildlogProjectId,
        lookoutSessionId: buildlogLookoutSessionId,
      }),
    );
  });

  const LOOKOUT_INPROGRESS_WINDOW_MS = 30 * 60 * 1000;
  function getSelectableBuildlogLookoutSessions(sessions: LookoutSessionOption[]) {
    const now = Date.now();
    return sortBuildlogLookoutSessions(sessions).filter((session) => {
      if (session.status === 'failed') return false;
      if (session.status === 'complete') return true;
      const created = session.createdAt ? Date.parse(session.createdAt) : now;
      return now - created < LOOKOUT_INPROGRESS_WINDOW_MS;
    });
  }

  async function fetchBuildlogLookoutSessions(projectId: string) {
    if (!projectId) {
      buildlogLookoutSessions = [];
      buildlogLookoutSessionId = null;
      buildlogLookoutSessionsLoading = false;
      return;
    }

    buildlogLookoutSessionsLoading = true;
    try {
      const res = await fetch(`/api/projects/${projectId}/lookout`);
      if (!res.ok) {
        buildlogLookoutSessions = [];
        buildlogLookoutSessionId = null;
        return;
      }

      const data = await res.json().catch(() => null);
      const sessions = Array.isArray(data?.sessions) ? data.sessions : [];
      buildlogLookoutSessions = sessions;

      if (!sessions.some((session: LookoutSessionOption) => session.id === buildlogLookoutSessionId && session.status !== 'failed')) {
        buildlogLookoutSessionId = selectDefaultBuildlogLookoutSession(sessions);
      }
    } catch {
      buildlogLookoutSessions = [];
      buildlogLookoutSessionId = null;
    } finally {
      buildlogLookoutSessionsLoading = false;
    }
  }

  $effect(() => {
    const projectId = buildlogProjectId.trim();
    void fetchBuildlogLookoutSessions(projectId);
  });

  async function startBuildlogRecording() {
    if (!buildlogProjectId) {
      buildlogError = 'Pick a project before recording a timelapse';
      return;
    }
    buildlogLookoutBusy = true;
    try {
      const res = await fetch(`/api/projects/${buildlogProjectId}/lookout/session`, {
        method: 'POST'
      });
      if (!res.ok) {
        // 503: the backend has no LOOKOUT_API_KEY, so timelapses aren't set up for this program.
        buildlogError = res.status === 503
          ? "Timelapse recording isn't set up for this program yet."
          : 'Could not start a timelapse recording right now.';
        return;
      }
      const { id, token } = await res.json();
      buildlogLookoutSessionId = id;
      if (!buildlogLookoutSessions.some((session) => session.id === id)) {
        buildlogLookoutSessions = [
          ...buildlogLookoutSessions,
          { id, name: null, status: 'pending', trackedSeconds: null, screenshotCount: null, videoUrl: null, thumbnailUrl: null, createdAt: null },
        ];
      }
      // Stash the in-progress buildlog so it (and this recording) survive the
      // round-trip in case the browser navigates away to hand off the link.
      try {
        sessionStorage.setItem(
          BUILDLOG_DRAFT_KEY,
          JSON.stringify({
            title: buildlogTitle,
            text: buildlogText,
            projectId: buildlogProjectId,
            lookoutSessionId: id
          })
        );
      } catch { /* private mode / quota — continue anyway */ }
      // Deep-link into the Lookout desktop app (matches fallout's desktop mode).
      window.location.href = `lookout://session?token=${token}`;
    } catch {
      buildlogError = 'Could not start a timelapse recording right now.';
    } finally {
      buildlogLookoutBusy = false;
    }
  }

  function restoreBuildlogDraft() {
    let raw: string | null = null;
    try {
      raw = sessionStorage.getItem(BUILDLOG_DRAFT_KEY);
      sessionStorage.removeItem(BUILDLOG_DRAFT_KEY);
    } catch { return; }
    if (!raw) return;
    try {
      const draft = JSON.parse(raw);
      buildlogTitle = draft.title ?? '';
      buildlogText = draft.text ?? '';
      buildlogProjectId = draft.projectId ?? '';
      buildlogLookoutSessionId = draft.lookoutSessionId ?? null;
      buildlogFormOpen = true;
      activeSection = 'buildlogs';
      fetchBuildlogs();
      return true;
    } catch { /* malformed draft — ignore */ }
    return false;
  }

  // Restore a locally autosaved draft (survives reload / window close). The
  // Lookout sessionStorage draft above takes precedence when both exist.
  function restoreBuildlogAutosave() {
    let raw: string | null = null;
    try {
      raw = localStorage.getItem(BUILDLOG_AUTOSAVE_KEY);
    } catch { return; }
    if (!raw) return;
    try {
      const draft = JSON.parse(raw);
      buildlogTitle = draft.title ?? '';
      buildlogText = draft.text ?? '';
      buildlogProjectId = draft.projectId ?? '';
      buildlogLookoutSessionId = draft.lookoutSessionId ?? null;
      if (buildlogTitle || buildlogText || buildlogProjectId) buildlogFormOpen = true;
    } catch { /* malformed draft — ignore */ }
  }
  const BUILDLOG_TITLE_MAX = 120;
  const BUILDLOG_TEXT_MAX = 5000;
  const BUILDLOG_MAX_IMAGES = 4;
  let buildlogImageCount = $derived(buildlogPreviews.filter(Boolean).length);
  let nicknameInput = $state(data.user.nickname ?? '');
  let savedNickname = $state(data.user.nickname ?? '');
  let nicknameSaving = $state(false);
  let canSubmit = $derived(projectName.trim() !== '' && projectDesc.trim() !== '' && projectType !== '' && !submitting);
  let hasScreenshots = $derived(screenshotPreviews[0] !== '' || screenshotPreviews[1] !== '');
  let canSubmitForReview = $derived(
    projectName.trim() !== '' &&
    projectDesc.trim() !== '' &&
    projectType !== '' &&
    codeUrl.trim() !== '' &&
    readmeUrl.trim() !== '' &&
    demoUrl.trim() !== '' &&
    hackatimeProject.length > 0 &&
    hasScreenshots &&
    !submitting
  );
  let projectCols = $derived(Math.max(1, Math.min(2, Math.ceil(Math.sqrt(projects.length)))));

  // Review checklist
  let reviewProject = $state<any>(null);
  let checkOpenSource = $state(false);
  let checkDemoable = $state(false);
  let checkReadme = $state(false);
  let checkHackatime = $state(false);
  let checkStartedOrUpdated = $state(false);
  let canConfirmReview = $derived(checkOpenSource && checkDemoable && checkReadme && checkHackatime && checkStartedOrUpdated && !submitting);
  let reviewSubmitted = $state(false);
  let reviewSubmittedName = $state('');
  let reviewerNote = $state('');

  // Resubmit state (approved projects)
  let resubmitChangeDesc = $state('');
  let resubmitMinHours = $state(false);
  let resubmitReviewerNote = $state('');
  let resubmitLoading = $state(false);

  // Shipping eligibility
  let shippingCheck = $state<{ hasAddress: boolean; hasBirthdate: boolean; identityVerified: boolean; eligible: boolean; addressPortalUrl: string; identityPortalUrl: string } | null>(null);
  let shippingCheckLoading = $state(false);
  let showShippingPrompt = $state(false);
  let identityPollAttempts = $state(0);
  let identityPollExhausted = $state(false);
  let identityPollTimer: ReturnType<typeof setTimeout> | null = null;
  const IDENTITY_POLL_INTERVAL_MS = 5000;
  const IDENTITY_POLL_MAX_ATTEMPTS = 60; // ~5 minutes

  function resetForm() {
    creatingProject = false;
    editingProject = null;
    reviewProject = null;
    reviewSubmitted = false;
    reviewSubmittedName = '';
    projectName = '';
    projectDesc = '';
    projectType = '';
    codeUrl = '';
    demoUrl = '';
    readmeUrl = '';
    screenshotFiles = [null, null];
    screenshotPreviews = ['', ''];
    hackatimeProject = [];
    hackatimeOpen = false;
    isUpdateProject = false;
    usedAi = false;
    aiUseDescription = '';
    formError = '';
    checkOpenSource = false;
    checkDemoable = false;
    checkReadme = false;
    checkHackatime = false;
    checkStartedOrUpdated = false;
    reviewerNote = '';
    resubmitChangeDesc = '';
    resubmitMinHours = false;
    resubmitReviewerNote = '';
    resubmitLoading = false;
    editingProjectReviews = [];
    editingProjectReviewsLoading = false;
    editingProjectQueue = null;
    editingProjectPrecheck = null;
  }

  async function fetchProjectQueue(projectId: string) {
    editingProjectQueue = null;
    try {
      const res = await fetch(`/api/projects/${projectId}/queue-position`);
      if (res.ok) {
        const data = await res.json();
        if (typeof data?.total === 'number' && typeof data?.position === 'number') {
          editingProjectQueue = { total: data.total, position: data.position };
        }
      }
    } catch { /* silent */ }
  }

  async function fetchProjectReviews(projectId: string) {
    editingProjectReviews = [];
    editingProjectReviewsLoading = true;
    try {
      const res = await fetch(`/api/projects/${projectId}/reviews`);
      if (res.ok) {
        const data = await res.json();
        editingProjectReviews = Array.isArray(data) ? data : [];
      }
    } catch { /* silent */ }
    editingProjectReviewsLoading = false;
  }

  async function fetchProjectPrecheck(projectId: string) {
    editingProjectPrecheck = null;
    try {
      const res = await fetch(`/api/projects/${projectId}/bot-review-precheck`);
      if (res.ok) {
        const data = await res.json();
        editingProjectPrecheck = data ?? null;
      }
    } catch { /* silent */ }
  }

  async function resubmitProject() {
    if (!editingProject || !resubmitChangeDesc.trim() || !resubmitMinHours || resubmitLoading) return;
    resubmitLoading = true;
    formError = '';

    // Check shipping eligibility before proceeding
    const eligible = await checkShippingEligibility();
    if (!eligible) {
      resubmitLoading = false;
      return;
    }

    try {
      const res = await fetch(`/api/projects/${editingProject.id}/resubmit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          changeDescription: resubmitChangeDesc.trim(),
          minHoursConfirmed: resubmitMinHours,
          reviewerNote: resubmitReviewerNote.trim() || null,
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        formError = Array.isArray(data.message) ? data.message.join(', ') : data.message || `Server error (${res.status})`;
        resubmitLoading = false;
        return;
      }
      reviewSubmittedName = editingProject.name;
      reviewSubmitted = true;
      resetForm();
      launchConfetti();
      fetchProjects();
      fetchAuditLog();
    } catch {
      formError = 'Something went wrong. Please try again.';
    }
    resubmitLoading = false;
  }

  function launchConfetti() {
    const colors = ['var(--color-success)', 'var(--color-accent)', 'var(--color-text)', 'var(--color-danger)', 'var(--color-accent)', 'var(--color-text)'];
    confetti({
      particleCount: 120,
      spread: 80,
      origin: { y: 0.6 },
      colors,
    });
    // Second burst slightly delayed for a fuller effect
    setTimeout(() => {
      confetti({
        particleCount: 60,
        spread: 100,
        origin: { y: 0.5, x: 0.35 },
        colors,
      });
      confetti({
        particleCount: 60,
        spread: 100,
        origin: { y: 0.5, x: 0.65 },
        colors,
      });
    }, 200);
  }

  function openCreateProject() {
    resetForm();
    creatingProject = true;
  }

  function openEditProject(project: any) {
    resetForm();
    editingProject = project;
    fetchProjectReviews(project.id);
    if (project.status === 'unreviewed') {
      fetchProjectQueue(project.id);
      fetchProjectPrecheck(project.id);
    }
    projectName = project.name ?? '';
    projectDesc = project.description ?? '';
    projectType = project.projectType ?? '';
    codeUrl = project.codeUrl ?? '';
    demoUrl = project.demoUrl ?? '';
    readmeUrl = project.readmeUrl ?? '';
    hackatimeProject = Array.isArray(project.hackatimeProjectName) ? project.hackatimeProjectName : project.hackatimeProjectName ? [project.hackatimeProjectName] : [];
    isUpdateProject = project.isUpdate ?? false;
    screenshotPreviews = [project.screenshot1Url ?? '', project.screenshot2Url ?? ''];
    usedAi = !!(project.aiUse);
    aiUseDescription = project.aiUse ?? '';
  }



  function handleScreenshot(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    if (file.size > MAX_SCREENSHOT_BYTES) {
      formError = 'Screenshot must be 5 MB or smaller';
      input.value = '';
      return;
    }
    if (!['image/png', 'image/jpeg', 'image/gif', 'image/webp'].includes(file.type)) {
      formError = 'Screenshot must be a PNG, JPEG, GIF, or WebP image';
      input.value = '';
      return;
    }
    const idx = screenshotPreviews[0] === '' ? 0 : 1;
    screenshotFiles[idx] = file;
    screenshotPreviews[idx] = URL.createObjectURL(file);
    formError = '';
    input.value = '';
  }

  function removeScreenshot(idx: number) {
    screenshotFiles[idx] = null;
    screenshotPreviews[idx] = '';
    // Keep the remaining one in the first slot so new uploads fill from the start.
    if (idx === 0 && screenshotPreviews[1]) {
      screenshotFiles = [screenshotFiles[1], null];
      screenshotPreviews = [screenshotPreviews[1], ''];
    }
  }

  let screenshotCount = $derived(screenshotPreviews.filter(Boolean).length);

  function fileToDataUri(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function fetchProjects() {
    try {
      const res = await fetch('/api/projects');
      if (res.ok) {
        const data = await res.json();
        projects = Array.isArray(data) ? data : [];
        // Fetch cat placeholder images for projects without screenshots
        for (const p of projects) {
          if (!p.screenshot1Url) {
            fetch('/api/cat').then(r => r.json()).then(d => {
              if (d?.url) catImages = { ...catImages, [p.id]: d.url };
            }).catch(() => {});
          }
        }
      }
    } catch { /* silent */ }
  }

  async function fetchExploreProjects() {
    exploreLoading = true;
    try {
      const res = await fetch('/api/projects/explore');
      if (res.ok) {
        exploreProjects = await res.json();
      }
    } catch { /* silent */ }
    exploreLoading = false;
  }

  async function openProjectDetail(projectId: string) {
    detailProject = null;
    detailComments = [];
    detailCommentText = '';
    detailActiveImg = 0;
    detailLoading = true;
    detailCommentsLoading = true;
    try {
      const [projRes, commRes] = await Promise.all([
        fetch(`/api/projects/explore/${projectId}`),
        fetch(`/api/projects/explore/${projectId}/comments`),
      ]);
      if (projRes.ok) detailProject = await projRes.json();
      if (commRes.ok) detailComments = await commRes.json();
    } catch { /* silent */ }
    detailLoading = false;
    detailCommentsLoading = false;
  }

  function closeProjectDetail() {
    detailProject = null;
    detailComments = [];
    detailCommentText = '';
  }

  async function submitComment() {
    if (!detailProject || detailCommentSubmitting) return;
    const body = detailCommentText.trim();
    if (!body) return;
    detailCommentSubmitting = true;
    try {
      const res = await fetch(`/api/projects/explore/${detailProject.id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body }),
      });
      if (res.ok) {
        detailCommentText = '';
        // Refresh comments
        const commRes = await fetch(`/api/projects/explore/${detailProject.id}/comments`);
        if (commRes.ok) detailComments = await commRes.json();
      }
    } catch { /* silent */ }
    detailCommentSubmitting = false;
  }

  async function deleteComment(commentId: string) {
    if (!detailProject) return;
    try {
      const res = await fetch(`/api/projects/explore/${detailProject.id}/comments/${commentId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        detailComments = detailComments.filter((c) => c.id !== commentId);
      }
    } catch { /* silent */ }
  }

  async function fetchAuditLog() {
    try {
      const res = await fetch('/api/audit-log');
      if (res.ok) {
        const data = await res.json();
        auditLog = Array.isArray(data) ? data : [];
      }
    } catch { /* silent */ }
  }

  function timeAgo(dateStr: string): string {
    const iso = dateStr.endsWith('Z') || dateStr.includes('+') ? dateStr : dateStr + 'Z';
    const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    const weeks = Math.floor(days / 7);
    return `${weeks}w ago`;
  }

  async function fetchHackatimeProjects() {
    hackatimeLoading = true;
    try {
      const res = await fetch('/api/hackatime/projects');
      if (res.ok) {
        const data = await res.json();
        hackatimeProjects = data.projects ?? [];
        hackatimeConnected = !!data.connected;
        hackatimeUserId = data.hackatimeUserId ?? null;
      }
    } catch { /* silently fail — dropdown stays empty */ }
    hackatimeLoading = false;
  }

  function fmtTrackedShort(secs: number | null): string {
    if (!secs || secs <= 0) return '';
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  }

  async function submitProject() {
    if (!canSubmit) return;
    formError = '';
    submitting = true;

    try {
      const screenshots: string[] = [];
      for (const file of screenshotFiles) {
        if (file) screenshots.push(await fileToDataUri(file));
      }

      const isEdit = !!editingProject;
      const url = isEdit ? `/api/projects/${editingProject.id}` : '/api/projects';
      const method = isEdit ? 'PATCH' : 'POST';

      const body: any = {
        name: projectName,
        description: projectDesc,
        projectType,
        codeUrl: codeUrl || null,
        readmeUrl: readmeUrl || null,
        demoUrl: demoUrl || null,
        hackatimeProjectName: hackatimeProject.length > 0 ? hackatimeProject : null,
        isUpdate: isUpdateProject,
        aiUse: usedAi ? aiUseDescription || null : null,
      };
      // Only send screenshots if the user uploaded new files.
      // When editing, screenshotFiles are null for existing URLs — don't wipe them.
      const hasNewFiles = screenshotFiles.some(f => f !== null);
      if (hasNewFiles) {
        body.screenshots = screenshots;
      } else if (!isEdit) {
        // New project with no screenshots — send empty array
        body.screenshots = [];
      }
      // When editing with no new files: omit screenshots entirely to preserve existing ones

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const msg = Array.isArray(data.message) ? data.message.join(', ') : data.message;
        formError = msg || `Server error (${res.status})`;
        submitting = false;
        return;
      }

      resetForm();
      fetchProjects();
      fetchAuditLog();
    } catch {
      formError = 'Something went wrong. Please try again.';
    }
    submitting = false;
  }

  async function checkShippingEligibility(): Promise<boolean> {
    shippingCheckLoading = true;
    try {
      const res = await fetch('/api/auth/shipping-eligibility');
      if (res.ok) {
        shippingCheck = await res.json();
        if (!shippingCheck?.eligible) {
          showShippingPrompt = true;
          identityPollAttempts = 0;
          identityPollExhausted = false;
          return false;
        }
        return true;
      }
    } catch { /* silent */ }
    shippingCheckLoading = false;
    return true; // don't block on network errors
  }

  /**
   * Re-fetches /shipping-eligibility once. Used by the auto-poll while the
   * prompt is open and by the manual "check now" button after the auto-poll
   * times out. The backend's identity check is live, so as soon as HCA
   * approves the document this returns true.
   */
  async function refreshShippingEligibility(): Promise<void> {
    try {
      const res = await fetch('/api/auth/shipping-eligibility');
      if (res.ok) shippingCheck = await res.json();
    } catch { /* silent */ }
  }

  function stopIdentityPolling() {
    if (identityPollTimer !== null) {
      clearTimeout(identityPollTimer);
      identityPollTimer = null;
    }
  }

  function scheduleIdentityPoll() {
    stopIdentityPolling();
    identityPollTimer = setTimeout(async () => {
      identityPollTimer = null;
      identityPollAttempts += 1;
      await refreshShippingEligibility();
      // The $effect below decides whether to re-arm based on the fresh state.
    }, IDENTITY_POLL_INTERVAL_MS);
  }

  // While the prompt is open and identity is still missing, keep polling.
  // Stops automatically when the prompt closes, when identity verifies, or
  // when we hit the attempt cap.
  $effect(() => {
    const polling =
      showShippingPrompt &&
      shippingCheck != null &&
      !shippingCheck.identityVerified &&
      !identityPollExhausted;

    if (!polling) {
      stopIdentityPolling();
      return;
    }

    if (identityPollAttempts >= IDENTITY_POLL_MAX_ATTEMPTS) {
      identityPollExhausted = true;
      stopIdentityPolling();
      return;
    }

    scheduleIdentityPoll();
    return () => stopIdentityPolling();
  });

  async function manualIdentityRecheck() {
    identityPollAttempts = 0;
    identityPollExhausted = false;
    await refreshShippingEligibility();
  }

  async function submitForReview() {
    if (!editingProject || !canSubmitForReview) return;
    formError = '';
    submitting = true;

    // Check shipping eligibility before proceeding
    const eligible = await checkShippingEligibility();
    if (!eligible) {
      submitting = false;
      return;
    }

    try {
      const screenshots: string[] = [];
      for (const file of screenshotFiles) {
        if (file) screenshots.push(await fileToDataUri(file));
      }

      const body: any = {
        name: projectName,
        description: projectDesc,
        projectType,
        codeUrl: codeUrl || null,
        readmeUrl: readmeUrl || null,
        demoUrl: demoUrl || null,
        hackatimeProjectName: hackatimeProject.length > 0 ? hackatimeProject : null,
        isUpdate: isUpdateProject,
        aiUse: usedAi ? aiUseDescription || null : null,
      };
      // Only send screenshots if the user uploaded new files — preserve existing ones otherwise
      const hasNewFiles = screenshotFiles.some(f => f !== null);
      if (hasNewFiles) {
        body.screenshots = screenshots;
      }

      const res = await fetch(`/api/projects/${editingProject.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const msg = Array.isArray(data.message) ? data.message.join(', ') : data.message;
        formError = msg || `Server error (${res.status})`;
        submitting = false;
        return;
      }

      reviewProject = data;
      editingProject = null;
      creatingProject = false;
      fetchProjects();
      fetchAuditLog();
    } catch {
      formError = 'Something went wrong. Please try again.';
    }
    submitting = false;
  }

  async function confirmReview() {
    if (!reviewProject || !canConfirmReview) return;
    submitting = true;
    formError = '';
    try {
      const res = await fetch(`/api/projects/${reviewProject.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'unreviewed',
          reviewerNote: reviewerNote.trim() || null,
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        formError = Array.isArray(data.message) ? data.message.join(', ') : data.message || `Server error (${res.status})`;
        submitting = false;
        return;
      }
      reviewSubmittedName = reviewProject.name;
      reviewSubmitted = true;
      reviewProject = null;
      launchConfetti();
      fetchProjects();
      fetchAuditLog();
    } catch {
      formError = 'Something went wrong. Please try again.';
    }
    submitting = false;
  }

  async function convertToDraft(id: string) {
    if (!confirm('Converting to draft will remove you from the review queue. Continue?')) return;
    try {
      const res = await fetch(`/api/projects/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'unshipped' })
      });
      if (res.ok) {
        resetForm();
        fetchProjects();
        fetchAuditLog();
      }
    } catch { /* silent */ }
  }

  async function deleteProject(id: string) {
    if (!confirm('Delete this project? This cannot be undone.')) return;
    try {
      const res = await fetch(`/api/projects/${id}`, { method: 'DELETE' });
      if (res.ok) {
        resetForm();
        fetchProjects();
        fetchAuditLog();
      }
    } catch { /* silent */ }
  }


  async function fetchShopItems() {
    if (shopLoaded) return;
    shopLoading = true;
    try {
      const res = await fetch('/api/shop');
      if (res.ok) {
        const data = await res.json();
        shopItems = data.items ?? [];
        blackMarketUnlocked = !!data.blackMarketUnlocked;
      }
      shopLoaded = true;
    } catch { /* silent */ }
    shopLoading = false;
  }

  function openShopItem(item: ShopItemType) {
    selectedShopItem = item;
    shopQuantity = 1;
    shopQuantityText = '1';
  }

  function setShopQuantity(raw: string) {
    const digits = raw.replace(/\D/g, '');
    shopQuantityText = digits;
    if (digits === '') return;
    let n = parseInt(digits, 10);
    if (!Number.isFinite(n) || n < 1) n = 1;
    const max = selectedShopItem?.stock ?? null;
    if (max !== null && n > max) {
      n = max;
      shopQuantityText = String(n);
    }
    shopQuantity = n;
  }

  function commitShopQuantity() {
    const n = parseInt(shopQuantityText, 10);
    if (!Number.isFinite(n) || n < 1) {
      shopQuantity = 1;
      shopQuantityText = '1';
    } else {
      shopQuantityText = String(shopQuantity);
    }
  }

  function closeShopItem() {
    selectedShopItem = null;
  }


  // `icon` is inline SVG content (Lucide-style, 24×24 viewBox, stroked with
  // currentColor) rendered inside the shared .nav-icon <svg> wrapper.
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', mobile: true, icon: '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>' },
    { id: 'buildlogs', label: 'Buildlogs', mobile: false, icon: '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>' },
    { id: 'shop', label: 'Shop', mobile: true, icon: '<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/>' },
    // Explore is hidden for now (its route 404s too, see explore/+page.server.ts). Uncomment to bring it back.
    // { id: 'explore', label: 'Explore', mobile: true, icon: '<circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/>' },
    { id: 'me', label: 'Me', mobile: true, icon: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>' },
  ];

  function loadSectionData(id: string) {
    if (id === 'shop') { fetchShopItems(); fetchPipes(); fetchUserOrders(); }
    // Mark read only after the list has loaded, so unread updates still show their highlight once.
    if (id === 'dashboard') { fetchFulfillmentUpdates().then(markFulfillmentRead); }
    if (id === 'buildlogs' || id === 'dashboard') { fetchBuildlogs(); }
    if (id === 'explore') { fetchExploreProjects(); }
  }

  function navigate(id: string) {
    if (creatingProject || editingProject || reviewProject) resetForm();
    activeSection = id;
    loadSectionData(id);
    pushState(sectionRoutes[id] ?? '/dashboard', {});
  }

  async function fetchPipes() {
    try {
      const res = await fetch('/api/shop/pipes');
      if (res.ok) {
        const data = await res.json();
        userPipes = data.pipes ?? 0;
      }
    } catch { /* silent */ }
  }

  // "Redeem" opens the note popup; the popup's confirm button does the purchase.
  function openNotePrompt() {
    if (!selectedShopItem || purchaseLoading) return;
    purchaseError = '';
    orderNote = '';
    notePromptOpen = true;
  }

  async function purchaseItem() {
    if (!selectedShopItem || purchaseLoading) return;
    purchaseError = '';
    purchaseSuccess = '';
    purchaseLoading = true;
    try {
      const res = await fetch('/api/shop/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shopItemId: selectedShopItem.id,
          quantity: shopQuantity,
          note: orderNote.trim() || null
        })
      });
      const data = await res.json();
      if (!res.ok) {
        purchaseError = data.message || 'Purchase failed';
      } else {
        notePromptOpen = false;
        purchaseSuccess = `Ordered ${shopQuantity}x ${selectedShopItem.name}!`;
        userPipes = data.remainingPipes;
        // Refresh shop items (stock may have changed)
        fetchShopItems();
        // Refresh the user's orders list (new order appears at the bottom of the shop)
        fetchUserOrders();
        // Refresh unread count
        fetchUnreadCount();
        setTimeout(() => { closeShopItem(); purchaseSuccess = ''; orderNote = ''; }, 2000);
      }
    } catch {
      purchaseError = 'Network error — try again';
    }
    purchaseLoading = false;
  }

  async function fetchUserOrders() {
    userOrdersLoading = true;
    try {
      const res = await fetch('/api/shop/orders');
      if (res.ok) userOrders = await res.json();
    } catch { /* silent */ }
    userOrdersLoading = false;
  }

  async function refundOrder(order: UserOrderType) {
    if (refundingOrderId) return;
    if (!confirm(`Refund ${order.quantity}x ${order.itemName}? You'll get ${order.pipesSpent} ${currencyLabel(order.pipesSpent)} back.`)) return;
    refundingOrderId = order.id;
    refundError = '';
    try {
      const res = await fetch(`/api/shop/orders/${order.id}/refund`, { method: 'POST' });
      const data = await res.json().catch(() => null);
      if (res.ok) {
        userOrders = userOrders.filter((o) => o.id !== order.id);
        if (typeof data?.refundedPipes === 'number') {
          userPipes += data.refundedPipes;
        } else {
          fetchPipes();
        }
        fetchShopItems();
      } else {
        refundError = data?.message || 'Refund failed';
      }
    } catch {
      refundError = 'Network error. Try again.';
    }
    refundingOrderId = null;
  }

  async function fetchFulfillmentUpdates() {
    fulfillmentLoading = true;
    try {
      const res = await fetch('/api/shop/fulfillment');
      if (res.ok) fulfillmentUpdates = await res.json();
    } catch { /* silent */ }
    fulfillmentLoading = false;
  }

  /* ────────────────  Buildlogs  ──────────────── */

  async function fetchBuildlogs() {
    buildlogsLoading = true;
    try {
      const res = await fetch('/api/buildlogs');
      if (res.ok) buildlogs = await res.json();
    } catch { /* silent */ }
    buildlogsLoading = false;
  }

  function handleBuildlogImage(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/gif', 'image/webp'].includes(file.type)) {
      buildlogError = 'Image must be a PNG, JPEG, GIF, or WebP';
      input.value = '';
      return;
    }
    const idx = buildlogPreviews.findIndex((p) => p === '');
    if (idx === -1) {
      buildlogError = `Up to ${BUILDLOG_MAX_IMAGES} images per buildlog`;
      input.value = '';
      return;
    }
    buildlogFiles[idx] = file;
    buildlogPreviews[idx] = URL.createObjectURL(file);
    buildlogError = '';
    input.value = '';
  }

  function removeBuildlogImage(idx: number) {
    buildlogFiles[idx] = null;
    buildlogPreviews[idx] = '';
    // Compact the arrays so newly added images fill from the start.
    buildlogFiles = [...buildlogFiles.filter((f) => f !== null), null, null, null, null].slice(0, BUILDLOG_MAX_IMAGES);
    buildlogPreviews = [...buildlogPreviews.filter((p) => p !== ''), '', '', '', ''].slice(0, BUILDLOG_MAX_IMAGES);
  }

  function resetBuildlogForm() {
    buildlogTitle = '';
    buildlogText = '';
    buildlogProjectId = '';
    buildlogFiles = [null, null, null, null];
    buildlogPreviews = ['', '', '', ''];
    buildlogError = '';
    buildlogLookoutSessionId = null;
    buildlogLookoutSessions = [];
  }

  async function submitBuildlog() {
    if (buildlogSubmitting) return;
    const trimmedTitle = buildlogTitle.trim();
    const trimmed = buildlogText.trim();
    if (!trimmedTitle) {
      buildlogError = 'Give your buildlog a short title';
      return;
    }
    if (!trimmed) {
      buildlogError = 'Write something for your buildlog first';
      return;
    }
    if (!buildlogProjectId) {
      buildlogError = 'Pick the project this buildlog is for';
      return;
    }
    buildlogSubmitting = true;
    buildlogError = '';
    try {
      const images: string[] = [];
      for (const file of buildlogFiles) {
        if (file) images.push(await fileToDataUri(file));
      }
      const res = await fetch('/api/buildlogs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: trimmedTitle,
          text: trimmed,
          projectId: buildlogProjectId,
          images,
          lookoutSessionId: buildlogLookoutSessionId ?? undefined,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        buildlogError = data?.message || 'Failed to post buildlog';
      } else {
        resetBuildlogForm();
        buildlogFormOpen = false;
        await fetchBuildlogs();
      }
    } catch {
      buildlogError = 'Network error. Try again.';
    }
    buildlogSubmitting = false;
  }

  async function deleteBuildlog(id: string) {
    if (!confirm('Delete this buildlog?')) return;
    try {
      const res = await fetch(`/api/buildlogs/${id}`, { method: 'DELETE' });
      if (res.ok) buildlogs = buildlogs.filter((d) => d.id !== id);
    } catch { /* silent */ }
  }

  function buildlogProjectName(id: string | null): string | null {
    if (!id) return null;
    const p = projects.find((p) => p.id === id);
    return p?.name ?? null;
  }

  async function markFulfillmentRead() {
    try {
      await fetch('/api/shop/fulfillment/read', { method: 'POST' });
      unreadCount = 0;
    } catch { /* silent */ }
  }

  async function fetchUnreadCount() {
    try {
      const res = await fetch('/api/shop/fulfillment/unread');
      if (res.ok) {
        const data = await res.json();
        unreadCount = data.count ?? 0;
      }
    } catch { /* silent */ }
  }

  async function saveNickname() {
    const val = nicknameInput.trim();
    if (!val || val === savedNickname) return;
    nicknameSaving = true;
    try {
      const res = await fetch('/api/auth/nickname', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nickname: val })
      });
      if (res.ok) {
        data.user.nickname = val;
        savedNickname = val;
        nicknameInput = val;
      }
    } catch { /* ignore */ }
    nicknameSaving = false;
  }

  // Puts the dashboard tokens on <html> too, so modals portalled to <body> get them.
  onMount(() => {
    document.documentElement.classList.add('lm-app');
    return () => document.documentElement.classList.remove('lm-app');
  });

  // Corner-block clock.
  let clock = $state('');

  // The user's Slack profile photo (falls back to initials).
  let avatarUrl = $state<string | null>(null);
  onMount(() => {
    fetch('/api/slack/avatar')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { avatarUrl = d?.url ?? null; })
      .catch(() => {});
  });

  onMount(() => {
    const tick = () => { clock = new Date().toLocaleString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit' }); };
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  });

  // Dock app tiles use the landing page's binder-tab colours, in nav order.
  const initials = (data.user.name ?? data.user.nickname ?? '?')
    .split(/\s+/).filter(Boolean).slice(0, 2).map((w: string) => w[0]).join('').toUpperCase();

  const fileName = (name: string) => `${name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')}.png`;

  const STATUS_LABEL: Record<string, string> = { approved: 'shipped', unreviewed: 'in review', fraud_pending: 'in review', changes_needed: 'changes needed', unshipped: 'draft' };

  // The landing page's handwritten note with a looped arrow.
  const ARROW = 'M2 21c9-13 21-15 25-7 3 7-7 11-9 4-2-8 15-14 39-8';
  const adminLabel = data.role === 'Super Admin' ? 'Admin' : data.role === 'Reviewer' || data.role === 'Fraud Reviewer' ? 'Review' : data.role === 'Fulfiller' ? 'Fulfillment' : null;

  onMount(() => {
    if (customCursorEnabled) {
      document.documentElement.classList.add('custom-cursor');
    } else {
      document.documentElement.classList.remove('custom-cursor');
    }

    fetchProjects();
    fetchHackatimeProjects();
    fetchAuditLog();
    fetchPipes();
    fetchUnreadCount();
    loadSectionData(activeSection);
    // Returning from the Lookout recorder? Re-open the buildlog draft we stashed.
    // Otherwise fall back to the locally autosaved draft (reload / window close).
    if (!restoreBuildlogDraft()) restoreBuildlogAutosave();

    const handlePopstate = () => {
      const section = sectionFromPath(window.location.pathname);
      if (creatingProject || editingProject || reviewProject) resetForm();
      activeSection = section;
      loadSectionData(section);
    };
    window.addEventListener('popstate', handlePopstate);
    return () => {
      window.removeEventListener('popstate', handlePopstate);
    };
  });
</script>

<svelte:head>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
  <link href="https://fonts.googleapis.com/css2?family=Inter:ital,wght@0,400;0,500;0,600;0,700;0,900;1,500&family=Permanent+Marker&family=Reenie+Beanie&display=swap" rel="stylesheet" />
</svelte:head>

<div class="home">
  <!-- The landing page's binder tabs, now the logged-in navigation. -->
  <nav class="tabs" aria-label="Home navigation">
    {#each navItems as item}
      <button class="tab" class:active={activeSection === item.id} onclick={() => navigate(item.id)}>
        {item.label.toLowerCase()}
        {#if item.id === 'dashboard' && unreadCount > 0}
          <span class="tab-badge" aria-label="{unreadCount} unread">{unreadCount}</span>
        {/if}
      </button>
    {/each}
    {#if adminLabel}
      <a class="tab tab-ink" href="/admin">{adminLabel.toLowerCase()}</a>
    {/if}
  </nav>

  <!-- Corner block: who and when, in tiny tracked caps beside a dotted rule. -->
  <div class="meta" aria-label="Your status">
    <a href="/" class="meta-brand">#{data.yswsConfig.program.name}</a>
    <span class="meta-who">
      {#if avatarUrl}<img class="meta-avatar" src={avatarUrl} alt="" onerror={() => (avatarUrl = null)} />{/if}
      {data.user.name ?? data.user.nickname ?? ''}
    </span>
    <span>{userPipes} {data.yswsConfig.currency.namePlural}</span>
    <span>{clock}</span>
  </div>

  <!-- Footer links, fixed, over a fade. -->
  <footer class="foot">
    <a href="https://hackclub.slack.com/app_redirect?channel=lifemaxx" target="_blank" rel="noopener noreferrer">slack</a>
    <a href="/api/auth/logout">log out</a>
  </footer>

  <!-- Main content -->
  <main class="main">

    {#if editingProject?.status === 'approved'}
    <!-- Approved project: read-only summary + resubmit form -->
    <section class="section section-resubmit">
      <div class="section-inner">
        <div class="approved-summary">
          <div class="win-bar sheet-bar" style="--pad: 20px"><span class="lights"><button type="button" class="light-close" aria-label="Close" title="Close" onclick={resetForm}></button><i></i><i></i></span></div>
          <div class="approved-summary-row">
            {#if editingProject.screenshot1Url}
              <img class="approved-summary-thumb" src={editingProject.screenshot1Url} alt="Screenshot" />
            {/if}
            <div class="approved-summary-info">
              <h3 class="approved-summary-title">{editingProject.name}</h3>
              <span class="project-status-badge approved">approved</span>
              <p class="approved-summary-desc">{editingProject.description}</p>
              <div class="approved-summary-meta">
                <span>{editingProject.projectType}</span>
                {#if editingProject.codeUrl}<a href={editingProject.codeUrl} target="_blank" rel="noopener">Code</a>{/if}
                {#if editingProject.demoUrl}<a href={editingProject.demoUrl} target="_blank" rel="noopener">Demo</a>{/if}
                {#if editingProject.readmeUrl}<a href={editingProject.readmeUrl} target="_blank" rel="noopener">README</a>{/if}
              </div>
            </div>
          </div>
        </div>

        {#if editingProjectReviews.length > 0}
          <div class="review-feedback-list">
            <h3 class="review-feedback-heading">Review history</h3>
            {#each editingProjectReviews as review}
              <div class="review-feedback-card review-feedback-{review.status}">
                <div class="review-feedback-header">
                  <span class="review-feedback-badge {review.status}">{review.status === 'changes_needed' ? 'Changes Needed' : 'Approved'}</span>
                  {#if review.hideReviewerName}
                    <span class="review-feedback-reviewer">by a reviewer</span>
                  {:else if review.reviewerName}
                    <span class="review-feedback-reviewer">by {review.reviewerName}</span>
                  {/if}
                  <span class="review-feedback-date">{formatLocal(review.createdAt, { year: 'numeric', month: 'short', day: 'numeric' })}</span>
                </div>
                {#if review.feedback}
                  <p class="review-feedback-text">{review.feedback}</p>
                {:else}
                  <p class="review-feedback-text review-feedback-empty">No feedback provided.</p>
                {/if}
              </div>
            {/each}
          </div>
        {/if}

        <div class="resubmit-section">
          <h2 class="section-title">Resubmit for Review</h2>
          <p class="section-subtitle">Ship an update to this approved project to earn more Pipes.</p>

          <div class="resubmit-form">
            <label class="resubmit-label" for="resubmit-desc">Describe changes made since last approval <span class="required">*</span></label>
            <textarea
              id="resubmit-desc"
              class="form-input form-textarea resubmit-textarea"
              maxlength={500}
              placeholder="What did you build or improve?"
              bind:value={resubmitChangeDesc}
            ></textarea>
            <div class="form-caption-row">
              <span class="form-caption">Be specific about what changed</span>
              <span class="form-charcount" class:over={resubmitChangeDesc.length >= 500}>{resubmitChangeDesc.length}/500</span>
            </div>

            <label class="review-check resubmit-check">
              <input type="checkbox" bind:checked={resubmitMinHours} />
              <span>I have worked for at least 3 hours since the last ship</span>
            </label>

            <label class="resubmit-label" for="resubmit-reviewer-note">Note to reviewer <span class="form-caption-inline">(optional)</span></label>
            <textarea
              id="resubmit-reviewer-note"
              class="form-input form-textarea resubmit-textarea"
              maxlength={1000}
              placeholder="Anything you'd like the reviewer to know? (context, caveats, where to start, etc.)"
              bind:value={resubmitReviewerNote}
            ></textarea>
            <div class="form-caption-row">
              <span class="form-caption">Visible only to reviewers</span>
              <span class="form-charcount" class:over={resubmitReviewerNote.length >= 1000}>{resubmitReviewerNote.length}/1000</span>
            </div>

            {#if formError}
              <p class="form-error">{formError}</p>
            {/if}

            <button
              class="form-btn-review resubmit-btn"
              class:ready={resubmitChangeDesc.trim() && resubmitMinHours}
              disabled={!resubmitChangeDesc.trim() || !resubmitMinHours || resubmitLoading}
              onclick={resubmitProject}
            >
              {resubmitLoading ? 'Resubmitting...' : 'Resubmit'}
            </button>
          </div>
        </div>
      </div>
    </section>
    {:else if creatingProject || editingProject}
    <div class="create-project-form">
      <div class="form-header">
        <h2 class="section-title">{editingProject ? 'Edit project' : 'New project'}</h2>
      </div>

      {#if editingProject?.status === 'unreviewed' && editingProjectPrecheck}
        <div class="precheck-card">
          <div class="precheck-header">
            <span class="precheck-badge">Automated pre-check</span>
            <span class="precheck-caption">Not a review &mdash; a human still looks at everything. Fix what you can now so you're not waiting on a round trip.</span>
          </div>
          {#if editingProjectPrecheck.summary}
            <p class="precheck-summary">{editingProjectPrecheck.summary}</p>
          {/if}
          {#if editingProjectPrecheck.checklist.length > 0}
            <ul class="precheck-checklist">
              {#each editingProjectPrecheck.checklist as item}
                <li class="precheck-item" class:pass={item.pass} class:fail={!item.pass}>
                  <span class="precheck-item-icon" aria-hidden="true">{item.pass ? '✓' : '✗'}</span>
                  <span>{item.label}</span>
                </li>
              {/each}
            </ul>
          {/if}
        </div>
      {/if}

      {#if editingProject && editingProjectReviews.length > 0}
        <div class="review-feedback-list">
          <h3 class="review-feedback-heading">
            {#if editingProject.status === 'changes_needed'}Reviewer requested changes{:else}Review history{/if}
          </h3>
          {#each editingProjectReviews as review}
            <div class="review-feedback-card review-feedback-{review.status}">
              <div class="review-feedback-header">
                <span class="review-feedback-badge {review.status}">{review.status === 'changes_needed' ? 'Changes Needed' : 'Approved'}</span>
                {#if review.hideReviewerName}
                  <span class="review-feedback-reviewer">by a reviewer</span>
                {:else if review.reviewerName}
                  <span class="review-feedback-reviewer">by {review.reviewerName}</span>
                {/if}
                <span class="review-feedback-date">{formatLocal(review.createdAt, { year: 'numeric', month: 'short', day: 'numeric' })}</span>
              </div>
              {#if review.feedback}
                <p class="review-feedback-text">{review.feedback}</p>
              {:else}
                <p class="review-feedback-text review-feedback-empty">No feedback provided.</p>
              {/if}
            </div>
          {/each}
        </div>
      {/if}

      <div class="form-grid">
        <div class="win-bar sheet-bar" style="--pad: 28px"><span class="lights"><button type="button" class="light-close" aria-label="Close" title="Close" onclick={resetForm}></button><i></i><i></i></span></div>
        <div class="form-group">
          <label class="form-label" for="project-name">Project Name <span class="required">*</span></label>
          <input id="project-name" type="text" class="form-input" maxlength={50} placeholder="My Awesome Project" bind:value={projectName} />
          <div class="form-caption-row">
            <span class="form-caption">Give your project a name</span>
            <span class="form-charcount" class:over={projectName.length >= 50}>{projectName.length}/50</span>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label" for="project-desc">Description <span class="required">*</span></label>
          <textarea id="project-desc" class="form-input form-textarea" maxlength={300} placeholder={"Project goal:\nMy tech stack:\nHow long it took:"} bind:value={projectDesc}></textarea>
          <div class="form-caption-row">
            <span class="form-caption">Describe your idea</span>
            <span class="form-charcount" class:over={projectDesc.length >= 300}>{projectDesc.length}/300</span>
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label" for="code-url">Code URL</label>
            <input id="code-url" type="url" class="form-input" placeholder="https://github.com/hackclub/" bind:value={codeUrl} oninput={(e) => autofillReadmeFromCode(e.currentTarget.value)} />
            <span class="form-caption">Link to your source code (GitHub, GitLab, etc)</span>
          </div>
          <div class="form-group">
            <label class="form-label" for="readme-url">README URL</label>
            <input id="readme-url" type="url" class="form-input" placeholder="https://github.com/hackclub/hackclub/blob/main/README.md" bind:value={readmeUrl} />
            <span class="form-caption">Link to your project's README file</span>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label" for="demo-url">Demo URL</label>
          <input id="demo-url" type="url" class="form-input" placeholder="https://hackclub.com" bind:value={demoUrl} />
          <span class="form-caption">Link to a live demo or playable version</span>
        </div>

        <div class="form-row form-row-top">
          <div class="form-group screenshot-group">
            <label class="form-label" for="screenshot">Screenshots</label>
            <label class="bl-folder shots-folder" class:full={screenshotCount >= 2} for={screenshotCount < 2 ? 'screenshot' : undefined} title={screenshotCount < 2 ? 'Add a screenshot' : 'Folder full'}>
              <svg class="bl-folder-back" viewBox="0 0 200 160" aria-hidden="true">
                <path fill="#2f9be3" d="M8 22c0-8 6-14 14-14h46c6 0 11 2 15 6l9 8h86c8 0 14 6 14 14v102c0 8-6 14-14 14H22c-8 0-14-6-14-14z" />
                {#if screenshotCount === 0}
                  <g class="bl-sheet">
                    <rect x="24" y="30" width="152" height="100" rx="5" fill="#fff" />
                    <text x="100" y="62" text-anchor="middle">add screenshots</text>
                    <text x="100" y="80" text-anchor="middle">of the thing</text>
                  </g>
                {/if}
              </svg>
              <span class="bl-pics">
                {#each screenshotPreviews as src, i (i)}
                  {#if src}
                    <span class="bl-pic" style="--i: {i}">
                      <img src={src} alt="Screenshot {i + 1}" />
                      <button type="button" class="bl-pic-remove" aria-label="Remove screenshot" onclick={(e) => { e.preventDefault(); e.stopPropagation(); removeScreenshot(i); }}>&times;</button>
                    </span>
                  {/if}
                {/each}
              </span>
              <svg class="bl-folder-front" viewBox="0 0 200 160" aria-hidden="true">
                <defs><linearGradient id="shot-fg" x2="0" y2="1"><stop stop-color="#7fd4ff" /><stop offset="1" stop-color="#3fb1f3" /></linearGradient></defs>
                <rect x="8" y="42" width="184" height="110" rx="13" fill="url(#shot-fg)" />
              </svg>
              {#if screenshotCount > 0}
                <span class="bl-badge">{screenshotCount}</span>
              {/if}
            </label>
            <input id="screenshot" type="file" accept="image/*" class="form-file-hidden" onchange={handleScreenshot} />
            <span class="form-caption">Upload up to 2 screenshots</span>
          </div>

          <div class="form-group ai-use-group">
            <!-- svelte-ignore a11y_label_has_associated_control -->
            <label class="form-label">AI Use</label>
            <!-- svelte-ignore a11y_label_has_associated_control -->
            <label class="form-checkbox ai-checkbox">
              <input type="checkbox" bind:checked={usedAi} />
              <span>Was this project made with AI? (Up to 30% is okay)</span>
            </label>
            <label class="form-label ai-sub-label" class:disabled-label={!usedAi} for="ai-use-desc">How did you use AI?</label>
            <textarea id="ai-use-desc" class="form-input form-textarea ai-textarea" class:disabled-field={!usedAi} maxlength={200} disabled={!usedAi} placeholder="I used AI to help with ideation by bouncing ideas around, I also used it to decide the architecture of the platform and fix bugs but most of the code is my original work." bind:value={aiUseDescription}></textarea>
            <div class="form-caption-row">
              <span class="form-caption" class:disabled-label={!usedAi}>Describe how AI was used in this project</span>
              <span class="form-charcount" class:disabled-label={!usedAi} class:over={aiUseDescription.length >= 200}>{aiUseDescription.length}/200</span>
            </div>
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label" for="project-type">Project Type <span class="required">*</span></label>
            <select id="project-type" class="form-input form-select" bind:value={projectType}>
              <option value="" disabled selected>Select a type</option>
              <option value="web">Web Playable</option>
              <option value="windows">Windows Playable</option>
              <option value="mac">Mac Playable</option>
              <option value="linux">Linux Playable</option>
              <option value="cross-platform">Cross Platform Compatible</option>
              <option value="python">Python</option>
              <option value="android">Android Playable</option>
              <option value="ios">iOS Playable</option>
              <option value="hardware">Hardware</option>
              <option value="cad">CAD Models</option>
              <option value="other">Other / Not Sure</option>
            </select>
          </div>
          <div class="form-group hackatime-group">
            <label class="form-label">Hackatime Project/s</label>
            <div class="hackatime-row">
              <div class="hackatime-select-wrap">
                <!-- svelte-ignore a11y_click_events_have_key_events -->
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <div class="hackatime-trigger" onclick={() => { hackatimeOpen = !hackatimeOpen; }}>
                  {#if hackatimeProject.length === 0}
                    <span class="hackatime-placeholder">Select projects</span>
                  {:else}
                    <span class="hackatime-selected">{hackatimeProject.join(', ')}</span>
                  {/if}
                </div>
                {#if hackatimeOpen}
                  <div class="hackatime-dropdown">
                    {#if hackatimeLoading}
                      <span class="hackatime-empty">Loading...</span>
                    {:else if hackatimeProjects.length === 0}
                      <span class="hackatime-empty">No projects found, connect Hackatime with the button on the right</span>
                    {:else}
                      {#each hackatimeProjects as proj}
                        <label class="hackatime-option">
                          <input type="checkbox" checked={hackatimeProject.includes(proj)} onchange={(e) => {
                            const target = e.target as HTMLInputElement;
                            if (target.checked) {
                              hackatimeProject = [...hackatimeProject, proj];
                            } else {
                              hackatimeProject = hackatimeProject.filter((p) => p !== proj);
                            }
                          }} />
                          <span>{proj}</span>
                        </label>
                      {/each}
                    {/if}
                  </div>
                {/if}
              </div>
              <form method="POST" action="/api/auth/hackatime/start" target="_blank" rel="noopener" class="refresh-form" onsubmit={() => { fetchHackatimeProjects(); setTimeout(fetchHackatimeProjects, 30000); }}>
                <button type="submit" class="refresh-btn" disabled={hackatimeLoading} title="Refresh & re-link Hackatime">
                  <svg class="refresh-icon" class:spinning={hackatimeLoading} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.3" />
                  </svg>
                </button>
              </form>
            </div>
          </div>
        </div>

        <div class="form-row">
          <label class="form-checkbox">
            <input type="checkbox" bind:checked={isUpdateProject} />
            <span class="noselect">This is an update to an existing project</span>
          </label>
        </div>

      </div>

      {#if formError}
        <p class="form-error">{formError}</p>
      {/if}

      <div class="form-bottom-row">
        {#if editingProject?.status === 'unreviewed'}
          <div class="in-review-notice">
            <p class="in-review-text">This project is currently in review. You can still work on it and track hours, but you can't resubmit until it's been reviewed.</p>
            {#if editingProjectQueue}
             
            {/if}
            <button class="form-btn-draft" onclick={() => convertToDraft(editingProject.id)}>
              Convert to Draft
            </button>
          </div>
        {:else if editingProject?.status === 'fraud_pending'}
          <!-- fraud_pending means a first-pass approval is awaiting the second-pass
               audit. That verdict isn't authoritative yet (it can be returned), so
               the copy must stay indistinguishable from a plain in-review state. -->
          <div class="in-review-notice">
            <p class="in-review-text">This project is currently in review. You'll be notified once the review is complete.</p>
          </div>
        {/if}
        <div class="form-actions">
          {#if editingProject && editingProject.status !== 'approved'}
            <button class="form-btn-delete" onclick={() => deleteProject(editingProject.id)}>Delete</button>
          {/if}
          <button class="form-btn-submit" disabled={!canSubmit || editingProject?.status === 'unreviewed'} onclick={submitProject}>
            {#if submitting}{editingProject ? 'Saving...' : 'Creating...'}{:else}{editingProject ? 'Save Changes' : 'Create Project'}{/if}
          </button>
          {#if editingProject && editingProject.status !== 'unreviewed'}
              <div class="submit-review-wrap">
                <button
                  class="form-btn-review"
                  class:ready={canSubmitForReview}
                  disabled={!canSubmitForReview}
                  onclick={submitForReview}
                >
                  Submit
                </button>
                {#if !canSubmitForReview}
                  <span class="review-tooltip">Fill out all sections before submitting</span>
                {/if}
              </div>
          {/if}
        </div>
      </div>

    </div>
    {/if}

    {#if showShippingPrompt && shippingCheck}
    <section class="section section-review">
      <div class="section-inner">
        <div class="win-bar sheet-bar" style="--pad: 28px"><span class="lights"><button type="button" class="light-close" aria-label="Close" title="Close" onclick={() => { showShippingPrompt = false; }}></button><i></i><i></i></span></div>
        <h2 class="section-title">Complete Your Profile</h2>
        <p class="shipping-prompt-text">Before submitting for review, we need a few things from your Hack Club Auth profile — we use these to verify you and to ship prizes when your project is approved:</p>
        <div class="shipping-prompt-items">
          {#if !shippingCheck.identityVerified}
            <div class="shipping-prompt-item missing">
              <span class="shipping-icon">&#x2717;</span>
              <span>Identity not verified</span>
            </div>
          {:else}
            <div class="shipping-prompt-item done">
              <span class="shipping-icon">&#x2713;</span>
              <span>Identity verified</span>
            </div>
          {/if}
          {#if !shippingCheck.hasAddress}
            <div class="shipping-prompt-item missing">
              <span class="shipping-icon">&#x2717;</span>
              <span>Shipping address not set</span>
            </div>
          {:else}
            <div class="shipping-prompt-item done">
              <span class="shipping-icon">&#x2713;</span>
              <span>Shipping address</span>
            </div>
          {/if}
          {#if !shippingCheck.hasBirthdate}
            <div class="shipping-prompt-item missing">
              <span class="shipping-icon">&#x2717;</span>
              <span>Birthdate not set</span>
            </div>
          {:else}
            <div class="shipping-prompt-item done">
              <span class="shipping-icon">&#x2713;</span>
              <span>Birthdate</span>
            </div>
          {/if}
        </div>
        {#if !shippingCheck.identityVerified}
          <a class="action-btn shipping-portal-btn" href={shippingCheck.identityPortalUrl} target="_blank" rel="noopener noreferrer">
            Verify your identity
          </a>
          {#if !identityPollExhausted}
            <p class="shipping-prompt-poll">Checking automatically — verification can take a few seconds to reflect after Hack Club approves your document.</p>
          {:else}
            <button class="action-btn shipping-recheck-btn" onclick={manualIdentityRecheck}>
              Check again
            </button>
            <p class="shipping-prompt-poll">We stopped checking automatically. Tap above once HQ approves your document.</p>
          {/if}
        {:else if shippingCheck.eligible}
          <p class="shipping-prompt-poll shipping-prompt-success">Identity verified! Click Submit again to ship.</p>
        {/if}
        {#if !shippingCheck.hasAddress || !shippingCheck.hasBirthdate}
          <a class="action-btn shipping-portal-btn" href={shippingCheck.addressPortalUrl} target="_blank" rel="noopener noreferrer">
            Update address &amp; birthdate
          </a>
          <p class="shipping-prompt-note">Address and birthdate changes require a log out / log back in to refresh.</p>
        {/if}
      </div>
    </section>
    {/if}

    {#if reviewProject}
    <section class="section section-review">
      <div class="section-inner">
        <div class="win-bar sheet-bar" style="--pad: 28px"><span class="lights"><button type="button" class="light-close" aria-label="Close" title="Close" onclick={resetForm}></button><i></i><i></i></span></div>
        <h2 class="section-title">Submit "{reviewProject.name}" for Review</h2>
        <div class="review-checklist">
          <label class="review-check">
            <input type="checkbox" bind:checked={checkOpenSource} />
            <span>My project is open source with a cloneable repository</span>
          </label>
          <label class="review-check">
            <input type="checkbox" bind:checked={checkDemoable} />
            <span>My project is demo-able (someone with no coding experience can use it)</span>
          </label>
          <label class="review-check">
            <input type="checkbox" bind:checked={checkReadme} />
            <span>My project has a ReadMe describing the features and tech stack, and how to contribute</span>
          </label>
          <label class="review-check">
            <input type="checkbox" bind:checked={checkHackatime} />
            <span>I have recorded my time with Hackatime as faithfully as possible, not inflating or manipulating hours using bots, scripts or hacks. I understand that purposeful cheating can result in a ban from all Hack Club programs</span>
          </label>
          <label class="review-check">
            <input type="checkbox" bind:checked={checkStartedOrUpdated} />
            <span>I started this project later than April 2nd, 2026, or shipped a significant update to an old project</span>
          </label>
        </div>

        <div class="reviewer-note-field">
          <label class="resubmit-label" for="reviewer-note">Note to reviewer <span class="form-caption-inline">(optional)</span></label>
          <textarea
            id="reviewer-note"
            class="form-input form-textarea resubmit-textarea"
            maxlength={1000}
            placeholder="Anything you'd like the reviewer to know? (context, caveats, where to start, etc.)"
            bind:value={reviewerNote}
          ></textarea>
          <div class="form-caption-row">
            <span class="form-caption">Visible only to reviewers</span>
            <span class="form-charcount" class:over={reviewerNote.length >= 1000}>{reviewerNote.length}/1000</span>
          </div>
        </div>

        {#if formError}
          <p class="form-error">{formError}</p>
        {/if}
        <button class="action-btn review-submit-btn" disabled={!canConfirmReview} onclick={confirmReview}>
          {#if submitting}Submitting...{:else}Submit for Review{/if}
        </button>
      </div>
    </section>
    {/if}

    {#if reviewSubmitted}
    <section class="section section-review">
      <div class="section-inner review-success">
        <h2 class="section-title">"{reviewSubmittedName}" Submitted!</h2>
        <p class="review-note">Review means a human is looking over your project and checking that the code is functional, not AI generated and that the demo works. It could take around a week (hopefully less) for us to get around to your project, at which point we will offer feedback or approve your time spent. In rare cases where we believe you have unintentionally exaggerated your hours, we may approve a percentage of your hours.</p>
        <button class="action-btn review-understood-btn" onclick={resetForm}>
          Understood
        </button>
      </div>
    </section>
    {/if}

    {#if !creatingProject && !editingProject && !reviewProject && activeSection === 'dashboard'}
    <section class="section section-dashboard">
      <div class="column">
        <h2 class="page-title">your <span class="hero-cut"><img src="/images/cutouts/macbook.webp" alt="" /><span class="hero-cap">work_in_progress.png</span></span>projects:</h2>

        <dl class="stats">
          <div><dt>{data.yswsConfig.currency.namePlural}</dt><dd>{userPipes}</dd></div>
          <div><dt>shipped</dt><dd>{projects.filter((p) => p.status === 'approved').length}</dd></div>
          <div><dt>in review</dt><dd>{projects.filter((p) => p.status === 'unreviewed' || p.status === 'fraud_pending').length}</dd></div>
          <div><dt>buildlogs</dt><dd>{buildlogs.length}</dd></div>
        </dl>

        <!-- The plan: one line through every project, solid where you've shipped. -->
        {#if projects.length > 0}
        <ol class="plan">
          {#each projects as project}
            {@const logs = buildlogs.filter((b) => b.projectId === project.id).slice(0, 3)}
            {@const hasPhoto = !!(project.screenshot1Url || catImages[project.id])}
            <li class="stop" class:shipped={project.status === 'approved'} class:no-photo={!hasPhoto}>
              <button class="stop-body project-card status-{project.status}" onclick={() => openEditProject(project)}>
                {#if hasPhoto}
                  <span class="fan" aria-hidden="true">
                    {#if project.screenshot2Url}<img class="fan-back" src={project.screenshot2Url} alt="" />{/if}
                    {#if project.screenshot1Url}
                      <img src={project.screenshot1Url} alt="" />
                    {:else}
                      <img class="fan-cat" src={catImages[project.id]} alt="" />
                    {/if}
                  </span>
                {/if}
                <span class="stop-title">
                  <span class="stop-name">{project.name}</span>
                  <em class="flag flag-{project.status}">{STATUS_LABEL[project.status] ?? project.status}</em>
                  {#if project.isGolden}<em class="flag flag-golden">golden</em>{/if}
                </span>
                <span class="stop-desc">{project.description}</span>
              </button>
              {#each logs as dl}
                <div class="sub">
                  <span class="sub-title">{dl.title}</span>
                  <time class="sub-time">{timeAgo(dl.createdAt)}</time>
                </div>
              {/each}
            </li>
          {/each}
        </ol>
        {/if}

        <div class="stop-actions">
          <button class="action-btn new-project-btn" onclick={openCreateProject}>+ new project</button>
          {#if projects.length === 0}
            <span class="hand note-empty">
              start here.<br />anything that fixes your life counts.
              <svg class="arr" viewBox="0 0 64 30" aria-hidden="true"><path d={ARROW} /><path d="M49 3l10 7-10 7" /></svg>
            </span>
          {/if}
        </div>

        <h3 class="list-title">activity</h3>
        {#if auditLog.length === 0}
          <p class="timeline-empty">nothing yet. suspiciously quiet.</p>
        {:else}
          <ul class="rows">
            {#each auditLog.slice(0, 6) as entry}
              <li><span>{entry.label}</span><time>{timeAgo(entry.createdAt)}</time></li>
            {/each}
          </ul>
        {/if}

        <h3 class="list-title">from hq</h3>
        {#if fulfillmentLoading}
          <p class="fulfillment-empty">loading…</p>
        {:else if fulfillmentUpdates.length === 0}
          <div class="imessage" aria-label="no updates yet. order something from the shop.">
            <p class="imsg">no updates yet.</p>
            <p class="imsg imsg-tail">order something from the shop.</p>
          </div>
        {:else}
          <ul class="rows">
            {#each fulfillmentUpdates as update}
              <li class:unread={!update.isRead}>
                <span><b>{update.itemName}</b> {update.message}</span>
                <time>{new Date(update.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</time>
              </li>
            {/each}
          </ul>
        {/if}
      </div>
    </section>
    {/if}

    {#if activeSection === 'shop'}
    <section class="section section-shop">
      <div class="column column-wide">
        <h2 class="page-title">earn prizes:</h2>
        <p class="two-tone">1 approved hour = 1 {data.yswsConfig.currency.nameSingular.replace(/s$/, '')}.<span>you have {userPipes}.</span></p>
        <p class="shop-suggest"><a class="text-link" href="https://hackclub.slack.com/app_redirect?channel=lifemaxx" target="_blank" rel="noopener noreferrer">suggest something ↗</a></p>

        {#snippet shopCard(item: ShopItemType, variant: 'default' | 'featured' | 'bm')}
          <button
            class="shop-card"
            class:shop-card-featured={variant === 'featured'}
            class:shop-card-bm={variant === 'bm'}
            onclick={() => openShopItem(item)}
            type="button"
          >
            <span class="shop-card-img">
              <img src={item.imageUrl} alt={item.name} loading="lazy" decoding="async" />
              {#if variant === 'bm' && !blackMarketUnlocked}
                <span class="shop-bm-lock" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="lock-icon-lg"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                </span>
              {/if}
            </span>
            <span class="shop-card-caption">{fileName(item.name)}</span>
            <span class="shop-card-price">
              {item.priceHours} {currencyLabel(item.priceHours)}
              {#if item.stock !== null}
                <span class="shop-card-stock" class:low={item.stock <= 3}>· {item.stock} left</span>
              {/if}
            </span>
          </button>
        {/snippet}

        {#if shopLoading}
          <div class="shop-grid">
            {#each Array(6) as _}
              <div class="shop-card-skeleton">
                <div class="skeleton-img"></div>
                <div class="skeleton-line wide"></div>
              </div>
            {/each}
          </div>
        {:else if shopItems.length === 0}
          <p class="empty-text shop-empty">the shelves are empty. check back soon.</p>
        {:else}
          {#if spotlightItem}
            <button class="shop-spotlight" type="button" onclick={() => spotlightItem && openShopItem(spotlightItem)}>
              <span class="shop-spotlight-img"><img src={spotlightItem.imageUrl} alt={spotlightItem.name} /></span>
              <span class="shop-spotlight-body">
                <span class="shop-spotlight-kicker">spotlight</span>
                <span class="shop-spotlight-name">{spotlightItem.name}</span>
                <span class="shop-spotlight-desc">{spotlightItem.description}</span>
                <span class="shop-card-price">{spotlightItem.priceHours} {currencyLabel(spotlightItem.priceHours)}</span>
              </span>
            </button>
          {/if}
          {#if featuredItems.length > 0}
            <h3 class="list-title">featured</h3>
            <div class="shop-grid">
              {#each featuredItems as item}
                {@render shopCard(item, 'featured')}
              {/each}
            </div>
          {/if}
          {#if regularItems.length > 0}
            {#if spotlightItem || featuredItems.length > 0}
              <h3 class="list-title">everything</h3>
            {/if}
            <div class="shop-grid">
              {#each regularItems as item}
                {@render shopCard(item, 'default')}
              {/each}
            </div>
          {/if}
          {#if blackMarketItems.length > 0}
            <div class="shop-bm-section" class:locked={!blackMarketUnlocked}>
              <h3 class="list-title shop-bm-title">black market</h3>
              <p class="shop-bm-note">
                {#if blackMarketUnlocked}
                  You shipped a golden project. These are yours to browse.
                {:else}
                  Locked. Ship a project so good the reviewers mark it <strong>golden</strong> to shop here.
                {/if}
              </p>
              <div class="shop-grid">
                {#each blackMarketItems as item}
                  {@render shopCard(item, 'bm')}
                {/each}
              </div>
            </div>
          {/if}
        {/if}

        <!-- Orders: a receipt printing out of a little thermal printer. -->
        <h3 class="list-title">your orders</h3>
        <div class="printer-stage">
          <div class="my-orders receipt">
            <p class="receipt-head">{data.yswsConfig.program.name} mart</p>
            <p class="receipt-sub">{new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} · thanks for locking in</p>
            {#if userOrdersLoading && userOrders.length === 0}
              <p class="my-orders-empty">printing…</p>
            {:else if userOrders.length === 0}
              <p class="my-orders-empty">no orders yet. the printer is bored.</p>
            {:else}
              {#if refundError}
                <p class="my-orders-error">{refundError}</p>
              {/if}
              <ul class="my-orders-list">
                {#each userOrders as order}
                  <li class="my-orders-row">
                    <span class="my-orders-info">
                      <span class="my-orders-name">{order.quantity}× {order.itemName}</span>
                      <span class="my-orders-meta">{new Date(order.createdAt).toLocaleDateString()}</span>
                    </span>
                    <span class="my-orders-price">{order.pipesSpent}</span>
                    <span class="my-orders-actions">
                      {#if order.status === 'pending'}
                        <span class="my-orders-status pending">pending</span>
                        <button
                          class="my-orders-refund"
                          type="button"
                          onclick={() => refundOrder(order)}
                          disabled={refundingOrderId === order.id}
                        >
                          {refundingOrderId === order.id ? 'refunding…' : 'refund'}
                        </button>
                      {:else if order.status === 'cancelled'}
                        <span class="my-orders-status cancelled">cancelled</span>
                      {:else}
                        <span class="my-orders-status fulfilled">fulfilled</span>
                      {/if}
                    </span>
                  </li>
                {/each}
              </ul>
              <p class="receipt-total">
                <span>total spent</span>
                <span>{userOrders.reduce((sum, o) => sum + (o.status === 'cancelled' ? 0 : o.pipesSpent), 0)} {data.yswsConfig.currency.namePlural}</span>
              </p>
            {/if}
            <span class="receipt-bars" aria-hidden="true"></span>
          </div>
          <div class="printer" aria-hidden="true">
            <span class="printer-panel"><i></i><i></i><b></b><em></em></span>
            <span class="printer-slot"></span>
          </div>
        </div>
      </div>
    </section>

    <!-- Fullscreen shop item modal -->
    {#if selectedShopItem}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div use:portal class="shop-modal-overlay" onclick={closeShopItem} onkeydown={(e) => { if (e.key === 'Escape') closeShopItem(); }}>
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div class="shop-modal" onclick={(e) => e.stopPropagation()}>
        <button class="shop-modal-close" onclick={closeShopItem} type="button" aria-label="Close">&times;</button>
        <div class="shop-modal-content">
          <div class="shop-modal-img">
            <img src={selectedShopItem.imageUrl} alt={selectedShopItem.name} />
          </div>
          <div class="shop-modal-details">
            <h2 class="shop-modal-name">{selectedShopItem.name}</h2>
            <p class="shop-modal-desc">{selectedShopItem.description}</p>
            {#if selectedShopItem.detailedDescription}
              <p class="shop-modal-detailed-desc">{selectedShopItem.detailedDescription}</p>
            {/if}

            <div class="shop-modal-price-row">
              <span class="shop-modal-price">{selectedShopItem.priceHours} {currencyLabel(selectedShopItem.priceHours)}</span>
              {#if selectedShopItem.stock !== null}
                <span class="shop-modal-stock" class:low={selectedShopItem.stock <= 3}>{selectedShopItem.stock} in stock</span>
              {:else}
                <span class="shop-modal-stock unlimited">Unlimited</span>
              {/if}
            </div>

            {#if selectedShopItem.estimatedShip}
              <div class="shop-modal-ship">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="ship-icon"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
                <span>{selectedShopItem.estimatedShip}</span>
              </div>
            {/if}

            <div class="shop-modal-qty">
              <span class="shop-modal-qty-label">Quantity</span>
              <div class="shop-modal-qty-controls">
                <input
                  class="qty-input"
                  type="text"
                  inputmode="numeric"
                  pattern="[0-9]*"
                  value={shopQuantityText}
                  oninput={(e) => {
                    setShopQuantity(e.currentTarget.value);
                    e.currentTarget.value = shopQuantityText;
                  }}
                  onblur={commitShopQuantity}
                  aria-label="Quantity"
                />
              </div>
            </div>

            <div class="shop-modal-total">
              <span>Total:</span>
              <span class="shop-modal-total-value">{selectedShopItem.priceHours * shopQuantity} {currencyLabel(selectedShopItem.priceHours * shopQuantity)}</span>
            </div>

            {#if selectedShopItem.isBlackMarket && !blackMarketUnlocked}
              <div class="shop-modal-cant-afford shop-modal-bm-locked">
                <p class="shop-modal-bm-head">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="lock-icon"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                  <span>This is a <strong>black market</strong> item.</span>
                </p>
                <p class="shop-modal-keep-building">Ship a project impressive enough to be marked golden by a reviewer to unlock it.</p>
              </div>
            {:else if purchaseSuccess}
              <div class="shop-modal-success">{purchaseSuccess}</div>
            {:else if userPipes >= selectedShopItem.priceHours * shopQuantity}
              <button class="shop-modal-buy" type="button" onclick={openNotePrompt} disabled={purchaseLoading}>
                <span class="buy-text">{purchaseLoading ? 'Ordering...' : 'Redeem'}</span>
              </button>
              {#if purchaseError}
                <p class="shop-modal-error">{purchaseError}</p>
              {/if}
            {:else}
              <div class="shop-modal-cant-afford">
                <p>You need <strong>{(selectedShopItem.priceHours * shopQuantity) - userPipes}</strong> more {currencyLabel((selectedShopItem.priceHours * shopQuantity) - userPipes)} to redeem this.</p>
                <p class="shop-modal-keep-building">Keep building!</p>
              </div>
            {/if}
          </div>
        </div>
      </div>
    </div>
    {/if}

    <!-- Order note popup: ask the buyer for a note to the fulfillers -->
    {#if notePromptOpen && selectedShopItem}
    <!-- svelte-ignore a11y_no_static_element_interactions a11y_click_events_have_key_events -->
    <div use:portal class="order-note-overlay" onclick={() => { if (!purchaseLoading) notePromptOpen = false; }} onkeydown={(e) => { if (e.key === 'Escape' && !purchaseLoading) notePromptOpen = false; }}>
      <div class="order-note-modal" role="dialog" aria-modal="true" aria-label="Order note" onclick={(e) => e.stopPropagation()}>
        <h3 class="order-note-title">Anything for the fulfillers?</h3>
        <p class="order-note-hint">Optional — size, colour, or any special instructions for your {selectedShopItem.name}.</p>
        <textarea
          class="order-note-input"
          maxlength="500"
          rows="4"
          bind:value={orderNote}
          placeholder="e.g. Size L, ship to dorm mailroom"
        ></textarea>
        <div class="order-note-count">{orderNote.length}/500</div>
        {#if purchaseError}
          <p class="shop-modal-error">{purchaseError}</p>
        {/if}
        <div class="order-note-actions">
          <button type="button" class="order-note-cancel" onclick={() => notePromptOpen = false} disabled={purchaseLoading}>Cancel</button>
          <button type="button" class="order-note-confirm" onclick={purchaseItem} disabled={purchaseLoading}>
            {purchaseLoading ? 'Ordering…' : 'Place order'}
          </button>
        </div>
      </div>
    </div>
    {/if}

    {/if}

    {#if activeSection === 'explore'}
    <section class="section section-explore">
      <div class="section-inner">
        <h2 class="section-title">Explore</h2>
        <p class="section-subtitle">Discover what others are building, get inspiration!</p>
        {#if exploreLoading}
          <div class="explore-placeholder">
            <div class="explore-grid">
              {#each Array(6) as _}
                <div class="explore-card-skeleton">
                  <div class="skeleton-img"></div>
                  <div class="skeleton-line wide"></div>
                  <div class="skeleton-line narrow"></div>
                </div>
              {/each}
            </div>
          </div>
        {:else if exploreProjects.length === 0}
          <p class="coming-soon">Awaiting the first projects...</p>
        {:else}
          <div class="explore-grid explore-grid-live">
            {#each exploreProjects as ep}
              <!-- svelte-ignore a11y_no_static_element_interactions a11y_click_events_have_key_events -->
              <div class="explore-card" onclick={() => openProjectDetail(ep.id)} role="button" tabindex="0" onkeydown={(e) => { if (e.key === 'Enter') openProjectDetail(ep.id); }}>
                {#if ep.screenshot1Url || ep.screenshot2Url}
                  <div class="explore-img-wrap">
                    <img class="explore-img" src={(cardImgIdx[ep.id] ?? 0) === 0 ? (ep.screenshot1Url ?? ep.screenshot2Url) : ep.screenshot2Url} alt="{ep.name}" />
                    {#if ep.screenshot1Url && ep.screenshot2Url}
                      <button
                        class="explore-arrow explore-arrow-left"
                        type="button"
                        onclick={(e) => { e.stopPropagation(); cardImgIdx = { ...cardImgIdx, [ep.id]: 0 }; }}
                        aria-label="Previous screenshot"
                      >&#8249;</button>
                      <button
                        class="explore-arrow explore-arrow-right"
                        type="button"
                        onclick={(e) => { e.stopPropagation(); cardImgIdx = { ...cardImgIdx, [ep.id]: 1 }; }}
                        aria-label="Next screenshot"
                      >&#8250;</button>
                      <div class="explore-dots">
                        <span class="explore-dot" class:explore-dot-active={(cardImgIdx[ep.id] ?? 0) === 0}></span>
                        <span class="explore-dot" class:explore-dot-active={(cardImgIdx[ep.id] ?? 0) === 1}></span>
                      </div>
                    {/if}
                  </div>
                {/if}
                <div class="explore-card-body">
                  <div class="explore-card-header">
                    <h3 class="explore-card-name">{ep.name}</h3>
                    <span class="explore-card-type">{ep.projectType}</span>
                  </div>
                  <p class="explore-card-desc">{ep.description}</p>
                  <div class="explore-card-meta">
                    <span class="explore-card-builder">by {ep.builderName}</span>
                    {#if ep.hours > 0}
                      <span class="explore-card-hours">{ep.hours.toFixed(1)}h</span>
                    {/if}
                  </div>
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </div>
    </section>
    {/if}

    {#if activeSection === 'buildlogs'}
    <section class="section section-buildlogs">
      <div class="section-inner">
        <h2 class="section-title">Buildlogs</h2>
        <p class="buildlogs-blurb">Buildlogs are <strong>mandatory for hardware projects</strong> and optional for software.</p>

        {#if !buildlogFormVisible}
          <button class="action-btn buildlog-new-btn" onclick={() => { buildlogFormOpen = true; }}>+ New buildlog</button>
        {/if}

        {#if buildlogFormVisible}
        <div class="win buildlog-win">
        <div class="win-bar">
          <span class="lights">
            {#if buildlogs.length > 0}
              <button type="button" class="light-close" title="Cancel" aria-label="Cancel" onclick={() => { buildlogFormOpen = false; resetBuildlogForm(); }}></button>
            {:else}
              <i></i>
            {/if}
            <i></i><i></i>
          </span>
        </div>
        <div class="buildlog-create">
          <div class="buildlog-form">
            <div class="buildlog-field">
              <label class="form-label" for="buildlog-project">Project <span class="required">*</span></label>
              <select id="buildlog-project" class="form-input form-select buildlog-select" bind:value={buildlogProjectId}>
                <option value="" disabled>{projects.length === 0 ? 'Create a project first' : 'Select a project to link this buildlog to'}</option>
                {#each projects as p}
                  <option value={p.id}>{p.name}</option>
                {/each}
              </select>
            </div>

            <div class="buildlog-field">
              <label class="form-label" for="buildlog-title">Title <span class="required">*</span></label>
              <input
                id="buildlog-title"
                type="text"
                class="form-input buildlog-input"
                maxlength={BUILDLOG_TITLE_MAX}
                bind:value={buildlogTitle}
              />
              <div class="form-caption-row">
                <span class="form-charcount" class:over={buildlogTitle.length >= BUILDLOG_TITLE_MAX}>{buildlogTitle.length}/{BUILDLOG_TITLE_MAX}</span>
              </div>
            </div>

            <div class="buildlog-field">
              <label class="form-label" for="buildlog-text">What did you work on?</label>
              <textarea
                id="buildlog-text"
                class="form-input form-textarea buildlog-textarea"
                maxlength={BUILDLOG_TEXT_MAX}
                bind:value={buildlogText}
              ></textarea>
              <div class="form-caption-row">
                <span class="form-charcount" class:over={buildlogText.length >= BUILDLOG_TEXT_MAX}>{buildlogText.length}/{BUILDLOG_TEXT_MAX}</span>
              </div>
            </div>

            <div class="buildlog-field">
              <span class="form-label">Timelapse (Lookout) <span class="optional">optional</span></span>
              <div class="lookout-block">
                {#if buildlogLookoutSessionsLoading}
                  <span class="lookout-hint">Checking for saved Lookout sessions…</span>
                {:else if buildlogLookoutSessions.length > 0}
                  <button type="button" class="lookout-choose-btn" onclick={() => lookoutPickerOpen = true}>
                    <span>{selectedLookoutLabel()}</span>
                    <span class="lookout-choose-caret" aria-hidden="true">▾</span>
                  </button>
                {/if}
                {#if buildlogLookoutSessionId}
                  <span class="lookout-attached">Recording attached — finish in the Lookout app; it'll appear on this buildlog once it's done.</span>
                {:else}
                  <span class="lookout-hint">Opens the Lookout desktop app to record. <a href="https://lookout.hackclub.com" target="_blank" rel="noopener">Don't have it?</a></span>
                {/if}
              </div>
            </div>
            {#if buildlogError}
              <p class="form-error">{buildlogError}</p>
            {/if}

            <div class="buildlog-actions">
              <button class="btn-primary buildlog-submit" onclick={submitBuildlog} disabled={buildlogSubmitting || !buildlogTitle.trim() || !buildlogText.trim() || !buildlogProjectId}>
                {buildlogSubmitting ? 'Posting…' : 'Post buildlog'}
              </button>
              <button
                type="button"
                class="buildlog-submit lookout-record-btn"
                disabled={buildlogLookoutBusy || !buildlogProjectId}
                onclick={startBuildlogRecording}
              >
                {buildlogLookoutBusy ? 'Opening Lookout…' : 'Record a timelapse'}
              </button>
            </div>
          </div>

          <aside class="buildlog-images-card" aria-label="Buildlog images">
            <span class="form-label buildlog-images-label">Images</span>
            <label class="bl-folder" class:full={buildlogImageCount >= BUILDLOG_MAX_IMAGES} for={buildlogImageCount < BUILDLOG_MAX_IMAGES ? 'buildlog-image' : undefined} title={buildlogImageCount < BUILDLOG_MAX_IMAGES ? 'Add an image' : 'Folder full'}>
              <svg class="bl-folder-back" viewBox="0 0 200 160" aria-hidden="true">
                <path fill="#2f9be3" d="M8 22c0-8 6-14 14-14h46c6 0 11 2 15 6l9 8h86c8 0 14 6 14 14v102c0 8-6 14-14 14H22c-8 0-14-6-14-14z" />
                {#if buildlogImageCount === 0}
                  <g class="bl-sheet">
                    <rect x="24" y="30" width="152" height="100" rx="5" fill="#fff" />
                    <text x="100" y="62" text-anchor="middle">add pics</text>
                    <text x="100" y="80" text-anchor="middle">of the build</text>
                  </g>
                {/if}
              </svg>
              <span class="bl-pics">
                {#each buildlogPreviews as src, i (i)}
                  {#if src}
                    <span class="bl-pic" style="--i: {i}">
                      <img src={src} alt="Attachment {i + 1}" />
                      <button type="button" class="bl-pic-remove" aria-label="Remove image" onclick={(e) => { e.preventDefault(); e.stopPropagation(); removeBuildlogImage(i); }}>&times;</button>
                    </span>
                  {/if}
                {/each}
              </span>
              <svg class="bl-folder-front" viewBox="0 0 200 160" aria-hidden="true">
                <defs><linearGradient id="bl-fg" x2="0" y2="1"><stop stop-color="#7fd4ff" /><stop offset="1" stop-color="#3fb1f3" /></linearGradient></defs>
                <rect x="8" y="42" width="184" height="110" rx="13" fill="url(#bl-fg)" />
              </svg>
              {#if buildlogImageCount > 0}
                <span class="bl-badge">{buildlogImageCount}</span>
              {/if}
            </label>
            <span class="bl-folder-cap">build_pics</span>
            <input id="buildlog-image" type="file" accept="image/*" class="form-file-hidden" onchange={handleBuildlogImage} />
            <p class="buildlog-images-hint">Up to {BUILDLOG_MAX_IMAGES} images, 8 MB each.</p>
          </aside>
        </div>
        </div>
        {/if}
        {#if buildlogs.length > 0 || buildlogsLoading}
        <div class="win notes-win">
        <div class="win-bar">
          <span class="lights" aria-hidden="true"><i></i><i></i><i></i></span>
          <span class="win-title">All buildlogs</span>
          <span class="win-count">{buildlogs.length} {buildlogs.length === 1 ? 'note' : 'notes'}</span>
        </div>
        <div class="buildlogs-list">
          {#if buildlogsLoading && buildlogs.length === 0}
            <p class="buildlog-empty">Loading…</p>
          {:else if buildlogs.length > 0}
            {#each buildlogs as dl (dl.id)}
              <article class="buildlog-card">
                <header class="buildlog-card-header">
                  <span class="buildlog-card-project"><span class="tag tag-unreviewed" aria-hidden="true"></span>{buildlogProjectName(dl.projectId) ?? 'Project removed'}</span>
                  <span class="buildlog-card-time">{formatLocal(dl.createdAt)}</span>
                  <button class="buildlog-card-delete" onclick={() => deleteBuildlog(dl.id)} title="Delete buildlog">×</button>
                </header>
                <h3 class="buildlog-card-title">{dl.title}</h3>
                <p class="buildlog-card-text">{dl.text}</p>
                {#if dl.imageUrls && dl.imageUrls.length > 0}
                  <div class="buildlog-card-images">
                    {#each dl.imageUrls as url}
                      <button type="button" class="buildlog-card-image-btn" onclick={() => openBuildlogLightbox(url)}>
                        <img src={url} alt="Buildlog attachment" loading="lazy" />
                      </button>
                    {/each}
                  </div>
                {/if}
                {#if dl.lookout}
                  <div class="buildlog-card-lookout">
                    {#if dl.lookout.status === 'complete' && dl.lookout.videoUrl}
                      <details class="lookout-dropdown">
                        <summary class="lookout-summary">
                        <span class="lookout-status">{dl.lookout.status}</span>
                          {#if dl.lookout.trackedSeconds}
                            <span class="lookout-tracked"> · {fmtTrackedShort(dl.lookout.trackedSeconds)}</span>
                          {/if}
                          <span class="lookout-summary-action">See Timelapse</span>
                        </summary>
                        <video controls preload="metadata" poster={dl.lookout.thumbnailUrl ?? undefined} src={dl.lookout.videoUrl}>
                          <track kind="captions" />
                        </video>
                      </details>
                    {:else}
                      <span class="lookout-status">{dl.lookout.status}</span>
                      {#if dl.lookout.trackedSeconds}
                        <span class="lookout-tracked"> · {fmtTrackedShort(dl.lookout.trackedSeconds)}</span>
                      {/if}
                    {/if}
                  </div>
                {/if}
              </article>
            {/each}
          {/if}
        </div>
        </div>
        {/if}
      </div>
    </section>
    {/if}

    {#if activeSection === 'me'}
    <section class="section section-settings">
      <div class="section-inner">
        <h2 class="section-title settings-title">Me</h2>
        <div class="win settings-win">
          <div class="win-bar">
            <span class="lights" aria-hidden="true"><i></i><i></i><i></i></span>
            <span class="win-title">System Settings</span>
          </div>
          <div class="settings-split">
            <aside class="settings-side">
              <div class="me-card">
                <span class="me-avatar" aria-hidden="true">{#if avatarUrl}<img src={avatarUrl} alt="" onerror={() => (avatarUrl = null)} />{:else}{initials}{/if}</span>
                <span class="me-card-text">
                  <b>{data.user.name ?? data.user.nickname ?? 'You'}</b>
                  <small>Hack Club Account</small>
                </span>
              </div>
              <nav class="settings-links" aria-label="Links">
                <a href="https://email-tools.hackclub.com/" target="_blank" rel="noopener" class="settings-link">
                  <h3 class="settings-link-title">Email Preferences</h3>
                  <p class="settings-link-desc">Manage your Hack Club email subscriptions and notifications.</p>
                </a>
                <a href="https://hackclub.com/privacy-and-terms/" target="_blank" rel="noopener" class="settings-link">
                  <h3 class="settings-link-title">Privacy &amp; Terms</h3>
                  <p class="settings-link-desc">Read our privacy policy and terms of service.</p>
                </a>
                <a href="https://hackclub.com/safeguarding-policy/" target="_blank" rel="noopener" class="settings-link">
                  <h3 class="settings-link-title">Safeguarding Policy</h3>
                  <p class="settings-link-desc">How we keep our community safe.</p>
                </a>
                <a href="https://hackclub.slack.com/app_redirect?channel=lifemaxx" target="_blank" rel="noopener" class="settings-link">
                  <h3 class="settings-link-title">Get Help</h3>
                  <p class="settings-link-desc">Ask questions in the {data.yswsConfig.program.name} Slack channel.</p>
                </a>
                <div class="settings-link">
                  <h3 class="settings-link-title">Security Bounty</h3>
                  <p class="settings-link-desc">{data.yswsConfig.program.name} is participating in a security bounty. You can submit proven vulnerabilities for reward <a href="https://security.hackclub.com/" target="_blank" rel="noopener">here</a>.</p>
                </div>
                <a href="/api/auth/logout" class="settings-link settings-link-logout">
                  <h3 class="settings-link-title">Log Out</h3>
                  <p class="settings-link-desc">Sign out of your account.</p>
                </a>
              </nav>
              </aside>
            <div class="settings-main">
              <h3 class="settings-group-title">Account</h3>
              <div class="settings-group account-fields">
                <div class="account-field">
                  <span class="account-label">Name</span>
                  <span class="account-value">{data.user.name ?? '—'}</span>
                </div>
                <div class="account-field">
                  <span class="account-label">Nickname</span>
                  <form class="nickname-form" onsubmit={(e) => { e.preventDefault(); saveNickname(); }}>
                    <input
                      type="text"
                      class="nickname-input"
                      maxlength="50"
                      bind:value={nicknameInput}
                    />
                    {#if nicknameInput.trim() && nicknameInput.trim() !== savedNickname}
                      <button type="submit" class="nickname-save" disabled={nicknameSaving}>
                        {nicknameSaving ? '...' : 'Save'}
                      </button>
                    {/if}
                  </form>
                </div>
                <div class="account-field">
                  <span class="account-label">Email</span>
                  <span class="account-value">{data.user.email ?? '—'}</span>
                </div>
                <div class="account-field">
                  <span class="account-label">Slack ID</span>
                  <span class="account-value">
                    {#if data.user.slack_id}
                      <a href={slackUserUrl(data.user.slack_id)} target="_blank" rel="noopener noreferrer" class="account-link">{data.user.slack_id}</a>
                    {:else}
                      —
                    {/if}
                  </span>
                </div>
                <div class="account-field">
                  <span class="account-label">Hackatime ID</span>
                  {#if hackatimeConnected === false}
                    <form method="POST" action="/api/auth/hackatime/start">
                      <button type="submit" class="nickname-save">Connect to Hackatime</button>
                    </form>
                  {:else}
                    <span class="account-value">{hackatimeConnected ? (hackatimeUserId ?? 'Connected') : '—'}</span>
                  {/if}
                </div>
              </div>
              <h3 class="settings-group-title">Preferences</h3>
              <div class="settings-group">
  <label class="pref-toggle">
                <input
                  type="checkbox"
                  checked={customCursorEnabled}
                  onchange={(e) => {
                    customCursorEnabled = e.currentTarget.checked;
                    if (customCursorEnabled) {
                      localStorage.removeItem('customCursor');
                      document.documentElement.classList.add('custom-cursor');
                    } else {
                      localStorage.setItem('customCursor', 'off');
                      document.documentElement.classList.remove('custom-cursor');
                    }
                  }}
                />
                <span class="pref-label-text">Custom cursor</span>
                <span class="switch" aria-hidden="true"></span>
              </label>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
    {/if}

  </main>

  <!-- Project detail overlay (rendered outside <main> so position:fixed is relative to viewport, not the filtered main element) -->
  {#if detailProject}
  <div class="detail-overlay" role="dialog" aria-modal="true">
    <div class="detail-backdrop" onclick={closeProjectDetail} onkeydown={(e) => e.key === 'Escape' && closeProjectDetail()} role="button" tabindex="-1"></div>
    <div class="detail-panel">
      <button class="detail-close" onclick={closeProjectDetail} type="button" aria-label="Close">&times;</button>

      <!-- Image gallery -->
      <div class="detail-gallery">
        {#if detailProject.screenshot1Url || detailProject.screenshot2Url}
          {@const screenshots = [detailProject.screenshot1Url, detailProject.screenshot2Url].filter(Boolean) as string[]}
          <div class="detail-img-wrap">
            <img
              class="detail-img"
              src={screenshots[detailActiveImg] ?? screenshots[0]}
              alt="{detailProject.name} screenshot {detailActiveImg + 1}"
            />
            {#if screenshots.length > 1}
              <button class="detail-arrow detail-arrow-left" onclick={() => detailActiveImg = detailActiveImg === 0 ? screenshots.length - 1 : detailActiveImg - 1} type="button" aria-label="Previous screenshot">&#8249;</button>
              <button class="detail-arrow detail-arrow-right" onclick={() => detailActiveImg = (detailActiveImg + 1) % screenshots.length} type="button" aria-label="Next screenshot">&#8250;</button>
              <div class="detail-img-dots">
                {#each screenshots as _, i}
                  <span class="detail-dot" class:detail-dot-active={detailActiveImg === i}></span>
                {/each}
              </div>
            {/if}
          </div>
        {:else}
          <div class="detail-img-wrap detail-no-img">
            <span>No screenshots</span>
          </div>
        {/if}
      </div>

      <!-- Project info -->
      <div class="detail-info">
        <div class="detail-header">
          <h2 class="detail-name">{detailProject.name}</h2>
          <span class="detail-type">{detailProject.projectType}</span>
        </div>
        <p class="detail-builder">by {detailProject.builderName}</p>
        {#if detailProject.hours > 0}
          <p class="detail-hours">{detailProject.hours.toFixed(1)} hours</p>
        {/if}
        <p class="detail-desc">{detailProject.description}</p>

        <!-- Chunky action buttons -->
        <div class="detail-actions">
          {#if detailProject.demoUrl}
            <a href={detailProject.demoUrl} target="_blank" rel="noopener noreferrer" class="detail-btn detail-btn-demo">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8"/></svg>
              View Demo
            </a>
          {/if}
          {#if detailProject.codeUrl}
            <a href={detailProject.codeUrl} target="_blank" rel="noopener noreferrer" class="detail-btn detail-btn-code">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
              Source Code
            </a>
          {/if}
        </div>
      </div>

      <!-- Comments -->
      <div class="detail-comments">
        <h3 class="detail-comments-title">Comments</h3>

        <div class="detail-comment-form">
          <textarea
            class="detail-comment-input"
            bind:value={detailCommentText}
            placeholder="Leave a comment..."
            maxlength="500"
            rows="3"
          ></textarea>
          <div class="detail-comment-form-footer">
            <span class="detail-comment-charcount">{detailCommentText.length}/500</span>
            <button
              class="detail-comment-submit"
              onclick={submitComment}
              disabled={detailCommentSubmitting || detailCommentText.trim().length === 0}
              type="button"
            >
              {detailCommentSubmitting ? 'Posting...' : 'Post'}
            </button>
          </div>
        </div>

        {#if detailCommentsLoading}
          <p class="detail-comments-loading">Loading comments...</p>
        {:else if detailComments.length === 0}
          <p class="detail-comments-empty">No comments yet. Be the first!</p>
        {:else}
          <div class="detail-comments-list">
            {#each detailComments as comment}
              <div class="detail-comment">
                <div class="detail-comment-header">
                  <span class="detail-comment-author">{comment.authorName}</span>
                  <span class="detail-comment-date">{new Date(comment.createdAt).toLocaleDateString()}</span>
                  {#if comment.authorId === data.user.uid || detailProject.ownerId === data.user.uid || data.role}
                    <button class="detail-comment-delete" onclick={() => deleteComment(comment.id)} type="button" title="Delete comment">&times;</button>
                  {/if}
                </div>
                <p class="detail-comment-body">{comment.body}</p>
              </div>
            {/each}
          </div>
        {/if}
      </div>
    </div>
  </div>
  {/if}
</div>

<svelte:window onkeydown={onBuildlogLightboxKey} />

{#if buildlogLightbox}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="buildlog-lightbox" onclick={closeBuildlogLightbox} role="dialog" aria-modal="true" aria-label="Buildlog image">
    <img src={buildlogLightbox} alt="Buildlog attachment full size" onclick={(e) => e.stopPropagation()} />
    <button type="button" class="buildlog-lightbox-close" onclick={closeBuildlogLightbox} aria-label="Close">&times;</button>
  </div>
{/if}

{#if lookoutPickerOpen}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <!-- svelte-ignore a11y_interactive_supports_focus -->
  <div class="lookout-modal-backdrop" onclick={() => lookoutPickerOpen = false} role="dialog" aria-modal="true" aria-label="Select a Lookout timelapse">
    <div class="lookout-modal" onclick={(e) => e.stopPropagation()}>
      <header class="lookout-modal-header">
        <h3 class="lookout-modal-title">Select a timelapse</h3>
        <button type="button" class="lookout-modal-close" onclick={() => lookoutPickerOpen = false} aria-label="Close">&times;</button>
      </header>
      <div class="lapse-toolbar">
        <button
          type="button"
          class="lapse-record"
          disabled={buildlogLookoutBusy || !buildlogProjectId}
          onclick={() => { lookoutPickerOpen = false; startBuildlogRecording(); }}
        >
          {buildlogLookoutBusy ? 'Opening Lookout…' : 'Record new timelapse'}
        </button>
      </div>
      {#if buildlogLookoutSessionsLoading}
        <div class="lapse-grid" aria-hidden="true">
          {#each Array(4) as _, i (i)}
            <div class="lapse-card lapse-card-skeleton">
              <div class="lapse-thumb lapse-thumb-skeleton"></div>
              <div class="lapse-meta">
                <span class="lapse-skeleton-line"></span>
                <span class="lapse-skeleton-line short"></span>
              </div>
            </div>
          {/each}
        </div>
      {:else}
        <div class="lapse-grid" role="radiogroup" aria-label="Saved Lookout sessions">
          <button
            type="button"
            class="lapse-card lapse-card-none"
            class:selected={buildlogLookoutSessionId === null}
            role="radio"
            aria-checked={buildlogLookoutSessionId === null}
            onclick={() => { buildlogLookoutSessionId = null; lookoutPickerOpen = false; }}
          >
            <div class="lapse-thumb lapse-thumb-none" aria-hidden="true">∅</div>
            <div class="lapse-meta">
              <span class="lapse-name">No timelapse</span>
              <span class="lapse-sub">Post without a Lookout session</span>
            </div>
          </button>
          {#each getSelectableBuildlogLookoutSessions(buildlogLookoutSessions) as session (session.id)}
            <button
              type="button"
              class="lapse-card"
              class:selected={buildlogLookoutSessionId === session.id}
              role="radio"
              aria-checked={buildlogLookoutSessionId === session.id}
              onclick={() => { buildlogLookoutSessionId = session.id; lookoutPickerOpen = false; }}
            >
              {#if buildlogLookoutSessionId === session.id}
                <span class="lapse-check" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </span>
              {/if}
              {#if session.thumbnailUrl}
                <div class="lapse-thumb" style="background-image: url({session.thumbnailUrl})"></div>
              {:else}
                <div class="lapse-thumb lapse-thumb-empty" aria-hidden="true">{session.status === 'complete' ? '✓' : '…'}</div>
              {/if}
              <div class="lapse-meta">
                <span class="lapse-name">{session.name ?? (session.status === 'complete' ? 'Complete session' : session.status)}</span>
                <div class="lapse-subrow">
                  <span class="lapse-sub">{session.trackedSeconds ? fmtTrackedShort(session.trackedSeconds) : '—'}</span>
                  <span class="lapse-sub">{session.createdAt ? formatLocal(session.createdAt) : 'recent'}</span>
                </div>
                {#if session.status !== 'complete'}
                  <span class="lapse-status">{session.status}</span>
                {/if}
              </div>
            </button>
          {/each}
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
/* ── tokens ──────────────────────────────────────────
   The landing page's paper, ink, Inter and details, laid out as one quiet
   column (after mikes.cv). See .claude/lifemaxx-design.md. Set on .home for
   first paint and on <html> while mounted, so portalled modals get them. */
  :global(html.lm-app),
  .home {
    --paper: #f4f2ed;
    --ink: #0b0b0c;
    --indigo: #2f2284;
    --red: #d6161e;
    --blue: #1557ff;
    --hi: #d8ff3e;
    --rule: #cfcbc2;
    --muted: #77746d;
    --faint: #a9a59b;
    --hand: 'Reenie Beanie', cursive;
    --grain: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='3'/%3E%3CfeColorMatrix values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 .09 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
    --cut-shadow: drop-shadow(0 6px 8px rgb(0 0 0 / 0.24));
    --object-shadow: 0 4px 9px rgb(0 0 0 / 0.2);
    --window-shadow: 0 0 0 1px rgb(11 11 12 / 0.08), 0 14px 18px -10px rgb(0 0 0 / 0.35), 0 4px 6px -3px rgb(0 0 0 / 0.14);
    --radius: 4px;
    --shadow: var(--window-shadow);
    --shadow-lift: var(--window-shadow);
    --shadow-card: none;

    /* Names the rest of the file uses. */
    --text: var(--ink);
    --surface: #fffefa;
    --card: #fffefa;
    --well: #fff;
    --line: var(--rule);
    --line-strong: #a9a59b;
    --pill-bg: var(--ink);
    --pill-fg: #fff;
    --color-bg: var(--paper);
    --color-bg-elevated: #fffefa;
    --color-bg-elevated-2: #faf8f3;
    --color-border: var(--rule);
    --color-text: var(--ink);
    --color-text-muted: #3d3b37;
    --color-text-faint: var(--muted);
    --color-accent: var(--blue);
    --color-accent-hover: #0f45d6;
    --color-danger: var(--red);
    --color-success: #2f9e55;
    --color-warning: #c97f06;
  }

  :global(html) {
    scroll-behavior: smooth;
  }

  :global(html.lm-app body) {
    margin: 0;
    background: var(--paper) var(--grain);
    color: var(--ink);
    font-family: Inter, system-ui, sans-serif;
    line-height: 1.45;
    overflow-x: hidden;
  }

  :global(html.lm-app ::selection) {
    background: rgb(60 130 255 / 0.3);
  }

  :global(html.lm-app :focus-visible) {
    outline: 2px solid var(--blue);
    outline-offset: 3px;
  }

  /* The landing page's black arrow, replacing the layout's white one. */
  @media (pointer: fine) {
    :global(html.lm-app.custom-cursor *),
    :global(html.lm-app.custom-cursor *:active) {
      cursor: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='22' height='31' viewBox='0 0 24 34'%3E%3Cpath d='M2 2v25l6.5-6 4.5 11 4-1.700-4.500-10.800H21z' fill='%23000' stroke='%23fff' stroke-width='1.8' stroke-linejoin='round'/%3E%3C/svg%3E") 2 2, auto;
    }
  }

  /* ── layout ──────────────────────────────────────── */
  .home {
    position: relative;
    min-height: 100vh;
    background: var(--paper) var(--grain);
    color: var(--ink);
    font-family: Inter, system-ui, sans-serif;
    line-height: 1.45;
  }

  /* ── ribbon bookmarks (the landing page's nav, exactly) ── */
  .tabs {
    position: fixed;
    top: 0;
    right: 24px;
    z-index: 200;
    display: flex;
    align-items: flex-start;
    gap: 4px;
  }

  .tab {
    position: relative;
    width: 72px;
    padding: 29px 0 23px;
    border: 0;
    background: #c1bdb4;
    clip-path: polygon(0 0, 100% 0, 100% 100%, 50% calc(100% - 16px), 0 100%);
    color: var(--ink);
    font: inherit;
    font-size: 13px;
    font-weight: 500;
    line-height: 18px;
    text-align: center;
    text-decoration: none;
    cursor: pointer;
    transition: padding 0.15s;
  }

  .tab:nth-child(2) { background: #9da5ea; }
  .tab:nth-child(3) { background: #f8d495; }
  .tab:nth-child(4) { background: #f2a7bf; }

  .tab:hover,
  .tab:focus-visible {
    padding-top: 37px;
  }

  /* The page you're on stays pulled down. */
  .tab.active {
    padding-top: 43px;
    font-weight: 700;
  }

  .tab-ink {
    background: var(--ink);
    color: #fff;
  }

  /* The landing page folder's red badge, tucked inside the ribbon so the notch doesn't clip it. */
  .tab-badge {
    position: absolute;
    top: 6px;
    right: 4px;
    padding: 1px 6px;
    border: 2px solid #fff;
    border-radius: 99px;
    background: #ff3b30;
    color: #fff;
    font-size: 11px;
    font-weight: 700;
    line-height: 1.2;
  }

  /* ── corner block (after mikes.cv) ─────────────── */
  .meta {
    position: fixed;
    top: 40px;
    left: 40px;
    z-index: 150;
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 2px 0 2px 18px;
    border-left: 2px dotted var(--rule);
    color: var(--faint);
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 0.14em;
    line-height: 1.75;
    text-transform: uppercase;
    font-variant-numeric: tabular-nums;
  }

  .meta-brand {
    color: var(--ink);
    font-weight: 700;
  }

  .meta-who {
    display: flex;
    align-items: center;
    gap: 7px;
  }

  .meta-avatar {
    width: 16px;
    height: 16px;
    border-radius: 50%;
    object-fit: cover;
    box-shadow: 0 0 0 1px var(--rule);
  }

  /* ── footer (fixed links over a fade) ─────────── */
  .foot {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 150;
    display: flex;
    justify-content: center;
    gap: 32px;
    padding: 56px 0 20px;
    background: linear-gradient(rgb(244 242 237 / 0), var(--paper) 62%);
    pointer-events: none;
  }

  .foot a {
    color: var(--muted);
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    pointer-events: auto;
    transition: color 0.15s;
  }

  .foot a:hover {
    color: var(--ink);
  }

  /* ── main + sections ─────────────────────────────── */
  .main {
    position: relative;
    min-width: 0;
    padding: 0 0 140px;
  }

  .section {
    position: relative;
    padding: 120px 24px 0;
  }

  /* One narrow column, like mikes.cv. */
  .column {
    width: 100%;
    max-width: 600px;
    margin: 0 auto;
  }

  .section-inner {
    position: relative;
    width: 100%;
    max-width: 760px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
  }

  /* Hero object: one cutout with its file-name caption. */
  /* The laptop sits inline in the title, as tall as the title, before "projects". */
  .hero-cut {
    position: relative;
    display: inline-block;
    margin: 0 0.18em 0 0.02em;
    vertical-align: -0.12em;
  }

  .hero-cut img {
    display: block;
    width: auto;
    height: 1em;
    rotate: 4deg;
    filter: var(--cut-shadow);
    transition: rotate 0.18s, scale 0.18s;
  }

  .hero-cut:hover img {
    scale: 1.04;
    rotate: 6deg;
  }

  /* Caption hangs under the laptop without pushing the title row taller. */
  .hero-cap {
    position: absolute;
    top: calc(100% + 8px);
    left: 50%;
    translate: -50% 0;
    white-space: nowrap;
    padding: 1px 6px;
    border-radius: 4px;
    font-size: 12px;
    font-weight: 400;
    letter-spacing: 0;
    line-height: 1.4;
    text-transform: none;
  }

  .hero-cut:hover .hero-cap {
    background: var(--blue);
    color: #fff;
  }

  /* Page titles: the landing page's section headings. */
  .page-title,
  .section-title {
    margin: 0;
    font-size: clamp(30px, 4.2vw, 54px);
    font-weight: 700;
    line-height: 1;
    letter-spacing: -0.035em;
    text-transform: lowercase;
    text-wrap: balance;
  }

  .section-subtitle {
    max-width: 52ch;
    margin: 14px 0 40px;
    color: var(--muted);
    font-size: 16px;
  }

  /* Two-tone line under a title: the second half fades out. */
  .two-tone {
    margin: 14px 0 0;
    font-size: clamp(16px, 1.62vw, 20px);
    font-weight: 700;
    letter-spacing: -0.03em;
    line-height: 1.25;
  }

  .two-tone span {
    display: block;
    color: var(--faint);
  }

  .text-link {
    color: var(--ink);
    font-size: 14px;
    font-weight: 600;
    text-decoration: underline;
    text-decoration-color: var(--rule);
    text-underline-offset: 3px;
    transition: text-decoration-color 0.15s;
  }

  .text-link:hover {
    text-decoration-color: var(--ink);
  }

  /* Handwritten note with a looped arrow, as on the landing page. */
  .hand {
    font-family: var(--hand);
    font-size: 27px;
    line-height: 0.9;
    rotate: -3deg;
  }

  .arr {
    width: 2.2em;
    height: auto;
    overflow: visible;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.5;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  /* Empty states are handwritten too. */
  .empty-text,
  .timeline-empty,
  .fulfillment-empty,
  .buildlog-empty,
  .my-orders-empty {
    margin: 0;
    color: var(--muted);
    font-family: var(--hand);
    font-size: 26px;
    line-height: 1;
    rotate: -1.5deg;
  }

  /* ── buttons (the landing page's pill) ─────────── */
  .action-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    padding: 13px 22px;
    border: 0;
    border-radius: 999px;
    background: var(--pill-bg);
    color: var(--pill-fg);
    font-size: 15px;
    font-weight: 700;
    line-height: 1.1;
    text-decoration: none;
    white-space: nowrap;
    cursor: inherit;
    transition: translate 0.15s, box-shadow 0.15s;
  }

  .action-btn:hover {
    translate: -2px -2px;
    box-shadow: 4px 4px 0 var(--red);
  }

  .action-btn:active {
    translate: 0 0;
    box-shadow: none;
  }

  /* ── windows (forms and modals still use these) ── */
  .win {
    display: flex;
    flex-direction: column;
    min-width: 0;
    overflow: hidden;
    background: #fffefa;
    border-radius: 8px;
    box-shadow: var(--window-shadow);
  }

  .win-bar {
    display: flex;
    align-items: center;
    gap: 12px;
    min-height: 40px;
    padding: 0 14px;
    border-bottom: 1px solid var(--rule);
  }

  .lights {
    display: flex;
    gap: 7px;
  }

  .lights i,
  .lights button {
    width: 11px;
    height: 11px;
    padding: 0;
    border: 0;
    border-radius: 50%;
    background: #d9d5cb;
  }

  .win-title {
    font-size: 13px;
    font-weight: 600;
  }

  .win-tools {
    display: flex;
    gap: 6px;
    margin-left: auto;
  }

  .tool-btn {
    padding: 5px 11px;
    border: 0;
    border-radius: 999px;
    background: rgb(11 11 12 / 0.06);
    color: var(--ink);
    font-size: 13px;
    font-weight: 600;
    text-decoration: none;
    cursor: pointer;
  }

  .tool-primary {
    background: var(--ink);
    color: #fff;
  }

  .win-body {
    padding: 18px;
  }

  /* ── dashboard: the plan ─────────────────────────── */
  .plan {
    position: relative;
    margin: 56px 0 0;
    padding: 0;
    list-style: none;
  }

  .stop {
    padding-bottom: 36px;
  }

  .stop.no-photo .stop-body {
    grid-template-columns: minmax(0, 1fr);
  }

  .stop.no-photo .stop-title,
  .stop.no-photo .stop-desc {
    grid-column: 1;
  }

  .stop.no-photo .sub {
    margin-left: 0;
  }

  .stop-body {
    display: grid;
    grid-template-columns: 96px minmax(0, 1fr);
    grid-template-rows: auto 1fr;
    column-gap: 18px;
    row-gap: 4px;
    align-items: start;
    padding: 0;
    border: 0;
    background: none;
    color: var(--ink);
    text-align: left;
    cursor: pointer;
  }

  /* Screenshots fanned like printed photos. */
  .fan {
    grid-column: 1;
    grid-row: 1 / span 2;
    position: relative;
    width: 96px;
    height: 62px;
  }

  .fan img {
    position: absolute;
    left: 0;
    top: 0;
    width: 88px;
    height: 56px;
    object-fit: cover;
    border: 3px solid #fff;
    border-radius: 3px;
    background: #ece9e2;
    box-shadow: var(--object-shadow);
    rotate: -4deg;
    transition: rotate 0.18s, translate 0.18s;
  }

  .fan .fan-back {
    rotate: 7deg;
    translate: 10px 2px;
  }

  .fan .fan-cat {
    object-fit: contain;
  }

  .stop-body:hover .fan img:not(.fan-back) {
    rotate: -8deg;
    translate: -4px -2px;
  }

  .stop-body:hover .fan .fan-back {
    rotate: 12deg;
    translate: 18px 2px;
  }

  .stop-title {
    grid-column: 2;
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 4px 10px;
    font-size: 17px;
    font-weight: 600;
    letter-spacing: -0.02em;
  }

  .stop-body:hover .stop-name {
    text-decoration: underline;
    text-decoration-color: var(--rule);
    text-underline-offset: 4px;
  }

  /* Status as a tiny tracked tag, in the landing planner's colours. */
  .flag {
    font-size: 10px;
    font-style: normal;
    font-weight: 700;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--muted);
  }

  .flag-approved { color: #35b25a; }
  .flag-unreviewed,
  .flag-fraud_pending { color: #3a4bd6; }
  .flag-changes_needed { color: #c97f06; }
  .flag-unshipped { color: var(--red); }
  .flag-golden { padding: 0 3px; background: var(--hi); color: var(--ink); }

  .stop-desc {
    grid-column: 2;
    display: -webkit-box;
    overflow: hidden;
    color: var(--muted);
    font-size: 14px;
    line-height: 1.55;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
  }

  /* A project's latest buildlogs, under its description. */
  .sub {
    position: relative;
    display: flex;
    gap: 10px;
    align-items: baseline;
    margin: 10px 0 0 114px;
    font-size: 13px;
  }

  .sub-title {
    color: #3d3b37;
  }

  .sub-time {
    color: var(--faint);
    font-size: 12px;
  }

  .stop-actions {
    position: relative;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 14px 18px;
    margin-top: 48px;
  }

  .note-empty {
    position: absolute;
    left: 236px;
    top: -6px;
    color: var(--ink);
    white-space: nowrap;
  }

  .note-empty .arr {
    position: absolute;
    left: -2.4em;
    top: 0.5em;
    rotate: 175deg;
  }

  /* Stats strip: tiny tracked labels over big numbers, between hairlines. */
  .stats {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    margin: 44px 0 0;
    border-top: 1px solid var(--rule);
    border-bottom: 1px solid var(--rule);
  }

  .stats div {
    padding: 14px 0 14px 18px;
  }

  .stats div + div {
    border-left: 1px solid var(--rule);
  }

  .stats dt {
    color: var(--faint);
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.16em;
    text-transform: uppercase;
  }

  .stats dd {
    margin: 2px 0 0;
    font-size: 30px;
    font-weight: 800;
    letter-spacing: -0.04em;
    line-height: 1.1;
    font-variant-numeric: tabular-nums;
  }

  /* iMessage "sent" bubbles: iOS blue, 18px radius, tail on the last one. */
  .imessage {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 2px;
    padding-right: 14px;
  }

  .imsg {
    position: relative;
    isolation: isolate;
    max-width: 75%;
    margin: 0;
    padding: 7px 14px 8px;
    border-radius: 18px;
    background: #1b8cfe;
    color: #fff;
    font-size: 17px;
    font-weight: 400;
    line-height: 1.3;
    letter-spacing: -0.01em;
  }

  /* The tail: drawn as a curl that sweeps out from the bubble's side to a rounded tip. */
  .imsg-tail::after {
    content: '';
    position: absolute;
    right: -14px;
    bottom: 0;
    z-index: -1;
    width: 32px;
    height: 20px;
    background: #1b8cfe;
    -webkit-mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 20'%3E%3Cpath d='M0 0H18C18 8 21 14.5 30.2 18.6C31.6 19.2 31.4 20 30 20H0Z'/%3E%3C/svg%3E") center / 100% 100% no-repeat;
    mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 20'%3E%3Cpath d='M0 0H18C18 8 21 14.5 30.2 18.6C31.6 19.2 31.4 20 30 20H0Z'/%3E%3C/svg%3E") center / 100% 100% no-repeat;
  }

  /* Lists: hairline rows, time on the right. */
  .list-title {
    margin: 96px 0 14px;
    font-size: 19px;
    font-weight: 700;
    letter-spacing: -0.02em;
  }

  .rows {
    margin: 0;
    padding: 0;
    list-style: none;
    border-top: 1px solid var(--rule);
  }

  .rows li {
    position: relative;
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 24px;
    padding: 14px 0;
    border-bottom: 1px solid var(--rule);
    font-size: 15px;
  }

  .rows li b {
    font-weight: 600;
  }

  .rows time {
    flex-shrink: 0;
    color: var(--faint);
    font-size: 13px;
    font-variant-numeric: tabular-nums;
  }

  /* Unread: the landing page's blue dot, hanging in the margin. */
  .rows li.unread::before {
    content: '';
    position: absolute;
    left: -16px;
    top: 21px;
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--blue);
  }

  /* ── create project form ─────────────────────────── */
  .create-project-form {
    display: flex;
    flex-direction: column;
    gap: 24px;
    width: 100%;
    min-height: 100vh;
    padding: 120px 24px 72px;
  }

  .create-project-form > * {
    width: 100%;
    max-width: 760px;
    margin-inline: auto;
  }

  .form-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 16px;
  }

  .form-header .section-title {
    margin: 0;
    text-align: left;
  }

  /* A card's top bar with traffic lights, like the buildlog window; it spans the card edge to edge. */
  .sheet-bar {
    margin: calc(var(--pad) * -1) calc(var(--pad) * -1) 0;
  }

  .form-grid {
    display: flex;
    flex-direction: column;
    gap: 22px;
    padding: 28px;
    background: var(--surface);
    border-radius: 8px;
    box-shadow: var(--window-shadow);
  }

  .form-row {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 22px 24px;
    align-items: start;
  }

  .form-row-top {
    align-items: stretch;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-width: 0;
  }

  .form-label {
    font-size: 14px;
    font-weight: 600;
    color: var(--text);
  }

  .required {
    color: var(--red);
  }

  .optional,
  .form-caption-inline {
    font-weight: 400;
    color: var(--color-text-faint);
  }

  .form-input {
    width: 100%;
    padding: 10px 12px;
    border: 1px solid var(--color-border);
    border-radius: 8px;
    background: var(--well);
    color: var(--text);
    font-size: 15px;
    transition: border-color 0.15s, box-shadow 0.15s;
  }

  .form-input::placeholder {
    color: #a9a59b;
  }

  .form-input:focus {
    outline: none;
    border-color: var(--blue);
    box-shadow: 0 0 0 3px rgb(21 87 255 / 0.15);
  }

  .form-textarea {
    min-height: 88px;
    resize: vertical;
    line-height: 1.45;
  }

  #project-desc {
    min-height: 140px;
  }

  .form-select {
    padding-right: 36px;
    background: var(--well) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%238a877f' stroke-width='2' fill='none'/%3E%3C/svg%3E") no-repeat right 12px center;
  }

  .form-caption-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
  }

  .form-caption {
    font-size: 12px;
    color: var(--color-text-faint);
  }

  .form-charcount {
    margin-left: auto;
    font-size: 12px;
    color: var(--color-text-faint);
  }

  .form-charcount.over {
    color: var(--red);
  }

  .form-error {
    margin: 0;
    font-size: 14px;
    color: var(--red);
  }

  .form-checkbox {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 15px;
    color: var(--text);
    cursor: pointer;
  }

  .noselect {
    user-select: none;
    -webkit-user-select: none;
  }

  .form-checkbox input[type="checkbox"] {
    position: relative;
    flex-shrink: 0;
    width: 18px;
    height: 18px;
    margin: 0;
    border: 1.5px solid #a9a59b;
    border-radius: 4px;
    background: var(--well);
    appearance: none;
    cursor: pointer;
  }

  .form-checkbox input[type="checkbox"]:checked {
    background: var(--pill-bg);
    border-color: var(--pill-bg);
  }

  .form-checkbox input[type="checkbox"]:checked::after {
    content: '';
    position: absolute;
    left: 5px;
    top: 1px;
    width: 5px;
    height: 10px;
    border: solid var(--pill-fg);
    border-width: 0 2px 2px 0;
    rotate: 45deg;
  }

  /* Screenshots use the buildlog folder; screenshots are landscape, so the photos are wider. */
  .bl-folder.shots-folder {
    max-width: 128px;
    margin: 24px 0 10px 8px;
  }

  .shots-folder .bl-pic {
    width: 62%;
    aspect-ratio: 16 / 10;
    left: calc(6% + var(--i) * 28%);
  }

  .form-file-hidden {
    display: none;
  }

  /* AI use */
  .ai-use-group {
    flex: 1;
  }

  .ai-sub-label {
    font-size: 13px;
  }

  .ai-checkbox {
    margin-bottom: 6px;
  }

  .ai-textarea {
    flex: 1;
    min-height: 80px;
  }

  .disabled-field,
  .disabled-label {
    opacity: 0.4;
  }

  .disabled-field {
    cursor: not-allowed;
  }

  /* Bottom row: notices on the left, actions on the right. */
  .form-bottom-row {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    gap: 16px 24px;
  }

  .form-actions {
    display: flex;
    flex-shrink: 0;
    gap: 10px;
    margin-left: auto;
  }

  /* All form buttons are the landing page's pill; colour carries the meaning. */
  .form-btn-submit,
  .form-btn-review,
  .form-btn-delete,
  .form-btn-draft {
    padding: 12px 22px;
    border: 0;
    border-radius: 999px;
    font-size: 15px;
    font-weight: 700;
    line-height: 1.1;
    cursor: pointer;
    transition: translate 0.15s, box-shadow 0.15s, background 0.15s, opacity 0.15s;
  }

  .form-btn-submit {
    background: var(--pill-bg);
    color: var(--pill-fg);
  }

  .form-btn-submit:hover:not(:disabled) {
    translate: -2px -2px;
    box-shadow: 4px 4px 0 var(--red);
  }

  .form-btn-submit:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }

  .form-btn-delete {
    margin-right: auto;
    background: transparent;
    color: var(--color-danger);
    box-shadow: inset 0 0 0 1.5px currentColor;
  }

  .form-btn-delete:hover {
    background: var(--red);
    color: #fff;
  }

  .form-btn-draft {
    margin-top: 10px;
    padding: 8px 16px;
    background: transparent;
    color: var(--text);
    font-size: 13px;
    box-shadow: inset 0 0 0 1.5px var(--color-border);
  }

  .form-btn-draft:hover {
    box-shadow: inset 0 0 0 1.5px var(--text);
  }

  .submit-review-wrap {
    position: relative;
  }

  .form-btn-review {
    background: #ece9e2;
    color: var(--color-text-faint);
    cursor: not-allowed;
  }

  .form-btn-review.ready {
    background: var(--color-success);
    color: var(--ink);
    cursor: pointer;
  }

  .form-btn-review.ready:hover {
    translate: -2px -2px;
    box-shadow: 4px 4px 0 var(--ink);
  }

  .in-review-notice {
    flex: 1 1 320px;
    padding: 12px 16px;
    background: rgb(21 87 255 / 0.22);
    border: 2px solid var(--blue);
    overflow-wrap: anywhere;
  }

  .in-review-text,
  .in-review-queue {
    margin: 0;
    font-size: 14px;
    line-height: 1.45;
    color: var(--color-text-muted);
  }

  .in-review-queue {
    margin-top: 6px;
    font-size: 13px;
  }

  /* ── Resubmit section ─────────────────────────── */
  .section-resubmit .section-inner {
    gap: 28px;
  }

  .approved-summary {
    padding: 20px;
    overflow: hidden;
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: var(--radius);
    box-shadow: var(--shadow);
  }

  .approved-summary .sheet-bar {
    margin-bottom: 18px;
  }

  .approved-summary-row {
    display: flex;
    align-items: flex-start;
    gap: 20px;
  }

  .approved-summary-thumb {
    flex-shrink: 0;
    width: 160px;
    aspect-ratio: 16 / 10;
    object-fit: cover;
    border: 1px solid var(--color-border);
    border-radius: 8px;
  }

  .approved-summary-info {
    flex: 1;
    min-width: 0;
  }

  .approved-summary-title {
    display: inline;
    margin: 0 10px 0 0;
    font-size: 24px;
    font-weight: 700;
    letter-spacing: -0.03em;
    vertical-align: middle;
    color: var(--text);
  }

  .approved-summary-desc {
    margin: 8px 0;
    font-size: 15px;
    color: var(--color-text-muted);
  }

  .approved-summary-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 6px 14px;
    font-size: 13px;
    color: var(--color-text-faint);
  }

  .approved-summary-meta a {
    font-weight: 600;
    color: var(--text);
    text-decoration: underline;
    text-decoration-color: var(--color-border);
    text-underline-offset: 3px;
  }

  .approved-summary-meta a:hover {
    text-decoration-color: var(--ink);
  }

  /* Bot pre-check and review history: notes pinned above the form. */
  .precheck-card,
  .review-feedback-card {
    padding: 16px 20px;
    background: var(--surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    box-shadow: inset 3px 0 0 var(--accent-bar, var(--color-border)), var(--shadow);
  }

  .precheck-card {
    --accent-bar: var(--blue);
    max-width: 760px;
  }

  .precheck-header {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-bottom: 10px;
  }

  .precheck-badge,
  .review-feedback-badge {
    align-self: flex-start;
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 12px;
    font-weight: 600;
  }

  .precheck-badge {
    background: var(--blue);
    color: #fff;
  }

  .precheck-caption {
    font-size: 12px;
    color: var(--color-text-faint);
  }

  .precheck-summary {
    margin: 0 0 12px;
    font-size: 15px;
    line-height: 1.5;
    color: var(--text);
  }

  .precheck-checklist {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .precheck-item {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    font-size: 14px;
    color: var(--text);
  }

  .precheck-item-icon {
    flex: none;
    font-weight: 700;
  }

  .precheck-item.pass .precheck-item-icon {
    color: var(--color-success);
  }

  .precheck-item.fail .precheck-item-icon {
    color: var(--color-warning);
  }

  .review-feedback-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
    max-width: 760px;
  }

  .review-feedback-heading {
    margin: 0;
    font-size: 18px;
    font-weight: 900;
    letter-spacing: -0.045em;
    color: var(--text);
  }

  .review-feedback-changes_needed {
    --accent-bar: #f0a92b;
  }

  .review-feedback-approved {
    --accent-bar: #35b25a;
  }

  .review-feedback-header {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px 12px;
    margin-bottom: 8px;
  }

  .review-feedback-badge {
    background: #f0a92b;
    color: var(--ink);
  }

  .review-feedback-badge.approved {
    background: #35b25a;
    color: var(--ink);
  }

  .review-feedback-reviewer {
    font-size: 13px;
    color: var(--color-text-muted);
  }

  .review-feedback-date {
    margin-left: auto;
    font-size: 12px;
    color: var(--color-text-faint);
  }

  .review-feedback-text {
    margin: 0;
    font-size: 15px;
    line-height: 1.5;
    white-space: pre-wrap;
    color: var(--text);
  }

  .review-feedback-empty {
    color: var(--color-text-faint);
  }

  .resubmit-section .section-subtitle {
    margin-bottom: 20px;
  }

  .resubmit-form {
    display: flex;
    flex-direction: column;
    gap: 8px;
    max-width: 760px;
    padding: 24px;
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: var(--radius);
    box-shadow: var(--shadow);
  }

  .resubmit-label {
    display: block;
    margin-top: 8px;
    font-size: 14px;
    font-weight: 600;
    color: var(--text);
  }

  .resubmit-label:first-child {
    margin-top: 0;
  }

  .resubmit-textarea {
    min-height: 110px;
  }

  .resubmit-check {
    margin: 10px 0;
  }

  .resubmit-btn {
    align-self: flex-start;
    margin-top: 12px;
  }

  .reviewer-note-field {
    margin-top: 16px;
    text-align: left;
  }

  .review-tooltip {
    position: absolute;
    right: 0;
    bottom: calc(100% + 8px);
    display: none;
    padding: 6px 10px;
    border-radius: 8px;
    background: var(--pill-bg);
    color: var(--pill-fg);
    font-size: 13px;
    white-space: nowrap;
  }

  .submit-review-wrap:hover .review-tooltip {
    display: block;
  }

  /* ── Hackatime picker ── */
  .hackatime-group {
    position: relative;
  }

  .hackatime-row {
    display: flex;
    align-items: stretch;
    gap: 8px;
  }

  .hackatime-select-wrap {
    position: relative;
    flex: 1;
    min-width: 0;
  }

  .hackatime-trigger {
    display: flex;
    align-items: center;
    height: 100%;
    min-height: 42px;
    padding: 10px 12px;
    overflow: hidden;
    border: 1px solid var(--color-border);
    border-radius: 8px;
    background: var(--well);
    font-size: 15px;
    color: var(--text);
    cursor: pointer;
    transition: border-color 0.15s;
  }

  .hackatime-trigger:hover {
    border-color: #a9a59b;
  }

  .hackatime-placeholder {
    color: #a9a59b;
  }

  .hackatime-selected {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .hackatime-dropdown {
    position: absolute;
    left: 0;
    right: 0;
    bottom: calc(100% + 6px);
    z-index: 50;
    display: flex;
    flex-direction: column;
    max-height: 220px;
    padding: 4px;
    overflow-y: auto;
    background: var(--well);
    border: 1px solid var(--color-border);
    border-radius: 8px;
    box-shadow: 0 12px 32px -12px rgb(0 0 0 / 0.3);
  }

  .hackatime-option {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 7px 8px;
    border-radius: 8px;
    font-size: 14px;
    color: var(--text);
    cursor: pointer;
  }

  .hackatime-option:hover {
    background: var(--well);
  }

  .hackatime-option input[type="checkbox"] {
    width: 15px;
    height: 15px;
    min-width: 15px;
    margin: 0;
    border: 1.5px solid #a9a59b;
    border-radius: 4px;
    background: var(--well);
    appearance: none;
    cursor: pointer;
  }

  .hackatime-option input[type="checkbox"]:checked {
    background: var(--pill-bg);
    border-color: var(--pill-bg);
  }

  .hackatime-empty {
    padding: 7px 8px;
    font-size: 13px;
    color: var(--color-text-faint);
  }

  .refresh-form {
    display: contents;
  }

  .refresh-btn {
    display: grid;
    place-items: center;
    width: 42px;
    padding: 0;
    border: 1px solid var(--color-border);
    border-radius: 8px;
    background: var(--well);
    cursor: pointer;
    transition: border-color 0.15s;
  }

  .refresh-btn:hover:not(:disabled) {
    border-color: var(--ink);
  }

  .refresh-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .refresh-icon {
    width: 18px;
    height: 18px;
    color: var(--text);
  }

  .refresh-icon.spinning {
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  /* ── Lookout (timelapse) ── */
  .lookout-block {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .lookout-record-btn,
  .lookout-choose-btn,
  .lapse-record {
    align-self: flex-start;
    padding: 9px 14px;
    border: 1px solid var(--color-border);
    border-radius: 999px;
    background: var(--well);
    color: var(--text);
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: border-color 0.15s;
  }

  .lookout-record-btn:hover:not(:disabled),
  .lookout-choose-btn:hover,
  .lapse-record:hover:not(:disabled) {
    border-color: var(--ink);
  }

  .lookout-record-btn:disabled,
  .lapse-record:disabled {
    opacity: 0.5;
    cursor: default;
  }

  .lookout-choose-btn {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    min-width: 240px;
  }

  .lookout-choose-caret {
    font-size: 12px;
    color: var(--color-text-faint);
  }

  .lookout-attached,
  .lookout-hint {
    font-size: 13px;
    color: var(--color-text-faint);
  }

  .lookout-hint a {
    color: var(--text);
    text-decoration: underline;
    text-underline-offset: 2px;
  }

  .lookout-modal-backdrop {
    position: fixed;
    inset: 0;
    z-index: 1000;
    display: grid;
    place-items: center;
    padding: 24px;
    background: rgb(11 11 12 / 0.7);
    backdrop-filter: blur(2px);
  }

  .lookout-modal {
    width: min(680px, 100%);
    max-height: 80vh;
    padding: 20px;
    overflow-y: auto;
    background: var(--surface);
    border: 1px solid var(--line);
    box-shadow: var(--shadow-lift);
    color: var(--text);
  }

  .lookout-modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 16px;
  }

  .lookout-modal-title {
    margin: 0;
    font-size: 18px;
    font-weight: 700;
    letter-spacing: -0.02em;
  }

  .lookout-modal-close {
    display: grid;
    place-items: center;
    width: 34px;
    height: 34px;
    padding: 0;
    border: 0;
    border-radius: 50%;
    background: rgb(11 11 12 / 0.06);
    color: var(--text);
    font-size: 22px;
    line-height: 1;
    cursor: pointer;
  }

  .lookout-modal-close:hover {
    background: rgb(11 11 12 / 0.12);
  }

  .lapse-toolbar {
    display: flex;
    justify-content: center;
    margin-bottom: 16px;
  }

  .lapse-record {
    align-self: auto;
  }

  .lapse-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 14px;
  }

  .lapse-card {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 8px;
    border: 1px solid var(--color-border);
    border-radius: 8px;
    background: var(--well);
    color: inherit;
    text-align: left;
    cursor: pointer;
    transition: border-color 0.15s, box-shadow 0.15s;
  }

  .lapse-card:hover {
    border-color: #a9a59b;
  }

  .lapse-card.selected {
    border-color: var(--blue);
    box-shadow: 0 0 0 2px var(--blue);
  }

  .lapse-thumb {
    width: 100%;
    aspect-ratio: 16 / 9;
    border-radius: 8px;
    background: #ece9e2 center / contain no-repeat;
  }

  .lapse-thumb-empty,
  .lapse-thumb-none {
    display: grid;
    place-items: center;
    font-size: 24px;
    color: var(--color-text-faint);
  }

  .lapse-meta {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .lapse-name {
    overflow: hidden;
    font-size: 14px;
    font-weight: 600;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .lapse-subrow {
    display: flex;
    justify-content: space-between;
    gap: 8px;
  }

  .lapse-sub {
    font-size: 12px;
    color: var(--color-text-faint);
  }

  .lapse-status {
    font-size: 12px;
    text-transform: capitalize;
    color: var(--color-text-muted);
  }

  .lapse-check {
    position: absolute;
    top: 14px;
    right: 14px;
    z-index: 2;
    display: grid;
    place-items: center;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: var(--blue);
    color: #fff;
  }

  .lapse-check svg {
    width: 14px;
    height: 14px;
  }

  .lapse-card-skeleton {
    cursor: default;
  }

  .lapse-thumb-skeleton,
  .lapse-skeleton-line {
    border-radius: 8px;
    background: #ece9e2;
    animation: lapse-pulse 1.2s ease-in-out infinite;
  }

  .lapse-skeleton-line {
    width: 80%;
    height: 12px;
  }

  .lapse-skeleton-line.short {
    width: 50%;
  }

  @keyframes lapse-pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.4; }
  }

  .lookout-dropdown summary {
    display: flex;
    align-items: center;
    gap: 6px;
    list-style: none;
    cursor: pointer;
    user-select: none;
  }

  .lookout-dropdown summary::-webkit-details-marker {
    display: none;
  }

  .lookout-summary-action {
    margin-left: auto;
    font-size: 13px;
    font-weight: 600;
    color: var(--text);
  }

  .lookout-summary-action::before {
    content: '▸ ';
  }

  .lookout-dropdown[open] .lookout-summary-action::before {
    content: '▾ ';
  }

  .lookout-dropdown[open] .lookout-summary-action::after {
    content: ' (hide)';
  }

  .lookout-dropdown video {
    margin-top: 8px;
  }

  .buildlog-card-lookout {
    margin-top: 12px;
    padding: 10px 12px;
    background: var(--well);
    border-radius: 8px;
    font-size: 13px;
    color: var(--color-text-muted);
  }

  .lookout-status {
    text-transform: capitalize;
  }

  .lookout-tracked {
    color: var(--color-text-faint);
  }

  .buildlog-card-lookout video {
    display: block;
    width: 100%;
    max-height: 320px;
    margin-top: 6px;
    background: #000;
    border-radius: 8px;
  }

  /* ── Buildlogs section ───────────────────────── */
  .section-buildlogs .section-inner,
  .section-settings .section-inner {
    max-width: 640px;
  }

  .buildlogs-blurb {
    max-width: 52ch;
    margin: 14px 0 0;
    color: var(--muted);
    font-size: 16px;
  }

  .buildlogs-blurb strong {
    color: var(--ink);
    font-weight: 600;
  }

  .buildlog-new-btn {
    align-self: flex-start;
    margin: 28px 0 8px;
  }

  /* Sheets: forms sit on plain paper sheets with a small tracked-caps header. */
  .buildlog-win,
  .notes-win {
    margin-top: 40px;
  }

  .win-bar {
    min-height: 0;
    padding: 12px 18px;
  }

  .win-bar .win-title {
    color: var(--faint);
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.16em;
    text-transform: uppercase;
  }

  /* Traffic lights; the red one closes when it's a button. */
  .lights i,
  .lights button {
    box-shadow: inset 0 0 0 0.5px rgb(0 0 0 / 0.18);
  }

  .lights > :nth-child(1) { background: #ff5f57; }
  .lights > :nth-child(2) { background: #febc2e; }
  .lights > :nth-child(3) { background: #28c840; }

  .light-close {
    position: relative;
    cursor: pointer;
  }


  .buildlog-create {
    display: flex;
    align-items: stretch;
  }

  .buildlog-form {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 18px;
    min-width: 0;
    padding: 20px;
  }

  .buildlog-images-card {
    display: flex;
    flex-direction: column;
    gap: 10px;
    flex-shrink: 0;
    width: 200px;
    padding: 20px 18px;
    border-left: 1px solid var(--rule);
  }

  .buildlog-field {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .buildlog-textarea {
    min-height: 140px;
  }

  .buildlog-images-hint {
    margin: 0;
    color: var(--faint);
    font-size: 12px;
  }

  /* The landing page's blue folder, holding the buildlog's images. */
  .bl-folder {
    position: relative;
    display: block;
    width: 100%;
    max-width: 168px;
    aspect-ratio: 200 / 160;
    margin: 18px auto 0;
    cursor: pointer;
  }

  .bl-folder.full {
    cursor: default;
  }

  .bl-folder > svg {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    overflow: visible;
    filter: drop-shadow(0 6px 8px rgb(0 0 0 / 0.24));
  }

  .bl-folder-back {
    z-index: 1;
  }

  .bl-folder-front {
    z-index: 3;
    pointer-events: none;
  }

  .bl-folder-front rect {
    transform-origin: 50% 100%;
    transition: transform 0.2s;
  }

  .bl-sheet {
    transition: transform 0.2s;
  }

  .bl-sheet text {
    fill: #1d2a6b;
    font-family: var(--hand);
    font-size: 21px;
  }

  .bl-folder:not(.full):hover .bl-folder-front rect,
  .bl-folder:not(.full):focus-within .bl-folder-front rect {
    transform: skewX(-7deg) scaleY(0.9);
  }

  .bl-folder:not(.full):hover .bl-sheet {
    transform: translateY(-46px) rotate(-2deg);
  }

  /* Added images stick out of the folder like photos tucked into it. */
  .bl-pics {
    position: absolute;
    inset: 0;
    z-index: 2;
  }

  .bl-pic {
    position: absolute;
    top: -6%;
    left: calc(10% + var(--i) * 17%);
    width: 40%;
    aspect-ratio: 1;
    border: 3px solid #fff;
    border-radius: 3px;
    background: #fff;
    box-shadow: var(--object-shadow);
    rotate: calc(-8deg + var(--i) * 6deg);
    transition: translate 0.2s;
  }

  .bl-folder:hover .bl-pic {
    translate: 0 -8px;
  }

  .bl-pic img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .bl-pic-remove {
    position: absolute;
    top: -8px;
    right: -8px;
    display: grid;
    place-items: center;
    width: 20px;
    height: 20px;
    padding: 0;
    border: 2px solid #fff;
    border-radius: 50%;
    background: var(--ink);
    color: #fff;
    font-size: 12px;
    line-height: 1;
    cursor: pointer;
    opacity: 0;
    transition: opacity 0.15s;
  }

  .bl-pic:hover .bl-pic-remove,
  .bl-pic-remove:focus-visible {
    opacity: 1;
  }

  /* The red unread-style badge, counting images. */
  .bl-badge {
    position: absolute;
    top: 22%;
    left: -6%;
    z-index: 4;
    padding: 2px 8px;
    border: 2px solid #fff;
    border-radius: 99px;
    background: #ff3b30;
    color: #fff;
    font-size: 12px;
    font-weight: 700;
    line-height: 1.2;
  }

  .bl-folder-cap {
    display: block;
    margin-top: 10px;
    font-size: 12px;
    text-align: center;
  }

  .buildlog-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    margin-top: 4px;
  }

  .buildlog-submit.lookout-record-btn {
    border: 0;
    border-radius: 999px;
    background: var(--ink);
    color: #fff;
    font-size: 15px;
    font-weight: 700;
    padding: 12px 20px;
  }

  .buildlog-submit {
    align-self: flex-start;
    padding: 12px 20px;
    border: 0;
    border-radius: 999px;
    background: var(--ink);
    color: #fff;
    font-size: 15px;
    font-weight: 700;
    cursor: pointer;
    transition: translate 0.15s, box-shadow 0.15s, opacity 0.15s;
  }

  .buildlog-submit:hover:not(:disabled) {
    translate: -2px -2px;
    box-shadow: 4px 4px 0 var(--red);
  }

  .buildlog-submit:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  /* The feed: no sheet, just a dotted line with a dot per entry (like the dashboard's plan). */
  .notes-win {
    overflow: visible;
    background: none;
    box-shadow: none;
  }

  .notes-win .win-bar {
    padding: 0 0 14px;
    border-bottom: 0;
  }

  .notes-win .lights {
    margin-right: 4px;
  }

  .win-count {
    margin-left: auto;
    color: var(--faint);
    font-size: 12px;
  }

  .buildlogs-list {
    position: relative;
    display: flex;
    flex-direction: column;
  }

  .buildlogs-list::before {
    content: '';
    position: absolute;
    left: 4px;
    top: 8px;
    bottom: 8px;
    border-left: 1.5px dotted var(--faint);
  }

  .buildlog-card {
    position: relative;
    padding: 0 0 40px 34px;
  }

  .buildlog-card::before {
    content: '';
    position: absolute;
    left: 0;
    top: 5px;
    width: 9px;
    height: 9px;
    border: 1.5px solid var(--blue);
    border-radius: 50%;
    background: radial-gradient(var(--blue) 0 2.5px, var(--paper) 3px);
  }

  .buildlog-card-header {
    display: flex;
    align-items: baseline;
    gap: 10px;
    margin-bottom: 4px;
  }

  .buildlog-card-project {
    display: flex;
    align-items: baseline;
    gap: 6px;
    color: var(--blue);
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.14em;
    text-transform: uppercase;
  }

  .buildlog-card-project .tag {
    display: none;
  }

  .buildlog-card-time {
    color: var(--faint);
    font-size: 12px;
    font-variant-numeric: tabular-nums;
  }

  .buildlog-card-delete {
    margin-left: auto;
    padding: 0 4px;
    border: 0;
    border-radius: 4px;
    background: none;
    color: var(--faint);
    font-size: 16px;
    line-height: 1;
    cursor: pointer;
  }

  .buildlog-card-delete:hover {
    background: var(--red);
    color: #fff;
  }

  .buildlog-card-title {
    margin: 0 0 4px;
    font-size: 17px;
    font-weight: 600;
    letter-spacing: -0.02em;
  }

  .buildlog-card-text {
    margin: 0;
    color: var(--muted);
    font-size: 15px;
    line-height: 1.6;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }

  /* Attached images, fanned like printed photos. */
  .buildlog-card-images {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 14px;
  }

  .buildlog-card-image-btn {
    padding: 0;
    border: 3px solid #fff;
    border-radius: 3px;
    background: none;
    box-shadow: var(--object-shadow);
    rotate: -3deg;
    cursor: zoom-in;
    transition: rotate 0.18s;
  }

  .buildlog-card-image-btn:nth-child(even) {
    rotate: 4deg;
  }

  .buildlog-card-image-btn:hover {
    rotate: 0deg;
  }

  .buildlog-card-images img {
    display: block;
    width: 110px;
    height: 80px;
    object-fit: cover;
  }

  .buildlog-empty {
    padding: 0 0 0 34px;
  }

  .buildlog-lightbox {
    position: fixed;
    inset: 0;
    z-index: 10000;
    display: grid;
    place-items: center;
    padding: 32px;
    background: rgb(244 242 237 / 0.92);
    cursor: zoom-out;
  }

  .buildlog-lightbox img {
    max-width: 100%;
    max-height: calc(100vh - 64px);
    border: 6px solid #fff;
    box-shadow: 0 14px 22px rgb(0 0 0 / 0.26);
    cursor: default;
  }

  .buildlog-lightbox-close {
    position: absolute;
    top: 16px;
    right: 16px;
    padding: 4px 10px;
    border: 0;
    border-radius: 999px;
    background: var(--ink);
    color: #fff;
    font-size: 18px;
    line-height: 1;
    cursor: pointer;
  }

  @media (max-width: 720px) {
    .buildlog-create {
      flex-direction: column;
    }

    .buildlog-images-card {
      width: 100%;
      border-left: 0;
      border-top: 1px solid var(--rule);
    }

  }

  /* ── shop: cutouts with captions ─────────────────── */
  .column-wide {
    max-width: 880px;
  }

  .shop-suggest {
    margin: 18px 0 0;
  }

  .shop-empty {
    margin-top: 56px;
  }

  .shop-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 180px), 1fr));
    gap: 48px 24px;
    margin-top: 56px;
  }

  .list-title + .shop-grid {
    margin-top: 28px;
  }

  /* No card: the cutout sits on the paper, like "we ship:". */
  .shop-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    padding: 0;
    border: 0;
    background: none;
    color: var(--ink);
    cursor: pointer;
  }

  .shop-card-img {
    position: relative;
    display: block;
    width: 100%;
    height: 170px;
  }

  .shop-card-img img {
    width: 100%;
    height: 100%;
    object-fit: contain;
    filter: var(--cut-shadow);
    rotate: var(--r, -3deg);
    transition: scale 0.18s, rotate 0.18s;
  }

  .shop-card:nth-child(3n + 2) .shop-card-img img { --r: 4deg; }
  .shop-card:nth-child(3n) .shop-card-img img { --r: -6deg; }

  .shop-card:hover .shop-card-img img,
  .shop-card:focus-visible .shop-card-img img {
    scale: 1.05;
    rotate: calc(var(--r, -3deg) + 2deg);
  }

  /* The file-name caption; picked (blue) on hover, like the landing's gains.png. */
  .shop-card-caption {
    margin-top: 12px;
    padding: 1px 6px;
    border-radius: 4px;
    font-size: 12px;
    line-height: 1.4;
  }

  .shop-card:hover .shop-card-caption,
  .shop-card:focus-visible .shop-card-caption {
    background: var(--blue);
    color: #fff;
  }

  .shop-card:focus-visible {
    outline: none;
  }

  .shop-card-price {
    font-size: 14px;
    font-weight: 700;
    letter-spacing: -0.01em;
  }

  .shop-card-stock {
    color: var(--faint);
    font-weight: 500;
  }

  .shop-card-stock.low {
    color: var(--red);
  }

  .shop-card-featured .shop-card-caption {
    background: var(--hi);
  }

  /* Spotlight: one big cutout, like a hero object. */
  .shop-spotlight {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    align-items: center;
    gap: 32px;
    width: 100%;
    margin-top: 56px;
    padding: 0;
    border: 0;
    background: none;
    color: var(--ink);
    text-align: left;
    cursor: pointer;
  }

  .shop-spotlight-img img {
    width: 100%;
    max-height: 300px;
    object-fit: contain;
    filter: var(--cut-shadow);
    rotate: 4deg;
    transition: scale 0.18s;
  }

  .shop-spotlight:hover .shop-spotlight-img img {
    scale: 1.04;
  }

  .shop-spotlight-body {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .shop-spotlight-kicker {
    color: var(--blue);
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.18em;
    text-transform: uppercase;
  }

  .shop-spotlight-name {
    font-size: clamp(28px, 3.4vw, 44px);
    font-weight: 900;
    line-height: 0.95;
    letter-spacing: -0.05em;
  }

  .shop-spotlight-desc {
    color: var(--muted);
    font-size: 15px;
  }

  /* Black market: a dashed, locked shelf. */
  .shop-bm-section {
    margin-top: 72px;
    padding: 0 24px 36px;
    border: 1.5px dashed var(--faint);
    border-radius: 16px;
  }

  .shop-bm-note {
    margin: 0;
    color: var(--muted);
    font-size: 14px;
  }

  .shop-bm-section.locked .shop-card-bm .shop-card-img img {
    filter: grayscale(1) blur(3px);
    opacity: 0.45;
  }

  .shop-bm-lock {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    color: var(--ink);
  }

  .lock-icon-lg {
    width: 30px;
    height: 30px;
  }

  .shop-card-skeleton {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    animation: skeleton-pulse 1.4s ease-in-out infinite;
  }

  @keyframes skeleton-pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }

  .shop-card-skeleton .skeleton-img {
    width: 70%;
    height: 150px;
    border-radius: 12px;
    background: #e4e0d8;
  }

  .shop-card-skeleton .skeleton-line {
    width: 50%;
    height: 10px;
    border-radius: 5px;
    background: #e4e0d8;
  }

  /* ── orders: a receipt printing out of a thermal printer ── */
  .printer-stage {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding-top: 12px;
  }

  .receipt {
    position: relative;
    z-index: 1;
    width: min(100%, 236px);
    margin-bottom: -21px;
    translate: 22px 0;
    padding: 26px 22px 40px;
    background: #fff;
    color: #1d1d1f;
    font-variant-numeric: tabular-nums;
    box-shadow: 0 2px 6px rgb(0 0 0 / 0.08);
    /* Torn-off zigzag top edge. */
    -webkit-mask: conic-gradient(from 135deg at top, transparent, #000 1deg 89deg, transparent 90deg) top / 14px 8px repeat-x, linear-gradient(#000, #000) bottom / 100% calc(100% - 7px) no-repeat;
    mask: conic-gradient(from 135deg at top, transparent, #000 1deg 89deg, transparent 90deg) top / 14px 8px repeat-x, linear-gradient(#000, #000) bottom / 100% calc(100% - 7px) no-repeat;
    transform-origin: 50% 100%;
    animation: print-out 1.8s steps(14, end) both;
  }

  @keyframes print-out {
    from { translate: 22px 70%; clip-path: inset(0 0 70% 0); }
    to { translate: 22px 0; clip-path: inset(0 0 0 0); }
  }

  @media (prefers-reduced-motion: reduce) {
    .receipt {
      animation: none;
    }
  }

  .printer {
    position: relative;
    z-index: 2;
    width: 340px;
    height: 104px;
    border-radius: 22px 22px 8px 8px;
    background: linear-gradient(#2c2c2e, #121214 70%);
    box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.12), 0 22px 30px -14px rgb(0 0 0 / 0.5);
  }

  /* The paper slot the receipt feeds out of. */
  .printer-slot {
    position: absolute;
    top: 16px;
    left: 70px;
    right: 26px;
    height: 10px;
    border-radius: 4px;
    background: #050506;
    box-shadow: inset 0 2px 3px rgb(0 0 0 / 0.8), 0 1px 0 rgb(255 255 255 / 0.08);
  }

  .printer-panel {
    position: absolute;
    top: 12px;
    left: 16px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 5px;
    width: 38px;
    height: 80px;
    padding-top: 10px;
    border-radius: 8px;
    background: #1b1b1d;
    box-shadow: inset 0 0 0 1px rgb(255 255 255 / 0.05);
  }

  .printer-panel i {
    width: 18px;
    height: 3px;
    border-radius: 2px;
    background: #d9d9d9;
  }

  .printer-panel b {
    width: 18px;
    height: 2px;
    border-radius: 1px;
    background: var(--red);
  }

  .printer-panel em {
    width: 14px;
    height: 14px;
    margin-top: 10px;
    border: 1.5px solid #4a4a4e;
    border-radius: 50%;
  }

  .receipt-head {
    margin: 0;
    font-size: 20px;
    font-weight: 900;
    letter-spacing: -0.05em;
    text-align: center;
  }

  .receipt-sub {
    margin: 2px 0 14px;
    padding-bottom: 12px;
    border-bottom: 1.5px dashed #b9b6ae;
    color: #77746d;
    font-size: 11px;
    text-align: center;
  }

  .receipt .my-orders-empty {
    color: #1d1d1f;
    text-align: center;
  }

  .my-orders-error {
    margin: 0 0 12px;
    color: var(--red);
    font-size: 13px;
  }

  .my-orders-list {
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .my-orders-row {
    display: grid;
    grid-template-columns: 1fr auto;
    align-items: baseline;
    column-gap: 12px;
    padding: 8px 0;
  }

  .my-orders-info {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .my-orders-name {
    font-size: 13px;
    font-weight: 700;
  }

  .my-orders-meta {
    color: #8a877f;
    font-size: 11px;
  }

  .my-orders-price {
    font-size: 13px;
    font-weight: 700;
  }

  .my-orders-actions {
    grid-column: 1 / -1;
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 3px;
  }

  .my-orders-status {
    color: #77746d;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.14em;
    text-transform: uppercase;
  }

  .my-orders-status.pending { color: #c97f06; }
  .my-orders-status.fulfilled { color: #35b25a; }

  .my-orders-refund {
    padding: 0;
    border: 0;
    background: none;
    color: var(--blue);
    font-size: 11px;
    font-weight: 600;
    text-decoration: underline;
    text-underline-offset: 2px;
    cursor: pointer;
  }

  .my-orders-refund:disabled {
    opacity: 0.5;
    cursor: default;
  }

  .receipt-total {
    display: flex;
    justify-content: space-between;
    margin: 8px 0 0;
    padding-top: 10px;
    border-top: 1.5px dashed #b9b6ae;
    font-size: 14px;
    font-weight: 900;
    letter-spacing: -0.02em;
  }

  .receipt-bars {
    display: block;
    height: 30px;
    margin-top: 16px;
    background: repeating-linear-gradient(90deg, #1d1d1f 0 2px, transparent 2px 5px, #1d1d1f 5px 6px, transparent 6px 9px, #1d1d1f 9px 13px, transparent 13px 15px);
  }

  @media (max-width: 760px) {
    .shop-spotlight {
      grid-template-columns: 1fr;
    }

    .shop-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 36px 12px;
    }

    .shop-card-img {
      height: 130px;
    }

    .printer {
      width: 300px;
    }
  }

  /* ── shop modal: a product sheet ── */
  .shop-modal-overlay,
  .order-note-overlay {
    position: fixed;
    inset: 0;
    z-index: 10000;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
    background: rgb(0 0 0 / 0.4);
    backdrop-filter: blur(4px);
    animation: fadeIn 0.15s ease;
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  .shop-modal {
    position: relative;
    width: 100%;
    max-width: 860px;
    max-height: calc(100vh - 40px);
    overflow-y: auto;
    background: #fbfaf8;
    border-radius: 14px;
    box-shadow: var(--window-shadow);
    color: var(--text);
    animation: modalSlide 0.2s ease;
  }

  @media (prefers-reduced-motion: reduce) {
    .shop-modal-overlay,
    .order-note-overlay,
    .shop-modal {
      animation: none;
    }
  }

  @keyframes modalSlide {
    from { opacity: 0; translate: 0 10px; scale: 0.98; }
    to { opacity: 1; translate: 0 0; scale: 1; }
  }

  .shop-modal-close {
    position: absolute;
    top: 14px;
    right: 14px;
    z-index: 1;
    display: grid;
    place-items: center;
    width: 30px;
    height: 30px;
    padding: 0;
    border: 0;
    border-radius: 50%;
    background: rgb(0 0 0 / 0.07);
    color: #3d3b37;
    font-size: 20px;
    line-height: 1;
    cursor: pointer;
  }

  .shop-modal-close:hover {
    background: rgb(0 0 0 / 0.13);
  }

  .shop-modal-content {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  }

  .shop-modal-img {
    display: grid;
    place-items: center;
    padding: 40px;
    background: #f0eee9;
  }

  .shop-modal-img img {
    width: 100%;
    max-height: 340px;
    object-fit: contain;
    filter: drop-shadow(0 10px 14px rgb(0 0 0 / 0.25));
  }

  .shop-modal-details {
    display: flex;
    flex-direction: column;
    gap: 14px;
    padding: 34px 30px 30px;
  }

  .shop-modal-name {
    margin: 0;
    padding-right: 36px;
    font-size: 32px;
    font-weight: 900;
    line-height: 1;
    letter-spacing: -0.05em;
  }

  .shop-modal-desc,
  .shop-modal-detailed-desc {
    margin: -6px 0 0;
    font-size: 15px;
    color: var(--color-text-muted);
  }

  .shop-modal-detailed-desc {
    margin: 0;
    white-space: pre-wrap;
  }

  .shop-modal-price-row {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .shop-modal-price {
    font-size: 22px;
    font-weight: 800;
    letter-spacing: -0.03em;
  }

  .shop-modal-stock {
    font-size: 13px;
    color: var(--color-text-faint);
  }

  .shop-modal-stock.low {
    color: var(--red);
    font-weight: 700;
  }

  .shop-modal-ship {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
    color: var(--color-text-muted);
  }

  .ship-icon {
    width: 18px;
    height: 18px;
  }

  .shop-modal-qty,
  .shop-modal-total {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .shop-modal-qty {
    padding-top: 14px;
    border-top: 1px solid var(--line);
  }

  .shop-modal-qty-label,
  .shop-modal-total {
    font-size: 15px;
    font-weight: 500;
  }

  .qty-input {
    width: 72px;
    padding: 7px 10px;
    border: 0;
    border-radius: 7px;
    background: #fff;
    box-shadow: inset 0 0 0 1px var(--line-strong);
    color: var(--text);
    font-size: 15px;
    text-align: center;
  }

  .shop-modal-total-value {
    font-size: 18px;
    font-weight: 800;
  }

  .shop-modal-buy {
    width: 100%;
    margin-top: 4px;
    padding: 13px 20px;
    border: 0;
    border-radius: 999px;
    background: var(--blue);
    color: #fff;
    font-size: 16px;
    font-weight: 700;
    cursor: pointer;
    transition: background 0.15s;
  }

  .shop-modal-buy:hover:not(:disabled) {
    background: #0f48d9;
  }

  .shop-modal-buy:disabled {
    opacity: 0.6;
    cursor: default;
  }

  .shop-modal-cant-afford {
    padding: 14px 16px;
    border-radius: 10px;
    background: #f0eee9;
    font-size: 14px;
    color: var(--color-text-muted);
  }

  .shop-modal-cant-afford p {
    margin: 0;
  }

  .shop-modal-cant-afford strong {
    color: var(--text);
  }

  .shop-modal-keep-building {
    margin-top: 4px !important;
    color: var(--text);
    font-weight: 700;
  }

  .shop-modal-bm-head {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .lock-icon {
    width: 16px;
    height: 16px;
    flex-shrink: 0;
  }

  /* ── order note popup ── */
  .order-note-modal {
    width: 100%;
    max-width: 440px;
    padding: 24px;
    background: #fbfaf8;
    border-radius: 14px;
    box-shadow: var(--window-shadow);
    color: var(--text);
  }

  .order-note-title {
    margin: 0 0 4px;
    font-size: 20px;
    font-weight: 800;
    letter-spacing: -0.03em;
  }

  .order-note-hint {
    margin: 0 0 14px;
    font-size: 14px;
    color: var(--color-text-muted);
  }

  .order-note-input {
    width: 100%;
    padding: 10px 12px;
    resize: vertical;
    border: 0;
    border-radius: 8px;
    background: #fff;
    box-shadow: inset 0 0 0 1px var(--line-strong);
    color: var(--text);
    font-size: 15px;
  }

  .order-note-count {
    margin-top: 4px;
    font-size: 12px;
    color: var(--color-text-faint);
    text-align: right;
  }

  .order-note-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 16px;
  }

  .order-note-cancel,
  .order-note-confirm {
    padding: 8px 16px;
    border: 0;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
  }

  .order-note-cancel {
    background: rgb(0 0 0 / 0.06);
    color: var(--text);
  }

  .order-note-confirm {
    background: var(--blue);
    color: #fff;
  }

  .order-note-confirm:disabled,
  .order-note-cancel:disabled {
    opacity: 0.5;
    cursor: default;
  }

  @media (max-width: 760px) {
    .shop-spotlight,
    .shop-modal-content {
      grid-template-columns: 1fr;
    }

    .shop-spotlight-img {
      min-height: 200px;
    }

    .shop-modal-img {
      padding: 24px;
    }

    .shop-modal-img img {
      max-height: 220px;
    }

    .shop-modal-details {
      padding: 24px 20px 20px;
    }

    .shop-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 18px 12px;
    }
  }

  /* ── review checklist ─────────────────────────────── */
  .section-review .section-inner {
    max-width: 680px;
    padding: 28px;
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: var(--radius);
    box-shadow: var(--shadow);
  }

  .section-review .section-title {
    padding-right: 48px;
    font-size: clamp(26px, 3vw, 34px);
  }

  .review-note {
    margin: 12px 0 24px;
    font-size: 14px;
    line-height: 1.6;
    color: var(--color-text-muted);
  }

  .review-checklist {
    display: flex;
    flex-direction: column;
    gap: 14px;
    margin-bottom: 24px;
  }

  .review-check {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    font-size: 15px;
    line-height: 1.5;
    color: var(--text);
    cursor: pointer;
    user-select: none;
  }

  .review-check input[type="checkbox"] {
    position: relative;
    flex-shrink: 0;
    width: 18px;
    height: 18px;
    margin: 3px 0 0;
    border: 1.5px solid #a9a59b;
    border-radius: 4px;
    background: var(--well);
    appearance: none;
    cursor: pointer;
    transition: background 0.15s, border-color 0.15s;
  }

  .review-check input[type="checkbox"]:checked {
    background: var(--color-success);
    border-color: var(--color-success);
  }

  .review-check input[type="checkbox"]:checked::after {
    content: '';
    position: absolute;
    left: 5px;
    top: 1px;
    width: 5px;
    height: 10px;
    border: solid var(--pill-fg);
    border-width: 0 2px 2px 0;
    rotate: 45deg;
  }

  .review-submit-btn,
  .review-understood-btn,
  .shipping-portal-btn {
    width: 100%;
    padding: 14px 20px;
    font-size: 16px;
  }

  .review-submit-btn:disabled {
    opacity: 0.35;
    cursor: not-allowed;
    translate: none;
    box-shadow: none;
  }

  /* ── shipping eligibility prompt ────────────────── */
  .shipping-prompt-text {
    margin: 8px 0 20px;
    font-size: 15px;
    line-height: 1.6;
    color: var(--color-text-muted);
  }

  .shipping-prompt-items {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-bottom: 20px;
  }

  .shipping-prompt-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 14px;
    border-radius: 8px;
    font-size: 15px;
  }

  .shipping-prompt-item.missing {
    background: var(--red);
    color: #fff;
  }

  .shipping-prompt-item.done {
    background: #35b25a;
    color: var(--ink);
  }

  .shipping-icon {
    min-width: 18px;
    font-size: 16px;
    font-weight: 700;
    text-align: center;
  }

  .shipping-recheck-btn {
    width: 100%;
    margin-top: 8px;
  }

  .shipping-prompt-note,
  .shipping-prompt-poll {
    margin-top: 12px;
    font-size: 13px;
    line-height: 1.5;
    text-align: center;
    color: var(--color-text-faint);
  }

  .shipping-prompt-poll.shipping-prompt-success {
    color: #1d6b34;
    font-weight: 600;
  }

  /* ── review success state ───────────────────────── */
  .review-success .review-note {
    margin-bottom: 24px;
  }


  /* ── explore ─────────────────────────────────────── */
  .section-explore {
    background: transparent;
  }

  .explore-placeholder {
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  .explore-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 20px;
    opacity: 0.35;
  }

  @media (max-width: 1100px) {
    .explore-grid {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
  }

  .explore-card-skeleton {
    background: rgba(11, 11, 12, 0.06);
    border: 1px solid rgba(11, 11, 12, 0.08);
    padding: 12px;
    border-radius: 4px;
  }

  .skeleton-img {
    width: 100%;
    aspect-ratio: 4 / 3;
    background: rgba(11, 11, 12, 0.06);
    border-radius: 3px;
    margin-bottom: 10px;
  }

  .skeleton-line {
    height: 10px;
    background: rgba(11, 11, 12, 0.08);
    border-radius: 2px;
    margin-bottom: 6px;
  }

  .skeleton-line.wide {
    width: 80%;
  }

  .skeleton-line.narrow {
    width: 50%;
  }

  .explore-grid-live {
    opacity: 1;
  }

  .explore-card {
    background: rgba(0, 0, 0, 0.25);
    border: 1px solid rgba(11, 11, 12, 0.12);
    border-radius: 4px;
    overflow: hidden;
    transition: background 150ms ease;
    cursor: pointer;
    padding: 0;
    text-align: left;
    font: inherit;
    color: inherit;
    width: 100%;
  }

  .explore-card:hover {
    background: rgba(0, 0, 0, 0.35);
  }

  .explore-img-wrap {
    position: relative;
    overflow: hidden;
  }

  .explore-img {
    width: 100%;
    aspect-ratio: 16 / 9;
    object-fit: cover;
    display: block;
  }

  .explore-arrow {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    background: rgba(0, 0, 0, 0.5);
    border: none;
    color: var(--color-text);
    font-size: 22px;
    width: 28px;
    height: 36px;
    cursor: pointer;
    opacity: 0;
    transition: opacity 150ms;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
  }

  .explore-img-wrap:hover .explore-arrow {
    opacity: 1;
  }

  .explore-arrow:hover {
    background: rgba(0, 0, 0, 0.7);
  }

  .explore-arrow-left {
    left: 0;
    border-radius: 0 4px 4px 0;
  }

  .explore-arrow-right {
    right: 0;
    border-radius: 4px 0 0 4px;
  }

  .explore-dots {
    position: absolute;
    bottom: 6px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    gap: 6px;
  }

  .explore-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: rgba(11, 11, 12, 0.3);
    transition: background 150ms;
  }

  .explore-dot-active {
    background: var(--color-text);
  }

  .explore-card-body {
    padding: 10px 12px 12px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .explore-card-header {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .explore-card-name {
    font-size: 17px;
    color: var(--color-text);
    margin: 0;
  }

  .explore-card-type {
    font-size: 9px;
    font-weight: 700;
    color: var(--text);
    background: var(--surface);
    padding: 2px 6px;
  }

  .explore-card-desc {
    font-size: 11px;
    color: rgba(11, 11, 12, 0.7);
    line-height: 1.35;
    margin: 0;
  }

  .explore-card-meta {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 10px;
    color: rgba(11, 11, 12, 0.45);
  }

  .explore-card-hours {
    font-weight: 700;
    color: var(--color-accent);
  }

  .explore-card-links {
    display: flex;
    gap: 8px;
    margin-top: 2px;
  }

  .explore-link {
    font-size: 11px;
    font-weight: 700;
    color: var(--color-accent);
    text-decoration: none;
  }

  .explore-link:hover {
    color: var(--color-text);
  }

  /* ── project detail overlay ──────────────────────── */
  .detail-overlay {
    position: fixed;
    inset: 0;
    z-index: 9999;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
  }

  .detail-backdrop {
    position: absolute;
    inset: 0;
    background: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(4px);
  }

  .detail-panel {
    position: relative;
    background: var(--color-bg-elevated-2);
    border: 2px solid rgba(11, 11, 12, 0.15);
    max-width: 820px;
    width: 100%;
    max-height: 90vh;
    overflow-y: auto;
    padding: 0;
  }

  .detail-close {
    position: absolute;
    top: 16px;
    right: 20px;
    z-index: 10;
    background: rgba(0, 0, 0, 0.5);
    border: 1px solid rgba(11, 11, 12, 0.2);
    color: var(--color-text);
    font-size: 28px;
    width: 40px;
    height: 40px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 150ms;
  }

  .detail-close:hover {
    background: rgba(196, 131, 130, 0.4);
  }

  /* Gallery */
  .detail-gallery {
    display: flex;
    flex-direction: column;
    align-items: center;
    background: rgba(0, 0, 0, 0.3);
  }

  .detail-img-wrap {
    position: relative;
    width: 100%;
    max-height: 460px;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
  }

  .detail-img {
    width: 100%;
    height: 100%;
    max-height: 460px;
    object-fit: contain;
    display: block;
  }

  .detail-no-img {
    height: 200px;
    color: rgba(11, 11, 12, 0.3);
    font-size: 14px;
  }

  .detail-arrow {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    background: rgba(0, 0, 0, 0.5);
    color: var(--color-text);
    border: none;
    font-size: 32px;
    line-height: 1;
    padding: 8px 12px;
    cursor: pointer;
    border-radius: 4px;
    transition: background 0.15s;
    z-index: 2;
  }
  .detail-arrow:hover { background: rgba(0, 0, 0, 0.75); }
  .detail-arrow-left { left: 8px; }
  .detail-arrow-right { right: 8px; }

  .detail-img-dots {
    position: absolute;
    bottom: 10px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    gap: 8px;
  }
  .detail-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.35);
  }
  .detail-dot-active {
    background: var(--color-text);
  }

  /* Info */
  .detail-info {
    padding: 24px 32px 20px;
  }

  .detail-header {
    display: flex;
    align-items: center;
    gap: 14px;
    flex-wrap: wrap;
  }

  .detail-name {
    font-size: 32px;
    color: var(--color-text);
    margin: 0;
  }

  .detail-type {
    font-size: 11px;
    font-weight: 700;
    color: var(--text);
    background: var(--surface);
    padding: 4px 10px;
  }

  .detail-builder {
    font-size: 14px;
    color: rgba(11, 11, 12, 0.5);
    margin: 6px 0 0;
  }

  .detail-hours {
    font-size: 15px;
    font-weight: 700;
    color: var(--color-accent);
    margin: 4px 0 0;
  }

  .detail-desc {
    font-size: 14px;
    color: rgba(11, 11, 12, 0.75);
    line-height: 1.6;
    margin: 16px 0 0;
  }

  /* Chunky action buttons */
  .detail-actions {
    display: flex;
    gap: 16px;
    margin-top: 24px;
    flex-wrap: wrap;
  }

  .detail-btn {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    font-size: 18px;
    font-weight: 700;
    text-decoration: none;
    padding: 16px 32px;
    border: 2px solid;
    cursor: pointer;
    transition: transform 120ms ease, box-shadow 120ms ease, background 120ms ease;
  }

  .detail-btn:hover {
    transform: translateY(-2px) scale(1.02);
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.4);
  }

  .detail-btn:active {
    transform: translateY(1px) scale(0.98);
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
  }

  .detail-btn-demo {
    background: var(--color-accent);
    border-color: var(--color-accent);
    color: #1a1a1a;
  }

  .detail-btn-demo:hover {
    background: #a8c6db;
  }

  .detail-btn-code {
    background: rgba(11, 11, 12, 0.08);
    border-color: rgba(11, 11, 12, 0.2);
    color: var(--color-text);
  }

  .detail-btn-code:hover {
    background: rgba(11, 11, 12, 0.15);
  }

  /* Comments */
  .detail-comments {
    padding: 20px 32px 32px;
    border-top: 1px solid rgba(11, 11, 12, 0.08);
  }

  .detail-comments-title {
    font-size: 22px;
    color: var(--color-text);
    margin: 0 0 16px;
  }

  .detail-comment-form {
    margin-bottom: 20px;
  }

  .detail-comment-input {
    width: 100%;
    box-sizing: border-box;
    background: rgba(0, 0, 0, 0.25);
    border: 1px solid rgba(11, 11, 12, 0.15);
    color: var(--color-text);
    font-size: 13px;
    padding: 12px 14px;
    resize: vertical;
    min-height: 60px;
  }

  .detail-comment-input::placeholder {
    color: rgba(11, 11, 12, 0.3);
  }

  .detail-comment-input:focus {
    outline: none;
    border-color: var(--color-accent);
  }

  .detail-comment-form-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: 8px;
  }

  .detail-comment-charcount {
    font-size: 11px;
    color: rgba(11, 11, 12, 0.3);
  }

  .detail-comment-submit {
    font-size: 15px;
    font-weight: 700;
    background: var(--color-accent);
    color: #1a1a1a;
    border: none;
    padding: 10px 24px;
    cursor: pointer;
    transition: background 120ms, transform 120ms;
  }

  .detail-comment-submit:hover:not(:disabled) {
    background: #a8c6db;
    transform: translateY(-1px);
  }

  .detail-comment-submit:active:not(:disabled) {
    transform: translateY(1px);
  }

  .detail-comment-submit:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .detail-comments-loading,
  .detail-comments-empty {
    font-size: 13px;
    color: rgba(11, 11, 12, 0.35);
    margin: 0;
  }

  .detail-comments-list {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .detail-comment {
    background: rgba(0, 0, 0, 0.2);
    border: 1px solid rgba(11, 11, 12, 0.06);
    padding: 12px 16px;
  }

  .detail-comment-header {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 6px;
  }

  .detail-comment-author {
    font-size: 13px;
    font-weight: 700;
    color: var(--color-text);
  }

  .detail-comment-date {
    font-size: 11px;
    color: rgba(11, 11, 12, 0.3);
  }

  .detail-comment-delete {
    margin-left: auto;
    background: none;
    border: none;
    color: var(--color-danger);
    font-size: 18px;
    cursor: pointer;
    padding: 0 4px;
    opacity: 0.5;
    transition: opacity 120ms;
  }

  .detail-comment-delete:hover {
    opacity: 1;
  }

  .detail-comment-body {
    font-size: 13px;
    color: rgba(11, 11, 12, 0.7);
    line-height: 1.5;
    margin: 0;
    white-space: pre-wrap;
    word-break: break-word;
  }

  .coming-soon {
    margin: 0;
    font-size: clamp(32px, 4vw, 52px);
    color: var(--color-text);
  }

  /* ── settings (Me): one column of hairline rows ──── */
  .settings-win {
    margin-top: 36px;
    overflow: visible;
    background: none;
    box-shadow: none;
  }

  .settings-win > .win-bar {
    display: none;
  }

  .settings-split,
  .settings-side {
    display: contents;
  }

  /* Who you are: avatar beside your name. */
  .me-card {
    order: 0;
    display: flex;
    align-items: center;
    gap: 14px;
    margin: 0 0 8px;
  }

  .me-avatar {
    display: grid;
    place-items: center;
    width: 64px;
    height: 64px;
    border-radius: 50%;
    background: #e6cfd2;
    box-shadow: var(--object-shadow);
    overflow: hidden;
    font-size: 24px;
    font-weight: 800;
    letter-spacing: -0.04em;
  }

  .me-avatar img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .me-card-text {
    display: flex;
    flex-direction: column;
    line-height: 1.3;
  }

  .me-card-text b {
    font-size: 17px;
    font-weight: 700;
    letter-spacing: -0.02em;
  }

  .me-card-text small {
    color: var(--faint);
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.16em;
    text-transform: uppercase;
  }

  .settings-main {
    order: 1;
  }

  .settings-links {
    order: 2;
    display: flex;
    flex-direction: column;
    margin-top: 72px;
    border-top: 1px solid var(--rule);
  }

  .settings-group-title {
    margin: 64px 0 14px;
    font-size: 19px;
    font-weight: 700;
    letter-spacing: -0.02em;
  }

  .settings-group {
    border-top: 1px solid var(--rule);
  }

  .account-fields {
    display: flex;
    flex-direction: column;
  }

  .account-field,
  .pref-toggle {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 16px;
    min-height: 52px;
    border-bottom: 1px solid var(--rule);
  }

  .account-label {
    flex-shrink: 0;
    color: var(--muted);
    font-size: 15px;
  }

  .account-value {
    font-size: 15px;
    font-weight: 500;
    text-align: right;
    overflow-wrap: anywhere;
    font-variant-numeric: tabular-nums;
  }

  .account-link {
    color: var(--ink);
    text-decoration: underline;
    text-decoration-color: var(--rule);
    text-underline-offset: 3px;
  }

  .nickname-form {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .nickname-input {
    width: 180px;
    padding: 6px 0;
    border: 0;
    border-bottom: 1px solid transparent;
    background: transparent;
    color: var(--ink);
    font-size: 15px;
    font-weight: 500;
    text-align: right;
    transition: border-color 0.15s;
  }

  .nickname-input:hover,
  .nickname-input:focus {
    outline: none;
    border-bottom-color: var(--ink);
  }

  .nickname-save {
    flex-shrink: 0;
    padding: 7px 14px;
    border: 0;
    border-radius: 999px;
    background: var(--ink);
    color: #fff;
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;
    transition: translate 0.15s, box-shadow 0.15s;
  }

  .nickname-save:hover:not(:disabled) {
    translate: -2px -2px;
    box-shadow: 3px 3px 0 var(--red);
  }

  .nickname-save:disabled {
    opacity: 0.5;
    cursor: default;
  }

  /* The custom-cursor checkbox, drawn as the landing alarm stack's green toggle. */
  .pref-toggle {
    position: relative;
    cursor: pointer;
  }

  .pref-toggle input[type="checkbox"] {
    position: absolute;
    opacity: 0;
    pointer-events: none;
  }

  .pref-label-text {
    color: var(--muted);
    font-size: 15px;
  }

  .switch {
    position: relative;
    flex-shrink: 0;
    width: 36px;
    height: 22px;
    border-radius: 11px;
    background: #d6d2c8;
    transition: background 0.18s;
  }

  .switch::after {
    content: '';
    position: absolute;
    top: 2px;
    left: 2px;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: #fff;
    box-shadow: 0 1px 2px rgb(0 0 0 / 0.25);
    transition: translate 0.18s;
  }

  .pref-toggle input:checked ~ .switch {
    background: #34c759;
  }

  .pref-toggle input:checked ~ .switch::after {
    translate: 14px 0;
  }

  .pref-toggle input:focus-visible ~ .switch {
    outline: 2px solid var(--blue);
    outline-offset: 2px;
  }

  /* Links: rows with an arrow on the right. */
  .settings-link {
    position: relative;
    display: block;
    padding: 16px 32px 16px 0;
    border-bottom: 1px solid var(--rule);
    text-decoration: none;
  }

  a.settings-link::after {
    content: '↗';
    position: absolute;
    right: 0;
    top: 18px;
    color: var(--faint);
    transition: color 0.15s, translate 0.15s;
  }

  a.settings-link:hover::after {
    color: var(--ink);
    translate: 2px -2px;
  }

  .settings-link-title {
    margin: 0;
    font-size: 15px;
    font-weight: 600;
  }

  .settings-link-desc {
    margin: 2px 0 0;
    color: var(--muted);
    font-size: 13px;
    line-height: 1.45;
  }

  .settings-link-desc a {
    color: var(--ink);
    text-decoration: underline;
    text-underline-offset: 2px;
  }

  .settings-link-logout .settings-link-title {
    color: var(--red);
  }

  /* ── Nav notification dot ────────────────────────── */
  .nav-btn {
    position: relative;
  }

  .nav-notif {
    width: 8px;
    height: 8px;
    margin-left: auto;
    background: var(--red);
    border-radius: 50%;
    pointer-events: none;
  }

  /* ── Shop purchase feedback ──────────────────────── */
  .shop-modal-error {
    margin: 8px 0 0;
    font-size: 14px;
    color: #8a4a49;
    text-align: center;
  }

  .shop-modal-success {
    padding: 14px;
    background: rgba(90, 158, 111, 0.18);
    border: 2px solid var(--color-success);
    font-size: 22px;
    color: #2c4f37;
    text-align: center;
  }

  /* ── responsive ─────────────────────────────────── */
  @media (max-width: 760px) {
    /* Tabs stretch across the top; the corner block moves into the flow. */
    .tabs {
      left: 8px;
      right: 8px;
      gap: 3px;
    }

    .tab {
      flex: 1 1 0;
      width: auto;
      min-width: 0;
      padding: 16px 4px 22px;
      font-size: 12px;
    }

    .tab:hover,
    .tab:focus-visible {
      padding-top: 16px;
    }

    .tab.active {
      padding-top: 24px;
    }

    .meta {
      position: static;
      flex-direction: row;
      flex-wrap: wrap;
      gap: 0 14px;
      margin: 92px 16px 0;
      padding: 0 0 0 12px;
    }

    .section {
      padding: 40px 16px 0;
    }

    .stats {
      grid-template-columns: repeat(2, 1fr);
    }

    .stats div:nth-child(3) {
      border-left: 0;
    }

    .stats div:nth-child(n + 3) {
      border-top: 1px solid var(--rule);
    }

    .stop-body {
      grid-template-columns: 72px minmax(0, 1fr);
      column-gap: 14px;
    }

    .fan,
    .fan img {
      width: 68px;
      height: 46px;
    }

    .sub {
      margin-left: 86px;
    }

    .note-empty {
      position: static;
      width: 100%;
      white-space: normal;
    }

    .note-empty .arr {
      display: none;
    }

    .rows li {
      flex-direction: column;
      gap: 2px;
    }

    .rows li.unread::before {
      left: -12px;
    }

    .foot {
      gap: 22px;
    }

    .explore-grid {
      grid-template-columns: repeat(2, 1fr) !important;
    }

    /* Create / edit form */
    .create-project-form {
      padding: 24px 16px 32px;
    }

    .form-row,
    .form-bottom-row {
      flex-direction: column;
    }

    .form-row {
      display: flex;
      gap: 16px;
    }

    .form-actions {
      margin-left: 0;
      flex-wrap: wrap;
    }

    /* Me: stack label and value so long emails don't split character by character. */
    .account-field {
      flex-direction: column;
      align-items: flex-start;
      gap: 2px;
      padding: 10px 0;
    }

    .account-value {
      text-align: left;
    }

    .nickname-input {
      text-align: left;
    }
  }

</style>
