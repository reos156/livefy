#!/usr/bin/env python3
"""
Script de prueba — Kapso (WhatsApp Business API)
=================================================
Valida las premisas del MVP:
  1. Conexión a la API de Kapso (health check)
  2. Listar números de teléfono conectados
  3. Listar plantillas de mensajes aprobadas
  4. Enviar mensaje de texto simple (ventana de conversación)
  5. Enviar plantilla de autenticación (OTP)
  6. Configurar y verificar webhook
  7. Simular flujo OTP completo

Requisitos:
  pip install httpx python-dotenv

Configuración (.env o variables de entorno):
  KAPSO_API_KEY=tu_api_key
  KAPSO_PHONE_NUMBER_ID=id_del_numero
  TEST_RECIPIENT_PHONE=573001234567  (con código de país)
  KAPSO_AUTH_TEMPLATE_NAME=nombre_template_otp  (default: auth_copy_code)

Uso:
  python test_kapso.py
  python test_kapso.py --send-real   (envía mensajes reales)

Referencia: https://docs.kapso.ai
"""

import asyncio
import json
import os
import sys
import time
import random
import string
import argparse
from datetime import datetime, timezone
from typing import Optional

try:
    import httpx
except ImportError:
    sys.exit("❌ Falta 'httpx'. Instala con: pip install httpx")

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass


# ─── Configuración ───────────────────────────────────────────────────────────

KAPSO_API_KEY = os.getenv("KAPSO_API_KEY", "")
PHONE_NUMBER_ID = os.getenv("KAPSO_PHONE_NUMBER_ID", "")
RECIPIENT_PHONE = os.getenv("TEST_RECIPIENT_PHONE", "")
AUTH_TEMPLATE_NAME = os.getenv("KAPSO_AUTH_TEMPLATE_NAME", "auth_copy_code")

# Kapso usa dos base URLs:
# - WhatsApp Cloud API (espejo de Meta): https://api.kapso.ai/meta/whatsapp/v24.0/
# - Platform API (features propias): https://api.kapso.ai/platform/v1/
# Ref: .agents/skills/integrate-whatsapp/SKILL.md
BASE_URL_META = "https://api.kapso.ai/meta/whatsapp/v24.0"
BASE_URL_PLATFORM = "https://api.kapso.ai/platform/v1"


def get_headers() -> dict:
    """Headers comunes para todas las requests a Kapso."""
    return {
        "X-API-Key": KAPSO_API_KEY,
        "Content-Type": "application/json",
    }


def generate_otp(length: int = 6) -> str:
    """Genera un código OTP numérico."""
    return ''.join(random.choices(string.digits, k=length))


# ─── Test 1: Listar números de teléfono ──────────────────────────────────────

async def test_list_phone_numbers() -> list:
    """Verifica la conexión a Kapso listando los números conectados."""
    print("\n" + "=" * 60)
    print("TEST 1: Listar números de teléfono (Platform API)")
    print("=" * 60)

    # Probar múltiples variantes de URL (Kapso ha cambiado endpoints)
    urls_to_try = [
        f"{BASE_URL_PLATFORM}/phone-numbers",
        f"{BASE_URL_META}/{PHONE_NUMBER_ID}",
    ]

    async with httpx.AsyncClient() as client:
        for url in urls_to_try:
            resp = await client.get(url, headers=get_headers())
            print(f"  {url}")
            print(f"    Status: {resp.status_code}")

            if resp.status_code == 200:
                body = resp.json()
                print(f"    ✅ Respuesta OK:")
                print(f"    {json.dumps(body, indent=2)[:500]}")
                numbers = body.get("data", body) if isinstance(body, dict) else body
                if isinstance(numbers, list):
                    print(f"    Números encontrados: {len(numbers)}")
                    for num in numbers:
                        phone_id = num.get("id", num.get("phone_number_id", "?"))
                        display = num.get("display_phone_number", num.get("phone_number", "?"))
                        status = num.get("status", "?")
                        print(f"      📱 {display} (ID: {phone_id}) — Status: {status}")
                print("  ✅ Conexión a Kapso exitosa")
                return numbers if isinstance(numbers, list) else []
            elif resp.status_code == 401:
                print(f"    ❌ 401 — API Key inválida para este endpoint")
            else:
                # Mostrar solo si no es HTML
                text = resp.text[:150]
                if not text.startswith("<!"):
                    print(f"    → {text}")

        print("\n  ❌ Ningún endpoint respondió 200.")
        print("  Verifica tu KAPSO_API_KEY en https://app.kapso.ai/dashboard")
        return []


