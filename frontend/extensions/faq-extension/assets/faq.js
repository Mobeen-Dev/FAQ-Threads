(function () {
  if (typeof window.__SHOPIFY_FAQ_WIDGET_BOOTSTRAP__ === "function") {
    window.__SHOPIFY_FAQ_WIDGET_BOOTSTRAP__();
    return;
  }

  const CACHE_TTL_MS = 5 * 60 * 1000;
  const CACHE_KEY_PREFIX = "shopify-faq-widget:v1:";
  const memoryCache = new Map();

  function getCookieValue(name) {
    if (typeof document === "undefined" || !name) return "";
    const escapedName = String(name).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const match = document.cookie.match(new RegExp(`(?:^|; )${escapedName}=([^;]*)`));
    return match ? decodeURIComponent(match[1]) : "";
  }

  function inferCustomerFromStorefrontGlobals() {
    const st = window.__st || {};
    const analyticsPage =
      window.ShopifyAnalytics &&
      window.ShopifyAnalytics.meta &&
      window.ShopifyAnalytics.meta.page
        ? window.ShopifyAnalytics.meta.page
        : {};
    const metaPage = window.meta && window.meta.page ? window.meta.page : {};
    const shopifyCustomer = window.Shopify && window.Shopify.customer ? window.Shopify.customer : {};

    const inferred = {
      id: st.cid || analyticsPage.customerId || metaPage.customerId || shopifyCustomer.id || "",
      email: st.email || shopifyCustomer.email || "",
      name: shopifyCustomer.name || shopifyCustomer.firstName || "",
      phone: shopifyCustomer.phone || "",
      loggedIn: false,
    };

    const hasCustomerCookie = Boolean(getCookieValue("_secure_customer_sig"));
    const hasCustomerSession = Boolean(getCookieValue("customer_account_session_created_at"));
    inferred.loggedIn = Boolean(inferred.id || inferred.email || hasCustomerCookie || hasCustomerSession);

    inferred.id = inferred.id ? String(inferred.id) : "";
    inferred.email = inferred.email ? String(inferred.email) : "";
    inferred.name = inferred.name ? String(inferred.name) : "";
    inferred.phone = inferred.phone ? String(inferred.phone) : "";

    return inferred;
  }

  function resolveCustomerContext(rawCustomer) {
    const inferred = inferCustomerFromStorefrontGlobals();
    const byLiquid = Boolean(rawCustomer && rawCustomer.loggedIn);
    const byLiquidFields = Boolean(
      rawCustomer && (rawCustomer.id || rawCustomer.email || rawCustomer.name || rawCustomer.phone)
    );

    return {
      loggedIn: byLiquid || byLiquidFields || inferred.loggedIn,
      id: (rawCustomer && rawCustomer.id) || inferred.id || "",
      name: (rawCustomer && rawCustomer.name) || inferred.name || "",
      email: (rawCustomer && rawCustomer.email) || inferred.email || "",
      phone: (rawCustomer && rawCustomer.phone) || inferred.phone || "",
    };
  }

  function toInt(value, fallback) {
    const parsed = Number.parseInt(String(value), 10);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function nl2br(value) {
    return escapeHtml(value).replace(/\n/g, "<br>");
  }

  function normalizeFaqWebhookUrl(rawUrl) {
    const trimmed = String(rawUrl || "").trim();
    if (!trimmed) return "";

    const parts = trimmed.split("?");
    const path = parts[0].replace(/\/+$/, "");
    const query = parts[1] ? `?${parts.slice(1).join("?")}` : "";
    const normalizedPath = /\/faq$/i.test(path) ? path : `${path}/faq`;

    return `${normalizedPath}${query}`;
  }

  function buildAnswerWebhookUrl(faqUrl) {
    if (!faqUrl) return "";
    if (/\/faq(\?|$)/i.test(faqUrl)) {
      return faqUrl.replace(/\/faq(\?|$)/i, "/answer$1");
    }
    return `${faqUrl.replace(/\/+$/, "")}/answer`;
  }

  function buildFetchUrl(config) {
    if (!config.webhookFaqUrl) return "";

    let parsedUrl;
    try {
      parsedUrl = new URL(config.webhookFaqUrl);
    } catch {
      parsedUrl = new URL(config.webhookFaqUrl, window.location.origin);
    }

    if (config.sort) parsedUrl.searchParams.set("sort", config.sort);

    // Product-aware filtering for storefront product pages.
    if (config.product.id) parsedUrl.searchParams.set("productId", config.product.id);
    if (config.product.handle) parsedUrl.searchParams.set("productHandle", config.product.handle);

    return parsedUrl.toString();
  }

  function buildCustomerPayload(config) {
    if (!config.customer.loggedIn) return undefined;

    const customer = {};
    if (config.customer.email) customer.email = config.customer.email;
    if (config.customer.name) customer.name = config.customer.name;
    if (config.customer.phone) customer.phone = config.customer.phone;
    if (config.customer.id) customer.id = config.customer.id;

    return Object.keys(customer).length > 0 ? customer : undefined;
  }

  function getCacheKey(config) {
    return [
      CACHE_KEY_PREFIX,
      config.webhookFaqUrl,
      config.product.id || "no-product-id",
      config.product.handle || "no-product-handle",
      config.sort || "votes",
    ].join("|");
  }

  function readCache(cacheKey) {
    const inMemory = memoryCache.get(cacheKey);
    if (inMemory && Date.now() - inMemory.timestamp < CACHE_TTL_MS) return inMemory;

    try {
      const raw = sessionStorage.getItem(cacheKey);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || !Array.isArray(parsed.faqs)) return null;
      if (Date.now() - parsed.timestamp >= CACHE_TTL_MS) return null;
      memoryCache.set(cacheKey, parsed);
      return parsed;
    } catch {
      return null;
    }
  }

  function writeCache(cacheKey, faqs) {
    const payload = { timestamp: Date.now(), faqs };
    memoryCache.set(cacheKey, payload);
    try {
      sessionStorage.setItem(cacheKey, JSON.stringify(payload));
    } catch {
      // Ignore cache write errors (storage disabled/full).
    }
  }

  function clearCache(cacheKey) {
    memoryCache.delete(cacheKey);
    try {
      sessionStorage.removeItem(cacheKey);
    } catch {
      // Ignore.
    }
  }

  async function requestJson(url, options) {
    let response;
    try {
      response = await fetch(url, {
        ...options,
        headers: {
          "Content-Type": "application/json",
          ...(options && options.headers ? options.headers : {}),
        },
        credentials: "same-origin",
      });
    } catch {
      const mixedContentBlocked =
        window.location.protocol === "https:" && /^http:\/\//i.test(String(url || ""));
      if (mixedContentBlocked) {
        throw new Error(
          "Webhook URL is HTTP but this storefront is HTTPS. Use an HTTPS webhook URL."
        );
      }
      throw new Error("Network error. Check that the webhook URL is reachable from your storefront.");
    }

    let data = null;
    try {
      data = await response.json();
    } catch {
      data = null;
    }

    if (!response.ok) {
      const message =
        (data && typeof data.error === "string" && data.error) ||
        `Request failed with status ${response.status}`;
      throw new Error(message);
    }

    return data || {};
  }

  function formatDate(isoString) {
    if (!isoString) return "";
    const date = new Date(isoString);
    if (Number.isNaN(date.getTime())) return "";
    return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(date);
  }

  function getAnswerCount(faq) {
    const answers = Array.isArray(faq.answers) ? faq.answers : [];
    const directAnswer = typeof faq.answer === "string" && faq.answer.trim() ? 1 : 0;
    const fallbackCount = answers.length + directAnswer;

    if (faq && faq._count && typeof faq._count.answers === "number") {
      return Math.max(faq._count.answers, fallbackCount);
    }

    return fallbackCount;
  }

  function getPrimaryAndExtraAnswers(faq) {
    const answers = Array.isArray(faq.answers) ? faq.answers : [];
    const directAnswer = typeof faq.answer === "string" ? faq.answer.trim() : "";

    if (directAnswer) {
      return {
        primary: {
          text: directAnswer,
          source: "official",
          contributorName: "",
          createdAt: faq.createdAt || "",
          pendingLocal: Boolean(faq.pendingLocal),
        },
        extra: answers,
      };
    }

    if (answers.length > 0) {
      const [first, ...rest] = answers;
      return {
        primary: first,
        extra: rest,
      };
    }

    return { primary: null, extra: [] };
  }

  function renderExtraAnswers(extraAnswers, questionId, instance) {
    if (!extraAnswers.length) return "";

    const expanded = instance.state.expandedExtraAnswerIds.has(questionId);
    const maxInline = Math.max(1, instance.config.maxInlineAnswers);
    const visibleAnswers = expanded ? extraAnswers : extraAnswers.slice(0, maxInline);
    const hiddenCount = extraAnswers.length - visibleAnswers.length;

    const answersMarkup = visibleAnswers
      .map((answer) => {
        const byline =
          answer && answer.contributor && answer.contributor.name
            ? `<span class="faq-widget__answer-byline">By ${escapeHtml(answer.contributor.name)}</span>`
            : "";
        const pending = answer && answer.pendingLocal ? '<span class="faq-widget__pending-badge">Pending review</span>' : "";
        return `
          <li class="faq-widget__answer-item">
            <p class="faq-widget__answer-text">${nl2br(answer.answerText || "")}</p>
            <div class="faq-widget__answer-meta">
              ${byline}
              ${pending}
            </div>
          </li>
        `;
      })
      .join("");

    const toggleMarkup =
      extraAnswers.length > maxInline || expanded
        ? `
          <button
            type="button"
            class="faq-widget__link-button"
            data-action="toggle-extra-answers"
            data-question-id="${escapeHtml(questionId)}"
            aria-expanded="${expanded ? "true" : "false"}"
          >
            ${expanded ? "Hide extra answers" : hiddenCount > 0 ? `View ${hiddenCount} more answers` : "View all answers"}
          </button>
        `
        : "";

    return `
      <div class="faq-widget__extra-answers">
        <ul class="faq-widget__answer-list">
          ${answersMarkup}
        </ul>
        ${toggleMarkup}
      </div>
    `;
  }

  function renderAnswerComposer(faq, instance) {
    const questionId = String(faq.id);
    const isOpen = instance.state.openAnswerFormId === questionId;
    const submitting = Boolean(instance.state.submittingAnswerByQuestion[questionId]);

    if (!instance.config.customer.loggedIn) {
      return `
        <div class="faq-widget__composer">
          <button type="button" class="faq-widget__secondary-button" data-action="go-login">
            Log in to contribute an answer
          </button>
        </div>
      `;
    }

    return `
      <div class="faq-widget__composer">
        <button
          type="button"
          class="faq-widget__secondary-button"
          data-action="toggle-answer-form"
          data-question-id="${escapeHtml(questionId)}"
          aria-expanded="${isOpen ? "true" : "false"}"
        >
          ${isOpen ? "Cancel" : "Add your answer"}
        </button>
        ${
          isOpen
            ? `
              <form class="faq-widget__form faq-widget__form--answer" data-form="submit-answer" data-question-id="${escapeHtml(questionId)}">
                <label class="faq-widget__label" for="faq-answer-${escapeHtml(questionId)}">Your answer</label>
                <textarea
                  id="faq-answer-${escapeHtml(questionId)}"
                  name="answerText"
                  class="faq-widget__textarea"
                  rows="3"
                  maxlength="1500"
                  required
                  placeholder="Share a helpful answer for this product..."
                ></textarea>
                <button type="submit" class="faq-widget__primary-button" ${submitting ? "disabled" : ""}>
                  ${submitting ? "Submitting..." : "Submit answer"}
                </button>
              </form>
            `
            : ""
        }
      </div>
    `;
  }

  function renderQuestionItem(faq, instance) {
    const questionId = String(faq.id || "");
    const answerCount = getAnswerCount(faq);
    const { primary, extra } = getPrimaryAndExtraAnswers(faq);
    const pendingBadge = faq.pendingLocal ? '<span class="faq-widget__pending-badge">Pending review</span>' : "";
    const createdAt = formatDate(faq.createdAt);

    return `
      <details class="faq-widget__item" data-question-id="${escapeHtml(questionId)}">
        <summary class="faq-widget__summary" aria-controls="faq-panel-${escapeHtml(questionId)}">
          <span class="faq-widget__summary-title">${escapeHtml(faq.question || "Untitled question")}</span>
          <span class="faq-widget__summary-meta">
            <span class="faq-widget__meta-pill">${answerCount} ${answerCount === 1 ? "answer" : "answers"}</span>
          </span>
        </summary>
        <div class="faq-widget__panel" id="faq-panel-${escapeHtml(questionId)}">
          <div class="faq-widget__meta-row">
            ${pendingBadge}
            ${createdAt ? `<span class="faq-widget__date">${escapeHtml(createdAt)}</span>` : ""}
          </div>

          ${
            primary
              ? `
                <div class="faq-widget__primary-answer">
                  <h3 class="faq-widget__answer-heading">Top answer</h3>
                  <p class="faq-widget__answer-text">${nl2br(primary.answerText || primary.text || "")}</p>
                </div>
              `
              : `
                <p class="faq-widget__no-answer">
                  No published answer yet. Be the first to contribute.
                </p>
              `
          }

          ${renderExtraAnswers(extra, questionId, instance)}
          ${renderAnswerComposer(faq, instance)}
        </div>
      </details>
    `;
  }

  function renderAskQuestionSection(instance) {
    if (!instance.config.customer.loggedIn) {
      return `
        <section class="faq-widget__ask faq-widget__ask--login">
          <h3 class="faq-widget__ask-title">Have a question about this product?</h3>
          <p class="faq-widget__ask-copy">You need to log in to submit a question or answer.</p>
          <button type="button" class="faq-widget__primary-button" data-action="go-login">Log in</button>
        </section>
      `;
    }

    const identity = instance.config.customer.name || instance.config.customer.email || "";
    const authCopy = identity
      ? `You are signed in as ${escapeHtml(identity)}.`
      : "You are signed in and can submit questions.";

    return `
      <section class="faq-widget__ask">
        <h3 class="faq-widget__ask-title">Ask a question</h3>
        <p class="faq-widget__ask-copy">${authCopy}</p>
        <form class="faq-widget__form" data-form="submit-question">
          <label class="faq-widget__label" for="faq-question-input">Question</label>
          <textarea
            id="faq-question-input"
            name="question"
            class="faq-widget__textarea"
            rows="3"
            maxlength="1500"
            required
            placeholder="Ask something specific about this product..."
          ></textarea>
          <button type="submit" class="faq-widget__primary-button" ${instance.state.submittingQuestion ? "disabled" : ""}>
            ${instance.state.submittingQuestion ? "Submitting..." : "Submit question"}
          </button>
        </form>
      </section>
    `;
  }

  function render(instance) {
    const { config, state } = instance;

    if (!config.webhookFaqUrl) {
      instance.root.innerHTML = `
        <div class="faq-widget__inner">
          <header class="faq-widget__header">
            <h2 class="faq-widget__title">${escapeHtml(config.title)}</h2>
            ${config.subtitle ? `<p class="faq-widget__subtitle">${escapeHtml(config.subtitle)}</p>` : ""}
          </header>
          <p class="faq-widget__error" role="alert">
            This FAQ block is not configured yet. Add your webhook URL in the block settings.
          </p>
        </div>
      `;
      return;
    }

    const listMarkup = state.faqs.map((faq) => renderQuestionItem(faq, instance)).join("");
    const emptyMarkup =
      !state.loading && state.faqs.length === 0
        ? '<p class="faq-widget__empty">No published FAQs yet for this product.</p>'
        : "";
    const loadingMarkup =
      state.loading && state.faqs.length === 0
        ? `<p class="faq-widget__status">${escapeHtml(config.loadingText)}</p>`
        : "";
    const noticeMarkup = state.notice ? `<p class="faq-widget__notice" role="status">${escapeHtml(state.notice)}</p>` : "";
    const errorMarkup = state.error
      ? `
        <div class="faq-widget__error-wrap">
          <p class="faq-widget__error" role="alert">${escapeHtml(state.error)}</p>
          <button type="button" class="faq-widget__secondary-button" data-action="retry-load">Try again</button>
        </div>
      `
      : "";

    instance.root.innerHTML = `
      <div class="faq-widget__inner">
        <header class="faq-widget__header">
          <h2 class="faq-widget__title">${escapeHtml(config.title)}</h2>
          ${config.subtitle ? `<p class="faq-widget__subtitle">${escapeHtml(config.subtitle)}</p>` : ""}
        </header>
        ${noticeMarkup}
        ${errorMarkup}
        ${loadingMarkup}
        <div class="faq-widget__list" role="list">
          ${listMarkup || emptyMarkup}
        </div>
        ${renderAskQuestionSection(instance)}
      </div>
    `;
  }

  function redirectToLogin(instance) {
    const target = instance.config.loginUrl || "/account/login";
    window.location.assign(target);
  }

  function mergePendingLocal(existingFaqs, fetchedFaqs) {
    const pendingLocalFaqs = existingFaqs.filter((faq) => faq && faq.pendingLocal);
    if (!pendingLocalFaqs.length) return fetchedFaqs;

    const fetchedIds = new Set(fetchedFaqs.map((faq) => faq.id));
    const pendingNotInFetched = pendingLocalFaqs.filter((faq) => !fetchedIds.has(faq.id));

    return [...pendingNotInFetched, ...fetchedFaqs];
  }

  async function loadFaqs(instance, options = {}) {
    const force = Boolean(options.force);
    const fetchUrl = buildFetchUrl(instance.config);
    if (!fetchUrl) return;

    if (!force) {
      const cached = readCache(instance.cacheKey);
      if (cached) {
        instance.state.faqs = Array.isArray(cached.faqs) ? cached.faqs : [];
        render(instance);
        return;
      }
    }

    instance.state.loading = true;
    instance.state.error = "";
    render(instance);

    try {
      const data = await requestJson(fetchUrl);
      const fetchedFaqs = Array.isArray(data.faqs) ? data.faqs : [];
      instance.state.faqs = mergePendingLocal(instance.state.faqs, fetchedFaqs);
      writeCache(instance.cacheKey, instance.state.faqs);
    } catch (error) {
      instance.state.error = error instanceof Error ? error.message : "Failed to load FAQs.";
    } finally {
      instance.state.loading = false;
      render(instance);
    }
  }

  async function handleSubmitQuestion(instance, form) {
    if (!instance.config.customer.loggedIn) {
      redirectToLogin(instance);
      return;
    }

    const textarea = form.querySelector('textarea[name="question"]');
    const questionText = textarea ? textarea.value.trim() : "";
    if (questionText.length < 5) {
      instance.state.error = "Please enter at least 5 characters for your question.";
      render(instance);
      return;
    }

    const tempId = `local-question-${Date.now()}`;
    const optimisticQuestion = {
      id: tempId,
      question: questionText,
      answer: "",
      answers: [],
      _count: { answers: 0 },
      createdAt: new Date().toISOString(),
      pendingLocal: true,
    };

    instance.state.submittingQuestion = true;
    instance.state.error = "";
    instance.state.notice = "Submitting your question...";
    instance.state.faqs = [optimisticQuestion, ...instance.state.faqs];
    render(instance);

    const customerPayload = buildCustomerPayload(instance.config);
    const payload = {
      question: questionText,
      customer: customerPayload,
      productId: instance.config.product.id || undefined,
      productHandle: instance.config.product.handle || undefined,
      productTitle: instance.config.product.title || undefined,
      productUrl: instance.config.product.url || undefined,
    };

    if (!payload.customer) delete payload.customer;
    textarea.value = "";

    try {
      const data = await requestJson(instance.config.webhookFaqUrl, {
        method: "POST",
        body: JSON.stringify(payload),
      });

      const status = data && typeof data.status === "string" ? data.status : "pending";
      const serverQuestionId = data && data.questionId ? String(data.questionId) : tempId;

      if (status === "published") {
        instance.state.notice = "Your question was posted.";
        instance.state.faqs = instance.state.faqs.filter((faq) => faq.id !== tempId);
        clearCache(instance.cacheKey);
        instance.state.submittingQuestion = false;
        await loadFaqs(instance, { force: true });
        return;
      }

      instance.state.notice = "Your question was submitted and is awaiting review.";
      instance.state.faqs = instance.state.faqs.map((faq) =>
        faq.id === tempId ? { ...faq, id: serverQuestionId } : faq
      );
    } catch (error) {
      instance.state.faqs = instance.state.faqs.filter((faq) => faq.id !== tempId);
      instance.state.error = error instanceof Error ? error.message : "Failed to submit question.";
      instance.state.notice = "";
    } finally {
      instance.state.submittingQuestion = false;
      render(instance);
    }
  }

  function incrementAnswerCount(faq) {
    const current = faq && faq._count && typeof faq._count.answers === "number" ? faq._count.answers : null;
    const answers = Array.isArray(faq.answers) ? faq.answers : [];
    const next = current === null ? answers.length + 1 : current + 1;
    return { ...(faq._count || {}), answers: next };
  }

  async function handleSubmitAnswer(instance, form) {
    if (!instance.config.customer.loggedIn) {
      redirectToLogin(instance);
      return;
    }

    const questionId = String(form.dataset.questionId || "");
    const textarea = form.querySelector('textarea[name="answerText"]');
    const answerText = textarea ? textarea.value.trim() : "";

    if (!questionId) return;
    if (answerText.length < 3) {
      instance.state.error = "Please enter at least 3 characters for your answer.";
      render(instance);
      return;
    }

    const tempAnswerId = `local-answer-${Date.now()}`;
    const tempAnswer = {
      id: tempAnswerId,
      answerText,
      voteScore: 0,
      contributor: { name: instance.config.customer.name || "You" },
      createdAt: new Date().toISOString(),
      pendingLocal: true,
    };

    const previousFaqs = instance.state.faqs;
    instance.state.submittingAnswerByQuestion[questionId] = true;
    instance.state.error = "";
    instance.state.notice = "Submitting your answer...";
    instance.state.openAnswerFormId = "";
    instance.state.faqs = previousFaqs.map((faq) =>
      String(faq.id) === questionId
        ? {
            ...faq,
            answers: [...(Array.isArray(faq.answers) ? faq.answers : []), tempAnswer],
            _count: incrementAnswerCount(faq),
          }
        : faq
    );
    render(instance);

    const customerPayload = buildCustomerPayload(instance.config);
    const payload = {
      questionId,
      answerText,
      customer: customerPayload,
      productId: instance.config.product.id || undefined,
      productHandle: instance.config.product.handle || undefined,
    };
    if (!payload.customer) delete payload.customer;
    textarea.value = "";

    try {
      const data = await requestJson(instance.config.webhookAnswerUrl, {
        method: "POST",
        body: JSON.stringify(payload),
      });

      const status = data && typeof data.status === "string" ? data.status : "pending";
      if (status === "published") {
        instance.state.notice = "Your answer was posted.";
        clearCache(instance.cacheKey);
        delete instance.state.submittingAnswerByQuestion[questionId];
        await loadFaqs(instance, { force: true });
        return;
      }

      instance.state.notice = "Your answer was submitted and is awaiting review.";
    } catch (error) {
      instance.state.faqs = previousFaqs;
      instance.state.error = error instanceof Error ? error.message : "Failed to submit answer.";
      instance.state.notice = "";
    } finally {
      delete instance.state.submittingAnswerByQuestion[questionId];
      render(instance);
    }
  }

  function bindEvents(instance) {
    if (instance.eventsBound) return;
    instance.eventsBound = true;

    instance.root.addEventListener("click", (event) => {
      const actionTarget = event.target.closest("[data-action]");
      if (!actionTarget) return;

      const action = actionTarget.getAttribute("data-action");

      if (action === "go-login") {
        event.preventDefault();
        redirectToLogin(instance);
        return;
      }

      if (action === "retry-load") {
        event.preventDefault();
        void loadFaqs(instance, { force: true });
        return;
      }

      if (action === "toggle-extra-answers") {
        event.preventDefault();
        const questionId = String(actionTarget.getAttribute("data-question-id") || "");
        if (!questionId) return;
        if (instance.state.expandedExtraAnswerIds.has(questionId)) {
          instance.state.expandedExtraAnswerIds.delete(questionId);
        } else {
          instance.state.expandedExtraAnswerIds.add(questionId);
        }
        render(instance);
        return;
      }

      if (action === "toggle-answer-form") {
        event.preventDefault();
        const questionId = String(actionTarget.getAttribute("data-question-id") || "");
        if (!questionId) return;
        instance.state.openAnswerFormId =
          instance.state.openAnswerFormId === questionId ? "" : questionId;
        render(instance);
      }
    });

    instance.root.addEventListener("submit", (event) => {
      const form = event.target;
      if (!(form instanceof HTMLFormElement)) return;

      const formType = form.getAttribute("data-form");
      if (!formType) return;

      event.preventDefault();

      if (formType === "submit-question") {
        void handleSubmitQuestion(instance, form);
        return;
      }

      if (formType === "submit-answer") {
        void handleSubmitAnswer(instance, form);
      }
    });

    // Keep the accordion behavior: one open question at a time.
    instance.root.addEventListener(
      "toggle",
      (event) => {
        const target = event.target;
        if (!(target instanceof HTMLDetailsElement)) return;
        if (!target.classList.contains("faq-widget__item") || !target.open) return;

        instance.root.querySelectorAll("details.faq-widget__item[open]").forEach((details) => {
          if (details !== target) details.open = false;
        });
      },
      true
    );
  }

  function startInstance(instance) {
    if (instance.started) return;
    instance.started = true;

    bindEvents(instance);
    render(instance);
    void loadFaqs(instance);
  }

  function setupLazyLoad(instance) {
    if (!instance.config.webhookFaqUrl) {
      render(instance);
      return;
    }

    if (!("IntersectionObserver" in window)) {
      startInstance(instance);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const isVisible = entries.some((entry) => entry.isIntersecting);
        if (!isVisible) return;
        observer.disconnect();
        startInstance(instance);
      },
      {
        rootMargin: instance.config.lazyRootMargin,
        threshold: 0.01,
      }
    );

    observer.observe(instance.root);
    instance.observer = observer;
  }

  function createInstance(root) {
    const rawCustomer = {
      loggedIn: String(root.dataset.customerLoggedIn || "") === "true",
      id: root.dataset.customerId || "",
      name: root.dataset.customerName || "",
      email: root.dataset.customerEmail || "",
      phone: root.dataset.customerPhone || "",
    };

    const config = {
      root,
      webhookFaqUrl: normalizeFaqWebhookUrl(root.dataset.webhookUrl || ""),
      webhookAnswerUrl: "",
      product: {
        id: root.dataset.productId || "",
        handle: root.dataset.productHandle || "",
        title: root.dataset.productTitle || "",
        url: root.dataset.productUrl || "",
      },
      customer: resolveCustomerContext(rawCustomer),
      loginUrl: root.dataset.loginUrl || "/account/login",
      title: root.dataset.title || "Product FAQs",
      subtitle: root.dataset.subtitle || "",
      sort: root.dataset.sort || "votes",
      maxInlineAnswers: Math.min(Math.max(toInt(root.dataset.maxInlineAnswers, 2), 1), 5),
      lazyRootMargin: root.dataset.lazyRootMargin || "220px 0px",
      loadingText: root.dataset.loadingText || "Loading frequently asked questions...",
    };

    config.webhookAnswerUrl = buildAnswerWebhookUrl(config.webhookFaqUrl);

    return {
      root,
      config,
      cacheKey: getCacheKey(config),
      started: false,
      eventsBound: false,
      observer: null,
      state: {
        loading: false,
        error: "",
        notice: "",
        faqs: [],
        submittingQuestion: false,
        submittingAnswerByQuestion: {},
        openAnswerFormId: "",
        expandedExtraAnswerIds: new Set(),
      },
    };
  }

  function isStaticShellRoot(root) {
    return Boolean(root.querySelector(".faq-widget__shell")) && !Boolean(root.querySelector(".faq-widget__inner"));
  }

  function bootstrap() {
    const roots = document.querySelectorAll('[data-faq-root="true"]');
    roots.forEach((root) => {
      const existingInstance = root.__faqWidgetInstance;
      if (existingInstance) {
        if (isStaticShellRoot(root)) {
          if (existingInstance.observer) {
            existingInstance.observer.disconnect();
            existingInstance.observer = null;
          }
          if (existingInstance.started) {
            render(existingInstance);
            if (existingInstance.config.webhookFaqUrl) {
              void loadFaqs(existingInstance, { force: true });
            }
          } else {
            startInstance(existingInstance);
          }
        }
        return;
      }

      const instance = createInstance(root);
      root.__faqWidgetInstance = instance;
      setupLazyLoad(instance);
    });
  }

  let bootstrapScheduled = false;
  function scheduleBootstrap() {
    if (bootstrapScheduled) return;
    bootstrapScheduled = true;
    const run = function () {
      bootstrapScheduled = false;
      bootstrap();
    };
    if (typeof window.requestAnimationFrame === "function") {
      window.requestAnimationFrame(run);
    } else {
      window.setTimeout(run, 0);
    }
  }

  function bindShopifyLifecycleHooks() {
    if (window.__SHOPIFY_FAQ_WIDGET_EVENTS_BOUND__) return;
    window.__SHOPIFY_FAQ_WIDGET_EVENTS_BOUND__ = true;

    ["shopify:section:load", "shopify:section:select", "shopify:block:select", "shopify:section:reorder"].forEach(
      (eventName) => {
        document.addEventListener(eventName, scheduleBootstrap);
      }
    );
  }

  function observeWidgetRoots() {
    if (window.__SHOPIFY_FAQ_WIDGET_OBSERVER__) return;
    if (typeof MutationObserver !== "function") return;
    const observer = new MutationObserver((mutations) => {
      let shouldBootstrap = false;

      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (!(node instanceof Element)) continue;
          if (node.matches('[data-faq-root="true"]') || node.querySelector('[data-faq-root="true"]')) {
            shouldBootstrap = true;
            break;
          }
        }
        if (shouldBootstrap) break;
      }

      if (shouldBootstrap) scheduleBootstrap();
    });

    observer.observe(document.documentElement, { childList: true, subtree: true });
    window.__SHOPIFY_FAQ_WIDGET_OBSERVER__ = observer;
  }

  window.__SHOPIFY_FAQ_WIDGET_BOOTSTRAP__ = scheduleBootstrap;
  bindShopifyLifecycleHooks();
  observeWidgetRoots();

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", scheduleBootstrap, { once: true });
  } else {
    scheduleBootstrap();
  }
})();
