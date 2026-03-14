from fastapi import FastAPI, Depends, HTTPException, Request
from fastapi.responses import HTMLResponse, JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import json
from app.settings import settings
from app.db.session import get_session
from app.db.models import User, CopySettings, PolymarketCreds
from app.crypto import encrypt_str
from app.telegram_webapp import validate_init_data
from app.services.builder_signing import sign_builder_headers
from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from sqlalchemy import select, text
from fastapi import Request
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from zoneinfo import ZoneInfo


limiter = Limiter(key_func=get_remote_address)
app = FastAPI(title="pm-copy")
app.state.limiter = limiter
app.add_middleware(SlowAPIMiddleware)


@app.exception_handler(RateLimitExceeded)
async def rate_limit_handler(request: Request, exc: RateLimitExceeded):
    return JSONResponse(status_code=429, content={"detail": "rate limit exceeded"})


@app.get("/health")
@limiter.limit("60/minute")
def health(request: Request):
    return {"status": "ok"}

@app.get("/webapp", response_class=HTMLResponse)
@limiter.limit(settings.webapp_rate_limit)
async def webapp(request: Request):
    # Minimal WebApp page with Turnkey passkey login placeholder
    html = open("app/webapp/index.html", "r", encoding="utf-8").read()
    return HTMLResponse(html)

@app.post("/builder/sign")
@limiter.limit(settings.api_rate_limit)
async def builder_sign(request: Request):
    # Optional shared secret to prevent abuse
    auth = request.headers.get("authorization","")
    if settings.builder_sign_token and auth != f"Bearer {settings.builder_sign_token}":
        raise HTTPException(status_code=401, detail="unauthorized")

    payload = await request.json()
    method = payload.get("method")
    path = payload.get("path")
    body = payload.get("body")
    if not method or not path:
        raise HTTPException(status_code=400, detail="method and path are required")

    headers = sign_builder_headers(method=method, path=path, body=body)
    return headers

@app.post("/api/user/ensure")
@limiter.limit(settings.api_rate_limit)
async def ensure_user(request: Request, session: AsyncSession = Depends(get_session)):
    data = await request.json()
    init_data = data.get("initData")
    print("INIT DATA:", init_data)
    if not init_data:
        raise HTTPException(400, "initData required")
    ok, parsed = validate_init_data(init_data, settings.bot_token)
    if not ok:
        raise HTTPException(401, "invalid initData")

    user_json = json.loads(parsed.get("user","{}"))
    tg_user_id = int(user_json.get("id"))
    q = await session.execute(select(User).where(User.tg_user_id == tg_user_id))
    user = q.scalar_one_or_none()
    if not user:
        user = User(tg_user_id=tg_user_id)
        session.add(user)
        await session.flush()
        session.add(CopySettings(user_id=user.id))
        session.add(PolymarketCreds(user_id=user.id))
        await session.commit()
    return {"userId": user.id, "tgUserId": tg_user_id}

@app.post("/api/user/pm/creds")
@limiter.limit(settings.api_rate_limit)
async def set_pm_creds(request: Request, session: AsyncSession = Depends(get_session)):
    """Temporary endpoint for MVP: user pastes Polymarket L2 creds and funder address.
    Later you'll replace this with the Turnkey+Safe bootstrap flow.
    """
    data = await request.json()
    user_id = int(data.get("userId", 0))
    api_key = data.get("apiKey")
    api_secret = data.get("apiSecret")
    api_passphrase = data.get("apiPassphrase")
    funder = data.get("funderAddress")

    if not user_id:
        raise HTTPException(400, "userId required")
    q = await session.execute(select(PolymarketCreds).where(PolymarketCreds.user_id == user_id))
    pm = q.scalar_one_or_none()
    if not pm:
        pm = PolymarketCreds(user_id=user_id)
        session.add(pm)

    pm.api_key_enc = encrypt_str(api_key)
    pm.api_secret_enc = encrypt_str(api_secret)
    pm.api_passphrase_enc = encrypt_str(api_passphrase)
    pm.funder_address = funder
    await session.commit()
    return {"ok": True}



@app.get("/api/airi-calendar/month")
@limiter.limit("60/minute")
async def airi_calendar_month(
    request: Request,
    user_id: int,
    year: int,
    month: int,
    session: AsyncSession = Depends(get_session),
):
    result = await session.execute(
        text("""
            SELECT
              to_char(remind_at AT TIME ZONE 'Europe/Minsk', 'YYYY-MM-DD') AS date,
              COUNT(*)::int AS count
            FROM tg_reminders
            WHERE telegram_user_id = :user_id
              AND EXTRACT(YEAR FROM remind_at AT TIME ZONE 'Europe/Minsk') = :year
              AND EXTRACT(MONTH FROM remind_at AT TIME ZONE 'Europe/Minsk') = :month
              AND status = 'pending'
            GROUP BY 1
            ORDER BY 1
        """),
        {
            "user_id": user_id,
            "year": year,
            "month": month,
        },
    )

    rows = result.mappings().all()
    return rows


@app.get("/api/airi-calendar/day")
@limiter.limit("60/minute")
async def airi_calendar_day(
    request: Request,
    user_id: int,
    date: str,
    session: AsyncSession = Depends(get_session),
):
    result = await session.execute(
        text("""
            SELECT
              id,
              task,
              reminder_type,
              to_char(remind_at AT TIME ZONE 'Europe/Minsk', 'HH24:MI') AS time,
              is_recurring
            FROM tg_reminders
            WHERE telegram_user_id = :user_id
              AND to_char(remind_at AT TIME ZONE 'Europe/Minsk', 'YYYY-MM-DD') = :date
              AND status = 'pending'
            ORDER BY remind_at ASC
        """),
        {
            "user_id": user_id,
            "date": date,
        },
    )

    rows = result.mappings().all()
    return rows




