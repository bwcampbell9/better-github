// ==UserScript==
// @name         GitHub - Reorder Pull Request Tabs
// @namespace    https://github.com/bwcampbell9/better-github
// @version      1.1.1
// @description  Orders PR tabs as Conversation, Files changed, Checks, Commits.
// @author       Bryce Campbell
// @license      MIT
// @icon         https://github.githubassets.com/pinned-octocat.svg
// @match        https://github.com/*
// @match        https://*.ghe.com/*
// @homepageURL  https://github.com/bwcampbell9/better-github
// @supportURL   https://github.com/bwcampbell9/better-github/issues
// @downloadURL  https://raw.githubusercontent.com/bwcampbell9/better-github/refs/heads/users/brycampbell/main/scripts/02-pr-tab-order.user.js
// @updateURL    https://raw.githubusercontent.com/bwcampbell9/better-github/refs/heads/users/brycampbell/main/scripts/02-pr-tab-order.user.js
// @grant        none
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

    function reorderPullRequestTabs() {
        const pathOf = (tab) =>
            new URL(tab.href, location.href).pathname.replace(
                /\/$/,
                ''
            );

        const knownTab =
            document.querySelector(
                '#prs-files-anchor-tab, #prs-commits-anchor-tab'
            ) ||
            [...document.querySelectorAll('nav a[href]')].find(
                (tab) =>
                    /\/pull\/\d+\/(?:changes|files)$/.test(
                        pathOf(tab)
                    )
            );

        const tabList = knownTab?.parentElement;

        if (!tabList) {
            return;
        }

        const tabs = [...tabList.children].filter((element) =>
            element.matches('a[href]')
        );

        const desiredOrder = [
            tabs.find((tab) =>
                /\/pull\/\d+$/.test(pathOf(tab))
            ),
            tabs.find((tab) =>
                /\/pull\/\d+\/(?:changes|files)$/.test(
                    pathOf(tab)
                )
            ),
            tabs.find((tab) =>
                /\/pull\/\d+\/checks$/.test(pathOf(tab))
            ),
            tabs.find((tab) =>
                /\/pull\/\d+\/commits$/.test(pathOf(tab))
            )
        ];

        if (desiredOrder.some((tab) => !tab)) {
            return;
        }

        const alreadyOrdered = desiredOrder.every(
            (tab, index) =>
                index === 0 ||
                desiredOrder[index - 1].nextElementSibling === tab
        );

        if (alreadyOrdered) {
            return;
        }

        const firstTab = tabs.find((tab) =>
            desiredOrder.includes(tab)
        );

        let previousTab = null;

        for (const tab of desiredOrder) {
            if (previousTab) {
                previousTab.after(tab);
            } else if (tab !== firstTab) {
                tabList.insertBefore(tab, firstTab);
            }

            previousTab = tab;
        }
    }

    let scheduled = false;

    function scheduleReorder() {
        if (scheduled) {
            return;
        }

        scheduled = true;

        requestAnimationFrame(() => {
            scheduled = false;
            reorderPullRequestTabs();
        });
    }

    reorderPullRequestTabs();

    new MutationObserver(scheduleReorder).observe(document.body, {
        childList: true,
        subtree: true
    });
})();
