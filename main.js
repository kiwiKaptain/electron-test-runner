const { app, BrowserWindow, ipcMain, nativeTheme } = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const { spawn } = require("node:child_process");
const dotenv = require("dotenv");

const rootAppPath = app.getAppPath();

// const testRuntimePath = path.join(process.resourcesPath, "test-runtime");
const testRepoUrl = `https://github.com/kiwiKaptain/playwright-tests.git`;
const testProjectsPath = path.join(app.getPath("userData"), "test-projects");
const testProjectPath = path.join(testProjectsPath, "playwright-tests");

const testRuntimePath = app.isPackaged
    ? path.join(process.resourcesPath, "test-runtime")
    : path.join(__dirname, "test-runtime");

const envPath = app.isPackaged
    ? path.join(process.resourcesPath, "test-runtime", ".env")
    : path.resolve(process.cwd(), "test-runtime", ".env");

// 2. Load the file
dotenv.config({ path: envPath });

console.log("=========================================");
console.log("Electron Main Bootstrapped Environment:");
console.log("Searching for .env file at:", envPath);
console.log("Loaded BASE_URL:", process.env.BASE_URL); // This should now log your real string!
console.log("=========================================");

// const nodeExecutable = path.join(testRuntimePath, "node.exe");

const nodeExecutable = app.isPackaged
    ? path.join(process.resourcesPath, "node.exe")
    : path.join(rootAppPath, "bin", "node.exe");

const playwrightCli = path.join(
    testRuntimePath,
    "node_modules",
    "@playwright",
    "test",
    "cli.js",
);
const runtimeWorkspacePath = path.join(testRuntimePath, "workspace");
const playwrightReportPath = path.join(
    runtimeWorkspacePath,
    "playwright-report",
);
const reporterPath = path.join(
    testRuntimePath,
    "reporters",
    "electron-reporter.js",
);
const browsersPath = path.join(testRuntimePath, "playwright-browsers");
const runtimeConfigPath = path.join(testRuntimePath, "playwright.config.ts");

let mainWindow;
let testProcess = null;

function createInputDialog() {
    const dialogWindow = new BrowserWindow({
        width: 400,
        height: 250,
        parent: mainWindow,
        modal: true,
        show: false,
        frame: false,
        transparent: true,
        webPreferences: {
            preload: path.join(__dirname, "preload.js"),
        },
    });

    dialogWindow.loadFile("configurations.html");
    dialogWindow.once("ready-to-show", () => dialogWindow.show());
}

// 1. Listen for the trigger event from the main UI
ipcMain.on("open-input-dialog", () => {
    createInputDialog();
});

// Listen for submission from the input dialog
ipcMain.on("submit-input-data", (event, data) => {
    console.log("Received data from custom dialog:", data);
});

function runGit(args, cwd = undefined) {
    console.log("=========================================");
    console.log("Electron Main Bootstrapped Environment:");
    // console.log("Looking for .env file at:", );
    console.log("Loaded BASE_URL:", process.env.BASE_URL);
    console.log("=========================================");

    return new Promise((resolve, reject) => {
        const git = spawn("git", args, {
            cwd,
            windowsHide: true,
        });

        let stdout = "";
        let stderr = "";

        git.stdout.on("data", (data) => {
            stdout += data.toString();
        });

        git.stderr.on("data", (data) => {
            stderr += data.toString();
        });

        git.on("error", (error) => {
            reject(error);
        });

        git.on("close", (code) => {
            if (code === 0) {
                resolve({
                    stdout,
                    stderr,
                });
            } else {
                reject(new Error(`git ${args[0]} failed (${code}): ${stderr}`));
            }
        });
    });
}

