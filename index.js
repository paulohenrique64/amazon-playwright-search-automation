require('dotenv').config();

const fs = require('fs');
const playwright = require('playwright');
const { chromium, firefox, webkit } = require('playwright');

async function main() {
    // setting up
    const search_keyword = process.argv[2];
    let browser;

    if (!search_keyword) 
        return console.log("Usage: npm run start 'Keyword'");
        
    try {
        browser = await browserConnection();
    } catch (error) {
        return console.error(error);
    }


    // opening amazon website and setting location
    const page = await browser.newPage();
    await page.waitForTimeout(2000);
    
    let reloadPage = true;
    while (reloadPage) {
        await page.goto('https://www.amazon.com', { timeout: 2 * 60 * 1000});
        console.log('Amazon website opened...');
        await page.waitForTimeout(2000);

        try {
            await page.locator('#nav-global-location-popover-link').click();
            reloadPage = false;
        } catch (e) {
            if (e instanceof playwright.errors.TimeoutError) 
                console.log("Website load error, reloading...");
        }
    }

    await page.waitForTimeout(2000);
    await page.locator('.GLUX_Full_Width').fill("11001");
    await page.waitForTimeout(2000);
    await page.locator('[class="a-column a-span4 a-span-last"]').getByText('Apply').click()
    await page.waitForTimeout(2000);
    await page.click('.a-popover-footer > .a-button.a-column.a-button-primary.a-button-span4 > .a-button-inner.a-declarative');
    await page.waitForTimeout(2000);
    console.log('Location 11001 selected...');

 
    // searching
    await page.fill('#twotabsearchtextbox', search_keyword);
    await page.waitForTimeout(2000);
    await page.click('#nav-search-submit-button');
    await page.waitForTimeout(2000);
    console.log(`Searching for ${search_keyword}...`);

    let founded = false;
    for (const product of await page.locator('[class*=s-result-item][class*=s-asin]').all()) {
        if (!(await product.textContent()).includes("Sponsored")) {
            console.log('Product founded...');
            founded = true;

            await product.locator('[class="s-image"]').first().click();
            await page.waitForTimeout(2000);
            break;
        }
    }

    if (!founded) 
        return console.log("Product not founded!");


    // in product page
    const productData = await collectProductData(page);
    await showSearchResult(productData);
    saveInCsv(productData);
    

    // close browser
    await browser.close();
}

// make connection with browser set in .env file
async function browserConnection() {
    const browser_name = process.env.PLAYWRIGHT_BROWSER;
    console.log(`Connection to scrape ${browser_name} browser...`);

    let browser;
    switch (browser_name) {
        case 'chromium':
            browser = await chromium.launch({ headless: false });
            break;
        case 'firefox':
            browser = await firefox.launch({ headless: false });
            break;
        case 'webkit':
            browser = await webkit.launch({ headless: false });
            break;
        default:
            throw new Error(`Unsupported browser: ${browserName}`);
    }

    console.log('Connected! Navigating...');
    return browser;
}

// collect product data of amazon page with handle exception
async function collectProductData(page) {
    console.log("Colleting data, please wait...");

    let productData = {
        title: undefined,
        price: undefined,
        boughts: undefined,
        bulletPoints: undefined
    }

    // title
    try {
        productData.title = await page
            .locator('#title_feature_div')
            .innerText();
    } catch (e) {
        if (e instanceof playwright.errors.TimeoutError) {
          console.log("Title not found, try: 1");
        }
    }

    // price
    try {
        await page.waitForSelector('#corePriceDisplay_desktop_feature_div', {timeout: 2000})
        productData.price = await page
            .locator('#corePriceDisplay_desktop_feature_div')
            .locator('[class="aok-offscreen"]')
            .first()
            .innerText();
    } catch (e) {
        if (e instanceof playwright.errors.TimeoutError) {
          console.log("Price not found, try: 1");
        }
    }

    if (!productData.price) {
        try {
            productData.price = await page
            .locator('#corePrice_desktop')
            .locator('[class="a-offscreen"]')
            .first()
            .innerText();
        } catch (e) {
            if (e instanceof playwright.errors.TimeoutError) {
              console.log("Price not found, try: 2");
            }
        }
    }
    
    // boughts
    try {
        productData.boughts = await page
            .locator('#socialProofingAsinFaceout_feature_div')
            .innerText();
    } catch (e) {
        if (e instanceof playwright.errors.TimeoutError) {
          console.log("Boughts not found, try: 1");
        }
    }

    // bulletPoints
    try {
        productData.bulletPoints = await page
            .locator('#featurebullets_feature_div')
            .locator('li')
            .all({timeout: 5000});
    } catch (e) {
        if (e instanceof playwright.errors.TimeoutError) {
          console.log("Bullet points not found, try: 1");
        }
    }

    return productData;
}

async function showSearchResult(productData) {
    console.log(`\nProduct data:\nTitle: ${productData.title}\nPrice: ${productData.price}\nBoughts: ${productData.boughts}\n`);

    if (productData.bulletPoints) {
        console.log('Bullet points: \n');
        for (const bulletPoint of productData.bulletPoints) 
            console.log(`*${await bulletPoint.textContent()}`);
    }
}

function saveInCsv(productData) {
    let csvContent = '';

    // add headers if file not exists
    if (!fs.existsSync('searched_data.csv')) csvContent += 'Title,Price,Boughts\n';
        
    // add formated data
    csvContent += `"${productData.title || ''}","${productData.price || ''}","${productData.boughts || ''}"\n`;

    // create a csv file
    fs.appendFileSync('searched_data.csv', csvContent);
    console.log('\nData successfully saved to CSV file');
}

main();

