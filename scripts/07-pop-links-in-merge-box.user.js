// ==UserScript==
// @name         GitHub - Merge Box Check Actions
// @namespace    https://github.com/bwcampbell9/better-github
// @version      1.1.0
// @description  Adds quick action links to a supported pull request check.
// @author       Bryce Campbell
// @license      MIT
// @icon         https://github.githubassets.com/pinned-octocat.svg
// @match        *://*/*
// @homepageURL  https://github.com/bwcampbell9/better-github
// @supportURL   https://github.com/bwcampbell9/better-github/issues
// @downloadURL  https://raw.githubusercontent.com/bwcampbell9/better-github/refs/heads/users/brycampbell/main/scripts/07-pop-links-in-merge-box.user.js
// @updateURL    https://raw.githubusercontent.com/bwcampbell9/better-github/refs/heads/users/brycampbell/main/scripts/07-pop-links-in-merge-box.user.js
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

    const popBaseUrl =
        'https://githubpop.app.prod.gitops.startclean.microsoft.com' +
        '/api/pop/provePresence';

    const identities = ['Microsoft', 'PME', 'Torus'];

    GM_addStyle(`
.tm-pop-actions {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    margin-left: 8px;
    white-space: nowrap;
}

.tm-pop-action {
    display: inline-flex;
    align-items: center;
    min-height: 24px;
    padding: 2px 7px;
    color: var(
        --fgColor-accent,
        var(--color-accent-fg, #4493f8)
    ) !important;
    font-size: 12px;
    font-weight: 600;
    line-height: 18px;
    background: var(
        --button-default-bgColor-rest,
        var(--color-btn-bg, transparent)
    );
    border: 1px solid var(
        --button-default-borderColor-rest,
        var(--color-btn-border, #3d444d)
    );
    border-radius: 6px;
    text-decoration: none !important;
}

.tm-pop-action:hover {
    background: var(
        --button-default-bgColor-hover,
        var(--color-btn-hover-bg, rgba(177, 186, 196, 0.12))
    );
}
`);

    function pullRequestContext() {
        const match = location.pathname.match(
            /^\/([^/]+)\/([^/]+)\/pull\/(\d+)(?:\/|$)/
        );

        if (!match) {
            return null;
        }

        return {
            owner: match[1],
            repository: match[2],
            number: match[3]
        };
    }

    function findHeadShaInObject(value, depth = 0) {
        if (
            !value ||
            typeof value !== 'object' ||
            depth > 12
        ) {
            return null;
        }

        if (
            typeof value.headSha === 'string' &&
            /^[0-9a-f]{40}$/i.test(value.headSha)
        ) {
            return value.headSha.toLowerCase();
        }

        for (const child of Object.values(value)) {
            const sha = findHeadShaInObject(child, depth + 1);

            if (sha) {
                return sha;
            }
        }

        return null;
    }

    function findHeadShaInPageData() {
        for (
            const script of document.querySelectorAll(
                'script[type="application/json"]'
            )
        ) {
            try {
                const sha = findHeadShaInObject(
                    JSON.parse(script.textContent)
                );

                if (sha) {
                    return sha;
                }
            } catch {
                continue;
            }
        }

        return null;
    }

    function findHeadShaInCommitLinks(context) {
        const prefix =
            `/${context.owner}/${context.repository}` +
            `/pull/${context.number}/commits/`;

        const shas = [
            ...document.querySelectorAll(
                `.js-discussion a[href*="${prefix}"]`
            )
        ]
            .map((link) =>
                new URL(link.href, location.href).pathname.match(
                    /\/commits\/([0-9a-f]{40})$/i
                )?.[1]
            )
            .filter(Boolean);

        return shas.at(-1)?.toLowerCase() || null;
    }

    function findHeadSha(context) {
        return (
            findHeadShaInPageData() ||
            findHeadShaInCommitLinks(context)
        );
    }

    function findPopLabel(mergeBox) {
        const walker = document.createTreeWalker(
            mergeBox,
            NodeFilter.SHOW_TEXT
        );

        let node = walker.nextNode();

        while (node) {
            if (
                /GitOps\s*\/\s*GitHubPop/i.test(
                    node.textContent || ''
                )
            ) {
                return node.parentElement;
            }

            node = walker.nextNode();
        }

        return null;
    }

    function buildPopUrl(context, headSha, identity) {
        const owner = encodeURIComponent(
            context.owner.toLowerCase()
        );
        const repository = encodeURIComponent(
            context.repository.toLowerCase()
        );
        const url = new URL(
            `${popBaseUrl}/${owner}/${repository}/` +
            `${context.number}/${headSha}`
        );

        url.searchParams.set('identity', identity);

        return url.href;
    }

    function createPopActions(context, headSha) {
        const actions = document.createElement('span');

        actions.className = 'tm-pop-actions';
        actions.setAttribute(
            'aria-label',
            'Proof of Presence authentication'
        );

        for (const identity of identities) {
            const link = document.createElement('a');

            link.className = 'tm-pop-action';
            link.href = buildPopUrl(
                context,
                headSha,
                identity
            );
            link.textContent = identity;
            actions.append(link);
        }

        actions.addEventListener('click', (event) => {
            event.stopPropagation();
        });

        return actions;
    }

    function addPopLinks() {
        const context = pullRequestContext();
        const mergeBox = document.querySelector(
            '[data-testid="mergebox-partial"]'
        );

        if (!context || !mergeBox) {
            return;
        }

        const label = findPopLabel(mergeBox);

        if (!label) {
            return;
        }

        const existingActions = mergeBox.querySelector(
            '.tm-pop-actions'
        );
        const headSha = findHeadSha(context);

        if (!headSha) {
            return;
        }

        if (
            existingActions?.dataset.headSha === headSha
        ) {
            return;
        }

        existingActions?.remove();

        const actions = createPopActions(context, headSha);
        const interactiveElement = label.closest(
            'a[href], button'
        );
        const insertionPoint = interactiveElement || label;

        actions.dataset.headSha = headSha;
        insertionPoint.after(actions);
    }

    let scheduled = false;

    function scheduleAddLinks() {
        if (scheduled) {
            return;
        }

        scheduled = true;

        requestAnimationFrame(() => {
            scheduled = false;
            addPopLinks();
        });
    }

    addPopLinks();

    new MutationObserver(scheduleAddLinks).observe(
        document.body,
        {
            childList: true,
            subtree: true
        }
    );
})();
