"use strict";
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const core = __importStar(require("@actions/core"));
const actionsUtil = __importStar(require("./actions-util"));
const init_1 = require("./init");
const languages_1 = require("./languages");
const logging_1 = require("./logging");
const repository_1 = require("./repository");
async function sendSuccessStatusReport(startedAt, config) {
    var _a;
    const statusReportBase = await actionsUtil.createStatusReportBase("init", "success", startedAt);
    const languages = config.languages.join(",");
    const workflowLanguages = actionsUtil.getOptionalInput("languages");
    const paths = (config.originalUserInput.paths || []).join(",");
    const pathsIgnore = (config.originalUserInput["paths-ignore"] || []).join(",");
    const disableDefaultQueries = config.originalUserInput["disable-default-queries"]
        ? languages
        : "";
    const queries = [];
    let queriesInput = (_a = actionsUtil.getOptionalInput("queries")) === null || _a === void 0 ? void 0 : _a.trim();
    if (queriesInput === undefined || queriesInput.startsWith("+")) {
        queries.push(...(config.originalUserInput.queries || []).map((q) => q.uses));
    }
    if (queriesInput !== undefined) {
        queriesInput = queriesInput.startsWith("+")
            ? queriesInput.substr(1)
            : queriesInput;
        queries.push(...queriesInput.split(","));
    }
    const statusReport = {
        ...statusReportBase,
        languages,
        workflow_languages: workflowLanguages || "",
        paths,
        paths_ignore: pathsIgnore,
        disable_default_queries: disableDefaultQueries,
        queries: queries.join(","),
    };
    await actionsUtil.sendStatusReport(statusReport);
}
async function run() {
    const startedAt = new Date();
    const logger = logging_1.getActionsLogger();
    let config;
    let codeql;
    try {
        actionsUtil.prepareLocalRunEnvironment();
        if (!(await actionsUtil.sendStatusReport(await actionsUtil.createStatusReportBase("init", "starting", startedAt), true))) {
            return;
        }
        codeql = await init_1.initCodeQL(actionsUtil.getOptionalInput("tools"), actionsUtil.getRequiredInput("token"), actionsUtil.getRequiredEnvParam("GITHUB_SERVER_URL"), actionsUtil.getRequiredEnvParam("RUNNER_TEMP"), actionsUtil.getRequiredEnvParam("RUNNER_TOOL_CACHE"), "actions", logger);
        config = await init_1.initConfig(actionsUtil.getOptionalInput("languages"), actionsUtil.getOptionalInput("queries"), actionsUtil.getOptionalInput("config-file"), repository_1.parseRepositoryNwo(actionsUtil.getRequiredEnvParam("GITHUB_REPOSITORY")), actionsUtil.getRequiredEnvParam("RUNNER_TEMP"), actionsUtil.getRequiredEnvParam("RUNNER_TOOL_CACHE"), codeql, actionsUtil.getRequiredEnvParam("GITHUB_WORKSPACE"), actionsUtil.getRequiredInput("token"), actionsUtil.getRequiredEnvParam("GITHUB_SERVER_URL"), "actions", logger);
        if (config.languages.includes(languages_1.Language.python) &&
            actionsUtil.getRequiredInput("setup-python-dependencies") === "true") {
            try {
                await init_1.installPythonDeps(codeql, logger);
            }
            catch (err) {
                logger.warning(`${err.message} You can call this action with 'setup-python-dependencies: false' to disable this process`);
            }
        }
    }
    catch (e) {
        core.setFailed(e.message);
        console.log(e);
        await actionsUtil.sendStatusReport(await actionsUtil.createStatusReportBase("init", "aborted", startedAt, e.message));
        return;
    }
    try {
        // Forward Go flags
        const goFlags = process.env["GOFLAGS"];
        if (goFlags) {
            core.exportVariable("GOFLAGS", goFlags);
            core.warning("Passing the GOFLAGS env parameter to the init action is deprecated. Please move this to the analyze action.");
        }
        // Setup CODEQL_RAM flag (todo improve this https://github.com/github/dsp-code-scanning/issues/935)
        const codeqlRam = process.env["CODEQL_RAM"] || "6500";
        core.exportVariable("CODEQL_RAM", codeqlRam);
        const tracerConfig = await init_1.runInit(codeql, config);
        if (tracerConfig !== undefined) {
            for (const [key, value] of Object.entries(tracerConfig.env)) {
                core.exportVariable(key, value);
            }
            if (process.platform === "win32") {
                await init_1.injectWindowsTracer("Runner.Worker.exe", undefined, config, codeql, tracerConfig);
            }
        }
    }
    catch (error) {
        core.setFailed(error.message);
        console.log(error);
        await actionsUtil.sendStatusReport(await actionsUtil.createStatusReportBase("init", "failure", startedAt, error.message, error.stack));
        return;
    }
    await sendSuccessStatusReport(startedAt, config);
}
run().catch((e) => {
    core.setFailed(`init action failed: ${e}`);
    console.log(e);
});
//# sourceMappingURL=init-action.js.map