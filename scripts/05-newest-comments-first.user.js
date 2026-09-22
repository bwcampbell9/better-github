// ==UserScript==
// @name         GitHub - Newest Pull Request Comments First
// @namespace    https://github.com/bwcampbell9/better-github
// @version      1.1.1
// @description  Shows the newest PR conversation comments before older comments.
// @author       Bryce Campbell
// @license      MIT
// @icon         https://github.githubassets.com/pinned-octocat.svg
// @match        https://github.com/*
// @match        https://*.ghe.com/*
// @homepageURL  https://github.com/bwcampbell9/better-github
// @supportURL   https://github.com/bwcampbell9/better-github/issues
// @downloadURL  https://raw.githubusercontent.com/bwcampbell9/better-github/refs/heads/users/brycampbell/main/scripts/05-newest-comments-first.user.js
// @updateURL    https://raw.githubusercontent.com/bwcampbell9/better-github/refs/heads/users/brycampbell/main/scripts/05-newest-comments-first.user.js
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

    function isCommentRow(row) {
        return (
            row.matches('.js-timeline-item') &&
            Boolean(
                row.querySelector(
                    '.js-comment-container, .js-comment'
                )
            )
        );
    }

    function newestTimestamp(row) {
        const timestamps = [
            ...row.querySelectorAll(
                'relative-time[datetime], ' +
                'time-ago[datetime], ' +
                'time[datetime]'
            )
        ]
            .map((time) =>
                Date.parse(time.getAttribute('datetime'))
            )
            .filter(Number.isFinite);

        return timestamps.length
            ? Math.max(...timestamps)
            : Number.NEGATIVE_INFINITY;
    }

    function reverseConversationComments() {
        const discussion = document.querySelector(
            '.pull-discussion-timeline .js-discussion'
        );

        if (!discussion) {
            return;
        }

        const timelineRows = [
            ...discussion.querySelectorAll('.js-timeline-item')
        ].filter(
            (row) =>
                !row.parentElement?.closest('.js-timeline-item')
        );

        const parents = new Set(
            timelineRows
                .filter(isCommentRow)
                .map((row) => row.parentElement)
                .filter(Boolean)
        );

        for (const parent of parents) {
            const children = [...parent.children];
            const commentRows = children.filter(isCommentRow);

            if (commentRows.length < 2) {
                continue;
            }

            const originalPositions = new Map(
                commentRows.map((row, index) => [row, index])
            );

            const sortedComments = [...commentRows].sort(
                (left, right) => {
                    const leftTimestamp = newestTimestamp(left);
                    const rightTimestamp = newestTimestamp(right);

                    if (leftTimestamp === rightTimestamp) {
                        return (
                            originalPositions.get(left) -
                            originalPositions.get(right)
                        );
                    }

                    return rightTimestamp - leftTimestamp;
                }
            );

            let commentIndex = 0;

            const desiredOrder = children.map((child) =>
                isCommentRow(child)
                    ? sortedComments[commentIndex++]
                    : child
            );

            const alreadyOrdered = desiredOrder.every(
                (child, index) => child === children[index]
            );

            if (!alreadyOrdered) {
                parent.append(...desiredOrder);
            }
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
            reverseConversationComments();
        });
    }

    reverseConversationComments();

    new MutationObserver(scheduleReorder).observe(document.body, {
        childList: true,
        subtree: true
    });
})();
