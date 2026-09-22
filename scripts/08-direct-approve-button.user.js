// ==UserScript==
// @name         GitHub - Direct Pull Request Approve Button
// @namespace    https://github.com/bwcampbell9/better-github
// @version      1.1.0
// @description  Adds a one-click Approve button to every PR tab without navigating to Files changed.
// @author       Bryce Campbell
// @license      MIT
// @icon         https://github.githubassets.com/pinned-octocat.svg
// @match        *://*/*
// @homepageURL  https://github.com/bwcampbell9/better-github
// @supportURL   https://github.com/bwcampbell9/better-github/issues
// @downloadURL  https://raw.githubusercontent.com/bwcampbell9/better-github/refs/heads/users/brycampbell/main/scripts/08-direct-approve-button.user.js
// @updateURL    https://raw.githubusercontent.com/bwcampbell9/better-github/refs/heads/users/brycampbell/main/scripts/08-direct-approve-button.user.js
// @grant        GM_addStyle
// @run-at       document-idle
// @noframes
// ==/UserScript==

(function () {
    'use strict';

    function isGitHubPage() {
        return (
            location.hostname === 'github.com' ||
            Boolean(
                document.querySelector(
                    'meta[name="octolytics-host"], ' +
                    'meta[name="route-pattern"], ' +
                    'meta[name="github-keyboard-shortcuts"], ' +
                    'meta[name="expected-hostname"]'
                )
            )
        );
    }

    if (!isGitHubPage()) {
        return;
    }

    const buttonId = 'tm-direct-approve-button';
    const controlSelector = 'button, summary, [role="button"]';
    const buttonLabels = {
        idle: 'Approve',
        submitting: 'Approving\u2026',
        approved: 'Approved',
        failed: 'Approval failed'
    };

    let currentPullRequestKey = null;
    let approvalState = 'idle';
    let stateMessage = '';
    let scheduled = false;

    GM_addStyle(`
#${buttonId} {
    box-sizing: border-box;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 82px;
    height: 32px;
    padding: 0 12px;
    color: var(--button-primary-fgColor-rest, var(--color-btn-primary-text, #fff));
    font: inherit;
    font-size: 14px;
    font-weight: 600;
    line-height: 20px;
    white-space: nowrap;
    cursor: pointer;
    appearance: none;
    background: var(--button-primary-bgColor-rest, var(--color-btn-primary-bg, #238636));
    border: 1px solid var(--button-primary-borderColor-rest, var(--color-btn-primary-border, rgba(240, 246, 252, 0.1)));
    border-radius: 6px;
    box-shadow: var(--button-default-shadow-resting, var(--color-btn-shadow, 0 1px 0 rgba(27, 31, 36, 0.1)));
}

#${buttonId}:hover:not(:disabled) {
    background: var(--button-primary-bgColor-hover, var(--color-btn-primary-hover-bg, #2ea043));
}

#${buttonId}:focus-visible {
    outline: 2px solid var(--focus-outlineColor, var(--color-accent-fg, #0969da));
    outline-offset: 2px;
}

#${buttonId}:disabled {
    cursor: default;
    opacity: 0.65;
}

#${buttonId}[data-state="failed"] {
    color: var(--button-danger-fgColor-rest, var(--color-btn-danger-text, #cf222e));
    background: var(--button-default-bgColor-rest, var(--color-btn-bg, #f6f8fa));
    border-color: var(--button-danger-borderColor-rest, var(--color-btn-danger-border, rgba(27, 31, 36, 0.15)));
}
`);

    function pullRequestContext() {
        const match = location.pathname.match(
            /^\/([^/]+)\/([^/]+)\/pull\/(\d+)(?:\/|$)/
        );

        if (!match) {
            return null;
        }

        const basePath =
            `/${match[1]}/${match[2]}/pull/${match[3]}`;

        return {
            basePath,
            key: `${location.host}${basePath}`
        };
    }

    function normalizedText(element) {
        return (element.textContent || '')
            .replace(/\s+/g, ' ')
            .trim();
    }

    function controlTexts(element) {
        return [
            normalizedText(element),
            element.getAttribute('aria-label') || '',
            element.getAttribute('title') || ''
        ]
            .map((text) => text.replace(/\s+/g, ' ').trim())
            .filter(Boolean);
    }

    function matchesControl(element, pattern) {
        return controlTexts(element).some((text) =>
            pattern.test(text)
        );
    }

    function isChecksControl(element) {
        return matchesControl(
            element,
            /^(?=.*\bchecks?\b)(?=.*(?:pending|waiting|queued|progress|fail|error|neutral|pass|success|complete|skipped)|checks?$)/i
        );
    }

    function isVisible(element) {
        const rectangle = element.getBoundingClientRect();
        const style = getComputedStyle(element);

        return (
            rectangle.width > 0 &&
            rectangle.height > 0 &&
            style.display !== 'none' &&
            style.visibility !== 'hidden'
        );
    }

    function directChildOf(element, ancestor) {
        let current = element;

        while (
            current.parentElement &&
            current.parentElement !== ancestor
        ) {
            current = current.parentElement;
        }

        return current.parentElement === ancestor
            ? current
            : null;
    }

    function placementFor(codeControl) {
        const fallback = {
            container: codeControl.parentElement,
            insertionPoint: codeControl,
            hasChecksControl: false
        };
        let ancestor = codeControl.parentElement;

        for (
            let depth = 0;
            ancestor && depth < 8;
            depth += 1, ancestor = ancestor.parentElement
        ) {
            const hasChecksControl = [
                ...ancestor.querySelectorAll(controlSelector)
            ].some(
                (control) =>
                    control !== codeControl &&
                    isChecksControl(control)
            );

            if (!hasChecksControl) {
                continue;
            }

            const insertionPoint = directChildOf(
                codeControl,
                ancestor
            );

            return insertionPoint
                ? {
                    container: ancestor,
                    insertionPoint,
                    hasChecksControl: true
                }
                : fallback;
        }

        return fallback;
    }

    function findButtonPlacement() {
        let best = null;

        for (
            const codeControl of document.querySelectorAll(
                controlSelector
            )
        ) {
            if (
                codeControl.id === buttonId ||
                !matchesControl(codeControl, /^code$/i)
            ) {
                continue;
            }

            const placement = placementFor(codeControl);

            if (
                !placement.container ||
                !placement.insertionPoint
            ) {
                continue;
            }

            const rectangle =
                codeControl.getBoundingClientRect();
            let score = 0;

            if (isVisible(codeControl)) {
                score += 100;
            }

            if (placement.hasChecksControl) {
                score += 80;
            }

            if (rectangle.top >= 0 && rectangle.top < 500) {
                score += 20;
            }

            if (
                codeControl.closest(
                    '[data-testid*="pull"], ' +
                    '[class*="PullRequest"], ' +
                    '.gh-header-actions'
                )
            ) {
                score += 20;
            }

            if (!best || score > best.score) {
                best = {
                    ...placement,
                    score
                };
            }
        }

        return best;
    }

    function renderButton(button) {
        const label = buttonLabels[approvalState];
        const disabled =
            approvalState === 'submitting' ||
            approvalState === 'approved';

        if (button.textContent !== label) {
            button.textContent = label;
        }

        button.dataset.state = approvalState;
        button.disabled = disabled;
        button.setAttribute(
            'aria-busy',
            approvalState === 'submitting'
                ? 'true'
                : 'false'
        );
        button.title =
            stateMessage ||
            'Approve this pull request without leaving this tab';
    }

    function setApprovalState(state, message = '') {
        approvalState = state;
        stateMessage = message;

        const button = document.getElementById(buttonId);

        if (button) {
            renderButton(button);
        }
    }

    function changedFilesUrls(context) {
        const urls = new Set();

        for (const link of document.querySelectorAll('a[href]')) {
            const url = new URL(link.href, location.href);
            const path = url.pathname.replace(/\/$/, '');

            if (
                url.origin === location.origin &&
                (
                    path === `${context.basePath}/changes` ||
                    path === `${context.basePath}/files`
                )
            ) {
                urls.add(url.href);
            }
        }

        for (const suffix of [
            location.pathname.match(
                /\/pull\/\d+\/(files|changes)(?:\/|$)/
            )?.[1],
            'files',
            'changes'
        ]) {
            if (!suffix) {
                continue;
            }

            urls.add(
                new URL(
                    `${context.basePath}/${suffix}`,
                    location.origin
                ).href
            );
        }

        return [...urls];
    }

    function isSignInPage(response, page) {
        const path = new URL(response.url).pathname;

        return (
            /\/(?:login|session|sso)(?:\/|$)/i.test(path) ||
            Boolean(
                page.querySelector(
                    'form[action*="/session"], ' +
                    'input[name="login"], ' +
                    'input[autocomplete="username"]'
                )
            )
        );
    }

    async function fetchReviewForm(context) {
        let lastError = null;

        for (const url of changedFilesUrls(context)) {
            try {
                const response = await fetch(url, {
                    credentials: 'same-origin',
                    cache: 'no-store',
                    headers: {
                        Accept:
                            'text/html,application/xhtml+xml'
                    }
                });

                if (response.status === 404) {
                    continue;
                }

                const html = await response.text();
                const page = new DOMParser().parseFromString(
                    html,
                    'text/html'
                );

                if (isSignInPage(response, page)) {
                    throw new Error(
                        'Your GitHub session has expired. ' +
                        'Sign in again and retry.'
                    );
                }

                if (!response.ok) {
                    throw new Error(
                        `GitHub returned ${response.status} ` +
                        'while preparing the approval.'
                    );
                }

                const reviewForm = page.querySelector(
                    'form#pull_requests_submit_review'
                );

                if (!reviewForm) {
                    lastError = new Error(
                        'GitHub did not include its review form ' +
                        `on ${new URL(url).pathname}.`
                    );
                    continue;
                }

                const approveOption = reviewForm.querySelector(
                    '[name="pull_request_review[event]"]' +
                    '[value="approve"]'
                );

                if (
                    approveOption?.disabled ||
                    approveOption?.getAttribute(
                        'aria-disabled'
                    ) === 'true'
                ) {
                    throw new Error(
                        'GitHub does not allow this account to ' +
                        'approve this pull request.'
                    );
                }

                return {
                    reviewForm,
                    sourceUrl: response.url || url
                };
            } catch (error) {
                if (
                    error instanceof Error &&
                    /session has expired|does not allow/i.test(
                        error.message
                    )
                ) {
                    throw error;
                }

                lastError = error;
            }
        }

        if (lastError instanceof TypeError) {
            throw new Error(
                'Could not load GitHub\u2019s review form. ' +
                'Check that you are signed in and retry.'
            );
        }

        throw (
            lastError ||
            new Error(
                'Could not load GitHub\u2019s review form.'
            )
        );
    }

    function buildReviewRequest(
        context,
        reviewForm,
        sourceUrl
    ) {
        const authenticityToken =
            reviewForm.querySelector(
                'input[name="authenticity_token"]'
            )?.value;
        const headSha = reviewForm.querySelector(
            'input[name="head_sha"]'
        )?.value;

        if (!authenticityToken || !headSha) {
            throw new Error(
                'GitHub\u2019s review form is missing required ' +
                'security fields.'
            );
        }

        const action = new URL(
            reviewForm.getAttribute('action') ||
                `${context.basePath}/reviews`,
            sourceUrl
        );

        if (action.origin !== location.origin) {
            throw new Error(
                'GitHub returned an unexpected review endpoint.'
            );
        }

        const body = new URLSearchParams();

        for (
            const [name, value] of new FormData(reviewForm)
        ) {
            if (typeof value === 'string') {
                body.append(name, value);
            }
        }

        body.set('_method', 'put');
        body.set('authenticity_token', authenticityToken);
        body.set('head_sha', headSha);
        body.set('pull_request_review[event]', 'approve');
        body.set('pull_request_review[body]', '');

        return {
            action,
            body
        };
    }

    function responseError(page, responseText) {
        const selectors = [
            '.flash-error:not([hidden])',
            '.Banner--error:not([hidden])',
            '[role="alert"][class*="error"]:not([hidden])',
            '[role="alert"][class*="Error"]:not([hidden])',
            '[data-variant="critical"]:not([hidden])'
        ];

        for (const selector of selectors) {
            for (const element of page.querySelectorAll(selector)) {
                const text = normalizedText(element);

                if (text && text.length <= 500) {
                    return text;
                }
            }
        }

        return responseText.match(
            /(?:you (?:cannot|can\u2019t|can't) approve your own pull request|you do not have permission[^<\r\n]*|pull request is (?:closed|merged)[^<\r\n]*|you (?:cannot|can\u2019t|can't) perform that action[^<\r\n]*)/i
        )?.[0] || null;
    }

    async function submitApproval(context) {
        const {
            reviewForm,
            sourceUrl
        } = await fetchReviewForm(context);
        const { action, body } = buildReviewRequest(
            context,
            reviewForm,
            sourceUrl
        );
        const response = await fetch(action, {
            method: 'POST',
            credentials: 'same-origin',
            cache: 'no-store',
            redirect: 'follow',
            headers: {
                Accept: 'text/html,application/xhtml+xml',
                'Content-Type':
                    'application/x-www-form-urlencoded;charset=UTF-8'
            },
            body
        });
        const responseText = await response.text();
        const page = new DOMParser().parseFromString(
            responseText,
            'text/html'
        );

        if (isSignInPage(response, page)) {
            throw new Error(
                'Your GitHub session has expired. ' +
                'Sign in again and retry.'
            );
        }

        const errorMessage = responseError(
            page,
            responseText
        );

        if (!response.ok || errorMessage) {
            throw new Error(
                errorMessage ||
                `GitHub returned ${response.status} ` +
                'while submitting the approval.'
            );
        }
    }

    async function approvePullRequest() {
        const context = pullRequestContext();

        if (
            !context ||
            approvalState === 'submitting' ||
            approvalState === 'approved'
        ) {
            return;
        }

        setApprovalState('submitting');

        try {
            await submitApproval(context);

            if (pullRequestContext()?.key === context.key) {
                setApprovalState(
                    'approved',
                    'Pull request approved'
                );
            }
        } catch (error) {
            const message =
                error instanceof Error
                    ? error.message
                    : String(error);

            console.error('[Direct PR Approve]', error);

            if (pullRequestContext()?.key === context.key) {
                setApprovalState('failed', message);
            }

            alert(`Approval failed: ${message}`);
        }
    }

    function createApproveButton(context) {
        const button = document.createElement('button');

        button.id = buttonId;
        button.type = 'button';
        button.dataset.pullRequest = context.key;
        button.addEventListener('click', approvePullRequest);
        renderButton(button);

        return button;
    }

    function addApproveButton() {
        const context = pullRequestContext();
        const existingButton =
            document.getElementById(buttonId);

        if (!context) {
            existingButton?.remove();
            currentPullRequestKey = null;
            approvalState = 'idle';
            stateMessage = '';
            return;
        }

        if (currentPullRequestKey !== context.key) {
            currentPullRequestKey = context.key;
            approvalState = 'idle';
            stateMessage = '';
            existingButton?.remove();
        }

        const placement = findButtonPlacement();

        if (!placement) {
            return;
        }

        const button =
            document.getElementById(buttonId) ||
            createApproveButton(context);

        renderButton(button);

        if (
            button.parentElement !== placement.container ||
            button.nextElementSibling !==
                placement.insertionPoint
        ) {
            placement.container.insertBefore(
                button,
                placement.insertionPoint
            );
        }
    }

    function scheduleAddButton() {
        if (scheduled) {
            return;
        }

        scheduled = true;

        requestAnimationFrame(() => {
            scheduled = false;
            addApproveButton();
        });
    }

    addApproveButton();

    new MutationObserver(scheduleAddButton).observe(
        document.body,
        {
            childList: true,
            subtree: true
        }
    );

    window.addEventListener('popstate', scheduleAddButton);
    document.addEventListener('turbo:load', scheduleAddButton);
    document.addEventListener('pjax:end', scheduleAddButton);
})();
