# backend/app/routes/ai.py
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import httpx
import os

router = APIRouter(prefix="/ai", tags=["ai"])

ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")

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
Если вопрос не касается клуба или тхэквондо — вежливо скажи, что отвечаешь только по теме клуба.
Не придумывай информацию которой нет выше. Если не знаешь — скажи честно и предложи позвонить тренеру."""


class ChatRequest(BaseModel):
    message: str
    history: list[dict] = []


@router.post("/chat")
async def chat(req: ChatRequest):
    if not ANTHROPIC_API_KEY:
        raise HTTPException(status_code=503, detail="AI не настроен")

    if len(req.message) > 500:
        raise HTTPException(status_code=400, detail="Сообщение слишком длинное")

    # Формируем историю (макс 10 последних сообщений)
    messages = req.history[-10:] + [{"role": "user", "content": req.message}]

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            "https://api.anthropic.com/v1/messages",
            headers={
                "x-api-key": ANTHROPIC_API_KEY,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            },
            json={
                "model": "claude-haiku-4-5-20251001",
                "max_tokens": 512,
                "system": SYSTEM_PROMPT,
                "messages": messages,
            }
        )

    if resp.status_code != 200:
        raise HTTPException(status_code=502, detail="Ошибка AI")

    data = resp.json()
    reply = data["content"][0]["text"]
    return {"reply": reply}
