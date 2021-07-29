"use strict";
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const path = __importStar(require("path"));
const githubUtils = __importStar(require("@actions/github/lib/utils"));
const retry = __importStar(require("@octokit/plugin-retry"));
const console_log_level_1 = __importDefault(require("console-log-level"));
const semver = __importStar(require("semver"));
const actions_util_1 = require("./actions-util");
const apiCompatibility = __importStar(require("./api-compatibility.json"));
const logging = __importStar(require("./logging"));
const util_1 = require("./util");
var DisallowedAPIVersionReason;
(function (DisallowedAPIVersionReason) {
    DisallowedAPIVersionReason[DisallowedAPIVersionReason["ACTION_TOO_OLD"] = 0] = "ACTION_TOO_OLD";
    DisallowedAPIVersionReason[DisallowedAPIVersionReason["ACTION_TOO_NEW"] = 1] = "ACTION_TOO_NEW";
})(DisallowedAPIVersionReason = exports.DisallowedAPIVersionReason || (exports.DisallowedAPIVersionReason = {}));
const GITHUB_ENTERPRISE_VERSION_HEADER = "x-github-enterprise-version";
let hasBeenWarnedAboutVersion = false;
exports.getApiClient = function (githubAuth, githubUrl, mode, allowLocalRun = false) {
    if (util_1.isLocalRun() && !allowLocalRun) {
        throw new Error("Invalid API call in local run");
    }
    const customOctokit = githubUtils.GitHub.plugin(retry.retry, (octokit, _) => {
        octokit.hook.after("request", (response, _) => {
            if (!hasBeenWarnedAboutVersion &&
                Object.prototype.hasOwnProperty.call(response.headers, GITHUB_ENTERPRISE_VERSION_HEADER)) {
                const installedVersion = response.headers[GITHUB_ENTERPRISE_VERSION_HEADER];
                const disallowedAPIVersionReason = apiVersionInRange(installedVersion, apiCompatibility.minimumVersion, apiCompatibility.maximumVersion);
                const logger = mode === "actions"
                    ? logging.getActionsLogger()
                    : logging.getRunnerLogger(false);
                const toolName = mode === "actions" ? "Action" : "Runner";
                if (disallowedAPIVersionReason ===
                    DisallowedAPIVersionReason.ACTION_TOO_OLD) {
                    logger.warning(`The CodeQL ${toolName} version you are using is too old to be compatible with GitHub Enterprise ${installedVersion}. If you experience issues, please upgrade to a more recent version of the CodeQL ${toolName}.`);
                }
                if (disallowedAPIVersionReason ===
                    DisallowedAPIVersionReason.ACTION_TOO_NEW) {
                    logger.warning(`GitHub Enterprise ${installedVersion} is too old to be compatible with this version of the CodeQL ${toolName}. If you experience issues, please upgrade to a more recent version of GitHub Enterprise or use an older version of the CodeQL ${toolName}.`);
                }
                hasBeenWarnedAboutVersion = true;
            }
        });
    });
    return new customOctokit(githubUtils.getOctokitOptions(githubAuth, {
        baseUrl: getApiUrl(githubUrl),
        userAgent: "CodeQL Action",
        log: console_log_level_1.default({ level: "debug" }),
    }));
};
function getApiUrl(githubUrl) {
    const url = new URL(githubUrl);
    // If we detect this is trying to be to github.com
    // then return with a fixed canonical URL.
    if (url.hostname === "github.com" || url.hostname === "api.github.com") {
        return "https://api.github.com";
    }
    // Add the /api/v3 API prefix
    url.pathname = path.join(url.pathname, "api", "v3");
    return url.toString();
}
exports.getApiUrl = getApiUrl;
// Temporary function to aid in the transition to running on and off of github actions.
// Once all code has been coverted this function should be removed or made canonical
// and called only from the action entrypoints.
function getActionsApiClient(allowLocalRun = false) {
    return exports.getApiClient(actions_util_1.getRequiredInput("token"), actions_util_1.getRequiredEnvParam("GITHUB_SERVER_URL"), "actions", allowLocalRun);
}
exports.getActionsApiClient = getActionsApiClient;
function apiVersionInRange(version, minimumVersion, maximumVersion) {
    if (!semver.satisfies(version, `>=${minimumVersion}`)) {
        return DisallowedAPIVersionReason.ACTION_TOO_NEW;
    }
    if (!semver.satisfies(version, `<=${maximumVersion}`)) {
        return DisallowedAPIVersionReason.ACTION_TOO_OLD;
    }
    return undefined;
}
exports.apiVersionInRange = apiVersionInRange;
//# sourceMappingURL=api-client.js.map