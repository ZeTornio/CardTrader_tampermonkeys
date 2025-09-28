// ==UserScript==
// @name         Display CT Zero in searches
// @namespace    https://www.cardtrader.com
// @version      2025-09-28
// @description  Display prices for CT Zero and 1-Day in search and version pages
// @author       Sibbob
// @match        https://www.cardtrader.com/cards/*/versions
// @match        https://www.cardtrader.com/*manasearch_results?*
// @icon         https://www.cardtrader.com/assets/favicon/favicon-32x32-a5e0283790f269dc65e3d5d886d9ec2ac290bf407249b2c124e7baff5c10080d.png
// @require      https://raw.githubusercontent.com/CoeJoder/waitForKeyElements.js/refs/heads/master/waitForKeyElements.js
// @grant        GM_addStyle
// ==/UserScript==

const CARD_SEARCH_SELECTOR = ".blueprint-search-card";
const CARD_PRICE_SELECTOR = ".blueprint-search-card__price";
const CARD_OFFER_SELECTOR = ".products-table>table>tbody>tr";
const MAX_WAIT = 10;

waitForKeyElements(CARD_SEARCH_SELECTOR, addPrices, true);

function addPrices(jNode) {
    console.log(jNode.href);
    getProductPage(jNode).then( async (ifrm) => {
        const rawOffers = await getCardOffers(ifrm);
        console.debug("Offers", jNode.href, rawOffers);
        const prices = await extractPrices(rawOffers);
        console.debug("BestPrices", jNode.href, prices);
        await displayPrices(jNode,prices);
        ifrm.remove();
    });
};

async function getProductPage(jNode) {
    const ifrm = document.createElement('iframe');
    ifrm.src = jNode.href;
    ifrm.style.display = 'none';
    document.body.appendChild(ifrm);
    return ifrm;
}

async function getCardOffers(dom, remaining_tries = MAX_WAIT) {
    return new Promise((resolve) => {
        setTimeout(() => {
            const entries = dom.contentDocument.querySelectorAll(CARD_OFFER_SELECTOR);
            console.log(remaining_tries);
            if(entries.length < 1 && remaining_tries > 0) {
                resolve(getCardOffers(dom, --remaining_tries));
            } else {
                resolve(entries);
            }
        }, 1000);
    });
}

class Offer {
    constructor(price, cardTraderZeroAvailable, dayOneAvailable) {
        this.price = price;
        this.cardTraderZeroAvailable = cardTraderZeroAvailable;
        this.dayOneAvailable = dayOneAvailable;
    }
}

class Price {
        constructor(minPrice, minCardTraderZeroPrice, minDayOnePrice) {
        this.minPrice = minPrice;
        this.minCardTraderZeroPrice = minCardTraderZeroPrice;
        this.minDayOnePrice = minDayOnePrice;
    }
}

async function extractPrices(rawCardOffers) {
    let minPrice = null;
    let minCTZeroPrice = null;
    let minDayOnePrice = null;
    for (let rawOffer of rawCardOffers) {
        if (rawOffer.hasAttribute('id')){
            const parsedOffer = parseOffer(rawOffer);
            console.debug(parsedOffer);
            minPrice = Math.min(minPrice ?? parsedOffer.price, parsedOffer.price);
            if (parsedOffer.cardTraderZeroAvailable) {
                minCTZeroPrice = Math.min(minCTZeroPrice ?? parsedOffer.price, parsedOffer.price);
                if (parsedOffer.dayOneAvailable) {
                    minDayOnePrice = Math.min(minDayOnePrice ?? parsedOffer.price, parsedOffer.price);
                }
            }
            if (parsedOffer.cardTraderZeroAvailable && !parsedOffer.dayOneAvailable) break;
        }
    }
    return new Price(minPrice, minCTZeroPrice, minDayOnePrice);
}

function getPrice(rawOffer) {
    return parseFloat(rawOffer.getAttribute("gtm-price"));
}
// Returns 0 if no CT zero; 1 if CT Zero; 2 if CT Zero DayOne;
function getZeroDetails(rawOffer) {
    const zeroDetailsContent = rawOffer.querySelector(".products-table__zero")?.innerHTML ?? rawOffer.innerHTML;
    if (zeroDetailsContent.indexOf("btn-secondary") > -1) return 1;
    if (zeroDetailsContent.indexOf("btn-success") > -1) return 2;
    return 0;
}

function parseOffer(rawOffer) {
    const price = getPrice(rawOffer);
    const zeroDetails = getZeroDetails(rawOffer);
    return new Offer(price,zeroDetails>0,zeroDetails>1);
}

async function displayPrices(jNode,prices) {
    return new Promise( resolve => {
        // Create elements
        const existingPrice = jNode.querySelector(CARD_PRICE_SELECTOR);
        const normalPrice = existingPrice.cloneNode(true);
        normalPrice.classList.remove("text-success");
        const ctZeroPrice = existingPrice.cloneNode(true);
        ctZeroPrice.classList.remove("text-success");
        ctZeroPrice.classList.add("text-secondary");
        // Update element contents
        const currency = existingPrice.innerHTML.substring(0, 1);
        existingPrice.innerHTML = prices.minDayOnePrice != null ? `${currency}${prices.minDayOnePrice.toFixed(2)}` : "N/A";
        normalPrice.innerHTML = prices.minPrice != null ? `${currency}${prices.minPrice.toFixed(2)}` : "N/A";
        ctZeroPrice.innerHTML = prices.minCardTraderZeroPrice != null ? `${currency}${prices.minCardTraderZeroPrice.toFixed(2)}` : "N/A";
        // Add elements
        existingPrice.parentElement.insertBefore(normalPrice,existingPrice);
        existingPrice.parentElement.insertBefore(document.createElement('br'),existingPrice);
        existingPrice.parentElement.insertBefore(ctZeroPrice,existingPrice);
        existingPrice.parentElement.insertBefore(document.createElement('br'),existingPrice);
        resolve();
    });
}