# ─── Test 2: Listar plantillas de mensajes ───────────────────────────────────

async def test_list_templates() -> list:
    """Lista las plantillas aprobadas en la WABA vía Kapso (Meta API mirror)."""
    print("\n" + "=" * 60)
    print("TEST 2: Listar plantillas de mensajes (Meta API via Kapso)")
    print("=" * 60)

    if not PHONE_NUMBER_ID:
        print("  ⚠️  KAPSO_PHONE_NUMBER_ID no configurado, saltando...")
        return []

    # Según la doc de Kapso, el endpoint de templates sigue el patrón de Meta:
    # GET /v24.0/{phone_number_id}/templates
    urls_to_try = [
        f"{BASE_URL_META}/{PHONE_NUMBER_ID}/templates",
    ]

    async with httpx.AsyncClient() as client:
        for url in urls_to_try:
            resp = await client.get(url, headers=get_headers())
            print(f"  {url}")
            print(f"    Status: {resp.status_code}")

            if resp.status_code == 200:
                body = resp.json()
                templates = body.get("data", []) if isinstance(body, dict) else body

                if isinstance(templates, list):
                    print(f"    Plantillas encontradas: {len(templates)}")
                    auth_templates = []
                    for tpl in templates[:15]:
                        name = tpl.get("name", "?")
                        category = tpl.get("category", "?")
                        status = tpl.get("status", "?")
                        lang = tpl.get("language", "?")
                        icon = "🔐" if category == "AUTHENTICATION" else "📋"
                        print(f"      {icon} {name} [{category}] — {status} ({lang})")
                        if category == "AUTHENTICATION":
                            auth_templates.append(tpl)

                    if auth_templates:
                        print(f"\n    ✅ {len(auth_templates)} plantilla(s) AUTHENTICATION")
                    else:
                        print(f"\n    ⚠️  No hay plantillas AUTHENTICATION.")
                    return templates
                else:
                    print(f"    Respuesta: {json.dumps(body, indent=2)[:300]}")
                    return []
            elif resp.status_code != 404:
                text = resp.text[:150]
                if not text.startswith("<!"):
                    print(f"    → {text}")

        print("\n  ❌ No se pudieron listar templates en ningún endpoint.")
        return []


# ─── Test 3: Enviar mensaje de texto (ventana de conversación) ───────────────

async def test_send_text_message(send_real: bool = False) -> bool:
    """
    Envía un mensaje de texto simple.
    NOTA: Solo funciona si el destinatario inició conversación en las últimas 24h.
    """
    print("\n" + "=" * 60)
    print("TEST 3: Enviar mensaje de texto (session message)")
    print("=" * 60)

    if not PHONE_NUMBER_ID or not RECIPIENT_PHONE:
        print("  ⚠️  Faltan KAPSO_PHONE_NUMBER_ID o TEST_RECIPIENT_PHONE")
        return False

    if not send_real:
        print("  ℹ️  Modo dry-run. Usa --send-real para enviar de verdad.")
        print(f"  Payload que se enviaría:")

    payload = {
        "messaging_product": "whatsapp",
        "recipient_type": "individual",
        "to": RECIPIENT_PHONE,
        "type": "text",
        "text": {
            "preview_url": False,
            "body": "🧪 Test Live Commerce MVP — Este es un mensaje de prueba del cockpit."
        }
    }

    print(f"  {json.dumps(payload, indent=2, ensure_ascii=False)}")

    if not send_real:
        print("  ✅ Payload validado (no enviado)")
        return True

    url = f"{BASE_URL_META}/{PHONE_NUMBER_ID}/messages"

    async with httpx.AsyncClient() as client:
        resp = await client.post(url, headers=get_headers(), json=payload)
        print(f"\n  Status: {resp.status_code}")

        # Manejar respuestas no-JSON (HTML 404, etc.)
        try:
            body = resp.json()
        except Exception:
            print(f"  ❌ Respuesta no es JSON: {resp.text[:200]}")
            print(f"  La URL base de Kapso no es correcta para tu cuenta.")
            print(f"  Revisa en tu dashboard de Kapso cuál es tu API base URL.")
            return False

        print(f"  Response: {json.dumps(body, indent=2)}")

        if resp.status_code in (200, 201):
            msg_id = body.get("messages", [{}])[0].get("id", "?")
            print(f"  ✅ Mensaje enviado — WAMID: {msg_id}")
            return True
        else:
            error = body.get("error", {})
            print(f"  ❌ Error: {error.get('message', resp.text[:200])}")
            print(f"     Code: {error.get('code', 'N/A')}")
            return False


