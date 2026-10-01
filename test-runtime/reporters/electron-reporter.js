// const path = require("node:path");

// class ElectronReporter {
//     onBegin(config, suite) {
//         this.config = config;
//         this.send({
//             type: "run-started",
//             total: suite.allTests().length,
//         });
//     }

//     onTestBegin(test, result) {
//         this.send({
//             type: "test-started",
//             test: {
//                 id: this.getTestId(test),
//                 title: test.title,
//                 file: this.getFileName(test.location.file),
//                 line: test.location.line,
//                 column: test.location.column,
//             },
//         });
//     }

//     onTestEnd(test, result) {
//         this.send({
//             type: "test-finished",
//             test: {
//                 id: this.getTestId(test),
//                 title: test.title,
//                 file: this.getFileName(test.location.file),
//                 line: test.location.line,
//                 column: test.location.column,
//             },

//             result: {
//                 status: result.status,
//                 duration: result.duration,
//                 retry: result.retry,

//                 error: result.error
//                     ? {
//                           message: result.error.message,
//                           stack: result.error.stack,
//                       }
//                     : null,
//             },
//         });
//     }

//     onEnd(result) {
//         this.send({
//             type: "run-finished",
//             status: result.status,
//             duration: result.duration,
//         });
//     }

//     send(event) {
//         process.stdout.write(JSON.stringify(event) + "\n");
//     }

//     getFileName(file) {
//         return path.basename(file);
//     }

//     getTestId(test) {
//         // Convert the absolute Playwright path to a relative path.
//         const relativeFile = path.relative(process.cwd(), test.location.file);
//         // Use Windows-style separators consistently.
//         const file = relativeFile.replace(/\//g, "\\");
//         return [file, test.location.line, test.location.column].join(":");
//     }

//     // getTestId(test) {
//     //     // config.rootDir matches the exact anchor Playwright uses for '--list' output
//     //     const rootDir = this.config ? this.config.rootDir : process.cwd();

//     //     // Convert the absolute Playwright path to a relative path based on the testDir root
//     //     const relativeFile = path.relative(rootDir, test.location.file);

//     //     // Use Windows-style separators consistently.
//     //     const file = relativeFile.replace(/\//g, "\\");

//     //     return [file, test.location.line, test.location.column].join(":");
//     // }

//     printsToStdio() {
//         return true;
//     }
// }

// module.exports = ElectronReporter;


const path = require("node:path");

class ElectronReporter {
    onBegin(config, suite) {
        this.send({
            type: "run-started",
            total: suite.allTests().length,
        });
    }

    onTestBegin(test, result) {
        this.send({
            type: "test-started",
            test: {
                id: this.getTestId(test),
                title: test.title,
                file: this.getFileName(test.location.file),
                line: test.location.line,
                column: test.location.column,
            },
        });
    }

    onTestEnd(test, result) {
        this.send({
            type: "test-finished",
            test: {
                id: this.getTestId(test),
                title: test.title,
                file: this.getFileName(test.location.file),
                line: test.location.line,
                column: test.location.column,
            },

            result: {
                status: result.status,
                duration: result.duration,
                retry: result.retry,

                error: result.error
                    ? {
                          message: result.error.message,
                          stack: result.error.stack,
                      }
                    : null,
            },
        });
    }

    onEnd(result) {
        this.send({
            type: "run-finished",
            status: result.status,
            duration: result.duration,
        });
    }

    send(event) {
        process.stdout.write(JSON.stringify(event) + "\n");
    }

    getFileName(file) {
        return path.basename(file);
    }

    getTestId(test) {
        // Convert the absolute Playwright path to a relative path.
        const relativeFile = path.relative(process.cwd(), test.location.file);

        // Use Windows-style separators consistently.
        const file = relativeFile.replace(/\//g, "\\");

        return [file, test.location.line, test.location.column].join(":");
    }

    printsToStdio() {
        return true;
    }
}

module.exports = ElectronReporter;