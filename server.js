// server.js
const Koa = require("koa");
const Router = require("@koa/router");
const bodyParser = require("koa-bodyparser");
const ModemManager = require("./modemManager/modemManager");
const logger = require("./utils/logger");
require("./utils/shutdown");

// const logger = pino({ level: "info" });
const manager = new ModemManager();

const options = {
  baudRate: 9600,
  dataBits: 8,
  stopBits: 1,
  parity: "none",
  rtscts: false,
  xon: false,
  xoff: false,
  xany: false,
  autoDeleteOnReceive: true,
  enableConcatenation: true,
  incomingCallIndication: true,
  incomingSMSIndication: true,
  pin: "",
  customInitCommand: "AT^CURC=0",
  cnmiCommand: "AT+CNMI=2,1,0,2,1",
  logger: console,
};

// автозапуск всех модемов
manager.addModems(options);

const app = new Koa();
const router = new Router();

// Healthcheck
router.get("/", (ctx) => {
  ctx.body = { status: "ok" };
});

// Получить код: GET /code?from=+7914...
router.get("/code", async (ctx) => {
  const from = ctx.query.from;
  if (!from) {
    ctx.status = 400;
    ctx.body = { error: "Нужно указать from" };
    return;
  }
  try {
    const code = await manager.getCode(from);
    ctx.body = { phone: from, code: code };
  } catch (e) {
    ctx.status = 500;
    ctx.body = { error: e.message };
  }
});

// Получить SMS: GET /code?from=+7914...
router.get("/sms", async (ctx) => {
  const from = ctx.query.from;
  if (!from) {
    ctx.status = 400;
    ctx.body = { error: "Нужно указать from" };
    return;
  }
  try {
    const sms = await manager.getMessage(from);
    ctx.body = { phone: from, sender: sms.sender, message: sms.message};
  } catch (e) {
    ctx.status = 500;
    ctx.body = { error: e.message };
  }
});

// Баланс: GET /balance?from=%2B...
router.get("/balance", async (ctx) => {
  const from = ctx.query.from;
  if (!from) {
    ctx.status = 400;
    ctx.body = { error: "Нужно указать from" };
    return;
  }
  try {
    const bal = await manager.getBalanceByPhone(from);
    if (bal == "busy") {
      ctx.body = { phone: from, error: "Симкарта занята" };
    } else {
      ctx.body = { phone: from, balance: bal };
    }
  } catch (e) {
    ctx.status = 500;
    ctx.body = { error: e.message };
  }
});

// Отправка SMS: POST /send
router.post("/send", async (ctx) => {
  const from = ctx.query.from;
  const { to, text } = ctx.request.body;
  if (!to || !text) {
    ctx.status = 400;
    ctx.body = { error: "to и text обязательны" };
    return;
  }
  try {
    let resp;
    from
      ? (resp = await manager.sendSMSByPhone(from, to, text))
      : (resp = await manager.sendSMS(to, text));
    console.log(resp);
    ctx.body = { status: resp.data.response };
  } catch (e) {
    ctx.status = 500;
    ctx.body = { error: e.message };
  }
});

// История подключений: GET /history?from=%2B...
router.get("/history", async (ctx) => {
  const from = ctx.query.from;
  if (!from) {
    ctx.status = 400;
    ctx.body = { error: "Нужно указать from" };
    return;
  }
  try {
    ctx.body = await manager.getConnectionHistoryByPhone(from);
  } catch (e) {
    ctx.status = 500;
    ctx.body = { error: e.message };
  }
});

// Принудительный релоад модемов
router.post("/refresh-modems", (ctx) => {
  manager.addModems(options);
  ctx.body = { status: "refreshing" };
});

app.use(bodyParser()).use(router.routes()).use(router.allowedMethods());

const PORT = 3000;
app.listen(PORT, () => logger.info(`Server listening on ${PORT}`));