@app.post("/api/airi-calendar/complete")
@limiter.limit("60/minute")
async def airi_calendar_complete(
    request: Request,
    reminder_id: int,
    session: AsyncSession = Depends(get_session),
):
    await session.execute(
        text("""
            UPDATE tg_reminders
            SET
              status = 'completed',
              completed_at = NOW(),
              updated_at = NOW()
            WHERE id = :reminder_id
        """),
        {
            "reminder_id": reminder_id,
        },
    )
    await session.commit()

    return {"ok": True, "reminder_id": reminder_id}




class CalendarCreateReminderIn(BaseModel):
    user_id: int
    task: str
    reminder_type: str = "task"
    remind_at: str
    is_recurring: bool = False
    rrule: Optional[str] = None


class TimezoneSaveIn(BaseModel):
    user_id: int
    timezone: str


@app.post("/api/airi-calendar/create")
@limiter.limit("60/minute")
async def airi_calendar_create(
    request: Request,
    payload: CalendarCreateReminderIn,
    session: AsyncSession = Depends(get_session),
):
    # 1) читаем timezone пользователя
    tz_result = await session.execute(
        text("""
            SELECT timezone
            FROM tg_reminder_users
            WHERE telegram_user_id = :user_id
            LIMIT 1
        """),
        {"user_id": payload.user_id},
    )
    tz_row = tz_result.first()
    user_timezone = tz_row[0] if tz_row and tz_row[0] else "UTC"

    # 2) получаем локальное "наивное" время из фронта
    local_naive_dt = datetime.fromisoformat(payload.remind_at)

    # 3) привязываем его к timezone пользователя
    local_dt = local_naive_dt.replace(tzinfo=ZoneInfo(user_timezone))

    # 4) переводим в UTC для хранения в БД
    remind_at_dt = local_dt.astimezone(ZoneInfo("UTC"))

    result = await session.execute(
        text("""
            INSERT INTO tg_reminders (
                telegram_user_id,
                telegram_chat_id,
                task,
                reminder_type,
                remind_at,
                status,
                is_recurring,
                rrule,
                created_at,
                updated_at
            )
            VALUES (
                :user_id,
                :user_id,
                :task,
                :reminder_type,
                :remind_at,
                'pending',
                :is_recurring,
                :rrule,
                NOW(),
                NOW()
            )
            RETURNING id
        """),
        {
            "user_id": payload.user_id,
            "task": payload.task,
            "reminder_type": payload.reminder_type,
            "remind_at": remind_at_dt,
            "is_recurring": payload.is_recurring,
            "rrule": payload.rrule,
        },
    )

    await session.commit()
    reminder_id = result.scalar_one()

    return {"ok": True, "id": reminder_id}



@app.post("/api/airi-calendar/update/{reminder_id}")
@limiter.limit("60/minute")
async def airi_calendar_update(
    request: Request,
    reminder_id: int,
    payload: CalendarCreateReminderIn,
    session: AsyncSession = Depends(get_session),
):
    tz_result = await session.execute(
        text("""
            SELECT timezone
            FROM tg_reminder_users
            WHERE telegram_user_id = :user_id
            LIMIT 1
        """),
        {"user_id": payload.user_id},
    )
    tz_row = tz_result.first()
    user_timezone = tz_row[0] if tz_row and tz_row[0] else "UTC"

    local_naive_dt = datetime.fromisoformat(payload.remind_at)
    local_dt = local_naive_dt.replace(tzinfo=ZoneInfo(user_timezone))
    remind_at_dt = local_dt.astimezone(ZoneInfo("UTC"))

    await session.execute(
        text("""
            UPDATE tg_reminders
            SET
                task = :task,
                reminder_type = :reminder_type,
                remind_at = :remind_at,
                updated_at = NOW()
            WHERE id = :reminder_id
              AND telegram_user_id = :user_id
        """),
        {
            "task": payload.task,
            "reminder_type": payload.reminder_type,
            "remind_at": remind_at_dt,
            "reminder_id": reminder_id,
            "user_id": payload.user_id,
        },
    )

    await session.commit()

    return {"ok": True}



@app.post("/api/airi-timezone/save")
@limiter.limit("60/minute")
async def airi_timezone_save(
    request: Request,
    payload: TimezoneSaveIn,
    session: AsyncSession = Depends(get_session),
):
    await session.execute(
        text("""
            UPDATE tg_reminder_users
            SET
                timezone = :timezone,
                timezone_set = TRUE,
                updated_at = NOW()
            WHERE telegram_user_id = :user_id
        """),
        {
            "user_id": payload.user_id,
            "timezone": payload.timezone,
        },
    )
    await session.commit()

    return {"ok": True, "timezone": payload.timezone}



@app.get("/api/airi-timezone/get")
@limiter.limit("120/minute")
async def airi_timezone_get(
    request: Request,
    user_id: int,
    session: AsyncSession = Depends(get_session),
):
    result = await session.execute(
        text("""
            SELECT timezone
            FROM tg_reminder_users
            WHERE telegram_user_id = :user_id
            LIMIT 1
        """),
        {
            "user_id": user_id,
        },
    )

    row = result.first()

    return {
        "ok": True,
        "timezone": row[0] if row else None,
    }
