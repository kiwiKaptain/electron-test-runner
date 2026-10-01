// import {} from "./modules/state.js";

const testsContainer = document.getElementById("tests-container");
const testCount = document.getElementById("test-count");
const runStatus = document.getElementById("run-status");
const searchInput = document.getElementById("test-search");
const clearSearchButton = document.getElementById("clear-search");
const searchResultCount = document.getElementById("search-result-count");
const totalTestCount = document.querySelectorAll(".test").length;
const modal = document.getElementById("inputModal");
const showBtn = document.getElementById("showModalBtn");
const closeBtn = document.getElementById("closeModalBtn");
const form = document.getElementById("modalForm");
const websiteDropdown = document.getElementById("modalWebsite");
const passwordInput = document.getElementById("modalPassword");
const togglePasswordBtn = document.getElementById("togglePassword");
const passwordIcon = document.getElementById("passwordIcon");

let selectedWebsiteFolder = "";

window.addEventListener("DOMContentLoaded", () => {
    // 1. Target your specific HTML form inputs by their IDs
    const urlInput = document.getElementById("baseUrlInput");
    const userInput = document.getElementById("modalUser");
    const passwordInput = document.getElementById("modalPassword");

    // 2. Safely read from the bridged object we created in preload.js
    if (window.electronAPI) {
        if (urlInput) urlInput.value = window.electronAPI.baseUrl;
        if (userInput) userInput.value = window.electronAPI.defaultUser;
        if (passwordInput)
            passwordInput.value = window.electronAPI.defaultPassword;
    }
});

// togglePasswordBtn.addEventListener("click", (event) => {
if (togglePasswordBtn && passwordInput && passwordIcon) {
    togglePasswordBtn.addEventListener("click", () => {
        // Toggle the input type attribute
        const isPassword = passwordInput.getAttribute("type") === "password";
        passwordInput.setAttribute("type", isPassword ? "text" : "password");

        // Swap out the .svg file paths and hover text titles accordingly
        passwordIcon.setAttribute(
            "src",
            isPassword
                ? "assets/eye-off-svgrepo-com.svg"
                : "assets/eye-show-svgrepo-com.svg",
        );
        togglePasswordBtn.title = isPassword
            ? "Hide password"
            : "Show password";
    });
}
// });

websiteDropdown.addEventListener("change", (event) => {
    selectedWebsiteFolder = event.target.value;
});

// Open the modal as a backdrop-locked overlay
showBtn.addEventListener("click", () => {
    modal.showModal();
});

// Close it if they hit cancel
closeBtn.addEventListener("click", () => {
    modal.close();
});

// Handle data submission
form.addEventListener("submit", (e) => {
    const data = {
        username: document.getElementById("modalUser").value,
        password: document.getElementById("modalPassword").value,
    };
    console.log("Captured Data directly in frontend:", data);
    loadTests(selectedWebsiteFolder);
});

window.discoveredTests = [];

window.electronAPI.onPlaywrightEvent((event) => {
    console.log("Playwright event:", event);

    switch (event.type) {
        case "run-started":
            runStatus.textContent = `Running ${event.total} tests...`;
            break;

        case "test-started":
            updateTestStatus(event.test, "running");
            break;

        case "test-finished":
            updateTestStatus(event.test, event.result.status);
            console.log(
                "Test finished:",
                event.test.title,
                event.result.status,
            );
            break;

        case "run-finished":
            runStatus.textContent = `Run ${event.status}`;
            document.getElementById("run").disabled = false;
            break;
    }
});

searchInput.addEventListener("input", () => {
    filterTests(searchInput.value);
});

function convertStatus(status) {
    switch (status) {
        case "passed":
            return "passed";

        case "failed":
            return "failed";

        case "timedOut":
            return "failed";

        case "skipped":
            return "stopped";

        case "stopped":
            return "stopped";

        case "running":
            return "running";

        case null:
            return "stopped";

        default:
            return "not-run";
    }
}

function formatStatus(status) {
    const statuses = {
        "not-run": "Not Run",
        running: "Running",
        passed: "Passed",
        failed: "Failed",
        skipped: "Skipped",
        stopped: "Stopped",
        timedOut: "Timed Out",
        interrupted: "Interrupted",
        null: "stopped",
    };

    return statuses[status] || status;
}

