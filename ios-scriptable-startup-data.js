const username = "";
const password = "";


const PROTOBUF_CONTENT_TYPE = 'application/x-protobuf';
const JSON_CONTENT_TYPE = 'application/json';
const loginUrl = "https://www.heroesgame.com/api/login";
const accountPlayUrl = "https://un0.heroesofhistorygame.com/core/api/account/play";
const startupApiUrl = "https://un1.heroesofhistorygame.com/game/startup";
const fogInGameDataUrl = "https://forgeofgames.com/api/hoh/inGameData"

async function login() {
    const loginPayload = {
        username,
        password,
        useRememberMe: false
    };

    const loginReq = new Request(loginUrl);
    loginReq.method = "POST";
    loginReq.headers = addDefaultHeaders();
    loginReq.body = JSON.stringify(loginPayload);

    const loginData = await loginReq.loadJSON();

    const redirectReq = new Request(loginData.redirectUrl);
    redirectReq.method = "GET";
    const redirectHtml = await redirectReq.loadString();
    let sessionCookie = redirectReq.response.cookies.find(c => c.name === "SESSION");
    let cookieHeader = sessionCookie ? "SESSION=" + sessionCookie.value : "";
    if (cookieHeader === "") {
        throw new Error("SESSION cookie not found.");
    }
    const clientVersionMatch = redirectHtml.match(/const\s+clientVersion\s*=\s*"([^"]+)"/);

    if (!clientVersionMatch) {
        throw new Error("Client version not found.");
    }

    const clientVersion = clientVersionMatch[1];

    const playPayload = {
        createDeviceToken: false,
        meta: {
            clientVersion,
            device: "browser",
            deviceHardware: "browser",
            deviceManufacturer: "none",
            deviceName: "browser",
            locale: "en_DK",
            networkType: "wlan",
            operatingSystemName: "browser",
            operatingSystemVersion: "1",
            userAgent: "hoh-helper-mobile"
        },
        network: "BROWSER_SESSION",
        token: "",
        worldId: null
    };

    const playReq = new Request(accountPlayUrl);
    playReq.method = "POST";
    playReq.headers = {
        "Content-Type": JSON_CONTENT_TYPE,
        "Cookie": cookieHeader
    };
    playReq.body = JSON.stringify(playPayload);

    return await playReq.loadJSON();
}

function addStartupHeaders(sessionData) {
    const headers = {};
    headers['X-AUTH-TOKEN'] = sessionData.sessionId;
    headers['X-Request-Id'] = UUID.string();
    headers['X-Platform'] = 'browser';
    headers['X-ClientVersion'] = sessionData.clientVersion;
    headers['Accept-Encoding'] = 'gzip';
    headers['Accept'] = PROTOBUF_CONTENT_TYPE;
    headers['Content-Type'] = PROTOBUF_CONTENT_TYPE;
    return headers;
}

function addDefaultHeaders() {
    const headers = {};
    headers['Content-Type'] = JSON_CONTENT_TYPE;
    return headers;
}

async function getStartupAsync(sessionData) {
    const req = new Request(startupApiUrl);
    req.method = "POST";
    req.headers = addStartupHeaders(sessionData);
    const response = await req.load();
    return response.toBase64String()
}

async function sendStartupAsync(startupData) {
    const payload = {
        inGameStartupData: startupData
    };
    const req = new Request(fogInGameDataUrl);
    req.method = "POST";
    req.headers = addDefaultHeaders();
    req.body = JSON.stringify(payload);

    return await req.loadJSON();
}

async function main() {
    if (!username || !password) {
        let alert = new Alert()
        alert.title = "Credentials not set."
        alert.message = "You must provide your in-game login credentials. Open the script, and enter them into 2 properties at the start of the file."
        alert.addAction("OK")
        await alert.present()
        return;
    }

    const sessionData = await login();
    if (!sessionData) return;
    console.log("Session data received");

    const startupData = await getStartupAsync(sessionData);
    if (!startupData) return;
    console.log("Startup data received");

    const fogResponse = await sendStartupAsync(startupData);
    if (fogResponse?.webResourceUrl) {
        console.log("Fog data received");
        Safari.open(fogResponse.webResourceUrl);
    }
}

await main();