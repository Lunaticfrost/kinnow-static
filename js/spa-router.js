/**
 * Kinnow Static SPA Router
 * Enables instant, seamless single-page navigation across static HTML pages with full CSS/Head syncing.
 */
(function () {
    const pageCache = new Map();

    function isInternalLink(a) {
        if (!a || !a.href) return false;
        if (a.target === '_blank' || a.hasAttribute('download')) return false;
        const href = a.getAttribute('href') || '';
        if (href.startsWith('#') || href.startsWith('javascript:') || href.startsWith('mailto:') || href.startsWith('tel:')) return false;
        try {
            const url = new URL(a.href, window.location.href);
            return url.origin === window.location.origin;
        } catch (e) {
            return false;
        }
    }

    function prefetchPage(urlStr) {
        if (pageCache.has(urlStr)) return;
        fetch(urlStr)
            .then(res => res.text())
            .then(html => pageCache.set(urlStr, html))
            .catch(() => {});
    }

    async function navigateTo(urlStr, pushHistory = true) {
        try {
            let html = pageCache.get(urlStr);
            if (!html) {
                const res = await fetch(urlStr);
                html = await res.text();
                pageCache.set(urlStr, html);
            }

            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');

            // 1. Smooth Fade Out
            document.body.style.transition = 'opacity 0.12s ease-out';
            document.body.style.opacity = '0';

            setTimeout(() => {
                // 2. Sync Document Title
                document.title = doc.title;

                // 3. Sync Head Elements (Styles, Link stylesheets & Meta tags)
                // Remove current page styles and stylesheets
                const currentHeadStyles = Array.from(document.head.querySelectorAll('style, link[rel="stylesheet"]'));
                currentHeadStyles.forEach(el => el.remove());

                // Append new incoming page styles and stylesheets
                const newHeadStyles = Array.from(doc.head.querySelectorAll('style, link[rel="stylesheet"]'));
                newHeadStyles.forEach(el => {
                    document.head.appendChild(el.cloneNode(true));
                });

                // Sync meta tags
                const currentMetas = Array.from(document.head.querySelectorAll('meta[name="description"], meta[property^="og:"], meta[name^="twitter:"]'));
                currentMetas.forEach(m => m.remove());
                const newMetas = Array.from(doc.head.querySelectorAll('meta[name="description"], meta[property^="og:"], meta[name^="twitter:"]'));
                newMetas.forEach(m => {
                    document.head.appendChild(m.cloneNode(true));
                });

                // 4. Swap Body Attributes & Inner HTML
                document.body.className = doc.body.className;
                const bodyStyle = doc.body.getAttribute('style') || '';
                document.body.setAttribute('style', bodyStyle);
                document.body.innerHTML = doc.body.innerHTML;

                // 5. Update Browser History URL
                if (pushHistory) {
                    history.pushState({ url: urlStr }, doc.title, urlStr);
                }

                // 6. Instant Scroll to Top
                window.scrollTo({ top: 0, behavior: 'instant' });

                // 7. Re-execute Page Scripts in Body
                document.body.querySelectorAll('script').forEach(oldScript => {
                    if (oldScript.src && oldScript.src.includes('spa-router.js')) return;
                    const newScript = document.createElement('script');
                    Array.from(oldScript.attributes).forEach(attr => newScript.setAttribute(attr.name, attr.value));
                    newScript.appendChild(document.createTextNode(oldScript.innerHTML));
                    oldScript.parentNode.replaceChild(newScript, oldScript);
                });

                // 8. Fade In
                document.body.style.transition = 'opacity 0.18s ease-in';
                document.body.style.opacity = '1';

                // 9. Re-bind SPA link listeners for newly swapped content
                initLinks();
            }, 120);
        } catch (err) {
            console.error('SPA navigation error, falling back to full reload:', err);
            window.location.href = urlStr;
        }
    }

    function initLinks() {
        document.querySelectorAll('a').forEach(a => {
            if (!isInternalLink(a)) return;

            // Prefetch target page HTML on hover / touchstart
            a.addEventListener('mouseenter', () => prefetchPage(a.href), { passive: true });
            a.addEventListener('touchstart', () => prefetchPage(a.href), { passive: true });

            // Intercept click for SPA transition
            a.addEventListener('click', (e) => {
                if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
                e.preventDefault();
                const targetUrl = a.href;
                if (targetUrl === window.location.href) return;
                navigateTo(targetUrl, true);
            });
        });
    }

    window.addEventListener('popstate', () => {
        navigateTo(window.location.href, false);
    });

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initLinks);
    } else {
        initLinks();
    }
})();