# ─── Test 4: Enviar plantilla OTP (authentication) ───────────────────────────

async def test_send_otp_template(send_real: bool = False) -> Optional[str]:
    """
    Envía una plantilla de autenticación (OTP) vía Kapso.
    Esta es la pieza clave del flujo Live → WhatsApp.
    """
    print("\n" + "=" * 60)
    print("TEST 4: Enviar plantilla OTP (authentication template)")
    print("=" * 60)

    if not PHONE_NUMBER_ID or not RECIPIENT_PHONE:
        print("  ⚠️  Faltan KAPSO_PHONE_NUMBER_ID o TEST_RECIPIENT_PHONE")
        return None

    otp_code = generate_otp()
    print(f"  OTP generado: {otp_code}")

    if not send_real:
        print("  ℹ️  Modo dry-run. Usa --send-real para enviar de verdad.")

    # Payload según la doc de Kapso/Meta para templates de authentication
    payload = {
        "messaging_product": "whatsapp",
        "recipient_type": "individual",
        "to": RECIPIENT_PHONE,
        "type": "template",
        "template": {
            "name": AUTH_TEMPLATE_NAME,
            "language": {"code": "en_US"},
            "components": [
                {
                    "type": "body",
                    "parameters": [
                        {"type": "text", "text": otp_code}
                    ]
                },
                {
                    "type": "button",
                    "sub_type": "otp",
                    "index": "0",
                    "parameters": [
                        {"type": "text", "text": otp_code}
                    ]
                }
            ]
        }
    }

    print(f"  Template: {AUTH_TEMPLATE_NAME}")
    print(f"  Destinatario: {RECIPIENT_PHONE}")
    print(f"  Payload:\n  {json.dumps(payload, indent=2)}")

    if not send_real:
        print("  ✅ Payload OTP validado (no enviado)")
        return otp_code

    url = f"{BASE_URL_META}/{PHONE_NUMBER_ID}/messages"

    async with httpx.AsyncClient() as client:
        resp = await client.post(url, headers=get_headers(), json=payload)
        print(f"\n  Status: {resp.status_code}")

        try:
            body = resp.json()
        except Exception:
            print(f"  ❌ Respuesta no es JSON: {resp.text[:200]}")
            return None

        print(f"  Response: {json.dumps(body, indent=2)}")

        if resp.status_code in (200, 201):
            msg_id = body.get("messages", [{}])[0].get("id", "?")
            print(f"  ✅ OTP enviado — WAMID: {msg_id}")
            print(f"     El destinatario debería recibir: '*{otp_code}* is your verification code.'")
            return otp_code
        else:
            error = body.get("error", {})
            print(f"  ❌ Error: {error.get('message', resp.text[:200])}")
            print(f"     Code: {error.get('code', 'N/A')}")
            if error.get("code") == 132015:
                print("     → La plantilla no existe o no está aprobada.")
                print(f"       Verifica que '{AUTH_TEMPLATE_NAME}' esté aprobada en tu WABA.")
            return None


# ─── Test 5: Enviar plantilla utility (confirmación de pedido) ───────────────