async function loadTests(selectedWebsite = "") {
    testsContainer.innerHTML = `
        <div class="empty">
            Loading tests...
        </div>
    `;

    try {
        const result = await window.electronAPI.listTests(selectedWebsite);

        if (!result.success) {
            testsContainer.innerHTML = `
                <div class="empty">
                    Failed to load tests:
                    ${escapeHtml(result.error)}
                </div>
            `;

            return;
        }

        window.discoveredTests = result.tests;

        console.log(window.discoveredTests);
        console.log(
            "Available test IDs:",
            // window.discoveredTests.map((test) => test.id),
            window.discoveredTests.flatMap((group) =>
                group.tests.map((test) => test.id),
            ),
        );

        // Count actual tests, not describe groups
        const totalTests = result.tests.reduce(
            (total, group) => total + group.tests.length,
            0,
        );

        testCount.textContent = `${totalTests} tests`;

        testsContainer.innerHTML = "";

        if (result.tests.length === 0) {
            testsContainer.innerHTML = `
                <div class="empty">
                    No Playwright tests found.
                </div>
            `;

            return;
        }

        result.tests.forEach((group, groupIndex) => {
            createTestGroupElement(group, groupIndex);
        });
    } catch (error) {
        testsContainer.innerHTML = `
            <div class="empty">
                Error loading tests:
                ${escapeHtml(error.message)}
            </div>
        `;
    }
}

function createTestGroupElement(group, groupIndex) {
    const groupElement = document.createElement("div");
    groupElement.className = "test-group";

    const header = document.createElement("div");
    header.className = "test-group-header";

    const collapseButton = document.createElement("button");
    collapseButton.className = "collapse-button";
    collapseButton.textContent = "▼";
    collapseButton.title = "Collapse group";

    const groupCheckbox = document.createElement("input");
    groupCheckbox.type = "checkbox";
    groupCheckbox.className = "group-checkbox";

    const title = document.createElement("span");
    title.className = "test-group-title";
    title.textContent = group.title;

    const count = document.createElement("span");
    count.className = "test-group-count";
    count.textContent = `(${group.tests.length})`;

    header.appendChild(groupCheckbox);
    header.appendChild(title);
    header.appendChild(count);
    header.appendChild(collapseButton);

    const groupTests = document.createElement("div");
    groupTests.className = "group-tests";

    group.tests.forEach((test, testIndex) => {
        createTestElement(test, testIndex, groupTests, groupIndex);
    });

    // Collapse / expand
    header.addEventListener("click", (event) => {
        const isCollapsed = groupTests.style.display === "none";

        groupTests.style.display = isCollapsed ? "" : "none";
        collapseButton.textContent = isCollapsed ? "▼" : "▶";
        collapseButton.title = isCollapsed ? "Collapse group" : "Expand group";
    });

    groupCheckbox.addEventListener("click", (event) => {
        event.stopPropagation();
    });

    // Select / deselect entire group
    groupCheckbox.addEventListener("change", () => {
        const checkboxes = groupTests.querySelectorAll(".test-checkbox");

        checkboxes.forEach((checkbox) => {
            checkbox.checked = groupCheckbox.checked;
        });
        groupCheckbox.indeterminate = false;
    });

    // Update group checkbox when individual tests change
    groupTests.addEventListener("change", () => {
        const checkboxes = [...groupTests.querySelectorAll(".test-checkbox")];
        const checkedCount = checkboxes.filter(
            (checkbox) => checkbox.checked,
        ).length;

        groupCheckbox.checked = checkedCount === checkboxes.length;
        groupCheckbox.indeterminate =
            checkedCount > 0 && checkedCount < checkboxes.length;
    });

    groupElement.appendChild(header);
    groupElement.appendChild(groupTests);

    testsContainer.appendChild(groupElement);
}

