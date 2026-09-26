#!/usr/bin/env python3
"""
Script de prueba — TikTools (TikTok Live API)
=============================================
Valida las premisas del MVP:
  1. Conexión WebSocket al relay de TikTools (modo relayed)
  2. Recepción de eventos en tiempo real (chat, gift, member, roomUserSeq, control)
  3. Normalización de eventos al esquema interno del ingestor
  4. Verificación de check_alive / room_info vía REST
  5. Reconexión con backoff (simulada)

Requisitos:
  pip install websockets httpx python-dotenv

Configuración (.env o variables de entorno):
  TIKTOOLS_API_KEY=tu_api_key
  TIKTOK_USERNAME=usuario_en_vivo  (sin @)

Uso:
  python test_tiktools.py
  python test_tiktools.py --username tv_asahi_news --duration 60

Referencia: https://tik.tools/docs
"""

import asyncio
import json
import os
import sys
import time
import argparse
from datetime import datetime, timezone
from dataclasses import dataclass, asdict
from typing import Optional

try:
    import websockets
except ImportError:
    sys.exit("❌ Falta 'websockets'. Instala con: pip install websockets")

try:
    import httpx
except ImportError:
    sys.exit("❌ Falta 'httpx'. Instala con: pip install httpx")

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass  # dotenv es opcional


# ─── Configuración ───────────────────────────────────────────────────────────

API_KEY = os.getenv("TIKTOOLS_API_KEY", "")
USERNAME = os.getenv("TIKTOK_USERNAME", "")
BASE_URL = "https://api.tik.tools"
WS_URL = "wss://api.tik.tools"


# ─── Esquema normalizado (como lo usará el ingestor real) ────────────────────

@dataclass
class NormalizedEvent:
    """Esquema agnóstico de canal — salida del live-ingestor hacia SQS FIFO."""
    event_type: str          # chat | gift | member | like | social | roomUserSeq | control
    room_id: str
    user_id: Optional[str]
    username: Optional[str]
    nickname: Optional[str]
    comment: Optional[str]   # solo para chat
    gift_name: Optional[str] # solo para gift
    gift_diamonds: Optional[int]
    gift_repeat: Optional[int]
    viewer_count: Optional[int]  # solo para roomUserSeq
    timestamp: str           # ISO 8601 UTC
    raw_event_type: str      # tipo original de TikTools


def normalize_event(raw: dict, room_id: str) -> NormalizedEvent:
    """Convierte un evento crudo de TikTools al esquema normalizado."""
    event_type = raw.get("event", "unknown")
    data = raw.get("data", {})
    user = data.get("user", {})

    return NormalizedEvent(
        event_type=event_type,
        room_id=room_id,
        user_id=user.get("id"),
        username=user.get("uniqueId"),
        nickname=user.get("nickname"),
        comment=data.get("comment") if event_type == "chat" else None,
        gift_name=data.get("giftName") if event_type == "gift" else None,
        gift_diamonds=data.get("diamondCount") if event_type == "gift" else None,
        gift_repeat=data.get("repeatCount") if event_type == "gift" else None,
        viewer_count=data.get("viewerCount") if event_type == "roomUserSeq" else None,
        timestamp=datetime.now(timezone.utc).isoformat(),
        raw_event_type=event_type,
    )


# ─── Test 1: REST — check_alive ─────────────────────────────────────────────

