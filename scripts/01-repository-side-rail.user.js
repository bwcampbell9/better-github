// ==UserScript==
// @name         GitHub - Repository Side Rail
// @namespace    https://github.com/bwcampbell9/better-github
// @version      1.1.1
// @description  Moves repository navigation into an icon rail that expands on hover.
// @author       Bryce Campbell
// @license      MIT
// @icon         https://github.githubassets.com/pinned-octocat.svg
// @match        https://github.com/*
// @match        https://*.ghe.com/*
// @homepageURL  https://github.com/bwcampbell9/better-github
// @supportURL   https://github.com/bwcampbell9/better-github/issues
// @downloadURL  https://raw.githubusercontent.com/bwcampbell9/better-github/refs/heads/users/brycampbell/main/scripts/01-repository-side-rail.user.js
// @updateURL    https://raw.githubusercontent.com/bwcampbell9/better-github/refs/heads/users/brycampbell/main/scripts/01-repository-side-rail.user.js
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

    GM_addStyle(`
@media (min-width: 768px) {
    body.tm-repository-rail-active .application-main {
        margin-left: 48px !important;
    }

    html body nav[aria-label="Repository"].tm-repository-rail {
        position: fixed !important;
        top: var(--tm-repository-rail-top, 64px) !important;
        right: auto !important;
        bottom: 0 !important;
        left: 0 !important;
        z-index: 90 !important;
        box-sizing: border-box !important;
        display: block !important;
        width: 48px !important;
        height: auto !important;
        min-height: 0 !important;
        max-height: none !important;
        padding: 8px 6px !important;
        overflow-x: hidden !important;
        overflow-y: auto !important;
        background: var(
            --bgColor-default,
            var(--color-canvas-default, #fff)
        ) !important;
        border-right: 1px solid var(
            --borderColor-default,
            var(--color-border-default, #d0d7de)
        ) !important;
        border-bottom: 0 !important;
        transition:
            width 140ms ease,
            box-shadow 140ms ease !important;
    }

    html body nav[aria-label="Repository"].tm-repository-rail:hover {
        width: 220px !important;
        box-shadow: var(
            --shadow-floating-small,
            0 8px 24px rgba(0, 0, 0, 0.18)
        ) !important;
    }

    nav.tm-repository-rail > ul {
        display: flex !important;
        flex: none !important;
        flex-direction: column !important;
        flex-wrap: nowrap !important;
        gap: 4px !important;
        width: 100% !important;
        min-width: 100% !important;
        height: auto !important;
        margin: 0 !important;
        padding: 0 !important;
        overflow: visible !important;
        mask-image: none !important;
    }

    nav.tm-repository-rail > ul > li[role="presentation"] {
        display: none !important;
    }

    nav.tm-repository-rail .tm-repository-rail-item {
        display: block !important;
        flex: 0 0 40px !important;
        width: 100% !important;
        height: 40px !important;
        margin: 0 !important;
        padding: 0 !important;
        visibility: visible !important;
        opacity: 1 !important;
    }

    nav.tm-repository-rail .tm-repository-rail-item > a {
        position: relative !important;
        box-sizing: border-box !important;
        display: flex !important;
        align-items: center !important;
        gap: 8px !important;
        width: 100% !important;
        max-width: none !important;
        height: 40px !important;
        margin: 0 !important;
        padding: 0 10px !important;
        overflow: hidden !important;
        white-space: nowrap !important;
        border-radius: 6px !important;
        text-decoration: none !important;
    }

    nav.tm-repository-rail .tm-repository-rail-item > a::after {
        display: none !important;
    }

    nav.tm-repository-rail .tm-repository-rail-item > a:hover {
        background: var(
            --control-transparent-bgColor-hover,
            rgba(175, 184, 193, 0.2)
        ) !important;
    }

    nav.tm-repository-rail
        .tm-repository-rail-item
        > a[aria-current="page"] {
        color: var(
            --fgColor-accent,
            var(--color-accent-fg, #0969da)
        ) !important;
        background: var(
            --bgColor-accent-muted,
            rgba(84, 174, 255, 0.16)
        ) !important;
    }

    nav.tm-repository-rail
        .tm-repository-rail-item
        > a
        > span:first-child {
        display: flex !important;
        flex: 0 0 16px !important;
        width: 16px !important;
    }

    nav.tm-repository-rail
        .tm-repository-rail-item
        > a
        > span:not(:first-child) {
        opacity: 0 !important;
        transition: opacity 80ms ease !important;
    }

    nav.tm-repository-rail:hover
        .tm-repository-rail-item
        > a
        > span:not(:first-child) {
        opacity: 1 !important;
    }

    nav.tm-repository-rail > :not(ul) {
        display: none !important;
    }
}
`);

    function setupRepositoryRail() {
        const nav = document.querySelector(
            'nav[aria-label="Repository"]'
        );

        document.body.classList.toggle(
            'tm-repository-rail-active',
            Boolean(nav)
        );

        if (!nav) {
            return;
        }

        const header = nav.closest('header');
        const headerChildren = [...(header?.children || [])];
        const navIndex = headerChildren.indexOf(nav);

        const topBar = navIndex > 0
            ? headerChildren
                .slice(0, navIndex)
                .reverse()
                .find((child) => {
                    const style = getComputedStyle(child);

                    return (
                        style.display !== 'none' &&
                        style.position !== 'absolute' &&
                        style.position !== 'fixed' &&
                        child.getBoundingClientRect().height > 1
                    );
                })
            : null;

        if (topBar) {
            topBar.style.setProperty(
                'height',
                'auto',
                'important'
            );

            for (const section of topBar.children) {
                const style = getComputedStyle(section);
                const paddingTop = Number.parseFloat(
                    style.paddingTop
                );
                const paddingBottom = Number.parseFloat(
                    style.paddingBottom
                );

                if (paddingTop > paddingBottom) {
                    section.style.setProperty(
                        'height',
                        'auto',
                        'important'
                    );
                    section.style.setProperty(
                        'padding-bottom',
                        `${paddingTop}px`,
                        'important'
                    );
                }
            }
        }

        let top = 0;

        for (const child of header?.children || []) {
            if (child === nav) {
                break;
            }

            const style = getComputedStyle(child);

            if (
                style.display !== 'none' &&
                style.position !== 'absolute' &&
                style.position !== 'fixed'
            ) {
                top += child.getBoundingClientRect().height;
            }
        }

        nav.style.setProperty(
            '--tm-repository-rail-top',
            `${Math.round(top)}px`
        );

        const newlyActivated = !nav.classList.contains(
            'tm-repository-rail'
        );

        nav.classList.add('tm-repository-rail');

        for (const link of nav.querySelectorAll('ul > li > a')) {
            const item = link.parentElement;

            item.classList.add('tm-repository-rail-item');
            item.setAttribute('aria-hidden', 'false');

            const label = [...link.children]
                .map((child) =>
                    child.textContent.replace(/\s+/g, ' ').trim()
                )
                .find(Boolean);

            if (label && !link.title) {
                link.title = label;
            }
        }

        if (newlyActivated) {
            nav.scrollTop = 0;
        }
    }

    let scheduled = false;

    function scheduleSetup() {
        if (scheduled) {
            return;
        }

        scheduled = true;

        requestAnimationFrame(() => {
            scheduled = false;
            setupRepositoryRail();
        });
    }

    setupRepositoryRail();

    new MutationObserver(scheduleSetup).observe(document.body, {
        childList: true,
        subtree: true
    });

    window.addEventListener('resize', scheduleSetup, {
        passive: true
    });
})();
