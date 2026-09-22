// ==UserScript==
// @name         GitHub - Comment Box After PR Summary
// @namespace    https://github.com/bwcampbell9/better-github
// @version      1.1.1
// @description  Moves the add-comment form below the PR summary.
// @author       Bryce Campbell
// @license      MIT
// @icon         https://github.githubassets.com/pinned-octocat.svg
// @match        https://github.com/*
// @match        https://*.ghe.com/*
// @homepageURL  https://github.com/bwcampbell9/better-github
// @supportURL   https://github.com/bwcampbell9/better-github/issues
// @downloadURL  https://raw.githubusercontent.com/bwcampbell9/better-github/refs/heads/users/brycampbell/main/scripts/04-comment-box-after-summary.user.js
// @updateURL    https://raw.githubusercontent.com/bwcampbell9/better-github/refs/heads/users/brycampbell/main/scripts/04-comment-box-after-summary.user.js
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

    function directChildContaining(parent, descendant) {
        let child = descendant;

        while (child && child.parentElement !== parent) {
            child = child.parentElement;
        }

        return child?.parentElement === parent ? child : null;
    }

    function moveCommentBox() {
        const timeline = document.querySelector(
            '.pull-discussion-timeline'
        );
        const discussion =
            timeline?.querySelector('.js-discussion');
        const summary = discussion?.querySelector(
            '.js-command-palette-pull-body'
        );
        const commentBox =
            timeline?.querySelector('#issue-comment-box');

        if (!timeline || !discussion || !summary || !commentBox) {
            return;
        }

        const summarySection = directChildContaining(
            discussion,
            summary
        );
        const commentSection =
            directChildContaining(discussion, commentBox) ||
            directChildContaining(timeline, commentBox);

        if (
            summarySection &&
            commentSection &&
            summarySection.nextElementSibling !== commentSection
        ) {
            summarySection.after(commentSection);
        }
    }

    let scheduled = false;

    function scheduleMove() {
        if (scheduled) {
            return;
        }

        scheduled = true;

        requestAnimationFrame(() => {
            scheduled = false;
            moveCommentBox();
        });
    }

    moveCommentBox();

    new MutationObserver(scheduleMove).observe(document.body, {
        childList: true,
        subtree: true
    });
})();