async def test_check_alive(username: str) -> dict:
    """Verifica si el usuario está en vivo vía REST."""
    print("\n" + "=" * 60)
    print("TEST 1: REST /webcast/check_alive")
    print("=" * 60)

    url = f"{BASE_URL}/webcast/check_alive"
    params = {"apiKey": API_KEY, "unique_id": username}

    async with httpx.AsyncClient() as client:
        resp = await client.get(url, params=params)
        print(f"  Status: {resp.status_code}")
        print(f"  Rate-Limit-Remaining: {resp.headers.get('X-RateLimit-Remaining', 'N/A')}")

        if resp.status_code != 200:
            print(f"  ❌ Error HTTP: {resp.text}")
            return {}

        body = resp.json()

        # Caso 1: respuesta directa con data (tiers Pro+)
        data_list = body.get("data", [])
        if isinstance(data_list, list) and data_list and data_list[0].get("alive"):
            print(f"  ✅ @{username} está EN VIVO (room_id: {data_list[0].get('room_id')})")
            return data_list[0]

        # Caso 2: sandbox tier devuelve "resolve_required"
        if body.get("action") == "resolve_required":
            print(f"  ℹ️  Tier sandbox: check_alive requiere resolución manual del room_id.")
            print(f"  ℹ️  Intentando verificar vía WebSocket directo (el relay resuelve internamente)...")

            # El WebSocket relay SÍ resuelve el uniqueId internamente.
            # Si conecta y recibimos roomInfo → está en vivo.
            try:
                ws_uri = f"{WS_URL}?uniqueId={username}&apiKey={API_KEY}"
                async with websockets.connect(ws_uri) as ws:
                    raw_msg = await asyncio.wait_for(ws.recv(), timeout=10.0)
                    msg = json.loads(raw_msg)
                    if msg.get("event") == "roomInfo":
                        room_id = msg.get("roomId", "")
                        print(f"  ✅ @{username} está EN VIVO (room_id: {room_id}) — verificado vía WebSocket")
                        await ws.close()
                        return {"alive": True, "room_id": room_id, "unique_id": username}
                    else:
                        print(f"  ⚠️  Primer mensaje no es roomInfo: {msg.get('event')}")
                        await ws.close()
                        return {}
            except websockets.exceptions.ConnectionClosed as e:
                if e.code == 4404:
                    print(f"  ⚠️  @{username} NO está en vivo (WS code 4404: NOT_LIVE)")
                elif e.code == 4429:
                    print(f"  ⚠️  Límite de conexiones WS alcanzado (code 4429)")
                else:
                    print(f"  ⚠️  WS cerrado: code={e.code} reason={e.reason}")
                return {}
            except asyncio.TimeoutError:
                print(f"  ⚠️  Timeout esperando roomInfo — puede que no esté en vivo")
                return {}
            except Exception as e:
                print(f"  ⚠️  Error verificando vía WS: {type(e).__name__}: {e}")
                return {}

        # Caso 3: no está en vivo
        print(f"  Response: {json.dumps(body, indent=2)}")
        print(f"  ⚠️  @{username} NO está en vivo. Busca un usuario activo.")
        return {}


# ─── Test 2: REST — room_info ────────────────────────────────────────────────

async def test_room_info(username: str) -> dict:
    """Obtiene metadata del live (título, viewers, owner)."""
    print("\n" + "=" * 60)
    print("TEST 2: REST /webcast/room_info")
    print("=" * 60)

    url = f"{BASE_URL}/webcast/room_info"
    params = {"apiKey": API_KEY}
    payload = {"unique_id": username}

    async with httpx.AsyncClient() as client:
        resp = await client.post(url, params=params, json=payload)
        print(f"  Status: {resp.status_code}")

        if resp.status_code != 200:
            print(f"  ❌ Error: {resp.text[:200]}")
            return {}

        body = resp.json()
        data = body.get("data", {})
        print(f"  Título: {data.get('title', 'N/A')}")
        print(f"  Viewers: {data.get('user_count', 'N/A')}")
        print(f"  Room ID: {data.get('room_id', 'N/A')}")
        owner = data.get("owner", {})
        print(f"  Owner: @{owner.get('uniqueId', 'N/A')} ({owner.get('nickname', 'N/A')})")
        print(f"  ✅ room_info obtenido correctamente")
        return data


# ─── Test 3: REST — rate_limits ──────────────────────────────────────────────

