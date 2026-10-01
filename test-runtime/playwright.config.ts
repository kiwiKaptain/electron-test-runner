// const { defineConfig } = require("@playwright/test");
// const dotenv = require("dotenv");
// const path = require("path");

// const envPath = path.join(__dirname, ".env");

// dotenv.config({
//     path: envPath, quiet: true
// });

// module.exports = defineConfig({
//     testDir: "./tests",

//     use: {
//         browserName: "chromium",
//         headless: false,
//         baseURL: process.env.DYNAMIC_BASE_URL || process.env.BASE_URL,
//         screenshot: "on",
//         video: "on",
//         trace: "on-first-retry",
//     },

//     // projects: [
//     //     {
//     //         name: "chromium",
//     //         use: {
//     //             browserName: "chromium",
//     //         },
//     //     },
//     // ],
// });

// import { defineConfig, devices } from "@playwright/test";
// import dotenv from "dotenv";
// import path from "path";

// /**
//  * Read environment variables from file.
//  * In CommonJS compilation mode, global __dirname is safely available.
//  */
// dotenv.config({
//     path: path.resolve(__dirname, ".env"),
//     quiet: true,
// });

// /**
//  * See https://playwright.dev.
//  */
// export default defineConfig({
//     testDir: "./tests",

//     /* Run tests in files in parallel */
//     fullyParallel: true,

//     /* Fail the build on CI if you accidentally left test.only in the source code. */
//     forbidOnly: !!process.env.CI,

//     /* Retry on CI only */
//     retries: process.env.CI ? 2 : 0,

//     /* Opt out of parallel tests on CI. */
//     workers: process.env.CI ? 1 : undefined,

//     /* Reporter to use. See https://playwright.dev */
//     reporter: [["list"], ["html", { open: "never" }]],

//     /* Shared settings for all the projects below. See https://playwright.dev. */
//     use: {
//         /* Base URL to use in actions like `await page.goto('')`. */
//         baseURL: process.env.BASE_URL,

//         // Browser configurations
//         browserName: "chromium",
//         headless: false,

//         screenshot: "on",
//         video: "on",

//         /* Collect trace when retrying the failed test. See https://playwright.dev */
//         trace: "on-first-retry",
//     },

//     /* Configure projects for major browsers */
//     projects: [
//         {
//             name: "chromium",
//             use: { browserName: "chromium" },
//         },
//     ],
// });

import { defineConfig, devices } from "@playwright/test";
import dotenv from "dotenv";
import path from "path";

// In standard Playwright CommonJS/TS hybrid project environments, __dirname is safely available
const envPath = path.join(__dirname, ".env");

dotenv.config({
    path: envPath,
    quiet: true,
});

export default defineConfig({
    timeout: 90000,
    testDir: "./tests",
    testMatch: "**/*.spec.ts",

    use: {
        browserName: "chromium",
        headless: false,
        baseURL: process.env.DYNAMIC_BASE_URL || process.env.BASE_URL,
        screenshot: "on",
        video: "on",
        trace: "on-first-retry",
    },

    projects: [
        {
            name: "chromium",
            use: {
                // browserName: "chromium",
            },
            // name: "Google Chrome",
            // use: {
            //     // browserName: "chromium",
            //     ...devices['Desktop Chrome'],
            //     channel: 'chrome'
            // },
        },
    ],
    reporter: [["list"], ["html", { open: "never" }]],
});
