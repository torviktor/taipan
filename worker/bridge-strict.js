/**
 * api-bridge — прозрачный релей к Telegram Bot API.
 *
 * СТРОГАЯ ВЕРСИЯ (шаг 2 из 2).
 * Требует верный секретный заголовок у КАЖДОГО запроса. Всё остальное — 403.
 *
 * Разворачивать только после того, как на заголовок переведены ВСЕ клиенты,
 * включая второго бота (оркестратора). Иначе он молча перестанет работать:
 * симптом будет ровно такой же, как у нас 18.08 — 403 от Cloudflare при
 * внешне исправной системе.
 *
 * Отличие от bridge-transitional.js — ровно один блок: запрос без заголовка
 * теперь отвергается.
 *
 * НАСТРОЙКА в Cloudflare:
 *   Settings → Variables → секрет BRIDGE_SECRET (тип «Secret», не «Text»).
 *
 * ЛОГИ. Отключить автоматический invocation log, иначе токен из пути
 * /bot<TOKEN>/sendMessage попадёт в Observability:
 *   • wrangler.toml:
 *       [observability.logs]
 *       invocation_logs = false
 *   • либо дашборд: Worker → Observability → Logs → Invocation logs → off.
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
      console.log("отклонено: путь не похож на Bot API");
      return new Response("Not found", { status: 404 });
    }

    const provided = request.headers.get(AUTH_HEADER);
    const expected = env.BRIDGE_SECRET;

    if (!expected) {
      // Защита от выстрела в ногу: без настроенного секрета строгая версия
      // пропускала бы всех, если сравнивать наивно.
      console.log(`отклонено: BRIDGE_SECRET не задан, метод ${method}`);
      return new Response("Forbidden", { status: 403 });
    }
    if (provided === null || !safeEqual(provided, expected)) {
      console.log(`отклонено: нет или неверный секрет, метод ${method}`);
      return new Response("Forbidden", { status: 403 });
    }

    console.log(`метод ${method}`);

    const target = UPSTREAM + url.pathname + url.search;
    const upstream = new Request(target, request);
    upstream.headers.delete(AUTH_HEADER);

    try {
      return await fetch(upstream);
    } catch (e) {
      console.log(`ошибка обращения к Telegram, метод ${method}: ${e.name}`);
      return new Response("Bad gateway", { status: 502 });
    }
  },
};
