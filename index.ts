/*
 * Roblox Deep Links — Vencord userplugin
 * Redirects Roblox experience links to the Roblox desktop app, preserving
 * supported private-server link/access codes when they are present in the URL.
 */

import definePlugin from "@utils/types";

const ROBLOX_HOSTS = new Set(["roblox.com", "www.roblox.com", "m.roblox.com"]);

function getRobloxDeepLink(rawUrl: string): string | null {
    let url: URL;

    try {
        url = new URL(rawUrl);
    } catch {
        return null;
    }

    if (url.protocol !== "https:" && url.protocol !== "http:") return null;

    const host = url.hostname.toLowerCase();
    if (!ROBLOX_HOSTS.has(host) && !host.endsWith(".roblox.com")) return null;

    // Standard experience URL: /games/<placeId>/...
    let placeId = url.pathname.match(/^\/games\/(\d+)(?:\/|$)/i)?.[1];

    // Web-to-app launch URL: /games/start?placeId=<placeId>
    if (!placeId && /^\/games\/start\/?$/i.test(url.pathname)) {
        const candidate = url.searchParams.get("placeId");
        if (candidate && /^\d+$/.test(candidate)) placeId = candidate;
    }

    // Share links can carry a private server code without exposing the place ID.
    // Roblox's documented direct deep-link format needs placeId for linkCode/accessCode,
    // so only rewrite when we can confidently build a documented direct link.
    if (!placeId) return null;

    const deepLink = new URL("roblox://");
    deepLink.searchParams.set("placeId", placeId);

    // Roblox's documented deep-link parameter is linkCode. Roblox web URLs may
    // call it privateServerLinkCode, linkCode, or accessCode depending on link type.
    const linkCode =
        url.searchParams.get("linkCode")
        ?? url.searchParams.get("privateServerLinkCode")
        ?? url.searchParams.get("privateServerId");

    const accessCode = url.searchParams.get("accessCode");

    if (linkCode) deepLink.searchParams.set("linkCode", linkCode);
    if (accessCode) deepLink.searchParams.set("accessCode", accessCode);

    // Keep game-instance links working when one is present.
    const gameInstanceId = url.searchParams.get("gameInstanceId");
    if (gameInstanceId) deepLink.searchParams.set("gameInstanceId", gameInstanceId);

    return `roblox://placeId=${encodeURIComponent(placeId)}${
        linkCode ? `&linkCode=${encodeURIComponent(linkCode)}` : ""
    }${
        accessCode ? `&accessCode=${encodeURIComponent(accessCode)}` : ""
    }${
        gameInstanceId ? `&gameInstanceId=${encodeURIComponent(gameInstanceId)}` : ""
    }`;
}

function onDocumentClick(event: MouseEvent) {
    if (event.defaultPrevented || event.button !== 0) return;
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;

    const target = event.target;
    if (!(target instanceof Element)) return;

    const anchor = target.closest("a[href]") as HTMLAnchorElement | null;
    if (!anchor) return;

    const deepLink = getRobloxDeepLink(anchor.href);
    if (!deepLink) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    VencordNative.native.openExternal() = deepLink;
}

export default definePlugin({
    name: "RobloxDeepLinks",
    description: "Opens Roblox experience links in the desktop client, preserving supported private-server codes.",
    authors: [{ name: "Custom plugin", id: 0n }],
    start() {
        document.addEventListener("click", onDocumentClick, true);
    },
    stop() {
        document.removeEventListener("click", onDocumentClick, true);
    }
});