function syncDirectory(src, dest) {
    if (!fs.existsSync(src)) return;
    if (!fs.existsSync(dest)) {
        fs.mkdirSync(dest, { recursive: true });
    }

    const entries = fs.readdirSync(src, { withFileTypes: true });

    for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);

        if (entry.isDirectory()) {
            // Skip copying node_modules or system folders if they accidentally leak in
            if (entry.name === "node_modules" || entry.name === ".git")
                continue;
            syncDirectory(srcPath, destPath);
        } else {
            // Only copy if the file is new or has a different size/timestamp
            const srcStat = fs.statSync(srcPath);
            let shouldCopy = true;

            if (fs.existsSync(destPath)) {
                const destStat = fs.statSync(destPath);
                if (
                    srcStat.mtimeMs === destStat.mtimeMs &&
                    srcStat.size === destStat.size
                ) {
                    shouldCopy = false;
                }
            }

            if (shouldCopy) {
                fs.copyFileSync(srcPath, destPath);
                // Sync timestamps so we don't blindly recopy it next time
                fs.utimesSync(destPath, srcStat.atime, srcStat.mtime);
            }
        }
    }
}

async function initializeTestRepository() {
    await fs.promises.mkdir(testProjectsPath, {
        recursive: true,
    });

    const gitFolder = path.join(testProjectPath, ".git");
    const repositoryExists = fs.existsSync(gitFolder);

    if (!repositoryExists) {
        console.log("Test repository does not exist. Cloning...");

        await runGit(["clone", testRepoUrl, testProjectPath]);

        console.log("Test repository cloned.");
        console.log("Test project path:", testProjectPath);
    } else {
        console.log("Test repository already exists. Updating...");

        await runGit(["pull", "--ff-only"], testProjectPath);

        console.log("Test repository updated.");
        console.log("Test project path:", testProjectPath);
    }

    return testProjectPath;
}

// async function getTestFiles() {
//     const testsPath = path.join(testProjectPath);

//     const files = [];

//     async function scanDirectory(directory) {
//         const entries = await fs.promises.readdir(directory, {
//             withFileTypes: true,
//         });

//         for (const entry of entries) {
//             const fullPath = path.join(directory, entry.name);

//             if (entry.isDirectory()) {
//                 await scanDirectory(fullPath);
//                 continue;
//             }

//             if (
//                 entry.name.endsWith(".spec.ts") ||
//                 entry.name.endsWith(".test.ts")
//             ) {
//                 files.push(path.relative(testProjectPath, fullPath));
//             }
//         }
//     }

//     await scanDirectory(testsPath);

//     return files;
// }

async function getTestFiles() {
    // Scan directly out of the checked out git directory
    const testsPath = testProjectPath;
    const files = [];

    async function scanDirectory(directory) {
        const entries = await fs.promises.readdir(directory, {
            withFileTypes: true,
        });

        for (const entry of entries) {
            const fullPath = path.join(directory, entry.name);

            if (entry.isDirectory()) {
                // Skip common large dependency folders if they exist in repo
                if (entry.name === "node_modules" || entry.name === ".git")
                    continue;
                await scanDirectory(fullPath);
                continue;
            }

            if (
                entry.name.endsWith(".spec.ts") ||
                entry.name.endsWith(".test.ts")
            ) {
                // Returns standard paths like "tests/metrix-hub/logs.spec.ts"
                const relativePath = path.relative(testProjectPath, fullPath);
                files.push(relativePath.replace(/\\/g, "/")); // Standardize to forward slashes for cross-platform UI
            }
        }
    }

    if (fs.existsSync(testsPath)) {
        await scanDirectory(testsPath);
    }

    return files;
}

ipcMain.handle("test-repository:get-files", async () => {
    try {
        const files = await getTestFiles();

        return {
            success: true,
            files,
        };
    } catch (error) {
        return {
            success: false,
            message: error.message,
        };
    }
});

ipcMain.handle("dark-mode:toggle", () => {
    if (nativeTheme.shouldUseDarkColors) {
        nativeTheme.themeSource = "light";
    } else {
        nativeTheme.themeSource = "dark";
    }
    return nativeTheme.shouldUseDarkColors;
});

ipcMain.handle("dark-mode:system", () => {
    nativeTheme.themeSource = "system";
});

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,

        webPreferences: {
            preload: path.join(__dirname, "preload.js"),
            contextIsolation: true,
            nodeIntegration: false,
        },
    });

    mainWindow.loadFile(path.join(__dirname, "index.html"));
}

