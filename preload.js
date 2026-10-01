// const { contextBridge, ipcRenderer } = require("electron");

// contextBridge.exposeInMainWorld("electronAPI", {
//     ping: () => ipcRenderer.invoke("ping"),

//     onPlaywrightEvent: (callback) => {
//         ipcRenderer.on("playwright:event", (event, data) => {
//             callback(data);
//         });
//     },

//     listTests: (websiteFolder) =>
//         ipcRenderer.invoke("tests:list", websiteFolder),

//     runTests: (tests, userInputUrl, credentials) =>
//         ipcRenderer.invoke("playwright:run", tests, userInputUrl, credentials),

//     stopTests: () => ipcRenderer.invoke("playwright:stop"),

//     onOutput: (callback) => {
//         ipcRenderer.on("playwright:output", (event, data) => {
//             callback(data);
//         });
//     },

//     onTestStatus: (callback) => {
//         ipcRenderer.on("playwright:test-status", (event, test) => {
//             callback(test);
//         });
//     },

//     onFinished: (callback) => {
//         ipcRenderer.on("playwright:finished", (event, code) => {
//             callback(code);
//         });
//     },

//     // onFinished: (callback) => {
//     //     ipcRenderer.on("playwright:finished", (event, summary) => {
//     //         // summary is now an object: { code, total, passed, failed }
//     //         callback(summary);
//     //     });
//     // },

//     // onFinished: (callback) => {
//     //     ipcRenderer.on("playwright:finished", (event, resultPayload) => {
//     //         callback(resultPayload);
//     //     });
//     // },

//     showPlaywrightReport: () => {
//         return ipcRenderer.invoke("open-playwright-report");
//     },

//     // Triggers the main process to open the dialog window
//     openInputDialog: () => ipcRenderer.send("open-input-dialog"),

//     // Sends submitted data back to the main process from the dialog window
//     sendData: (data) => ipcRenderer.send("submit-input-data", data),
// });

const { contextBridge, ipcRenderer } = require("electron");

const createIpcListener = (channel) => (callback) => {
    ipcRenderer.removeAllListeners(channel);
    ipcRenderer.on(channel, (event, ...args) => callback(...args));
};

contextBridge.exposeInMainWorld("electronAPI", {
    baseUrl: process.env.BASE_URL || "https://playwright.dev",
    defaultUser: process.env.TEST_USERNAME || "",
    defaultPassword: process.env.TEST_PASSWORD || "",

    ping: () => ipcRenderer.invoke("ping"),

    listTests: (websiteFolder) =>
        ipcRenderer.invoke("tests:list", websiteFolder),

    runTests: (tests, userInputUrl, credentials) =>
        ipcRenderer.invoke("playwright:run", tests, userInputUrl, credentials),

    stopTests: () => ipcRenderer.invoke("playwright:stop"),

    showPlaywrightReport: () => ipcRenderer.invoke("open-playwright-report"),

    openInputDialog: () => ipcRenderer.send("open-input-dialog"),

    sendData: (data) => ipcRenderer.send("submit-input-data", data),

    onPlaywrightEvent: createIpcListener("playwright:event"),

    onOutput: createIpcListener("playwright:output"),

    onTestStatus: createIpcListener("playwright:test-status"),

    onFinished: createIpcListener("playwright:finished"),
});