function createTestElement(
    test,
    testIndex,
    container = testsContainer,
    groupIndex = null,
) {
    const div = document.createElement("div");

    div.className = "test";
    div.dataset.groupIndex = groupIndex;
    div.dataset.testIndex = testIndex;
    div.dataset.testId = test.id;
    div.dataset.searchText = [test.title, test.file, test.line]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
    div.innerHTML = `
        <input
            type="checkbox"
            class="test-checkbox"
            data-group-index="${groupIndex}"
            data-test-index="${testIndex}"
        >

        <div class="test-info">
            <span class="test-title">
                ${escapeHtml(test.title)}
            </span>
        </div>

        <div class="test-status status-not-run">
            <span class="status-badge">
            
                <span class="status-text">
                    Not Run
                </span>
            </span>
        </div>
        `;
    // <span class="status-dot"></span>
    container.appendChild(div);
}

// function updateTestStatus(test, status) {
//     const convertedStatus = convertStatus(status);
//     const normalizedTestId = test.id.replace(/^tests[\\/]/, "");
//     const testElement = testsContainer.querySelector(
//         `.test[data-test-id="${CSS.escape(normalizedTestId)}"]`,
//     );

//     if (!testElement) {
//         console.warn("Could not find test element:", test.id);
//         console.warn(
//             "Available test IDs:",
//             // window.discoveredTests.map((test) => test.id),
//             window.discoveredTests.flatMap((group) =>
//                 group.tests.map((test) => test.id),
//             ),
//         );
//         return;
//     }

//     const statusElement = testElement.querySelector(".test-status");
//     const statusText = testElement.querySelector(".status-text");

//     if (!statusElement || !statusText) {
//         console.warn("Status elements not found:", test.id);
//         return;
//     }

//     statusElement.className = `test-status status-${status}`;
//     statusText.textContent = formatStatus(convertedStatus);
// }

function updateTestStatus(test, status) {
    const convertedStatus = convertStatus(status);

    // 1. Normalize the incoming ID from the reporter (force forward slashes)
    const incomingId = test.id.replace(/\\/g, "/");

    // 2. Try an exact query selector match first
    let testElement = testsContainer.querySelector(
        `.test[data-test-id="${CSS.escape(incomingId)}"]`,
    );

    // 3. Fallback: If exact match fails due to absolute vs relative path differences,
    // look through the elements to find a matching ID suffix
    if (!testElement) {
        testElement = Array.from(testsContainer.querySelectorAll(".test")).find(
            (el) => {
                const domId = el.dataset.testId
                    ? el.dataset.testId.replace(/\\/g, "/")
                    : "";
                return incomingId.endsWith(domId) || domId.endsWith(incomingId);
            },
        );
    }

    if (!testElement) {
        console.warn(
            "Could not find test element for incoming reporter ID:",
            test.id,
        );
        return;
    }

    // 4. Update your specific DOM structure
    const statusElement = testElement.querySelector(".test-status");
    const statusText = testElement.querySelector(".status-text");

    if (!statusElement || !statusText) {
        console.warn(
            "Status element components missing inside DOM for:",
            test.id,
        );
        return;
    }

    // Map your custom status class names (e.g., status-running, status-passed, status-failed)
    statusElement.className = `test-status status-${status.toLowerCase()}`;
    statusText.textContent = formatStatus(convertedStatus);
}

// function updateTestStatus(test, status) {
//     const convertedStatus = convertStatus(status);

//     // 💡 Fix: Normalize the incoming file path to use forward slashes
//     // and strip out any base folder prefix if necessary
//     const testFile = test.file.replace(/\\/g, "/").replace(/^tests[\\/]/, "");
//     const testLine = test.line;
//     const testColumn = test.column;

//     // Find the element using data attributes for file, line, and column
//     let testElement = testsContainer.querySelector(
//         `.test[data-file="${CSS.escape(testFile)}"][data-line="${testLine}"][data-column="${testColumn}"]`,
//     );

//     // Fallback: If your DOM doesn't have line/column, match by the file path and test title
//     if (!testElement && test.title) {
//         testElement = Array.from(testsContainer.querySelectorAll(`.test`)).find(
//             (el) => {
//                 return (
//                     el.dataset.file === testFile &&
//                     el.querySelector(".test-title")?.textContent === test.title
//                 );
//             },
//         );
//     }

//     if (!testElement) {
//         console.warn(
//             "Could not find test element for:",
//             testFile,
//             "at line:",
//             testLine,
//         );
//         return;
//     }

//     const statusElement = testElement.querySelector(".test-status");
//     const statusText = testElement.querySelector(".status-text");