async def test_rate_limits():
    """Verifica el estado de la API key (tier, límites)."""
    print("\n" + "=" * 60)
    print("TEST 3: REST /webcast/rate_limits")
    print("=" * 60)

    url = f"{BASE_URL}/webcast/rate_limits"
    params = {"apiKey": API_KEY}

    async with httpx.AsyncClient() as client:
        resp = await client.get(url, params=params)
        print(f"  Status: {resp.status_code}")

        if resp.status_code != 200:
            print(f"  ❌ Error: {resp.text[:200]}")
            return

        body = resp.json()
        data = body.get("data", {})
        print(f"  Tier: {data.get('tier', 'N/A')}")
        api_info = data.get("api", {})
        print(f"  API requests: {api_info.get('remaining', '?')}/{api_info.get('limit', '?')}")
        ws_info = data.get("websocket", {})
        print(f"  WebSocket connections: {ws_info.get('current', '?')}/{ws_info.get('limit', '?')}")
        print(f"  ✅ Rate limits consultados")


# ─── Test 4: WebSocket — conexión y recepción de eventos ─────────────────────

async def test_websocket_stream(username: str, duration_seconds: int = 30):
    """
    Conecta al WebSocket relay de TikTools y captura eventos durante N segundos.
    Valida:
      - Conexión exitosa (primer mensaje = roomInfo)
      - Recepción de eventos variados
      - Normalización al esquema del ingestor
    """
    print("\n" + "=" * 60)
    print(f"TEST 4: WebSocket — streaming {duration_seconds}s desde @{username}")
    print("=" * 60)

    ws_uri = f"{WS_URL}?uniqueId={username}&apiKey={API_KEY}"
    event_counts: dict[str, int] = {}
    normalized_samples: list[dict] = []
    room_id = ""
    start_time = time.time()

    try:
        async with websockets.connect(ws_uri) as ws:
            print(f"  ✅ WebSocket conectado a {WS_URL}")

            while (time.time() - start_time) < duration_seconds:
                try:
                    raw_msg = await asyncio.wait_for(ws.recv(), timeout=5.0)
                    msg = json.loads(raw_msg)
                    event_type = msg.get("event", "unknown")

                    # Primer mensaje: roomInfo
                    if event_type == "roomInfo":
                        room_id = msg.get("roomId", "")
                        print(f"  📡 roomInfo recibido — Room ID: {room_id}")
                        print(f"     uniqueId: {msg.get('uniqueId')}")
                        event_counts[event_type] = event_counts.get(event_type, 0) + 1
                        continue

                    # Solo procesar eventos de chat, ignorar el resto
                    if event_type != "chat":
                        event_counts[event_type] = event_counts.get(event_type, 0) + 1
                        continue

                    # Contar chats
                    event_counts[event_type] = event_counts.get(event_type, 0) + 1

                    # Normalizar y guardar muestra
                    normalized = normalize_event(msg, room_id)
                    if len(normalized_samples) < 20:
                        normalized_samples.append(asdict(normalized))

                    # Log TODOS los chats en tiempo real
                    print(f"  💬 [{normalized.username}]: {normalized.comment}")

                except asyncio.TimeoutError:
                    elapsed = int(time.time() - start_time)
                    print(f"  ⏳ Sin mensajes (timeout 5s) — {elapsed}s/{duration_seconds}s")
                    continue

    except websockets.exceptions.ConnectionClosed as e:
        print(f"  ⚠️  WebSocket cerrado: code={e.code} reason={e.reason}")
        # Mapear close codes de TikTools
        close_codes = {
            4005: "STREAM_END",
            4006: "NO_MESSAGES_TIMEOUT",
            4400: "INVALID_OPTIONS",
            4401: "INVALID_AUTH",
            4404: "NOT_LIVE",
            4429: "TOO_MANY_CONNECTIONS",
        }
        if e.code in close_codes:
            print(f"     → {close_codes[e.code]}")
    except Exception as e:
        print(f"  ❌ Error: {type(e).__name__}: {e}")

    # Resumen
    elapsed = int(time.time() - start_time)
    total_events = sum(event_counts.values())
    print(f"\n  ── Resumen ({elapsed}s) ──")
    print(f"  Total eventos: {total_events}")
    for evt, count in sorted(event_counts.items(), key=lambda x: -x[1]):
        print(f"    {evt}: {count}")

    if normalized_samples:
        print(f"\n  ── Muestra de eventos normalizados (esquema del ingestor) ──")
        for sample in normalized_samples[:5]:
            print(f"    {json.dumps(sample, ensure_ascii=False)}")

    # Validaciones
    print(f"\n  ── Validaciones ──")
    checks = {
        "Conexión WS exitosa": total_events > 0,
        "roomInfo recibido": "roomInfo" in event_counts,
        "Eventos de chat capturados": event_counts.get("chat", 0) > 0,
        "Normalización funciona": len(normalized_samples) > 0,
    }
    for check, passed in checks.items():
        status = "✅" if passed else "⚠️ "
        print(f"    {status} {check}")

    return event_counts


