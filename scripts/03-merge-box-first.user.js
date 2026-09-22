// ==UserScript==
// @name         GitHub - Move Merge Box to Top
// @namespace    https://github.com/bwcampbell9/better-github
// @version      1.1.0
// @description  Moves the pull request merge box above the conversation.
// @author       Bryce Campbell
// @license      MIT
// @icon         https://github.githubassets.com/pinned-octocat.svg
// @match        *://*/*
// @homepageURL  https://github.com/bwcampbell9/better-github
// @supportURL   https://github.com/bwcampbell9/better-github/issues
// @downloadURL  https://raw.githubusercontent.com/bwcampbell9/better-github/refs/heads/users/brycampbell/main/scripts/03-merge-box-first.user.js
// @updateURL    https://raw.githubusercontent.com/bwcampbell9/better-github/refs/heads/users/brycampbell/main/scripts/03-merge-box-first.user.js
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

    function moveMergeBox() {
        const timeline = document.querySelector(
            '.pull-discussion-timeline'
        );
        const mergeBox = timeline?.querySelector(
            '[data-testid="mergebox-partial"]'
        );

        if (
            !timeline ||
            !mergeBox ||
            timeline.firstElementChild === mergeBox
        ) {
            return;
        }

        timeline.prepend(mergeBox);
    }

    let scheduled = false;

    function scheduleMove() {
        if (scheduled) {
            return;
        }

        scheduled = true;

        requestAnimationFrame(() => {
            scheduled = false;
            moveMergeBox();
        });
    }

    moveMergeBox();

    new MutationObserver(scheduleMove).observe(document.body, {
        childList: true,
        subtree: true
    });
})();