function parsePlaywrightList(stdout) {
    const lines = stdout.split(/\r?\n/);
    const groups = new Map();

    for (const line of lines) {
        const trimmed = line.trim();

        if (!trimmed) continue;
        if (trimmed.startsWith("Listing tests:")) continue;
        if (trimmed.startsWith("Total:")) continue;

        const parts = trimmed.split("›").map((part) => part.trim());

        // A valid line must have at least: [project] › file:line:col › title
        if (parts.length < 3) {
            continue;
        }

        const projectPart = parts[0]; // e.g., "[chromium]"
        const location = parts[1]; // e.g., "metrix-hub\assets.spec.ts:71:7"

        // FIXED REGEX: Uses standard ending anchor \$ with NO double backslashes
        const locationMatch = location.match(/^(.*):(\d+):(\d+)$/);

        if (!locationMatch) {
            console.warn("Could not parse Playwright test location:", location);
            continue;
        }

        const file = locationMatch[1];
        const lineNumber = Number(locationMatch[2]);
        const column = Number(locationMatch[3]);

        const testTitle = parts[parts.length - 1];

        // Everything between the location (parts[1]) and the test title (last item) is a suite name
        const suites = parts.slice(2, -1);

        // Group tests by their suite sequence (e.g., "Variable CRUD") or default to "Ungrouped"
        const groupTitle = suites.length > 0 ? suites.join(" › ") : "Ungrouped";

        if (!groups.has(groupTitle)) {
            groups.set(groupTitle, {
                title: groupTitle,
                tests: [],
            });
        }

        groups.get(groupTitle).tests.push({
            id: `${file}:${lineNumber}:${column}`,
            testCaseId: `${String(
                groups.get(groupTitle).tests.length + 1,
            ).padStart(3, "0")}`,
            title: testTitle,
            file,
            line: lineNumber,
            column,
            location,
            suites,
            project: projectPart.replace(/[\[\]]/g, ""), // e.g., "chromium"
        });
    }

    return Array.from(groups.values());
}

// function parsePlaywrightList(stdout) {
//     const lines = stdout.split(/\r?\n/);
//     const groups = new Map();

//     for (const line of lines) {
//         const trimmed = line.trim();

//         if (!trimmed) continue;
//         if (trimmed.startsWith("Listing tests:")) continue;
//         if (trimmed.startsWith("Total:")) continue;

//         const parts = trimmed.split("›").map((part) => part.trim());

//         if (parts.length < 3) {
//             continue;
//         }

//         const location = parts[1];
//         const locationMatch = location.match(/^(.*):(\d+):(\d+)$/);

//         if (!locationMatch) {
//             console.warn("Could not parse Playwright test location:", location);

//             continue;
//         }

//         const file = locationMatch[1];
//         const lineNumber = Number(locationMatch[2]);
//         const column = Number(locationMatch[3]);
//         const testTitle = parts[parts.length - 1];
//         const suites = parts.slice(1, -1);
//         const groupTitle = suites.length > 0 ? suites.join(" › ") : "Ungrouped";

//         if (!groups.has(groupTitle)) {
//             groups.set(groupTitle, {
//                 title: groupTitle,
//                 tests: [],
//             });
//         }

//         groups.get(groupTitle).tests.push({
//             id: `${file}:${lineNumber}:${column}`,
//             testCaseId: `${String(
//                 groups.get(groupTitle).tests.length + 1,
//             ).padStart(3, "0")}`,
//             title: testTitle,
//             file,
//             line: lineNumber,
//             column,
//             location,
//             suites,
//         });
//     }

//     return Array.from(groups.values());
// }

