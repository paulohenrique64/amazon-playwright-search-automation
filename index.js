require('dotenv').config();

const playwright = require('playwright');
const { chromium, firefox, webkit } = require('playwright');

async function main() {
    // setting up
    const search_keyword = process.argv[2];
    let browser;

    if (!search_keyword) {
        console.log("Usage: npm run start 'Keyword'");
        return;
    }

    try {
        browser = await browserConnection();
    } catch (error) {
        console.error(error);
        return;
    }

    // opening amazon website and setting location
    const page = await browser.newPage();
    await page.goto('https://www.amazon.com', { timeout: 2 * 60 * 10000});
    console.log('Amazon website opened...');
    await pauseAndScreenshot(page);
    await page.locator('#nav-global-location-popover-link').click();
    await pauseAndScreenshot(page);
    await page.locator('.GLUX_Full_Width').fill("11001");
    await pauseAndScreenshot(page);
    await page.locator('[class="a-column a-span4 a-span-last"]').getByText('Apply').click()
    await pauseAndScreenshot(page);
    await page.click('.a-popover-footer > .a-button.a-column.a-button-primary.a-button-span4 > .a-button-inner.a-declarative');
    await pauseAndScreenshot(page);
    console.log('Location 11001 selected...');

    // search
    searched_keyword = 'mechanical keyboard'
    await page.fill('#twotabsearchtextbox', search_keyword);
    await pauseAndScreenshot(page);
    await page.click('#nav-search-submit-button');
    await pauseAndScreenshot(page);

    let founded = false;
    for (const product of await page.locator('[class*=s-result-item][class*=s-asin]').all()) {
        if (!(await product.textContent()).includes("Sponsored")) {
            console.log('Product founded...');
            await product.locator('[class="s-image"]').first().click();
            await pauseAndScreenshot(page);
            founded = true;
            break;
        }
    }

    if (!founded) {
        console.log("Product not founded!");
        return;
    }

    // in product page
    const productData = await collectProductData(page);
    await showSearchResult(productData);
    
    // Close browser
    await browser.close();
}

async function browserConnection() {
    const browser_name = process.env.PLAYWRIGHT_BROWSER;
    console.log(`Connection to scrape ${browser_name} browser...`);

    let browser;
    switch (browser_name) {
        case 'chromium':
            browser = await chromium.launch();
            break;
        case 'firefox':
            browser = await firefox.launch();
            break;
        case 'webkit':
            browser = await webkit.launch();
            break;
        default:
            throw new Error(`Unsupported browser: ${browserName}`);
    }

    console.log('Connected! Navigating...');
    return browser;
}

async function collectProductData(page) {
    let productData = {
        title: undefined,
        price: undefined,
        boughts: undefined,
        bulletPoints: undefined
    }

    // title
    try {
        productData.title = await page.locator('#title_feature_div').innerText();
    } catch (e) {
        if (e instanceof playwright.errors.TimeoutError) {
          console.log("Title not found, try: 1");
        }
    }

    // price
    try {
        productData.price = await page.locator('#corePriceDisplay_desktop_feature_div').locator('[class="aok-offscreen"]').first().innerText();
    } catch (e) {
        if (e instanceof playwright.errors.TimeoutError) {
          console.log("Price not found, try: 1");
        }
    }

    if (!productData.price) {
        try {
            productData.price = await page.locator('#corePrice_desktop').locator('[class="a-offscreen"]').first().innerText();
        } catch (e) {
            if (e instanceof playwright.errors.TimeoutError) {
              console.log("Price not found, try: 2");
            }
        }
    }
    
    // boughts
    try {
        productData.boughts = await page.locator('#socialProofingAsinFaceout_feature_div').innerText();
    } catch (e) {
        if (e instanceof playwright.errors.TimeoutError) {
          console.log("Boughts not found, try: 1");
        }
    }

    // bulletPoints
    try {
        productData.bulletPoints = await page.locator('#featurebullets_feature_div').locator('li').all();
    } catch (e) {
        if (e instanceof playwright.errors.TimeoutError) {
          console.log("Bullet points not found, try: 1");
        }
    }

    return productData;
}

async function showSearchResult(productData) {
    console.log("\n");

    if (productData.title) console.log(`Title: ${productData.title}\n`);
    if (productData.price) console.log(`Price: ${productData.price}\n`);
    if (productData.boughts) console.log(`Boughts: ${productData.boughts}\n`);
    if (productData.bulletPoints) {
        for (const bulletPoint of productData.bulletPoints) 
            console.log(`* ${await bulletPoint.textContent()}\n`);
    }
}

async function pauseAndScreenshot(page) {
    await page.waitForTimeout(2000);
    await page.screenshot({path: 'page.png', fullPage: false});
}

main();