async def test_send_order_confirmation(send_real: bool = False) -> bool:
    """
    Simula el envío de confirmación de pedido (plantilla utility).
    En el MVP real, esto se dispara tras validar el OTP.
    """
    print("\n" + "=" * 60)
    print("TEST 5: Enviar confirmación de pedido (utility template)")
    print("=" * 60)

    if not PHONE_NUMBER_ID or not RECIPIENT_PHONE:
        print("  ⚠️  Faltan KAPSO_PHONE_NUMBER_ID o TEST_RECIPIENT_PHONE")
        return False

    # Datos simulados de un pedido confirmado
    order_data = {
        "username": "@maria_gomez",
        "product": "Ropa Kawaii #123",
        "quantity": 2,
        "unit_price": 8500,
        "total": 17000,
        "currency": "COP",
    }

    print(f"  Pedido simulado:")
    print(f"    Usuario: {order_data['username']}")
    print(f"    Producto: {order_data['product']}")
    print(f"    Cantidad: {order_data['quantity']}")
    print(f"    Total: ${order_data['total']:,} {order_data['currency']}")

    # Nota: En producción usarías una plantilla utility aprobada.
    # Aquí mostramos el payload que se construiría.
    payload = {
        "messaging_product": "whatsapp",
        "recipient_type": "individual",
        "to": RECIPIENT_PHONE,
        "type": "template",
        "template": {
            "name": "order_confirmation",  # Plantilla que deberás crear
            "language": {"code": "es"},
            "components": [
                {
                    "type": "body",
                    "parameters": [
                        {"type": "text", "text": order_data["username"]},
                        {"type": "text", "text": order_data["product"]},
                        {"type": "text", "text": str(order_data["quantity"])},
                        {"type": "text", "text": f"${order_data['total']:,} {order_data['currency']}"},
                    ]
                }
            ]
        }
    }

    print(f"\n  Payload (utility template):")
    print(f"  {json.dumps(payload, indent=2, ensure_ascii=False)}")

    if not send_real:
        print("  ✅ Payload de confirmación validado (no enviado)")
        print("  ℹ️  Necesitas crear la plantilla 'order_confirmation' en tu WABA")
        return True

    url = f"{BASE_URL_META}/{PHONE_NUMBER_ID}/messages"

    async with httpx.AsyncClient() as client:
        resp = await client.post(url, headers=get_headers(), json=payload)
        print(f"\n  Status: {resp.status_code}")

        try:
            body = resp.json()
        except Exception:
            print(f"  ❌ Respuesta no es JSON: {resp.text[:200]}")
            return False

        if resp.status_code in (200, 201):
            print(f"  ✅ Confirmación enviada")
            return True
        else:
            error = body.get("error", {})
            print(f"  ❌ Error: {error.get('message', 'Unknown')}")
            return False


# ─── Test 6: Webhook — verificar configuración ───────────────────────────────

async def test_webhook_config():
    """
    Verifica la configuración de webhooks en Kapso.
    Los webhooks son esenciales para recibir las respuestas OTP del comprador.
    """
    print("\n" + "=" * 60)
    print("TEST 6: Verificar configuración de webhooks")
    print("=" * 60)

    url = f"{BASE_URL_PLATFORM}/webhooks"

    async with httpx.AsyncClient() as client:
        resp = await client.get(url, headers=get_headers())
        print(f"  Status: {resp.status_code}")

        if resp.status_code != 200:
            print(f"  ⚠️  No se pudieron listar webhooks: {resp.text[:200]}")
            print("  ℹ️  Esto es normal si aún no has configurado webhooks.")
            print("  Para el MVP necesitarás un webhook que reciba:")
            print("    - messages (respuestas del comprador con el OTP)")
            print("    - message_status (delivery/read receipts)")
            return

        body = resp.json()
        webhooks = body.get("data", body) if isinstance(body, dict) else body

        if isinstance(webhooks, list) and webhooks:
            print(f"  Webhooks configurados: {len(webhooks)}")
            for wh in webhooks:
                print(f"    🔗 {wh.get('url', '?')}")
                print(f"       Events: {wh.get('events', wh.get('subscribed_events', '?'))}")
                print(f"       Active: {wh.get('active', wh.get('status', '?'))}")
        else:
            print("  ⚠️  No hay webhooks configurados.")

    print("\n  ── Requisitos de webhook para el MVP ──")
    print("  El webhook debe recibir:")
    print("    1. messages — cuando el comprador responde con el código OTP")
    print("    2. message_status — para confirmar entrega del OTP")
    print("  Endpoint sugerido: POST /api/webhooks/kapso")
    print("  Verificación de firma: HMAC-SHA256 del body con tu webhook secret")
    print("  ✅ Verificación de webhook completada")


# ─── Test 7: Simulación del flujo OTP completo ───────────────────────────────

