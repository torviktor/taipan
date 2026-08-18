/**
 * api-bridge — прозрачный релей к Telegram Bot API.
 *
 * ПЕРЕХОДНАЯ ВЕРСИЯ (шаг 1 из 2).
 * Пропускает запрос ЛИБО с верным секретным заголовком, ЛИБО вообще без него.
 * Нужна, чтобы перевести клиентов по одному, ничего не уронив: на этом воркере
 * живёт ещё один бот (оркестратор), и он пока ходит без заголовка.
 *
 * Порядок: развернуть эту версию → перевести клиентов → развернуть строгую
 * версию (bridge-strict.js).
 *
 * НАСТРОЙКА в Cloudflare:
 *   Settings → Variables → добавить секрет BRIDGE_SECRET со значением ключа.
 *   Именно «Secret», не «Text» — тогда значение не видно в интерфейсе.
 *
 * ЛОГИ. Cloudflare по умолчанию пишет invocation log с полным URL запроса, а в
 * пути Bot API лежит токен: /bot<TOKEN>/sendMessage. Чтобы токен не оседал в
 * Observability, автоматический invocation log надо отключить:
 *   • wrangler.toml:
 *       [observability.logs]
 *       invocation_logs = false
 *   • либо в дашборде: Worker → Observability → Logs → выключить Invocation logs.
 * После этого в логах остаётся только то, что печатает console.log ниже —
 * имя метода без токена.
 */

const UPSTREAM = "https://api.telegram.org";
const AUTH_HEADER = "x-bridge-auth";

/** Сравнение без утечки времени: обычный === выдаёт длину общего префикса. */
function safeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Из /bot<token>/sendMessage достаём только sendMessage. Токен не возвращаем. */
function methodName(pathname) {
  const m = pathname.match(/^\/bot[^/]+\/([A-Za-z0-9_]+)\/?$/);
  return m ? m[1] : null;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const method = methodName(url.pathname);

    if (!method) {
      // Ни токена в логе, ни намёка на структуру пути.
      console.log("отклонено: путь не похож на Bot API");
      return new Response("Not found", { status: 404 });
    }

    const provided = request.headers.get(AUTH_HEADER);
    const expected = env.BRIDGE_SECRET;

    if (provided !== null) {
      // Заголовок прислали — он обязан быть верным. Неверный не пропускаем
      // даже в переходном режиме: иначе режим бессмысленен.
      if (!expected || !safeEqual(provided, expected)) {
        console.log(`отклонено: неверный секрет, метод ${method}`);
        return new Response("Forbidden", { status: 403 });
      }
      console.log(`метод ${method} (с секретом)`);
    } else {
      // Заголовка нет — пропускаем, это и есть переходный режим.
      console.log(`метод ${method} (БЕЗ секрета — переходный режим)`);
    }

    const target = UPSTREAM + url.pathname + url.search;
    const upstream = new Request(target, request);
    // Свой заголовок наружу не отдаём.
    upstream.headers.delete(AUTH_HEADER);

    try {
      return await fetch(upstream);
    } catch (e) {
      console.log(`ошибка обращения к Telegram, метод ${method}: ${e.name}`);
      return new Response("Bad gateway", { status: 502 });
    }
  },
};