ipcMain.handle("tests:list", async (event, websiteFolder) => {
    return new Promise((resolve) => {
        console.log("Test runtime:", testRuntimePath);
        console.log("Test Repo:", testProjectPath);
        console.log("Node:", nodeExecutable);
        console.log("Playwright CLI:", playwrightCli);
        console.log("Browsers:", browsersPath);
        console.log("Config Path: ", runtimeConfigPath);

        try {
            console.log("Syncing tests to runtime workspace...");
            syncDirectory(testProjectPath, runtimeWorkspacePath);
        } catch (syncError) {
            console.error("Sync failed:", syncError);
            return resolve({
                success: false,
                message: `Sync error: ${syncError.message}`,
            });
        }

        if (!fs.existsSync(nodeExecutable)) {
            resolve({
                success: false,
                tests: [],
                error: `Bundled Node not found: ${nodeExecutable}`,
            });

            return;
        }

        if (!fs.existsSync(playwrightCli)) {
            resolve({
                success: false,
                tests: [],
                error: `Playwright CLI not found: ${playwrightCli}`,
            });

            return;
        }

        const args = [playwrightCli, "test", "--list"];

        if (websiteFolder) {
            args.push(websiteFolder);
        }

        const listProcess = spawn(nodeExecutable, args, {
            // cwd: testRuntimePath,
            // cwd: testProjectPath,
            cwd: runtimeWorkspacePath,

            env: {
                ...process.env,
                NODE_PATH: path.join(testRuntimePath, "node_modules"),
                PLAYWRIGHT_BROWSERS_PATH: browsersPath,
                // PLAYWRIGHT_CHROMIUM_CHANNEL: "chrome",
            },

            stdio: ["ignore", "pipe", "pipe"],
        });

        let stdout = "";
        let stderr = "";

        listProcess.stdout.on("data", (data) => {
            stdout += data.toString();
        });

        listProcess.stderr.on("data", (data) => {
            stderr += data.toString();
        });

        listProcess.on("error", (error) => {
            console.error("Failed to list tests:", error);

            resolve({
                success: false,
                tests: [],
                error: error.message,
            });
        });

        listProcess.on("close", (code) => {
            console.log("Playwright exit code:", code);
            // console.log("stdout:", stdout);
            console.log("stderr:", stderr);

            if (code !== 0) {
                resolve({
                    success: false,
                    tests: [],
                    error:
                        stderr ||
                        stdout ||
                        `Playwright exited with code ${code}`,
                });

                return;
            }

            const tests = parsePlaywrightList(stdout);
            // console.log("Parsed tests:", JSON.stringify(tests, null, 2));

            resolve({
                success: true,
                tests,
            });
        });
    });
});