//     if (!statusElement || !statusText) {
//         console.warn("Status elements missing inside DOM tree for:", testFile);
//         return;
//     }

//     // Update UI Classes & Texts
//     statusElement.className = `test-status status-${status}`;
//     statusText.textContent = formatStatus(convertedStatus);
// }

// function updateTestStatus(test, status) {
//     const convertedStatus = convertStatus(status);
//     const normalizedTestId = test.id.replace(/^tests[\\/]/, "");
//     const testElement = testsContainer.querySelector(
//         `.test[data-test-id="${CSS.escape(normalizedTestId)}"]`,
//     );

//     if (!testElement) {
//         console.warn("Could not find test element:", test.id);
//         console.warn(
//             "Available test IDs:",
//             // window.discoveredTests.map((test) => test.id),
//             window.discoveredTests.flatMap((group) =>
//                 group.tests.map((test) => test.id),
//             ),
//         );
//         return;
//     }

//     const statusElement = testElement.querySelector(".test-status");
//     const statusText = testElement.querySelector(".status-text");

//     if (!statusElement || !statusText) {
//         console.warn("Status elements not found:", test.id);
//         return;
//     }

//     statusElement.className = `test-status status-${status}`;
//     statusText.textContent = formatStatus(convertedStatus);
// }

// function updateTestStatus(test, status) {
//     const convertedStatus = convertStatus(status);

//     // FIX: Instead of stripping prefixes, make sure the string uses
//     // unified Windows-style backslashes to match your original discovery map
//     const normalizedTestId = test.id.replace(/\//g, "\\");

//     const testElement = testsContainer.querySelector(
//         `.test[data-test-id="${CSS.escape(normalizedTestId)}"]`,
//     );

//     if (!testElement) {
//         console.warn("Could not find test element:", test.id);
//         console.warn("Looking for normalized test ID:", normalizedTestId);
//         console.warn(
//             "Available test IDs in UI:",
//             window.discoveredTests.flatMap((group) =>
//                 group.tests.map((t) => t.id),
//             ),
//         );
//         return;
//     }

//     console.warn(
//         "Available test IDs in UI:",
//         window.discoveredTests.flatMap((group) => group.tests.map((t) => t.id)),
//     );

//     const statusElement = testElement.querySelector(".test-status");
//     const statusText = testElement.querySelector(".status-text");

//     if (!statusElement || !statusText) {
//         console.warn("Status elements not found for ID:", normalizedTestId);
//         return;
//     }

//     statusElement.className = `test-status status-${status}`;
//     statusText.textContent = formatStatus(convertedStatus);
// }

function filterTests(searchTerm) {
    const query = searchTerm.trim().toLowerCase();

    const tests = [...document.querySelectorAll(".test")];
    const groups = [...document.querySelectorAll(".test-group")];

    let matchedCount = 0;

    tests.forEach((test) => {
        const searchText = test.dataset.searchText || "";

        const matches = query === "" || searchText.includes(query);

        test.style.display = matches ? "" : "none";

        if (matches) {
            matchedCount++;
        }
    });

    // Update groups
    groups.forEach((group) => {
        const groupTests = [...group.querySelectorAll(".test")];

        const visibleTests = groupTests.filter(
            (test) => test.style.display !== "none",
        );

        const hasMatches = visibleTests.length > 0;

        group.style.display = hasMatches ? "" : "none";

        // When searching, automatically expand groups
        // that contain matching tests.
        if (query && hasMatches) {
            const groupTestContainer = group.querySelector(".group-tests");

            const collapseButton = group.querySelector(".collapse-button");

            if (groupTestContainer) {
                groupTestContainer.style.display = "";
            }

            if (collapseButton) {
                collapseButton.textContent = "▼";
                collapseButton.title = "Collapse group";
            }
        }
    });

    updateSearchCount(query, matchedCount);
}

function updateSearchCount(query, matchedCount) {
    // testCount.textContent = `${totalTestCount} tests`;
    if (!query) {
        searchResultCount.textContent = "";
        return;
    }

    // testCount.textContent = `${matchedCount} of ${totalTestCount} tests`;
    searchResultCount.textContent = `${matchedCount} ${matchedCount === 1 ? "result" : "results"}`;
}

