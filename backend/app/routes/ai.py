from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import httpx
import os

router = APIRouter(prefix="/ai", tags=["AI"])

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY", "")

SYSTEM_PROMPT = """Ты — TaipanGPT, умный помощник клуба тхэквондо «Тайпан» в Павловском Посаде.
Отвечай кратко, по делу, дружелюбно. Только на русском языке.

Информация о клубе:
- Название: Спортивный клуб тхэквондо «Тайпан»
- Город: Павловский Посад, Московская область
- Адрес зала: ул. Кирова, 95
- Телефон: +7 (909) 165-28-00
- Email: Bliznec.ket@mail.ru
- Тренер: Ротарь Екатерина Валерьевна, 3 дан ГТФ, призёр чемпионатов России
- Федерация: тхэквондо ГТФ (GTF)
- Группы:
  * Младшая (6–10 лет): Вт/Чт 17:30–19:00, Сб 11:30–13:00
  * Старшая (11–16 лет): Вт/Чт 19:00–21:00, Сб 13:00–15:00
  * Взрослые (16+): Вт/Чт 19:00–21:00, Сб 13:00–15:00
- Первое занятие — бесплатно
- Сезон: сентябрь–май, летом облегчённый режим
- Сайт: https://taipan-tkd.ru

Если спрашивают о записи — направляй на страницу /apply или на телефон.
Если вопрос не касается клуба или тхэквондо — вежливо скажи что отвечаешь только по теме клуба.
Не придумывай информацию которой нет выше. Если не знаешь — скажи честно и предложи позвонить тренеру."""


class ChatRequest(BaseModel):
    message: str
    history: list[dict] = []


@router.post("/chat")
async def chat(req: ChatRequest):
    if not OPENROUTER_API_KEY:
        raise HTTPException(status_code=503, detail="AI не настроен")

    if len(req.message) > 500:
        raise HTTPException(status_code=400, detail="Сообщение слишком длинное")

    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    messages += req.history[-10:]
    messages.append({"role": "user", "content": req.message})

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            "https://openrouter.ai/api/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {OPENROUTER_API_KEY}",
                "Content-Type": "application/json",
                "HTTP-Referer": "https://taipan-tkd.ru",
                "X-Title": "TaipanGPT",
            },
            json={
                "model": "meta-llama/llama-3.1-8b-instruct:free",
                "max_tokens": 512,
                "temperature": 0.7,
                "messages": messages,
            }
        )

    if resp.status_code != 200:
        raise HTTPException(status_code=502, detail=f"Ошибка AI: {resp.text[:200]}")

    data = resp.json()
    reply = data["choices"][0]["message"]["content"]
    return {"reply": reply}