ipcMain.handle(
    "playwright:run",
    async (event, selectedTests, userInputUrl, credentials) => {
        return new Promise((resolve) => {
            if (testProcess) {
                resolve({
                    success: false,
                    message: "Tests are already running",
                });

                return;
            }

            if (!Array.isArray(selectedTests) || selectedTests.length === 0) {
                resolve({
                    success: false,
                    message: "No tests selected",
                });

                return;
            }

            const normalizedTests = selectedTests.map((test) => {
                return test
                    .replace(/^\[[^\]]+\]\s*›\s*/, "")
                    .replace(/\\/g, "/")
                    .trim();
            });

            const configPath = path.join(
                runtimeWorkspacePath,
                "playwright.config.ts",
            );

            const args = [
                playwrightCli,
                "test",
                ...normalizedTests,
                "--config",
                // runtimeConfigPath,
                configPath,
                "--workers=1",
                "--reporter",
                `${reporterPath},html`,
            ];

            console.log("Starting Playwright:");
            console.log(process.execPath, args);

            testProcess = spawn(nodeExecutable, args, {
                // cwd: testRuntimePath,
                // cwd: testProjectPath,
                cwd: runtimeWorkspacePath,

                env: {
                    ...process.env,
                    PLAYWRIGHT_BROWSERS_PATH: browsersPath,
                    // PLAYWRIGHT_CHROMIUM_CHANNEL: "chrome"
                    BASE_URL: userInputUrl,
                    TEST_USERNAME: credentials.username,
                    TEST_PASSWORD: credentials.password,
                },

                stdio: ["ignore", "pipe", "pipe"],
            });

            let reporterBuffer = "";

            testProcess.stdout.on("data", (data) => {
                reporterBuffer += data.toString();

                const lines = reporterBuffer.split(/\r?\n/);
                reporterBuffer = lines.pop() || "";

                for (const outputLine of lines) {
                    if (!outputLine.trim()) {
                        continue;
                    }

                    try {
                        const event = JSON.parse(outputLine);

                        console.log("[Reporter]", event);

                        if (mainWindow && !mainWindow.isDestroyed()) {
                            mainWindow.webContents.send(
                                "playwright:event",
                                event,
                            );
                        }
                    } catch (error) {
                        console.error("Invalid reporter JSON:", outputLine);
                    }
                }
            });

            testProcess.stderr.on("data", (data) => {
                const text = data.toString();
                console.error("[Playwright]", text);
            });

            testProcess.on("error", (error) => {
                console.error("Playwright process error:", error);

                testProcess = null;

                resolve({
                    success: false,
                    message: error.message,
                });
            });

            // testProcess.on("close", (code) => {
            //     console.log("Playwright finished:", code);

            //     if (mainWindow && !mainWindow.isDestroyed()) {
            //         mainWindow.webContents.send("playwright:finished", code);
            //     }

            //     testProcess = null;

            //     resolve({
            //         success: code === 0,
            //         exitCode: code,
            //     });
            // });

            testProcess.on("close", (code) => {
                console.log("Playwright finished:", code);

                // 1. Check if the process was manually interrupted (code is null)
                const isInterrupted = code === null;

                // 2. Build the result payload containing the interruption status
                const resultPayload = {
                    code: code,
                    interrupted: isInterrupted,
                };

                // 3. Send the updated payload to the UI
                if (mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.webContents.send(
                        "playwright:finished",
                        resultPayload,
                    );
                }

                testProcess = null;

                // 4. Resolve the promise with explicit status flags
                resolve({
                    success: code === 0,
                    interrupted: isInterrupted,
                    exitCode: code,
                    message: isInterrupted
                        ? "Execution Stopped: Canceled by user."
                        : "Failed to run tests",
                });
            });

            console.log("========== PLAYWRIGHT DEBUG ==========");
            console.log("Electron:", process.execPath);
            console.log("Node:", nodeExecutable);
            console.log("Node exists:", fs.existsSync(nodeExecutable));
            console.log("Runtime:", testRuntimePath);
            console.log("Runtime exists:", fs.existsSync(testRuntimePath));
            console.log("CLI:", playwrightCli);
            console.log("CLI exists:", fs.existsSync(playwrightCli));
            console.log("Reporter:", reporterPath);
            console.log("Reporter exists:", fs.existsSync(reporterPath));
            console.log("Browsers:", browsersPath);
            console.log("Browsers exists:", fs.existsSync(browsersPath));
            console.log("CWD:", testProjectPath);
            console.log("Workspace:", runtimeWorkspacePath);
            console.log("Config Path:", runtimeConfigPath);
            console.log("Args:", args);
            console.log("userInputUrl:", userInputUrl);
            console.log("======================================");
        });
    },
);

ipcMain.handle("playwright:stop", async () => {
    if (!testProcess) {
        return {
            success: false,
            message: "No tests are running",
        };
    }

    console.log("Stopping Playwright...");
    testProcess.kill();
    testProcess = null;

    return {
        success: true,
    };
});

ipcMain.handle("open-playwright-report", async () => {
    if (!fs.existsSync(playwrightReportPath)) {
        throw new Error(`Playwright report not found: ${playwrightReportPath}`);
    }

    const indexPath = path.join(playwrightReportPath, "index.html");

    if (!fs.existsSync(indexPath)) {
        throw new Error(`Playwright report index.html not found: ${indexPath}`);
    }

    const reportWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        webPreferences: {
            contextIsolation: true,
            nodeIntegration: false,
        },
    });

    await reportWindow.loadFile(indexPath);

    return true;
});

app.whenReady().then(async () => {
    try {
        // This should include your git clone logic
        await initializeTestRepository();

        // Only create the window after repo is ready
        createWindow();
    } catch (error) {
        console.error("Failed to initialize test repository:", error);

        // Still create the window so the app is usable
        createWindow();

        // Notify renderer that initialization failed
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send("test-repository:error", error.message);
        }
    }

    app.on("activate", () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on("window-all-closed", () => {
    if (testProcess) {
        testProcess.kill();
        testProcess = null;
    }

    if (process.platform !== "darwin") {
        app.quit();
    }
});
