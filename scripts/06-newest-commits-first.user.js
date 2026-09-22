// ==UserScript==
// @name         GitHub - Newest Commits First in File Picker
// @namespace    https://github.com/bwcampbell9/better-github
// @version      1.2.0
// @description  Shows newest commits first in classic and modern Files changed pickers.
// @author       Bryce Campbell
// @license      MIT
// @icon         https://github.githubassets.com/pinned-octocat.svg
// @match        *://*/*
// @homepageURL  https://github.com/bwcampbell9/better-github
// @supportURL   https://github.com/bwcampbell9/better-github/issues
// @downloadURL  https://raw.githubusercontent.com/bwcampbell9/better-github/refs/heads/users/brycampbell/main/scripts/06-newest-commits-first.user.js
// @updateURL    https://raw.githubusercontent.com/bwcampbell9/better-github/refs/heads/users/brycampbell/main/scripts/06-newest-commits-first.user.js
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

    const commitPositionsByPage = new Map();

    function isFilesChangedPage() {
        return /\/pull\/\d+\/(?:files|changes)(?:\/|$)/.test(
            location.pathname
        );
    }

    function normalizedText(element) {
        return (element.textContent || '')
            .replace(/\s+/g, ' ')
            .trim();
    }

    function commitHashFromText(element) {
        const exactHashElement = [
            ...element.querySelectorAll('*')
        ]
            .reverse()
            .find((child) =>
                /^[0-9a-f]{7,40}$/i.test(normalizedText(child))
            );

        if (exactHashElement) {
            return normalizedText(exactHashElement).toLowerCase();
        }

        const hashes = [
            ...normalizedText(element).matchAll(
                /(?:^|[^0-9a-f])([0-9a-f]{7,40})(?=$|[^0-9a-f])/gi
            )
        ];

        return (
            hashes.at(-1)?.[1]?.toLowerCase() || null
        );
    }

    function commitKey(element) {
        if (element.matches('a[href]')) {
            const path = new URL(
                element.href,
                location.href
            ).pathname.replace(/\/$/, '');
            const match = path.match(
                /\/pull\/\d+\/commits\/([0-9a-f]{7,40})$/i
            );

            if (match) {
                return match[1].toLowerCase();
            }
        }

        return commitHashFromText(element);
    }

    function isCommitLink(element) {
        if (!element.matches('a[href]')) {
            return false;
        }

        const path = new URL(
            element.href,
            location.href
        ).pathname;

        return /\/pull\/\d+\/commits\/[0-9a-f]{7,40}$/i.test(
            path.replace(/\/$/, '')
        );
    }

    function pageKey() {
        const pullPath = location.pathname.match(
            /.*\/pull\/\d+/
        )?.[0];

        return `${location.host}${pullPath || location.pathname}`;
    }

    function originalPositions(items) {
        const key = pageKey();
        let positions = commitPositionsByPage.get(key);

        if (!positions) {
            positions = new Map();
            commitPositionsByPage.set(key, positions);
        }

        let nextIndex = positions.size
            ? Math.max(...positions.values()) + 1
            : 0;

        for (const item of items) {
            const key = commitKey(item);

            if (key && !positions.has(key)) {
                positions.set(key, nextIndex);
                nextIndex += 1;
            }
        }

        return positions;
    }

    function reorderItemSlots(parent, items, desiredOrder) {
        const itemSet = new Set(items);
        const children = [...parent.children];
        let itemIndex = 0;

        const desiredChildren = children.map((child) =>
            itemSet.has(child)
                ? desiredOrder[itemIndex++]
                : child
        );

        const alreadyOrdered = desiredChildren.every(
            (child, index) => child === children[index]
        );

        if (!alreadyOrdered) {
            parent.append(...desiredChildren);
        }
    }

    function putNewestFirst(parent, candidateItems) {
        const items = candidateItems.filter(commitKey);

        if (items.length < 2) {
            return;
        }

        const positions = originalPositions(items);
        const desiredOrder = [...items].sort(
            (left, right) => {
                const leftPosition = positions.get(
                    commitKey(left)
                );
                const rightPosition = positions.get(
                    commitKey(right)
                );

                return rightPosition - leftPosition;
            }
        );

        reorderItemSlots(parent, items, desiredOrder);
    }

    function reverseClassicCommitPickers() {
        const lists = new Set(
            document.querySelectorAll('.js-diffbar-range-list')
        );

        const commitLinks = [
            ...document.querySelectorAll(
                'details-menu a[href*="/commits/"], ' +
                '[role="menu"] a[href*="/commits/"], ' +
                '[role="listbox"] a[href*="/commits/"], ' +
                'dialog a[href*="/commits/"]'
            )
        ].filter(isCommitLink);

        for (const link of commitLinks) {
            const parent = link.parentElement;

            if (
                parent &&
                [...parent.children].filter(isCommitLink).length > 1
            ) {
                lists.add(parent);
            }
        }

        for (const list of lists) {
            putNewestFirst(
                list,
                [...list.children].filter(isCommitLink)
            );
        }
    }

    function checkboxControls(root) {
        return [
            ...new Set(
                root.querySelectorAll(
                    'input[type="checkbox"], ' +
                    '[role="checkbox"], ' +
                    '[aria-checked]'
                )
            )
        ];
    }

    function findCommitRow(control, dialog) {
        let current = control;
        let candidate = null;

        while (current && current !== dialog) {
            if (commitHashFromText(current)) {
                candidate = current;
            }

            const parent = current.parentElement;

            if (!parent) {
                break;
            }

            if (
                candidate &&
                checkboxControls(parent).length > 1
            ) {
                return candidate;
            }

            current = parent;
        }

        return candidate;
    }

    function reverseModernCommitPickers() {
        const dialogs = [
            ...document.querySelectorAll(
                'dialog, [role="dialog"]'
            )
        ].filter((dialog) =>
            /select commits to view/i.test(normalizedText(dialog))
        );

        for (const dialog of dialogs) {
            const rows = [
                ...new Set(
                    checkboxControls(dialog)
                        .map((control) =>
                            findCommitRow(control, dialog)
                        )
                        .filter(Boolean)
                )
            ];

            const rowsByParent = new Map();

            for (const row of rows) {
                const parent = row.parentElement;

                if (!parent) {
                    continue;
                }

                const siblings =
                    rowsByParent.get(parent) || [];

                siblings.push(row);
                rowsByParent.set(parent, siblings);
            }

            for (const [parent, siblingRows] of rowsByParent) {
                if (siblingRows.length > 1) {
                    putNewestFirst(parent, siblingRows);
                }
            }
        }
    }

    function reverseCommitPickers() {
        if (!isFilesChangedPage()) {
            return;
        }

        reverseClassicCommitPickers();
        reverseModernCommitPickers();
    }

    let scheduled = false;

    function scheduleReorder() {
        if (scheduled) {
            return;
        }

        scheduled = true;

        requestAnimationFrame(() => {
            scheduled = false;
            reverseCommitPickers();
        });
    }

    reverseCommitPickers();

    new MutationObserver(scheduleReorder).observe(document.body, {
        childList: true,
        subtree: true
    });
})();