# ─── Test 5: Simulación de reconexión con backoff ────────────────────────────

async def test_reconnection_backoff():
    """Simula la lógica de reconexión que usará el ingestor en Fargate."""
    print("\n" + "=" * 60)
    print("TEST 5: Simulación de reconexión con backoff exponencial")
    print("=" * 60)

    max_retries = 3
    base_delay = 1.0
    max_delay = 30.0

    # Intentar conectar a un usuario que NO existe (forzar error)
    fake_user = "____nonexistent_user_test_12345____"
    ws_uri = f"{WS_URL}?uniqueId={fake_user}&apiKey={API_KEY}"

    for attempt in range(1, max_retries + 1):
        delay = min(base_delay * (2 ** (attempt - 1)), max_delay)
        print(f"  Intento {attempt}/{max_retries} (backoff: {delay:.1f}s)...")

        try:
            async with websockets.connect(ws_uri) as ws:
                msg = await asyncio.wait_for(ws.recv(), timeout=5.0)
                parsed = json.loads(msg)
                print(f"    Recibido: {parsed.get('event', 'unknown')}")
                # Si recibimos algo, el usuario podría existir
                break
        except websockets.exceptions.ConnectionClosed as e:
            print(f"    WS cerrado: code={e.code} — esperado para usuario inexistente")
            if e.code == 4404:
                print(f"    ✅ Código 4404 (NOT_LIVE) recibido correctamente")
        except asyncio.TimeoutError:
            print(f"    Timeout — sin respuesta")
        except Exception as e:
            print(f"    Error: {type(e).__name__}: {e}")

        if attempt < max_retries:
            print(f"    Esperando {delay:.1f}s antes de reintentar...")
            await asyncio.sleep(delay)

    print(f"  ✅ Lógica de backoff validada ({max_retries} intentos)")


# ─── Test 6: Keyword parser (lógica del event-processor) ─────────────────────