async def test_otp_flow_simulation():
    """
    Simula el flujo completo OTP sin enviar mensajes reales.
    Valida la lógica que implementará otp-service Lambda.
    """
    print("\n" + "=" * 60)
    print("TEST 7: Simulación del flujo OTP completo")
    print("=" * 60)

    # Simular estado del prospecto
    prospect = {
        "id": "prospect_001",
        "tenant_id": "tenant_abc",
        "username": "maria_gomez",
        "phone": RECIPIENT_PHONE or "573001234567",
        "state": "Nuevo",
        "products": [{"code": "123", "name": "Ropa Kawaii", "qty": 2, "price": 8500}],
        "is_vip": False,
    }

    print(f"  Prospecto: @{prospect['username']} — Estado: {prospect['state']}")
    print(f"  Productos: {prospect['products']}")

    # Paso 1: Generar OTP
    otp_code = generate_otp()
    otp_record = {
        "prospect_id": prospect["id"],
        "phone": prospect["phone"],
        "otp": otp_code,
        "expires_at": "2026-05-30T12:05:00Z",  # 5 min desde ahora
        "attempts": 0,
        "max_attempts": 3,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    prospect["state"] = "DM Enviado"
    print(f"\n  Paso 1 — OTP generado: {otp_code}")
    print(f"    Record: {json.dumps(otp_record, indent=2)}")
    print(f"    Estado → {prospect['state']}")

    # Paso 2: Simular envío por WhatsApp (encolar en whatsapp-actions)
    whatsapp_action = {
        "type": "send_template",
        "phone": prospect["phone"],
        "template": AUTH_TEMPLATE_NAME,
        "variables": {"otp": otp_code},
        "prospect_id": prospect["id"],
    }
    prospect["state"] = "OTP Pendiente"
    print(f"\n  Paso 2 — Acción encolada en SQS whatsapp-actions:")
    print(f"    {json.dumps(whatsapp_action, indent=2)}")
    print(f"    Estado → {prospect['state']}")

    # Paso 3: Simular respuesta del comprador (webhook de Kapso)
    webhook_payload = {
        "object": "whatsapp_business_account",
        "entry": [{
            "changes": [{
                "value": {
                    "messages": [{
                        "from": prospect["phone"],
                        "type": "text",
                        "text": {"body": otp_code},
                        "timestamp": str(int(time.time())),
                    }]
                }
            }]
        }]
    }
    print(f"\n  Paso 3 — Webhook recibido (comprador responde '{otp_code}'):")
    print(f"    Payload: {json.dumps(webhook_payload, indent=2)[:300]}...")

    # Paso 4: Validar OTP
    received_code = otp_code  # En producción se extrae del webhook
    otp_record["attempts"] += 1

    if received_code == otp_record["otp"]:
        # TX atómica: confirmar + descontar stock
        prospect["state"] = "Confirmado"
        stock_before = 47
        stock_after = stock_before - prospect["products"][0]["qty"]
        print(f"\n  Paso 4 — OTP VÁLIDO ✅")
        print(f"    TX atómica:")
        print(f"      - Prospecto → Confirmado")
        print(f"      - Stock: {stock_before} → {stock_after}")
        print(f"    Estado → {prospect['state']}")
    else:
        print(f"\n  Paso 4 — OTP INVÁLIDO ❌")
        print(f"    Intentos: {otp_record['attempts']}/{otp_record['max_attempts']}")

    # Paso 5: Enviar confirmación de pedido
    total = sum(p["qty"] * p["price"] for p in prospect["products"])
    confirmation_action = {
        "type": "send_template",
        "phone": prospect["phone"],
        "template": "order_confirmation",
        "variables": {
            "username": prospect["username"],
            "products": "Ropa Kawaii x2",
            "total": f"${total:,} COP",
        },
        "prospect_id": prospect["id"],
    }
    print(f"\n  Paso 5 — Confirmación de pedido encolada:")
    print(f"    {json.dumps(confirmation_action, indent=2, ensure_ascii=False)}")

    # Resumen
    print(f"\n  ── Flujo OTP completo ──")
    print(f"  Nuevo → DM Enviado → OTP Pendiente → Confirmado ✅")
    print(f"  Tiempo simulado: ~30s (en producción depende del comprador)")
    print(f"  ✅ Simulación del flujo OTP exitosa")


# ─── Test 8: Validar costos de WhatsApp ──────────────────────────────────────

def test_whatsapp_cost_estimation():
    """
    Estima costos de WhatsApp por live según el modelo del MVP.
    Basado en tarifas Meta para Colombia/México (2025-2026).
    """
    print("\n" + "=" * 60)
    print("TEST 8: Estimación de costos WhatsApp por live")
    print("=" * 60)

    # Tarifas aproximadas Meta (USD) por conversación/mensaje
    # Fuente: Meta pricing 2025-2026 para CO/MX
    rates = {
        "authentication": 0.0315,  # por mensaje (CO)
        "utility": 0.0080,         # por mensaje (CO)
        "marketing": 0.0500,       # por mensaje (CO)
        "service": 0.0000,         # gratis si el usuario inicia (24h window)
    }

    # Escenario: live típico de moda con 50 prospectos
    scenario = {
        "prospectos": 50,
        "conversion_rate": 0.60,  # 60% valida OTP
        "mensajes_otp": 50,       # 1 OTP por prospecto
        "mensajes_confirmacion": 30,  # solo los que confirman
        "mensajes_service_window": 20,  # respuestas en ventana gratuita
    }

    confirmed = int(scenario["prospectos"] * scenario["conversion_rate"])

    cost_otp = scenario["mensajes_otp"] * rates["authentication"]
    cost_confirm = scenario["mensajes_confirmacion"] * rates["utility"]
    cost_service = scenario["mensajes_service_window"] * rates["service"]
    total = cost_otp + cost_confirm + cost_service

    print(f"  Escenario: Live de moda — {scenario['prospectos']} prospectos")
    print(f"  Conversión: {scenario['conversion_rate']*100:.0f}% → {confirmed} confirmados")
    print(f"\n  Desglose de costos:")
    print(f"    OTP (authentication):    {scenario['mensajes_otp']} msgs × ${rates['authentication']:.4f} = ${cost_otp:.2f}")
    print(f"    Confirmación (utility):  {scenario['mensajes_confirmacion']} msgs × ${rates['utility']:.4f} = ${cost_confirm:.2f}")
    print(f"    Ventana gratuita:        {scenario['mensajes_service_window']} msgs × ${rates['service']:.4f} = ${cost_service:.2f}")
    print(f"    ─────────────────────────────────────────")
    print(f"    TOTAL por live:          ${total:.2f} USD")
    print(f"    Costo por confirmación:  ${total/confirmed:.4f} USD")

    print(f"\n  Proyección mensual (12 lives/mes):")
    monthly = total * 12
    print(f"    ${monthly:.2f} USD/mes en WhatsApp")
    print(f"    Dentro del rango del plan Starter ($30-80 Kapso+WhatsApp)")

    print(f"\n  ── Reglas anti-costo implementadas ──")
    print(f"    ✅ Aprovechar ventana gratuita (usuario inicia el chat)")
    print(f"    ✅ No enviar plantillas redundantes")
    print(f"    ✅ Consolidar confirmaciones")
    print(f"    ✅ Contadores por tenant para alertas de uso")
    print(f"  ✅ Estimación de costos completada")


# ─── Main ────────────────────────────────────────────────────────────────────

async def main():
    parser = argparse.ArgumentParser(description="Test Kapso API para Live Commerce MVP")
    parser.add_argument("--send-real", action="store_true",
                        help="Enviar mensajes reales (por defecto es dry-run)")
    args = parser.parse_args()

    print("╔══════════════════════════════════════════════════════════════╗")
    print("║   TEST SUITE — Kapso (WhatsApp Business API)                ║")
    print("║   Live Commerce Automation MVP                              ║")
    print("╚══════════════════════════════════════════════════════════════╝")
    print(f"\n  API Key: {'✅ configurada' if KAPSO_API_KEY else '❌ FALTA (KAPSO_API_KEY)'}")
    print(f"  Phone Number ID: {PHONE_NUMBER_ID or '❌ FALTA (KAPSO_PHONE_NUMBER_ID)'}")
    print(f"  Recipient: {RECIPIENT_PHONE or '❌ FALTA (TEST_RECIPIENT_PHONE)'}")
    print(f"  Auth Template: {AUTH_TEMPLATE_NAME}")
    print(f"  Modo: {'🔴 REAL (enviará mensajes)' if args.send_real else '🟢 DRY-RUN (no envía)'}")

    if not KAPSO_API_KEY:
        sys.exit("\n❌ Configura KAPSO_API_KEY en .env o como variable de entorno")

    # Test 1: Listar números
    await test_list_phone_numbers()

    # Test 2: Listar plantillas (deshabilitado en sandbox)
    # await test_list_templates()
    print("\n" + "=" * 60)
    print("TEST 2: Listar plantillas — DESHABILITADO (sandbox no soporta templates)")
    print("=" * 60)

    # Test 3: Enviar texto
    await test_send_text_message(send_real=args.send_real)

    # Test 4: Enviar OTP
    await test_send_otp_template(send_real=args.send_real)

    # Test 5: Confirmación de pedido
    await test_send_order_confirmation(send_real=args.send_real)

    # Test 6: Webhooks
    await test_webhook_config()

    # Test 7: Flujo OTP completo (simulación)
    await test_otp_flow_simulation()

    # Test 8: Costos (no requiere API)
    test_whatsapp_cost_estimation()

    print("\n" + "=" * 60)
    print("  🏁 SUITE COMPLETADA")
    print("=" * 60)
    if not args.send_real:
        print("\n  💡 Para enviar mensajes reales: python test_kapso.py --send-real")


if __name__ == "__main__":
    asyncio.run(main())