document.getElementById("selectAll").addEventListener("click", () => {
    document.querySelectorAll(".group-checkbox").forEach((groupCheckbox) => {
        if (!groupCheckbox.checked) {
            groupCheckbox.checked = true;
            groupCheckbox.dispatchEvent(new Event("change"));
        }
    });
});

document.getElementById("clearAll").addEventListener("click", () => {
    document.querySelectorAll(".group-checkbox").forEach((groupCheckbox) => {
        if (groupCheckbox.checked || groupCheckbox.indeterminate) {
            groupCheckbox.checked = false;
            groupCheckbox.indeterminate = false; // Reset the dash state if present
            groupCheckbox.dispatchEvent(new Event("change"));
        }
    });
});

document.getElementById("run").addEventListener("click", async () => {
    const checked = Array.from(
        document.querySelectorAll(".test-checkbox:checked"),
    );

    if (checked.length === 0) {
        alert("Please select at least one test.");
        return;
    }

    const userInputUrl = document.getElementById("baseUrlInput").value.trim();
    const usernameInput = document.getElementById("modalUser").value.trim();
    const passwordInput = document.getElementById("modalPassword").value.trim();
    //passwordInput = passwordInput.value.trim();

    if (!userInputUrl) {
        alert("Please enter a valid base URL.");
        return;
    }

    runStatus.textContent = `Starting ${checked.length} tests...`;

    const selectedTests = checked.map((checkbox) => {
        const groupIndex = Number(checkbox.dataset.groupIndex);
        const testIndex = Number(checkbox.dataset.testIndex);
        const group = window.discoveredTests[groupIndex];

        if (!group) {
            throw new Error(`Test group not found: ${groupIndex}`);
        }

        const test = group.tests[testIndex];

        if (!test) {
            throw new Error(
                `Test not found: group ${groupIndex}, test ${testIndex}`,
            );
        }

        console.log("Selected test:", test);

        return `${test.file}:${test.line}:${test.column}`;
    });

    console.log("Tests being sent to Playwright:", selectedTests);

    document.getElementById("run").disabled = true;

    try {
        const result = await window.electronAPI.runTests(
            selectedTests,
            userInputUrl,
            { username: usernameInput, password: passwordInput },
        );

        console.log("Playwright result:", result);

        if (!result.success) {
            runStatus.textContent = result.message || "Failed to start tests";

            document.getElementById("run").disabled = false;
        }
    } catch (error) {
        console.error(error);

        runStatus.textContent = error.message;

        document.getElementById("run").disabled = false;
    }
});

document.getElementById("stop").addEventListener("click", async () => {
    await window.electronAPI.stopTests();
});

document.getElementById("report").addEventListener("click", async () => {
    await window.electronAPI.showPlaywrightReport();
});

window.electronAPI.onOutput((data) => {
    console.log("[Playwright]", data);
});

window.electronAPI.onFinished((resultPayload) => {
    // if (code === 0) {
    //     runStatus.textContent = "All selected tests passed.";
    // } else {
    //     runStatus.textContent = "Some tests failed.";
    // }

    // 1. Destructure code and interrupted flags out of the object payload
    const { code, interrupted } = resultPayload;

    // 2. Safely handle user cancellation checks first
    if (interrupted) {
        runStatus.textContent = "Execution Stopped: Canceled by user.";

        const testElements = testsContainer.querySelectorAll(".test");
        testElements.forEach((el) => {
            const statusTextEl = el.querySelector(".status-text");
            const currentText = statusTextEl
                ? statusTextEl.textContent.trim().toLowerCase()
                : "";

            // If a test case was left hanging mid-run or was never reached in the execution queue, clear it out
            if (currentText === "running") {
                // Pass a mock test payload containing the row dataset target ID
                const mockTestObj = { id: el.dataset.testId };
                updateTestStatus(mockTestObj, "stopped"); // maps to "stopped" / "Stopped"
            }
        });
        return;
    }

    // 3. Fix the comparison mismatch by checking the extracted code value
    if (code === 0) {
        runStatus.textContent = "All selected tests passed.";
    } else {
        runStatus.textContent = "Some tests failed.";
    }
});

function escapeHtml(value) {
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

loadTests();