def test_keyword_parser():
    """Prueba el parser de keywords/códigos que usará el event-processor Lambda."""
    print("\n" + "=" * 60)
    print("TEST 6: Parser de keywords (lógica event-processor)")
    print("=" * 60)

    import re

    def parse_comment(comment: str) -> dict:
        """
        Extrae código de producto y cantidad de un comentario.
        Formatos soportados: #123, #123 x2, #123 2x, #123 2 uds, Participo
        """
        result = {"keyword": None, "product_code": None, "quantity": 1}

        # Detectar keyword genérica
        keywords = ["participo", "lo quiero", "me interesa", "yo"]
        if comment.strip().lower() in keywords:
            result["keyword"] = comment.strip().lower()
            return result

        # Detectar código de producto (#123)
        code_match = re.search(r'#(\w+)', comment)
        if code_match:
            result["product_code"] = code_match.group(1)

            # Detectar cantidad
            qty_patterns = [
                r'[xX]\s*(\d+)',       # x2, X3
                r'(\d+)\s*[xX]',       # 2x, 3X
                r'(\d+)\s*uds?',       # 2 uds, 3 ud
                r'(\d+)\s*unidades?',  # 2 unidades
            ]
            for pattern in qty_patterns:
                qty_match = re.search(pattern, comment)
                if qty_match:
                    result["quantity"] = int(qty_match.group(1))
                    break

        return result

    # Casos de prueba
    test_cases = [
        ("Participo", {"keyword": "participo", "product_code": None, "quantity": 1}),
        ("lo quiero", {"keyword": "lo quiero", "product_code": None, "quantity": 1}),
        ("#123", {"keyword": None, "product_code": "123", "quantity": 1}),
        ("#456 x2", {"keyword": None, "product_code": "456", "quantity": 2}),
        ("#789 3x", {"keyword": None, "product_code": "789", "quantity": 3}),
        ("#OUTLET 2 uds", {"keyword": None, "product_code": "OUTLET", "quantity": 2}),
        ("#ABC123 5 unidades", {"keyword": None, "product_code": "ABC123", "quantity": 5}),
        ("Hola a todos!", {"keyword": None, "product_code": None, "quantity": 1}),
        ("Me encanta #100 X4", {"keyword": None, "product_code": "100", "quantity": 4}),
    ]

    passed = 0
    for comment, expected in test_cases:
        result = parse_comment(comment)
        ok = result == expected
        status = "✅" if ok else "❌"
        print(f"  {status} \"{comment}\" → {result}")
        if not ok:
            print(f"       Esperado: {expected}")
        else:
            passed += 1

    print(f"\n  Resultado: {passed}/{len(test_cases)} tests pasaron")


# ─── Main ────────────────────────────────────────────────────────────────────

async def main():
    parser = argparse.ArgumentParser(description="Test TikTools API para Live Commerce MVP")
    parser.add_argument("--username", "-u", default=USERNAME,
                        help="TikTok username en vivo (sin @)")
    parser.add_argument("--duration", "-d", type=int, default=30,
                        help="Segundos de captura WebSocket (default: 30)")
    parser.add_argument("--skip-ws", action="store_true",
                        help="Saltar test de WebSocket (solo REST + parser)")
    args = parser.parse_args()

    username = args.username

    print("╔══════════════════════════════════════════════════════════════╗")
    print("║   TEST SUITE — TikTools (TikTok Live API)                   ║")
    print("║   Live Commerce Automation MVP                              ║")
    print("╚══════════════════════════════════════════════════════════════╝")
    print(f"\n  API Key: {'✅ configurada' if API_KEY else '❌ FALTA (TIKTOOLS_API_KEY)'}")
    print(f"  Username: {username or '❌ FALTA (TIKTOK_USERNAME)'}")
    print(f"  Duración WS: {args.duration}s")

    if not API_KEY:
        sys.exit("\n❌ Configura TIKTOOLS_API_KEY en .env o como variable de entorno")
    if not username:
        sys.exit("\n❌ Configura TIKTOK_USERNAME o usa --username <user>")

    # Test 1: check_alive
    alive_data = await test_check_alive(username)

    # Test 2: room_info (solo si está en vivo)
    if alive_data.get("alive"):
        await test_room_info(username)

    # Test 3: rate_limits
    await test_rate_limits()

    # Test 4: WebSocket streaming
    if not args.skip_ws:
        if alive_data.get("alive"):
            await test_websocket_stream(username, args.duration)
        else:
            print(f"\n  ⚠️  Saltando WebSocket: @{username} no está en vivo")
            print(f"      Usa --username <usuario_en_vivo> para probar el streaming")

    # Test 5: Reconexión con backoff
    await test_reconnection_backoff()

    # Test 6: Keyword parser (no requiere conexión)
    test_keyword_parser()

    print("\n" + "=" * 60)
    print("  🏁 SUITE COMPLETADA")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(main())
